import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '../auth/AuthContext';
import { usePreferences } from '../preferences/PreferencesContext';
import { useCloudSync, type CloudSyncStatus } from '../sync/CloudSyncContext';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';
import { IconButton } from './IconButton';

interface AccountSyncModalProps {
  onClose: () => void;
  visible: boolean;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function AccountSyncModal({
  onClose,
  visible,
}: AccountSyncModalProps) {
  const insets = useSafeAreaInsets();
  const { configured, hydrated, signIn, signOut, signUp, user } = useAuth();
  const { lastSyncedAt, pendingCount, status, syncNow } = useCloudSync();
  const { colors, locale, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'signIn' | 'signUp' | 'signOut' | null>(
    null,
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastSyncLabel = useMemo(() => {
    if (!lastSyncedAt) return null;
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(lastSyncedAt));
  }, [lastSyncedAt, locale]);

  const statusKey: Record<CloudSyncStatus, Parameters<typeof t>[0]> = {
    disabled: 'sync.statusDisabled',
    error: 'sync.statusError',
    pending: 'sync.statusPending',
    signedOut: 'sync.statusSignedOut',
    synced: 'sync.statusSynced',
    syncing: 'sync.statusSyncing',
  };

  function validateCredentials(): boolean {
    if (!email.trim() || password.length < 6) {
      setError(t('sync.credentialsInvalid'));
      return false;
    }
    return true;
  }

  async function handleSignIn() {
    if (!validateCredentials() || busy) return;
    setBusy('signIn');
    setError(null);
    setFeedback(null);
    try {
      await signIn(email.trim(), password);
      setPassword('');
    } catch (signInError) {
      setError(errorMessage(signInError));
    } finally {
      setBusy(null);
    }
  }

  async function handleSignUp() {
    if (!validateCredentials() || busy) return;
    setBusy('signUp');
    setError(null);
    setFeedback(null);
    try {
      const result = await signUp(email.trim(), password);
      setPassword('');
      if (result.needsEmailConfirmation) {
        setFeedback(t('sync.confirmEmail'));
      }
    } catch (signUpError) {
      setError(errorMessage(signUpError));
    } finally {
      setBusy(null);
    }
  }

  async function handleSignOut() {
    if (busy) return;
    setBusy('signOut');
    setError(null);
    try {
      await signOut();
      setEmail('');
      setPassword('');
    } catch (signOutError) {
      setError(errorMessage(signOutError));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent={Platform.OS === 'web'}
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View
            style={[
              styles.header,
              { paddingTop: Platform.OS === 'web' ? 18 : insets.top + 12 },
            ]}
          >
            <View style={styles.headerIcon}>
              <MaterialIcons
                color={colors.primaryDark}
                name="cloud-sync"
                size={24}
              />
            </View>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{t('sync.title')}</Text>
              <Text style={styles.subtitle}>{t('sync.subtitle')}</Text>
            </View>
            <IconButton
              accessibilityLabel={t('common.close')}
              backgroundColor={colors.surfaceMuted}
              icon="close"
              onPress={onClose}
            />
          </View>

          <ScrollView
            contentContainerStyle={[
              styles.content,
              { paddingBottom: Math.max(insets.bottom, 24) },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {!configured ? (
              <View style={styles.notice}>
                <MaterialIcons
                  color={colors.textMuted}
                  name="cloud-off"
                  size={24}
                />
                <Text style={styles.noticeTitle}>{t('sync.notConfigured')}</Text>
                <Text style={styles.noticeText}>
                  {t('sync.notConfiguredDescription')}
                </Text>
              </View>
            ) : !hydrated ? (
              <ActivityIndicator color={colors.primary} size="large" />
            ) : user ? (
              <>
                <View style={styles.accountCard}>
                  <MaterialIcons
                    color={colors.primaryDark}
                    name="account-circle"
                    size={38}
                  />
                  <View style={styles.accountCopy}>
                    <Text style={styles.accountLabel}>{t('sync.account')}</Text>
                    <Text style={styles.accountEmail}>{user.email}</Text>
                  </View>
                </View>

                <View style={styles.statusCard}>
                  <View style={styles.statusRow}>
                    <Text style={styles.statusLabel}>{t('sync.syncStatus')}</Text>
                    <Text style={styles.statusValue}>{t(statusKey[status])}</Text>
                  </View>
                  {pendingCount > 0 ? (
                    <Text style={styles.statusHint}>
                      {t('sync.pendingCount', { count: pendingCount })}
                    </Text>
                  ) : null}
                  {lastSyncLabel ? (
                    <Text style={styles.statusHint}>
                      {t('sync.lastSynced', { date: lastSyncLabel })}
                    </Text>
                  ) : null}
                </View>

                <Pressable
                  accessibilityLabel={t('sync.syncNow')}
                  accessibilityRole="button"
                  disabled={status === 'syncing'}
                  onPress={() => void syncNow()}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    status === 'syncing' && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {status === 'syncing' ? (
                    <ActivityIndicator color={colors.white} size="small" />
                  ) : (
                    <MaterialIcons color={colors.white} name="sync" size={20} />
                  )}
                  <Text style={styles.primaryButtonText}>
                    {t('sync.syncNow')}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityLabel={t('sync.signOut')}
                  accessibilityRole="button"
                  disabled={busy !== null}
                  onPress={() => void handleSignOut()}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>
                    {busy === 'signOut' ? t('sync.signingOut') : t('sync.signOut')}
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.notice}>
                  <MaterialIcons
                    color={colors.primaryDark}
                    name="cloud-upload"
                    size={28}
                  />
                  <Text style={styles.noticeTitle}>{t('sync.signedOutTitle')}</Text>
                  <Text style={styles.noticeText}>
                    {t('sync.signedOutDescription')}
                  </Text>
                </View>

                <TextInput
                  autoCapitalize="none"
                  autoComplete="email"
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder={t('sync.email')}
                  placeholderTextColor={colors.placeholder}
                  style={styles.input}
                  value={email}
                />
                <TextInput
                  autoCapitalize="none"
                  autoComplete="password"
                  onChangeText={setPassword}
                  placeholder={t('sync.password')}
                  placeholderTextColor={colors.placeholder}
                  secureTextEntry
                  style={styles.input}
                  value={password}
                />

                <Pressable
                  accessibilityLabel={t('sync.signIn')}
                  accessibilityRole="button"
                  disabled={busy !== null}
                  onPress={() => void handleSignIn()}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    busy !== null && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>
                    {busy === 'signIn' ? t('sync.signingIn') : t('sync.signIn')}
                  </Text>
                </Pressable>
                <Pressable
                  accessibilityLabel={t('sync.signUp')}
                  accessibilityRole="button"
                  disabled={busy !== null}
                  onPress={() => void handleSignUp()}
                  style={({ pressed }) => [
                    styles.secondaryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.secondaryButtonText}>
                    {busy === 'signUp' ? t('sync.signingUp') : t('sync.signUp')}
                  </Text>
                </Pressable>
              </>
            )}

            {feedback ? <Text style={styles.feedback}>{feedback}</Text> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    accountCard: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 15,
      flexDirection: 'row',
      gap: 12,
      padding: 14,
    },
    accountCopy: { flex: 1 },
    accountEmail: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: 2 },
    accountLabel: { color: colors.textMuted, fontSize: 12 },
    backdrop: {
      alignItems: 'center',
      backgroundColor: Platform.OS === 'web' ? colors.overlay : colors.background,
      flex: 1,
      justifyContent: 'center',
    },
    card: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderRadius: Platform.OS === 'web' ? 24 : 0,
      borderWidth: Platform.OS === 'web' ? 1 : 0,
      flex: Platform.OS === 'web' ? undefined : 1,
      maxHeight: Platform.OS === 'web' ? 680 : undefined,
      maxWidth: Platform.OS === 'web' ? 480 : undefined,
      overflow: 'hidden',
      width: Platform.OS === 'web' ? '92%' : '100%',
    },
    content: { gap: 12, padding: 18 },
    disabled: { opacity: 0.55 },
    error: { color: colors.danger, fontSize: 13, lineHeight: 18, textAlign: 'center' },
    feedback: { color: colors.primaryDark, fontSize: 13, lineHeight: 18, textAlign: 'center' },
    header: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderBottomColor: colors.border,
      borderBottomWidth: 1,
      flexDirection: 'row',
      gap: 11,
      paddingBottom: 14,
      paddingHorizontal: 16,
    },
    headerCopy: { flex: 1 },
    headerIcon: {
      alignItems: 'center',
      backgroundColor: colors.primarySoft,
      borderRadius: 12,
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    input: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 13,
      borderWidth: 1,
      color: colors.text,
      fontSize: 15,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    notice: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 16,
      borderWidth: 1,
      gap: 7,
      padding: 18,
    },
    noticeText: { color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
    noticeTitle: { color: colors.text, fontSize: 16, fontWeight: '800', textAlign: 'center' },
    pressed: { opacity: 0.72 },
    primaryButton: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 13,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 50,
      paddingHorizontal: 16,
    },
    primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
    secondaryButton: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 13,
      borderWidth: 1,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: 16,
    },
    secondaryButtonText: { color: colors.primaryDark, fontSize: 14, fontWeight: '800' },
    statusCard: {
      backgroundColor: colors.surface,
      borderColor: colors.border,
      borderRadius: 15,
      borderWidth: 1,
      gap: 7,
      padding: 14,
    },
    statusHint: { color: colors.textMuted, fontSize: 12 },
    statusLabel: { color: colors.textMuted, fontSize: 13 },
    statusRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
    statusValue: { color: colors.primaryDark, fontSize: 13, fontWeight: '800' },
    subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
    title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  });
