// The "Responses" tab: the count, accepting responses, the menu with CSV,
// notifications and deleting, and the four views. Only "Summary" is open to the
// summary roles; the rest is for those who read every response.

import { html, nothing } from 'lit-html';
import { COLLECTION } from '../../model/config';
import { answerText, fileRefs, readResponse } from '../../model/answers';
import { moment, number } from '../../model/format';
import { questions, type Question } from '../../model/form';
import { plainText } from '../../model/rich';
import { editSettings, flushSave } from '../../store/editor';
import {
  answerWords,
  canRead,
  dateText,
  deleteAll,
  deleteResponse,
  exportCsv,
  grade,
  loadIndividual,
  loadTable,
  loadView,
  setNotifications,
  setView,
} from '../../store/responses';
import { state, update, type ResponsesView } from '../../store/state';
import type { PotokCollectionValue } from '../../potok';
import { button, confirm, iconButton, menu, menuItem, notice, richText, toggle, ui, underlined } from '../common';
import { icon } from '../icons';
import { fileChip } from './files';
import { pager } from './pager';
import { questionView, summaryView } from './summary';

function respondent(row: PotokCollectionValue) {
  return row.creator_username ?? (row.anonymous ? ui.t('anonymousRespondent') : '—');
}

function headerCard() {
  const t = ui.t;
  const r = state.responses;
  const settings = state.form.settings;
  const manage = state.reply?.manage === true;
  const caps = state.reply?.caps[COLLECTION];
  const total = r.total ?? 0;

  return html`<section class="pf-card pf-responses-head" id="responses-head">
    <div class="pf-responses-top">
      <h2 class="pf-responses-count">${t.plural('responses', total)}</h2>
      <span class="flex-1"></span>
      ${canRead()
        ? menu(
            'responses-menu',
            iconButton('more', t('more'), () => {}, { id: 'responses-menu-button' }),
            [
              menuItem(r.exporting !== null ? t('exporting', { n: r.exporting }) : t('downloadCsv'), () => void exportCsv(ui.lang), { icon: 'download', id: 'download-csv' }),
              menuItem(t('notifyMe'), () => void setNotifications(!caps?.notify), { checked: Boolean(caps?.notify), id: 'notify-me' }),
              ...(manage ? [menuItem(t('deleteAll'), () => confirm(t('deleteAllConfirm'), deleteAll), { icon: 'trash', danger: true, id: 'delete-all' })] : []),
            ],
          )
        : nothing}
    </div>
    ${manage
      ? html`${toggle(settings.published && settings.open, settings.open ? t('accepting') : t('notAccepting'), (on) => {
            editSettings((s) => {
              s.open = on;
              if (on) s.published = true;
            });
            void flushSave();
          }, { id: 'accepting' })}
          ${!settings.open
            ? underlined(settings.closedMessage, t('closedDefault'), (value) => editSettings((s) => (s.closedMessage = value), 'closed-message'), {
                multiline: true,
                id: 'closed-message',
                label: t('closedMessage'),
              })
            : nothing}`
      : nothing}
    ${r.exporting !== null ? html`<p class="pf-muted pf-small" role="status">${t('exporting', { n: r.exporting })}</p>` : nothing}
  </section>`;
}

const VIEWS: { view: ResponsesView; label: 'summary' | 'question' | 'individual' | 'table' }[] = [
  { view: 'summary', label: 'summary' },
  { view: 'question', label: 'question' },
  { view: 'individual', label: 'individual' },
  { view: 'table', label: 'table' },
];

function tabs() {
  const t = ui.t;
  if (!canRead()) return nothing;

  return html`<nav class="pf-subtabs" role="tablist">
    ${VIEWS.map(
      ({ view, label }) => html`<button
        type="button"
        role="tab"
        id="responses-tab-${view}"
        aria-selected=${String(state.responses.view === view)}
        class="pf-subtab ${state.responses.view === view ? 'pf-subtab-on' : ''}"
        @click=${() => setView(view)}
      >${t(label)}</button>`,
    )}
  </nav>`;
}

