import Constants, { ExecutionEnvironment } from 'expo-constants';

interface ExpoRuntimeInfo {
  appOwnership?: string | null;
  executionEnvironment?: string | null;
}

export function isExpoGoRuntime(
  runtime: ExpoRuntimeInfo = Constants,
): boolean {
  return (
    runtime.appOwnership === 'expo' ||
    runtime.executionEnvironment === ExecutionEnvironment.StoreClient
  );
}
