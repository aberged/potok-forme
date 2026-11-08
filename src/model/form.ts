// The form as the app keeps it: what the editor changes and the respondent
// fills in. It is saved in the app's config (`config.ts`), and read back from
// there for everyone, so `normalizeForm` takes nothing on trust: a config may
// come from an older version of the app or from someone's console.

import { newId } from './ids';

export type QuestionKind =
  | 'short'
  | 'paragraph'
  | 'choice'
  | 'checkbox'
  | 'dropdown'
  | 'file'
  | 'scale'
  | 'rating'
  | 'grid'
  | 'checkgrid'
  | 'date'
  | 'time';

export const QUESTION_KINDS: QuestionKind[] = [
  'short',
  'paragraph',
  'choice',
  'checkbox',
  'dropdown',
  'file',
  'scale',
  'rating',
  'grid',
  'checkgrid',
  'date',
  'time',
];

/** Kinds that offer a list of options. */
export const OPTION_KINDS: QuestionKind[] = ['choice', 'checkbox', 'dropdown'];
/** Kinds whose answers Potok counts in the summary. */
export const COUNTED_KINDS: QuestionKind[] = ['choice', 'checkbox', 'dropdown', 'scale', 'rating', 'grid', 'checkgrid'];
/** Kinds whose answers are free text. */
export const TEXT_KINDS: QuestionKind[] = ['short', 'paragraph', 'date', 'time'];

/** A picture: an address on the web or a signed address of Potok's. */
export type Picture = { url: string; alt: string };

export type Choice = { id: string; label: string; picture: Picture | null; goTo: string | null };
export type Line = { id: string; label: string };

export type Validation =
  | { kind: 'number'; op: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'between' | 'not_between' | 'is_number' | 'whole'; a: number | null; b: number | null; error: string }
  | { kind: 'text'; op: 'contains' | 'not_contains' | 'email' | 'url'; value: string; error: string }
  | { kind: 'length'; op: 'max' | 'min'; value: number; error: string }
  | { kind: 'regex'; op: 'contains' | 'not_contains' | 'matches' | 'not_matches'; value: string; error: string }
  | { kind: 'count'; op: 'at_least' | 'at_most' | 'exactly'; value: number; error: string };

export type FileType = 'document' | 'presentation' | 'spreadsheet' | 'drawing' | 'pdf' | 'image' | 'video' | 'audio';
export const FILE_TYPES: FileType[] = ['document', 'presentation', 'spreadsheet', 'drawing', 'pdf', 'image', 'video', 'audio'];
export const FILE_COUNTS = [1, 5, 10] as const;
export const FILE_SIZES = [1, 10, 100] as const; // MB

/** The right answers of a question in a quiz: only editors read them. */
export type AnswerKey = {
  /** Option ids (one for choice and dropdown). */
  options: string[];
  /** Accepted texts of a short answer. */
  texts: string[];
  othersWrong: boolean;
  /** Per grid row, the right column ids (one for a choice grid). */
  rows: Record<string, string[]>;
  ok: string;
  bad: string;
};

export type Question = {
  type: 'question';
  id: string;
  kind: QuestionKind;
  title: string;
  description: string;
  showDescription: boolean;
  required: boolean;
  picture: Picture | null;
  options: Choice[];
  other: boolean;
  shuffle: boolean;
  branching: boolean;
  rows: Line[];
  columns: Line[];
  rowRequired: boolean;
  limitPerColumn: boolean;
  shuffleRows: boolean;
  scaleMin: 0 | 1;
  scaleMax: number;
  scaleMinLabel: string;
  scaleMaxLabel: string;
  ratingLevels: number;
  ratingIcon: 'star' | 'heart' | 'thumb';
  dateYear: boolean;
  dateTime: boolean;
  timeDuration: boolean;
  fileTypes: FileType[];
  fileCount: number;
  fileSizeMb: number;
  filePrivate: boolean;
  validation: Validation | null;
  points: number;
  key: AnswerKey | null;
};

export type Section = { type: 'section'; id: string; title: string; description: string; next: string };
export type TextItem = { type: 'text'; id: string; title: string; description: string };
export type PictureItem = { type: 'picture'; id: string; title: string; picture: Picture };
export type VideoItem = { type: 'video'; id: string; title: string; url: string };

export type Item = Question | Section | TextItem | PictureItem | VideoItem;

/** A form looks like Potok; it chooses only a picture over its title. */
export type Theme = { header: Picture | null };

export type Quiz = {
  enabled: boolean;
  release: 'immediate' | 'manual';
  released: boolean;
  showMissed: boolean;
  showCorrect: boolean;
  showPoints: boolean;
  defaultPoints: number;
};

