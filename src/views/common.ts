// Pieces every screen uses: formatted text, fields, a switch, menus, dialogs,
// buttons and the role picker, each in the shape Potok's page gives it.

import { html, nothing, type TemplateResult } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { translator, type Key, type Translate } from '../i18n';
import { parseRich, toggleList, toggleMark, type Inline } from '../model/rich';
import type { PotokRole } from '../potok';
import { state, update } from '../store/state';
import { icon, type IconName } from './icons';

export const ui: { t: Translate; lang: string } = { t: translator('sr'), lang: 'sr' };

export function setUi(lang: string) {
  ui.t = translator(lang);
  ui.lang = ui.t.lang;
}

const inline = (parts: Inline[]): unknown[] =>
  parts.map((part) => {
    switch (part.kind) {
      case 'text':
        return part.text;
      case 'bold':
        return html`<strong>${inline(part.children)}</strong>`;
      case 'italic':
        return html`<em>${inline(part.children)}</em>`;
      case 'underline':
        return html`<u>${inline(part.children)}</u>`;
      case 'link':
        return html`<a class="pf-link" href=${part.href} target="_blank" rel="noopener noreferrer">${part.text}</a>`;
    }
  });

/** Text with the little markup of `model/rich.ts`, as DOM text and elements only. */
export function richText(source: string, className = ''): TemplateResult | typeof nothing {
  const blocks = parseRich(source);
  if (blocks.length === 0) return nothing;

  return html`<div class="pf-rich ${className}">
    ${blocks.map((block) =>
      block.kind === 'list'
        ? block.ordered
          ? html`<ol>${block.items.map((item) => html`<li>${inline(item)}</li>`)}</ol>`
          : html`<ul>${block.items.map((item) => html`<li>${inline(item)}</li>`)}</ul>`
        : html`<p>${block.lines.map((line, index) => html`${index > 0 ? html`<br />` : nothing}${inline(line)}`)}</p>`,
    )}
  </div>`;
}

export function iconButton(
  name: IconName,
  label: string,
  onClick: (event: Event) => void,
  options: { id?: string; active?: boolean; disabled?: boolean; className?: string } = {},
) {
  return html`<button
    type="button"
    id=${options.id ?? nothing}
    class="pf-icon-button ${options.active ? 'pf-icon-button-active' : ''} ${options.className ?? ''}"
    title=${label}
    aria-label=${label}
    ?disabled=${options.disabled}
    @click=${onClick}
  >
    ${icon(name)}
  </button>`;
}

export function toggle(checked: boolean, label: string, onChange: (checked: boolean) => void, options: { id?: string; disabled?: boolean } = {}) {
  return html`<label class="pf-switch ${options.disabled ? 'pf-switch-disabled' : ''}">
    <span class="pf-switch-label">${label}</span>
    <input
      type="checkbox"
      role="switch"
      id=${options.id ?? nothing}
      .checked=${live(checked)}
      ?disabled=${options.disabled}
      @change=${(event: Event) => onChange((event.target as HTMLInputElement).checked)}
    />
    <span class="pf-switch-track" aria-hidden="true"><span class="pf-switch-thumb"></span></span>
  </label>`;
}

/** Grows with its text, as Google's question fields do. */
function autosize(event: Event) {
  const area = event.target as HTMLTextAreaElement;
  area.style.height = 'auto';
  area.style.height = `${area.scrollHeight}px`;
}

export function underlined(
  value: string,
  placeholder: string,
  onInput: (value: string) => void,
  options: { id?: string; className?: string; multiline?: boolean; label?: string; maxlength?: number } = {},
) {
  return options.multiline
    ? html`<textarea
        rows="1"
        id=${options.id ?? nothing}
        class="pf-field ${options.className ?? ''}"
        placeholder=${placeholder}
        aria-label=${options.label ?? placeholder}
        maxlength=${options.maxlength ?? 4000}
        .value=${live(value)}
        @input=${(event: Event) => {
          autosize(event);
          onInput((event.target as HTMLTextAreaElement).value);
        }}
        @focus=${autosize}
      ></textarea>`
    : html`<input
        type="text"
        id=${options.id ?? nothing}
        class="pf-field ${options.className ?? ''}"
        placeholder=${placeholder}
        aria-label=${options.label ?? placeholder}
        maxlength=${options.maxlength ?? 1000}
        .value=${live(value)}
        @input=${(event: Event) => onInput((event.target as HTMLInputElement).value)}
      />`;
}

