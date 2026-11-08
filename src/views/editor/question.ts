// A question's card in the editor: the active card can be changed, the others
// show the question as the respondent will see it. Like Google's, the footer
// holds duplicate, delete, "Required" and a menu of the less common options.

import { html, nothing, type TemplateResult } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import type { Key } from '../../i18n';
import {
  FILE_COUNTS,
  FILE_SIZES,
  FILE_TYPES,
  NEXT,
  OPTION_KINDS,
  QUESTION_KINDS,
  SUBMIT,
  sections,
  validationFits,
  type Choice,
  type FileType,
  type Line,
  type Question,
  type QuestionKind,
  type Validation,
} from '../../model/form';
import {
  addLine,
  addOption,
  deleteItem,
  duplicateItem,
  editQuestion,
  ensureFileGroups,
  setKind,
} from '../../store/editor';
import { state, update } from '../../store/state';
import { iconButton, menu, menuItem, richField, richText, select, toggle, ui, underlined } from '../common';
import { startDrag } from '../drag';
import { icon, type IconName } from '../icons';
import { pictureView } from './pictures';

export const KIND_LABELS: Record<QuestionKind, Key> = {
  short: 'kindShort',
  paragraph: 'kindParagraph',
  choice: 'kindChoice',
  checkbox: 'kindCheckbox',
  dropdown: 'kindDropdown',
  file: 'kindFile',
  scale: 'kindScale',
  rating: 'kindRating',
  grid: 'kindGrid',
  checkgrid: 'kindCheckgrid',
  date: 'kindDate',
  time: 'kindTime',
};

export const KIND_ICONS: Record<QuestionKind, IconName> = {
  short: 'shortText',
  paragraph: 'paragraph',
  choice: 'radio',
  checkbox: 'checkbox',
  dropdown: 'dropdown',
  file: 'upload',
  scale: 'scale',
  rating: 'star',
  grid: 'grid',
  checkgrid: 'checkGrid',
  date: 'calendar',
  time: 'clock',
};

const TYPE_LABELS: Record<FileType, Key> = {
  document: 'typeDocument',
  presentation: 'typePresentation',
  spreadsheet: 'typeSpreadsheet',
  drawing: 'typeDrawing',
  pdf: 'typePdf',
  image: 'typeImage',
  video: 'typeVideo',
  audio: 'typeAudio',
};

function kindMenu(question: Question) {
  const t = ui.t;

  return menu(
    `kind-${question.id}`,
    html`<button type="button" class="pf-kind-button" id="kind-${question.id}" aria-haspopup="menu">
      ${icon(KIND_ICONS[question.kind])}<span>${t(KIND_LABELS[question.kind])}</span>${icon('down', 'size-4 opacity-60')}
    </button>`,
    QUESTION_KINDS.map((kind) =>
      menuItem(t(KIND_LABELS[kind]), () => setKind(question.id, kind), { icon: KIND_ICONS[kind], checked: kind === question.kind ? true : undefined }),
    ),
  );
}

function optionMark(question: Question, index: number) {
  if (question.kind === 'dropdown') return html`<span class="pf-option-number">${index + 1}.</span>`;
  return html`<span class="pf-option-mark ${question.kind === 'checkbox' ? 'pf-option-square' : ''}" aria-hidden="true"></span>`;
}

function goToSelect(question: Question, option: Choice) {
  const t = ui.t;
  const all = sections(state.form);

  return select(
    option.goTo ?? NEXT,
    [
      { value: NEXT, label: t('continueNext') },
      ...all.slice(1).map((section, index) => ({ value: section.id, label: t('goToSection', { n: index + 2, name: section.title || t('untitledSection') }) })),
      { value: SUBMIT, label: t('submitForm') },
    ],
    (value) => editQuestion(question.id, (q) => (q.options.find((o) => o.id === option.id)!.goTo = value === NEXT ? null : value)),
    { className: 'pf-goto', label: t('branching') },
  );
}

