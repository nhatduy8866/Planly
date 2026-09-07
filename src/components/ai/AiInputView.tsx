import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors } from '../../theme/colors';

interface AiInputViewProps {
  initialPrompt?: string;
  infoMessage?: string | null;
  onSubmit: (prompt: string) => void;
  onClose: () => void;
}

const QUICK_PROMPTS = [
  { id: 'today', icon: 'auto-awesome', label: 'Lên lịch hôm nay', prompt: 'Hôm nay 9h họp team 1 tiếng, chiều 14h làm báo cáo 90 phút, tối 8h học tiếng Trung. Nhắc trước 15 phút.' },
  { id: 'tomorrow', icon: 'auto-awesome', label: 'Lên lịch ngày mai', prompt: 'Mai 9h họp team 1 tiếng, chiều 2h làm báo cáo 90 phút, tối 8h học tiếng Trung. Nhắc trước 15 phút.' },
  { id: 'multi', icon: 'auto-awesome', label: 'Thêm nhiều công việc', prompt: 'Làm báo cáo 2 giờ mức ưu tiên cao, Gym 1 giờ, Học tiếng Trung 45 phút, Gọi khách hàng 30 phút.' },
  { id: 'reorder', icon: 'refresh', label: 'Sắp xếp cả ngày', prompt: 'Sắp xếp lại các công việc trong ngày theo thứ tự ưu tiên và tránh trùng giờ.' },
];

export function AiInputView({
  initialPrompt = '',
  infoMessage = null,
  onSubmit,
  onClose,
}: AiInputViewProps) {
  const [text, setText] = useState(initialPrompt);
  const [isRecording, setIsRecording] = useState(false);

  function handleVoicePress() {
    void Haptics.selectionAsync();
    // Mô phỏng / kích hoạt nhận diện giọng nói
    if (!isRecording) {
      setIsRecording(true);
      // Giả lập giọng nói tiếng Việt mẫu nếu môi trường web/demo
      setTimeout(() => {
        setText(
          'Mai 9h họp team 1 tiếng, chiều 2h làm báo cáo 90 phút, tối 8h học tiếng Trung. Nhắc trước 15 phút.',
        );
        setIsRecording(false);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }, 1800);
    } else {
      setIsRecording(false);
    }
  }

  function handleQuickPrompt(promptText: string) {
    void Haptics.selectionAsync();
    setText(promptText);
  }

  function handleFormSubmit() {
    if (!text.trim()) return;
    onSubmit(text.trim());
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={onClose} style={styles.iconButton}>
          <MaterialIcons name="close" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <View style={styles.logoRow}>
            <MaterialIcons name="auto-awesome" size={18} color={colors.primary} />
            <Text style={styles.headerTitle}>Planly AI</Text>
          </View>
          <Text style={styles.headerSubtitle}>Lên lịch chỉ bằng một câu</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Bạn muốn lên kế hoạch gì?</Text>
        <Text style={styles.description}>
          Viết hoặc nói những việc bạn cần làm, Planly sẽ giúp bạn sắp xếp.
        </Text>

        {infoMessage ? (
          <View style={styles.infoBanner}>
            <MaterialIcons name="info-outline" size={18} color="#D97706" />
            <Text style={styles.infoBannerText}>{infoMessage}</Text>
          </View>
        ) : null}

        {/* Input Card */}
        <View style={styles.inputCard}>
          <TextInput
            multiline
            numberOfLines={5}
            maxLength={1000}
            onChangeText={setText}
            placeholder="Ví dụ: Mai 9h họp team 1 tiếng, chiều 2h làm báo cáo 90 phút, tối 8h học tiếng Trung. Nhắc trước 15 phút."
            placeholderTextColor="#9CA3AF"
            style={styles.textInput}
            value={text}
          />
          <View style={styles.inputFooter}>
            <Pressable
              onPress={handleVoicePress}
              style={[styles.micButton, isRecording && styles.micButtonActive]}
            >
              <MaterialIcons
                name={isRecording ? 'mic' : 'mic-none'}
                size={22}
                color={isRecording ? colors.danger : colors.primary}
              />
              {isRecording ? <Text style={styles.recordingText}>Đang nghe...</Text> : null}
            </Pressable>
            <Text style={styles.charCount}>{text.length}/1000</Text>
          </View>
        </View>

        {/* Gợi ý nhanh */}
        <Text style={styles.sectionLabel}>Gợi ý nhanh</Text>
        <View style={styles.quickPromptsGrid}>
          {QUICK_PROMPTS.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleQuickPrompt(item.prompt)}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <MaterialIcons name={item.icon as any} size={15} color={colors.primary} />
              <Text style={styles.chipText}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      {/* Footer Submit Button */}
      <View style={styles.footer}>
        <Pressable
          disabled={!text.trim()}
          onPress={handleFormSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            !text.trim() && styles.submitButtonDisabled,
            pressed && text.trim() ? styles.pressed : null,
          ]}
        >
          <MaterialIcons name="auto-awesome" size={20} color={colors.white} />
          <Text style={styles.submitText}>Tạo kế hoạch</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  iconButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  logoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 6,
  },
  description: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  inputCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    minHeight: 160,
    padding: 14,
  },
  textInput: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
  },
  micButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    padding: 6,
  },
  micButtonActive: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 8,
  },
  recordingText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  charCount: {
    color: colors.textMuted,
    fontSize: 12,
  },
  sectionLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  quickPromptsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 14,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.75,
  },
  infoBanner: {
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
    padding: 12,
  },
  infoBannerText: {
    color: '#92400E',
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
