// Inline SVG icons, 24x24 viewBox, stroke = currentColor so they take the weapon colour.
const wrap = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const ICONS = {
  pulse: wrap(`<circle cx="6" cy="12" r="2.2"/><path d="M10 12h3"/><path d="M15 12h2"/><path d="M19 12h1.5"/><circle cx="6" cy="12" r="5" opacity=".35"/>`),
  railgun: wrap(`<path d="M3 12h18"/><path d="M6 8v8"/><path d="M10 9v6"/><path d="M14 10v4"/><path d="M18 9l3 3-3 3"/><path d="M3 12l3-3M3 12l3 3" opacity=".5"/>`),
  missile: wrap(`<path d="M13 3l8 8-4 1-5-5z"/><path d="M12 7l-7 7 2 2 7-7"/><path d="M6 14l-3 1 2 2 1-3z"/><path d="M8 16l-2 5"/><path d="M4 12l3 1" opacity=".5"/>`),
  laser: wrap(`<circle cx="5" cy="12" r="2"/><path d="M7 12h14"/><path d="M9 10.5h10M9 13.5h10" opacity=".4"/><path d="M19 9l2 3-2 3"/>`),
  tesla: wrap(`<path d="M13 2L6 13h5l-1 9 8-12h-5z"/><path d="M4 6l2 1M20 18l-2-1" opacity=".5"/>`),
  gravity: wrap(`<path d="M12 12a1 1 0 0 1 1-1 2 2 0 0 1 2 2 3 3 0 0 1-3 3 4.5 4.5 0 0 1-4.5-4.5A6 6 0 0 1 13.5 5.5 7.5 7.5 0 0 1 21 13"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="9" opacity=".25"/>`),
  slot: wrap(`<circle cx="12" cy="12" r="8" stroke-dasharray="3 3"/><path d="M12 8v8M8 12h8"/>`),
  shieldMax: wrap(`<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M12 7v10" opacity=".5"/>`),
  shieldRegen: wrap(`<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z" opacity=".5"/><path d="M9 12a3 3 0 0 1 5.2-2"/><path d="M15 12a3 3 0 0 1-5.2 2"/><path d="M14 8v2.5h-2.5M10 16v-2.5h2.5"/>`),
  hull: wrap(`<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 3v18M4 7.5l8 4.5 8-4.5" opacity=".5"/>`),
  ab_emp: wrap(`<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="7" opacity=".6"/><circle cx="12" cy="12" r="11" opacity=".3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" opacity=".6"/>`),
  ab_overcharge: wrap(`<path d="M13 2L5 14h6l-1 8 8-12h-6z"/><path d="M4 4l3 1M20 20l-3-1" opacity=".5"/>`),
  ab_burst: wrap(`<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M12 8v4l3 2" opacity=".7"/><path d="M3 3l2 2M21 3l-2 2M3 21l2-2M21 21l-2-2" opacity=".5"/>`),
  ab_nuke: wrap(`<circle cx="12" cy="12" r="2.5"/><path d="M12 9.5V3a9 9 0 0 1 7.8 4.5l-5.6 3.3M9.8 13.2L4.2 16.5A9 9 0 0 1 4.2 7.5l5.6 3.3M14.2 13.2l5.6 3.3A9 9 0 0 1 12 21v-6.5"/>`),
  level: wrap(`<path d="M6 18l6-6 6 6"/><path d="M6 12l6-6 6 6" opacity=".5"/>`),
};
