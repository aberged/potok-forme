// What the editor does to the form: every change goes into the undo history
// and is saved a moment later into the app's config, like Google's editor saves
// as you type. Someone else's save in between is a conflict the editor settles.

import { fromConfigData, toConfigData } from '../model/config';
import {
  changeKind,
  hasFileQuestion,
  newChoice,
  newLine,
  newQuestion,
  newSection,
  OPTION_KINDS,
  type Form,
  type Item,
  type Question,
  type QuestionKind,
  type Settings,
  type Theme,
} from '../model/form';
import { newId } from '../model/ids';
import { startFilling } from './fill';
import { state, toast, update, type EditorTab, type State } from './state';
import type { Translate } from '../i18n';

const SAVE_DELAY_MS = 1_500;
const RETRY_MS = 5_000;
const HISTORY = 60;
const COALESCE_MS = 1_000;
const UNSAVED_KEY = 'forma:unsaved';

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let coalesceTimer: ReturnType<typeof setTimeout> | null = null;
let coalescing: string | null = null;
let t: Translate;

export function setTranslator(translate: Translate) {
  t = translate;
}

function keepUnsaved(s: State) {
  try {
    localStorage.setItem(UNSAVED_KEY, JSON.stringify({ revision: s.revision, form: s.form }));
  } catch {
    // Storage full: the next save carries the change.
  }
}

/** A form the editor changed and did not get saved, if it was based on this revision. */
export function takeUnsaved(revision: number): Form | null {
  try {
    const stored = JSON.parse(localStorage.getItem(UNSAVED_KEY) || 'null');
    if (stored && stored.revision === revision && stored.form) return stored.form as Form;
  } catch {
    // Nothing usable.
  }
  return null;
}

function forgetUnsaved() {
  try {
    localStorage.removeItem(UNSAVED_KEY);
  } catch {
    // Nothing to forget.
  }
}

/**
 * Changes the form. `coalesce` names a field being typed into, so a burst of
 * keystrokes in it becomes one step of the undo history.
 */
export function edit(change: (form: Form) => void, coalesce: string | null = null) {
  update((s) => {
    const before = JSON.stringify(s.form);
    change(s.form);
    if (JSON.stringify(s.form) === before) return;

    if (!coalesce || coalesce !== coalescing) {
      s.past.push(before);
      if (s.past.length > HISTORY) s.past.shift();
    }
    s.future = [];
    coalescing = coalesce;
    if (coalesceTimer) clearTimeout(coalesceTimer);
    coalesceTimer = setTimeout(() => (coalescing = null), COALESCE_MS);

    if (s.save !== 'conflict') s.save = 'dirty';
    keepUnsaved(s);
  });
  scheduleSave();
}

export function undo() {
  update((s) => {
    const previous = s.past.pop();
    if (!previous) return;
    s.future.push(JSON.stringify(s.form));
    s.form = JSON.parse(previous);
    if (s.save !== 'conflict') s.save = 'dirty';
    keepUnsaved(s);
  });
  scheduleSave();
}

export function redo() {
  update((s) => {
    const next = s.future.pop();
    if (!next) return;
    s.past.push(JSON.stringify(s.form));
    s.form = JSON.parse(next);
    if (s.save !== 'conflict') s.save = 'dirty';
    keepUnsaved(s);
  });
  scheduleSave();
}

export function scheduleSave(delay = SAVE_DELAY_MS) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => void flushSave(), delay);
}

let saving: Promise<void> | null = null;

