import { act } from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { StyleSheet } from 'react-native';
import renderer from 'react-test-renderer';

import { AiInputView } from './AiInputView';

const mockVoiceInputState = {
  isRecording: true,
  isTranscribing: false,
  durationSeconds: 8,
  errorMessage: null,
  toggleRecording: jest.fn(),
  clearError: jest.fn(),
};

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../../hooks/useVoiceInput', () => ({
  useVoiceInput: () => mockVoiceInputState,
}));

jest.mock('../../preferences/PreferencesContext', () => ({
  usePreferences: () => ({
    colors: new Proxy({}, { get: () => '#000000' }),
    t: (key: string) => key,
  }),
}));

describe('AiInputView voice status', () => {
  it('keeps the recording message inside a flexible two-line area', () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <AiInputView
          onClose={jest.fn()}
          onSubmit={jest.fn()}
        />,
      );
    });

    const voiceStatus = tree!.root.findByProps({
      accessibilityLiveRegion: 'polite',
    });
    const voiceStatusStyle = StyleSheet.flatten(voiceStatus.props.style);

    expect(voiceStatus.props.numberOfLines).toBe(2);
    expect(voiceStatusStyle).toMatchObject({
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
    });
    expect(tree!.root.findByProps({
      accessibilityLabel: 'ai.voiceListening',
    })).toBeDefined();

    act(() => tree!.unmount());
  });
});
