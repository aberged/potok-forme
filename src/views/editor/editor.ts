// The "Questions" tab: the header card, the cards of questions, texts,
// pictures, videos and sections, and the toolbar that adds them, beside the
// cards on a wide screen and at the bottom on a phone.

import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { FIRST_SECTION, NEXT, SUBMIT, sections, type Item, type Section } from '../../model/form';
import {
  addQuestion,
  addSection,
  addText,
  deleteItem,
  duplicateItem,
  edit,
  editItem,
  moveItemTo,
  setActive,
} from '../../store/editor';
import { state, update } from '../../store/state';
import { iconButton, menu, menuItem, notice, richField, richText, select, ui, underlined } from '../common';
import { startDrag } from '../drag';
import { icon } from '../icons';
import { pictureView, videoCard } from './pictures';
import { questionEditor, questionSummary } from './question';

const HEADER = '_header';

function headerCard() {
  const t = ui.t;
  const active = state.active === HEADER;
  const form = state.form;

  return html`<section
    class="pf-card pf-header-card ${active ? 'pf-card-active' : ''}"
    id="form-header"
    @click=${() => !active && setActive(HEADER)}
  >
    ${active
      ? html`${underlined(form.title, t('formTitlePlaceholder'), (value) => edit((f) => (f.title = value), 'form-title'), {
            id: 'form-title',
            className: 'pf-form-title-field',
            maxlength: 300,
          })}
          ${richField('form-description', form.description, t('formDescriptionPlaceholder'), (value) =>
            edit((f) => (f.description = value), 'form-description'))}`
      : html`<h1 class="pf-form-title">${form.title || t('untitledForm')}</h1>
          ${form.description ? richText(form.description, 'pf-form-description') : html`<p class="pf-muted">${t('formDescriptionPlaceholder')}</p>`}`}
  </section>`;
}

function sectionLabel(item: Section) {
  const all = sections(state.form);
  const index = all.findIndex((section) => section.id === item.id);
  return html`<div class="pf-section-tab">${ui.t('sectionOf', { a: index + 1, b: all.length })}</div>`;
}

function afterSection(sectionId: string, number: number) {
  const t = ui.t;
  const all = sections(state.form);
  const current = all.find((section) => section.id === sectionId);
  if (!current || all.length < 2) return nothing;

  return html`<div class="pf-after-section">
    <span>${t('afterSection', { n: number })}</span>
    ${select(
      current.next || NEXT,
      [
        { value: NEXT, label: t('continueNext') },
        ...all
          .slice(1)
          .filter((section) => section.id !== sectionId)
          .map((section) => ({
            value: section.id,
            label: t('goToSection', { n: all.indexOf(section) + 1, name: section.title || t('untitledSection') }),
          })),
        { value: SUBMIT, label: t('submitForm') },
      ],
      (value) =>
        sectionId === FIRST_SECTION
          ? edit((form) => (form.startNext = value))
          : editItem<Section>(sectionId, (section) => (section.next = value)),
      { label: t('afterSection', { n: number }) },
    )}
  </div>`;
}

function itemMenu(item: Item) {
  const t = ui.t;
  return menu(`item-${item.id}`, iconButton('more', t('more'), () => {}), [
    menuItem(t('duplicate'), () => duplicateItem(item.id), { icon: 'copy' }),
    menuItem(item.type === 'section' ? t('deleteSection') : t('delete'), () => deleteItem(item.id), { icon: 'trash', danger: true }),
  ]);
}

