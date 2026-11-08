// The editor's dialogs: publishing, the theme, a question's answer key, and a
// confirmation before something that cannot be undone.

import { html, nothing } from 'lit-html';
import { emptyKey, THEME_COLORS, type AnswerKey, type Background, type Font, type Question } from '../../model/form';
import { editQuestion, editTheme, findQuestion, setPublished } from '../../store/editor';
import { state, update } from '../../store/state';
import { button, closeDialog, dialog, rolePicker, ui, underlined } from '../common';
import { icon } from '../icons';
import { editSettings } from '../../store/editor';

export function publishDialog() {
  const t = ui.t;
  const settings = state.form.settings;

  return dialog(
    settings.published ? t('published') : t('publishTitle'),
    html`<p>${settings.published ? t('unpublishText') : t('publishText')}</p>
      ${settings.published
        ? nothing
        : html`<div class="pf-setting pf-setting-stack">
              <div>${t('whoFills')}</div>
              ${settings.public
                ? html`<p class="pf-muted pf-small">${t('publicHint')}</p>`
                : rolePicker('publish-fill-roles', settings.fill, (keys) => editSettings((s) => (s.fill = keys)))}
            </div>
            <div class="pf-setting pf-setting-stack">
              <div>${t('whoViews')}</div>
              ${rolePicker('publish-view-roles', settings.view, (keys) => editSettings((s) => (s.view = keys)))}
              <p class="pf-muted pf-small">${t('editorsAlways')}</p>
            </div>`}`,
    html`${button(t('cancel'), closeDialog)}
      ${settings.published
        ? button(t('unpublish'), () => {
            setPublished(false);
            closeDialog();
          }, { kind: 'danger', id: 'unpublish' })
        : button(t('publish'), () => {
            setPublished(true);
            closeDialog();
          }, { kind: 'primary', id: 'publish-confirm' })}`,
    'pf-publish',
  );
}

const FONTS: { value: Font; label: 'fontBasic' | 'fontDecorative' | 'fontFormal' | 'fontPlayful' }[] = [
  { value: 'basic', label: 'fontBasic' },
  { value: 'decorative', label: 'fontDecorative' },
  { value: 'formal', label: 'fontFormal' },
  { value: 'playful', label: 'fontPlayful' },
];

const BACKGROUNDS: { value: Background; label: 'bgLight' | 'bgMedium' | 'bgDark' | 'bgPlain' }[] = [
  { value: 'light', label: 'bgLight' },
  { value: 'medium', label: 'bgMedium' },
  { value: 'dark', label: 'bgDark' },
  { value: 'plain', label: 'bgPlain' },
];

export function themePanel() {
  const t = ui.t;
  const theme = state.form.theme;

  return html`<aside class="pf-theme-panel" id="theme-panel" aria-label=${t('theme')}>
    <div class="pf-theme-head">
      ${icon('palette')}<h2>${t('theme')}</h2>
      <button type="button" class="pf-icon-button" aria-label=${t('close')} @click=${closeDialog}>${icon('close')}</button>
    </div>
    <h3>${t('headerImage')}</h3>
    ${theme.header
      ? html`<div class="pf-theme-header"><img src=${theme.header.url} alt="" />
          ${button(t('removePicture'), () => editTheme((th) => (th.header = null)))}</div>`
      : button(t('addPicture'), () => update((s) => (s.dialog = { kind: 'picture', target: { kind: 'header' } })), { icon: 'image', id: 'theme-header' })}
    <h3>${t('color')}</h3>
    <div class="pf-swatches" role="radiogroup" aria-label=${t('color')}>
      ${THEME_COLORS.map(
        (color) => html`<button
          type="button"
          role="radio"
          aria-checked=${String(color === theme.color)}
          aria-label=${color}
          class="pf-swatch ${color === theme.color ? 'pf-swatch-on' : ''}"
          style="background:${color}"
          @click=${() => editTheme((th) => (th.color = color))}
        >${color === theme.color ? icon('check', 'size-4') : nothing}</button>`,
      )}
    </div>
    <h3>${t('background')}</h3>
    <div class="pf-chips" role="radiogroup">
      ${BACKGROUNDS.map(
        (option) => html`<button
          type="button"
          role="radio"
          aria-checked=${String(option.value === theme.background)}
          class="pf-chip ${option.value === theme.background ? 'pf-chip-on' : ''}"
          @click=${() => editTheme((th) => (th.background = option.value))}
        >${t(option.label)}</button>`,
      )}
    </div>
    <h3>${t('font')}</h3>
    <div class="pf-chips" role="radiogroup">
      ${FONTS.map(
        (option) => html`<button
          type="button"
          role="radio"
          aria-checked=${String(option.value === theme.font)}
          class="pf-chip pf-font-${option.value} ${option.value === theme.font ? 'pf-chip-on' : ''}"
          @click=${() => editTheme((th) => (th.font = option.value))}
        >${t(option.label)}</button>`,
      )}
    </div>
  </aside>`;
}

function changeKey(question: Question, change: (key: AnswerKey) => void) {
  editQuestion(question.id, (q) => {
    q.key = q.key ?? emptyKey();
    change(q.key);
  });
}

