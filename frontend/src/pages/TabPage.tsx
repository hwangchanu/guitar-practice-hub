import { useState, useCallback } from 'react';
import { AudioInputModule } from '../components/AudioInputModule';
import { TabRenderer } from '../components/TabRenderer';
import {
  requestTabGeneration,
  waitForTabGeneration,
  ApiError,
  type TabTaskResult,
} from '../services/api';
import { ProgressBar } from '../components/ProgressBar';
import type { TabData } from '../types';

type PageState = 'idle' | 'uploading' | 'processing' | 'completed' | 'error';

export function TabPage() {
  const [state, setState] = useState<PageState>('idle');
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [tabData, setTabData] = useState<TabData | null>(null);

  const handleAudioReady = useCallback(async (blob: Blob) => {
    const file =
      blob instanceof File
        ? blob
        : new File([blob], 'recording.wav', { type: blob.type });

    setState('uploading');
    setError('');
    setProgress('파일 업로드 중...');

    try {
      const { task_id } = await requestTabGeneration(file);
      setState('processing');
      setProgress('타브 악보 생성 중...');

      const taskResult: TabTaskResult = await waitForTabGeneration(
        task_id,
        (data) => {
          if (data.status === 'processing') {
            setProgress('타브 악보 생성 중...');
          }
        },
      );

      if (taskResult.result) {
        setTabData(taskResult.result);
      }
      setState('completed');
      setProgress('');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : '타브 악보 생성 중 오류가 발생했습니다. 다시 시도해주세요.';
      setError(message);
      setState('error');
      setProgress('');
    }
  }, []);

  const handleReset = useCallback(() => {
    setState('idle');
    setError('');
    setProgress('');
    setTabData(null);
  }, []);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>타브 악보 생성</h1>
      <p style={{ color: '#888', marginBottom: 24 }}>
        오디오 파일을 업로드하면 기타 타브 악보를 자동으로 생성합니다.
      </p>

      {state === 'idle' && (
        <AudioInputModule onAudioReady={handleAudioReady} />
      )}

      {(state === 'uploading' || state === 'processing') && (
        <ProgressBar
          active
          label={progress}
          estimatedDurationSec={60}
        />
      )}

      {state === 'error' && (
        <div style={{ textAlign: 'center', padding: 32 }}>
          <p role="alert" style={{ color: '#d9534f', marginBottom: 16 }}>
            {error}
          </p>
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

      {state === 'completed' && tabData && (
        <div>
          <TabRenderer tabData={tabData} />
          <div style={{ marginTop: 16 }}>
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
              새로운 타브 생성
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
