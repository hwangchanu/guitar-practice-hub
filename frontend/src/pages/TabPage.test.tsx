import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { TabPage } from './TabPage';

vi.mock('../services/api', () => ({
  ApiError: class ApiError extends Error {
    statusCode?: number;
    constructor(message: string, statusCode?: number) {
      super(message);
      this.name = 'ApiError';
      this.statusCode = statusCode;
    }
  },
  requestTabGeneration: vi.fn(),
  waitForTabGeneration: vi.fn(),
}));

vi.mock('../components/AudioInputModule', () => ({
  AudioInputModule: ({ onAudioReady }: { onAudioReady: (blob: Blob) => void }) => (
    <button
      data-testid="mock-audio-input"
      onClick={() =>
        onAudioReady(new File(['audio'], 'test.wav', { type: 'audio/wav' }))
      }
    >
      Upload Audio
    </button>
  ),
}));

vi.mock('../components/TabRenderer', () => ({
  TabRenderer: ({ tabData }: { tabData: { notes: unknown[] } }) => (
    <div data-testid="tab-renderer">Tab notes: {tabData.notes.length}</div>
  ),
}));

import { requestTabGeneration, waitForTabGeneration } from '../services/api';

const mockRequestTab = requestTabGeneration as ReturnType<typeof vi.fn>;
const mockWaitForTab = waitForTabGeneration as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TabPage', () => {
  it('renders initial idle state with audio input', () => {
    render(<TabPage />);
    expect(screen.getByText('타브 악보 생성')).toBeTruthy();
    expect(screen.getByTestId('mock-audio-input')).toBeTruthy();
  });

  it('shows progress indicator during processing', async () => {
    mockRequestTab.mockResolvedValue({ task_id: 'tab-1', status: 'processing' });
    mockWaitForTab.mockReturnValue(new Promise(() => {}));

    render(<TabPage />);

    await act(async () => {
      screen.getByTestId('mock-audio-input').click();
    });

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeTruthy();
    });
  });

  it('shows TabRenderer on successful generation', async () => {
    mockRequestTab.mockResolvedValue({ task_id: 'tab-1', status: 'processing' });
    mockWaitForTab.mockResolvedValue({
      task_id: 'tab-1',
      status: 'completed',
      result: {
        notes: [{ time: 0, string: 1, fret: 5 }],
        tuning: ['E', 'A', 'D', 'G', 'B', 'E'],
      },
    });

    render(<TabPage />);

    await act(async () => {
      screen.getByTestId('mock-audio-input').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('tab-renderer')).toBeTruthy();
    });

    expect(screen.getByText('새로운 타브 생성')).toBeTruthy();
  });

  it('shows error message on API failure', async () => {
    const { ApiError } = await import('../services/api');
    mockRequestTab.mockRejectedValue(
      new ApiError('타브 악보 생성 중 오류가 발생했습니다.'),
    );

    render(<TabPage />);

    await act(async () => {
      screen.getByTestId('mock-audio-input').click();
    });

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        '타브 악보 생성 중 오류가 발생했습니다.',
      );
    });

    expect(screen.getByText('다시 시도')).toBeTruthy();
  });

  it('resets to idle when "새로운 타브 생성" is clicked', async () => {
    mockRequestTab.mockResolvedValue({ task_id: 'tab-1', status: 'processing' });
    mockWaitForTab.mockResolvedValue({
      task_id: 'tab-1',
      status: 'completed',
      result: {
        notes: [{ time: 0, string: 1, fret: 5 }],
        tuning: ['E', 'A', 'D', 'G', 'B', 'E'],
      },
    });

    render(<TabPage />);

    await act(async () => {
      screen.getByTestId('mock-audio-input').click();
    });

    await waitFor(() => {
      expect(screen.getByText('새로운 타브 생성')).toBeTruthy();
    });

    await act(async () => {
      screen.getByText('새로운 타브 생성').click();
    });

    expect(screen.getByTestId('mock-audio-input')).toBeTruthy();
  });

  it('resets to idle when "다시 시도" is clicked after error', async () => {
    const { ApiError } = await import('../services/api');
    mockRequestTab.mockRejectedValue(new ApiError('오류'));

    render(<TabPage />);

    await act(async () => {
      screen.getByTestId('mock-audio-input').click();
    });

    await waitFor(() => {
      expect(screen.getByText('다시 시도')).toBeTruthy();
    });

    await act(async () => {
      screen.getByText('다시 시도').click();
    });

    expect(screen.getByTestId('mock-audio-input')).toBeTruthy();
  });
});
