// Inline SVG icons for the effect chips the scene adds (surge, choice card, siege). 24x24, stroke = currentColor.
const wrap = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">${body}</svg>`;

export const ICONS_SURGE = wrap(`<path d="M4 17l5-5 4 4 7-8"/><path d="M14 8h6v6"/>`);
export const ICONS_CHOICE = wrap(`<path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5"/>`);
export const ICONS_SIEGE = wrap(`<path d="M12 2l3 6 6 1-4.5 4 1.5 6-6-3-6 3 1.5-6L3 9l6-1z"/>`);
