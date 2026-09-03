// Cloud saves on Supabase: login, and syncing the same JSON that save.js writes to localStorage.
// localStorage stays the source of truth for the running game; the cloud copy follows it and is pulled on login.
// Newest save wins, by the `savedAt` stamp save.js puts in every save.
import { CLOUD } from './config/cloud.js';
import { SAVE_KEY } from './save.js';
import { askConfirm } from './ui/dom.js';

/** how much a save is worth: a fresh profile scores ~0, so it can never overwrite real progress */
const progress = (d) => d && d.profile ? (d.profile.prestige || 0) * 1000 + (d.profile.fragments || 0) + Object.keys(d.profile.tree || {}).length * 10 + (d.profile.totalKills || 0) / 100 + (d.profile.bestTime || 0) / 60 : 0;
const FRESH = 20;   // below this a save counts as a fresh profile
const BACKUP_KEY = 'core-defence-backup';   // the local save is copied here before a cloud save replaces it (last 3)

/** keep the previous local save before it is replaced, so nothing is ever lost without a copy */
export function backupLocal(reason) {
  const raw = localStorage.getItem(SAVE_KEY); if (!raw) return;
  try {
    const list = JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]');
    list.unshift({ at: Date.now(), reason, data: JSON.parse(raw) });
    localStorage.setItem(BACKUP_KEY, JSON.stringify(list.slice(0, 3)));
  } catch (e) { console.warn('Coreline: could not write the local backup', e); }
}
export function localBackups() { try { return JSON.parse(localStorage.getItem(BACKUP_KEY) || '[]'); } catch (e) { return []; } }
const describe = (d) => d && d.profile ? `prestige ${d.profile.prestige || 0}, ${d.profile.fragments || 0} fragments, ${Object.keys(d.profile.tree || {}).length} skills, saved ${d.savedAt ? new Date(d.savedAt).toLocaleString() : 'unknown'}` : 'nothing';

const isConfigured = () => !!(CLOUD.url && CLOUD.anonKey);

export class Cloud {
  constructor(scene) {
    this.scene = scene;
    this.client = null;
    this.user = null;
    this.status = isConfigured() ? 'loading' : 'off';   // off | loading | out | in | error
    this.pushTimer = null;
    this.lastPushed = 0;
    this.listeners = [];
    if (isConfigured()) this.init();
  }
  get enabled() { return this.status !== 'off'; }
  onChange(fn) { this.listeners.push(fn); }
  emit() { for (const fn of this.listeners) fn(this); }

  /** load the SDK from the CDN, create the client, pick up an existing session */
  async init() {
    try {
      await new Promise((ok, fail) => {
        if (window.supabase) return ok();
        const s = document.createElement('script'); s.src = CLOUD.sdk; s.onload = ok; s.onerror = () => fail(new Error('sdk')); document.head.appendChild(s);
      });
      // pkce: Google comes back with ?code= (query survives every redirect) instead of a #access_token hash, which
      // some browsers / extensions strip. The exchange below turns the code into a stored session.
      this.client = window.supabase.createClient(CLOUD.url, CLOUD.anonKey, { auth: { flowType: 'pkce', detectSessionInUrl: false } });
      // coming back from Google / a magic link: Supabase puts either ?code= (PKCE) or #access_token= (implicit) or
      // ?error= in the URL. Finish the exchange here, surface errors, then clean the address bar.
      const params = new URLSearchParams(location.search), hash = new URLSearchParams(location.hash.slice(1));
      const oauthError = params.get('error_description') || hash.get('error_description') || params.get('error') || hash.get('error');
      if (oauthError) { this.loginError = decodeURIComponent(oauthError.replace(/\+/g, ' ')); console.error('Coreline cloud: sign-in returned an error', this.loginError); }
      if (params.get('code')) {
        const before = this.verifierKeys();   // read now: the SDK deletes it during the exchange, even a failed one
        console.log('Coreline cloud: back with a code', { verifierKeys: before });
        if (!before.length) this.verifierGone = true;
        const { error } = await this.client.auth.exchangeCodeForSession(params.get('code'));
        if (error) {
          console.error('Coreline cloud: code exchange failed', error);
          this.loginError = /verifier/.test(error.message) ? this.diagnoseLostStorage() : error.message;
        }
      }
      // the SDK reads #access_token during initialize(); it keeps that error to itself unless asked
      const init = await this.client.auth.initialize();
      if (init && init.error) console.error('Coreline cloud: SDK initialize failed', init.error);
      const { data } = await this.client.auth.getSession();   // clean the URL only after the client has read it
      if (params.get('code') || oauthError || hash.get('access_token')) history.replaceState(null, '', location.pathname);
      if (!data.session && hash.get('access_token')) this.loginError = this.diagnoseLostSession(hash.get('access_token'), init && init.error, hash);
      // came back from Google / Supabase with nothing in the URL at all: the redirect went somewhere that dropped it
      let pending = false;
      try { pending = sessionStorage.getItem('coreline-oauth') === '1'; sessionStorage.removeItem('coreline-oauth'); } catch (e) { /* storage blocked */ }
      const fromAuth = pending || /supabase\.co|accounts\.google\.com/.test(document.referrer);
      if (!data.session && !this.loginError && fromAuth && !params.get('code') && !hash.get('access_token')) {
        this.loginError = `returned to ${location.origin + location.pathname} without a token. The Supabase redirect URL must be exactly this address (check the trailing slash), and the Site URL must be on the same origin.`;
        console.error('Coreline cloud: redirect came back without tokens', { referrer: document.referrer, href: location.href });
      }
      this.setUser(data.session ? data.session.user : null, false);
      this.client.auth.onAuthStateChange((_ev, session) => this.setUser(session ? session.user : null, true));
    } catch (e) {
      console.error('Coreline cloud: init failed', e);
      this.status = 'error'; this.emit();
    }
  }

