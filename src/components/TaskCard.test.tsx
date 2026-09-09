import { describe, expect, it, jest } from '@jest/globals';
import React from 'react';
import renderer, { act } from 'react-test-renderer';

import type { Task } from '../types';
import { TaskCard } from './TaskCard';

jest.mock('@expo/vector-icons', () => ({
  MaterialIcons: 'MaterialIcons',
}));

jest.mock('../preferences/PreferencesContext', () => ({
  usePreferences: () => ({
    colors: {
      surface: '#FFFFFF',
      surfaceMuted: '#F1F5F9',
      primary: '#4F46E5',
      primaryDark: '#3730A3',
      primarySoft: '#E0E7FF',
      text: '#0F172A',
      textMuted: '#64748B',
      border: '#E2E8F0',
      danger: '#B84D47',
      dangerSoft: '#F8E5E3',
      warning: '#A36A28',
      priorityHigh: '#DC2626',
      priorityMedium: '#D97706',
      priorityLow: '#2563EB',
      shadow: '#0F172A',
    },
    colorfulAccents: false,
    locale: 'vi-VN',
    t: (key: string, params?: Record<string, string | number>) => {
      if (params?.title) return `Đánh dấu ${params.title}`;
      if (key === 'task.delete') return 'Xóa';
      return key;
    },
  }),
}));

const mockTask: Task = {
  id: 'task-1',
  title: 'Họp team đầu tuần',
  description: 'Thảo luận kế hoạch sprint mới',
  date: '2026-09-09',
  startTime: '09:00',
  durationMinutes: 60,
  reminderMinutes: 15,
  completed: false,
  priority: 'high',
  order: 1,
  createdAt: '2026-09-09T00:00:00.000Z',
  updatedAt: '2026-09-09T00:00:00.000Z',
};

function renderTaskCard(props: Partial<React.ComponentProps<typeof TaskCard>> = {}) {
  const onToggle = jest.fn();
  const onEdit = jest.fn();
  const onDelete = jest.fn();

  let tree: renderer.ReactTestRenderer | undefined;
  act(() => {
    tree = renderer.create(
      <TaskCard
        task={mockTask}
        onToggle={onToggle}
        onEdit={onEdit}
        onDelete={onDelete}
        {...props}
      />,
    );
  });

  return { tree: tree!, onToggle, onEdit, onDelete };
}

describe('TaskCard Component', () => {
  it('renders task title, time, and duration correctly', () => {
    const { tree } = renderTaskCard();
    const json = JSON.stringify(tree.toJSON());

    expect(json).toContain('Họp team đầu tuần');
    expect(json).toContain('09:00');
    expect(json).toContain('Thảo luận kế hoạch sprint mới');
  });

  it('hides description when compact is true', () => {
    const { tree } = renderTaskCard({ compact: true });
    const json = JSON.stringify(tree.toJSON());

    expect(json).toContain('Họp team đầu tuần');
    expect(json).not.toContain('Thảo luận kế hoạch sprint mới');
  });

  it('renders completed state with completed checkbox state', () => {
    const { tree } = renderTaskCard({
      task: { ...mockTask, completed: true },
    });

    const checkbox = tree.root.findByProps({ accessibilityRole: 'checkbox' });
    expect(checkbox.props.accessibilityState.checked).toBe(true);
  });

  it('renders priority corner when priority is set', () => {
    const { tree: highTree } = renderTaskCard({
      task: { ...mockTask, priority: 'high' },
    });
    expect(highTree.root.findAllByProps({ testID: 'task-card-priority-corner' }).length > 0).toBe(true);

    const { tree: noneTree } = renderTaskCard({
      task: { ...mockTask, priority: 'none' },
    });
    expect(noneTree.root.findAllByProps({ testID: 'task-card-priority-corner' }).length > 0).toBe(false);
  });
});
