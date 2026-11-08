// The form as a respondent fills it in: the header card with who answers, the
// sections one at a time, the checks, and what comes after sending: the
// confirmation, another response, the score of a quiz.

import { html, nothing, type TemplateResult } from 'lit-html';
import { COLLECTION } from '../../model/config';
import { answerText, readResponse, shuffled } from '../../model/answers';
import { FIRST_SECTION, sections, type FormSection, type Item, type Question } from '../../model/form';
import { stopFilling } from '../../store/editor';
import { clearForm, goBack, goNext, previewReason, startFilling, submit, upcoming } from '../../store/fill';
import { loadView, setView } from '../../store/responses';
import { state, update } from '../../store/state';
import type { PotokCaps, PotokCollectionValue, PotokManaged } from '../../potok';
import { button, confirm, notice, richText, ui } from '../common';
import { icon } from '../icons';
import { headerPicture } from '../editor/editor';
import { pictureView, videoCard } from '../editor/pictures';
import { answerInput } from './inputs';
import { dateText } from '../../store/responses';

function caps(): PotokCaps | null {
  return state.reply?.caps[COLLECTION] ?? null;
}

function headerCard(showAccount: boolean) {
  const t = ui.t;
  const viewer = state.reply?.viewer;
  const anonymous = state.form.settings.anonymous;

  return html`<section class="pf-card pf-header-card" id="form-header">
    ${headerPicture()}
    <h1 class="pf-form-title">${state.form.title || t('untitledForm')}</h1>
    ${richText(state.form.description, 'pf-form-description')}
    ${showAccount
      ? html`<div class="pf-account-line">
          ${viewer?.signed_in
            ? html`<span>${anonymous ? t('answeringAnonymously') : t('answeringAs', { name: viewer.username ?? '' })}</span>
                ${viewer.member ? nothing : html`<span class="pf-muted pf-small">${t('notMemberNote')}</span>`}`
            : html`<span>${t('signIn')}</span>`}
        </div>
        ${hasRequired() ? html`<p class="pf-required-note"><span class="pf-required">*</span> ${t('requiredNote')}</p>` : nothing}`
      : nothing}
  </section>`;
}

function hasRequired() {
  return state.form.items.some((item) => item.type === 'question' && item.required);
}

function points(question: Question) {
  const quiz = state.form.settings.quiz;
  if (!quiz.enabled || !quiz.showPoints || question.points <= 0) return nothing;
  return html`<span class="pf-points-label">${ui.t.plural('points', question.points)}</span>`;
}

function questionCard(question: Question) {
  const problem = state.fill.problems[question.id];

  return html`<section class="pf-card pf-question-card ${problem ? 'pf-card-error' : ''}" id="question-${question.id}">
    <div class="pf-question-title" id="q-${question.id}">
      <span>${richText(question.title || ui.t('untitledQuestion'), 'pf-inline')}</span>
      ${question.required ? html`<span class="pf-required" aria-hidden="true">*</span>` : nothing}
      ${points(question)}
    </div>
    ${question.showDescription && question.description ? richText(question.description, 'pf-question-description') : nothing}
    ${question.picture ? pictureView(question.picture) : nothing}
    <div class="pf-question-answer">${answerInput(question, state.fill.sending)}</div>
    ${problem ? html`<p class="pf-problem" role="alert">${icon('warning', 'size-4')}<span>${problem}</span></p>` : nothing}
  </section>`;
}

function itemCard(item: Item): TemplateResult | typeof nothing {
  switch (item.type) {
    case 'question':
      return questionCard(item);
    case 'text':
      return html`<section class="pf-card"><h3 class="pf-text-title">${item.title}</h3>${richText(item.description)}</section>`;
    case 'picture':
      return html`<section class="pf-card">${item.title ? html`<h3 class="pf-text-title">${item.title}</h3>` : nothing}${pictureView(item.picture)}</section>`;
    case 'video':
      return html`<section class="pf-card">${item.title ? html`<h3 class="pf-text-title">${item.title}</h3>` : nothing}${videoCard(item.url, item.title)}</section>`;
    default:
      return nothing;
  }
}

function sectionItems(section: FormSection): Item[] {
  if (!state.form.settings.shuffleQuestions) return section.items;

  // Questions change places among themselves; texts and pictures stay put.
  const order = shuffled(section.items.filter((item) => item.type === 'question'), `${state.fill.seed}:${section.id}`);
  let next = 0;
  return section.items.map((item) => (item.type === 'question' ? order[next++] : item));
}

function progress(all: FormSection[], current: number) {
  if (!state.form.settings.progressBar || all.length < 2) return nothing;
  const share = Math.round(((current + 1) / all.length) * 100);

  return html`<div class="pf-progress-wrap" aria-label=${ui.t('progress', { a: current + 1, b: all.length })}>
    <span class="pf-progress"><span style="width:${share}%"></span></span>
    <span class="pf-muted pf-small">${ui.t('progress', { a: current + 1, b: all.length })}</span>
  </div>`;
}