function itemBody(item: Item, index: number, move: (from: number, to: number) => void) {
  const t = ui.t;
  const active = state.active === item.id;

  switch (item.type) {
    case 'question':
      return active ? questionEditor(item, index, move) : questionSummary(item);

    case 'section':
      return active
        ? html`<div class="pf-card-handle" @pointerdown=${(event: PointerEvent) => startDrag(event, move)}>${icon('drag', 'size-4 rotate-90')}</div>
            <div class="pf-item-head">
              ${underlined(item.title, t('untitledSection'), (value) => editItem<Section>(item.id, (s) => (s.title = value), `stitle-${item.id}`), {
                className: 'pf-section-title-field',
              })}
              ${itemMenu(item)}
            </div>
            ${richField(`sdesc-${item.id}`, item.description, t('descriptionPlaceholder'), (value) =>
              editItem<Section>(item.id, (s) => (s.description = value), `sdesc-${item.id}`))}`
        : html`<h2 class="pf-section-title">${item.title || t('untitledSection')}</h2>
            ${item.description ? richText(item.description, 'pf-muted') : nothing}`;

    case 'text':
      return active
        ? html`<div class="pf-card-handle" @pointerdown=${(event: PointerEvent) => startDrag(event, move)}>${icon('drag', 'size-4 rotate-90')}</div>
            <div class="pf-item-head">
              ${underlined(item.title, t('titlePlaceholder'), (value) => editItem(item.id, (i) => ((i as typeof item).title = value), `ttitle-${item.id}`), {
                className: 'pf-text-title-field',
              })}
              ${itemMenu(item)}
            </div>
            ${richField(`tdesc-${item.id}`, item.description, t('descriptionPlaceholder'), (value) =>
              editItem(item.id, (i) => ((i as typeof item).description = value), `tdesc-${item.id}`))}`
        : html`<h3 class="pf-text-title">${item.title || t('titlePlaceholder')}</h3>${item.description ? richText(item.description) : nothing}`;

    case 'picture':
      return html`${active
          ? html`<div class="pf-card-handle" @pointerdown=${(event: PointerEvent) => startDrag(event, move)}>${icon('drag', 'size-4 rotate-90')}</div>
              <div class="pf-item-head">
                ${underlined(item.title, t('titlePlaceholder'), (value) => editItem(item.id, (i) => ((i as typeof item).title = value), `ptitle-${item.id}`))}
                ${itemMenu(item)}
              </div>`
          : item.title
            ? html`<h3 class="pf-text-title">${item.title}</h3>`
            : nothing}
        ${pictureView(item.picture)}`;

    case 'video':
      return html`${active
          ? html`<div class="pf-card-handle" @pointerdown=${(event: PointerEvent) => startDrag(event, move)}>${icon('drag', 'size-4 rotate-90')}</div>
              <div class="pf-item-head">
                ${underlined(item.title, t('titlePlaceholder'), (value) => editItem(item.id, (i) => ((i as typeof item).title = value), `vtitle-${item.id}`))}
                ${itemMenu(item)}
              </div>`
          : nothing}
        ${videoCard(item.url, item.title)}`;
  }
}

function toolbar() {
  const t = ui.t;

  return html`<aside class="pf-toolbar" aria-label=${t('addQuestion')}>
    ${iconButton('addCircle', t('addQuestion'), () => addQuestion('choice'), { id: 'add-question' })}
    ${iconButton('title', t('addTitle'), addText, { id: 'add-title' })}
    ${iconButton('image', t('addPicture'), () => update((s) => (s.dialog = { kind: 'picture', target: { kind: 'item' } })), { id: 'add-picture' })}
    ${iconButton('video', t('addVideo'), () => update((s) => (s.dialog = { kind: 'video' })), { id: 'add-video' })}
    ${iconButton('section', t('addSection'), addSection, { id: 'add-section' })}
  </aside>`;
}

export function questionsTab() {
  const items = state.form.items;
  const move = (from: number, to: number) => moveItemTo(items[from].id, to);
  const all = sections(state.form);
  const visibility = state.reply?.visible_role_keys ?? [];
  const fillHidden =
    visibility.length > 0 && state.form.settings.fill.some((key) => key !== 'admin' && !visibility.includes(key));

  // "After section N" stands at the end of each section that has a next one.
  const sectionEnds = new Map<number, { id: string; number: number }>();
  all.forEach((section, index) => {
    if (index === all.length - 1) return;
    const lastItem = section.items[section.items.length - 1];
    const sectionItemIndex = section.id === FIRST_SECTION ? -1 : items.findIndex((item) => item.id === section.id);
    const at = lastItem ? items.findIndex((item) => item.id === lastItem.id) : sectionItemIndex;
    sectionEnds.set(at, { id: section.id, number: index + 1 });
  });

  return html`<div class="pf-editor-layout">
    <div class="pf-column">
      ${fillHidden ? notice(ui.t('visibilityWarning'), 'warning') : nothing}
      ${state.form.theme.header ? html`<div class="pf-header-image"><img src=${state.form.theme.header.url} alt="" /></div>` : nothing}
      ${headerCard()}
      ${sectionEnds.get(-1) ? afterSection(sectionEnds.get(-1)!.id, sectionEnds.get(-1)!.number) : nothing}
      <div class="pf-items" data-drag-list>
        ${repeat(
          items,
          (item) => item.id,
          (item, index) => html`<div class="pf-item-slot" data-drag-item>
            ${item.type === 'section' ? sectionLabel(item) : nothing}
            <section
              class="pf-card ${item.type === 'section' ? 'pf-section-card' : ''} ${state.active === item.id ? 'pf-card-active' : ''}"
              id="item-${item.id}"
              @click=${() => state.active !== item.id && setActive(item.id)}
            >
              ${itemBody(item, index, move)}
            </section>
            ${sectionEnds.has(index) ? afterSection(sectionEnds.get(index)!.id, sectionEnds.get(index)!.number) : nothing}
          </div>`,
        )}
      </div>
    </div>
    ${toolbar()}
  </div>`;
}
