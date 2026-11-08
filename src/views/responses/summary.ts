// "Summary" and "Question": counts Potok made over every response, and the
// answers to one question page by page, or who chose one option.

import { html, nothing, type TemplateResult } from 'lit-html';
import { answerText, readResponse } from '../../model/answers';
import { number } from '../../model/format';
import { OTHER, questions, type Question } from '../../model/form';
import { plainText } from '../../model/rich';
import { answerWords, canRead, clearFilter, dateText, filterBy, loadQuestionPage, pickQuestion, releaseScores } from '../../store/responses';
import { state } from '../../store/state';
import type { PotokCollectionValue, PotokSummary } from '../../potok';
import { button, confirm, notice, richText, select, ui } from '../common';
import { barList, columns, heatmap, meter, statTiles, type Bar } from '../charts';
import { pager } from './pager';
import { filesOf } from './files';

function rowsOf(summary: PotokSummary, questionId: string, row: string | null) {
  return summary.keys[questionId]?.rows.find((entry) => entry.row === row) ?? null;
}

function countOf(summary: PotokSummary, questionId: string, value: string, row: string | null = null): number {
  return rowsOf(summary, questionId, row)?.buckets.find((bucket) => bucket.value === value)?.count ?? 0;
}

function choiceChart(question: Question, summary: PotokSummary) {
  const answered = summary.keys[question.id]?.answered ?? 0;
  // Who chose an option is a list of responses, for those who read them.
  const clickable = canRead();
  const bars: Bar[] = question.options.map((option, index) => ({
    label: option.label || ui.t('optionLabel', { n: index + 1 }),
    count: countOf(summary, question.id, option.id),
    onClick: clickable ? () => filterBy(question.id, option.id, option.label) : undefined,
  }));
  if (question.other) {
    bars.push({ label: ui.t('otherOption'), count: countOf(summary, question.id, OTHER), onClick: clickable ? () => filterBy(question.id, OTHER, ui.t('otherOption')) : undefined });
  }

  return barList(bars, answered, `chart-${question.id}`);
}

function scaleChart(question: Question, summary: PotokSummary) {
  const answered = summary.keys[question.id]?.answered ?? 0;
  const from = question.kind === 'scale' ? question.scaleMin : 1;
  const to = question.kind === 'scale' ? question.scaleMax : question.ratingLevels;
  const points = Array.from({ length: to - from + 1 }, (_, index) => {
    const value = String(from + index);
    return { label: value, count: countOf(summary, question.id, value) };
  });

  return html`${columns(points, answered, `chart-${question.id}`)}
    ${question.kind === 'scale' && (question.scaleMinLabel || question.scaleMaxLabel)
      ? html`<div class="pf-scale-ends pf-muted pf-small"><span>${question.scaleMinLabel}</span><span>${question.scaleMaxLabel}</span></div>`
      : nothing}`;
}

function gridChart(question: Question, summary: PotokSummary) {
  const counts = question.rows.map((row) => question.columns.map((column) => countOf(summary, question.id, column.id, row.id)));
  return heatmap(question.rows.map((row) => row.label), question.columns.map((column) => column.label), counts, `chart-${question.id}`);
}

function textAnswers(question: Question, latest: PotokCollectionValue[]) {
  const t = ui.t;
  const words = answerWords();
  const answers = latest
    .map((row) => {
      const { a, other } = readResponse(row.data);
      return answerText(question, a[question.id], other[question.id] ?? '', words, dateText(ui.lang));
    })
    .filter((text) => text.trim() !== '');

  if (answers.length === 0) return html`<p class="pf-muted">${t('noAnswers')}</p>`;

  return html`<ul class="pf-text-answers">${answers.slice(0, 20).map((text) => html`<li>${text}</li>`)}</ul>
    ${answers.length > 20 || latest.length >= 50
      ? button(t('showAll'), () => pickQuestion(question.id), { kind: 'text' })
      : nothing}`;
}

