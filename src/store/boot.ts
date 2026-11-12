// Starting the app: the config and what the viewer may do, the group's roles
// for an editor, the viewer's own responses, and live changes from then on.

import { COLLECTION, fromConfigData } from '../model/config';
import { newForm, normalizeForm } from '../model/form';
import type { Translate } from '../i18n';
import type { PotokValueChange } from '../potok';
import { configChanged, flushSave, scheduleSave, setTranslator, takeUnsaved } from './editor';
import { loadMine, setFillTranslator, startFilling } from './fill';
import { isOnResponses, loadView, onResponseChange, setResponsesTranslator } from './responses';
import { state, update } from './state';

let unsubscribe: (() => void) | null = null;

export async function boot(t: Translate) {
  setTranslator(t);
  setFillTranslator(t);
  setResponsesTranslator(t);
  update((s) => (s.phase = 'loading'));

  let reply;
  try {
    reply = await window.potok.getConfig();
  } catch {
    update((s) => (s.phase = 'failed'));
    return;
  }

  if (!reply.ok) {
    // A guest is turned away like anyone outside, and may be a member who has
    // not logged in: only the profile tells.
    const denied = reply.error === 'not_a_member' || reply.error === 'forbidden';
    const profile = denied ? await window.potok.getCurrentProfile().catch(() => undefined) : undefined;

    update((s) => {
      s.deniedGuest = profile === null;
      if (reply.error === 'unknown_method') s.phase = 'outdated';
      else if (reply.error === 'preview') s.phase = 'previewFrame';
      else if (reply.error === 'not_a_member' || reply.error === 'forbidden') {
        s.phase = 'denied';
        s.denied = t('membersOnly');
      } else s.phase = 'failed';
    });
    return;
  }

  const editor = reply.manage;
  const revision = reply.config?.revision ?? 0;
  let form = fromConfigData(reply.config?.data);
  let dirty = false;

  if (editor && !reply.config) {
    // A new form: it takes the group's name, and is saved at once so that its
    // file groups and rules have a config to live in.
    const group = await window.potok.getGroup();
    form = newForm(group.ok ? group.group.name : '');
    dirty = true;
  }

  if (editor) {
    const unsaved = takeUnsaved(revision);
    if (unsaved) {
      form = normalizeForm(unsaved);
      dirty = true;
    }
  }

  update((s) => {
    s.reply = reply;
    s.revision = revision;
    s.form = form;
    s.savedJson = dirty ? '' : JSON.stringify(form);
    s.save = dirty ? 'dirty' : 'saved';
    s.phase = 'ready';
    s.tab = 'questions';
    s.active = editor ? (form.items[0]?.id ?? null) : null;
  });

  if (dirty) scheduleSave(reply.config ? 1_500 : 0);
  if (!editor) startFilling();

  if (editor) {
    void window.potok.listRoles().then((roles) => update((s) => (s.roles = roles.ok ? roles.roles : [])));
  }

  void loadMine();

  unsubscribe?.();
  unsubscribe = window.potok.onValues((change: PotokValueChange) => {
    if (change.event === 'config') {
      if (state.reply?.manage) void configChanged(change.revision);
      else void refreshForRespondent();
      return;
    }

    if (change.event === 'cleared' && change.collection === null) {
      void boot(t);
      return;
    }

    if (change.collection === COLLECTION || change.event === 'cleared') {
      onResponseChange(change as never);
      if (change.event === 'created' && change.value.creator_id === state.reply?.viewer.profile_id) void loadMine();
      if (change.event === 'regraded') void loadMine();
    }
  });

  window.addEventListener('pagehide', () => {
    if (state.reply?.manage && state.save !== 'saved') void flushSave();
  });
}

// A respondent who has not started gets the editor's changes; one who is
// answering keeps the form as it was, and the server checks what they send.
async function refreshForRespondent() {
  const started = Object.keys(state.fill.answers).length > 0 && !state.fill.done;
  const reply = await window.potok.getConfig();
  if (!reply.ok) return;

  update((s) => {
    s.reply = reply;
    s.revision = reply.config?.revision ?? s.revision;
    if (!started) s.form = fromConfigData(reply.config?.data);
  });

  if (isOnResponses()) void loadView();
}
