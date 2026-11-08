// How each kind of question is answered, as Google's form shows it.

import { html, nothing, type TemplateResult } from 'lit-html';
import { live } from 'lit-html/directives/live.js';
import { fileRefs, shuffled, type Answer } from '../../model/answers';
import { bytes } from '../../model/format';
import { OTHER, type Question } from '../../model/form';
import { acceptOf, removeFile, sendFiles, setAnswer, setOther } from '../../store/fill';
import { state } from '../../store/state';
import { ui } from '../common';
import { icon } from '../icons';
import { pictureView } from '../editor/pictures';

const valueOf = (event: Event) => (event.target as HTMLInputElement).value;

function choices(question: Question) {
  return question.shuffle ? shuffled(question.options, `${state.fill.seed}:${question.id}`) : question.options;
}

function choiceInput(question: Question, disabled: boolean) {
  const t = ui.t;
  const answer = state.fill.answers[question.id];
  const other = state.fill.other[question.id] ?? '';

  return html`<div class="pf-answers" role="radiogroup" aria-labelledby="q-${question.id}">
    ${choices(question).map(
      (option) => html`<label class="pf-answer">
        <input
          type="radio"
          name="q-${question.id}"
          .checked=${live(answer === option.id)}
          ?disabled=${disabled}
          @change=${() => setAnswer(question, option.id)}
        />
        <span class="pf-answer-text">${option.label}</span>
        ${option.picture ? pictureView(option.picture, undefined, 'pf-option-picture') : nothing}
      </label>`,
    )}
    ${question.other
      ? html`<label class="pf-answer pf-answer-other">
          <input type="radio" name="q-${question.id}" .checked=${live(answer === OTHER)} ?disabled=${disabled} @change=${() => setAnswer(question, OTHER)} />
          <span class="pf-answer-text">${t('otherOption')}:</span>
          <input
            type="text"
            class="pf-field pf-other-field"
            aria-label=${t('otherOption')}
            .value=${live(other)}
            ?disabled=${disabled}
            @input=${(event: Event) => {
              setOther(question, valueOf(event));
              if (answer !== OTHER) setAnswer(question, OTHER);
            }}
          />
        </label>`
      : nothing}
    ${answer !== undefined && !question.required && !disabled
      ? html`<button type="button" class="pf-text-link pf-clear-choice" @click=${() => setAnswer(question, null)}>${t('clearChoice')}</button>`
      : nothing}
  </div>`;
}

function checkboxInput(question: Question, disabled: boolean) {
  const t = ui.t;
  const answer = Array.isArray(state.fill.answers[question.id]) ? (state.fill.answers[question.id] as string[]) : [];
  const other = state.fill.other[question.id] ?? '';
  const flip = (id: string, on: boolean) => setAnswer(question, on ? [...answer, id] : answer.filter((entry) => entry !== id));

  return html`<div class="pf-answers" role="group" aria-labelledby="q-${question.id}">
    ${choices(question).map(
      (option) => html`<label class="pf-answer">
        <input type="checkbox" .checked=${live(answer.includes(option.id))} ?disabled=${disabled} @change=${(event: Event) => flip(option.id, (event.target as HTMLInputElement).checked)} />
        <span class="pf-answer-text">${option.label}</span>
        ${option.picture ? pictureView(option.picture, undefined, 'pf-option-picture') : nothing}
      </label>`,
    )}
    ${question.other
      ? html`<label class="pf-answer pf-answer-other">
          <input type="checkbox" .checked=${live(answer.includes(OTHER))} ?disabled=${disabled} @change=${(event: Event) => flip(OTHER, (event.target as HTMLInputElement).checked)} />
          <span class="pf-answer-text">${t('otherOption')}:</span>
          <input
            type="text"
            class="pf-field pf-other-field"
            aria-label=${t('otherOption')}
            .value=${live(other)}
            ?disabled=${disabled}
            @input=${(event: Event) => {
              setOther(question, valueOf(event));
              if (!answer.includes(OTHER)) flip(OTHER, true);
            }}
          />
        </label>`
      : nothing}
  </div>`;
}

function dropdownInput(question: Question, disabled: boolean) {
  const t = ui.t;
  const answer = state.fill.answers[question.id];

  return html`<select
    class="pf-select pf-answer-select"
    aria-labelledby="q-${question.id}"
    ?disabled=${disabled}
    @change=${(event: Event) => setAnswer(question, (event.target as HTMLSelectElement).value || null)}
  >
    <option value="" ?selected=${answer === undefined}>${t('choose')}</option>
    ${choices(question).map((option) => html`<option value=${option.id} ?selected=${answer === option.id}>${option.label}</option>`)}
  </select>`;
}

