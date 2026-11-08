// The whole app: the editor's top bar and tabs, or the form for respondents
// (with "View responses" for those who read them), the dialogs and a toast.

import { html, nothing } from 'lit-html';
import { COLLECTION } from '../model/config';
import { plainText } from '../model/rich';
import { flushSave, keepMine, redo, setActive, takeTheirs, undo } from '../store/editor';
import { startFilling } from '../store/fill';
import { canRead, canSummarize, loadView } from '../store/responses';
import { state, update, type EditorTab } from '../store/state';
import { button, iconButton, notice, ui } from './common';
import { confirmDialog, keyDialog, publishDialog, themePanel } from './editor/dialogs';
import { questionsTab } from './editor/editor';
import { pictureDialog, videoDialog } from './editor/pictures';
import { settingsTab } from './editor/settings';
import { icon } from './icons';
import { respondView } from './respond/respond';
import { responsesView } from './responses/responses';

function saveStatus() {
  const t = ui.t;
  const labels = { saved: t('saved'), dirty: t('unsaved'), saving: t('saving'), error: t('saveFailed'), conflict: t('conflictTitle') };

  return html`<span class="pf-save-status pf-save-${state.save}" id="save-status" role="status" title=${labels[state.save]}>
    ${icon(state.save === 'saved' ? 'cloudDone' : state.save === 'error' || state.save === 'conflict' ? 'warning' : 'clock', 'size-4')}
    <span class="pf-save-text">${labels[state.save]}</span>
  </span>`;
}

function setTab(tab: EditorTab) {
  update((s) => {
    s.tab = tab;
    s.menu = null;
  });
  if (tab === 'responses') void loadView();
}

function preview() {
  void flushSave();
  update((s) => (s.preview = true));
  startFilling();
}

function editorTop() {
  const t = ui.t;
  const settings = state.form.settings;
  const total = state.responses.total;

  return html`<header class="pf-topbar" id="editor-top">
      <div class="pf-topbar-row">
        <span class="pf-app-mark" aria-hidden="true">${icon('forms', 'size-7')}</span>
        <div class="pf-topbar-title">
          <span class="pf-topbar-name">${plainText(state.form.title) || t('untitledForm')}</span>
          ${saveStatus()}
        </div>
        ${iconButton('palette', t('theme'), () => update((s) => (s.dialog = s.dialog?.kind === 'theme' ? null : { kind: 'theme' })), { id: 'open-theme' })}
        ${iconButton('eye', t('preview'), preview, { id: 'open-preview' })}
        ${iconButton('undo', t('undo'), undo, { disabled: state.past.length === 0, id: 'undo' })}
        ${iconButton('redo', t('redo'), redo, { disabled: state.future.length === 0, id: 'redo' })}
        <button
          type="button"
          class="pf-button ${settings.published ? 'pf-button-outline' : 'pf-button-primary'}"
          id="publish"
          @click=${() => update((s) => (s.dialog = { kind: 'publish' }))}
        >
          ${settings.published ? icon('check', 'size-4') : nothing}<span>${settings.published ? t('published') : t('publish')}</span>
        </button>
      </div>
      <nav class="pf-tabs" role="tablist">
        ${(['questions', 'responses', 'settings'] as EditorTab[]).map(
          (tab) => html`<button
            type="button"
            role="tab"
            id="tab-${tab}"
            aria-selected=${String(state.tab === tab)}
            class="pf-tab ${state.tab === tab ? 'pf-tab-on' : ''}"
            @click=${() => setTab(tab)}
          >
            ${t(tab === 'questions' ? 'questionsTab' : tab === 'responses' ? 'responsesTab' : 'settingsTab')}
            ${tab === 'responses' && total ? html`<span class="pf-tab-count">${total}</span>` : nothing}
          </button>`,
        )}
      </nav>
    </header>
    ${state.save === 'conflict'
      ? html`<div class="pf-conflict" id="save-conflict" role="alert">
          <div><strong>${t('conflictTitle')}</strong><p>${t('conflictText')}</p></div>
          ${button(t('takeTheirs'), takeTheirs, { id: 'take-theirs' })}
          ${button(t('keepMine'), keepMine, { kind: 'primary', id: 'keep-mine' })}
        </div>`
      : nothing}`;
}

