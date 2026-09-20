import { BENTO, type BentoKey, SHORT } from '../content'

/*
 * The bento cards' detail dialogs, built on first open from content.ts so the page doesn't ship their
 * markup up front. The illustration panel is a copy of the card's own graphic (see bento.ts).
 */

const svg = (body: string, box = '0 0 24 24') =>
  `<svg viewBox="${box}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`

const ICONS: Record<string, string> = {
  gauge: svg('<path d="M4.5 17.5a8.5 8.5 0 1 1 15 0"/><path d="m12 13 3.5-4"/>'),
  loop: svg('<path d="M4 10V8a2 2 0 0 1 2-2h11l-3-3M20 14v2a2 2 0 0 1-2 2H7l3 3"/>'),
  grid: svg('<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><path d="M16.75 4v6.5M13.5 7.25H20"/>'),
  shield: svg('<path d="M12 3.5 5 6v6c0 4.4 3 7.6 7 8.5 4-.9 7-4.1 7-8.5V6l-7-2.5Z"/><path d="M9 12.2 11.3 14.5 15.5 10"/>'),
  mail: svg('<rect x="3.5" y="5.5" width="17" height="13" rx="1.8"/><path d="M4.5 7 12 12.5 19.5 7"/>'),
  user: svg('<circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/>'),
}
const TICK =
  '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor" opacity=".18"/><path d="m4.8 8.2 2 2 4.4-4.6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
const CLOSE = '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>'
const ARROW =
  '<svg class="hp-arrow" viewBox="0 0 10 10" aria-hidden="true"><path class="hp-arrow__stem" d="M0.5 5h6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path class="hp-arrow__head" d="M1.5 1.5 5 5l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)

export function buildDialog(key: BentoKey): HTMLDialogElement {
  const c = BENTO[key]
  const others = (Object.keys(BENTO) as BentoKey[]).filter((k) => k !== key).slice(0, 3)
  const d = document.createElement('dialog')
  d.id = `hp-dialog-${key}`
  d.className = 'hp-dialog'
  d.dataset.hpDialog = key
  // A native <dialog> already has this role implicitly, but only an explicit attribute is
  // selectable: without it the QA overlay sweep can't find these and reported six cards as
  // "did not open" when they open fine.
  d.setAttribute('role', 'dialog')
  d.setAttribute('aria-labelledby', `hp-dialog-${key}-title`)
  d.style.setProperty('--accent', c.accent)
  d.innerHTML = `<div class="hp-dialog__sheet">
  <button type="button" class="hp-dialog__close" data-hp-dialog-close aria-label="Close">${CLOSE}</button>
  <div class="hp-dialog__head">
    <h2 id="hp-dialog-${key}-title" class="hp-h-xl">${esc(c.title)}</h2>
    <p class="hp-dialog__lede">${esc(c.lede)}</p>
    <div class="hp-btns">
      <a href="${c.primary.href}" class="hp-btn hp-btn--primary">${esc(c.primary.label)}${ARROW}</a>
      <a href="#faq" class="hp-btn hp-btn--secondary" data-hp-dialog-close>Read the FAQ</a>
    </div>
    <ul class="hp-dialog__checks">${c.checks.map((t) => `<li>${TICK}${esc(t)}</li>`).join('')}</ul>
  </div>
  <div class="hp-dialog__panel" data-hp-dialog-panel></div>
  <div class="hp-dialog__features">${c.features.map((f) => `<div><span class="hp-dialog__ficon">${ICONS[f.icon]}</span><p>${esc(f.text)}</p></div>`).join('')}</div>
  <div class="hp-dialog__more">
    <h3 class="hp-h-md">More to discover</h3>
    <div class="hp-dialog__more-grid">${others
      .map(
        (k) =>
          `<button type="button" class="hp-dialog__more-card hp-hover" data-hp-open="${k}"><span class="hp-dialog__more-dot" style="background:${BENTO[k].accent}"></span><span>${esc(SHORT[k])}</span><span class="hp-link hp-link--sm">Learn more${ARROW}</span></button>`,
      )
      .join('')}</div>
  </div>
</div>`
  return d
}
