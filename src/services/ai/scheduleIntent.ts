import { normalizeVietnameseText } from '../../utils/vietnameseText';

/** Detects a whole-schedule reorder without mistaking a single task edit for one. */
export function isReorderIntent(text: string): boolean {
  const normalized = normalizeVietnameseText(text).replace(/\s+/g, ' ').trim();
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