/** Short texts, dates and times as Potok grouped them: the same answer once, with how many gave it. */
function groupedAnswers(question: Question, summary: PotokSummary) {
  const t = ui.t;
  const row = rowsOf(summary, question.id, null);
  if (!row || row.buckets.length === 0) return html`<p class="pf-muted">${t('noAnswers')}</p>`;

  const show = (value: string) => (question.kind === 'date' ? dateText(ui.lang)(value, question.dateYear, question.dateTime) : value);

  return html`<ul class="pf-text-answers">
      ${row.buckets.map((bucket) => html`<li>${show(bucket.value)}${bucket.count > 1 ? html`<span class="pf-text-count">(${bucket.count})</span>` : nothing}</li>`)}
    </ul>
    ${row.other > 0 ? html`<p class="pf-muted pf-small">${t('otherAnswers', { n: row.other })}</p>` : nothing}
    ${canRead() ? button(t('showAll'), () => pickQuestion(question.id), { kind: 'text' }) : nothing}`;
}

function questionSummaryCard(question: Question, summary: PotokSummary, latest: PotokCollectionValue[]) {
  const t = ui.t;
  const answered = summary.keys[question.id]?.answered;
  let body: TemplateResult;

  switch (question.kind) {
    case 'choice':
    case 'checkbox':
    case 'dropdown':
      body = choiceChart(question, summary);
      break;
    case 'scale':
    case 'rating':
      body = scaleChart(question, summary);
      break;
    case 'grid':
    case 'checkgrid':
      body = gridChart(question, summary);
      break;
    case 'file':
      body = canRead() ? filesOf(question, latest) : html`<p class="pf-muted">${t('kindFile')}</p>`;
      break;
    case 'paragraph':
      body = canRead() ? textAnswers(question, latest) : html`<p class="pf-muted">${t('noAnswers')}</p>`;
      break;
    default:
      body = groupedAnswers(question, summary);
  }

  return html`<section class="pf-card pf-summary-card" id="summary-${question.id}">
    <h3 class="pf-question-title">${plainText(question.title) || t('untitledQuestion')}</h3>
    <p class="pf-muted pf-small">${answered !== undefined ? t.plural('answered', answered) : question.kind === 'paragraph' || question.kind === 'file' ? '' : t.plural('answered', 0)}</p>
    ${body}
  </section>`;
}

function quizInsights(summary: PotokSummary) {
  const t = ui.t;
  const score = summary.score;
  if (!score || score.count === 0) return nothing;

  const max = questions(state.form).reduce((sum, question) => sum + (question.points > 0 ? question.points : 0), 0);
  const fmt = (value: number | null) => (value === null ? '—' : `${number(value, ui.lang, 1)} / ${max}`);
  const missed = questions(state.form)
    .map((question) => ({ question, counts: score.items[question.id] }))
    .filter((entry) => entry.counts && (entry.counts.bad ?? 0) > 0)
    .sort((a, b) => (b.counts!.bad ?? 0) - (a.counts!.bad ?? 0))
    .slice(0, 5);
  const pending = Object.values(score.items).reduce((sum, counts) => sum + (counts.pending ?? 0), 0);
  const quiz = state.form.settings.quiz;

  return html`<section class="pf-card pf-summary-card" id="quiz-insights">
    ${statTiles([
      { label: t('average'), value: fmt(score.average) },
      { label: t('median'), value: fmt(score.median) },
      { label: t('range'), value: score.min === null ? '—' : `${number(score.min, ui.lang)} – ${number(score.max ?? 0, ui.lang)}` },
    ])}
    ${pending > 0 ? notice(t('pendingCount', { n: pending }), 'info') : nothing}
    <h3 class="pf-chart-title">${t('distribution')}</h3>
    ${columns(score.distribution.map((entry) => ({ label: number(entry.score, ui.lang), count: entry.count })), score.count, 'score-distribution')}
    ${missed.length
      ? html`<h3 class="pf-chart-title">${t('frequentlyMissed')}</h3>
          <ul class="pf-missed">
            ${missed.map(({ question, counts }) => {
              const right = counts!.ok ?? 0;
              const all = right + (counts!.bad ?? 0);
              return html`<li>
                <span class="pf-missed-title">${plainText(question.title) || t('untitledQuestion')}</span>
                ${meter(right, all, t('correctOf', { a: right, b: all }))}
                <span class="pf-muted pf-small">${t('correctOf', { a: right, b: all })}</span>
              </li>`;
            })}
          </ul>`
      : nothing}
    ${state.reply?.manage && quiz.release === 'manual'
      ? quiz.released
        ? html`<p class="pf-muted">${t('scoresReleased')}</p>`
        : button(t('releaseScores'), () => confirm(t('releaseScoresText'), releaseScores, false), { kind: 'primary', id: 'release-scores' })
      : nothing}
  </section>`;
}

