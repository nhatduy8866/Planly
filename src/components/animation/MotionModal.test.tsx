import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Modal, Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { MotionModal } from './MotionModal';

const mockUseReducedMotion = jest.fn(() => false);

jest.mock('./MotionProvider', () => ({
  useReducedMotion: () => mockUseReducedMotion(),
}));

describe('MotionModal', () => {
  beforeEach(() => {
    mockUseReducedMotion.mockReturnValue(false);
  });

  it('uses the shared fade transition by default', () => {
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <MotionModal visible>
          <Text>Modal content</Text>
        </MotionModal>,
      );
    });

    expect(tree!.root.findByType(Modal).props.animationType).toBe('fade');

    act(() => tree!.unmount());
  });

  it('disables the transition when reduced motion is enabled', () => {
    mockUseReducedMotion.mockReturnValue(true);
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <MotionModal visible>
          <Text>Modal content</Text>
        </MotionModal>,
      );
    });

    expect(tree!.root.findByType(Modal).props.animationType).toBe('none');

    act(() => tree!.unmount());
  });
});
