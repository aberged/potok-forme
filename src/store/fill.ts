// A respondent filling in the form: answers, the walk through sections, the
// draft kept on the device, files sent while filling in, and the response sent
// or changed. Potok checks who may send and how often; this checks the answers,
// as nothing on the server knows the questions.

import { COLLECTION } from '../model/config';
import {
  fileRefs,
  nextSection,
  problem,
  readResponse,
  responseData,
  sectionProblems,
  type Answer,
  type FileRef,
  type Problem,
} from '../model/answers';
import { FIRST_SECTION, sections, type Question } from '../model/form';
import type { Key, Translate } from '../i18n';
import type { PotokCollectionValue } from '../potok';
import { emptyFill, state, toast, update } from './state';

const DRAFT_DELAY_MS = 400;
let t: Translate;
let draftTimer: ReturnType<typeof setTimeout> | null = null;

export function setFillTranslator(translate: Translate) {
  t = translate;
}

/**
 * Why an editor going through the form sends nothing, or null when what they
 * send is a response like anyone's: Potok holds editors to the form's rules.
 */
export function previewReason(editing: PotokCollectionValue | null = state.fill.editing): Key | null {
  if (!state.filling) return null;

  const caps = state.reply?.caps[COLLECTION];
  if (!state.form.settings.published) return 'previewNotPublished';
  if (!caps?.write) {
    switch (caps?.write_block) {
      case 'closed': return 'previewClosed';
      case 'role': return 'previewRole';
      default: return 'previewCannot';
    }
  }
  if (caps.once && caps.written && !editing) return 'previewAnswered';
  return null;
}

const draftKey = () => `forma:draft:${state.reply?.viewer.profile_id ?? 'guest'}`;

function saveDraft() {
  if (draftTimer) clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    if (state.fill.done || state.fill.editing || previewReason()) return;
    try {
      localStorage.setItem(
        draftKey(),
        JSON.stringify({ answers: state.fill.answers, other: state.fill.other, path: state.fill.path }),
      );
    } catch {
      // Storage full: the answers stay on screen.
    }
  }, DRAFT_DELAY_MS);
}

function dropDraft() {
  try {
    localStorage.removeItem(draftKey());
  } catch {
    // Nothing to drop.
  }
}

function loadDraft(): { answers: Record<string, Answer>; other: Record<string, string>; path: string[] } | null {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey()) || 'null');
    if (draft && typeof draft === 'object' && draft.answers && typeof draft.answers === 'object') {
      return {
        answers: draft.answers,
        other: draft.other && typeof draft.other === 'object' ? draft.other : {},
        path: Array.isArray(draft.path) && draft.path.length ? draft.path.filter((id: unknown) => typeof id === 'string') : [FIRST_SECTION],
      };
    }
  } catch {
    // A broken draft is no draft.
  }
  return null;
}

/** A fresh form, or one of the viewer's responses to change. */
export function startFilling(editing: PotokCollectionValue | null = null) {
  const draft = editing || previewReason(editing) ? null : loadDraft();
  const known = new Set(sections(state.form).map((section) => section.id));

  update((s) => {
    s.fill = emptyFill(String(s.reply?.viewer.profile_id ?? Date.now()));
    s.fill.path = [FIRST_SECTION];

    if (editing) {
      const { a, other } = readResponse(editing.data);
      s.fill.answers = a as Record<string, Answer>;
      s.fill.other = other;
      s.fill.editing = editing;
    } else if (draft) {
      s.fill.answers = draft.answers;
      s.fill.other = draft.other;
      s.fill.path = draft.path.filter((id) => known.has(id));
      if (s.fill.path[0] !== FIRST_SECTION) s.fill.path = [FIRST_SECTION];
    }
  });
}

export function problemText(issue: Problem): string {
  switch (issue.code) {
    case 'required': return t('errRequired');
    case 'row_required': return t('errRowRequired');
    case 'column_once': return t('errColumnOnce');
    case 'other_empty': return t('errOtherEmpty');
    case 'number': return t('errNumber');
    case 'whole': return t('errWhole');
    case 'email': return t('errEmail');
    case 'url': return t('errUrl');
    case 'too_long': return t('errTooLong', { n: issue.max });
    case 'too_short': return t('errTooShort', { n: issue.min });
    case 'count':
      return t(issue.op === 'at_least' ? 'errAtLeast' : issue.op === 'at_most' ? 'errAtMost' : 'errExactly', { n: issue.value });
    case 'pattern': return t('errPattern');
    case 'invalid': return issue.message || t('errPattern');
  }
}

export function setAnswer(question: Question, value: Answer | null) {
  update((s) => {
    if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) delete s.fill.answers[question.id];
    else s.fill.answers[question.id] = value;

    // A shown problem goes once the answer is right.
    if (s.fill.problems[question.id]) {
      const issue = problem(question, s.fill.answers[question.id], s.fill.other[question.id] ?? '');
      if (issue) s.fill.problems[question.id] = problemText(issue);
      else delete s.fill.problems[question.id];
    }
  });
  saveDraft();
}

export function setOther(question: Question, text: string) {
  update((s) => {
    s.fill.other[question.id] = text;
    if (s.fill.problems[question.id] && !problem(question, s.fill.answers[question.id], text)) {
      delete s.fill.problems[question.id];
    }
  });
  saveDraft();
}

