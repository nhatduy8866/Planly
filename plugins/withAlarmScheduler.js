const {
  AndroidConfig,
  createRunOncePlugin,
  IOSConfig,
  PluginError,
  withAndroidManifest,
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

const alarmSchedulerPackage = require('react-native-alarm-scheduler/package.json');
const alarmSchedulerRoot = path.dirname(
  require.resolve('react-native-alarm-scheduler/package.json'),
);
const silentSoundPath = path.join(
  alarmSchedulerRoot,
  'assets',
  'alarm-scheduler-silence.caf',
);

function normalizeIosAlarmSounds(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new PluginError(
      'iosAlarmSounds must be an array of file paths.',
      alarmSchedulerPackage.name,
    );
  }
  return value;
}

function withAlarmScheduler(config, props = {}) {
  const alarmKitUsageDescription =
    props.alarmKitUsageDescription ||
    'Allow this app to schedule alarms that can alert you at the selected time.';
  const addExactAlarmPermission = props.addExactAlarmPermission !== false;
  const addNotificationPermission = props.addNotificationPermission !== false;
  const addUseExactAlarmPermission = props.addUseExactAlarmPermission !== false;
  const iosAlarmSounds = normalizeIosAlarmSounds(props.iosAlarmSounds);

  config = withAndroidManifest(config, (modConfig) => {
    const manifest = modConfig.modResults;
    if (addExactAlarmPermission) {
      AndroidConfig.Permissions.addPermission(
        manifest,
        'android.permission.SCHEDULE_EXACT_ALARM',
      );
    }
    if (addUseExactAlarmPermission) {
      AndroidConfig.Permissions.addPermission(
        manifest,
        'android.permission.USE_EXACT_ALARM',
      );
    }
    AndroidConfig.Permissions.addPermission(
      manifest,
      'android.permission.USE_FULL_SCREEN_INTENT',
    );
    AndroidConfig.Permissions.addPermission(
      manifest,
      'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
    );
    AndroidConfig.Permissions.addPermission(
      manifest,
      'android.permission.WAKE_LOCK',
    );
    if (addNotificationPermission) {
      AndroidConfig.Permissions.addPermission(
        manifest,
        'android.permission.POST_NOTIFICATIONS',
      );
    }
    AndroidConfig.Permissions.addPermission(
      manifest,
      'com.android.alarm.permission.SET_ALARM',
    );
    try {
      const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(manifest);
      mainActivity.$['android:showWhenLocked'] = 'true';
      mainActivity.$['android:turnScreenOn'] = 'true';
    } catch {
      // ignore if main activity not resolved
    }
    return modConfig;
  });

  config = withInfoPlist(config, (modConfig) => {
    modConfig.modResults.NSAlarmKitUsageDescription = alarmKitUsageDescription;
    modConfig.modResults.NSSupportsLiveActivities = true;
    return modConfig;
  });

  config = withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const projectRoot = modConfig.modRequest.projectRoot;
    const platformProjectRoot = modConfig.modRequest.platformProjectRoot;
    IOSConfig.XcodeUtils.ensureGroupRecursively(project, 'Resources');
    const sounds = [
      { absolutePath: silentSoundPath, label: 'bundled silent alarm sound' },
      ...iosAlarmSounds.map((sound) => ({
        absolutePath: path.resolve(projectRoot, sound),
        label: sound,
      })),
    ];

    sounds.forEach(({ absolutePath, label }) => {
      if (!fs.existsSync(absolutePath)) {
        throw new PluginError(
          `Alarm sound file does not exist: ${label}`,
          alarmSchedulerPackage.name,
        );
      }
      IOSConfig.XcodeUtils.addResourceFileToGroup({
        filepath: path.relative(platformProjectRoot, absolutePath),
        groupName: 'Resources',
        isBuildFile: true,
        project,
        verbose: true,
      });
    });
    return modConfig;
  });

  return config;
}

module.exports = createRunOncePlugin(
  withAlarmScheduler,
  `${alarmSchedulerPackage.name}-planly`,
  alarmSchedulerPackage.version,
);
