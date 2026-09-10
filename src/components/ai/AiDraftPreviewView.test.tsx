import { act } from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import renderer from 'react-test-renderer';

import type { AiDraftTask } from '../../types/ai';
import { AiDraftPreviewView } from './AiDraftPreviewView';

jest.mock('../../preferences/PreferencesContext', () => {
  const { translate } = jest.requireActual<
    typeof import('../../i18n/translations')
  >('../../i18n/translations');
  const { lightColors } = jest.requireActual<
    typeof import('../../theme/colors')
  >('../../theme/colors');

  return {
    usePreferences: () => ({
      colors: lightColors,
      locale: 'vi-VN',
      t: (
        key: Parameters<typeof translate>[1],
        values?: Parameters<typeof translate>[2],
      ) => translate('vi', key, values),
    }),
  };
});

function makeDraft(overrides: Partial<AiDraftTask>): AiDraftTask {
  return {
    id: 'draft',
    title: 'Công việc',
    date: '2026-09-10',
    startTime: '14:00',
    reminderMinutes: 15,
    priority: 'medium',
    source: 'direct_request',
    ...overrides,
  };
}

describe('AiDraftPreviewView', () => {
  it('opens the selected draft from its three-dot button', () => {
    const onEditDraft = jest.fn();
    let tree: renderer.ReactTestRenderer | undefined;

    act(() => {
      tree = renderer.create(
        <AiDraftPreviewView
          drafts={[
            makeDraft({ id: 'report', title: 'Làm báo cáo' }),
            makeDraft({ id: 'gym', title: 'Tập thể dục', startTime: '15:00' }),
          ]}
          onBack={jest.fn()}
          onConfirm={jest.fn()}
          onEditDraft={onEditDraft}
          onRefine={jest.fn()}
          targetDate="2026-09-10"
        />,
      );
    });

    const editButton = tree!.root.findByProps({
      accessibilityLabel: 'Chỉnh sửa Tập thể dục',
    });
    act(() => editButton.props.onPress());

    expect(onEditDraft).toHaveBeenCalledWith('gym');
    act(() => tree!.unmount());
  });
});
