// Short random ids for questions, options and sections. They stay when a label
// changes, so the answers already given and the counts keep pointing at them.

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

export function newId(length = 8): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join('');
}
