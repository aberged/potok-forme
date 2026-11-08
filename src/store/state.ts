// One state for the whole app and one way to change it. Every change draws the
// page again on the next frame; lit-html touches only what changed, so typing
// keeps its cursor.

import type { PotokCollectionValue, PotokConfigReply, PotokRole, PotokSummary } from '../potok';
import { newForm, type Form } from '../model/form';
import type { Answers, FileRef } from '../model/answers';

export type Phase = 'loading' | 'failed' | 'outdated' | 'previewFrame' | 'denied' | 'ready';
export type EditorTab = 'questions' | 'responses' | 'settings';
export type ResponsesView = 'summary' | 'question' | 'individual' | 'table';
export type SaveState = 'saved' | 'dirty' | 'saving' | 'error' | 'conflict';

export type Dialog =
  | { kind: 'publish' }
  | { kind: 'theme' }
  | { kind: 'confirm'; text: string; action: () => void; danger?: boolean }
  | { kind: 'picture'; target: PictureTarget }
  | { kind: 'video' }
  | { kind: 'key'; questionId: string };

export type PictureTarget =
  | { kind: 'header' }
  | { kind: 'question'; questionId: string }
  | { kind: 'option'; questionId: string; optionId: string }
  | { kind: 'item' };

export type Upload = { name: string; progress: number; error?: string };

export type FillState = {
  /** The respondent's walk through the sections, the current one last. */
  path: string[];
  answers: Answers;
  other: Record<string, string>;
  problems: Record<string, string>;
  uploads: Record<string, Upload[]>;
  sending: boolean;
  sendError: string | null;
  /** The value being changed, for "Edit your response". */
  editing: PotokCollectionValue | null;
  /** The value just sent. */
  sent: PotokCollectionValue | null;
  done: boolean;
  /** Showing the score of `sent` or `editing`. */
  showScore: boolean;
  seed: string;
};

export type Page = {
  rows: PotokCollectionValue[];
  total: number;
  offset: number;
  size: number;
  loading: boolean;
};

export type ResponsesState = {
  view: ResponsesView;
  total: number | null;
  summary: PotokSummary | null;
  summaryLoading: boolean;
  /** The newest responses, for text answers in the summary. */
  latest: PotokCollectionValue[];
  table: Page;
  /** Index of the response on screen in "Individual", newest first. */
  index: number;
  current: PotokCollectionValue | null;
  questionId: string | null;
  /** A choice picked in "Question": who chose it. */
  filter: { questionId: string; value: string; label: string } | null;
  questionPage: Page;
  /** Values that arrived since the page was loaded. */
  arrived: number;
  exporting: number | null;
  error: string | null;
};

export type State = {
  phase: Phase;
  denied: string | null;
  reply: PotokConfigReply | null;
  /** The config's revision the editor works from. */
  revision: number;
  form: Form;
  /** The form as last saved, as JSON, to tell unsaved changes. */
  savedJson: string;
  save: SaveState;
  conflict: { revision: number; data: unknown } | null;
  past: string[];
  future: string[];
  tab: EditorTab;
  /** For viewers who are not editors: the form or the responses. */
  readerScreen: 'form' | 'responses';
  preview: boolean;
  active: string | null;
  roles: PotokRole[] | null;
  toast: string | null;
  dialog: Dialog | null;
  menu: string | null;
  fill: FillState;
  responses: ResponsesState;
  /** The viewer's own responses, newest first. */
  mine: PotokCollectionValue[];
  /** Addresses of files, which Potok signs for ten minutes. */
  fileUrls: Record<number, { url: string; at: number } | 'denied'>;
  /** Files of the form being uploaded by an editor (pictures). */
  pictureUpload: Upload | null;
};

export function emptyPage(size = 25): Page {
  return { rows: [], total: 0, offset: 0, size, loading: false };
}

export function emptyFill(seed = String(Date.now())): FillState {
  return {
    path: [],
    answers: {},
    other: {},
    problems: {},
    uploads: {},
    sending: false,
    sendError: null,
    editing: null,
    sent: null,
    done: false,
    showScore: false,
    seed,
  };
}

export function emptyResponses(): ResponsesState {
  return {
    view: 'summary',
    total: null,
    summary: null,
    summaryLoading: false,
    latest: [],
    table: emptyPage(25),
    index: 0,
    current: null,
    questionId: null,
    filter: null,
    questionPage: emptyPage(50),
    arrived: 0,
    exporting: null,
    error: null,
  };
}

const initial = newForm();

export const state: State = {
  phase: 'loading',
  denied: null,
  reply: null,
  revision: 0,
  form: initial,
  savedJson: JSON.stringify(initial),
  save: 'saved',
  conflict: null,
  past: [],
  future: [],
  tab: 'questions',
  readerScreen: 'form',
  preview: false,
  active: null,
  roles: null,
  toast: null,
  dialog: null,
  menu: null,
  fill: emptyFill(),
  responses: emptyResponses(),
  mine: [],
  fileUrls: {},
  pictureUpload: null,
};

let draw: () => void = () => {};
let scheduled = false;

export function onChange(render: () => void) {
  draw = render;
}

/** Changes the state and draws on the next frame. */
export function update(change: (current: State) => void) {
  change(state);
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    draw();
  });
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function toast(text: string) {
  update((s) => {
    s.toast = text;
  });
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => update((s) => (s.toast = null)), 4_000);
}

export const isEditor = () => state.reply?.manage === true;

export type { FileRef };
