import { useState, useCallback, useRef, useEffect } from 'react';
import { AudioInputModule } from '../components/AudioInputModule';
import {
  requestSeparation,
  waitForSeparation,
  ApiError,
  type SeparationTaskResult,
} from '../services/api';
import { ProgressBar } from '../components/ProgressBar';

type PageState = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

const BASE_URL = '';

export function SeparationPage() {
  const [state, setState] = useState<PageState>('idle');
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<SeparationTaskResult | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const drawWaveform = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, width, height);

    const mid = height / 2;
    const barCount = 80;
    const barWidth = width / barCount;

    ctx.fillStyle = '#4a90d9';
    for (let i = 0; i < barCount; i++) {
      const amp = Math.sin((i / barCount) * Math.PI) * (0.3 + Math.random() * 0.5);
      const barHeight = amp * mid;
      ctx.fillRect(i * barWidth + 1, mid - barHeight, barWidth - 2, barHeight * 2);
    }
  }, []);

  useEffect(() => {
    if (state === 'completed' && canvasRef.current) {
      drawWaveform(canvasRef.current);
    }
  }, [state, drawWaveform]);

  const handleAudioReady = useCallback(async (blob: Blob) => {
    const file = blob instanceof File ? blob : new File([blob], 'recording.wav', { type: blob.type });

    setState('uploading');
    setError('');
    setProgress('파일 업로드 중...');

    try {
      const { task_id } = await requestSeparation(file);
      setState('processing');
      setProgress('소스 분리 처리 중...');

      const taskResult = await waitForSeparation(task_id, (data) => {
        if (data.status === 'processing') {
          setProgress('소스 분리 처리 중...');
        }
      });

      setResult(taskResult);
      setState('completed');
      setProgress('');
    } catch (err) {
      const message = err instanceof ApiError
        ? err.message
        : '소스 분리 중 오류가 발생했습니다. 다시 시도해주세요.';
      setError(message);
      setState('error');
      setProgress('');
    }
  }, []);

  const handleReset = useCallback(() => {
    setState('idle');
    setError('');
    setProgress('');
    setResult(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  const guitarTrackUrl = result?.guitar_track_path
    ? `${BASE_URL}${result.guitar_track_path}`
    : null;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>오디오 소스 분리</h1>
      <p style={{ color: '#888', marginBottom: 24 }}>
        음원을 업로드하면 기타 트랙을 자동으로 분리합니다.
      </p>

      {state === 'idle' && (
        <AudioInputModule onAudioReady={handleAudioReady} />
      )}

      {(state === 'uploading' || state === 'processing') && (
        <ProgressBar
          active
          label={progress}
          estimatedDurationSec={45}
        />
      )}

      {state === 'error' && (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <p role="alert" style={{ color: '#d9534f', marginBottom: 16 }}>{error}</p>
          <button
            onClick={handleReset}
            style={{
              padding: '8px 20px',
              borderRadius: 4,
              border: 'none',
              background: '#4a90d9',
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            다시 시도
          </button>
        </div>
      )}

      {state === 'completed' && guitarTrackUrl && (
        <div>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>분리된 기타 트랙</h2>

          <canvas
            ref={canvasRef}
            width={600}
            height={120}
            aria-label="기타 트랙 파형 미리보기"
            style={{ width: '100%', height: 120, borderRadius: 8, marginBottom: 16 }}
          />

          <audio
            ref={audioRef}
            controls
            src={guitarTrackUrl}
            style={{ width: '100%', marginBottom: 16 }}
            aria-label="분리된 기타 트랙 재생"
          >
            브라우저가 오디오 재생을 지원하지 않습니다.
          </audio>

          <button
            onClick={handleReset}
            style={{
              padding: '8px 20px',
              borderRadius: 4,
              border: '1px solid #ccc',
              background: 'transparent',
              cursor: 'pointer',
            }}
          >
            새로운 분리 시작
          </button>
        </div>
      )}
    </div>
  );
}
