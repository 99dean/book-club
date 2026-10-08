// Small reusable UI pieces.
import { html, useEffect } from '../vendor/preact-htm.js';

const COVER_TONES = ['#E8DCC6', '#A9C2E4', '#9CC3A8', '#F0A87A', '#C9B6E4', '#E4C3A9'];
const tone = (s) => COVER_TONES[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COVER_TONES.length];

export function Cover({ book, size = 'm' }) {
  const cls = `cover cover-${size}`;
  if (book.cover_url) return html`<img class=${cls} src=${book.cover_url} alt="" loading="lazy" />`;
  return html`<div class=${cls} style=${{ background: tone(book.title) }} aria-hidden="true">
    <span class="cover-title">${book.title}</span>
    <span class="cover-author">${(book.author || '').split(' ').slice(-1)[0]}</span>
  </div>`;
}

export function Avatar({ member, size = 32, decorative = false }) {
  if (!member) return null;
  return html`<span class="avatar" style=${{ background: member.color, width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.42)}px` }}
    title=${member.name} role=${decorative ? undefined : 'img'} aria-label=${decorative ? undefined : member.name}
    aria-hidden=${decorative ? 'true' : undefined}>${member.name[0]}</span>`;
}

export function Icon({ name, size = 22 }) {
  const paths = {
    book: html`<path d="M2 5h7a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H2z"/><path d="M22 5h-7a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h8z"/>`,
    talk: html`<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`,
    list: html`<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>`,
    shelf: html`<path d="M4 20V4M9 20V7M14 20V4l6 16"/>`,
    plus: html`<path d="M12 5v14M5 12h14"/>`,
    close: html`<path d="M6 6l12 12M18 6L6 18"/>`,
    video: html`<rect x="2" y="6" width="14" height="12" rx="2"/><path d="M16 10l6-3v10l-6-3z"/>`,
    up: html`<path d="M12 19V5M5 12l7-7 7 7"/>`,
    search: html`<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>`,
    tear: html`<path d="M6 3h12v12l-2 2-2-2-2 2-2-2-2 2-2-2z"/>`,
    question: html`<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01"/>`,
    quote: html`<path d="M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6"/>`,
    thought: html`<path d="M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3zM10 22h4"/>`,
    gear: html`<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>`,
    star: html`<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>`,
    check: html`<path d="M5 12l5 5L20 7"/>`,
    back: html`<path d="M15 6l-6 6 6 6"/>`,
    arrow: html`<path d="M5 12h14M13 6l6 6-6 6"/>`,
  };
  return html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}

export function Sheet({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => { removeEventListener('keydown', onKey); document.body.classList.remove('no-scroll'); };
  }, []);
  return html`<div class="sheet-backdrop" onClick=${(e) => e.target === e.currentTarget && onClose()}>
    <div class="sheet glass" role="dialog" aria-modal="true" aria-label=${title}>
      <div class="sheet-head">
        <h2>${title}</h2>
        <button class="icon-btn" aria-label="Close" onClick=${onClose}><${Icon} name="close" /></button>
      </div>
      <div class="sheet-body">${children}</div>
    </div>
  </div>`;
}

export function Toggle({ label, hint, checked, onChange }) {
  return html`<label class="toggle-row">
    <span><span class="toggle-label">${label}</span>${hint && html`<span class="hint">${hint}</span>`}</span>
    <input type="checkbox" role="switch" checked=${checked} onChange=${(e) => onChange(e.currentTarget.checked)} />
    <span class="switch" aria-hidden="true"></span>
  </label>`;
}

export function Stars({ value = 0, onChange, size = 28 }) {
  return html`<div class="stars" role=${onChange ? 'radiogroup' : undefined} aria-label=${`${value} of 5 stars`}>
    ${[1, 2, 3, 4, 5].map((n) => onChange
      ? html`<button type="button" class=${`star ${n <= value ? 'on' : ''}`} aria-label=${`${n} star${n > 1 ? 's' : ''}`}
          onClick=${() => onChange(n)}><${Icon} name="star" size=${size} /></button>`
      : html`<span class=${`star ${n <= value ? 'on' : ''}`}><${Icon} name="star" size=${size} /></span>`)}
  </div>`;
}

export function Links({ links }) {
  return html`<div class="chips">
    ${links.map((l) => html`<a class="chip" href=${l.href} target="_blank" rel="noopener">${l.label}</a>`)}
  </div>`;
}
