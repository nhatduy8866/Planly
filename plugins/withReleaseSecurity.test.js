const { describe, expect, it, jest } = require('@jest/globals');

jest.mock('expo/config-plugins', () => ({
  AndroidConfig: {},
  createRunOncePlugin: (plugin) => plugin,
  PluginError: Error,
  withAndroidManifest: jest.fn(),
  withAppBuildGradle: jest.fn(),
}));

const { configureReleaseSigning } = require('./withReleaseSecurity');

const generatedBuildGradle = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}`;

describe('withReleaseSecurity', () => {
  it('keeps debug signing for debug and requires a dedicated release key', () => {
    const result = configureReleaseSigning(generatedBuildGradle);

    expect(result).toContain('signingConfig signingConfigs.release');
    expect(result).toContain('storeFile file(planlyReleaseSigning.storeFile)');
    expect(result).toContain("contains('release')");
    expect(result).toContain(
      "planlyReleaseEnvironmentValue('EXPO_PUBLIC_PRIVACY_POLICY_URL')",
    );
    expect(result).toContain("new java.net.URI(value)");
    expect(result).toContain("uri.scheme?.equalsIgnoreCase('https')");
    expect(result).toContain("host?.endsWith('.example')");
    expect(result).toContain("value.startsWith('your_')");
    expect(result).toContain('def planlyValidEmail');
    expect(result).toContain("parts[1].split('[.]', -1)");
    expect(result).toContain("localPart ==~ '^[A-Za-z0-9._+-]+$'");
    expect(result.match(/signingConfig signingConfigs\.debug/g)).toHaveLength(1);
  });

  it('is idempotent', () => {
    const once = configureReleaseSigning(generatedBuildGradle);
    expect(configureReleaseSigning(once)).toBe(once);
  });

  it('fails when the generated Gradle shape is unknown', () => {
    expect(() => configureReleaseSigning('android {}')).toThrow(
      'Could not replace the generated debug signing configuration',
    );
  });
});
