function readPublicValue(value: string | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized || normalized.startsWith('your_')) return null;
  return normalized;
}

function isReservedLegalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === 'example.com' ||
    normalized.endsWith('.example.com') ||
    normalized === 'example' ||
    normalized.endsWith('.example') ||
    normalized === 'invalid' ||
    normalized.endsWith('.invalid') ||
    normalized === 'test' ||
    normalized.endsWith('.test');
}

function readHttpsUrl(value: string | undefined): string | null {
  const normalized = readPublicValue(value);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    return url.protocol === 'https:' &&
      Boolean(url.hostname) &&
      !isReservedLegalHostname(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function readEmail(value: string | undefined): string | null {
  const normalized = readPublicValue(value);
  if (!normalized || normalized.length > 254) return null;
  const parts = normalized.split('@');
  if (parts.length !== 2) return null;
  const [localPart, domain] = parts;
  if (
    !localPart ||
    localPart.length > 64 ||
    localPart.startsWith('.') ||
    localPart.endsWith('.') ||
    localPart.includes('..') ||
    !/^[A-Za-z0-9._+-]+$/.test(localPart)
  ) return null;
  const labels = domain.split('.');
  if (
    labels.length < 2 ||
    labels.some(
      (label) => !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label),
    )
  ) return null;
  return normalized;
}

export const legalConfig = {
  accountDeletionUrl: readHttpsUrl(
    process.env.EXPO_PUBLIC_ACCOUNT_DELETION_URL,
  ),
  dataControllerName: readPublicValue(
    process.env.EXPO_PUBLIC_DATA_CONTROLLER_NAME,
  ),
  privacyContactEmail: readEmail(
    process.env.EXPO_PUBLIC_PRIVACY_CONTACT_EMAIL,
  ),
  privacyPolicyUrl: readHttpsUrl(
    process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL,
  ),
} as const;
