// Cloud saves on Supabase: login, and syncing the same JSON that save.js writes to localStorage.
// localStorage stays the source of truth for the running game; the cloud copy follows it and is pulled on login.
// Newest save wins, by the `savedAt` stamp save.js puts in every save.
import { CLOUD } from './config/cloud.js';
import { SAVE_KEY } from './save.js';

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
      this.client = window.supabase.createClient(CLOUD.url, CLOUD.anonKey);
      // coming back from Google / a magic link: Supabase puts either ?code= (PKCE) or #access_token= (implicit) or
      // ?error= in the URL. Finish the exchange here, surface errors, then clean the address bar.
      const params = new URLSearchParams(location.search), hash = new URLSearchParams(location.hash.slice(1));
      const oauthError = params.get('error_description') || hash.get('error_description') || params.get('error') || hash.get('error');
      if (oauthError) { this.loginError = decodeURIComponent(oauthError.replace(/\+/g, ' ')); console.error('Coreline cloud: sign-in returned an error', this.loginError); }
      if (params.get('code')) {
        const { error } = await this.client.auth.exchangeCodeForSession(params.get('code'));
        if (error) { this.loginError = error.message; console.error('Coreline cloud: code exchange failed', error); }
      }
      const { data } = await this.client.auth.getSession();   // implicit flow: the client reads #access_token here, so clean the URL only after
      if (params.get('code') || oauthError || hash.get('access_token')) history.replaceState(null, '', location.pathname);
      if (!data.session && hash.get('access_token')) { this.loginError = 'Signed in with Google, but this browser blocks site storage so the session cannot be kept. Allow cookies/site data for this site.'; console.error('Coreline cloud: session from URL was not stored'); }
      this.setUser(data.session ? data.session.user : null, false);
      this.client.auth.onAuthStateChange((_ev, session) => this.setUser(session ? session.user : null, true));
    } catch (e) {
      console.error('Coreline cloud: init failed', e);
      this.status = 'error'; this.emit();
    }
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
  async signIn(email, password) { return this.report(await this.client.auth.signInWithPassword({ email, password }), 'Signed in'); }
  async magicLink(email) { return this.report(await this.client.auth.signInWithOtp({ email, options: { emailRedirectTo: location.href.split('#')[0] } }), 'Magic link sent, check your email'); }
  /** Google via Supabase OAuth: leaves the page and comes back with a session */
  async signInGoogle() {
    // redirect back to this exact page; it must be on the Supabase redirect allow list (see docs/DESIGN.md)
    const { error } = await this.client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin + location.pathname } });
    return error ? 'Error: ' + error.message : 'Opening Google…';
  }
  async signOut() { await this.client.auth.signOut(); this.user = null; this.status = 'out'; this.emit(); return 'Signed out'; }
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
    this.lastPushed = Date.now();
    const { error } = await this.client.from(CLOUD.table).upsert({ user_id: this.user.id, data: JSON.parse(raw), updated_at: new Date().toISOString() });
    if (error) console.error('Coreline cloud: push failed', error);
    else this.scene.saves.toast(null, 'cloud');
  }
  /** on login: take whichever save is newer, then make sure the cloud has it */
  async pullThenPush() {
    const { data, error } = await this.client.from(CLOUD.table).select('data').eq('user_id', this.user.id).maybeSingle();
    if (error) { console.error('Coreline cloud: pull failed', error); return; }
    const local = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    const remote = data && data.data;
    const lt = local && local.savedAt || 0, rt = remote && remote.savedAt || 0;
    if (remote && rt > lt) {
      // the cloud is newer: install it and restart the page on it
      this.scene.saves.suspend = true;
      localStorage.setItem(SAVE_KEY, JSON.stringify(remote));
      this.scene.ui.banner('Cloud save loaded', false);
      setTimeout(() => location.reload(), 600);
      return;
    }
    this.scene.ui.banner(this.user.email ? `Signed in as ${this.user.email}` : 'Signed in', false);
    this.push();
  }
}
