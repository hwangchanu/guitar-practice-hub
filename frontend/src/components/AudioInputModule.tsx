import { useState, useCallback } from 'react';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { AudioUploader } from './AudioUploader';

type InputMode = 'record' | 'upload';

interface AudioInputModuleProps {
  onAudioReady: (blob: Blob) => void;
}

export function AudioInputModule({ onAudioReady }: AudioInputModuleProps) {
  const [mode, setMode] = useState<InputMode>('upload');
  const { isRecording, error, audioBlob, startRecording, stopRecording, clearRecording } =
    useAudioRecorder();

  const handleFileSelected = useCallback(
    (file: File) => {
      onAudioReady(file);
    },
    [onAudioReady]
  );

  const handleUseRecording = useCallback(() => {
    if (audioBlob) {
      onAudioReady(audioBlob);
    }
  }, [audioBlob, onAudioReady]);

  return (
    <div>
      <div role="tablist" style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          role="tab"
          aria-selected={mode === 'upload'}
          onClick={() => setMode('upload')}
          style={{
            padding: '8px 16px',
            borderRadius: 4,
            border: '1px solid #ccc',
            background: mode === 'upload' ? '#4a90d9' : 'transparent',
            color: mode === 'upload' ? '#fff' : 'inherit',
            cursor: 'pointer',
          }}
        >
          파일 업로드
        </button>
        <button
          role="tab"
          aria-selected={mode === 'record'}
          onClick={() => setMode('record')}
          style={{
            padding: '8px 16px',
            borderRadius: 4,
            border: '1px solid #ccc',
            background: mode === 'record' ? '#4a90d9' : 'transparent',
            color: mode === 'record' ? '#fff' : 'inherit',
            cursor: 'pointer',
          }}
        >
          마이크 녹음
        </button>
      </div>

      {mode === 'upload' && <AudioUploader onFileSelected={handleFileSelected} />}

      {mode === 'record' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            {!isRecording ? (
              <button
                onClick={startRecording}
                style={{
                  padding: '8px 20px',
                  borderRadius: 4,
                  border: 'none',
                  background: '#d9534f',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                녹음 시작
              </button>
            ) : (
              <button
                onClick={stopRecording}
                style={{
                  padding: '8px 20px',
                  borderRadius: 4,
                  border: 'none',
                  background: '#5cb85c',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                녹음 중지
              </button>
            )}
          </div>

          {isRecording && (
            <p style={{ color: '#d9534f' }}>● 녹음 중...</p>
          )}

          {error && (
            <p role="alert" style={{ color: '#d9534f' }}>
              {error}
            </p>
          )}

          {audioBlob && !isRecording && (
            <div style={{ marginTop: 12 }}>
              <p>녹음이 완료되었습니다.</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={handleUseRecording}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 4,
                    border: 'none',
                    background: '#4a90d9',
                    color: '#fff',
                    cursor: 'pointer',
                  }}
                >
                  이 녹음 사용
                </button>
                <button
                  onClick={clearRecording}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 4,
                    border: '1px solid #ccc',
                    background: 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  다시 녹음
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