function keyBody(question: Question) {
  const t = ui.t;
  const key = question.key ?? emptyKey();

  switch (question.kind) {
    case 'choice':
    case 'dropdown':
    case 'checkbox': {
      const many = question.kind === 'checkbox';
      return html`<p class="pf-muted pf-small">${t('chooseCorrect')}</p>
        <div class="pf-key-options">
          ${question.options.map((option, index) => {
            const on = key.options.includes(option.id);
            return html`<label class="pf-key-option ${on ? 'pf-key-option-on' : ''}">
              <input
                type=${many ? 'checkbox' : 'radio'}
                name="key-${question.id}"
                .checked=${on}
                @change=${() =>
                  changeKey(question, (k) => {
                    k.options = many ? (on ? k.options.filter((id) => id !== option.id) : [...k.options, option.id]) : [option.id];
                  })}
              />
              <span>${option.label || t('optionLabel', { n: index + 1 })}</span>
              ${on ? icon('check', 'size-4 ml-auto text-success') : nothing}
            </label>`;
          })}
        </div>`;
    }
    case 'short':
      return html`<div class="pf-key-texts">
        ${key.texts.map(
          (entry, index) => html`<div class="pf-option-row">
            ${underlined(entry, t('yourAnswer'), (value) => changeKey(question, (k) => (k.texts[index] = value)))}
            <button type="button" class="pf-icon-button" aria-label=${t('removeOption')} @click=${() => changeKey(question, (k) => k.texts.splice(index, 1))}>${icon('close')}</button>
          </div>`,
        )}
        <button type="button" class="pf-text-link" @click=${() => changeKey(question, (k) => k.texts.push(''))}>${t('addCorrect')}</button>
        <label class="pf-check">
          <input type="checkbox" .checked=${key.othersWrong} @change=${(event: Event) => changeKey(question, (k) => (k.othersWrong = (event.target as HTMLInputElement).checked))} />
          <span>${t('othersWrong')}</span>
        </label>
      </div>`;
    case 'grid':
    case 'checkgrid': {
      const many = question.kind === 'checkgrid';
      return html`<div class="pf-grid-scroll">
        <table class="pf-grid-table">
          <thead><tr><th></th>${question.columns.map((column) => html`<th>${column.label}</th>`)}</tr></thead>
          <tbody>
            ${question.rows.map(
              (row) => html`<tr>
                <th>${row.label}</th>
                ${question.columns.map((column) => {
                  const on = (key.rows[row.id] ?? []).includes(column.id);
                  return html`<td>
                    <input
                      type=${many ? 'checkbox' : 'radio'}
                      name="key-${question.id}-${row.id}"
                      aria-label="${row.label} ${column.label}"
                      .checked=${on}
                      @change=${() =>
                        changeKey(question, (k) => {
                          const current = k.rows[row.id] ?? [];
                          k.rows[row.id] = many ? (on ? current.filter((id) => id !== column.id) : [...current, column.id]) : [column.id];
                        })}
                    />
                  </td>`;
                })}
              </tr>`,
            )}
          </tbody>
        </table>
      </div>`;
    }
    default:
      return html`<p class="pf-muted">${t('manualGrading')}</p>`;
  }
}

export function keyDialog(questionId: string) {
  const t = ui.t;
  const question = findQuestion(state.form, questionId);
  if (!question) return nothing;
  const key = question.key ?? emptyKey();

  return dialog(
    t('answerKey'),
    html`<div class="pf-key">
      <div class="pf-key-head">
        <div class="pf-question-title">${question.title || t('untitledQuestion')}</div>
        <label class="pf-points">
          <input
            type="number"
            min="0"
            max="1000"
            class="pf-field pf-narrow"
            id="key-points"
            aria-label=${t('points')}
            .value=${String(question.points)}
            @input=${(event: Event) =>
              editQuestion(question.id, (q) => (q.points = Math.max(0, Math.min(1000, Math.round(Number((event.target as HTMLInputElement).value) || 0)))), `points-${question.id}`)}
          />
          <span>${t('points')}</span>
        </label>
      </div>
      ${keyBody(question)}
      <div class="pf-key-feedback">
        ${underlined(key.ok, t('feedbackCorrect'), (value) => changeKey(question, (k) => (k.ok = value)), { multiline: true })}
        ${underlined(key.bad, t('feedbackIncorrect'), (value) => changeKey(question, (k) => (k.bad = value)), { multiline: true })}
      </div>
    </div>`,
    button(t('done'), closeDialog, { kind: 'primary', id: 'key-done' }),
    'pf-key-dialog',
  );
}

export function confirmDialog(text: string, action: () => void, danger = true) {
  const t = ui.t;
  return dialog(
    text,
    html``,
    html`${button(t('cancel'), closeDialog)}
      ${button(danger ? t('delete') : t('done'), () => {
        closeDialog();
        action();
      }, { kind: danger ? 'danger' : 'primary', id: 'confirm-yes' })}`,
    'pf-confirm',
  );
}