export type Settings = {
  published: boolean;
  open: boolean;
  closedMessage: string;
  closesAt: string | null;
  /** Role keys of who fills the form in. */
  fill: string[];
  /** Role keys of who sees all the responses. */
  view: string[];
  summaryForRespondents: boolean;
  public: boolean;
  anonymous: boolean;
  once: boolean;
  editOwn: boolean;
  progressBar: boolean;
  shuffleQuestions: boolean;
  confirmation: string;
  anotherLink: boolean;
  requiredDefault: boolean;
  quiz: Quiz;
};

export type Form = {
  v: 1;
  title: string;
  description: string;
  /** Where the first section, under the header, leads. */
  startNext: string;
  theme: Theme;
  settings: Settings;
  items: Item[];
};

export const NEXT = 'next';
export const SUBMIT = 'submit';
export const OTHER = '__other';

export const MAX_ITEMS = 300;
export const MAX_OPTIONS = 200;
export const MAX_TEXT = 4_000;

export function defaultSettings(): Settings {
  return {
    published: false,
    open: true,
    closedMessage: '',
    closesAt: null,
    fill: ['everyone'],
    view: [],
    summaryForRespondents: false,
    public: false,
    anonymous: false,
    once: false,
    editOwn: false,
    progressBar: false,
    shuffleQuestions: false,
    confirmation: '',
    anotherLink: true,
    requiredDefault: false,
    quiz: {
      enabled: false,
      release: 'immediate',
      released: false,
      showMissed: true,
      showCorrect: true,
      showPoints: true,
      defaultPoints: 0,
    },
  };
}

export function emptyKey(): AnswerKey {
  return { options: [], texts: [], othersWrong: false, rows: {}, ok: '', bad: '' };
}

export function newQuestion(kind: QuestionKind = 'choice', settings?: Settings): Question {
  return {
    type: 'question',
    id: newId(),
    kind,
    title: '',
    description: '',
    showDescription: false,
    required: settings?.requiredDefault ?? false,
    picture: null,
    options: OPTION_KINDS.includes(kind) ? [newChoice('')] : [],
    other: false,
    shuffle: false,
    branching: false,
    rows: kind === 'grid' || kind === 'checkgrid' ? [newLine(''), newLine('')] : [],
    columns: kind === 'grid' || kind === 'checkgrid' ? [newLine(''), newLine('')] : [],
    rowRequired: false,
    limitPerColumn: false,
    shuffleRows: false,
    scaleMin: 1,
    scaleMax: 5,
    scaleMinLabel: '',
    scaleMaxLabel: '',
    ratingLevels: 5,
    ratingIcon: 'star',
    dateYear: true,
    dateTime: false,
    timeDuration: false,
    fileTypes: [],
    fileCount: 1,
    fileSizeMb: 10,
    filePrivate: true,
    validation: null,
    points: settings?.quiz.enabled ? settings.quiz.defaultPoints : 0,
    key: null,
  };
}

export function newChoice(label: string): Choice {
  return { id: newId(), label, picture: null, goTo: null };
}

export function newLine(label: string): Line {
  return { id: newId(), label };
}

export function newSection(): Section {
  return { type: 'section', id: newId(), title: '', description: '', next: NEXT };
}

export function newForm(title = ''): Form {
  return {
    v: 1,
    title,
    description: '',
    startNext: NEXT,
    theme: { header: null },
    settings: defaultSettings(),
    items: [newQuestion('choice')],
  };
}

/** Changes a question's kind, keeping what still fits. */
export function changeKind(question: Question, kind: QuestionKind): Question {
  const grid = kind === 'grid' || kind === 'checkgrid';
  const wasGrid = question.kind === 'grid' || question.kind === 'checkgrid';

  return {
    ...question,
    kind,
    options: OPTION_KINDS.includes(kind) ? (question.options.length ? question.options : [newChoice('')]) : question.options,
    other: kind === 'choice' || kind === 'checkbox' ? question.other : false,
    branching: kind === 'choice' || kind === 'dropdown' ? question.branching : false,
    rows: grid && !wasGrid && question.rows.length === 0 ? [newLine(''), newLine('')] : question.rows,
    columns: grid && !wasGrid && question.columns.length === 0 ? [newLine(''), newLine('')] : question.columns,
    validation: validationFits(kind, question.validation) ? question.validation : null,
    key: null,
  };
}

export function validationFits(kind: QuestionKind, validation: Validation | null): boolean {
  if (!validation) return true;
  if (kind === 'short') return validation.kind !== 'count';
  if (kind === 'paragraph') return validation.kind === 'length' || validation.kind === 'regex';
  if (kind === 'checkbox') return validation.kind === 'count';
  return false;
}

// ---------- Reading what was saved ----------

const text = (value: unknown, fallback = '', max = MAX_TEXT): string =>
  typeof value === 'string' ? value.slice(0, max) : fallback;
