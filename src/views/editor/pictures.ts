// Pictures in the form: from the device, made smaller first and kept in the
// form's public file group with an address anyone who sees the form opens, or
// by an address on the web. And a video, which is a link to YouTube, as the
// sandbox lets no player run inside the form.

import { html, nothing } from 'lit-html';
import { safePicture, type Picture } from '../../model/form';
import { addPictureItem, addVideo, editQuestion, editTheme, ensureFileGroups } from '../../store/editor';
import { state, toast, update, type PictureTarget } from '../../store/state';
import { button, closeDialog, dialog, iconButton, ui } from '../common';
import { icon } from '../icons';

const MAX_SIDE = 1600;

export function pictureView(picture: Picture, onRemove?: () => void, className = '') {
  return html`<figure class="pf-picture ${className}">
    <img src=${picture.url} alt=${picture.alt} loading="lazy" referrerpolicy="no-referrer" />
    ${onRemove ? iconButton('close', ui.t('removePicture'), onRemove, { className: 'pf-picture-remove' }) : nothing}
  </figure>`;
}

/** A photo from a phone is big: the form gets a copy at most 1600 px wide. */
async function smaller(file: File): Promise<File> {
  if (file.type === 'image/gif' || !file.type.startsWith('image/')) return file;

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) return file;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    return blob ? new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

function apply(target: PictureTarget, picture: Picture) {
  switch (target.kind) {
    case 'header':
      editTheme((theme) => (theme.header = picture));
      break;
    case 'question':
      editQuestion(target.questionId, (question) => (question.picture = picture));
      break;
    case 'option':
      editQuestion(target.questionId, (question) => {
        const option = question.options.find((candidate) => candidate.id === target.optionId);
        if (option) option.picture = picture;
      });
      break;
    case 'item':
      addPictureItem(picture.url, picture.alt);
      break;
  }
}

async function fromDevice(target: PictureTarget, file: File) {
  if (!(await ensureFileGroups())) return;

  update((s) => (s.pictureUpload = { name: file.name, progress: 0 }));
  const reply = await window.potok.uploadImage(await smaller(file), {
    onProgress: (progress) => update((s) => s.pictureUpload && (s.pictureUpload.progress = progress)),
  });
  update((s) => (s.pictureUpload = null));

  if (reply.ok && reply.file.url) {
    apply(target, { url: reply.file.url, alt: '' });
    closeDialog();
  } else if (!reply.ok) {
    toast(reply.message ?? ui.t('fileWrongType'));
  }
}

let typedUrl = '';

export function pictureDialog(target: PictureTarget) {
  const t = ui.t;
  const upload = state.pictureUpload;

  return dialog(
    t('addPicture'),
    html`<div class="pf-picture-dialog">
      <label class="pf-upload-drop">
        ${icon('upload', 'size-8')}
        <span>${upload ? t('uploading', { n: upload.progress }) : t('pictureFromDevice')}</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          class="sr-only"
          id="picture-file"
          ?disabled=${Boolean(upload)}
          @change=${(event: Event) => {
            const file = (event.target as HTMLInputElement).files?.[0];
            if (file) void fromDevice(target, file);
          }}
        />
      </label>
      <p class="pf-muted pf-small">${t('or')} ${t('pictureByUrl').toLowerCase()}</p>
      <input
        type="url"
        id="picture-url"
        class="pf-field"
        placeholder=${t('pictureUrl')}
        @input=${(event: Event) => (typedUrl = (event.target as HTMLInputElement).value)}
      />
    </div>`,
    html`${button(t('cancel'), closeDialog)}
      ${button(t('save'), () => {
        const picture = safePicture({ url: typedUrl.trim() });
        if (picture && /^https:\/\//.test(picture.url)) {
          apply(target, picture);
          typedUrl = '';
          closeDialog();
        }
      }, { kind: 'primary', id: 'picture-url-save' })}`,
    'pf-picture',
  );
}

let typedVideo = '';

/** The id of a YouTube video in a link, for its picture and its link. */
export function youtubeId(url: string): string | null {
  const match = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/.exec(url);
  return match ? match[1] : null;
}

export function videoDialog() {
  const t = ui.t;

  return dialog(
    t('addVideo'),
    html`<input
      type="url"
      id="video-url"
      class="pf-field"
      placeholder=${t('videoUrl')}
      @input=${(event: Event) => (typedVideo = (event.target as HTMLInputElement).value)}
    />`,
    html`${button(t('cancel'), closeDialog)}
      ${button(t('save'), () => {
        const id = youtubeId(typedVideo);
        if (id) {
          addVideo(`https://www.youtube.com/watch?v=${id}`);
          typedVideo = '';
          closeDialog();
        }
      }, { kind: 'primary', id: 'video-save' })}`,
    'pf-video',
  );
}

export function videoCard(url: string, title: string) {
  const id = youtubeId(url);

  return html`<a class="pf-video-card" href=${url} target="_blank" rel="noopener noreferrer">
    ${id ? html`<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="" loading="lazy" referrerpolicy="no-referrer" />` : nothing}
    <span class="pf-video-play">${icon('video', 'size-6')}<span>${title || ui.t('watchVideo')}</span></span>
  </a>`;
}
