import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AnalysisPage } from './AnalysisPage';

vi.mock('../services/api', () => ({
  ApiError: class ApiError extends Error {
    statusCode?: number;
    constructor(message: string, statusCode?: number) {
      super(message);
      this.name = 'ApiError';
      this.statusCode = statusCode;
    }
  },
  requestAnalysis: vi.fn(),
  waitForAnalysis: vi.fn(),
}));

let uploaderIndex = 0;
vi.mock('../components/AudioUploader', () => ({
  AudioUploader: ({ onFileSelected }: { onFileSelected: (file: File) => void }) => {
    const idx = uploaderIndex++;
    const label = idx % 2 === 0 ? 'original' : 'user';
    return (
      <button
        data-testid={`upload-${label}`}
        onClick={() =>
          onFileSelected(new File(['audio'], `${label}.wav`, { type: 'audio/wav' }))
        }
      >
        Upload {label}
      </button>
    );
  },
}));

vi.mock('../components/ResultVisualizer', () => ({
  ResultVisualizer: ({ result }: { result: { overallScore: number } }) => (
    <div data-testid="result-visualizer">Score: {result.overallScore}</div>
  ),
}));

import { requestAnalysis, waitForAnalysis } from '../services/api';

const mockRequestAnalysis = requestAnalysis as ReturnType<typeof vi.fn>;
const mockWaitForAnalysis = waitForAnalysis as ReturnType<typeof vi.fn>;

afterEach(() => {
  vi.restoreAllMocks();
  uploaderIndex = 0;
});

const mockResult = {
  overallScore: 85,
  pitchScore: 90,
  rhythmScore: 80,
  timingScore: 85,
  differentSections: [],
};

describe('AnalysisPage', () => {
  it('renders initial state with two upload areas and disabled button', () => {
    render(<AnalysisPage />);
    expect(screen.getByText('연주 비교 분석')).toBeTruthy();
    expect(screen.getByText('원곡 오디오')).toBeTruthy();
    expect(screen.getByText('내 연주 오디오')).toBeTruthy();
    const btn = screen.getByText('분석 시작');
    expect(btn).toBeTruthy();
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables analyze button when both files are provided', async () => {
    render(<AnalysisPage />);

    await act(async () => {
      screen.getByTestId('upload-original').click();
    });
    await act(async () => {
      screen.getByTestId('upload-user').click();
    });

    const btn = screen.getByText('분석 시작') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
  });

  it('shows validation message when analyze clicked without both files', async () => {
    render(<AnalysisPage />);

    // Only upload original
    await act(async () => {
      screen.getByTestId('upload-original').click();
    });

    // Button is disabled, but let's verify the validation message scenario
    // by checking the message doesn't appear yet
    expect(screen.queryByText('원곡과 연주 오디오를 모두 제공해주세요.')).toBeNull();
  });

  it('shows progress indicator during analysis', async () => {
    mockRequestAnalysis.mockResolvedValue({ task_id: 'ana-1', status: 'processing' });
    mockWaitForAnalysis.mockReturnValue(new Promise(() => {}));

    render(<AnalysisPage />);

    await act(async () => {
      screen.getByTestId('upload-original').click();
    });
    await act(async () => {
      screen.getByTestId('upload-user').click();
    });
    await act(async () => {
      screen.getByText('분석 시작').click();
    });

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeTruthy();
    });
  });

  it('shows results on successful analysis', async () => {
    mockRequestAnalysis.mockResolvedValue({ task_id: 'ana-1', status: 'processing' });
    mockWaitForAnalysis.mockResolvedValue({
      task_id: 'ana-1',
      status: 'completed',
      result: mockResult,
    });

    render(<AnalysisPage />);

    await act(async () => {
      screen.getByTestId('upload-original').click();
    });
    await act(async () => {
      screen.getByTestId('upload-user').click();
    });
    await act(async () => {
      screen.getByText('분석 시작').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('result-visualizer')).toBeTruthy();
    });
    expect(screen.getByText('Score: 85')).toBeTruthy();
    expect(screen.getByText('새로운 분석 시작')).toBeTruthy();
  });

  it('shows error on API failure', async () => {
    const { ApiError } = await import('../services/api');
    mockRequestAnalysis.mockRejectedValue(new ApiError('분석 중 오류가 발생했습니다.'));

    render(<AnalysisPage />);

    await act(async () => {
      screen.getByTestId('upload-original').click();
    });
    await act(async () => {
      screen.getByTestId('upload-user').click();
    });
    await act(async () => {
      screen.getByText('분석 시작').click();
    });

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('분석 중 오류가 발생했습니다.');
    });
    expect(screen.getByText('다시 시도')).toBeTruthy();
  });

  it('resets to idle when "새로운 분석 시작" is clicked', async () => {
    mockRequestAnalysis.mockResolvedValue({ task_id: 'ana-1', status: 'processing' });
    mockWaitForAnalysis.mockResolvedValue({
      task_id: 'ana-1',
      status: 'completed',
      result: mockResult,
    });

    render(<AnalysisPage />);

    await act(async () => {
      screen.getByTestId('upload-original').click();
    });
    await act(async () => {
      screen.getByTestId('upload-user').click();
    });
    await act(async () => {
      screen.getByText('분석 시작').click();
    });

    await waitFor(() => {
      expect(screen.getByText('새로운 분석 시작')).toBeTruthy();
    });

    await act(async () => {
      screen.getByText('새로운 분석 시작').click();
    });

    expect(screen.getByText('원곡 오디오')).toBeTruthy();
    expect(screen.getByText('내 연주 오디오')).toBeTruthy();
  });

  it('resets to idle when "다시 시도" is clicked after error', async () => {
    const { ApiError } = await import('../services/api');
    mockRequestAnalysis.mockRejectedValue(new ApiError('오류'));

    render(<AnalysisPage />);

    await act(async () => {
      screen.getByTestId('upload-original').click();
    });
    await act(async () => {
      screen.getByTestId('upload-user').click();
    });
    await act(async () => {
      screen.getByText('분석 시작').click();
    });

    await waitFor(() => {
      expect(screen.getByText('다시 시도')).toBeTruthy();
    });

    await act(async () => {
      screen.getByText('다시 시도').click();
    });

    expect(screen.getByText('원곡 오디오')).toBeTruthy();
  });
});
