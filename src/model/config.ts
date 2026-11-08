// The form in the app's config and back. The config is one data value of
// Potok's: `form` is what every viewer reads, `rules` is what Potok holds to
// (who fills in, who reads every response, files, the quiz), and `secret`
// keeps the right answers, which only the form's editors read.

import type { PotokConfigData, PotokRule, PotokScoreCheck } from '../potok';
import { normalizeForm, normalizeKey, questions, type AnswerKey, type Form, type Question } from './form';

export const COLLECTION = 'responses';
export const ANSWERS_AT = 'a';

const MB = 1024 * 1024;

/** The form without what only editors may read. */
export function publicForm(form: Form): Form {
  return { ...form, items: form.items.map((item) => (item.type === 'question' ? { ...item, key: null } : item)) };
}

/** What Potok checks for one question's key, or nothing to score. */
export function keyCheck(question: Question): PotokScoreCheck | null {
  const key = question.key;
  const points = question.points;
  const words = { ...(key?.ok ? { ok: key.ok } : {}), ...(key?.bad ? { bad: key.bad } : {}) };

  if (points <= 0) return null;

  switch (question.kind) {
    case 'choice':
    case 'dropdown':
      return key?.options[0] ? { points, eq: key.options[0], ...words } : null;
    case 'checkbox':
      return key && key.options.length > 0 ? { points, set: [...key.options], ...words } : null;
    case 'short':
      return key && key.texts.some((entry) => entry.trim() !== '')
        ? { points, text: key.texts.filter((entry) => entry.trim() !== ''), others_wrong: key.othersWrong, ...words }
        : { points, manual: true, ...words };
    case 'grid': {
      const rows = gridKey(question, key, false);
      return rows ? { points, rows, ...words } : null;
    }
    case 'checkgrid': {
      const rows = gridKey(question, key, true);
      return rows ? { points, row_sets: rows, ...words } as PotokScoreCheck : null;
    }
    default:
      return { points, manual: true, ...words };
  }
}

function gridKey(question: Question, key: AnswerKey | null, many: true): Record<string, string[]> | null;
function gridKey(question: Question, key: AnswerKey | null, many: false): Record<string, string> | null;
function gridKey(question: Question, key: AnswerKey | null, many: boolean): Record<string, string | string[]> | null {
  if (!key) return null;
  const rows: Record<string, string | string[]> = {};

  question.rows.forEach((row) => {
    const columns = (key.rows[row.id] ?? []).filter((column) => question.columns.some((c) => c.id === column));
    if (columns.length > 0) rows[row.id] = many ? columns : columns[0];
  });

  return Object.keys(rows).length > 0 ? rows : null;
}

/** The rule Potok holds the responses to, from the form's settings. */
export function responsesRule(form: Form): PotokRule {
  const { settings } = form;
  const quiz = settings.quiz.enabled ? settings.quiz : null;
  const files = questions(form).filter((question) => question.kind === 'file');
  const anonymous = settings.anonymous && files.length === 0;
  const editOwn = settings.editOwn && !(quiz && quiz.release === 'immediate');
  const fill = settings.public ? ['everyone'] : settings.fill;

  return {
    write: fill,
    read: settings.view,
    summary: settings.summaryForRespondents ? fill : [],
    once: settings.once,
    edit_own: editOwn,
    anonymous,
    public: settings.public,
    open: settings.published && settings.open,
    closes_at: settings.closesAt,
    under: [ANSWERS_AT],
    uploads: Object.fromEntries(
      files.map((question) => [
        question.id,
        {
          target: question.filePrivate ? 'private' : 'public',
          max_files: question.fileCount,
          max_bytes: question.fileSizeMb * MB,
          types: question.fileTypes,
        },
      ]),
    ),
    score: quiz
      ? {
          release: quiz.release,
          released: quiz.release === 'manual' && quiz.released,
          show: { missed: quiz.showMissed, correct: quiz.showCorrect, points: quiz.showPoints },
        }
      : null,
  };
}

/** The config data to save for the form. */
export function toConfigData(form: Form): PotokConfigData {
  const checks: Record<string, PotokScoreCheck> = {};
  const keys: Record<string, AnswerKey> = {};

  questions(form).forEach((question) => {
    if (question.key) keys[question.id] = question.key;

    if (form.settings.quiz.enabled) {
      const check = keyCheck(question);
      if (check) checks[question.id] = check;
    }
  });

  return {
    v: 1,
    form: publicForm(form),
    rules: { [COLLECTION]: responsesRule(form) },
    // Potok reads `score`; `keys` is the editor's own shape of the same answers.
    secret: { keys, score: { [COLLECTION]: checks } },
  };
}

/**
 * The form in a config. An editor's config carries the secret part, whose
 * keys go back into their questions.
 */
export function fromConfigData(data: PotokConfigData | null | undefined): Form {
  const form = normalizeForm(data?.form);
  const secret = data?.secret as { keys?: Record<string, unknown> } | undefined;
  const keys = secret?.keys && typeof secret.keys === 'object' ? secret.keys : {};

  form.items = form.items.map((item) =>
    item.type === 'question' && keys[item.id] ? { ...item, key: normalizeKey(keys[item.id]) } : item,
  );

  return form;
}