function optionsEditor(question: Question) {
  const t = ui.t;
  const move = (from: number, to: number) =>
    editQuestion(question.id, (q) => {
      const [moved] = q.options.splice(from, 1);
      q.options.splice(to, 0, moved);
    });

  return html`<div class="pf-options" data-drag-list>
    ${repeat(
      question.options,
      (option) => option.id,
      (option, index) => html`<div class="pf-option-row" data-drag-item>
        <span class="pf-option-handle" title=${t('drag')} @pointerdown=${(event: PointerEvent) => startDrag(event, move)}>${icon('drag', 'size-4')}</span>
        ${optionMark(question, index)}
        <div class="pf-option-body">
          ${underlined(option.label, t('optionLabel', { n: index + 1 }), (value) =>
            editQuestion(question.id, (q) => (q.options.find((o) => o.id === option.id)!.label = value), `option-${option.id}`),
          { id: `option-${option.id}`, className: 'pf-option-input' })}
          ${option.picture ? pictureView(option.picture, () => editQuestion(question.id, (q) => (q.options.find((o) => o.id === option.id)!.picture = null)), 'pf-option-picture') : nothing}
        </div>
        ${question.kind !== 'dropdown'
          ? iconButton('image', t('addPicture'), () => update((s) => (s.dialog = { kind: 'picture', target: { kind: 'option', questionId: question.id, optionId: option.id } })))
          : nothing}
        ${question.branching ? goToSelect(question, option) : nothing}
        ${question.options.length > 1
          ? iconButton('close', t('removeOption'), () => editQuestion(question.id, (q) => (q.options = q.options.filter((o) => o.id !== option.id))))
          : nothing}
      </div>`,
    )}
    ${question.other
      ? html`<div class="pf-option-row">
          <span class="pf-option-handle"></span>${optionMark(question, question.options.length)}
          <span class="pf-option-other">${t('otherPlaceholder')}</span>
          ${iconButton('close', t('removeOption'), () => editQuestion(question.id, (q) => (q.other = false)))}
        </div>`
      : nothing}
    <div class="pf-option-row pf-option-add">
      <span class="pf-option-handle"></span>${optionMark(question, question.options.length)}
      <button type="button" class="pf-text-link" id="add-option-${question.id}" @click=${() => addOption(question.id)}>${t('addOption')}</button>
      ${question.kind !== 'dropdown' && !question.other
        ? html`<span class="pf-muted">${t('or')}</span>
            <button type="button" class="pf-text-link pf-accent" @click=${() => addOption(question.id, true)}>${t('addOther')}</button>`
        : nothing}
    </div>
  </div>`;
}

function linesEditor(question: Question, which: 'rows' | 'columns') {
  const t = ui.t;
  const lines: Line[] = question[which];

  return html`<div class="pf-lines">
    <h4 class="pf-lines-title">${t(which)}</h4>
    ${repeat(
      lines,
      (line) => line.id,
      (line, index) => html`<div class="pf-option-row">
        <span class="pf-option-number">${index + 1}.</span>
        ${underlined(line.label, t(which === 'rows' ? 'rowLabel' : 'columnLabel', { n: index + 1 }), (value) =>
          editQuestion(question.id, (q) => (q[which].find((l) => l.id === line.id)!.label = value), `line-${line.id}`),
        { className: 'pf-option-input' })}
        ${lines.length > 1
          ? iconButton('close', t('removeOption'), () => editQuestion(question.id, (q) => (q[which] = q[which].filter((l) => l.id !== line.id))))
          : nothing}
      </div>`,
    )}
    <button type="button" class="pf-text-link" @click=${() => addLine(question.id, which)}>${t(which === 'rows' ? 'addRow' : 'addColumn')}</button>
  </div>`;
}

