import { describe, expect, it } from 'vitest';
import { answerText, keptAnswers, nextSection, problem, responseData } from './answers';
import { fromConfigData, keyCheck, responsesRule, toConfigData } from './config';
import { csvCell, csvHeader, csvRow, toCsv } from './csv';
import {
  changeKind,
  emptyKey,
  FIRST_SECTION,
  newChoice,
  newForm,
  newLine,
  newQuestion,
  newSection,
  normalizeForm,
  OTHER,
  sections,
  SUBMIT,
  type Question,
} from './form';
import { parseInline, parseRich, plainText, toggleList, toggleMark } from './rich';
import { translator, toCyrillic } from '../i18n';

const words = { other: 'Drugo', yes: '✓' };
const dates = (iso: string) => iso;

function choice(labels: string[], extra: Partial<Question> = {}): Question {
  return { ...newQuestion('choice'), title: 'Q', options: labels.map((label) => newChoice(label)), ...extra };
}

describe('normalizeForm', () => {
  it('keeps what it knows and drops what it cannot trust', () => {
    const form = normalizeForm({
      title: 'Prijava',
      items: [
        { type: 'question', id: 'q1', kind: 'nonsense', title: 'A' },
        { type: 'question', id: 'q2', kind: 'choice', options: [{ id: 'o1', label: 'Da' }], picture: { url: 'javascript:alert(1)' } },
        { type: 'picture', id: 'p1', picture: { url: 'ftp://x' } },
        { type: 'video', id: 'v1', url: 'https://youtu.be/abcdefghijk' },
        { type: 'bogus' },
      ],
      theme: { color: 'red', font: 'playful' },
    });

    expect(form.items.map((item) => item.type)).toEqual(['question', 'question', 'video']);
    expect((form.items[0] as Question).kind).toBe('short');
    expect((form.items[1] as Question).picture).toBeNull();
    expect((form.items[1] as Question).options[0]).toMatchObject({ id: 'o1', label: 'Da' });
    // The colors and fonts of early forms go: a form looks like Potok.
    expect(form.theme).toEqual({ header: null });
  });

  it('takes Potok signed picture addresses and https ones', () => {
    const form = normalizeForm({ theme: { header: { url: 'https://potok.rs/pictures/abc' } } });
    expect(form.theme.header?.url).toBe('https://potok.rs/pictures/abc');
  });

  it('changing a kind keeps the options and forgets the key', () => {
    const question = { ...choice(['A', 'B']), key: { ...emptyKey(), options: ['x'] } };
    const changed = changeKind(question, 'checkbox');
    expect(changed.options).toHaveLength(2);
    expect(changed.key).toBeNull();
    expect(changeKind(question, 'grid').rows).toHaveLength(2);
  });

  it('splits sections at section breaks, the first under the header', () => {
    const form = newForm('F');
    const section = newSection();
    form.items = [newQuestion('short'), section, newQuestion('paragraph')];
    const all = sections(form);
    expect(all.map((s) => s.id)).toEqual([FIRST_SECTION, section.id]);
    expect(all[0].items).toHaveLength(1);
    expect(all[1].items).toHaveLength(1);
  });
});

describe('the config', () => {
  it('turns settings into the rule Potok holds to', () => {
    const form = newForm('F');
    form.settings = { ...form.settings, published: true, fill: ['r1'], view: ['r2'], once: true, editOwn: true, summaryForRespondents: true };
    const rule = responsesRule(form);

    expect(rule).toMatchObject({ write: ['r1'], read: ['r2'], summary: ['r1'], once: true, edit_own: true, open: true, under: ['a'] });
    expect(responsesRule({ ...form, settings: { ...form.settings, published: false } }).open).toBe(false);
    expect(responsesRule({ ...form, settings: { ...form.settings, public: true } }).write).toEqual(['everyone']);
  });

  it('keeps an anonymous form without files and a quiz released at once without editing', () => {
    const form = newForm('F');
    form.items = [newQuestion('file')];
    form.settings.anonymous = true;
    form.settings.editOwn = true;
    form.settings.quiz.enabled = true;
    const rule = responsesRule(form);

    expect(rule.anonymous).toBe(false);
    expect(rule.edit_own).toBe(false);
    expect(Object.keys(rule.uploads ?? {})).toEqual([form.items[0].id]);
  });

  it('keeps the right answers out of the public form and in the secret part', () => {
    const form = newForm('F');
    const question = { ...choice(['A', 'B']), points: 2 };
    question.key = { ...emptyKey(), options: [question.options[1].id], ok: 'Bravo' };
    form.items = [question];
    form.settings.quiz.enabled = true;

    const data = toConfigData(form) as Record<string, any>;
    expect(data.form.items[0].key).toBeNull();
    expect(data.secret.score.responses[question.id]).toEqual({ points: 2, eq: question.options[1].id, ok: 'Bravo' });
    expect(JSON.stringify(data.form)).not.toContain('Bravo');

    const back = fromConfigData(data);
    expect((back.items[0] as Question).key?.options).toEqual([question.options[1].id]);
  });

  it('checks each kind of question as the server scores it', () => {
    const short = { ...newQuestion('short'), points: 1, key: { ...emptyKey(), texts: ['Beograd', ''], othersWrong: true } };
    expect(keyCheck(short)).toEqual({ points: 1, text: ['Beograd'], others_wrong: true });

    const grid = { ...newQuestion('grid'), points: 1, rows: [newLine('r')], columns: [newLine('c1'), newLine('c2')] };
    grid.key = { ...emptyKey(), rows: { [grid.rows[0].id]: [grid.columns[1].id] } };
    expect(keyCheck(grid)).toEqual({ points: 1, rows: { [grid.rows[0].id]: grid.columns[1].id } });

    expect(keyCheck({ ...newQuestion('paragraph'), points: 3 })).toEqual({ points: 3, manual: true });
    expect(keyCheck({ ...newQuestion('choice'), points: 0 })).toBeNull();
  });
});

