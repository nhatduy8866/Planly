function readPublicValue(value: string | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized || normalized.startsWith('your_')) return null;
  return normalized;
}

function readHttpsUrl(value: string | undefined): string | null {
  const normalized = readPublicValue(value);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export const legalConfig = {
  accountDeletionUrl: readHttpsUrl(
    process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL,
  ),
  dataControllerName: readPublicValue(
    process.env.EXPO_PUBLIC_DATA_CONTROLLER_NAME,
  ),
  privacyContactEmail: readPublicValue(
    process.env.EXPO_PUBLIC_PRIVACY_CONTACT_EMAIL,
  ),
  privacyPolicyUrl: readHttpsUrl(
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
  ),
} as const;