const bool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);
const int = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : fallback;
const oneOf = <T extends string>(value: unknown, options: readonly T[], fallback: T): T =>
  options.includes(value as T) ? (value as T) : fallback;
const numberOf = (value: unknown, options: readonly number[], fallback: number): number =>
  typeof value === 'number' && options.includes(value) ? value : fallback;
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const id = (value: unknown): string => (typeof value === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(value) ? value : newId());

/** A picture only by an address a browser may load: http(s) or a data URL of an image. */
export function safePicture(value: unknown): Picture | null {
  const source = record(value);
  const url = text(source.url, '', 2_000_000).trim();

  if (!/^(https?:\/\/|\/pictures\/|data:image\/(png|jpeg|gif|webp);base64,)/i.test(url)) return null;
  return { url, alt: text(source.alt, '', 300) };
}

function normalizeValidation(value: unknown): Validation | null {
  const source = record(value);
  const error = text(source.error, '', 300);

  switch (source.kind) {
    case 'number':
      return {
        kind: 'number',
        op: oneOf(source.op, ['gt', 'gte', 'lt', 'lte', 'eq', 'neq', 'between', 'not_between', 'is_number', 'whole'] as const, 'is_number'),
        a: typeof source.a === 'number' && Number.isFinite(source.a) ? source.a : null,
        b: typeof source.b === 'number' && Number.isFinite(source.b) ? source.b : null,
        error,
      };
    case 'text':
      return { kind: 'text', op: oneOf(source.op, ['contains', 'not_contains', 'email', 'url'] as const, 'contains'), value: text(source.value, '', 300), error };
    case 'length':
      return { kind: 'length', op: oneOf(source.op, ['max', 'min'] as const, 'max'), value: int(source.value, 100, 0, 100_000), error };
    case 'regex':
      return { kind: 'regex', op: oneOf(source.op, ['contains', 'not_contains', 'matches', 'not_matches'] as const, 'matches'), value: text(source.value, '', 300), error };
    case 'count':
      return { kind: 'count', op: oneOf(source.op, ['at_least', 'at_most', 'exactly'] as const, 'at_least'), value: int(source.value, 1, 0, MAX_OPTIONS), error };
    default:
      return null;
  }
}

/** A question's answer key as saved in the secret part of the config. */
export function normalizeKey(value: unknown): AnswerKey | null {
  if (!value || typeof value !== 'object') return null;
  const source = record(value);
  const rows: Record<string, string[]> = {};

  Object.entries(record(source.rows)).forEach(([row, columns]) => {
    rows[id(row)] = list(columns).filter((column): column is string => typeof column === 'string');
  });

  return {
    options: list(source.options).filter((option): option is string => typeof option === 'string'),
    texts: list(source.texts).filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.slice(0, 300)),
    othersWrong: bool(source.othersWrong, false),
    rows,
    ok: text(source.ok, '', 1_000),
    bad: text(source.bad, '', 1_000),
  };
}

function normalizeQuestion(source: Record<string, unknown>): Question {
  const kind = oneOf(source.kind, QUESTION_KINDS, 'short');
  const base = newQuestion(kind);
  const lines = (value: unknown): Line[] =>
    list(value)
      .slice(0, MAX_OPTIONS)
      .map((line) => ({ id: id(record(line).id), label: text(record(line).label, '', 500) }));

  return {
    ...base,
    id: id(source.id),
    title: text(source.title, '', 1_000),
    description: text(source.description),
    showDescription: bool(source.showDescription, text(source.description) !== ''),
    required: bool(source.required, false),
    picture: safePicture(source.picture),
    options: list(source.options)
      .slice(0, MAX_OPTIONS)
      .map((option) => {
        const choice = record(option);
        return {
          id: id(choice.id),
          label: text(choice.label, '', 500),
          picture: safePicture(choice.picture),
          goTo: typeof choice.goTo === 'string' ? choice.goTo : null,
        };
      }),
    other: bool(source.other, false),
    shuffle: bool(source.shuffle, false),
    branching: bool(source.branching, false),
    rows: lines(source.rows),
    columns: lines(source.columns),
    rowRequired: bool(source.rowRequired, false),
    limitPerColumn: bool(source.limitPerColumn, false),
    shuffleRows: bool(source.shuffleRows, false),
    scaleMin: source.scaleMin === 0 ? 0 : 1,
    scaleMax: int(source.scaleMax, 5, 2, 10),
    scaleMinLabel: text(source.scaleMinLabel, '', 100),
    scaleMaxLabel: text(source.scaleMaxLabel, '', 100),
    ratingLevels: int(source.ratingLevels, 5, 3, 10),
    ratingIcon: oneOf(source.ratingIcon, ['star', 'heart', 'thumb'] as const, 'star'),
    dateYear: bool(source.dateYear, true),
    dateTime: bool(source.dateTime, false),
    timeDuration: bool(source.timeDuration, false),
    fileTypes: list(source.fileTypes).filter((type): type is FileType => FILE_TYPES.includes(type as FileType)),
    fileCount: numberOf(source.fileCount, FILE_COUNTS, 1),
    fileSizeMb: numberOf(source.fileSizeMb, FILE_SIZES, 10),
    filePrivate: bool(source.filePrivate, true),
    validation: validationFits(kind, normalizeValidation(source.validation)) ? normalizeValidation(source.validation) : null,
    points: int(source.points, 0, 0, 1_000),
    key: normalizeKey(source.key),
  };
}

