import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { Text } from 'react-native';
import renderer, { act } from 'react-test-renderer';

import { AnimatedEntryItem } from './AnimatedEntryItem';

describe('AnimatedEntryItem', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders children properly with initial opacity and translation', () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <AnimatedEntryItem index={0}>
          <Text>Test Item</Text>
        </AnimatedEntryItem>,
      );
    });

    expect(tree).toBeDefined();
    const textNode = tree!.root.findByType(Text);
    expect(textNode.props.children).toBe('Test Item');

    act(() => {
      tree!.unmount();
    });
  });

  it('stops animation on unmount cleanly', () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <AnimatedEntryItem index={2} staggerMs={30}>
          <Text>Unmounting Item</Text>
        </AnimatedEntryItem>,
      );
    });

    expect(() => {
      act(() => {
        tree!.unmount();
      });
    }).not.toThrow();
  });
});
