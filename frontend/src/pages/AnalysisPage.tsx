import { useState, useCallback } from 'react';
import { AudioUploader } from '../components/AudioUploader';
import { ResultVisualizer } from '../components/ResultVisualizer';
import {
  requestAnalysis,
  waitForAnalysis,
  ApiError,
} from '../services/api';
import { ProgressBar } from '../components/ProgressBar';
import type { AnalysisResult } from '../types';

type PageState = 'idle' | 'processing' | 'completed' | 'error';

export function AnalysisPage() {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [userFile, setUserFile] = useState<File | null>(null);
  const [state, setState] = useState<PageState>('idle');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [validationMsg, setValidationMsg] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleOriginalSelected = useCallback((file: File) => {
    setOriginalFile(file);
    setValidationMsg('');
  }, []);

  const handleUserSelected = useCallback((file: File) => {
    setUserFile(file);
    setValidationMsg('');
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!originalFile || !userFile) {
      setValidationMsg('원곡과 연주 오디오를 모두 제공해주세요.');
      return;
    }

    setValidationMsg('');
    setError('');
    setState('processing');
    setProgress('분석 요청 중...');

    try {
      const { task_id } = await requestAnalysis(originalFile, userFile);
      setProgress('분석 처리 중...');

      const taskResult = await waitForAnalysis(task_id, (data) => {
        if (data.status === 'processing') {
          setProgress('분석 처리 중...');
        }
      });

      if (taskResult.result) {
        setResult(taskResult.result);
        setState('completed');
      } else {
        setError('분석 결과를 받지 못했습니다.');
        setState('error');
      }
      setProgress('');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : '분석 중 오류가 발생했습니다. 다시 시도해주세요.';
      setError(message);
      setState('error');
      setProgress('');
    }
  }, [originalFile, userFile]);

  const handleReset = useCallback(() => {
    setOriginalFile(null);
    setUserFile(null);
    setState('idle');
    setError('');
    setProgress('');
    setValidationMsg('');
    setResult(null);
  }, []);

  const canAnalyze = !!originalFile && !!userFile;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>연주 비교 분석</h1>
      <p style={{ color: '#888', marginBottom: 24 }}>
        원곡과 내 연주를 업로드하면 유사도를 분석합니다.
      </p>

      {state === 'idle' && (
        <div>
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>원곡 오디오</h2>
            <AudioUploader onFileSelected={handleOriginalSelected} />
            {originalFile && (
              <p style={{ marginTop: 4, color: '#5cb85c', fontSize: 14 }}>
                ✓ {originalFile.name}
              </p>
            )}
          </div>

          <div style={{ marginBottom: 24 }}>
            <h2 style={{ fontSize: 16, marginBottom: 8 }}>내 연주 오디오</h2>
            <AudioUploader onFileSelected={handleUserSelected} />
            {userFile && (
              <p style={{ marginTop: 4, color: '#5cb85c', fontSize: 14 }}>
                ✓ {userFile.name}
              </p>
            )}
          </div>

          {validationMsg && (
            <p role="alert" style={{ color: '#d9534f', marginBottom: 12 }}>
              {validationMsg}
            </p>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            style={{
              padding: '10px 24px',
              borderRadius: 4,
              border: 'none',
              background: canAnalyze ? '#4a90d9' : '#ccc',
              color: '#fff',
              cursor: canAnalyze ? 'pointer' : 'not-allowed',
              fontSize: 16,
            }}
          >
            분석 시작
          </button>
        </div>
      )}

      {state === 'processing' && (
        <ProgressBar
          active
          label={progress}
          estimatedDurationSec={30}
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

      {state === 'completed' && result && (
        <div>
          <ResultVisualizer result={result} />
          <div style={{ textAlign: 'center', marginTop: 24 }}>
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
              새로운 분석 시작
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