  verifierKeys() { try { return Object.keys(localStorage).filter(k => k.includes('code-verifier')); } catch (e) { return []; } }

  /** the code came back but the verifier written before leaving is gone: storage did not survive the round trip */
  diagnoseLostStorage() {
    let local = null, session = null, cookie = document.cookie.includes('coreline-oauth=1');
    try { local = localStorage.getItem('coreline-oauth'); localStorage.removeItem('coreline-oauth'); } catch (e) { /* blocked */ }
    try { session = sessionStorage.getItem('coreline-oauth'); sessionStorage.removeItem('coreline-oauth'); } catch (e) { /* blocked */ }
    document.cookie = 'coreline-oauth=; max-age=0; path=/';
    console.error('Coreline cloud: storage after the round trip', { localStorage: local, sessionStorage: session, cookie, verifierGone: !!this.verifierGone, origin: location.origin });
    let why;
    if (this.verifierGone && local !== null) why = 'the login verifier was gone on return while everything else in site storage survived. Something removed that one key between leaving and returning: a second tab of the game, or a privacy extension. Close every other Coreline tab and retry.';
    else if (local === null && session === null && !cookie) why = 'nothing written before leaving for Google survived the return trip. This browser wipes site data between page loads for this site: check "clear cookies and site data when you close" / tracking prevention (Edge: Settings → Cookies and site permissions; Brave: Shields), and privacy extensions. Or the page came back on a different address than it left from.';
    else if (local === null) why = 'localStorage was wiped on the way back while other storage survived. A privacy extension or "clear site data" rule is targeting localStorage on this site.';
    else why = 'the login verifier was removed but other site data survived, which points at another tab or extension using Supabase auth on this site.';
    return 'Google signed you in, but ' + why;
  }