function readerTop() {
  const t = ui.t;
  if (!canRead() && !(canSummarize() && state.readerScreen === 'responses')) return nothing;

  const onResponses = state.readerScreen === 'responses';
  return html`<div class="pf-reader-bar" id="reader-bar">
    ${button(onResponses ? t('backToForm') : t('viewResponses'), () => {
      update((s) => (s.readerScreen = onResponses ? 'form' : 'responses'));
      if (!onResponses) void loadView();
    }, { id: 'reader-switch', icon: onResponses ? 'forms' : 'summary' })}
  </div>`;
}

function dialogs() {
  const d = state.dialog;
  if (!d) return nothing;

  switch (d.kind) {
    case 'publish':
      return publishDialog();
    case 'theme':
      return themePanel();
    case 'picture':
      return pictureDialog(d.target);
    case 'video':
      return videoDialog();
    case 'key':
      return keyDialog(d.questionId);
    case 'confirm':
      return confirmDialog(d.text, d.action, d.danger);
  }
}

function themeStyle() {
  const theme = state.form.theme;
  return `--pf-accent:${theme.color};`;
}

function phaseView() {
  const t = ui.t;

  switch (state.phase) {
    case 'loading':
      return html`<p class="pf-center pf-muted" id="form-loading">${t('loading')}</p>`;
    case 'failed':
      return html`<div class="pf-column">${notice(t('failed'), 'warning', 'form-failed')}</div>`;
    case 'outdated':
      return html`<div class="pf-column">${notice(t('outdated'), 'warning', 'form-outdated')}</div>`;
    case 'previewFrame':
      return html`<div class="pf-column">${notice(t('previewFrame'), 'info', 'form-preview-frame')}</div>`;
    case 'denied':
      return html`<div class="pf-column">${notice(state.denied ?? t('membersOnly'), 'info', 'form-denied')}</div>`;
    default:
      return null;
  }
}

export function appView() {
  const phase = phaseView();
  const theme = state.form.theme;
  const rootClass = `pf-root pf-bg-${theme.background} pf-font-${theme.font}`;

  if (phase) return html`<div class=${rootClass} style=${themeStyle()}>${phase}</div>`;

  const editor = state.reply?.manage === true;

  if (editor && state.preview) {
    return html`<div class=${rootClass} style=${themeStyle()}>
      <div class="pf-preview-bar" id="preview-bar">
        ${icon('eye')}<span>${ui.t('previewNote')}</span><span class="flex-1"></span>
        ${button(ui.t('exitPreview'), () => update((s) => (s.preview = false)), { id: 'exit-preview', kind: 'primary' })}
      </div>
      <main class="pf-main">${respondView()}</main>
      ${dialogs()}${toast()}
    </div>`;
  }

  if (editor) {
    return html`<div class=${rootClass} style=${themeStyle()} @click=${() => state.menu && update((s) => (s.menu = null))}>
      ${editorTop()}
      <main class="pf-main" @click=${(event: Event) => event.target === event.currentTarget && setActive(null)}>
        ${state.tab === 'questions' ? questionsTab() : state.tab === 'responses' ? responsesView() : settingsTab()}
      </main>
      ${dialogs()}${toast()}
    </div>`;
  }

  return html`<div class=${rootClass} style=${themeStyle()} @click=${() => state.menu && update((s) => (s.menu = null))}>
    ${readerTop()}
    <main class="pf-main">${state.readerScreen === 'responses' && (canRead() || canSummarize()) ? responsesView() : respondView()}</main>
    ${dialogs()}${toast()}
  </div>`;
}

function toast() {
  return state.toast ? html`<div class="pf-toast" role="status" id="pf-toast">${state.toast}</div>` : nothing;
}

export function collectionCaps() {
  return state.reply?.caps[COLLECTION] ?? null;
}
