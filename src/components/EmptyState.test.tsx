import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import renderer, { act } from 'react-test-renderer';

import { EmptyState } from './EmptyState';

jest.mock('../preferences/PreferencesContext', () => ({
  usePreferences: () => ({
    colors: {
      primary: '#4F46E5',
      primarySoft: '#EEF2FF',
      text: '#111827',
      textMuted: '#6B7280',
      white: '#FFFFFF',
      surface: '#FFFFFF',
    },
    t: (key: string) => key,
  }),
}));

describe('EmptyState', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('renders title and description properly', () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <EmptyState
          icon="event-available"
          title="Không có công việc"
          description="Hãy thêm một công việc mới để bắt đầu."
        />,
      );
    });

    expect(tree).toBeDefined();
    const str = JSON.stringify(tree!.toJSON());
    expect(str).toContain('Không có công việc');
    expect(str).toContain('Hãy thêm một công việc mới để bắt đầu.');

    act(() => {
      tree!.unmount();
    });
  });

  it('renders primary and secondary action buttons when provided', () => {
    const handlePrimary = jest.fn();
    const handleSecondary = jest.fn();

    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <EmptyState
          icon="event-available"
          title="Trống"
          description="Mô tả trống"
          primaryActionLabel="Dùng AI"
          primaryActionIcon="auto-awesome"
          onPrimaryAction={handlePrimary}
          actionLabel="Tạo thủ công"
          onAction={handleSecondary}
        />,
      );
    });

    const str = JSON.stringify(tree!.toJSON());
    expect(str).toContain('Dùng AI');
    expect(str).toContain('Tạo thủ công');

    act(() => {
      tree!.unmount();
    });
  });

  it('unmounts cleanly without errors', () => {
    let tree: renderer.ReactTestRenderer | undefined;
    act(() => {
      tree = renderer.create(
        <EmptyState
          icon="event-available"
          title="Trống"
          description="Mô tả trống"
        />,
      );
    });

    expect(() => {
      act(() => {
        tree!.unmount();
      });
    }).not.toThrow();
  });
});