function scaleInput(question: Question, disabled: boolean) {
  const answer = state.fill.answers[question.id];
  const points = Array.from({ length: question.scaleMax - question.scaleMin + 1 }, (_, index) => question.scaleMin + index);

  return html`<div class="pf-scale" role="radiogroup" aria-labelledby="q-${question.id}">
    <span class="pf-scale-label">${question.scaleMinLabel}</span>
    <div class="pf-scale-points">
      ${points.map(
        (point) => html`<label class="pf-scale-point">
          <span>${point}</span>
          <input type="radio" name="q-${question.id}" .checked=${live(answer === point)} ?disabled=${disabled} @change=${() => setAnswer(question, point)} />
        </label>`,
      )}
    </div>
    <span class="pf-scale-label">${question.scaleMaxLabel}</span>
  </div>`;
}

function ratingInput(question: Question, disabled: boolean) {
  const answer = typeof state.fill.answers[question.id] === 'number' ? (state.fill.answers[question.id] as number) : 0;

  return html`<div class="pf-rating" role="radiogroup" aria-labelledby="q-${question.id}">
    ${Array.from({ length: question.ratingLevels }, (_, index) => index + 1).map(
      (level) => html`<label class="pf-rating-level ${level <= answer ? 'pf-rating-on' : ''}" title=${String(level)}>
        <input type="radio" class="sr-only" name="q-${question.id}" .checked=${live(answer === level)} ?disabled=${disabled} @change=${() => setAnswer(question, level)} />
        ${icon(question.ratingIcon, 'size-8')}
        <span class="pf-rating-number">${level}</span>
      </label>`,
    )}
  </div>`;
}

function gridInput(question: Question, disabled: boolean) {
  const many = question.kind === 'checkgrid';
  const answer = (state.fill.answers[question.id] ?? {}) as Record<string, string | string[]>;
  const rows = question.shuffleRows ? shuffled(question.rows, `${state.fill.seed}:${question.id}:rows`) : question.rows;

  const set = (rowId: string, columnId: string, on: boolean) => {
    const next = { ...answer } as Record<string, string | string[]>;
    if (many) {
      const current = Array.isArray(next[rowId]) ? (next[rowId] as string[]) : [];
      next[rowId] = on ? [...current, columnId] : current.filter((id) => id !== columnId);
      if ((next[rowId] as string[]).length === 0) delete next[rowId];
    } else {
      next[rowId] = columnId;
    }
    setAnswer(question, Object.keys(next).length ? (next as Answer) : null);
  };

  return html`<div class="pf-grid-scroll">
    <table class="pf-grid-table" aria-labelledby="q-${question.id}">
      <thead><tr><th></th>${question.columns.map((column) => html`<th scope="col">${column.label}</th>`)}</tr></thead>
      <tbody>
        ${rows.map(
          (row) => html`<tr>
            <th scope="row">${row.label}</th>
            ${question.columns.map((column) => {
              const cell = answer[row.id];
              const on = Array.isArray(cell) ? cell.includes(column.id) : cell === column.id;
              return html`<td>
                <input
                  type=${many ? 'checkbox' : 'radio'}
                  name="q-${question.id}-${row.id}"
                  aria-label="${row.label}, ${column.label}"
                  .checked=${live(on)}
                  ?disabled=${disabled}
                  @change=${(event: Event) => set(row.id, column.id, (event.target as HTMLInputElement).checked)}
                />
              </td>`;
            })}
          </tr>`,
        )}
      </tbody>
    </table>
  </div>`;
}

function dateInput(question: Question, disabled: boolean) {
  const answer = typeof state.fill.answers[question.id] === 'string' ? (state.fill.answers[question.id] as string) : '';

  if (!question.dateYear) {
    // A date without a year, as "MM-DD": two fields, as Google shows it.
    const [month = '', day = ''] = answer.split('T')[0].split('-');
    const write = (m: string, d: string) =>
      setAnswer(question, m && d ? `${m.padStart(2, '0')}-${d.padStart(2, '0')}` : null);
    return html`<div class="pf-row-wrap">
      <input type="number" min="1" max="31" class="pf-field pf-narrow" placeholder="dd" aria-label="dd" .value=${live(day)} ?disabled=${disabled} @input=${(event: Event) => write(month, valueOf(event))} />
      <span>.</span>
      <input type="number" min="1" max="12" class="pf-field pf-narrow" placeholder="mm" aria-label="mm" .value=${live(month)} ?disabled=${disabled} @input=${(event: Event) => write(valueOf(event), day)} />
    </div>`;
  }

  return html`<input
    type=${question.dateTime ? 'datetime-local' : 'date'}
    class="pf-field pf-narrow-date"
    aria-labelledby="q-${question.id}"
    .value=${live(answer)}
    ?disabled=${disabled}
    @change=${(event: Event) => setAnswer(question, valueOf(event) || null)}
  />`;
}

