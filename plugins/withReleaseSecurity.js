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
    def planlyReleaseSigning = [
        storeFile: planlyReleaseValue('PLANLY_UPLOAD_STORE_FILE'),
        storePassword: planlyReleaseValue('PLANLY_UPLOAD_STORE_PASSWORD'),
        keyAlias: planlyReleaseValue('PLANLY_UPLOAD_KEY_ALIAS'),
        keyPassword: planlyReleaseValue('PLANLY_UPLOAD_KEY_PASSWORD'),
    ]
    def planlyRequiredLegalConfig = [
        dataController: planlyReleaseValue('EXPO_PUBLIC_DATA_CONTROLLER_NAME'),
        privacyContact: planlyReleaseValue('EXPO_PUBLIC_PRIVACY_CONTACT_EMAIL'),
        privacyPolicyUrl: planlyReleaseValue('EXPO_PUBLIC_PRIVACY_POLICY_URL'),
        accountDeletionUrl: planlyReleaseValue('EXPO_PUBLIC_ACCOUNT_DELETION_URL'),
    ]
    def planlyReleaseRequested = gradle.startParameter.taskNames.any {
        it.toLowerCase().contains('release')
    }
    if (planlyReleaseRequested) {
        def missingSigning = planlyReleaseSigning.findAll { !it.value }.keySet()
        def missingLegal = planlyRequiredLegalConfig.findAll { !it.value }.keySet()
        def invalidLegal = []
        if (planlyRequiredLegalConfig.privacyContact &&
            !planlyRequiredLegalConfig.privacyContact.contains('@')) {
            invalidLegal.add('privacyContact')
        }
        if (planlyRequiredLegalConfig.privacyPolicyUrl &&
            !planlyRequiredLegalConfig.privacyPolicyUrl.startsWith('https://')) {
            invalidLegal.add('privacyPolicyUrl')
        }
        if (planlyRequiredLegalConfig.accountDeletionUrl &&
            !planlyRequiredLegalConfig.accountDeletionUrl.startsWith('https://')) {
            invalidLegal.add('accountDeletionUrl')
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
    `${releaseSigningBlock}${signingMarker}${releaseSigningConfig}`,
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
  '1.0.0',
);

module.exports.configureReleaseSigning = configureReleaseSigning;
