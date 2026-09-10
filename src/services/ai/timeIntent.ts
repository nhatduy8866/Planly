export interface ParsedScheduleTime {
  startTime: string;
  matchedText: string;
}

const TIME_PATTERN =
  /(?:(?:(buổi|buoi)\s+)?(sáng|sang|trưa|trua|chiều|chieu|tối|toi)\s*)?(?:(?:vào|vao)\s+(?:lúc|luc)|(?:lúc|luc)|sang|thành|thanh)?\s*(\d{1,2})(?:h(?:(\d{1,2}))?|:(\d{2}))(?:\s*(?:(buổi|buoi)\s+)?(sáng|sang|trưa|trua|chiều|chieu|tối|toi))?/gi;

function normalizePeriod(
  rawPeriod: string | undefined,
  hasExplicitBuoi: boolean,
  isBeforeTime: boolean,
): 'chieu' | 'sang' | 'toi' | 'trua' | '' {
  if (!rawPeriod) return '';
  const normalized = rawPeriod
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (normalized !== 'toi') return normalized as 'chieu' | 'sang' | 'trua';

  // "toi" after an hour is commonly the pronoun "tôi" with omitted accents
  // ("2h toi da bong"). Require a clearer cue before treating it as evening.
  if (rawPeriod.toLowerCase() === 'tối' || hasExplicitBuoi || isBeforeTime) {
    return 'toi';
  }
  return '';
}

export function parseVietnameseTime(
  text: string,
  preferLast = false,
): ParsedScheduleTime | null {
  const matches = Array.from(text.matchAll(TIME_PATTERN));
  const parsedMatches: ParsedScheduleTime[] = [];

  for (const match of matches) {
    let hours = Number(match[3]);
    const minutes = Number(match[4] || match[5] || 0);
    const prefixPeriod = normalizePeriod(match[2], Boolean(match[1]), true);
    const suffixPeriod = normalizePeriod(match[7], Boolean(match[6]), false);
    const period = prefixPeriod || suffixPeriod;
    let matchedText = match[0].trim();
    if (match[7] && !suffixPeriod) {
      matchedText = matchedText.replace(/\s+toi$/i, '').trim();
    }

    if (hours > 23 || minutes > 59) continue;
    if ((period === 'chieu' || period === 'toi') && hours < 12) {
      hours += 12;
    } else if (period === 'sang' && hours === 12) {
      hours = 0;
    }

    parsedMatches.push({
      startTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      matchedText,
    });
  }

  if (!parsedMatches.length) return null;
  return preferLast ? parsedMatches[parsedMatches.length - 1] : parsedMatches[0];
}
