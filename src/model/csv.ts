// Responses as a CSV file, the way a spreadsheet opens it: a BOM for Excel,
// CRLF lines, one column per question and one per row of a grid. A cell that
// starts like a formula gets a quote first, as an answer is anyone's text.

import { answerText, gridRowText, readResponse, type Words } from './answers';
import { questions, type Form } from './form';
import { plainText } from './rich';

export type CsvRow = {
  inserted_at: string;
  creator_username: string | null;
  data: unknown;
  managed: { score?: number; max?: number } | null;
};

export type CsvOptions = {
  words: Words & { time: string; respondent: string; score: string; anonymous: string };
  showRespondent: boolean;
  showScore: boolean;
  dateText: (iso: string, withYear: boolean, withTime: boolean) => string;
  timeText: (iso: string) => string;
};

export function csvCell(value: string): string {
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n;]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function csvHeader(form: Form, options: CsvOptions): string[] {
  const columns = [options.words.time];
  if (options.showRespondent) columns.push(options.words.respondent);
  if (options.showScore) columns.push(options.words.score);

  questions(form).forEach((question) => {
    const title = plainText(question.title) || '—';
    if (question.kind === 'grid' || question.kind === 'checkgrid') {
      question.rows.forEach((row) => columns.push(`${title} [${row.label}]`));
    } else {
      columns.push(title);
    }
  });

  return columns;
}

export function csvRow(form: Form, row: CsvRow, options: CsvOptions): string[] {
  const { a, other } = readResponse(row.data);
  const cells = [options.timeText(row.inserted_at)];

  if (options.showRespondent) cells.push(row.creator_username ?? options.words.anonymous);
  if (options.showScore) {
    const score = row.managed?.score;
    cells.push(typeof score === 'number' ? `${score}${typeof row.managed?.max === 'number' ? ` / ${row.managed.max}` : ''}` : '');
  }

  questions(form).forEach((question) => {
    if (question.kind === 'grid' || question.kind === 'checkgrid') {
      question.rows.forEach((gridRow) => cells.push(gridRowText(question, a[question.id], gridRow.id)));
    } else {
      cells.push(answerText(question, a[question.id], other[question.id] ?? '', options.words, options.dateText));
    }
  });

  return cells;
}

export function toCsv(lines: string[][]): string {
  return `﻿${lines.map((cells) => cells.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
