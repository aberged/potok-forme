// Pages of a list: "26–50 of 1,234", first, previous, a page number, next, last.

import { html, nothing } from 'lit-html';
import { number } from '../../model/format';
import type { Page } from '../../store/state';
import { iconButton, ui } from '../common';

export function pager(page: Page, go: (offset: number) => void, id: string, onSize?: (size: number) => void) {
  const t = ui.t;
  if (page.total === 0) return nothing;

  const pages = Math.max(1, Math.ceil(page.total / page.size));
  const current = Math.floor(page.offset / page.size) + 1;
  const first = page.offset + 1;
  const last = Math.min(page.offset + page.rows.length, page.total);

  return html`<nav class="pf-pager" id=${id} aria-label=${t('pageOf', { a: first, b: last, n: page.total })}>
    <span class="pf-muted pf-small">${t('pageOf', { a: number(first, ui.lang), b: number(last, ui.lang), n: number(page.total, ui.lang) })}</span>
    <span class="flex-1"></span>
    ${onSize
      ? html`<label class="pf-small pf-muted">${t('perPage')}
          <select class="pf-select pf-select-small" @change=${(event: Event) => onSize(Number((event.target as HTMLSelectElement).value))}>
            ${[25, 50, 100].map((size) => html`<option value=${size} ?selected=${size === page.size}>${size}</option>`)}
          </select>
        </label>`
      : nothing}
    ${iconButton('first', t('firstPage'), () => go(0), { disabled: current === 1 || page.loading })}
    ${iconButton('left', t('previousPage'), () => go(Math.max(0, page.offset - page.size)), { disabled: current === 1 || page.loading })}
    <label class="pf-small">
      <span class="sr-only">${t('goTo')}</span>
      <input
        type="number"
        min="1"
        max=${pages}
        class="pf-field pf-page-input"
        aria-label=${t('goTo')}
        .value=${String(current)}
        @change=${(event: Event) => {
          const wanted = Math.min(pages, Math.max(1, Math.round(Number((event.target as HTMLInputElement).value) || 1)));
          go((wanted - 1) * page.size);
        }}
      />
      <span class="pf-muted">/ ${number(pages, ui.lang)}</span>
    </label>
    ${iconButton('right', t('nextPage'), () => go(page.offset + page.size), { disabled: current >= pages || page.loading })}
    ${iconButton('last', t('lastPage'), () => go((pages - 1) * page.size), { disabled: current >= pages || page.loading })}
  </nav>`;
}