function scaleEditor(question: Question) {
  const t = ui.t;
  const numbers = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

  return html`<div class="pf-scale-editor">
    <div class="pf-row-wrap">
      ${select(String(question.scaleMin), numbers(0, 1).map((value) => ({ value, label: value })), (value) =>
        editQuestion(question.id, (q) => (q.scaleMin = value === '0' ? 0 : 1)), { label: t('scaleFrom') })}
      <span>${t('scaleTo')}</span>
      ${select(String(question.scaleMax), numbers(2, 10).map((value) => ({ value, label: value })), (value) =>
        editQuestion(question.id, (q) => (q.scaleMax = Number(value))), { label: t('scaleTo') })}
    </div>
    <div class="pf-scale-labels">
      <span class="pf-muted">${question.scaleMin}</span>
      ${underlined(question.scaleMinLabel, t('labelOptional'), (value) => editQuestion(question.id, (q) => (q.scaleMinLabel = value), `smin-${question.id}`), { maxlength: 100 })}
      <span class="pf-muted">${question.scaleMax}</span>
      ${underlined(question.scaleMaxLabel, t('labelOptional'), (value) => editQuestion(question.id, (q) => (q.scaleMaxLabel = value), `smax-${question.id}`), { maxlength: 100 })}
    </div>
  </div>`;
}

function ratingEditor(question: Question) {
  const t = ui.t;
  const levels = Array.from({ length: 8 }, (_, index) => String(index + 3));

  return html`<div class="pf-row-wrap">
    <span class="pf-muted">${t('levels')}</span>
    ${select(String(question.ratingLevels), levels.map((value) => ({ value, label: value })), (value) =>
      editQuestion(question.id, (q) => (q.ratingLevels = Number(value))), { label: t('levels') })}
    ${select(question.ratingIcon, [
      { value: 'star', label: t('iconStar') },
      { value: 'heart', label: t('iconHeart') },
      { value: 'thumb', label: t('iconThumb') },
    ], (value) => editQuestion(question.id, (q) => (q.ratingIcon = value)))}
    <span class="pf-rating-preview">${Array.from({ length: question.ratingLevels }, () => icon(question.ratingIcon, 'size-6'))}</span>
  </div>`;
}

function fileEditor(question: Question) {
  const t = ui.t;
  const restricted = question.fileTypes.length > 0;

  return html`<div class="pf-file-editor">
    ${toggle(restricted, t('fileTypesOnly'), (on) =>
      editQuestion(question.id, (q) => (q.fileTypes = on ? ['document', 'pdf', 'image'] : [])))}
    ${restricted
      ? html`<div class="pf-type-grid">
          ${FILE_TYPES.map((type) => html`<label class="pf-check">
            <input
              type="checkbox"
              .checked=${question.fileTypes.includes(type)}
              @change=${(event: Event) =>
                editQuestion(question.id, (q) => {
                  const on = (event.target as HTMLInputElement).checked;
                  q.fileTypes = on ? [...q.fileTypes, type] : q.fileTypes.filter((entry) => entry !== type);
                })}
            />
            <span>${t(TYPE_LABELS[type])}</span>
          </label>`)}
        </div>`
      : nothing}
    <div class="pf-setting-row">
      <span>${t('maxFiles')}</span>
      ${select(String(question.fileCount), FILE_COUNTS.map((n) => ({ value: String(n), label: String(n) })), (value) =>
        editQuestion(question.id, (q) => (q.fileCount = Number(value))))}
    </div>
    <div class="pf-setting-row">
      <span>${t('maxSize')}</span>
      ${select(String(question.fileSizeMb), FILE_SIZES.map((n) => ({ value: String(n), label: `${n} MB` })), (value) =>
        editQuestion(question.id, (q) => (q.fileSizeMb = Number(value))))}
    </div>
    <div class="pf-setting-row">
      <span>${t('whoOpensFiles')}</span>
      ${select(question.filePrivate ? 'private' : 'public', [
        { value: 'private', label: t('filesPrivate') },
        { value: 'public', label: t('filesPublic') },
      ], (value) => editQuestion(question.id, (q) => (q.filePrivate = value === 'private')))}
    </div>
    <p class="pf-muted pf-small">${t('filesHint')}</p>
  </div>`;
}

const VALIDATION_KINDS: Record<string, Validation['kind'][]> = {
  short: ['number', 'text', 'length', 'regex'],
  paragraph: ['length', 'regex'],
  checkbox: ['count'],
};