/** A text field with B, I, U, link and list buttons under it while it has the focus. */
export function richField(
  id: string,
  value: string,
  placeholder: string,
  onInput: (value: string) => void,
  options: { className?: string; multiline?: boolean } = {},
) {
  const apply = (change: (value: string, start: number, end: number) => { value: string; start: number; end: number }) => {
    const field = document.getElementById(id) as HTMLTextAreaElement | HTMLInputElement | null;
    if (!field) return;

    const result = change(field.value, field.selectionStart ?? 0, field.selectionEnd ?? 0);
    onInput(result.value);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(result.start, result.end);
    });
  };

  const link = () =>
    apply((text, start, end) => {
      const chosen = text.slice(start, end) || ui.t('titlePlaceholder');
      const address = window.prompt('https://', 'https://');
      if (!address) return { value: text, start, end };
      const inserted = `[${chosen}](${address})`;
      return { value: text.slice(0, start) + inserted + text.slice(end), start, end: start + inserted.length };
    });

  return html`<div class="pf-rich-field">
    ${underlined(value, placeholder, onInput, { id, className: options.className, multiline: options.multiline ?? true })}
    <div class="pf-format-bar" role="toolbar" @mousedown=${(event: Event) => event.preventDefault()}>
      ${iconButton('bold', 'B', () => apply((text, start, end) => toggleMark(text, start, end, '**')))}
      ${iconButton('italic', 'I', () => apply((text, start, end) => toggleMark(text, start, end, '*')))}
      ${iconButton('underline', 'U', () => apply((text, start, end) => toggleMark(text, start, end, '__')))}
      ${iconButton('link', 'Link', link)}
      ${options.multiline === false
        ? nothing
        : html`${iconButton('listNumbered', '1.', () => apply((text, start, end) => toggleList(text, start, end, true)))}
          ${iconButton('listBullet', '•', () => apply((text, start, end) => toggleList(text, start, end, false)))}`}
    </div>
  </div>`;
}

export function select<T extends string>(
  value: T,
  options: { value: T; label: string }[],
  onChange: (value: T) => void,
  attrs: { id?: string; label?: string; className?: string } = {},
) {
  return html`<select
    id=${attrs.id ?? nothing}
    class="pf-select ${attrs.className ?? ''}"
    aria-label=${attrs.label ?? nothing}
    @change=${(event: Event) => onChange((event.target as HTMLSelectElement).value as T)}
  >
    ${options.map((option) => html`<option value=${option.value} ?selected=${option.value === value}>${option.label}</option>`)}
  </select>`;
}

/** A menu that opens under its button; one at a time in the whole app. */
export function menu(id: string, button: TemplateResult, items: TemplateResult | TemplateResult[], align: 'left' | 'right' = 'right') {
  const open = state.menu === id;

  return html`<div class="pf-menu-anchor">
    <div
      @click=${(event: Event) => {
        event.stopPropagation();
        update((s) => (s.menu = open ? null : id));
      }}
    >
      ${button}
    </div>
    ${open
      ? html`<div class="pf-menu pf-menu-${align}" role="menu" @click=${(event: Event) => event.stopPropagation()}>${items}</div>`
      : nothing}
  </div>`;
}

export function menuItem(label: string, onClick: () => void, options: { checked?: boolean; danger?: boolean; icon?: IconName; id?: string } = {}) {
  return html`<button
    type="button"
    role=${options.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
    aria-checked=${options.checked === undefined ? nothing : String(options.checked)}
    id=${options.id ?? nothing}
    class="pf-menu-item ${options.danger ? 'pf-menu-item-danger' : ''}"
    @click=${() => {
      update((s) => (s.menu = null));
      onClick();
    }}
  >
    <span class="pf-menu-check">${options.checked ? icon('check', 'size-4') : options.icon ? icon(options.icon, 'size-4') : nothing}</span>
    <span>${label}</span>
  </button>`;
}

