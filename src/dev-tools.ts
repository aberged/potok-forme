import './dev-theme.css';
import { toConfigData } from './model/config';
import { newChoice, newForm, newLine, newQuestion, newSection, type Form } from './model/form';
import { DEV_READER_ROLE } from './potok-dev';

// Dev only (main.ts imports it in its DEV block): a form with every kind of
// question and responses to page through, in the dev store. `?lang=en` or
// `?lang=sr-Cyrl` tries a language, `?viewer=` another viewer (see
// potok-dev.ts), `?seed=empty` starts with no form.
// To start over: localStorage.clear() in this tab.

const CONFIG_KEY = 'potok-dev:config:default';
const VALUES_KEY = 'potok-dev:values';

function sampleForm(): Form {
  const form = newForm('Prijava za radionicu');
  form.description = 'Popuni do **petka**. Pitanja sa zvezdicom su obavezna.\n- Trajanje: 2 sata\n- Mesto: Dom kulture';

  const name = { ...newQuestion('short'), title: 'Ime i prezime', required: true };
  const email = {
    ...newQuestion('short'),
    title: 'Imejl',
    validation: { kind: 'text' as const, op: 'email' as const, value: '', error: '' },
  };
  const day = { ...newQuestion('choice'), title: 'Koji dan ti odgovara?', required: true, options: [newChoice('Utorak'), newChoice('Sreda'), newChoice('Četvrtak')], other: true };
  const topics = { ...newQuestion('checkbox'), title: 'Šta te zanima?', options: [newChoice('Fotografija'), newChoice('Video'), newChoice('Zvuk'), newChoice('Pisanje')] };
  const city = { ...newQuestion('dropdown'), title: 'Grad', options: [newChoice('Beograd'), newChoice('Novi Sad'), newChoice('Niš')] };
  const scale = { ...newQuestion('scale'), title: 'Koliko iskustva imaš?', scaleMinLabel: 'Nimalo', scaleMaxLabel: 'Mnogo' };
  const rating = { ...newQuestion('rating'), title: 'Kako ocenjuješ prošlu radionicu?' };
  const grid = { ...newQuestion('grid'), title: 'Koliko su ti važni', rows: [newLine('Cena'), newLine('Termin'), newLine('Mesto')], columns: [newLine('Malo'), newLine('Srednje'), newLine('Mnogo')] };
  const section = { ...newSection(), title: 'Još malo o tebi' };
  const date = { ...newQuestion('date'), title: 'Datum rođenja' };
  const time = { ...newQuestion('time'), title: 'Kada stižeš?' };
  const note = { ...newQuestion('paragraph'), title: 'Napomena' };

  form.items = [name, email, day, topics, city, scale, rating, grid, section, date, time, note];
  form.settings.published = true;
  form.settings.view = [DEV_READER_ROLE];
  return form;
}

function sampleResponses(form: Form) {
  const [, , day, topics, city, scale, rating, grid, , , , note] = form.items as ReturnType<typeof newQuestion>[];
  const names = ['Ana', 'Marko', 'Jelena', 'Nikola', 'Milica', 'Stefan', 'Ivana', 'Luka', 'Sara', 'Petar'];
  const now = Date.now();

  return Array.from({ length: 120 }, (_, index) => {
    const when = new Date(now - (120 - index) * 3_600_000).toISOString().replace(/\.\d+Z$/, 'Z');
    const pick = <T>(list: T[], salt: number) => list[(index * 7 + salt) % list.length];

    return {
      id: 1_000 + index,
      content: 'data:',
      data: {
        v: 1,
        form_rev: 0,
        a: {
          [form.items[0].id]: `${pick(names, 1)} ${pick(['Petrović', 'Jovanović', 'Ilić'], 2)}`,
          [day.id]: pick(day.options, 3).id,
          [topics.id]: topics.options.filter((_, i) => (index + i) % 3 === 0).map((option) => option.id),
          [city.id]: pick(city.options, 4).id,
          [scale.id]: 1 + ((index * 3) % 5),
          [rating.id]: 1 + ((index * 5) % 5),
          [grid.id]: Object.fromEntries(grid.rows.map((row, i) => [row.id, pick(grid.columns, i).id])),
          ...(index % 4 === 0 ? { [note.id]: 'Dolazim sa drugaricom.' } : {}),
        },
        other: {},
      },
      content_format: 'markdown',
      is_data: true,
      group_id: 1,
      parent_id: null,
      creator_id: 10 + (index % 40),
      creator_username: `ispitanik-${index % 40}`,
      description_id: null,
      collection: 'responses',
      anonymous: false,
      revision: 0,
      managed: null,
      inserted_at: when,
      updated_at: when,
    };
  });
}

export function seedDevForm() {
  const params = new URLSearchParams(location.search);
  const lang = params.get('lang');
  if (lang) document.documentElement.lang = lang;

  if (params.get('seed') === 'empty' || localStorage.getItem(CONFIG_KEY)) return;

  const form = sampleForm();
  localStorage.setItem(
    CONFIG_KEY,
    JSON.stringify({ id: 900_000, revision: 0, data: { ...toConfigData(form), files: { public: 801, private: 802 } }, updated_at: new Date().toISOString() }),
  );

  const others = JSON.parse(localStorage.getItem(VALUES_KEY) || '[]');
  localStorage.setItem(VALUES_KEY, JSON.stringify([...others, ...sampleResponses(form)]));
}
