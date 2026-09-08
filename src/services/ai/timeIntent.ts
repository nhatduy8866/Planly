export interface ParsedScheduleTime {
  startTime: string;
  matchedText: string;
}

const TIME_PATTERN =
  /(?:(sáng|trưa|chiều|tối)\s*)?(?:(?:vào\s+)?lúc|sang|thành)?\s*(\d{1,2})(?:h(?:(\d{1,2}))?|:(\d{2}))(?:\s*(sáng|trưa|chiều|tối))?/gi;

export function parseVietnameseTime(
  text: string,
  preferLast = false,
): ParsedScheduleTime | null {
  const matches = Array.from(text.matchAll(TIME_PATTERN));
  const parsedMatches: ParsedScheduleTime[] = [];

  for (const match of matches) {
    let hours = Number(match[2]);
    const minutes = Number(match[3] || match[4] || 0);
    const period = (match[1] || match[5] || '').toLowerCase();

    if (hours > 23 || minutes > 59) continue;
    if ((period === 'chiều' || period === 'tối') && hours < 12) {
      hours += 12;
    } else if (period === 'sáng' && hours === 12) {
      hours = 0;
    }

    parsedMatches.push({
      startTime: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
      matchedText: match[0].trim(),
    });
  }

  if (!parsedMatches.length) return null;
  return preferLast ? parsedMatches[parsedMatches.length - 1] : parsedMatches[0];
}