const OPS: Record<Validation['kind'], { value: string; label: Key }[]> = {
  number: [
    { value: 'gt', label: 'opGt' },
    { value: 'gte', label: 'opGte' },
    { value: 'lt', label: 'opLt' },
    { value: 'lte', label: 'opLte' },
    { value: 'eq', label: 'opEq' },
    { value: 'neq', label: 'opNeq' },
    { value: 'between', label: 'opBetween' },
    { value: 'not_between', label: 'opNotBetween' },
    { value: 'is_number', label: 'opIsNumber' },
    { value: 'whole', label: 'opWhole' },
  ],
  text: [
    { value: 'contains', label: 'opContains' },
    { value: 'not_contains', label: 'opNotContains' },
    { value: 'email', label: 'opEmail' },
    { value: 'url', label: 'opUrl' },
  ],
  length: [
    { value: 'max', label: 'opMax' },
    { value: 'min', label: 'opMin' },
  ],
  regex: [
    { value: 'contains', label: 'opContains' },
    { value: 'not_contains', label: 'opNotContains' },
    { value: 'matches', label: 'opMatches' },
    { value: 'not_matches', label: 'opNotMatches' },
  ],
  count: [
    { value: 'at_least', label: 'opAtLeast' },
    { value: 'at_most', label: 'opAtMost' },
    { value: 'exactly', label: 'opExactly' },
  ],
};

const KIND_NAMES: Record<Validation['kind'], Key> = { number: 'vNumber', text: 'vText', length: 'vLength', regex: 'vRegex', count: 'vCount' };

function defaultValidation(kind: Validation['kind']): Validation {
  switch (kind) {
    case 'number': return { kind, op: 'is_number', a: null, b: null, error: '' };
    case 'text': return { kind, op: 'contains', value: '', error: '' };
    case 'length': return { kind, op: 'max', value: 100, error: '' };
    case 'regex': return { kind, op: 'matches', value: '', error: '' };
    case 'count': return { kind, op: 'at_least', value: 1, error: '' };
  }
}

function validationEditor(question: Question) {
  const t = ui.t;
  const validation = question.validation;
  if (!validation) return nothing;

  const set = (change: (v: Validation) => void, coalesce: string | null = null) =>
    editQuestion(question.id, (q) => q.validation && change(q.validation), coalesce);
  const numberInput = (value: number | null, onValue: (n: number | null) => void, label: string) =>
    html`<input
      type="number"
      class="pf-field pf-narrow"
      aria-label=${label}
      placeholder=${label}
      .value=${value === null ? '' : String(value)}
      @input=${(event: Event) => {
        const raw = (event.target as HTMLInputElement).value;
        onValue(raw === '' ? null : Number(raw));
      }}
    />`;
  const needsValue =
    (validation.kind === 'number' && !['is_number', 'whole'].includes(validation.op)) ||
    (validation.kind === 'text' && ['contains', 'not_contains'].includes(validation.op)) ||
    validation.kind === 'regex';

  return html`<div class="pf-validation" id="validation-${question.id}">
    ${select(validation.kind, VALIDATION_KINDS[question.kind].map((kind) => ({ value: kind, label: t(KIND_NAMES[kind]) })), (kind) =>
      editQuestion(question.id, (q) => (q.validation = defaultValidation(kind))))}
    ${select(validation.op, OPS[validation.kind].map((op) => ({ value: op.value, label: t(op.label) })), (op) =>
      set((v) => ((v as { op: string }).op = op)))}
    ${validation.kind === 'number' && needsValue
      ? html`${numberInput(validation.a, (n) => set((v) => ((v as { a: number | null }).a = n)), t('value'))}
          ${['between', 'not_between'].includes(validation.op) ? numberInput(validation.b, (n) => set((v) => ((v as { b: number | null }).b = n)), t('value')) : nothing}`
      : nothing}
    ${(validation.kind === 'text' || validation.kind === 'regex') && needsValue
      ? underlined(validation.value, validation.kind === 'regex' ? t('pattern') : t('value'), (value) =>
          set((v) => ((v as { value: string }).value = value), `vval-${question.id}`), { className: 'pf-narrow-text' })
      : nothing}
    ${validation.kind === 'length' || validation.kind === 'count'
      ? numberInput(validation.value, (n) => set((v) => ((v as { value: number }).value = Math.max(0, Math.round(n ?? 0)))), t('value'))
      : nothing}
    ${underlined(validation.error, t('customError'), (value) => set((v) => (v.error = value), `verr-${question.id}`), { className: 'pf-validation-error-field' })}
    ${iconButton('close', t('removeOption'), () => editQuestion(question.id, (q) => (q.validation = null)))}
  </div>`;
}

