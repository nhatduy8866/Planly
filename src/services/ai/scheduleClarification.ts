export class AiScheduleClarificationError extends Error {
  readonly code = 'ambiguous_unaccented_time';
  readonly hour: number;

  constructor(hour: number) {
    super('AI_SCHEDULE_CLARIFICATION_REQUIRED');
    this.name = 'AiScheduleClarificationError';
    this.hour = hour;
  }
}

/** Detects the ambiguous no-accent form in phrases such as "2h toi da bong". */
export function findScheduleClarification(
  prompt: string,
): AiScheduleClarificationError | null {
  const match = prompt.match(/\b(\d{1,2})h(?:\d{1,2})?\s+toi\s+[a-zà-ỹđ]/i);
  if (!match) return null;
  // A terminal period followed only by a courtesy word is not a pronoun.
  if (/\b\d{1,2}h(?:\d{1,2})?\s+toi\s+(?:nhe|nhé|nha)[.!?]*\s*$/i.test(prompt)) {
    return null;
  }

  const hour = Number(match[1]);
  return hour >= 0 && hour <= 12
    ? new AiScheduleClarificationError(hour)
    : null;
}
