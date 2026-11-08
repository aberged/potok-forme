// Charts of the summary, drawn with HTML so they follow the frame's width and
// theme. One hue (blue, validated against Potok's light and dark surfaces):
// a choice is one series, so it needs no legend, only its labels. Options keep
// the form's order, as a reader maps them back to the question. A grid is a
// heatmap: magnitude in one hue, the count printed in each cell.

import { html, nothing } from 'lit-html';
import { number } from '../model/format';
import { ui } from './common';

export type Bar = { label: string; count: number; onClick?: () => void };

const share = (count: number, total: number) => (total > 0 ? (count / total) * 100 : 0);
const percent = (count: number, total: number) => `${number(share(count, total), ui.lang, 1)}%`;

/** One bar per option, value at the tip: count and share of those who answered. */
export function barList(bars: Bar[], total: number, id: string) {
  const max = Math.max(1, ...bars.map((bar) => bar.count));

  return html`<ul class="pf-bars" id=${id} role="list">
    ${bars.map((bar) => {
      const width = (bar.count / max) * 100;
      const title = `${bar.label}: ${bar.count} (${percent(bar.count, total)})`;
      const body = html`<span class="pf-bar-grid">
        <span class="pf-bar-label">${bar.label}</span>
        <span class="pf-bar-track"><span class="pf-bar" style="width:${width}%"></span></span>
        <span class="pf-bar-value">${bar.count} <span class="pf-muted">(${percent(bar.count, total)})</span></span>
      </span>`;

      return html`<li class="pf-bar-row" title=${title}>
        ${bar.onClick ? html`<button type="button" class="pf-bar-button" aria-label=${title} @click=${bar.onClick}>${body}</button>` : body}
      </li>`;
    })}
  </ul>`;
}

/** Columns on an ordered axis (a scale, a rating, points): value on each cap that fits. */
export function columns(points: Bar[], total: number, id: string) {
  const max = Math.max(1, ...points.map((point) => point.count));

  return html`<div class="pf-columns" id=${id} role="list">
    ${points.map((point) => {
      const height = (point.count / max) * 100;
      const title = `${point.label}: ${point.count} (${percent(point.count, total)})`;

      return html`<div class="pf-column-item" role="listitem" title=${title} aria-label=${title}>
        <span class="pf-column-value">${point.count > 0 ? point.count : nothing}</span>
        <span class="pf-column-track"><span class="pf-column-bar" style="height:${height}%"></span></span>
        <span class="pf-column-label">${point.label}</span>
      </div>`;
    })}
  </div>`;
}

const STEPS = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281'];

/** Rows × columns, the count of each cell in one hue: darker is more. */
export function heatmap(rows: string[], cols: string[], counts: number[][], id: string) {
  const max = Math.max(1, ...counts.flat());

  return html`<div class="pf-grid-scroll">
    <table class="pf-heatmap" id=${id}>
      <thead><tr><th></th>${cols.map((col) => html`<th scope="col">${col}</th>`)}</tr></thead>
      <tbody>
        ${rows.map(
          (row, r) => html`<tr>
            <th scope="row">${row}</th>
            ${cols.map((col, c) => {
              const count = counts[r]?.[c] ?? 0;
              const step = count === 0 ? -1 : Math.min(STEPS.length - 1, Math.round((count / max) * (STEPS.length - 1)));
              const dark = step >= 6;
              return html`<td
                title="${row}, ${col}: ${count}"
                style=${step < 0 ? '' : `background:${STEPS[step]};color:${dark ? '#ffffff' : '#0b0b0b'}`}
              >${count}</td>`;
            })}
          </tr>`,
        )}
      </tbody>
    </table>
  </div>`;
}

/** One share of a whole: a filled track in one hue. */
export function meter(part: number, total: number, label: string) {
  const width = share(part, total);

  return html`<span class="pf-meter" role="img" aria-label="${label}: ${percent(part, total)}" title="${label}: ${percent(part, total)}">
    <span class="pf-meter-fill" style="width:${width}%"></span>
  </span>`;
}

export function statTiles(tiles: { label: string; value: string }[]) {
  return html`<div class="pf-stats">
    ${tiles.map((tile) => html`<div class="pf-stat"><div class="pf-stat-label">${tile.label}</div><div class="pf-stat-value">${tile.value}</div></div>`)}
  </div>`;
}
