// The whole app: the editor's header and tabs, the form for respondents (with
// "View responses" for those who read them), an editor filling in the form as
// respondents do, the dialogs and a toast. It draws in Potok's own look: the
// page's theme, its icons, its pill buttons and cards.

import { html, nothing } from 'lit-html';
import { COLLECTION } from '../model/config';
import { plainText } from '../model/rich';
import { fillIn, keepMine, redo, setActive, stopFilling, takeTheirs, undo } from '../store/editor';
import { previewReason } from '../store/fill';
import { canRead, canSummarize, loadView } from '../store/responses';
import { state, update, type EditorTab } from '../store/state';
import { button, iconButton, notice, ui } from './common';
import { confirmDialog, keyDialog, publishDialog } from './editor/dialogs';
import { questionsTab } from './editor/editor';
import { pictureDialog, videoDialog } from './editor/pictures';
import { settingsTab } from './editor/settings';
import { icon, type IconName } from './icons';
import { respondView } from './respond/respond';
import { responsesView } from './responses/responses';

function saveStatus() {
  const t = ui.t;
  const labels = { saved: t('saved'), dirty: t('unsaved'), saving: t('saving'), error: t('saveFailed'), conflict: t('conflictTitle') };
  const symbol: IconName = state.save === 'saved' ? 'saved' : state.save === 'error' || state.save === 'conflict' ? 'warning' : 'clock';

  return html`<span class="pf-save-status pf-save-${state.save}" id="save-status" role="status" title=${labels[state.save]}>
    ${icon(symbol, 'size-3.5')}<span class="pf-save-text">${labels[state.save]}</span>
  </span>`;
}

function setTab(tab: EditorTab) {
  update((s) => {
    s.tab = tab;
    s.menu = null;
  });
  if (tab === 'responses') void loadView();
}

const TABS: { tab: EditorTab; icon: IconName; label: 'questionsTab' | 'responsesTab' | 'settingsTab' }[] = [
  { tab: 'questions', icon: 'listBullet', label: 'questionsTab' },
  { tab: 'responses', icon: 'summary', label: 'responsesTab' },
  { tab: 'settings', icon: 'settings', label: 'settingsTab' },
];

function editorTop() {
  const t = ui.t;
  const settings = state.form.settings;
  const total = state.responses.total;

  return html`<header class="pf-topbar" id="editor-top">
      <div class="pf-topbar-row">
        <span class="pf-tile" aria-hidden="true">${icon('forms', 'size-6')}</span>
        <div class="pf-topbar-title">
          <span class="pf-topbar-name">${plainText(state.form.title) || t('untitledForm')}</span>
          ${saveStatus()}
        </div>
        <div class="pf-topbar-actions">
          ${iconButton('undo', t('undo'), undo, { disabled: state.past.length === 0, id: 'undo' })}
          ${iconButton('redo', t('redo'), redo, { disabled: state.future.length === 0, id: 'redo' })}
          ${button(t('fillIn'), () => void fillIn(), { kind: 'secondary', icon: 'fill', id: 'open-fill', title: t('fillInTitle') })}
          ${button(settings.published ? t('published') : t('publish'), () => update((s) => (s.dialog = { kind: 'publish' })), {
            kind: settings.published ? 'success' : 'primary',
            icon: settings.published ? 'check' : 'send',
            id: 'publish',
          })}
        </div>
      </div>
      <nav class="pf-tabs" role="tablist">
        ${TABS.map(
          ({ tab, icon: symbol, label }) => html`<button
            type="button"
            role="tab"
            id="tab-${tab}"
            aria-selected=${String(state.tab === tab)}
            class="pf-tab ${state.tab === tab ? 'pf-tab-on' : ''}"
            @click=${() => setTab(tab)}
          >
            ${icon(symbol, 'size-4')}<span>${t(label)}</span>
            ${tab === 'responses' && total ? html`<span class="pf-tab-count">${total}</span>` : nothing}
          </button>`,
        )}
      </nav>
    </header>
    ${state.save === 'conflict'
      ? html`<div class="pf-conflict" id="save-conflict" role="alert">
          ${icon('warning', 'size-5 shrink-0')}
          <div><strong>${t('conflictTitle')}</strong><p>${t('conflictText')}</p></div>
          ${button(t('takeTheirs'), takeTheirs, { kind: 'secondary', id: 'take-theirs' })}
          ${button(t('keepMine'), keepMine, { kind: 'primary', id: 'keep-mine' })}
        </div>`
      : nothing}`;
}

