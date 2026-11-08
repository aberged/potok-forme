// A small markup for titles and descriptions, as Google's editor offers:
// **bold**, *italic*, __underline__, links, and lists of lines that start with
// "- " or "1. ". It is parsed into tokens that the views render as text nodes,
// never as HTML, so nothing anyone writes can run in a respondent's frame.

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold' | 'italic' | 'underline'; children: Inline[] }
  | { kind: 'link'; href: string; text: string };

export type Block =
  | { kind: 'paragraph'; lines: Inline[][] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] };

const LINK = /(https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]])|(\[([^\]\n]{1,200})\]\((https?:\/\/[^\s)]+)\))/;
const MARKS: [string, 'bold' | 'underline' | 'italic'][] = [
  ['**', 'bold'],
  ['__', 'underline'],
  ['*', 'italic'],
];

/** Only web addresses are links. */
export function safeHref(href: string): string | null {
  try {
    const url = new URL(href);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

export function parseInline(source: string, depth = 0): Inline[] {
  const result: Inline[] = [];
  let rest = source;

  const pushText = (text: string) => {
    if (!text) return;
    const last = result[result.length - 1];
    if (last?.kind === 'text') last.text += text;
    else result.push({ kind: 'text', text });
  };

  while (rest.length > 0) {
    const link = LINK.exec(rest);
    const linkAt = link ? link.index : Infinity;

    let mark: { at: number; open: string; kind: 'bold' | 'underline' | 'italic'; end: number } | null = null;

    if (depth < 4) {
      for (const [open, kind] of MARKS) {
        let from = 0;
        while (from < rest.length) {
          const at = rest.indexOf(open, from);
          if (at < 0) break;
          const end = rest.indexOf(open, at + open.length + 1);
          const inner = end > 0 ? rest.slice(at + open.length, end) : '';
          if (end > 0 && inner.trim() === inner && inner !== '' && !inner.includes('\n')) {
            if (!mark || at < mark.at) mark = { at, open, kind, end };
            break;
          }
          from = at + open.length;
        }
      }
    }

    if (link && linkAt <= (mark?.at ?? Infinity)) {
      pushText(rest.slice(0, linkAt));
      const href = safeHref(link[1] ?? link[4]);
      const label = link[1] ?? link[3];
      if (href) result.push({ kind: 'link', href, text: label });
      else pushText(link[0]);
      rest = rest.slice(linkAt + link[0].length);
    } else if (mark) {
      pushText(rest.slice(0, mark.at));
      result.push({ kind: mark.kind, children: parseInline(rest.slice(mark.at + mark.open.length, mark.end), depth + 1) });
      rest = rest.slice(mark.end + mark.open.length);
    } else {
      pushText(rest);
      rest = '';
    }
  }

  return result;
}

const BULLET = /^\s*[-•*]\s+(.*)$/;
const NUMBERED = /^\s*\d{1,3}[.)]\s+(.*)$/;

export function parseRich(source: string): Block[] {
  const blocks: Block[] = [];

  source.replace(/\r\n?/g, '\n').split('\n').forEach((line) => {
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);
    const last = blocks[blocks.length - 1];

    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const item = parseInline((bullet ?? numbered)![1]);
      if (last?.kind === 'list' && last.ordered === ordered) last.items.push(item);
      else blocks.push({ kind: 'list', ordered, items: [item] });
    } else if (line.trim() === '') {
      blocks.push({ kind: 'paragraph', lines: [] });
    } else if (last?.kind === 'paragraph' && last.lines.length > 0) {
      last.lines.push(parseInline(line));
    } else {
      blocks.push({ kind: 'paragraph', lines: [parseInline(line)] });
    }
  });

  return blocks.filter((block) => block.kind === 'list' || block.lines.length > 0);
}

/** The text without its markup, for a table cell or a page title. */
export function plainText(source: string): string {
  const flat = (inlines: Inline[]): string =>
    inlines.map((inline) => (inline.kind === 'text' || inline.kind === 'link' ? inline.text : flat(inline.children))).join('');

  return parseRich(source)
    .map((block) => (block.kind === 'list' ? block.items.map(flat).join(', ') : block.lines.map(flat).join(' ')))
    .join(' ')
    .trim();
}

/** Wraps the selection of a textarea in a mark, or removes it. */
export function toggleMark(value: string, start: number, end: number, mark: string): { value: string; start: number; end: number } {
  const before = value.slice(0, start);
  const chosen = value.slice(start, end);
  const after = value.slice(end);

  if (before.endsWith(mark) && after.startsWith(mark)) {
    return { value: before.slice(0, -mark.length) + chosen + after.slice(mark.length), start: start - mark.length, end: end - mark.length };
  }

  return { value: before + mark + chosen + mark + after, start: start + mark.length, end: end + mark.length };
}

/** Turns the selected lines into a list, or back into plain lines. */
export function toggleList(value: string, start: number, end: number, ordered: boolean): { value: string; start: number; end: number } {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = value.indexOf('\n', end) < 0 ? value.length : value.indexOf('\n', end);
  const lines = value.slice(lineStart, lineEnd).split('\n');
  const pattern = ordered ? NUMBERED : BULLET;
  const listed = lines.every((line) => pattern.test(line));
  const changed = lines
    .map((line, index) => (listed ? line.replace(/^\s*([-•*]|\d{1,3}[.)])\s+/, '') : `${ordered ? `${index + 1}.` : '-'} ${line}`))
    .join('\n');

  return { value: value.slice(0, lineStart) + changed + value.slice(lineEnd), start: lineStart, end: lineStart + changed.length };
}