function bodyEditor(question: Question): TemplateResult | typeof nothing {
  const t = ui.t;

  switch (question.kind) {
    case 'short':
      return html`<div class="pf-placeholder-line">${t('shortAnswerText')}</div>`;
    case 'paragraph':
      return html`<div class="pf-placeholder-line pf-placeholder-long">${t('paragraphText')}</div>`;
    case 'choice':
    case 'checkbox':
    case 'dropdown':
      return optionsEditor(question);
    case 'file':
      return fileEditor(question);
    case 'scale':
      return scaleEditor(question);
    case 'rating':
      return ratingEditor(question);
    case 'grid':
    case 'checkgrid':
      return html`<div class="pf-grid-editor">${linesEditor(question, 'rows')}${linesEditor(question, 'columns')}</div>`;
    case 'date':
      return html`<div class="pf-placeholder-line pf-with-icon">${icon('calendar', 'size-5')}<span>${question.dateYear ? 'dd. mm. gggg.' : 'dd. mm.'}${question.dateTime ? ' — hh:mm' : ''}</span></div>`;
    case 'time':
      return html`<div class="pf-placeholder-line pf-with-icon">${icon('clock', 'size-5')}<span>${question.timeDuration ? t('duration') : t('timeOfDay')}</span></div>`;
  }
}

function moreMenu(question: Question) {
  const t = ui.t;
  const items: TemplateResult[] = [
    menuItem(t('showDescription'), () => editQuestion(question.id, (q) => (q.showDescription = !q.showDescription)), { checked: question.showDescription }),
  ];

  if (VALIDATION_KINDS[question.kind]) {
    items.push(
      menuItem(t('validation'), () =>
        editQuestion(question.id, (q) => (q.validation = q.validation ? null : defaultValidation(VALIDATION_KINDS[q.kind][0]))), { checked: Boolean(question.validation) }),
    );
  }
  if (question.kind === 'choice' || question.kind === 'dropdown') {
    items.push(menuItem(t('branching'), () => editQuestion(question.id, (q) => (q.branching = !q.branching)), { checked: question.branching }));
  }
  if (OPTION_KINDS.includes(question.kind)) {
    items.push(menuItem(t('shuffleOptions'), () => editQuestion(question.id, (q) => (q.shuffle = !q.shuffle)), { checked: question.shuffle }));
  }
  if (question.kind === 'grid' || question.kind === 'checkgrid') {
    items.push(
      menuItem(t('rowRequired'), () => editQuestion(question.id, (q) => (q.rowRequired = !q.rowRequired)), { checked: question.rowRequired }),
      menuItem(t('limitPerColumn'), () => editQuestion(question.id, (q) => (q.limitPerColumn = !q.limitPerColumn)), { checked: question.limitPerColumn }),
      menuItem(t('shuffleRows'), () => editQuestion(question.id, (q) => (q.shuffleRows = !q.shuffleRows)), { checked: question.shuffleRows }),
    );
  }
  if (question.kind === 'date') {
    items.push(
      menuItem(t('includeYear'), () => editQuestion(question.id, (q) => (q.dateYear = !q.dateYear)), { checked: question.dateYear }),
      menuItem(t('includeTime'), () => editQuestion(question.id, (q) => (q.dateTime = !q.dateTime)), { checked: question.dateTime }),
    );
  }
  if (question.kind === 'time') {
    items.push(menuItem(t('duration'), () => editQuestion(question.id, (q) => (q.timeDuration = !q.timeDuration)), { checked: question.timeDuration }));
  }

  return menu(`more-${question.id}`, iconButton('more', t('more'), () => {}, { id: `more-${question.id}` }), items);
}

