import type { Language } from '../data/content';

export function localizeQuotes(text: string, language: Language, wrap = false): string {
  const [opening, closing] = language === 'fr'
    ? ['«\u00a0', '\u00a0»']
    : ['“', '”'];
  const parts = text.split(/(["“”«»])/);
  const openMarks: string[] = [];

  for (let index = 1; index < parts.length; index += 2) {
    const mark = parts[index];
    const closesQuote = mark === '”' || mark === '»' ||
      (mark === '"' && openMarks[openMarks.length - 1] === '"');

    if (closesQuote) {
      openMarks.pop();
      parts[index - 1] = parts[index - 1].trimEnd();
      parts[index] = closing;
    } else {
      openMarks.push(mark);
      parts[index] = opening;
      parts[index + 1] = parts[index + 1].trimStart();
    }
  }

  const localized = parts.join('');
  return wrap ? opening + localized + closing : localized;
}
