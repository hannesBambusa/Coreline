import { GameScene } from './scene.js';

window.game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  disableVisibilityChange: true,
  backgroundColor: '#05060d',
  scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
  scene: [GameScene],
  render: { antialias: true, pixelArt: false },
});

// Keep simulating while the tab is hidden. Browsers stop requestAnimationFrame in background
// tabs, so we step the game from a timer instead, catching up on real elapsed time (capped).
let lastBg = 0, bgTimer = null;
const STEP = 50, MAX_CATCHUP = 60000;
function bgTick() {
  const game = window.game, now = performance.now();
  if (!game || !game.isRunning) { lastBg = now; return; }
  // if the browser is still servicing requestAnimationFrame in the background, Phaser is stepping already
  if (game.loop.actualFps > 5) { lastBg = now; return; }
  let elapsed = Math.min(now - lastBg, MAX_CATCHUP);
  lastBg = now;
  let t = now - elapsed;
  while (elapsed > 0) { const d = Math.min(STEP, elapsed); t += d; game.step(t, d); elapsed -= d; }
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { lastBg = performance.now(); bgTimer = setInterval(bgTick, 1000); }
  else if (bgTimer) { clearInterval(bgTimer); bgTimer = null; bgTick(); }
});
