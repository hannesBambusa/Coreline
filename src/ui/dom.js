// Small DOM helpers shared by the UI modules. No game logic here.
import { hex, fmt, fmtTime, TAU } from '../utils.js';

export { hex, fmt, fmtTime, TAU };

export const $ = (s) => document.querySelector(s);
export const $$ = (s, root = document) => root.querySelectorAll(s);

/** Remove and re-add a class so its CSS animation plays again. The offsetWidth read forces a reflow. */
export function restartAnimation(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/**
 * Replace el's innerHTML only when the markup changed since last time (cached in data-last).
 * `bind(el)` runs after a swap so handlers can be re-attached. Returns true when a swap happened.
 */
export function swapHtml(el, html, bind) {
  if (el.dataset.last === html) return false;
  el.dataset.last = html;
  el.innerHTML = html;
  if (bind) bind(el);
  return true;
}

/** Wire every [data-buy] element under root to onBuy(id). */
export function bindBuy(root, onBuy) {
  $$('[data-buy]', root).forEach(b => b.onclick = () => onBuy(b.dataset.buy));
}

/** Escape a string for use inside a double-quoted HTML attribute. */
/** in-game confirm dialog; resolves true/false. `okLabel` null hides the confirm button (plain notice). */
export function askConfirm(title, text, { okLabel = 'Confirm', cancelLabel = 'Cancel', danger = true } = {}) {
  return new Promise((resolve) => {
    const el = $('#confirm'), yes = $('#confirm-yes'), no = $('#confirm-no');
    $('#confirm-title').textContent = title;
    $('#confirm-text').textContent = text;
    yes.hidden = okLabel === null; yes.textContent = okLabel || ''; yes.classList.toggle('danger', danger);
    no.textContent = cancelLabel;
    el.hidden = false;
    const done = (v) => { el.hidden = true; document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') done(false); if (e.key === 'Enter' && okLabel !== null) done(true); };
    document.addEventListener('keydown', onKey);
    yes.onclick = () => done(true); no.onclick = () => done(false);
    el.onclick = (e) => { if (e.target === el) done(false); };
  });
}

export const attrQuote = (s) => s.replace(/"/g, '&quot;');