  /** Google sent tokens back but no session got stored: say why, from what we can measure here */
  diagnoseLostSession(token, sdkError, hash) {
    let storage = true;
    try { localStorage.setItem('core-defence-probe', '1'); localStorage.removeItem('core-defence-probe'); } catch (e) { storage = false; }
    let skew = null;
    try { const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); skew = Math.round(Date.now() / 1000 - p.iat); } catch (e) { /* not a JWT */ }
    // the SDK refuses the hash when any of these is missing (a proxy / extension / redirect can strip them)
    const missing = ['refresh_token', 'expires_in', 'token_type'].filter(k => !hash.get(k));
    let why;
    if (!storage) why = 'this browser blocks site storage, so the session cannot be kept. Allow cookies / site data for this site (and check it is not a private window).';
    else if (skew !== null && Math.abs(skew) > 60) why = `this computer's clock is ${Math.abs(skew)} s ${skew < 0 ? 'behind' : 'ahead of'} real time, so the login token is rejected. Set the clock to sync automatically and retry.`;
    else if (sdkError) why = `the login library rejected it: "${sdkError.message}". Try another browser or disable extensions on this site.`;
    else if (missing.length) why = `the returned token is incomplete (missing ${missing.join(', ')}). Something between Supabase and this page is rewriting the URL: try another browser or disable extensions.`;
    else why = 'the session was not stored (unknown reason). Try a hard reload, or another browser.';
    console.error('Coreline cloud: session from URL was not stored', { storage, skewSeconds: skew, sdkError, hashKeys: [...hash.keys()] });
    return 'Google signed you in, but ' + why;
  }

  setUser(user, fresh) {
    const was = this.user && this.user.id;
    this.user = user;
    this.status = user ? 'in' : 'out';
    this.emit();
    if (user && user.id !== was) this.pullThenPush();
    else if (!user) this.scene.ui.render();
  }

  // ---- auth ----
  async signUp(email, password) { return this.report(await this.client.auth.signUp({ email, password }), 'Check your email to confirm, then sign in'); }
  async signIn(email, password) { this.loginError = null; return this.report(await this.client.auth.signInWithPassword({ email, password }), 'Signed in'); }
  async magicLink(email) { return this.report(await this.client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split('#')[0] } }), 'Magic link sent, check your email'); }
  /** Google via Supabase OAuth: leaves the page and comes back with a session */
  async signInGoogle() {
    this.loginError = null;
    // three markers, so the return trip can tell which kinds of storage survive on this browser
    try { sessionStorage.setItem('coreline-oauth', '1'); localStorage.setItem('coreline-oauth', '1'); } catch (e) { /* blocked: the return trip will say so */ }
    document.cookie = 'coreline-oauth=1; max-age=600; path=/; SameSite=Lax';
    // redirect back to this exact page; it must be on the Supabase redirect allow list (see docs/DESIGN.md)
    const { data, error } = await this.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname, skipBrowserRedirect: true } });
    if (error) return 'Error: ' + error.message;
    // the SDK has now written the pkce verifier; make sure it is really there before we leave
    const verifier = this.verifierKeys();
    console.log('Coreline cloud: leaving for Google', { verifierKeys: verifier, url: data.url });
    if (!verifier.length) return 'Error: the login verifier was not written to site storage, so the return trip would fail. Try another browser.';
    location.assign(data.url);
    return 'Opening Google…';
  }
  /** sign out, drop the local copy of this account's save and restart on the login screen */
  async signOut() {
    if (!this.scene.gameOver) this.scene.saves.save();
    await this.push();   // last sync so nothing is lost
    await this.client.auth.signOut();
    this.user = null; this.status = 'out';
    this.scene.saves.suspend = true;   // the autosave must not write the old run back
    this.scene.saves.clear();
    location.reload();
    return 'Signed out';
  }
  report({ error }, okText) { return error ? 'Error: ' + error.message : okText; }

  // ---- sync ----
  /** called by save.js after every local write */
  noteSaved() {
    if (this.status !== 'in') return;
    clearTimeout(this.pushTimer);
    const wait = Math.max(0, CLOUD.syncDebounceMs - (Date.now() - this.lastPushed));
    this.pushTimer = setTimeout(() => this.push(), wait);
  }
  async push() {
    if (this.status !== 'in') return;
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw), lp = progress(data);
    // never quietly replace real cloud progress with a far poorer save (a wiped device, a stale tab): keep the cloud, tell the player
    if ((this.remoteProgress || 0) >= FRESH && lp < (this.remoteProgress || 0) * 0.5) {
      console.warn('Coreline cloud: push refused, this device has far less progress than the cloud', { local: lp, cloud: this.remoteProgress });
      this.scene.saves.toast('Cloud kept · this device has less progress');
      return;
    }
    this.lastPushed = Date.now();
    const { error } = await this.client.from(CLOUD.table).upsert({ user_id: this.user.id, data, updated_at: new Date().toISOString() });
    if (error) console.error('Coreline cloud: push failed', error);
    else { this.remoteProgress = lp; this.scene.saves.toast(null, 'cloud'); }
  }
  /**
   * On login, decide which save to keep. A fresh profile never overwrites real progress in either direction; when
   * both sides have real progress and differ, the player picks. Only then does the cloud get written.
   */
  async pullThenPush() {
    const { data, error } = await this.client.from(CLOUD.table).select('data').eq('user_id', this.user.id).maybeSingle();
    if (error) { console.error('Coreline cloud: pull failed', error); return; }
    const local = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    const remote = data && data.data;
    const lp = progress(local), rp = progress(remote);
    this.remoteProgress = rp;
    let useCloud;
    if (!remote || rp < FRESH) useCloud = false;                 // nothing real in the cloud: keep this device
    else if (!local || lp < FRESH) useCloud = true;               // this device is fresh: take the cloud
    else if (JSON.stringify(local.profile) === JSON.stringify(remote.profile)) useCloud = (remote.savedAt || 0) > (local.savedAt || 0);   // same profile, newer run wins
    else {
      useCloud = await askConfirm('Which save do you want to keep?',
        `Cloud: ${describe(remote)}.\nThis device: ${describe(local)}.\nThe other one is replaced.`,
        { okLabel: 'Use cloud save', cancelLabel: 'Keep this device', danger: false });
    }
    if (useCloud) {
      this.scene.saves.suspend = true;
      backupLocal('replaced by cloud save');
      localStorage.setItem(SAVE_KEY, JSON.stringify(remote));
      this.scene.ui.banner('Cloud save loaded', false);
      setTimeout(() => location.reload(), 600);
      return;
    }
    this.scene.ui.banner(this.user.email ? `Signed in as ${this.user.email}` : 'Signed in', false);
    this.push();
  }
}
