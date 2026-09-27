import { afterEach, describe, expect, it, jest } from '@jest/globals';

const LEGAL_ENV_KEYS = [
  'EXPO_PUBLIC_ACCOUNT_DELETION_URL',
  'EXPO_PUBLIC_DATA_CONTROLLER_NAME',
  'EXPO_PUBLIC_PRIVACY_CONTACT_EMAIL',
  'EXPO_PUBLIC_PRIVACY_POLICY_URL',
] as const;

const originalValues = Object.fromEntries(
  LEGAL_ENV_KEYS.map((key) => [key, process.env[key]]),
);

function loadLegalConfig(values: Partial<Record<(typeof LEGAL_ENV_KEYS)[number], string>>) {
  for (const key of LEGAL_ENV_KEYS) delete process.env[key];
  Object.assign(process.env, values);
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return (require('./legal') as typeof import('./legal')).legalConfig;
}

describe('release legal configuration', () => {
  afterEach(() => {
    for (const key of LEGAL_ENV_KEYS) {
      const original = originalValues[key];
      if (original === undefined) delete process.env[key];
      else process.env[key] = original;
    }
    jest.resetModules();
  });

  it('accepts concrete HTTPS legal URLs and a valid contact email', () => {
    expect(loadLegalConfig({
      EXPO_PUBLIC_ACCOUNT_DELETION_URL: 'https://planly.vn/delete-account',
      EXPO_PUBLIC_DATA_CONTROLLER_NAME: 'Planly Vietnam',
      EXPO_PUBLIC_PRIVACY_CONTACT_EMAIL: 'privacy@planly.vn',
      EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://planly.vn/privacy',
    })).toEqual({
      accountDeletionUrl: 'https://planly.vn/delete-account',
      dataControllerName: 'Planly Vietnam',
      privacyContactEmail: 'privacy@planly.vn',
      privacyPolicyUrl: 'https://planly.vn/privacy',
    });
  });

  it('rejects placeholders, malformed emails, and non-HTTPS URLs', () => {
    expect(loadLegalConfig({
      EXPO_PUBLIC_ACCOUNT_DELETION_URL: 'https://docs.example.com/delete',
      EXPO_PUBLIC_DATA_CONTROLLER_NAME: 'your_company',
      EXPO_PUBLIC_PRIVACY_CONTACT_EMAIL: 'privacy-at-planly.vn',
      EXPO_PUBLIC_PRIVACY_POLICY_URL: 'http://planly.vn/privacy',
    })).toEqual({
      accountDeletionUrl: null,
      dataControllerName: null,
      privacyContactEmail: null,
      privacyPolicyUrl: null,
    });
  });

  it('rejects reserved example hosts and structurally invalid emails', () => {
    expect(loadLegalConfig({
      EXPO_PUBLIC_ACCOUNT_DELETION_URL: 'https://your-domain.example/delete',
      EXPO_PUBLIC_DATA_CONTROLLER_NAME: 'your_company',
      EXPO_PUBLIC_PRIVACY_CONTACT_EMAIL: 'a@b..com',
      EXPO_PUBLIC_PRIVACY_POLICY_URL: 'https://localhost/privacy',
    })).toEqual({
      accountDeletionUrl: null,
      dataControllerName: null,
      privacyContactEmail: null,
      privacyPolicyUrl: null,
    });
  });
});