describe('answers', () => {
  it('asks for required answers and the text of "Other"', () => {
    const question = choice(['A'], { required: true, other: true });
    expect(problem(question, undefined)).toEqual({ code: 'required' });
    expect(problem(question, OTHER, '  ')).toEqual({ code: 'required' });
    expect(problem(question, OTHER, 'Moj')).toBeNull();
    expect(problem({ ...question, required: false }, OTHER, '')).toEqual({ code: 'other_empty' });
  });

  it('validates numbers, emails, length, patterns and counts', () => {
    const number = { ...newQuestion('short'), validation: { kind: 'number' as const, op: 'between' as const, a: 1, b: 10, error: '' } };
    expect(problem(number, '5')).toBeNull();
    expect(problem(number, '11')).toEqual({ code: 'invalid', message: '' });
    expect(problem(number, 'pet')).toEqual({ code: 'number' });

    const email = { ...newQuestion('short'), validation: { kind: 'text' as const, op: 'email' as const, value: '', error: 'Imejl!' } };
    expect(problem(email, 'a@b.rs')).toBeNull();
    expect(problem(email, 'ab.rs')).toEqual({ code: 'invalid', message: 'Imejl!' });

    const length = { ...newQuestion('paragraph'), validation: { kind: 'length' as const, op: 'max' as const, value: 3, error: '' } };
    expect(problem(length, 'abcd')).toEqual({ code: 'too_long', max: 3 });

    const regex = { ...newQuestion('short'), validation: { kind: 'regex' as const, op: 'matches' as const, value: '[0-9]{3}', error: '' } };
    expect(problem(regex, '123')).toBeNull();
    expect(problem(regex, '1234')).toEqual({ code: 'pattern' });

    const count = { ...choice(['A', 'B', 'C']), kind: 'checkbox' as const, validation: { kind: 'count' as const, op: 'at_least' as const, value: 2, error: '' } };
    expect(problem(count, ['x'])).toEqual({ code: 'count', op: 'at_least', value: 2 });
  });

  it('checks grids row by row and column by column', () => {
    const grid = { ...newQuestion('grid'), rows: [newLine('a'), newLine('b')], columns: [newLine('x'), newLine('y')], rowRequired: true, limitPerColumn: true };
    const [a, b] = grid.rows;
    const [x, y] = grid.columns;
    expect(problem(grid, { [a.id]: x.id })).toEqual({ code: 'row_required' });
    expect(problem(grid, { [a.id]: x.id, [b.id]: x.id })).toEqual({ code: 'column_once' });
    expect(problem(grid, { [a.id]: x.id, [b.id]: y.id })).toBeNull();
  });

  it('goes where a branching answer leads, or on, or to the end', () => {
    const form = newForm('F');
    const branch = choice(['A', 'B'], { branching: true });
    const second = newSection();
    const third = newSection();
    branch.options[1].goTo = third.id;
    form.items = [branch, second, newQuestion('short'), third, newQuestion('short')];

    expect(nextSection(form, FIRST_SECTION, { [branch.id]: branch.options[0].id })).toBe(second.id);
    expect(nextSection(form, FIRST_SECTION, { [branch.id]: branch.options[1].id })).toBe(third.id);
    expect(nextSection(form, third.id, {})).toBeNull();

    second.next = SUBMIT;
    expect(nextSection(form, second.id, {})).toBeNull();
  });

  it('sends only the answers of the sections walked through', () => {
    const form = newForm('F');
    const first = newQuestion('short');
    const skipped = newSection();
    const hidden = newQuestion('short');
    form.items = [first, skipped, hidden];

    const kept = keptAnswers(form, [FIRST_SECTION], { [first.id]: 'Da', [hidden.id]: 'Ne' }, {});
    expect(kept.a).toEqual({ [first.id]: 'Da' });
    expect(responseData(form, 3, [FIRST_SECTION], { [first.id]: 'Da' }, {})).toEqual({ v: 1, form_rev: 3, a: { [first.id]: 'Da' }, other: {} });
  });

  it('reads answers as text for the table and CSV', () => {
    const question = choice(['Utorak', 'Sreda'], { other: true });
    expect(answerText(question, question.options[1].id, '', words, dates)).toBe('Sreda');
    expect(answerText(question, OTHER, 'Petak', words, dates)).toBe('Drugo: Petak');

    const boxes = { ...question, kind: 'checkbox' as const };
    expect(answerText(boxes, [question.options[0].id, OTHER], 'Petak', words, dates)).toBe('Utorak; Drugo: Petak');

    const grid = { ...newQuestion('grid'), rows: [newLine('Cena')], columns: [newLine('Malo'), newLine('Mnogo')] };
    expect(answerText(grid, { [grid.rows[0].id]: grid.columns[1].id }, '', words, dates)).toBe('Cena: Mnogo');
    expect(answerText(grid, 'garbage', '', words, dates)).toBe('');
  });
});

