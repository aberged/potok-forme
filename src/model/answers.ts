// Answers: how each kind of question is answered, checked and written into a
// response, which sections a respondent walks through, and how an answer reads
// in the responses. A response written from someone's console can hold
// anything, so reading one never trusts its shape.

import {
  FIRST_SECTION,
  NEXT,
  OTHER,
  SUBMIT,
  questions,
  sections,
  type Form,
  type FormSection,
  type Question,
} from './form';

export type FileRef = { file: number; name: string; size: number; type: string };

export type Answer = string | number | string[] | Record<string, string> | Record<string, string[]> | FileRef[];

export type Answers = Record<string, Answer>;

/** A response's data, as Potok keeps it. */
export type ResponseData = {
  v: 1;
  form_rev: number;
  a: Answers;
  other: Record<string, string>;
};

/** Whether a question has an answer at all. */
export function answered(question: Question, answer: unknown, other = ''): boolean {
  if (answer === undefined || answer === null || answer === '') return false;
  if (Array.isArray(answer)) return answer.length > 0 && (!answer.includes(OTHER) || answer.length > 1 || other.trim() !== '');
  if (typeof answer === 'object') return Object.values(answer).some((value) => (Array.isArray(value) ? value.length > 0 : value !== ''));
  if (answer === OTHER) return other.trim() !== '';
  return question.kind === 'scale' || question.kind === 'rating' ? typeof answer === 'number' : true;
}

