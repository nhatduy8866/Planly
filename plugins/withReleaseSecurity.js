const {
  AndroidConfig,
  createRunOncePlugin,
  PluginError,
  withAndroidManifest,
  withAppBuildGradle,
} = require('expo/config-plugins');

const pluginName = 'planly-release-security';

const releaseSigningBlock = `
    def planlyReleaseValue = { String name ->
        providers.gradleProperty(name)
            .orElse(providers.environmentVariable(name))
            .getOrNull()
    }
    def planlyReleaseEnvironmentValue = { String name ->
        def value = providers.environmentVariable(name).getOrNull()
        value = value == null ? null : value.trim()
        !value || value.startsWith('your_') ? null : value
    }
    def planlyReleaseSigning = [
        storeFile: planlyReleaseValue('PLANLY_UPLOAD_STORE_FILE'),
        storePassword: planlyReleaseValue('PLANLY_UPLOAD_STORE_PASSWORD'),
        keyAlias: planlyReleaseValue('PLANLY_UPLOAD_KEY_ALIAS'),
        keyPassword: planlyReleaseValue('PLANLY_UPLOAD_KEY_PASSWORD'),
    ]
    def planlyInternalRelease = 'true'.equalsIgnoreCase(
        planlyReleaseValue('PLANLY_INTERNAL_RELEASE')?.trim()
    )
    def planlyRequiredLegalConfig = [
        dataController: planlyReleaseEnvironmentValue('EXPO_PUBLIC_DATA_CONTROLLER_NAME'),
        privacyContact: planlyReleaseEnvironmentValue('EXPO_PUBLIC_PRIVACY_CONTACT_EMAIL'),
        privacyPolicyUrl: planlyReleaseEnvironmentValue('EXPO_PUBLIC_PRIVACY_POLICY_URL'),
        accountDeletionUrl: planlyReleaseEnvironmentValue('EXPO_PUBLIC_ACCOUNT_DELETION_URL'),
    ]
    def planlyValidHttpsUrl = { String value ->
        if (!value) return false
        try {
            def uri = new java.net.URI(value)
            def host = uri.host == null ? null : uri.host.toLowerCase()
            if (host?.endsWith('.')) {
                host = host.substring(0, host.length() - 1)
            }
            def reservedHost = host == 'localhost' || host?.endsWith('.localhost') ||
                host == 'example.com' || host?.endsWith('.example.com') ||
                host == 'example' || host?.endsWith('.example') ||
                host == 'invalid' || host?.endsWith('.invalid') ||
                host == 'test' || host?.endsWith('.test')
            return uri.scheme?.equalsIgnoreCase('https') && host && !reservedHost
        } catch (Exception ignored) {
            return false
        }
    }
    def planlyValidEmail = { String value ->
        if (!value || value.length() > 254) return false
        def parts = value.split('@', -1)
        if (parts.length != 2) return false
        def localPart = parts[0]
        def labels = parts[1].split('[.]', -1)
        if (!localPart || localPart.length() > 64 ||
            localPart.startsWith('.') || localPart.endsWith('.') ||
            localPart.contains('..') ||
            !(localPart ==~ '^[A-Za-z0-9._+-]+$') ||
            labels.length < 2) return false
        return labels.every {
            it ==~ '^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$'
        }
    }
    def planlyReleaseRequested = gradle.startParameter.taskNames.any {
        it.toLowerCase().contains('release')
    }
    if (planlyReleaseRequested) {
        def missingSigning = planlyReleaseSigning.findAll { !it.value }.keySet()
        def missingLegal = planlyInternalRelease
            ? []
            : planlyRequiredLegalConfig.findAll { !it.value }.keySet()
        def invalidLegal = []
        if (!planlyInternalRelease) {
            if (planlyRequiredLegalConfig.privacyContact &&
                !planlyValidEmail(planlyRequiredLegalConfig.privacyContact)) {
                invalidLegal.add('privacyContact')
            }
            if (planlyRequiredLegalConfig.privacyPolicyUrl &&
                !planlyValidHttpsUrl(planlyRequiredLegalConfig.privacyPolicyUrl)) {
                invalidLegal.add('privacyPolicyUrl')
            }
            if (planlyRequiredLegalConfig.accountDeletionUrl &&
                !planlyValidHttpsUrl(planlyRequiredLegalConfig.accountDeletionUrl)) {
                invalidLegal.add('accountDeletionUrl')
            }
        }
        if (!missingSigning.isEmpty() || !missingLegal.isEmpty() ||
            !invalidLegal.isEmpty()) {
            throw new GradleException(
                "Planly release configuration is incomplete. Missing signing: " +
                missingSigning.join(', ') + "; missing legal: " +
                missingLegal.join(', ') + "; invalid legal: " +
                invalidLegal.join(', ')
            )
        }
    }
`;

const releaseSigningConfig = `
        release {
            if (planlyReleaseSigning.values().every { it }) {
                storeFile file(planlyReleaseSigning.storeFile)
                storePassword planlyReleaseSigning.storePassword
                keyAlias planlyReleaseSigning.keyAlias
                keyPassword planlyReleaseSigning.keyPassword
            }
        }
`;

function configureReleaseSigning(contents) {
  if (contents.includes('def planlyReleaseSigning = [')) return contents;

  const generatedDebugSigning = `            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug`;
  if (!contents.includes(generatedDebugSigning)) {
    throw new PluginError(
      'Could not replace the generated debug signing configuration for release.',
      pluginName,
    );
  }

  const signingMarker = '    signingConfigs {\n';
  if (!contents.includes(signingMarker)) {
    throw new PluginError(
      'Could not locate signingConfigs in android/app/build.gradle.',
      pluginName,
    );
  }

  const safeReleaseBuild = contents.replace(
    generatedDebugSigning,
    '            signingConfig signingConfigs.release',
  );
  return safeReleaseBuild.replace(
    signingMarker,
    () => `${releaseSigningBlock}${signingMarker}${releaseSigningConfig}`,
  );
}

function withReleaseSecurity(config) {
  config = withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults;
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      manifest,
    );
    application.$['android:allowBackup'] = 'false';

    const blockedPermissions = new Set([
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.SCHEDULE_EXACT_ALARM',
      'android.permission.SYSTEM_ALERT_WINDOW',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ]);
    AndroidConfig.Permissions.addBlockedPermissions(
      manifest,
      Array.from(blockedPermissions),
    );
    return modConfig;
  });

  return withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== 'groovy') {
      throw new PluginError(
        'Planly release signing currently supports Groovy build.gradle only.',
        pluginName,
      );
    }
    modConfig.modResults.contents = configureReleaseSigning(
      modConfig.modResults.contents,
    );
    return modConfig;
  });
}

module.exports = createRunOncePlugin(
  withReleaseSecurity,
  pluginName,
  '1.0.3',
);

module.exports.configureReleaseSigning = configureReleaseSigning;