describe('rich text', () => {
  it('parses marks, links and lists into tokens', () => {
    expect(parseInline('**jako** i *malo* i __ispod__')).toEqual([
      { kind: 'bold', children: [{ kind: 'text', text: 'jako' }] },
      { kind: 'text', text: ' i ' },
      { kind: 'italic', children: [{ kind: 'text', text: 'malo' }] },
      { kind: 'text', text: ' i ' },
      { kind: 'underline', children: [{ kind: 'text', text: 'ispod' }] },
    ]);
    expect(parseInline('vidi [ovde](https://potok.rs) i https://x.rs.')).toEqual([
      { kind: 'text', text: 'vidi ' },
      { kind: 'link', href: 'https://potok.rs/', text: 'ovde' },
      { kind: 'text', text: ' i ' },
      { kind: 'link', href: 'https://x.rs/', text: 'https://x.rs' },
      { kind: 'text', text: '.' },
    ]);
    expect(parseRich('- a\n- b\n\n1. c')).toMatchObject([{ kind: 'list', ordered: false }, { kind: 'list', ordered: true }]);
  });

  it('makes no link of anything but the web', () => {
    expect(parseInline('[x](javascript:alert(1))')).toEqual([{ kind: 'text', text: '[x](javascript:alert(1))' }]);
  });

  it('wraps a selection and lines, and strips marks for plain text', () => {
    expect(toggleMark('ab cd', 0, 2, '**')).toEqual({ value: '**ab** cd', start: 2, end: 4 });
    expect(toggleMark('**ab** cd', 2, 4, '**')).toEqual({ value: 'ab cd', start: 0, end: 2 });
    expect(toggleList('a\nb', 0, 3, true).value).toBe('1. a\n2. b');
    expect(plainText('**Ime** i [link](https://x.rs)')).toBe('Ime i link');
  });
});

describe('CSV', () => {
  it('guards formulas and quotes what needs it', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('rekao je "da"')).toBe('"rekao je ""da"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });

  it('gives a column per question and per grid row', () => {
    const form = newForm('F');
    const question = choice(['A']);
    const grid = { ...newQuestion('grid'), title: 'Mreža', rows: [newLine('r1'), newLine('r2')], columns: [newLine('c')] };
    form.items = [question, grid];
    const options = {
      words: { ...words, time: 'Vreme', respondent: 'Ispitanik', score: 'Bodovi', anonymous: 'Anonimno' },
      showRespondent: true,
      showScore: false,
      dateText: dates,
      timeText: (iso: string) => iso,
    };

    expect(csvHeader(form, options)).toEqual(['Vreme', 'Ispitanik', 'Q', 'Mreža [r1]', 'Mreža [r2]']);
    const row = csvRow(form, { inserted_at: 't', creator_username: null, managed: null, data: { a: { [question.id]: question.options[0].id, [grid.id]: { [grid.rows[1].id]: grid.columns[0].id } } } }, options);
    expect(row).toEqual(['t', 'Anonimno', 'A', '', 'c']);
    expect(toCsv([['a', 'b']])).toBe('﻿a,b\r\n');
  });
});

describe('words', () => {
  it('chooses Serbian plural forms by the last digits', () => {
    const t = translator('sr');
    expect([1, 2, 5, 11, 21, 22, 112].map((n) => t.plural('responses', n))).toEqual([
      '1 odgovor',
      '2 odgovora',
      '5 odgovora',
      '11 odgovora',
      '21 odgovor',
      '22 odgovora',
      '112 odgovora',
    ]);
    expect(translator('en').plural('points', 1)).toBe('1 point');
  });

  it('writes Cyrillic but keeps placeholders, file kinds and the name', () => {
    expect(toCyrillic('Najviše {n} fajlova u PDF, Potok')).toBe('Највише {n} фајлова у PDF, Поток');
    expect(translator('sr-Cyrl')('submit')).toBe('Пошаљи');
  });
});
