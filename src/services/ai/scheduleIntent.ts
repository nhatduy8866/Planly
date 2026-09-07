function normalizeVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Detects a whole-schedule reorder without mistaking a single task edit for one. */
export function isReorderIntent(text: string): boolean {
  const normalized = normalizeVietnamese(text);
  if (!normalized) return false;

  if (/^(?:hay |giup (?:toi|minh) )?(?:(?:sap xep|xep|tai sap xep|phan bo)(?: lai)?|sap lai|toi uu)[.!?]?$/.test(normalized)) {
    return true;
  }

  const hasReorderAction =
    /(?:sap xep|xep|tai sap xep|phan bo)(?: lai)?|sap lai|toi uu|dieu chinh lai|len lai/.test(
      normalized,
    );
  const hasScheduleScope =
    /(?:lich(?: trinh)?|thoi gian bieu|ke hoach|cac cong viec|cong viec trong ngay|cac viec|ca ngay)/.test(
      normalized,
    );
  const hasWholeScheduleQualifier =
    /(?:theo thu tu|theo uu tien|tranh trung|toan bo|ca ngay)/.test(normalized);

  return hasReorderAction && (hasScheduleScope || hasWholeScheduleQualifier);
}