export function summaryView() {
  const t = ui.t;
  const r = state.responses;
  const summary = r.summary;

  if (!summary) return html`<p class="pf-muted pf-center">${r.summaryLoading ? t('loading') : ''}</p>`;
  if (summary.total === 0) return html`<section class="pf-card pf-message-card"><p>${t('noResponses')}</p></section>`;

  return html`${state.form.settings.quiz.enabled && canRead() ? quizInsights(summary) : nothing}
    ${questions(state.form).map((question) => questionSummaryCard(question, summary, r.latest))}`;
}

function answerOf(question: Question, row: PotokCollectionValue) {
  const { a, other } = readResponse(row.data);
  return answerText(question, a[question.id], other[question.id] ?? '', answerWords(), dateText(ui.lang));
}

export function questionView() {
  const t = ui.t;
  const r = state.responses;
  const all = questions(state.form);
  const question = all.find((candidate) => candidate.id === (r.filter?.questionId ?? r.questionId)) ?? all[0];
  if (!question) return nothing;

  const index = all.indexOf(question);
  const page = r.questionPage;

  return html`<section class="pf-card pf-question-nav" id="question-view">
      <button type="button" class="pf-icon-button" aria-label=${t('previousPage')} ?disabled=${index === 0} @click=${() => pickQuestion(all[index - 1].id)}>‹</button>
      ${select(question.id, all.map((q, i) => ({ value: q.id, label: `${i + 1}. ${plainText(q.title) || t('untitledQuestion')}` })), (id) => pickQuestion(id), {
        id: 'question-pick',
        label: t('question'),
      })}
      <button type="button" class="pf-icon-button" aria-label=${t('nextPage')} ?disabled=${index === all.length - 1} @click=${() => pickQuestion(all[index + 1].id)}>›</button>
    </section>
    ${r.filter
      ? html`<div class="pf-filter-chip" id="question-filter">
          <span>${t('whoChose', { name: r.filter.label })}</span>
          <button type="button" class="pf-text-link" @click=${clearFilter}>${t('allAnswers')}</button>
        </div>`
      : nothing}
    <section class="pf-card">
      ${richText(question.title, 'pf-question-title')}
      ${page.rows.length === 0 && !page.loading ? html`<p class="pf-muted">${t('noAnswers')}</p>` : nothing}
      <ul class="pf-question-answers">
        ${page.rows.map((row) => {
          const text = question.kind === 'file' ? '' : answerOf(question, row);
          return html`<li>
            <span class="pf-answer-value">${question.kind === 'file' ? filesOf(question, [row]) : text || t('empty')}</span>
            <span class="pf-muted pf-small">${row.creator_username ?? (row.anonymous ? t('anonymousRespondent') : '')}</span>
          </li>`;
        })}
      </ul>
      ${pager(page, (offset) => void loadQuestionPage(offset), 'question-pager')}
    </section>`;
}