export function closeDialog() {
  update((s) => (s.dialog = null));
}

/** A dialog as Potok draws one: a sheet from the bottom on a phone, a card in the middle on a wide screen. */
export function dialog(
  title: string,
  body: TemplateResult,
  actions: TemplateResult,
  id = 'pf-dialog',
  symbol: IconName | null = null,
) {
  return html`<div class="pf-backdrop" @click=${closeDialog}>
    <div
      class="pf-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="${id}-title"
      id=${id}
      @click=${(event: Event) => event.stopPropagation()}
      @keydown=${(event: KeyboardEvent) => event.key === 'Escape' && closeDialog()}
    >
      <header class="pf-dialog-head">
        ${symbol ? html`<span class="pf-tile pf-tile-small" aria-hidden="true">${icon(symbol)}</span>` : nothing}
        <h2 id="${id}-title" class="pf-dialog-title">${title}</h2>
        <button type="button" class="pf-icon-button" aria-label=${ui.t('close')} @click=${closeDialog}>${icon('close')}</button>
      </header>
      <div class="pf-dialog-body">${body}</div>
      <footer class="pf-dialog-actions">${actions}</footer>
    </div>
  </div>`;
}

/** Potok's buttons: primary, secondary with a border, soft in the primary color, quiet, and the two that say how it went. */
export type ButtonKind = 'primary' | 'secondary' | 'soft' | 'text' | 'success' | 'danger';

export function button(
  label: string,
  onClick: () => void,
  options: { kind?: ButtonKind; id?: string; disabled?: boolean; icon?: IconName; title?: string } = {},
) {
  return html`<button
    type="button"
    id=${options.id ?? nothing}
    class="pf-button pf-button-${options.kind ?? 'text'}"
    title=${options.title ?? nothing}
    ?disabled=${options.disabled}
    @click=${onClick}
  >
    ${options.icon ? icon(options.icon, 'size-4') : nothing}<span>${label}</span>
  </button>`;
}

export function confirm(text: string, action: () => void, danger = true) {
  update((s) => (s.dialog = { kind: 'confirm', text, action, danger }));
}

/** Roles as chips with checks: who fills in, who sees the responses. */
export function rolePicker(id: string, chosen: string[], onChange: (keys: string[]) => void, options: { everyone?: boolean } = {}) {
  const roles: PotokRole[] | null = state.roles;
  if (!roles) return html`<p class="pf-muted">${ui.t('rolesLoading')}</p>`;

  const shown = roles.filter((role) => options.everyone !== false || role.key !== 'everyone');

  return html`<div class="pf-chips" id=${id} role="group">
    ${shown.map((role) => {
      const on = chosen.includes(role.key);
      return html`<button
        type="button"
        class="pf-chip ${on ? 'pf-chip-on' : ''}"
        aria-pressed=${String(on)}
        @click=${() => onChange(on ? chosen.filter((key) => key !== role.key) : [...chosen, role.key])}
      >
        ${on ? icon('check', 'size-4') : nothing}<span>${role.name}</span>
      </button>`;
    })}
  </div>`;
}

export function roleNames(keys: string[]): string {
  const roles = state.roles ?? [];
  return keys.map((key) => roles.find((role) => role.key === key)?.name ?? key).join(', ');
}

export function notice(text: string, kind: 'info' | 'warning' = 'info', id?: string) {
  return html`<div class="pf-notice pf-notice-${kind}" role="status" id=${id ?? nothing}>
    <span class="pf-notice-icon" aria-hidden="true">${icon(kind === 'warning' ? 'warning' : 'info', 'size-4')}</span><span>${text}</span>
  </div>`;
}

export function key(name: Key): string {
  return ui.t(name);
}