function normalizeItem(value: unknown): Item | null {
  const source = record(value);

  switch (source.type) {
    case 'question':
      return normalizeQuestion(source);
    case 'section':
      return {
        type: 'section',
        id: id(source.id),
        title: text(source.title, '', 1_000),
        description: text(source.description),
        next: typeof source.next === 'string' ? source.next : NEXT,
      };
    case 'text':
      return { type: 'text', id: id(source.id), title: text(source.title, '', 1_000), description: text(source.description) };
    case 'picture': {
      const picture = safePicture(source.picture);
      return picture ? { type: 'picture', id: id(source.id), title: text(source.title, '', 1_000), picture } : null;
    }
    case 'video': {
      const url = text(source.url, '', 500);
      return /^https:\/\//.test(url) ? { type: 'video', id: id(source.id), title: text(source.title, '', 1_000), url } : null;
    }
    default:
      return null;
  }
}

function normalizeSettings(value: unknown): Settings {
  const source = record(value);
  const quiz = record(source.quiz);
  const base = defaultSettings();
  const roles = (entries: unknown, fallback: string[]) =>
    Array.isArray(entries) ? entries.filter((key): key is string => typeof key === 'string').slice(0, 50) : fallback;

  return {
    published: bool(source.published, false),
    open: bool(source.open, true),
    closedMessage: text(source.closedMessage, '', 1_000),
    closesAt: typeof source.closesAt === 'string' && !Number.isNaN(Date.parse(source.closesAt)) ? source.closesAt : null,
    fill: roles(source.fill, base.fill),
    view: roles(source.view, base.view),
    summaryForRespondents: bool(source.summaryForRespondents, false),
    public: bool(source.public, false),
    anonymous: bool(source.anonymous, false),
    once: bool(source.once, false),
    editOwn: bool(source.editOwn, false),
    progressBar: bool(source.progressBar, false),
    shuffleQuestions: bool(source.shuffleQuestions, false),
    confirmation: text(source.confirmation, '', 1_000),
    anotherLink: bool(source.anotherLink, true),
    requiredDefault: bool(source.requiredDefault, false),
    quiz: {
      enabled: bool(quiz.enabled, false),
      release: oneOf(quiz.release, ['immediate', 'manual'] as const, 'immediate'),
      released: bool(quiz.released, false),
      showMissed: bool(quiz.showMissed, true),
      showCorrect: bool(quiz.showCorrect, true),
      showPoints: bool(quiz.showPoints, true),
      defaultPoints: int(quiz.defaultPoints, 0, 0, 1_000),
    },
  };
}

/** A form from whatever was saved: unknown parts get defaults, bad ones go. */
export function normalizeForm(value: unknown): Form {
  const source = record(value);
  const theme = record(source.theme);
  const items = list(source.items)
    .slice(0, MAX_ITEMS)
    .map(normalizeItem)
    .filter((item): item is Item => item !== null);

  return {
    v: 1,
    title: text(source.title, '', 300),
    description: text(source.description),
    startNext: typeof source.startNext === 'string' ? source.startNext : NEXT,
    // Colors, backgrounds and fonts of early forms go: Potok's theme draws them.
    theme: { header: safePicture(theme.header) },
    settings: normalizeSettings(source.settings),
    items,
  };
}

export const isQuestion = (item: Item): item is Question => item.type === 'question';

export function questions(form: Form): Question[] {
  return form.items.filter(isQuestion);
}

/** The form's sections: the first is the header's, before any section break. */
export type FormSection = { id: string; title: string; description: string; next: string; items: Item[] };

export const FIRST_SECTION = '_start';

export function sections(form: Form): FormSection[] {
  const result: FormSection[] = [
    { id: FIRST_SECTION, title: form.title, description: form.description, next: form.startNext || NEXT, items: [] },
  ];

  form.items.forEach((item) => {
    if (item.type === 'section') {
      result.push({ id: item.id, title: item.title, description: item.description, next: item.next, items: [] });
    } else {
      result[result.length - 1].items.push(item);
    }
  });

  return result;
}

/** Whether any question takes files, which an anonymous form cannot. */
export function hasFileQuestion(form: Form): boolean {
  return questions(form).some((question) => question.kind === 'file');
}