function closedCard(message: string) {
  return html`<section class="pf-card pf-message-card" id="form-closed">
    <h2 class="pf-section-title">${ui.t('closedTitle')}</h2>
    <p>${message}</p>
  </section>`;
}

/** What a viewer who cannot fill in the form sees in its place. */
function blockedReason(c: PotokCaps | null): string | null {
  const t = ui.t;
  const settings = state.form.settings;

  if (state.filling) return null;
  if (!settings.published) return t('notPublished');
  if (!state.reply?.viewer.signed_in) return t('signIn');
  if (!c) return t('membersOnly');
  if (!c.write) {
    switch (c.write_block) {
      case 'closed': return settings.closedMessage || t('closedDefault');
      case 'role': return t('roleOnly');
      case 'blocked': return t('blocked');
      case 'members_only': return t('membersOnly');
      default: return t('membersOnly');
    }
  }
  return null;
}

function yourResponses(c: PotokCaps | null) {
  const t = ui.t;
  const latest = state.mine[0];
  if (!latest || !(c?.edit_own || latest.managed)) return nothing;

  return html`<div class="pf-after-links">
    ${c?.edit_own ? button(t('editResponse'), () => startFilling(latest), { id: 'edit-response', kind: 'text' }) : nothing}
    ${latest.managed ? button(t('viewScore'), () => update((s) => {
      s.fill.sent = latest;
      s.fill.done = true;
      s.fill.showScore = true;
    }), { id: 'view-score' }) : nothing}
  </div>`;
}

function confirmationCard(c: PotokCaps | null) {
  const t = ui.t;
  const settings = state.form.settings;
  const sent = state.fill.sent;
  const previewed = state.fill.previewed;
  const canAgain = !settings.once && settings.anotherLink && !previewed;
  const editor = state.reply?.manage === true;

  return html`<section class="pf-card pf-header-card pf-message-card" id="form-sent">
    ${headerPicture()}
    <span class="pf-sent-mark" aria-hidden="true">${icon(previewed ? 'eye' : 'check', 'size-6')}</span>
    <h1 class="pf-form-title">${state.form.title || t('untitledForm')}</h1>
    <p>${settings.confirmation || t('confirmationDefault')}</p>
    ${previewed ? html`<p class="pf-muted pf-small">${t('previewNote')}</p>` : nothing}
    <div class="pf-after-links">
      ${previewed ? button(t('startOver'), () => startFilling(), { kind: 'secondary', icon: 'undo', id: 'start-over' }) : nothing}
      ${canAgain ? button(t('anotherResponse'), () => startFilling(), { kind: 'secondary', id: 'another-response' }) : nothing}
      ${c?.edit_own && sent && !previewed ? button(t('editResponse'), () => startFilling(sent), { kind: 'secondary', icon: 'fill', id: 'edit-response' }) : nothing}
      ${sent?.managed && !previewed ? button(t('viewScore'), () => update((s) => (s.fill.showScore = true)), { kind: 'secondary', icon: 'quiz', id: 'view-score' }) : nothing}
      ${c?.summary && !editor
        ? button(t('viewSummary'), () => {
            update((s) => (s.readerScreen = 'responses'));
            setView('summary');
          }, { kind: 'soft', icon: 'summary', id: 'view-summary' })
        : nothing}
      ${editor
        ? button(t('viewResponses'), () => {
            stopFilling('responses');
            void loadView();
          }, { kind: 'soft', icon: 'summary', id: 'editor-responses' })
        : nothing}
    </div>
  </section>`;
}

function scoreCard(value: PotokCollectionValue) {
  const t = ui.t;
  const managed: PotokManaged | null = value.managed;
  const { a, other } = readResponse(value.data);

  return html`<section class="pf-card pf-header-card" id="form-score">
      <h1 class="pf-form-title">${t('scoreTitle')}</h1>
      ${managed && typeof managed.score === 'number'
        ? html`<p class="pf-score">${t('yourScore', { a: managed.score, b: managed.max ?? 0 })}</p>`
        : html`<p class="pf-muted">${t('scorePending')}</p>`}
    </section>
    ${state.form.items
      .filter((item): item is Question => item.type === 'question')
      .map((question) => {
        const item = managed?.items[question.id];
        const answer = answerText(question, a[question.id], other[question.id] ?? '', { other: t('otherOption'), yes: '✓' }, dateText(ui.lang));
        const verdict = item?.ok === true ? 'correct' : item?.ok === false ? 'incorrect' : null;

        return html`<section class="pf-card pf-question-card ${verdict ? `pf-verdict-${verdict}` : ''}">
          <div class="pf-question-title">
            <span>${richText(question.title || t('untitledQuestion'), 'pf-inline')}</span>
            ${typeof item?.points === 'number' ? html`<span class="pf-points-label">${item.points} / ${question.points}</span>` : nothing}
          </div>
          <p class="pf-your-answer">${answer || t('empty')}</p>
          ${verdict ? html`<p class="pf-verdict">${icon(verdict === 'correct' ? 'check' : 'close', 'size-4')}${verdict === 'correct' ? t('correct') : t('incorrect')}</p>` : nothing}
          ${item?.expected && verdict !== 'correct' ? expectedText(question, item.expected) : nothing}
          ${item?.feedback ? html`<p class="pf-feedback">${item.feedback}</p>` : nothing}
        </section>`;
      })}
    <div class="pf-nav">${button(ui.t('backToForm'), () => update((s) => (s.fill.showScore = false)))}</div>`;
}