/** Saves now what is not saved yet. */
export async function flushSave(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (saving) {
    await saving;
    return flushSave();
  }
  if (state.save === 'conflict') return;

  const json = JSON.stringify(state.form);
  if (json === state.savedJson) {
    update((s) => (s.save = 'saved'));
    forgetUnsaved();
    return;
  }

  saving = (async () => {
    update((s) => (s.save = 'saving'));

    try {
      const reply = await window.potok.saveConfig(toConfigData(state.form), { revision: state.revision });

      if (reply.ok) {
        update((s) => {
          s.revision = reply.config.revision;
          s.savedJson = json;
          s.save = JSON.stringify(s.form) === json ? 'saved' : 'dirty';
          if (s.reply) s.reply = { ...s.reply, config: reply.config };
        });
        if (state.save === 'dirty') scheduleSave();
        else forgetUnsaved();
      } else if (reply.error === 'conflict') {
        const current = reply.current as { revision: number; data: unknown } | null;
        update((s) => {
          s.save = 'conflict';
          s.conflict = current ?? { revision: 0, data: null };
        });
      } else {
        update((s) => (s.save = 'error'));
        if (reply.error === 'rate_limited' || reply.error === 'disconnected') scheduleSave(RETRY_MS);
        else toast(reply.message ?? t('saveFailed'));
      }
    } catch {
      update((s) => (s.save = 'error'));
      scheduleSave(RETRY_MS);
    }
  })();

  await saving;
  saving = null;
}

/** Takes the other editor's version in place of this one's. */
export function takeTheirs() {
  update((s) => {
    if (!s.conflict) return;
    const theirs = fromConfigData(s.conflict.data as never);
    s.form = theirs;
    s.revision = s.conflict.revision;
    s.savedJson = JSON.stringify(theirs);
    s.save = 'saved';
    s.conflict = null;
    s.past = [];
    s.future = [];
  });
  forgetUnsaved();
}

/** Saves this version over the other editor's. */
export function keepMine() {
  update((s) => {
    if (!s.conflict) return;
    s.revision = s.conflict.revision;
    s.savedJson = '';
    s.save = 'dirty';
    s.conflict = null;
  });
  void flushSave();
}

/** Another editor saved: take it in when nothing here waits to be saved. */
export async function configChanged(revision: number) {
  if (revision <= state.revision || state.save !== 'saved') return;

  const reply = await window.potok.getConfig();
  if (!reply.ok || !reply.config || state.save !== 'saved') return;

  update((s) => {
    s.reply = reply;
    s.revision = reply.config!.revision;
    s.form = fromConfigData(reply.config!.data);
    s.savedJson = JSON.stringify(s.form);
  });
}

// ---------- Changes to the form ----------

const findIndex = (form: Form, id: string) => form.items.findIndex((item) => item.id === id);

export function findQuestion(form: Form, id: string): Question | null {
  const item = form.items.find((candidate) => candidate.id === id);
  return item?.type === 'question' ? item : null;
}

function insertAfter(form: Form, item: Item) {
  const at = state.active ? findIndex(form, state.active) : -1;
  form.items.splice(at < 0 ? form.items.length : at + 1, 0, item);
}

export function setActive(id: string | null) {
  update((s) => {
    s.active = id;
    s.menu = null;
  });
}

export function addQuestion(kind: QuestionKind = 'choice') {
  const question = newQuestion(kind, state.form.settings);
  edit((form) => insertAfter(form, question));
  setActive(question.id);
}

export function addSection() {
  const section = newSection();
  edit((form) => insertAfter(form, section));
  setActive(section.id);
}

export function addText() {
  const item: Item = { type: 'text', id: newId(), title: '', description: '' };
  edit((form) => insertAfter(form, item));
  setActive(item.id);
}

export function addPictureItem(url: string, alt = '') {
  const item: Item = { type: 'picture', id: newId(), title: '', picture: { url, alt } };
  edit((form) => insertAfter(form, item));
  setActive(item.id);
}

export function addVideo(url: string) {
  const item: Item = { type: 'video', id: newId(), title: '', url };
  edit((form) => insertAfter(form, item));
  setActive(item.id);
}

export function duplicateItem(id: string) {
  const index = findIndex(state.form, id);
  if (index < 0) return;

  const copy: Item = JSON.parse(JSON.stringify(state.form.items[index]));
  copy.id = newId();
  if (copy.type === 'question') {
    const optionIds = new Map<string, string>();
    copy.options = copy.options.map((option) => {
      const fresh = newId();
      optionIds.set(option.id, fresh);
      return { ...option, id: fresh };
    });
    copy.rows = copy.rows.map((row) => ({ ...row, id: newId() }));
    copy.columns = copy.columns.map((column) => ({ ...column, id: newId() }));
    copy.key = null;
  }

  edit((form) => form.items.splice(index + 1, 0, copy));
  setActive(copy.id);
}