function arrived() {
  const r = state.responses;
  if (r.arrived === 0 || r.view === 'summary') return nothing;

  return html`<button type="button" class="pf-arrived" id="responses-arrived" @click=${() => void loadView()}>
    ${ui.t.plural('newResponses', r.arrived)}
  </button>`;
}

function answerBlock(question: Question, row: PotokCollectionValue) {
  const t = ui.t;
  const { a, other } = readResponse(row.data);
  const value = a[question.id];
  const item = row.managed?.items[question.id];

  return html`<div class="pf-individual-answer ${item?.ok === true ? 'pf-verdict-correct' : item?.ok === false ? 'pf-verdict-incorrect' : ''}">
    <div class="pf-question-title">${richText(question.title || t('untitledQuestion'), 'pf-inline')}</div>
    ${question.kind === 'file'
      ? html`<div class="pf-files">${fileRefs(value).map(fileChip)}</div>`
      : html`<p class="pf-your-answer">${answerText(question, value, other[question.id] ?? '', answerWords(), dateText(ui.lang)) || t('empty')}</p>`}
    ${state.form.settings.quiz.enabled && question.points > 0 && state.reply?.manage ? gradeControls(question, row) : nothing}
    ${state.form.settings.quiz.enabled && question.points > 0 && !state.reply?.manage && item
      ? html`<p class="pf-muted pf-small">${t('grade')}: ${item.points ?? t('pending')} / ${question.points}</p>`
      : nothing}
  </div>`;
}

const grades: Record<string, { points?: number | null; feedback?: string }> = {};

function gradeControls(question: Question, row: PotokCollectionValue) {
  const t = ui.t;
  const item = row.managed?.items[question.id];
  const key = `${row.id}:${question.id}`;
  const draft = grades[key] ?? {};

  return html`<div class="pf-grade">
    <label class="pf-points">
      <input
        type="number"
        min="0"
        max=${question.points}
        class="pf-field pf-narrow"
        aria-label=${t('grade')}
        .value=${String(draft.points ?? item?.points ?? '')}
        @input=${(event: Event) => {
          const raw = (event.target as HTMLInputElement).value;
          grades[key] = { ...draft, points: raw === '' ? null : Math.round(Number(raw)) };
        }}
      />
      <span class="pf-muted">/ ${question.points}</span>
      ${item?.graded ? nothing : item?.points === null || item?.points === undefined ? html`<span class="pf-pending">${t('pending')}</span>` : nothing}
    </label>
    <input
      type="text"
      class="pf-field"
      placeholder=${t('feedback')}
      aria-label=${t('feedback')}
      .value=${draft.feedback ?? item?.feedback ?? ''}
      @input=${(event: Event) => (grades[key] = { ...draft, feedback: (event.target as HTMLInputElement).value })}
    />
    ${button(t('saveGrade'), () => {
      const patch = grades[key];
      if (!patch) return;
      delete grades[key];
      void grade(row.id, { [question.id]: patch });
    }, { kind: 'text' })}
  </div>`;
}

