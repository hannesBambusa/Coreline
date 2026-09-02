// Small DOM helpers shared by the UI modules. No game logic here.
import { hex, fmt, fmtTime } from '../utils.js';

export { hex, fmt, fmtTime };

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
export const attrQuote = (s) => s.replace(/"/g, '&quot;');
