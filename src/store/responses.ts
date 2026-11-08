// The responses as their readers see them, page by page: a summary counted by
// Potok, a table, one response at a time and one question at a time. Nothing
// here loads every response, as a form may have a hundred thousand; the CSV
// goes through them in pages and keeps only the text.

import { COLLECTION, ANSWERS_AT } from '../model/config';
import { countedQuestionIds, type Words } from '../model/answers';
import { csvHeader, csvRow, toCsv, type CsvOptions } from '../model/csv';
import { questions, TEXT_KINDS } from '../model/form';
import { dateAnswer, moment } from '../model/format';
import type { PotokCollectionValue, PotokError } from '../potok';
import type { Translate } from '../i18n';
import { editSettings, flushSave } from './editor';
import { emptyResponses, state, toast, update, type ResponsesView } from './state';

const LATEST = 50;
const EXPORT_PAGE = 100;
const SUMMARY_DELAY_MS = 2_000;

let t: Translate;
let summaryTimer: ReturnType<typeof setTimeout> | null = null;

export function setResponsesTranslator(translate: Translate) {
  t = translate;
}

const failed = (reply: PotokError) => update((s) => (s.responses.error = reply.message ?? t('failed')));

export function canRead(): boolean {
  return state.reply?.caps[COLLECTION]?.read === 'all';
}

export function canSummarize(): boolean {
  return Boolean(state.reply?.caps[COLLECTION]?.summary);
}

export async function loadSummary() {
  if (!canSummarize()) return;
  update((s) => (s.responses.summaryLoading = true));

  const quiz = state.form.settings.quiz.enabled && canRead();
  const [summary, latest] = await Promise.all([
    window.potok.summarizeValues(COLLECTION, { under: [ANSWERS_AT], keys: countedQuestionIds(state.form), score: quiz }),
    canRead() ? window.potok.listValues({ collection: COLLECTION, orderDir: 'desc', limit: LATEST }) : null,
  ]);

  update((s) => {
    s.responses.summaryLoading = false;
    if (summary.ok) {
      s.responses.summary = summary.summary;
      s.responses.total = summary.summary.total;
    }
    if (latest?.ok) s.responses.latest = latest.values;
  });

  if (!summary.ok) failed(summary);
}

/** The summary again a moment after a change, so a busy form does not count on every answer. */
export function summaryLater() {
  if (summaryTimer) clearTimeout(summaryTimer);
  summaryTimer = setTimeout(() => {
    if (state.responses.view === 'summary' && isOnResponses()) void loadSummary();
  }, SUMMARY_DELAY_MS);
}

export function isOnResponses(): boolean {
  return state.reply?.manage ? state.tab === 'responses' : state.readerScreen === 'responses';
}

export async function loadTable(offset = state.responses.table.offset, size = state.responses.table.size) {
  if (!canRead()) return;
  update((s) => {
    s.responses.table.loading = true;
    s.responses.table.offset = offset;
    s.responses.table.size = size;
  });

  const reply = await window.potok.listValues({ collection: COLLECTION, orderDir: 'desc', offset, limit: size, total: true });

  update((s) => {
    s.responses.table.loading = false;
    if (reply.ok) {
      s.responses.table.rows = reply.values;
      s.responses.table.total = reply.total ?? 0;
      s.responses.total = reply.total ?? s.responses.total;
      s.responses.arrived = 0;
    }
  });
  if (!reply.ok) failed(reply);
}

export async function loadIndividual(index = state.responses.index) {
  if (!canRead()) return;

  const reply = await window.potok.listValues({ collection: COLLECTION, orderDir: 'desc', offset: Math.max(index, 0), limit: 1, total: true });

  update((s) => {
    if (reply.ok) {
      s.responses.total = reply.total ?? 0;
      s.responses.index = Math.min(Math.max(index, 0), Math.max((reply.total ?? 1) - 1, 0));
      s.responses.current = reply.values[0] ?? null;
      s.responses.arrived = 0;
    }
  });
  if (!reply.ok) failed(reply);
}

export async function loadQuestionPage(offset = 0) {
  if (!canRead()) return;
  const filter = state.responses.filter;
  const question = questions(state.form).find((candidate) => candidate.id === (filter?.questionId ?? state.responses.questionId));
  if (!question) return;

  update((s) => {
    s.responses.questionPage.loading = true;
    s.responses.questionPage.offset = offset;
  });

  const match = filter
    ? { [ANSWERS_AT]: { [filter.questionId]: question.kind === 'checkbox' ? [filter.value] : filter.value } }
    : undefined;

  const reply = await window.potok.listValues({
    collection: COLLECTION,
    orderDir: 'desc',
    offset,
    limit: state.responses.questionPage.size,
    total: true,
    match,
  });

  update((s) => {
    s.responses.questionPage.loading = false;
    if (reply.ok) {
      s.responses.questionPage.rows = reply.values;
      s.responses.questionPage.total = reply.total ?? 0;
    }
  });
  if (!reply.ok) failed(reply);
}

export function setView(view: ResponsesView) {
  update((s) => {
    s.responses.view = view;
    s.responses.error = null;
  });
  void loadView();
}

export function loadView() {
  switch (state.responses.view) {
    case 'summary':
      return loadSummary();
    case 'table':
      return loadTable();
    case 'individual':
      return loadIndividual();
    case 'question': {
      if (!state.responses.questionId) {
        const first = questions(state.form)[0];
        update((s) => (s.responses.questionId = first?.id ?? null));
      }
      return loadQuestionPage(0);
    }
  }
}

export function pickQuestion(id: string) {
  update((s) => {
    s.responses.questionId = id;
    s.responses.filter = null;
  });
  void loadQuestionPage(0);
}