export type Problem =
  | { code: 'required' }
  | { code: 'row_required' }
  | { code: 'column_once' }
  | { code: 'other_empty' }
  | { code: 'invalid'; message: string }
  | { code: 'number' }
  | { code: 'whole' }
  | { code: 'email' }
  | { code: 'url' }
  | { code: 'too_long'; max: number }
  | { code: 'too_short'; min: number }
  | { code: 'count'; op: 'at_least' | 'at_most' | 'exactly'; value: number }
  | { code: 'pattern' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_PATTERN = /^(https?:\/\/)?[^\s/$.?#].[^\s]*\.[^\s]{2,}$/i;

function number(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(trimmed) ? Number(trimmed) : null;
}

function regex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

/** What is wrong with an answer, or null. Empty optional answers are fine. */
export function problem(question: Question, answer: unknown, other = ''): Problem | null {
  const given = answered(question, answer, other);

  if (!given) {
    if (question.required) return { code: 'required' };
    if (answer === OTHER || (Array.isArray(answer) && answer.includes(OTHER))) return { code: 'other_empty' };
    return null;
  }

  if ((answer === OTHER || (Array.isArray(answer) && answer.includes(OTHER))) && other.trim() === '') {
    return { code: 'other_empty' };
  }

  if ((question.kind === 'grid' || question.kind === 'checkgrid') && answer && typeof answer === 'object') {
    const cells = answer as Record<string, string | string[]>;
    const filled = (row: string) => {
      const cell = cells[row];
      return Array.isArray(cell) ? cell.length > 0 : typeof cell === 'string' && cell !== '';
    };

    if (question.rowRequired && question.rows.some((row) => !filled(row.id))) return { code: 'row_required' };

    if (question.limitPerColumn) {
      const used = question.rows.flatMap((row) => {
        const cell = cells[row.id];
        return Array.isArray(cell) ? cell : cell ? [cell] : [];
      });
      if (new Set(used).size !== used.length) return { code: 'column_once' };
    }
  }

  const validation = question.validation;
  if (!validation) return null;

  const withMessage = (fallback: Problem): Problem =>
    validation.error.trim() ? { code: 'invalid', message: validation.error.trim() } : fallback;

  if (validation.kind === 'count') {
    const count = Array.isArray(answer) ? answer.length : 0;
    const ok =
      validation.op === 'at_least' ? count >= validation.value : validation.op === 'at_most' ? count <= validation.value : count === validation.value;
    return ok ? null : withMessage({ code: 'count', op: validation.op, value: validation.value });
  }

  const value = typeof answer === 'string' ? answer : '';

  switch (validation.kind) {
    case 'number': {
      const n = number(value);
      if (n === null) return withMessage({ code: 'number' });
      const { a, b } = validation;
      const ok = (() => {
        switch (validation.op) {
          case 'gt': return a === null || n > a;
          case 'gte': return a === null || n >= a;
          case 'lt': return a === null || n < a;
          case 'lte': return a === null || n <= a;
          case 'eq': return a === null || n === a;
          case 'neq': return a === null || n !== a;
          case 'between': return a === null || b === null || (n >= Math.min(a, b) && n <= Math.max(a, b));
          case 'not_between': return a === null || b === null || n < Math.min(a, b) || n > Math.max(a, b);
          case 'whole': return Number.isInteger(n);
          default: return true;
        }
      })();
      if (ok) return null;
      return withMessage(validation.op === 'whole' ? { code: 'whole' } : { code: 'invalid', message: '' });
    }
    case 'text':
      if (validation.op === 'email') return EMAIL.test(value.trim()) ? null : withMessage({ code: 'email' });
      if (validation.op === 'url') return URL_PATTERN.test(value.trim()) ? null : withMessage({ code: 'url' });
      if (validation.op === 'contains') return value.includes(validation.value) ? null : withMessage({ code: 'pattern' });
      return value.includes(validation.value) ? withMessage({ code: 'pattern' }) : null;
    case 'length':
      if (validation.op === 'max') return [...value].length <= validation.value ? null : withMessage({ code: 'too_long', max: validation.value });
      return [...value].length >= validation.value ? null : withMessage({ code: 'too_short', min: validation.value });
    case 'regex': {
      const pattern = regex(validation.value);
      if (!pattern) return null;
      const contains = pattern.test(value);
      const whole = regex(`^(?:${validation.value})$`)?.test(value) ?? false;
      const ok =
        validation.op === 'contains' ? contains : validation.op === 'not_contains' ? !contains : validation.op === 'matches' ? whole : !whole;
      return ok ? null : withMessage({ code: 'pattern' });
    }
    default:
      return null;
  }
}

/** The questions of a section that have something wrong, with what. */
export function sectionProblems(section: FormSection, answers: Answers, other: Record<string, string>): Record<string, Problem> {
  const found: Record<string, Problem> = {};

  section.items.forEach((item) => {
    if (item.type !== 'question') return;
    const issue = problem(item, answers[item.id], other[item.id] ?? '');
    if (issue) found[item.id] = issue;
  });

  return found;
}

/**
 * Where a respondent goes after `section`: the section its last branching
 * question's answer names, or the section's own next. `null` is the end.
 */
export function nextSection(form: Form, sectionId: string, answers: Answers): string | null {
  const all = sections(form);
  const index = all.findIndex((section) => section.id === sectionId);
  if (index < 0) return null;

  const section = all[index];
  let target = section.next || NEXT;

  section.items.forEach((item) => {
    if (item.type !== 'question' || !item.branching) return;
    if (item.kind !== 'choice' && item.kind !== 'dropdown') return;

    const chosen = item.options.find((option) => option.id === answers[item.id]);
    if (chosen?.goTo) target = chosen.goTo;
  });

  if (target === SUBMIT) return null;
  if (target === NEXT) return all[index + 1]?.id ?? null;
  return all.some((candidate) => candidate.id === target && candidate.id !== FIRST_SECTION) ? target : all[index + 1]?.id ?? null;
}

/** The answers of the sections on the path only, as a form drops the others when sent. */
export function keptAnswers(form: Form, path: string[], answers: Answers, other: Record<string, string>): { a: Answers; other: Record<string, string> } {
  const onPath = new Set(path);
  const kept: Answers = {};
  const keptOther: Record<string, string> = {};

  sections(form).forEach((section) => {
    if (!onPath.has(section.id)) return;

    section.items.forEach((item) => {
      if (item.type !== 'question') return;
      const answer = answers[item.id];
      if (!answered({ ...item, required: false }, answer, other[item.id] ?? '')) return;

      kept[item.id] = answer;
      const usesOther = answer === OTHER || (Array.isArray(answer) && (answer as unknown[]).includes(OTHER));
      if (usesOther && other[item.id]?.trim()) keptOther[item.id] = other[item.id].trim().slice(0, 1_000);
    });
  });

  return { a: kept, other: keptOther };
}

export function responseData(form: Form, revision: number, path: string[], answers: Answers, other: Record<string, string>): ResponseData {
  const kept = keptAnswers(form, path, answers, other);
  return { v: 1, form_rev: revision, a: kept.a, other: kept.other };
}

/** A response's answers and other texts, from whatever is stored. */
export function readResponse(data: unknown): { a: Record<string, unknown>; other: Record<string, string> } {
  const source = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const a = source.a && typeof source.a === 'object' && !Array.isArray(source.a) ? (source.a as Record<string, unknown>) : {};
  const otherSource = source.other && typeof source.other === 'object' ? (source.other as Record<string, unknown>) : {};
  const other: Record<string, string> = {};

  Object.entries(otherSource).forEach(([key, value]) => {
    if (typeof value === 'string') other[key] = value;
  });

  return { a, other };
}

/** The files an answer names. */
export function fileRefs(answer: unknown): FileRef[] {
  if (!Array.isArray(answer)) return [];
  return answer.filter(
    (entry): entry is FileRef => !!entry && typeof entry === 'object' && typeof (entry as FileRef).file === 'number',
  ).map((entry) => ({
    file: entry.file,
    name: typeof entry.name === 'string' ? entry.name : String(entry.file),
    size: typeof entry.size === 'number' ? entry.size : 0,
    type: typeof entry.type === 'string' ? entry.type : '',
  }));
}

export type Words = {
  other: string;
  yes: string;
};

const labelOf = (question: Question, id: unknown, otherText: string, words: Words): string => {
  if (id === OTHER) return otherText ? `${words.other}: ${otherText}` : words.other;
  const option = question.options.find((choice) => choice.id === id);
  return option ? option.label : typeof id === 'string' || typeof id === 'number' ? String(id) : '';
};

/** An answer as one line of plain text, for the table, a text summary and CSV. */
export function answerText(question: Question, answer: unknown, otherText: string, words: Words, dateText: (iso: string, withYear: boolean, withTime: boolean) => string): string {
  if (answer === undefined || answer === null) return '';

  switch (question.kind) {
    case 'choice':
    case 'dropdown':
      return labelOf(question, answer, otherText, words);
    case 'checkbox':
      return Array.isArray(answer) ? answer.map((id) => labelOf(question, id, otherText, words)).filter(Boolean).join('; ') : '';
    case 'grid':
    case 'checkgrid': {
      if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return '';
      const cells = answer as Record<string, unknown>;
      return question.rows
        .map((row) => {
          const cell = cells[row.id];
          const ids = Array.isArray(cell) ? cell : cell ? [cell] : [];
          const names = ids.map((id) => question.columns.find((column) => column.id === id)?.label ?? String(id));
          return names.length ? `${row.label}: ${names.join(', ')}` : '';
        })
        .filter(Boolean)
        .join('; ');
    }
    case 'file':
      return fileRefs(answer).map((ref) => ref.name).join('; ');
    case 'date':
      return typeof answer === 'string' ? dateText(answer, question.dateYear, question.dateTime) : '';
    case 'scale':
    case 'rating':
      return typeof answer === 'number' ? String(answer) : '';
    default:
      return typeof answer === 'string' ? answer : '';
  }
}

/** One grid cell's answer for CSV: the column labels chosen in a row. */
export function gridRowText(question: Question, answer: unknown, rowId: string): string {
  if (!answer || typeof answer !== 'object' || Array.isArray(answer)) return '';
  const cell = (answer as Record<string, unknown>)[rowId];
  const ids = Array.isArray(cell) ? cell : cell ? [cell] : [];
  return ids.map((id) => question.columns.find((column) => column.id === id)?.label ?? String(id)).join(', ');
}

/**
 * The questions that Potok counts in a summary: choices, scales and grids, and
 * short texts, dates and times, whose same answers it groups. Paragraphs are
 * too long to group, and files are not answers to count.
 */
export function countedQuestionIds(form: Form): string[] {
  return questions(form)
    .filter((question) => question.kind !== 'paragraph' && question.kind !== 'file')
    .map((question) => question.id);
}

/** A seeded order, so one respondent sees one shuffle while filling in. */
export function shuffled<T>(items: T[], seed: string): T[] {
  let state = [...seed].reduce((hash, char) => (Math.imul(hash, 31) + char.charCodeAt(0)) | 0, 7);
  const next = () => {
    state = (Math.imul(state, 1_103_515_245) + 12_345) | 0;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
  const result = [...items];

  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(next() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }

  return result;
}
