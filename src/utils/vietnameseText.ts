function foldCharacter(character: string): string {
  return character
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

export function normalizeVietnameseText(value: string): string {
  return Array.from(value, foldCharacter).join('');
}

export function isVietnameseTaskAttributeClause(value: string): boolean {
  return /^(?:va\s+)?(?:(?:muc\s+)?uu\s+tien|thoi\s+luong|keo\s+dai|(?:nhac|bao)\s+(?:(?:cho\s+)?(?:toi|minh|em)\s+)?(?:truoc|dung\s+(?:gio|hen)|khi\s+den\s+gio))\b/.test(
    normalizeVietnameseText(value).trim(),
  );
}

/**
 * Applies a regular expression to an accent-free copy while returning text
 * from the original input. This lets intent parsing accept both Vietnamese
 * forms without removing accents from task titles.
 */
export function replaceVietnameseMatches(
  value: string,
  pattern: RegExp,
  replacement = ' ',
): string {
  let normalized = '';
  const sourceRanges: { end: number; start: number }[] = [];

  for (let index = 0; index < value.length; ) {
    const codePoint = value.codePointAt(index);
    if (codePoint === undefined) break;
    const character = String.fromCodePoint(codePoint);
    const end = index + character.length;
    const folded = foldCharacter(character);
    normalized += folded;
    for (let foldedIndex = 0; foldedIndex < folded.length; foldedIndex += 1) {
      sourceRanges.push({ start: index, end });
    }
    index = end;
  }

  const flags = pattern.flags.includes('g')
    ? pattern.flags
    : `${pattern.flags}g`;
  const matcher = new RegExp(pattern.source, flags.replace('i', ''));
  const matches = Array.from(normalized.matchAll(matcher)).filter(
    (match) => match[0].length > 0 && match.index !== undefined,
  );
  if (!matches.length) return value;

  let output = '';
  let cursor = 0;
  for (const match of matches) {
    const normalizedStart = match.index!;
    const normalizedEnd = normalizedStart + match[0].length - 1;
    const sourceStart = sourceRanges[normalizedStart]?.start;
    const sourceEnd = sourceRanges[normalizedEnd]?.end;
    if (sourceStart === undefined || sourceEnd === undefined || sourceStart < cursor) {
      continue;
    }
    output += value.slice(cursor, sourceStart);
    output += replacement;
    cursor = sourceEnd;
  }
  return output + value.slice(cursor);
}
