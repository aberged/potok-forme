// Files in the responses: names that open the file in a new tab, by an address
// Potok signs for whoever may open it. A reader who is not a member of the
// group that keeps the file gets its name and a word on why it does not open.

import { html, nothing } from 'lit-html';
import { fileRefs, readResponse, type FileRef } from '../../model/answers';
import { bytes } from '../../model/format';
import type { Question } from '../../model/form';
import type { PotokCollectionValue } from '../../potok';
import { fileUrl } from '../../store/responses';
import { state, toast } from '../../store/state';
import { ui } from '../common';
import { icon } from '../icons';

async function open(ref: FileRef) {
  // The window opens at once, as a popup after a server trip is blocked.
  const tab = window.open('', '_blank');
  const url = await fileUrl(ref.file);

  if (url && tab) tab.location.href = url;
  else {
    tab?.close();
    if (!url) toast(ui.t('fileOpenDenied'));
  }
}

export function fileChip(ref: FileRef) {
  const denied = state.fileUrls[ref.file] === 'denied';

  return html`<button type="button" class="pf-file-chip pf-file-link ${denied ? 'pf-file-denied' : ''}" title=${denied ? ui.t('fileOpenDenied') : ref.name} @click=${() => void open(ref)}>
    ${icon(denied ? 'lock' : 'file', 'size-5')}<span class="pf-file-name">${ref.name}</span>
    <span class="pf-muted pf-small">${bytes(ref.size, ui.lang)}</span>
  </button>`;
}

export function filesOf(question: Question, rows: PotokCollectionValue[]) {
  const refs = rows.flatMap((row) => fileRefs(readResponse(row.data).a[question.id]));
  if (refs.length === 0) return html`<p class="pf-muted">${ui.t('noAnswers')}</p>`;

  return html`<div class="pf-files">${refs.slice(0, 30).map(fileChip)}${refs.length > 30 ? html`<span class="pf-muted">…</span>` : nothing}</div>`;
}