function timeInput(question: Question, disabled: boolean) {
  const answer = typeof state.fill.answers[question.id] === 'string' ? (state.fill.answers[question.id] as string) : '';

  if (question.timeDuration) {
    const [hours = '', minutes = '', seconds = ''] = answer.split(':');
    const write = (h: string, m: string, s: string) =>
      setAnswer(question, h || m || s ? [h || '0', (m || '0').padStart(2, '0'), (s || '0').padStart(2, '0')].join(':') : null);
    return html`<div class="pf-row-wrap" aria-labelledby="q-${question.id}">
      <input type="number" min="0" max="72" class="pf-field pf-narrow" placeholder="h" aria-label="h" .value=${live(hours)} ?disabled=${disabled} @input=${(e: Event) => write(valueOf(e), minutes, seconds)} />
      <span>:</span>
      <input type="number" min="0" max="59" class="pf-field pf-narrow" placeholder="min" aria-label="min" .value=${live(minutes)} ?disabled=${disabled} @input=${(e: Event) => write(hours, valueOf(e), seconds)} />
      <span>:</span>
      <input type="number" min="0" max="59" class="pf-field pf-narrow" placeholder="s" aria-label="s" .value=${live(seconds)} ?disabled=${disabled} @input=${(e: Event) => write(hours, minutes, valueOf(e))} />
    </div>`;
  }

  return html`<input type="time" class="pf-field pf-narrow-date" aria-labelledby="q-${question.id}" .value=${live(answer)} ?disabled=${disabled} @change=${(event: Event) => setAnswer(question, valueOf(event) || null)} />`;
}

function fileInput(question: Question, disabled: boolean) {
  const t = ui.t;
  const refs = fileRefs(state.fill.answers[question.id]);
  const uploads = state.fill.uploads[question.id] ?? [];
  const room = refs.length + uploads.length < question.fileCount;

  return html`<div class="pf-files">
    ${refs.map(
      (ref) => html`<div class="pf-file-chip">
        ${icon('file', 'size-5')}<span class="pf-file-name">${ref.name}</span><span class="pf-muted pf-small">${bytes(ref.size, ui.lang)}</span>
        ${disabled ? nothing : html`<button type="button" class="pf-icon-button" aria-label=${t('removeOption')} @click=${() => removeFile(question, ref.file)}>${icon('close', 'size-4')}</button>`}
      </div>`,
    )}
    ${uploads.map(
      (upload) => html`<div class="pf-file-chip pf-file-uploading">
        ${icon('upload', 'size-5')}<span class="pf-file-name">${upload.name}</span>
        <span class="pf-muted pf-small">${t('uploading', { n: upload.progress })}</span>
        <span class="pf-progress"><span style="width:${upload.progress}%"></span></span>
      </div>`,
    )}
    ${room && !disabled
      ? html`<label class="pf-button pf-button-outline">
          ${icon('upload', 'size-4')}<span>${t('addFile')}</span>
          <input
            type="file"
            class="sr-only"
            accept=${acceptOf(question) || nothing}
            ?multiple=${question.fileCount > 1}
            @change=${(event: Event) => {
              const input = event.target as HTMLInputElement;
              const files = Array.from(input.files ?? []);
              input.value = '';
              void sendFiles(question, files);
            }}
          />
        </label>`
      : nothing}
  </div>`;
}

export function answerInput(question: Question, disabled = false): TemplateResult {
  const t = ui.t;
  const answer = state.fill.answers[question.id];

  switch (question.kind) {
    case 'short':
      return html`<input
        type="text"
        class="pf-field pf-answer-field"
        placeholder=${t('yourAnswer')}
        aria-labelledby="q-${question.id}"
        maxlength="4000"
        .value=${live(typeof answer === 'string' ? answer : '')}
        ?disabled=${disabled}
        @input=${(event: Event) => setAnswer(question, valueOf(event))}
      />`;
    case 'paragraph':
      return html`<textarea
        rows="2"
        class="pf-field pf-answer-field"
        placeholder=${t('yourAnswer')}
        aria-labelledby="q-${question.id}"
        maxlength="20000"
        .value=${live(typeof answer === 'string' ? answer : '')}
        ?disabled=${disabled}
        @input=${(event: Event) => {
          const area = event.target as HTMLTextAreaElement;
          area.style.height = 'auto';
          area.style.height = `${area.scrollHeight}px`;
          setAnswer(question, area.value);
        }}
      ></textarea>`;
    case 'choice':
      return choiceInput(question, disabled);
    case 'checkbox':
      return checkboxInput(question, disabled);
    case 'dropdown':
      return dropdownInput(question, disabled);
    case 'scale':
      return scaleInput(question, disabled);
    case 'rating':
      return ratingInput(question, disabled);
    case 'grid':
    case 'checkgrid':
      return gridInput(question, disabled);
    case 'date':
      return dateInput(question, disabled);
    case 'time':
      return timeInput(question, disabled);
    case 'file':
      return fileInput(question, disabled);
  }
}
