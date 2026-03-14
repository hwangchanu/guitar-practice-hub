import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ApiError,
  requestSeparation,
  getSeparationStatus,
  waitForSeparation,
  requestAnalysis,
  getAnalysisStatus,
  waitForAnalysis,
  requestTabGeneration,
  getTabStatus,
  waitForTabGeneration,
  startChromaticSession,
  stopChromaticSession,
} from './api';

function mockFetchResponse(body: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// fetchWithRetry / ApiError
// ---------------------------------------------------------------------------
describe('fetchWithRetry and error handling', () => {
  it('throws ApiError with detail on non-ok response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ detail: '원곡과 연주 오디오를 모두 제공해주세요.' }),
    });

    await expect(requestSeparation(new File([], 'a.wav'))).rejects.toThrow(ApiError);
    await expect(requestSeparation(new File([], 'a.wav'))).rejects.toThrow(
      '원곡과 연주 오디오를 모두 제공해주세요.',
    );
  });

  it('retries on network error and succeeds', async () => {
    const ok = { ok: true, status: 200, json: () => Promise.resolve({ task_id: '1', status: 'processing' }) };
    globalThis.fetch = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(ok);

    const result = await requestSeparation(new File([], 'a.wav'));
    expect(result.task_id).toBe('1');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws user-friendly message after all retries exhausted', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(requestSeparation(new File([], 'a.wav'))).rejects.toThrow(
      '네트워크 오류가 발생했습니다. 다시 시도해주세요.',
    );
    // 1 initial + 2 retries = 3 calls
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });
});

// ---------------------------------------------------------------------------
// Source Separation
// ---------------------------------------------------------------------------
describe('Source Separation API', () => {
  it('requestSeparation sends FormData with file', async () => {
    globalThis.fetch = mockFetchResponse({ task_id: 'sep-1', status: 'processing' });
    const file = new File(['audio'], 'song.wav', { type: 'audio/wav' });
    const result = await requestSeparation(file);

    expect(result.task_id).toBe('sep-1');
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain('/api/separation');
    expect(call[1].method).toBe('POST');
  });

  it('getSeparationStatus returns task data', async () => {
    globalThis.fetch = mockFetchResponse({
      task_id: 'sep-1',
      status: 'completed',
      guitar_track_path: '/tmp/guitar.wav',
      error_message: null,
    });
    const result = await getSeparationStatus('sep-1');
    expect(result.status).toBe('completed');
    expect(result.guitar_track_path).toBe('/tmp/guitar.wav');
  });

  it('waitForSeparation polls until completed', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      const status = callCount >= 2 ? 'completed' : 'processing';
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ task_id: 'sep-1', status, guitar_track_path: status === 'completed' ? '/tmp/g.wav' : null }),
      });
    });

    const result = await waitForSeparation('sep-1');
    expect(result.status).toBe('completed');
    expect(callCount).toBeGreaterThanOrEqual(2);
  }, 15000);

  it('waitForSeparation throws on failure', async () => {
    globalThis.fetch = mockFetchResponse({
      task_id: 'sep-1',
      status: 'failed',
      error_message: '소스 분리 중 오류가 발생했습니다. 다시 시도해주세요.',
    });

    await expect(waitForSeparation('sep-1')).rejects.toThrow('소스 분리 중 오류가 발생했습니다.');
  });
});

// ---------------------------------------------------------------------------
// Performance Analysis
// ---------------------------------------------------------------------------
describe('Performance Analysis API', () => {
  it('requestAnalysis sends both files', async () => {
    globalThis.fetch = mockFetchResponse({ task_id: 'ana-1', status: 'processing' });
    const original = new File(['orig'], 'original.wav');
    const userAudio = new File(['user'], 'user.wav');
    const result = await requestAnalysis(original, userAudio);

    expect(result.task_id).toBe('ana-1');
    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toContain('/api/analysis');
  });

  it('getAnalysisStatus returns task data', async () => {
    const mockResult = {
      task_id: 'ana-1',
      status: 'completed',
      result: { overallScore: 85, pitchScore: 90, rhythmScore: 80, timingScore: 85, differentSections: [] },
    };
    globalThis.fetch = mockFetchResponse(mockResult);
    const result = await getAnalysisStatus('ana-1');
    expect(result.result?.overallScore).toBe(85);
  });

  it('waitForAnalysis polls until completed', async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      const done = callCount >= 2;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          task_id: 'ana-1',
          status: done ? 'completed' : 'processing',
          result: done ? { overallScore: 75 } : null,
        }),
      });
    });

    const result = await waitForAnalysis('ana-1');
    expect(result.status).toBe('completed');
  }, 15000);
});

// ---------------------------------------------------------------------------
// Tab Generation
// ---------------------------------------------------------------------------
describe('Tab Generation API', () => {
  it('requestTabGeneration sends file', async () => {
    globalThis.fetch = mockFetchResponse({ task_id: 'tab-1', status: 'processing' });
    const result = await requestTabGeneration(new File(['audio'], 'song.wav'));
    expect(result.task_id).toBe('tab-1');
  });

  it('getTabStatus returns task data', async () => {
    globalThis.fetch = mockFetchResponse({
      task_id: 'tab-1',
      status: 'completed',
      result: { notes: [], tuning: ['E', 'A', 'D', 'G', 'B', 'E'] },
      tab_text: 'e|---',
    });
    const result = await getTabStatus('tab-1');
    expect(result.tab_text).toBe('e|---');
  });

  it('waitForTabGeneration throws on failure', async () => {
    globalThis.fetch = mockFetchResponse({
      task_id: 'tab-1',
      status: 'failed',
      error_message: '타브 악보 생성 중 오류가 발생했습니다.',
    });

    await expect(waitForTabGeneration('tab-1')).rejects.toThrow('타브 악보 생성 중 오류가 발생했습니다.');
  });
});

// ---------------------------------------------------------------------------
// Chromatic Coaching REST
// ---------------------------------------------------------------------------
describe('Chromatic Coaching REST API', () => {
  it('startChromaticSession sends bpm and pattern', async () => {
    globalThis.fetch = mockFetchResponse({ session_id: 'sess-1' });
    const result = await startChromaticSession(120, '1-2-3-4');
    expect(result.session_id).toBe('sess-1');

    const call = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[1].headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(call[1].body);
    expect(body.bpm).toBe(120);
    expect(body.pattern).toBe('1-2-3-4');
  });

  it('stopChromaticSession returns report', async () => {
    const report = {
      sessionId: 'sess-1',
      totalNotes: 100,
      habits: [{ type: 'pick_scratch', count: 5, ratio: 0.05 }],
    };
    globalThis.fetch = mockFetchResponse(report);
    const result = await stopChromaticSession('sess-1');
    expect(result.totalNotes).toBe(100);
  });
});
