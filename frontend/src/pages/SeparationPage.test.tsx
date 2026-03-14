import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { SeparationPage } from './SeparationPage';

// Mock the api module
vi.mock('../services/api', () => ({
  ApiError: class ApiError extends Error {
    statusCode?: number;
    constructor(message: string, statusCode?: number) {
      super(message);
      this.name = 'ApiError';
      this.statusCode = statusCode;
    }
  },
  requestSeparation: vi.fn(),
  waitForSeparation: vi.fn(),
}));

// Mock AudioInputModule to control onAudioReady calls
vi.mock('../components/AudioInputModule', () => ({
  AudioInputModule: ({ onAudioReady }: { onAudioReady: (blob: Blob) => void }) => (
    <button data-testid="mock-audio-input" onClick={() => onAudioReady(new File(['audio'], 'test.wav', { type: 'audio/wav' }))}>
      Upload Audio
    </button>
  ),
}));

import { requestSeparation, waitForSeparation } from '../services/api';

const mockRequestSeparation = requestSeparation as ReturnType<typeof vi.fn>;
const mockWaitForSeparation = waitForSeparation as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SeparationPage', () => {
  it('renders initial idle state with audio input', () => {
    render(<SeparationPage />);
    expect(screen.getByText('오디오 소스 분리')).toBeTruthy();
    expect(screen.getByTestId('mock-audio-input')).toBeTruthy();
  });

  it('shows progress indicator during processing', async () => {
    mockRequestSeparation.mockResolvedValue({ task_id: 'sep-1', status: 'processing' });
    // Never resolve to keep in processing state
    mockWaitForSeparation.mockReturnValue(new Promise(() => {}));

    render(<SeparationPage />);

    await act(async () => {
      screen.getByTestId('mock-audio-input').click();
    });

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeTruthy();
    });
  });

  it('shows completed state with audio player on success', async () => {
    mockRequestSeparation.mockResolvedValue({ task_id: 'sep-1', status: 'processing' });
    mockWaitForSeparation.mockResolvedValue({
      task_id: 'sep-1',
      status: 'completed',
      guitar_track_path: '/files/guitar.wav',
    });

    render(<SeparationPage />);

    await act(async () => {
      screen.getByTestId('mock-audio-input').click();
    });

    await waitFor(() => {
      expect(screen.getByText('분리된 기타 트랙')).toBeTruthy();
    });

    const audio = screen.getByLabelText('분리된 기타 트랙 재생') as HTMLAudioElement;
    expect(audio.src).toContain('/files/guitar.wav');
    expect(screen.getByText('새로운 분리 시작')).toBeTruthy();
  });

  it('shows error message on API failure', async () => {
    const { ApiError } = await import('../services/api');
    mockRequestSeparation.mockRejectedValue(new ApiError('소스 분리 중 오류가 발생했습니다.'));

    render(<SeparationPage />);

    await act(async () => {
      screen.getByTestId('mock-audio-input').click();
    });

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('소스 분리 중 오류가 발생했습니다.');
    });

    expect(screen.getByText('다시 시도')).toBeTruthy();
  });

  it('resets to idle state when "새로운 분리 시작" is clicked', async () => {
    mockRequestSeparation.mockResolvedValue({ task_id: 'sep-1', status: 'processing' });
    mockWaitForSeparation.mockResolvedValue({
      task_id: 'sep-1',
      status: 'completed',
      guitar_track_path: '/files/guitar.wav',
    });

    render(<SeparationPage />);

    await act(async () => {
      screen.getByTestId('mock-audio-input').click();
    });

    await waitFor(() => {
      expect(screen.getByText('새로운 분리 시작')).toBeTruthy();
    });

    await act(async () => {
      screen.getByText('새로운 분리 시작').click();
    });

    expect(screen.getByTestId('mock-audio-input')).toBeTruthy();
  });

  it('resets to idle state when "다시 시도" is clicked after error', async () => {
    const { ApiError } = await import('../services/api');
    mockRequestSeparation.mockRejectedValue(new ApiError('오류'));

    render(<SeparationPage />);

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