export function questionEditor(question: Question, index: number, onMove: (from: number, to: number) => void) {
  const t = ui.t;
  const quiz = state.form.settings.quiz.enabled;
  const validationOk = validationFits(question.kind, question.validation);

  return html`<div class="pf-card-handle" title=${t('drag')} @pointerdown=${(event: PointerEvent) => startDrag(event, onMove)}>
      ${icon('drag', 'size-4 rotate-90')}
    </div>
    <div class="pf-question-head">
      ${richField(`title-${question.id}`, question.title, t('questionPlaceholder'), (value) =>
        editQuestion(question.id, (q) => (q.title = value), `title-${question.id}`), { className: 'pf-question-title-field', multiline: false })}
      ${iconButton('image', t('addPicture'), () => update((s) => (s.dialog = { kind: 'picture', target: { kind: 'question', questionId: question.id } })))}
      ${kindMenu(question)}
    </div>
    ${question.showDescription
      ? richField(`description-${question.id}`, question.description, t('descriptionPlaceholder'), (value) =>
          editQuestion(question.id, (q) => (q.description = value), `description-${question.id}`), { className: 'pf-question-description-field' })
      : nothing}
    ${question.picture ? pictureView(question.picture, () => editQuestion(question.id, (q) => (q.picture = null))) : nothing}
    <div class="pf-question-body">${bodyEditor(question)}</div>
    ${validationOk ? validationEditor(question) : nothing}
    <div class="pf-card-footer">
      ${quiz
        ? html`<button type="button" class="pf-text-link pf-accent pf-key-button" id="key-${question.id}" @click=${() => update((s) => (s.dialog = { kind: 'key', questionId: question.id }))}>
              ${icon('checkCircle', 'size-5')}<span>${t('answerKey')}</span>
            </button>
            <span class="pf-muted pf-small">(${t.plural('points', question.points)})</span>`
        : nothing}
      <span class="flex-1"></span>
      ${iconButton('up', t('moveUp'), () => onMove(index, index - 1), { disabled: index === 0, className: 'pf-move-button' })}
      ${iconButton('down', t('moveDown'), () => onMove(index, index + 1), { disabled: index === state.form.items.length - 1, className: 'pf-move-button' })}
      ${iconButton('copy', t('duplicate'), () => duplicateItem(question.id), { id: `duplicate-${question.id}` })}
      ${iconButton('trash', t('delete'), () => deleteItem(question.id), { id: `delete-${question.id}` })}
      <span class="pf-footer-divider"></span>
      ${toggle(question.required, t('required'), (on) => editQuestion(question.id, (q) => (q.required = on)), { id: `required-${question.id}` })}
      ${moreMenu(question)}
    </div>`;
}

/** The card of a question that is not being changed: as the respondent sees it. */
export function questionSummary(question: Question) {
  const t = ui.t;

  return html`<div class="pf-question-preview">
    <div class="pf-question-title">
      ${question.title ? richText(question.title, 'pf-inline') : html`<span class="pf-muted">${t('untitledQuestion')}</span>`}
      ${question.required ? html`<span class="pf-required" aria-label=${t('required')}>*</span>` : nothing}
    </div>
    ${question.showDescription && question.description ? richText(question.description, 'pf-question-description') : nothing}
    ${question.picture ? pictureView(question.picture) : nothing}
    ${OPTION_KINDS.includes(question.kind)
      ? html`<ul class="pf-preview-options">
          ${question.options.map((option, index) => html`<li>${optionMark(question, index)}<span>${option.label || t('optionLabel', { n: index + 1 })}</span></li>`)}
          ${question.other ? html`<li>${optionMark(question, question.options.length)}<span>${t('otherOption')}…</span></li>` : nothing}
        </ul>`
      : html`<div class="pf-preview-kind">${icon(KIND_ICONS[question.kind], 'size-4')}<span>${t(KIND_LABELS[question.kind])}</span></div>`}
  </div>`;
}

/** File questions need the app's file groups. */
export function needsFiles(question: Question) {
  if (question.kind === 'file') void ensureFileGroups();
}
