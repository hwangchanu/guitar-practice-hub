import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { ChromaticPage } from './ChromaticPage';

// Mock api
vi.mock('../services/api', () => ({
  ApiError: class ApiError extends Error {
    statusCode?: number;
    constructor(message: string, statusCode?: number) {
      super(message);
      this.name = 'ApiError';
      this.statusCode = statusCode;
    }
  },
  startChromaticSession: vi.fn(),
  stopChromaticSession: vi.fn(),
}));

// Mock websocket
const mockConnect = vi.fn();
const mockDisconnect = vi.fn();
const mockSetOnDetection = vi.fn();
const mockSetOnStateChange = vi.fn();
const mockSetOnError = vi.fn();

vi.mock('../services/websocket', () => ({
  ChromaticWebSocket: class {
    connect = mockConnect;
    disconnect = mockDisconnect;
    setOnDetection = mockSetOnDetection;
    setOnStateChange = mockSetOnStateChange;
    setOnError = mockSetOnError;
  },
}));

// Mock useMetronome
const mockStart = vi.fn();
const mockStop = vi.fn();
vi.mock('../hooks/useMetronome', () => ({
  useMetronome: () => ({
    isPlaying: false,
    bpm: 120,
    start: mockStart,
    stop: mockStop,
    setBpm: vi.fn(),
  }),
}));

// Mock useAudioRecorder
const mockStartRecording = vi.fn().mockResolvedValue(undefined);
const mockStopRecording = vi.fn();
const mockClearRecording = vi.fn();
vi.mock('../hooks/useAudioRecorder', () => ({
  useAudioRecorder: () => ({
    isRecording: false,
    error: null,
    audioBlob: null,
    startRecording: mockStartRecording,
    stopRecording: mockStopRecording,
    clearRecording: mockClearRecording,
  }),
}));

// Mock child components
vi.mock('../components/PatternVisualizer', () => ({
  PatternVisualizer: ({ pattern }: { pattern: { id: string } }) => (
    <div data-testid="pattern-visualizer">pattern-{pattern.id}</div>
  ),
}));

vi.mock('../components/BadHabitReport', () => ({
  BadHabitReport: ({ report }: { report: { sessionId: string } }) => (
    <div data-testid="bad-habit-report">Report: {report.sessionId}</div>
  ),
}));

import { startChromaticSession, stopChromaticSession } from '../services/api';

const mockStartSession = startChromaticSession as ReturnType<typeof vi.fn>;
const mockStopSession = stopChromaticSession as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ChromaticPage', () => {
  it('renders setup state with BPM input, pattern selection, and start button', () => {
    render(<ChromaticPage />);
    expect(screen.getByText('크로매틱 연습')).toBeTruthy();
    expect(screen.getByLabelText('BPM (40-240)')).toBeTruthy();
    expect(screen.getByText('패턴 선택')).toBeTruthy();
    expect(screen.getByText('연습 시작')).toBeTruthy();
  });

  it('renders all 4 chromatic patterns as radio options', () => {
    render(<ChromaticPage />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(4);
    expect(screen.getByText('1-2-3-4 (ascending)')).toBeTruthy();
    expect(screen.getByText('1-3-2-4 (ascending)')).toBeTruthy();
    expect(screen.getByText('4-3-2-1 (descending)')).toBeTruthy();
    expect(screen.getByText('1-2-4-3 (ascending)')).toBeTruthy();
  });

  it('shows pattern visualizer preview in setup', () => {
    render(<ChromaticPage />);
    expect(screen.getByTestId('pattern-visualizer')).toBeTruthy();
  });

  it('shows BPM validation error for out-of-range value', async () => {
    render(<ChromaticPage />);
    const input = screen.getByLabelText('BPM (40-240)') as HTMLInputElement;

    await act(async () => {
      input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '300');
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(screen.getByText('BPM은 40에서 240 사이의 값을 입력해주세요.')).toBeTruthy();
  });

  it('transitions to practicing state on successful start', async () => {
    mockStartSession.mockResolvedValue({ session_id: 'sess-1' });

    render(<ChromaticPage />);

    await act(async () => {
      screen.getByText('연습 시작').click();
    });

    await waitFor(() => {
      expect(screen.getByText('연습 종료')).toBeTruthy();
    });

    expect(mockStartSession).toHaveBeenCalledWith(120, '1-2-3-4');
    expect(mockStart).toHaveBeenCalledWith(120);
    expect(mockStartRecording).toHaveBeenCalled();
    expect(mockConnect).toHaveBeenCalledWith('sess-1');
  });

  it('shows error when session start fails', async () => {
    const { ApiError } = await import('../services/api');
    mockStartSession.mockRejectedValue(new ApiError('세션 시작 실패'));

    render(<ChromaticPage />);

    await act(async () => {
      screen.getByText('연습 시작').click();
    });

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('세션 시작 실패');
    });
  });

  it('transitions to report state on stop', async () => {
    mockStartSession.mockResolvedValue({ session_id: 'sess-1' });
    mockStopSession.mockResolvedValue({
      sessionId: 'sess-1',
      totalNotes: 50,
      habits: [],
    });

    render(<ChromaticPage />);

    await act(async () => {
      screen.getByText('연습 시작').click();
    });

    await waitFor(() => {
      expect(screen.getByText('연습 종료')).toBeTruthy();
    });

    await act(async () => {
      screen.getByText('연습 종료').click();
    });

    await waitFor(() => {
      expect(screen.getByTestId('bad-habit-report')).toBeTruthy();
    });

    expect(mockStop).toHaveBeenCalled();
    expect(mockStopRecording).toHaveBeenCalled();
    expect(mockDisconnect).toHaveBeenCalled();
  });

  it('returns to setup when "새로운 연습 시작" is clicked', async () => {
    mockStartSession.mockResolvedValue({ session_id: 'sess-1' });
    mockStopSession.mockResolvedValue({
      sessionId: 'sess-1',
      totalNotes: 10,
      habits: [],
    });

    render(<ChromaticPage />);

    await act(async () => {
      screen.getByText('연습 시작').click();
    });
    await waitFor(() => {
      expect(screen.getByText('연습 종료')).toBeTruthy();
    });

    await act(async () => {
      screen.getByText('연습 종료').click();
    });
    await waitFor(() => {
      expect(screen.getByText('새로운 연습 시작')).toBeTruthy();
    });

    await act(async () => {
      screen.getByText('새로운 연습 시작').click();
    });

    expect(screen.getByText('연습 시작')).toBeTruthy();
    expect(screen.getByLabelText('BPM (40-240)')).toBeTruthy();
  });
});
