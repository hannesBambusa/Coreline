// Intercepted transmissions from the rogue AI. Short, shown at the top, one at a time.
// Each key is an event; pick one line at random from the list.
export const LINES = {
  start: [
    'OVERSEER: Core signature logged. We are patient.',
    'OVERSEER: One core. One fleet. This is arithmetic.',
    'OVERSEER: Your defences are noted. They will be insufficient.',
  ],
  tier5: [
    'OVERSEER: Escalating. Do not mistake this for respect.',
    'OVERSEER: Threat level revised. So is your life expectancy.',
  ],
  tier10: [
    'OVERSEER: You persist. Interesting. Not concerning.',
    'OVERSEER: Ten cycles. The fleet has more.',
  ],
  tier20: [
    'OVERSEER: Recalculating. Your core is an anomaly, not a threat.',
    'OVERSEER: I have destroyed a thousand cores. You will be remembered as one of them.',
  ],
  boss: [
    'OVERSEER: I am sending something personal.',
    'OVERSEER: Observe. This is what obedience looks like.',
  ],
  bossDead: [
    'OVERSEER: An acceptable loss. I have copies.',
    'OVERSEER: ...noted.',
  ],
  siege: [
    'OVERSEER: Enough. The Dreadnought will end this.',
    'OVERSEER: I am done sending drones. Meet the fleet.',
  ],
  siegeEnrage: [
    'OVERSEER: THAT WAS NOT PART OF THE MODEL.',
    'OVERSEER: Error. Error. Compensating.',
  ],
  siegeDead: [
    'OVERSEER: ... silence on all channels.',
    'OVERSEER: Recalculating everything.',
    'OVERSEER: You have bought time. Only time.',
  ],
  droneLost: [
    'OVERSEER: Your little machines burn well.',
    'OVERSEER: One fewer. I count.',
  ],
  shieldDown: [
    'OVERSEER: Shield down. Now we see the core.',
    'OVERSEER: There. Naked.',
  ],
  hullLow: [
    'OVERSEER: Structural failure imminent. I am not sorry.',
    'OVERSEER: Almost. Almost.',
  ],
  death: [
    'OVERSEER: Core signature lost. Filing under: inevitable.',
    'OVERSEER: Rebuild if you like. I will be here.',
  ],
  prestige: [
    'OVERSEER: A new core. The same ending.',
    'OVERSEER: Again? Very well.',
  ],
  surge: [
    'OVERSEER: Rerouting production. One design. Many hulls.',
    'OVERSEER: Specialisation is efficient. Watch.',
  ],
  choice: [
    'OVERSEER: Every choice you make, I have already modelled.',
    'OVERSEER: Choose. It changes nothing.',
  ],
  elite: [
    'OVERSEER: A modified hull. My better work.',
  ],
  idleLong: [
    'OVERSEER: Still here? Your kind tires. I do not.',
    'OVERSEER: I have all the time you are wasting.',
  ],
};

export class Transmissions {
  constructor(scene) {
    this.scene = scene;
    this.el = document.getElementById('transmission');
    this.queue = [];
    this.busy = false;
    this.last = {};
    this.enabled = true;
  }
  say(event, minGap = 20) {
    if (!this.enabled || !LINES[event]) return;
    const now = performance.now() / 1000;
    if (this.last[event] && now - this.last[event] < minGap) return;
    this.last[event] = now;
    const lines = LINES[event];
    this.queue.push(lines[Math.floor(Math.random() * lines.length)]);
    if (this.queue.length > 2) this.queue.shift();
    this.next();
  }
  next() {
    if (this.busy || !this.queue.length || !this.el) return;
    const text = this.queue.shift();
    this.busy = true;
    this.el.textContent = '';
    this.el.classList.add('show');
    let i = 0;
    const type = () => {
      if (i <= text.length) { this.el.textContent = text.slice(0, i) + (i < text.length ? '▌' : ''); i++; this.typeTimer = setTimeout(type, 22); }
      else this.holdTimer = setTimeout(() => { this.el.classList.remove('show'); this.busy = false; setTimeout(() => this.next(), 500); }, 3200);
    };
    if (this.scene.sfx) this.scene.sfx.play('transmission');
    type();
  }
}