function expectedText(question: Question, expected: Record<string, unknown>) {
  const t = ui.t;
  const label = (id: unknown) => question.options.find((option) => option.id === id)?.label ?? String(id);
  const column = (id: unknown) => question.columns.find((entry) => entry.id === id)?.label ?? String(id);
  let text = '';

  if ('eq' in expected) text = label(expected.eq);
  else if (Array.isArray(expected.set)) text = expected.set.map(label).join(', ');
  else if (Array.isArray(expected.text)) text = expected.text.join(' / ');
  else if (expected.rows && typeof expected.rows === 'object')
    text = question.rows.map((row) => `${row.label}: ${column((expected.rows as Record<string, unknown>)[row.id])}`).join('; ');
  else if (expected.row_sets && typeof expected.row_sets === 'object')
    text = question.rows
      .map((row) => `${row.label}: ${((expected.row_sets as Record<string, unknown[]>)[row.id] ?? []).map(column).join(', ')}`)
      .join('; ');

  return text ? html`<p class="pf-expected"><strong>${t('correctAnswer')}:</strong> ${text}</p>` : nothing;
}

export function respondView() {
  const t = ui.t;
  const c = caps();
  const fill = state.fill;
  const settings = state.form.settings;

  if (fill.showScore && fill.sent) return html`<div class="pf-column">${scoreCard(fill.sent)}</div>`;
  if (fill.done) return html`<div class="pf-column">${confirmationCard(c)}${footer()}</div>`;

  const reason = blockedReason(c);
  const already = !state.filling && c?.once && c.written && !fill.editing;

  if (reason || already) {
    return html`<div class="pf-column">
      ${headerCard(false)}
      ${already
        ? html`<section class="pf-card pf-message-card" id="form-already"><p>${t('alreadyResponded')}</p><p class="pf-muted pf-small">${t('onlyOnceNote')}</p>${yourResponses(c)}</section>`
        : closedCard(reason!)}
      ${c?.summary && !already
        ? html`<div class="pf-nav">${button(t('viewSummary'), () => {
            update((s) => (s.readerScreen = 'responses'));
            setView('summary');
          })}</div>`
        : nothing}
      ${footer()}
    </div>`;
  }

  const all = sections(state.form);
  const currentId = fill.path[fill.path.length - 1] ?? FIRST_SECTION;
  const index = Math.max(0, all.findIndex((section) => section.id === currentId));
  const section = all[index];
  const next = upcoming();

  const preview = previewReason();

  return html`<div class="pf-column">
    ${preview ? notice(t(preview), 'info', 'fill-preview-note') : nothing}
    ${headerCard(true)}
    ${!preview && state.mine.length > 0 && !fill.editing ? yourResponses(c) : nothing}
    ${section.id !== FIRST_SECTION
      ? html`<section class="pf-card pf-section-card">
          <h2 class="pf-section-title">${section.title || t('untitledSection')}</h2>
          ${richText(section.description)}
        </section>`
      : nothing}
    ${sectionItems(section).map(itemCard)}
    ${progress(all, index)}
    ${fill.sendError ? notice(fill.sendError, 'warning', 'send-error') : nothing}
    <div class="pf-nav">
      ${fill.path.length > 1 ? button(t('back'), goBack, { id: 'form-back' }) : nothing}
      ${next
        ? button(t('next'), () => goNext() && window.scrollTo({ top: 0, behavior: 'smooth' }), { kind: 'primary', id: 'form-next' })
        : button(fill.editing ? t('update') : t('submit'), () => void submit(), { kind: 'primary', id: 'form-submit', disabled: fill.sending })}
      <span class="flex-1"></span>
      <button type="button" class="pf-text-link" id="form-clear" @click=${() => confirm(t('clearConfirm'), clearForm)}>${t('clearForm')}</button>
    </div>
    ${!preview && !settings.anonymous && state.reply?.viewer.signed_in ? html`<p class="pf-muted pf-small pf-center">${t('draftKept')}</p>` : nothing}
    ${footer()}
  </div>`;
}

function footer() {
  return html`<footer class="pf-footer">${ui.t('neverPasswords')}</footer>`;
}