export function filterBy(questionId: string, value: string, label: string) {
  update((s) => {
    s.responses.view = 'question';
    s.responses.questionId = questionId;
    s.responses.filter = { questionId, value, label };
  });
  void loadQuestionPage(0);
}

export function clearFilter() {
  update((s) => (s.responses.filter = null));
  void loadQuestionPage(0);
}

/** A live change in the responses: counts and pages follow without jumping. */
export function onResponseChange(change: { event: string; value?: PotokCollectionValue; id?: number; collection: string | null }) {
  if (change.collection !== null && change.collection !== COLLECTION) return;

  update((s) => {
    const r = s.responses;

    if (change.event === 'created' && change.value) {
      r.total = (r.total ?? 0) + 1;
      r.arrived += 1;
      if (r.latest.length) r.latest = [change.value, ...r.latest].slice(0, LATEST);
    } else if (change.event === 'updated' && change.value) {
      const swap = (rows: PotokCollectionValue[]) => rows.map((row) => (row.id === change.value!.id ? change.value! : row));
      r.table.rows = swap(r.table.rows);
      r.latest = swap(r.latest);
      r.questionPage.rows = swap(r.questionPage.rows);
      if (r.current?.id === change.value.id) r.current = change.value;
    } else if (change.event === 'deleted') {
      const drop = (rows: PotokCollectionValue[]) => rows.filter((row) => row.id !== change.id);
      r.total = Math.max((r.total ?? 1) - 1, 0);
      r.table.rows = drop(r.table.rows);
      r.latest = drop(r.latest);
      r.questionPage.rows = drop(r.questionPage.rows);
    } else if (change.event === 'cleared') {
      s.responses = emptyResponses();
      s.responses.view = r.view;
    }
  });

  if (change.event === 'deleted' && state.responses.current?.id === change.id) void loadIndividual();
  if (change.event === 'cleared' || change.event === 'regraded') void loadView();
  else summaryLater();
}

export function deleteResponse(id: number) {
  void (async () => {
    const reply = await window.potok.deleteValue(id);
    if (!reply.ok) toast(reply.message ?? t('failed'));
  })();
}

export function deleteAll() {
  void (async () => {
    const reply = await window.potok.deleteValues(COLLECTION);
    if (reply.ok) {
      update((s) => {
        const view = s.responses.view;
        s.responses = emptyResponses();
        s.responses.view = view;
      });
      void loadView();
    } else {
      toast(reply.message ?? t('failed'));
    }
  })();
}

export async function setNotifications(on: boolean) {
  const reply = await window.potok.setNotifications(COLLECTION, on);

  if (reply.ok) {
    update((s) => {
      if (s.reply?.caps[COLLECTION]) s.reply.caps[COLLECTION].notify = reply.on;
    });
    toast(reply.on ? t('notifyOn') : t('notifyOff'));
  } else {
    toast(reply.message ?? t('failed'));
  }
}

export function releaseScores() {
  editSettings((settings) => (settings.quiz.released = true));
  void flushSave();
}

export async function grade(id: number, items: Record<string, { points?: number | null; feedback?: string }>) {
  const reply = await window.potok.gradeValue(id, items);

  if (reply.ok) {
    update((s) => {
      if (s.responses.current?.id === id) s.responses.current = reply.value;
    });
    toast(t('gradeSaved'));
  } else {
    toast(reply.message ?? t('failed'));
  }
}

export function csvWords(): CsvOptions['words'] {
  return {
    other: t('otherOption'),
    yes: '✓',
    time: t('time'),
    respondent: t('respondent'),
    score: t('score'),
    anonymous: t('anonymousRespondent'),
  };
}

export function answerWords(): Words {
  return { other: t('otherOption'), yes: '✓' };
}

export const dateText = (lang: string) => (iso: string, withYear: boolean, withTime: boolean) =>
  dateAnswer(iso, withYear, withTime, lang);

/** Every response as a CSV file, a page of a hundred at a time, newest first. */
export async function exportCsv(lang: string) {
  if (state.responses.exporting !== null) return;
  update((s) => (s.responses.exporting = 0));

  const options: CsvOptions = {
    words: csvWords(),
    showRespondent: !state.form.settings.anonymous,
    showScore: state.form.settings.quiz.enabled,
    dateText: dateText(lang),
    timeText: (iso) => moment(iso, lang),
  };
  const lines = [csvHeader(state.form, options)];
  let beforeId: number | undefined;

  try {
    for (;;) {
      const reply = await window.potok.listValues({ collection: COLLECTION, orderDir: 'desc', beforeId, limit: EXPORT_PAGE });
      if (!reply.ok) {
        failed(reply);
        break;
      }

      reply.values.forEach((row) => lines.push(csvRow(state.form, row, options)));
      update((s) => (s.responses.exporting = lines.length - 1));

      if (!reply.has_more || reply.values.length === 0) break;
      beforeId = reply.values[reply.values.length - 1].id;
    }

    const blob = new Blob([toCsv(lines)], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${(state.form.title || t('untitledForm')).replace(/[\\/:*?"<>|]+/g, ' ').trim()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  } finally {
    update((s) => (s.responses.exporting = null));
  }
}

/** A file's address for the frame, asked once per file. */
export async function fileUrl(id: number): Promise<string | null> {
  const known = state.fileUrls[id];
  if (known === 'denied') return null;
  if (known && Date.now() - known.at < 9 * 60_000) return known.url;

  const reply = await window.potok.fileUrl(id);
  update((s) => (s.fileUrls[id] = reply.ok ? { url: reply.url, at: Date.now() } : 'denied'));
  return reply.ok ? reply.url : null;
}

export function textQuestions() {
  return questions(state.form).filter((question) => TEXT_KINDS.includes(question.kind));
}
