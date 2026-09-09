import { MaterialIcons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { usePreferences } from '../preferences/PreferencesContext';
import type { ThemeColors } from '../theme/colors';
import { useThemedStyles } from '../theme/useThemedStyles';

export interface SortOption<T extends string = string> {
  key: T;
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
}

interface SortDropdownProps<T extends string = string> {
  options: SortOption<T>[];
  selectedKey: T;
  onSelect: (key: T) => void;
  accessibilityLabel?: string;
  buttonIcon?: keyof typeof MaterialIcons.glyphMap;
  fullWidth?: boolean;
}

export function SortDropdown<T extends string = string>({
  options,
  selectedKey,
  onSelect,
  accessibilityLabel,
  buttonIcon = 'sort',
  fullWidth = false,
}: SortDropdownProps<T>) {
  const { colors, t } = usePreferences();
  const styles = useThemedStyles(createStyles);
  const anchorRef = useRef<View>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [menuCoords, setMenuCoords] = useState<{
    top: number;
    left: number;
    width?: number;
  }>({
    top: 100,
    left: 16,
  });

  const selectedOption = options.find((opt) => opt.key === selectedKey);

  function handleOpen() {
    anchorRef.current?.measureInWindow((x, y, width, height) => {
      const windowWidth = Dimensions.get('window').width;
      const menuWidth = fullWidth ? Math.min(width, windowWidth - 24) : 145;
      const left = Math.min(
        Math.max(12, fullWidth ? x : x + width - menuWidth),
        windowWidth - menuWidth - 12,
      );
      setMenuCoords({
        top: y + height + 5,
        left,
        width: fullWidth ? menuWidth : undefined,
      });
      setIsOpen(true);
    });
  }

  function handleSelect(key: T) {
    onSelect(key);
    setIsOpen(false);
  }

  return (
    <>
      <View
        ref={anchorRef}
        collapsable={false}
        style={fullWidth && styles.fullWidth}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? t('common.sort')}
          onPress={handleOpen}
          style={({ pressed }) => [
            styles.button,
            fullWidth && styles.fullWidthButton,
            pressed && styles.pressed,
            isOpen && styles.buttonActive,
          ]}
        >
          <MaterialIcons name={buttonIcon} size={16} color={colors.primary} />
          <Text
            style={[styles.buttonText, fullWidth && styles.fullWidthButtonText]}
          >
            {selectedOption?.label ?? t('common.sort')}
          </Text>
          <MaterialIcons
            name={isOpen ? 'arrow-drop-up' : 'arrow-drop-down'}
            size={18}
            color={colors.primary}
          />
        </Pressable>
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={isOpen}
        onRequestClose={() => setIsOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setIsOpen(false)}>
          <View
            style={[
              styles.menu,
              {
                top: menuCoords.top,
                left: menuCoords.left,
                width: menuCoords.width,
              },
            ]}
          >
            {options.map((opt, index) => {
              const isSelected = opt.key === selectedKey;
              return (
                <View key={opt.key}>
                  {index > 0 ? <View style={styles.divider} /> : null}
                  <Pressable
                    onPress={() => handleSelect(opt.key)}
                    style={({ pressed }) => [
                      styles.menuItem,
                      isSelected && styles.menuItemActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.itemContent}>
                      {opt.icon ? (
                        <MaterialIcons
                          name={opt.icon}
                          size={16}
                          color={isSelected ? colors.primaryDark : colors.textMuted}
                        />
                      ) : null}
                      <Text
                        style={[
                          styles.menuItemText,
                          isSelected && styles.menuItemTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </View>
                    {isSelected ? (
                      <MaterialIcons name="check" size={16} color={colors.primaryDark} />
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: 11,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  buttonActive: {
    backgroundColor: colors.primarySoft,
  },
  buttonText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
  },
  fullWidth: {
    width: '100%',
  },
  fullWidthButton: {
    width: '100%',
  },
  fullWidthButtonText: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  backdrop: {
    backgroundColor: colors.subtleOverlay,
    flex: 1,
  },
  menu: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    elevation: 8,
    minWidth: 145,
    overflow: 'hidden',
    paddingVertical: 4,
    position: 'absolute',
    shadowColor: colors.shadow,
    shadowOffset: { height: 4, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  divider: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    marginHorizontal: 8,
  },
  menuItem: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  menuItemActive: {
    backgroundColor: colors.primarySoft,
  },
  itemContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  menuItemText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  menuItemTextActive: {
    color: colors.primaryDark,
    fontWeight: '800',
  },
});