/** Whether the section on screen holds up; marks what does not. */
function checkSection(): boolean {
  const current = sections(state.form).find((section) => section.id === state.fill.path[state.fill.path.length - 1]);
  if (!current) return true;

  const found = sectionProblems(current, state.fill.answers, state.fill.other);
  const texts: Record<string, string> = {};
  Object.entries(found).forEach(([id, issue]) => (texts[id] = problemText(issue)));
  update((s) => (s.fill.problems = texts));

  // The first question to fix comes into view, as Google's form scrolls to it.
  const first = current.items.find((item) => item.type === 'question' && found[item.id]);
  if (first) requestAnimationFrame(() => document.getElementById(`question-${first.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }));

  return Object.keys(found).length === 0;
}

export function upcoming(): string | null {
  const current = state.fill.path[state.fill.path.length - 1] ?? FIRST_SECTION;
  return nextSection(state.form, current, state.fill.answers);
}

export function goNext() {
  if (!checkSection()) return false;
  const target = upcoming();
  if (!target) return false;

  update((s) => s.fill.path.push(target));
  saveDraft();
  return true;
}

export function goBack() {
  update((s) => {
    if (s.fill.path.length > 1) s.fill.path.pop();
    s.fill.problems = {};
  });
  saveDraft();
}

export function clearForm() {
  dropDraft();
  update((s) => {
    const editing = s.fill.editing;
    s.fill = emptyFill(s.fill.seed);
    s.fill.path = [FIRST_SECTION];
    s.fill.editing = editing;
  });
}

const sendError = (error: string, message?: string) => {
  switch (error) {
    case 'rate_limited': return t('rateLimited');
    case 'closed': return message ?? t('closedDefault');
    case 'already_answered': return t('alreadyResponded');
    default: return message ?? t('errSend');
  }
};

export async function submit(): Promise<void> {
  if (!checkSection() || state.fill.sending) return;

  if (previewReason()) {
    update((s) => {
      s.fill.done = true;
      s.fill.previewed = true;
    });
    return;
  }

  update((s) => {
    s.fill.sending = true;
    s.fill.sendError = null;
  });

  const data = responseData(state.form, state.revision, state.fill.path, state.fill.answers, state.fill.other);
  const editing = state.fill.editing;

  try {
    const reply = editing
      ? await window.potok.updateValue(editing.id, data, { revision: editing.revision })
      : await window.potok.insertValue(data, { collection: COLLECTION });

    if (reply.ok) {
      dropDraft();
      update((s) => {
        s.fill.sending = false;
        s.fill.done = true;
        s.fill.sent = reply.value as PotokCollectionValue;
        s.mine = [reply.value as PotokCollectionValue, ...s.mine.filter((row) => row.id !== reply.value.id)];
        if (s.reply?.caps[COLLECTION]) s.reply.caps[COLLECTION].written = true;
      });
    } else {
      update((s) => {
        s.fill.sending = false;
        s.fill.sendError = sendError(reply.error, reply.message);
      });
    }
  } catch {
    update((s) => {
      s.fill.sending = false;
      s.fill.sendError = t('errSend');
    });
  }
}

// ---------- Files ----------

const MB = 1024 * 1024;

const ACCEPT: Record<string, string> = {
  document: '.pdf,.doc,.docx,.odt,.rtf,.txt',
  presentation: '.ppt,.pptx,.odp',
  spreadsheet: '.xls,.xlsx,.ods,.csv',
  drawing: '.svg,.odg',
  pdf: '.pdf',
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
};

export function acceptOf(question: Question): string {
  return question.fileTypes.map((type) => ACCEPT[type]).join(',');
}

export async function sendFiles(question: Question, files: File[]) {
  const room = question.fileCount - fileRefs(state.fill.answers[question.id]).length;

  for (const file of files.slice(0, Math.max(room, 0))) {
    if (file.size > question.fileSizeMb * MB) {
      toast(t('fileTooBig'));
      continue;
    }

    const entry = { name: file.name, progress: 0 };
    update((s) => (s.fill.uploads[question.id] = [...(s.fill.uploads[question.id] ?? []), entry]));

    const reply = await window.potok.uploadFile(file, {
      collection: COLLECTION,
      slot: question.id,
      onProgress: (percent) => update(() => (entry.progress = percent)),
    });

    update((s) => {
      s.fill.uploads[question.id] = (s.fill.uploads[question.id] ?? []).filter((upload) => upload !== entry);
    });

    if (reply.ok) {
      const ref: FileRef = { file: reply.file.file, name: reply.file.name, size: reply.file.size, type: reply.file.type };
      setAnswer(question, [...fileRefs(state.fill.answers[question.id]), ref]);
    } else {
      toast(reply.message ?? (reply.error === 'invalid_files' ? t('fileWrongType') : t('errSend')));
    }
  }
}

export function removeFile(question: Question, fileId: number) {
  setAnswer(question, fileRefs(state.fill.answers[question.id]).filter((ref) => ref.file !== fileId));
}

/** The viewer's own responses, newest first, for "Edit" and the score. */
export async function loadMine() {
  if (!state.reply?.viewer.signed_in) return;

  const reply = await window.potok.listValues({ collection: COLLECTION, mine: true, orderDir: 'desc', limit: 20 });
  if (reply.ok) update((s) => (s.mine = reply.values));
}
