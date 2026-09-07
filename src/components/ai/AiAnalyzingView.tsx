import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

interface AiAnalyzingViewProps {
  currentStep: number; // 1 to 4
  onCancel: () => void;
}

const CHECKLIST_STEPS = [
  { step: 1, label: 'Phân tích nội dung' },
  { step: 2, label: 'Nhận diện thời gian' },
  { step: 3, label: 'Tạo danh sách công việc' },
  { step: 4, label: 'Tối ưu lịch trình...' },
];

export function AiAnalyzingView({ currentStep, onCancel }: AiAnalyzingViewProps) {
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <View style={styles.logoRow}>
          <MaterialIcons name="auto-awesome" size={18} color={colors.primary} />
          <Text style={styles.headerTitle}>Planly AI</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>Đang hiểu kế hoạch của bạn...</Text>

        {/* Central Illustration */}
        <View style={styles.illustrationWrap}>
          <View style={styles.circleBg}>
            <MaterialIcons name="format-list-bulleted" size={38} color={colors.primary} />
          </View>
          <MaterialIcons
            name="auto-awesome"
            size={22}
            color={colors.accent}
            style={styles.starTopRight}
          />
          <MaterialIcons
            name="auto-awesome"
            size={16}
            color={colors.primary}
            style={styles.starBottomLeft}
          />
        </View>

        {/* Checklist Steps */}
        <View style={styles.checklistContainer}>
          {CHECKLIST_STEPS.map((item) => {
            const isCompleted = currentStep > item.step;
            const isCurrent = currentStep === item.step;

            return (
              <View key={item.step} style={styles.checkItem}>
                <MaterialIcons
                  name={
                    isCompleted
                      ? 'check-circle'
                      : isCurrent
                        ? 'radio-button-checked'
                        : 'radio-button-unchecked'
                  }
                  size={20}
                  color={
                    isCompleted
                      ? colors.primary
                      : isCurrent
                        ? colors.primary
                        : colors.border
                  }
                />
                <Text
                  style={[
                    styles.checkLabel,
                    (isCompleted || isCurrent) && styles.checkLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Tip Box */}
        <View style={styles.tipBox}>
          <MaterialIcons name="lightbulb-outline" size={22} color={colors.warning} />
          <Text style={styles.tipText}>
            <Text style={styles.tipBold}>Mẹo: </Text>
            {'Bạn có thể viết tự nhiên, ví dụ "ngày mai", "chiều", "tối"... Planly sẽ tự hiểu.'}
          </Text>
        </View>
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
  headerSpacer: {
    width: 40,
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
  body: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 24,
    textAlign: 'center',
  },
  illustrationWrap: {
    alignItems: 'center',
    height: 120,
    justifyContent: 'center',
    marginBottom: 28,
    position: 'relative',
    width: 120,
  },
  circleBg: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 45,
    height: 90,
    justifyContent: 'center',
    width: 90,
  },
  starTopRight: {
    position: 'absolute',
    right: 12,
    top: 10,
  },
  starBottomLeft: {
    bottom: 12,
    left: 12,
    position: 'absolute',
  },
  checklistContainer: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 24,
    padding: 16,
  },
  checkItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
  },
  checkLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  checkLabelActive: {
    color: colors.text,
    fontWeight: '700',
  },
  tipBox: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  tipText: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  tipBold: {
    color: colors.text,
    fontWeight: '700',
  },
});