/** The bar over the form while an editor fills it in: back, and whether it sends. */
function fillBar() {
  const t = ui.t;
  const preview = previewReason() !== null;

  return html`<div class="pf-fill-bar" id="fill-bar">
    ${button(t('exitPreview'), () => stopFilling(), { kind: 'secondary', icon: 'back', id: 'exit-fill' })}
    <span class="pf-status ${preview ? 'pf-status-preview' : 'pf-status-live'}" id="fill-status">
      ${icon(preview ? 'eye' : 'send', 'size-4')}
      <span class="pf-long">${preview ? t('fillPreview') : t('fillLive')}</span>
      <span class="pf-short">${preview ? t('fillPreviewShort') : t('fillLiveShort')}</span>
    </span>
  </div>`;
}

function readerTop() {
  const t = ui.t;
  if (!canRead() && !(canSummarize() && state.readerScreen === 'responses')) return nothing;

  const onResponses = state.readerScreen === 'responses';
  return html`<div class="pf-reader-bar" id="reader-bar">
    ${button(onResponses ? t('backToForm') : t('viewResponses'), () => {
      update((s) => (s.readerScreen = onResponses ? 'form' : 'responses'));
      if (!onResponses) void loadView();
    }, { id: 'reader-switch', kind: 'soft', icon: onResponses ? 'forms' : 'summary' })}
  </div>`;
}

function dialogs() {
  const d = state.dialog;
  if (!d) return nothing;

  switch (d.kind) {
    case 'publish':
      return publishDialog();
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

function phaseView() {
  const t = ui.t;

  switch (state.phase) {
    case 'loading':
      return html`<div class="pf-loading" id="form-loading" role="status">
        <span class="pf-tile pf-pulse" aria-hidden="true">${icon('forms', 'size-6')}</span>
        <span class="pf-muted">${t('loading')}</span>
      </div>`;
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

  if (phase) return html`<div class="pf-root"><main class="pf-main">${phase}</main></div>`;

  const editor = state.reply?.manage === true;
  const closeMenu = () => state.menu && update((s) => (s.menu = null));

  if (editor && state.filling) {
    return html`<div class="pf-root" @click=${closeMenu}>
      ${fillBar()}
      <main class="pf-main">${respondView()}</main>
      ${dialogs()}${toast()}
    </div>`;
  }

  if (editor) {
    return html`<div class="pf-root" @click=${closeMenu}>
      ${editorTop()}
      <main class="pf-main" @click=${(event: Event) => event.target === event.currentTarget && setActive(null)}>
        ${state.tab === 'questions' ? questionsTab() : state.tab === 'responses' ? responsesView() : settingsTab()}
      </main>
      ${dialogs()}${toast()}
    </div>`;
  }

  return html`<div class="pf-root" @click=${closeMenu}>
    ${readerTop()}
    <main class="pf-main">${state.readerScreen === 'responses' && (canRead() || canSummarize()) ? responsesView() : respondView()}</main>
    ${dialogs()}${toast()}
  </div>`;
}

function toast() {
  return state.toast
    ? html`<div class="pf-toast" role="status" id="pf-toast">
        <span class="pf-toast-icon" aria-hidden="true">${icon('info', 'size-4')}</span><span>${state.toast}</span>
      </div>`
    : nothing;
}

export function collectionCaps() {
  return state.reply?.caps[COLLECTION] ?? null;
}
