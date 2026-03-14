import type { AnalysisResult, TabData } from '../types';

const BASE_URL = '';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;
const POLL_INTERVAL_MS = 2000;

export class ApiError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

async function fetchWithRetry(
  input: RequestInfo,
  init?: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(input, init);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const detail = body.detail ?? '서버 오류가 발생했습니다.';
        throw new ApiError(detail, response.status);
      }
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (attempt === retries) {
        throw new ApiError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
    }
  }
  throw new ApiError('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
}

// ---------------------------------------------------------------------------
// Polling helper
// ---------------------------------------------------------------------------

interface PollOptions<T> {
  url: string;
  isComplete: (data: T) => boolean;
  isFailed: (data: T) => boolean;
  getError: (data: T) => string;
  intervalMs?: number;
  onProgress?: (data: T) => void;
}

async function pollTask<T>(opts: PollOptions<T>): Promise<T> {
  const interval = opts.intervalMs ?? POLL_INTERVAL_MS;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetchWithRetry(opts.url);
    const data: T = await res.json();
    if (opts.onProgress) opts.onProgress(data);
    if (opts.isComplete(data)) return data;
    if (opts.isFailed(data)) throw new ApiError(opts.getError(data));
    await new Promise((r) => setTimeout(r, interval));
  }
}

// ---------------------------------------------------------------------------
// Source Separation API
// ---------------------------------------------------------------------------

export interface SeparationTaskResult {
  task_id: string;
  status: string;
  guitar_track_path?: string | null;
  error_message?: string | null;
}

export async function requestSeparation(file: File): Promise<{ task_id: string; status: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetchWithRetry(`${BASE_URL}/api/separation`, { method: 'POST', body: form });
  return res.json();
}

export async function getSeparationStatus(taskId: string): Promise<SeparationTaskResult> {
  const res = await fetchWithRetry(`${BASE_URL}/api/separation/${taskId}`);
  return res.json();
}

export async function waitForSeparation(
  taskId: string,
  onProgress?: (data: SeparationTaskResult) => void,
): Promise<SeparationTaskResult> {
  return pollTask<SeparationTaskResult>({
    url: `${BASE_URL}/api/separation/${taskId}`,
    isComplete: (d) => d.status === 'completed',
    isFailed: (d) => d.status === 'failed',
    getError: (d) => d.error_message ?? '소스 분리 중 오류가 발생했습니다. 다시 시도해주세요.',
    onProgress,
  });
}

// ---------------------------------------------------------------------------
// Performance Analysis API
// ---------------------------------------------------------------------------

export interface AnalysisTaskResult {
  task_id: string;
  status: string;
  result?: AnalysisResult | null;
  error_message?: string | null;
}

export async function requestAnalysis(
  original: File,
  userAudio: File,
): Promise<{ task_id: string; status: string }> {
  const form = new FormData();
  form.append('original', original);
  form.append('user_audio', userAudio);
  const res = await fetchWithRetry(`${BASE_URL}/api/analysis`, { method: 'POST', body: form });
  return res.json();
}

export async function getAnalysisStatus(taskId: string): Promise<AnalysisTaskResult> {
  const res = await fetchWithRetry(`${BASE_URL}/api/analysis/${taskId}`);
  return res.json();
}

export async function waitForAnalysis(
  taskId: string,
  onProgress?: (data: AnalysisTaskResult) => void,
): Promise<AnalysisTaskResult> {
  return pollTask<AnalysisTaskResult>({
    url: `${BASE_URL}/api/analysis/${taskId}`,
    isComplete: (d) => d.status === 'completed',
    isFailed: (d) => d.status === 'failed',
    getError: (d) => d.error_message ?? '분석 중 오류가 발생했습니다. 다시 시도해주세요.',
    onProgress,
  });
}

// ---------------------------------------------------------------------------
// Tab Generation API
// ---------------------------------------------------------------------------

export interface TabTaskResult {
  task_id: string;
  status: string;
  result?: TabData | null;
  tab_text?: string | null;
  error_message?: string | null;
}

export async function requestTabGeneration(file: File): Promise<{ task_id: string; status: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetchWithRetry(`${BASE_URL}/api/tab`, { method: 'POST', body: form });
  return res.json();
}

export async function getTabStatus(taskId: string): Promise<TabTaskResult> {
  const res = await fetchWithRetry(`${BASE_URL}/api/tab/${taskId}`);
  return res.json();
}

export async function waitForTabGeneration(
  taskId: string,
  onProgress?: (data: TabTaskResult) => void,
): Promise<TabTaskResult> {
  return pollTask<TabTaskResult>({
    url: `${BASE_URL}/api/tab/${taskId}`,
    isComplete: (d) => d.status === 'completed',
    isFailed: (d) => d.status === 'failed',
    getError: (d) => d.error_message ?? '타브 악보 생성 중 오류가 발생했습니다. 다시 시도해주세요.',
    onProgress,
  });
}

// ---------------------------------------------------------------------------
// Chromatic Coaching REST API
// ---------------------------------------------------------------------------

export async function startChromaticSession(
  bpm: number,
  pattern: string,
): Promise<{ session_id: string }> {
  const res = await fetchWithRetry(`${BASE_URL}/api/chromatic/session/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bpm, pattern }),
  });
  return res.json();
}

export async function stopChromaticSession(sessionId: string): Promise<import('../types').BadHabitReport> {
  const res = await fetchWithRetry(`${BASE_URL}/api/chromatic/session/${sessionId}/stop`, {
    method: 'POST',
  });
  return res.json();
}
