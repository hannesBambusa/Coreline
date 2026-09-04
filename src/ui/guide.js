// New player guide: a paged dialog (picture + text) shown once to a fresh profile, reopenable from the start screen and Settings.
import { $ } from './dom.js';

const PAGES = [
  { img: 'threat', title: 'What is Coreline?',
    text: `<p>A space idle tower defence. You are the <b>core</b> in the middle of the screen. A rogue AI fleet arrives from every side and your weapons fire on their own.</p>
<p>The game keeps running while you think, and it keeps earning scrap while the tab is closed.</p>` },
  { img: 'gameover', title: 'The goal: hold the line',
    text: `<p><b>Threat</b> rises one level every 40 seconds. Ships get tougher, new types join, a boss shows up every 5th level and full sieges hit at 30 and 60.</p>
<p>When the hull reaches zero the run ends. That is expected: how far you got decides how many <b>fragments</b> you take into the next run. Each run starts stronger than the last.</p>` },
  { img: 'upgrades', title: 'Scrap and upgrades',
    text: `<p>Destroyed ships drop <b>scrap</b>. Open the side panel with <b>☰</b> in the top right and spend it in <b>Upgrades</b> on weapon levels, shields, hull and regen.</p>
<p>Prefer to watch? Press <b>AUTO</b> and the game buys upgrades for you, in the order set in the Upgrades tab.</p>` },
  { img: 'tower', title: 'Weapons and hardpoints',
    text: `<p>Weapons sit in <b>hardpoints</b>. Unlock more slots with scrap in the <b>Tower</b> tab and mount a weapon in each. You can swap a weapon a limited number of times per run.</p>
<p>Two mounted weapons can trigger a <b>combo</b>. The Tower tab lists which pairs work together. Abilities at the bottom of the screen cost scrap and turn a bad moment around.</p>` },
  { img: 'skills', title: 'Fragments buy skills',
    text: `<p><b>Fragments</b> are the permanent currency. Bosses drop them, and ending a run from threat 10 pays out based on how far you got.</p>
<p>Spend them in the <b>Skills</b> tab: open the panel (☰), pick the branching icon, then press <b>Buy</b> on a skill. Skills never reset. Weapon unlocks live in the same tab, so a new weapon is often the best first buy.</p>` },
  { img: 'start', title: 'Ready to start',
    text: `<p>On the start screen pick a <b>difficulty</b> and your <b>starting weapon</b>, then press <b>Start the defence</b>. Space works too.</p>
<p>Harder modes unlock by reaching a threat level on the one below. The Wiki tab describes every ship you will meet. Good luck.</p>` },
];

export class Guide {
  constructor(ui) {
    this.ui = ui;
    this.el = $('#guide');
    this.page = 0;
    this.el.innerHTML = `<div class="card cyan">
      <button id="guide-close" class="link" title="Close (Esc)">✕</button>
      <div class="guide-img"><img alt=""></div>
      <div class="guide-step"></div>
      <h2></h2>
      <div class="guide-text"></div>
      <div class="guide-nav"><button id="guide-prev" class="buy">Back</button><div class="guide-dots"></div><button id="guide-next" class="buy">Next</button></div>
    </div>`;
    // preload the pictures so page flips do not flash
    for (const p of PAGES) { const i = new Image(); i.src = this.src(p); }
    $('#guide-prev').onclick = () => this.go(this.page - 1);
    $('#guide-next').onclick = () => this.page >= PAGES.length - 1 ? this.close() : this.go(this.page + 1);
    $('#guide-close').onclick = () => this.close();
    this.el.onclick = (e) => { if (e.target === this.el) this.close(); };
    this.onKey = (e) => {
      if (e.key === 'Escape') this.close();
      else if (e.key === 'ArrowRight') $('#guide-next').click();
      else if (e.key === 'ArrowLeft') this.go(this.page - 1);
      else return;
      e.stopPropagation();
    };
  }

  src(p) { return `assets/guide/${p.img}.jpg`; }

  get open() { return !this.el.hidden; }

  show(page = 0) {
    this.el.hidden = false;
    document.addEventListener('keydown', this.onKey, true);   // capture: the game's Space / hotkeys stay quiet while reading
    this.go(page);
  }

  go(n) {
    this.page = Math.max(0, Math.min(PAGES.length - 1, n));
    const p = PAGES[this.page], last = this.page === PAGES.length - 1;
    this.el.querySelector('.guide-img img').src = this.src(p);
    this.el.querySelector('.guide-step').textContent = `${this.page + 1} / ${PAGES.length}`;
    this.el.querySelector('h2').textContent = p.title;
    this.el.querySelector('.guide-text').innerHTML = p.text;
    this.el.querySelector('.guide-dots').innerHTML = PAGES.map((_, i) => `<i class="${i === this.page ? 'on' : ''}"></i>`).join('');
    $('#guide-prev').disabled = this.page === 0;
    $('#guide-next').textContent = last ? 'Done' : 'Next';
    $('#guide-next').classList.toggle('go', last);
  }

  close() {
    this.el.hidden = true;
    document.removeEventListener('keydown', this.onKey, true);
    const scene = this.ui.scene;
    if (!scene.profile.seenIntro) { scene.profile.seenIntro = true; scene.saves.save(); }
  }
}