export function deleteItem(id: string) {
  const index = findIndex(state.form, id);
  if (index < 0) return;

  edit((form) => {
    form.items.splice(index, 1);
    // Branches into a deleted section go on to the next one.
    form.items.forEach((item) => {
      if (item.type === 'section' && item.next === id) item.next = 'next';
      if (item.type === 'question') item.options.forEach((option) => option.goTo === id && (option.goTo = null));
    });
  });
  const neighbour = state.form.items[Math.min(index, state.form.items.length - 1)];
  setActive(neighbour?.id ?? null);
}

export function moveItem(id: string, delta: number) {
  edit((form) => {
    const index = findIndex(form, id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= form.items.length) return;
    const [item] = form.items.splice(index, 1);
    form.items.splice(target, 0, item);
  });
}

export function moveItemTo(id: string, target: number) {
  edit((form) => {
    const index = findIndex(form, id);
    if (index < 0) return;
    const [item] = form.items.splice(index, 1);
    form.items.splice(Math.max(0, Math.min(target, form.items.length)), 0, item);
  });
}

export function editItem<T extends Item>(id: string, change: (item: T) => void, coalesce: string | null = null) {
  edit((form) => {
    const item = form.items.find((candidate) => candidate.id === id);
    if (item) change(item as T);
  }, coalesce);
}

export function editQuestion(id: string, change: (question: Question) => void, coalesce: string | null = null) {
  editItem<Question>(id, (item) => item.type === 'question' && change(item), coalesce);
}

export function setKind(id: string, kind: QuestionKind) {
  editQuestion(id, (question) => Object.assign(question, changeKind(question, kind)));
  if (kind === 'file') void ensureFileGroups();
}

export function addOption(id: string, other = false) {
  editQuestion(id, (question) => {
    if (other) question.other = true;
    else if (OPTION_KINDS.includes(question.kind)) question.options.push(newChoice(''));
  });
}

export function addLine(id: string, which: 'rows' | 'columns') {
  editQuestion(id, (question) => question[which].push(newLine('')));
}

export function editSettings(change: (settings: Settings) => void, coalesce: string | null = null) {
  edit((form) => change(form.settings), coalesce);
}

export function editTheme(change: (theme: Theme) => void) {
  edit((form) => change(form.theme));
}

export function setPublished(published: boolean) {
  editSettings((settings) => {
    settings.published = published;
    if (published) settings.open = true;
  });
  void flushSave();
}

// ---------- Files ----------

let ensuring: Promise<boolean> | null = null;

/** The app's file groups, made the first time a question or a picture needs them. */
/**
 * The editor goes through the form as those who fill it in do. What they may
 * send is read again first: Potok knew it before this editor's last save.
 */
export async function fillIn() {
  update((s) => {
    s.menu = null;
    s.dialog = null;
  });
  await flushSave();

  const reply = await window.potok.getConfig();
  update((s) => {
    if (reply.ok) s.reply = reply;
    s.filling = true;
  });
  startFilling();
  window.scrollTo({ top: 0 });
}

export function stopFilling(tab: EditorTab | null = null) {
  update((s) => {
    s.filling = false;
    if (tab) s.tab = tab;
  });
  window.scrollTo({ top: 0 });
}

export async function ensureFileGroups(): Promise<boolean> {
  const files = state.reply?.files;
  if (files && files.public === 'ok' && files.private === 'ok') return true;
  if (ensuring) return ensuring;

  ensuring = (async () => {
    // The groups are recorded in the config, so there must be one.
    await flushSave();
    const made = await window.potok.ensureFileGroups();

    if (!made.ok) {
      toast(made.message ?? t('filesMissing'));
      return false;
    }

    const reply = await window.potok.getConfig();
    if (reply.ok) update((s) => (s.reply = reply));
    toast(t('fileGroupsMade'));
    return true;
  })();

  const result = await ensuring;
  ensuring = null;
  return result;
}

/** An anonymous form takes no files: turning on one turns off the other. */
export function anonymityFits(form: Form): boolean {
  return !(form.settings.anonymous && hasFileQuestion(form));
}