function individualView() {
  const t = ui.t;
  const r = state.responses;
  const total = r.total ?? 0;
  const row = r.current;

  if (total === 0) return html`<section class="pf-card pf-message-card"><p>${t('noResponses')}</p></section>`;

  return html`<section class="pf-card pf-individual-nav" id="individual-nav">
      ${iconButton('left', t('previousPage'), () => void loadIndividual(r.index - 1), { disabled: r.index <= 0 })}
      <label>
        <input
          type="number"
          min="1"
          max=${total}
          class="pf-field pf-page-input"
          aria-label=${t('goTo')}
          .value=${String(r.index + 1)}
          @change=${(event: Event) => void loadIndividual(Math.round(Number((event.target as HTMLInputElement).value) || 1) - 1)}
        />
        <span class="pf-muted">${t('ofTotal', { n: number(total, ui.lang) })}</span>
      </label>
      ${iconButton('right', t('nextPage'), () => void loadIndividual(r.index + 1), { disabled: r.index >= total - 1 })}
      <span class="flex-1"></span>
      ${iconButton('print', t('print'), () => window.print())}
      ${state.reply?.manage && row
        ? iconButton('trash', t('deleteResponse'), () => confirm(t('deleteResponseConfirm'), () => deleteResponse(row.id)), { id: 'delete-response' })
        : nothing}
    </section>
    ${row
      ? html`<section class="pf-card pf-individual" id="individual-${row.id}">
          <div class="pf-individual-meta">
            <span>${icon('person', 'size-5')} ${respondent(row)}</span>
            <span class="pf-muted">${moment(row.inserted_at, ui.lang)}</span>
            ${row.managed && typeof row.managed.score === 'number'
              ? html`<span class="pf-score-pill">${row.managed.score} / ${row.managed.max ?? 0}</span>`
              : nothing}
          </div>
          ${questions(state.form).map((question) => answerBlock(question, row))}
        </section>`
      : nothing}`;
}

function tableView() {
  const t = ui.t;
  const page = state.responses.table;
  const all = questions(state.form);
  const quiz = state.form.settings.quiz.enabled;
  const anonymous = state.form.settings.anonymous;

  return html`<section class="pf-card pf-table-card" id="responses-table">
    <div class="pf-table-scroll">
      <table class="pf-table">
        <thead>
          <tr>
            <th scope="col">${t('time')}</th>
            ${anonymous ? nothing : html`<th scope="col">${t('respondent')}</th>`}
            ${quiz ? html`<th scope="col">${t('score')}</th>` : nothing}
            ${all.map((question) => html`<th scope="col" title=${plainText(question.title)}>${plainText(question.title) || t('untitledQuestion')}</th>`)}
          </tr>
        </thead>
        <tbody>
          ${page.rows.map((row, index) => {
            const { a, other } = readResponse(row.data);
            return html`<tr
              class="pf-table-row"
              @click=${() => {
                update((s) => (s.responses.view = 'individual'));
                void loadIndividual(page.offset + index);
              }}
            >
              <td class="pf-nowrap">${moment(row.inserted_at, ui.lang)}</td>
              ${anonymous ? nothing : html`<td>${respondent(row)}</td>`}
              ${quiz ? html`<td class="pf-nowrap">${typeof row.managed?.score === 'number' ? `${row.managed.score} / ${row.managed.max ?? 0}` : '—'}</td>` : nothing}
              ${all.map((question) => {
                const text =
                  question.kind === 'file'
                    ? fileRefs(a[question.id]).map((ref) => ref.name).join(', ')
                    : answerText(question, a[question.id], other[question.id] ?? '', answerWords(), dateText(ui.lang));
                return html`<td title=${text}>${text || ''}</td>`;
              })}
            </tr>`;
          })}
        </tbody>
      </table>
    </div>
    ${page.rows.length === 0 && !page.loading ? html`<p class="pf-muted pf-center">${t('noResponses')}</p>` : nothing}
    ${pager(page, (offset) => void loadTable(offset), 'table-pager', (size) => void loadTable(0, size))}
  </section>`;
}

export function responsesView() {
  const r = state.responses;

  return html`<div class="pf-column pf-responses ${r.view === 'table' && canRead() ? 'pf-wide' : ''}">
    ${headerCard()}
    ${tabs()}
    ${r.error ? notice(r.error, 'warning') : nothing}
    ${arrived()}
    ${r.view === 'summary' || !canRead() ? summaryView() : r.view === 'question' ? questionView() : r.view === 'individual' ? individualView() : tableView()}
  </div>`;
}
