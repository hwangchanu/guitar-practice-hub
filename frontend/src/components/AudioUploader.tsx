import { useState, useRef, useCallback, type DragEvent, type ChangeEvent } from 'react';
import { validateFileFormat, validateFileSize } from '../utils/fileValidation';

interface AudioUploaderProps {
  onFileSelected: (file: File) => void;
}

export function AudioUploader({ onFileSelected }: AudioUploaderProps) {
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      setError(null);
      setFileName(null);

      const formatResult = validateFileFormat(file);
      if (!formatResult.valid) {
        setError(formatResult.error ?? null);
        return;
      }

      const sizeResult = validateFileSize(file);
      if (!sizeResult.valid) {
        setError(sizeResult.error ?? null);
        return;
      }

      setFileName(file.name);
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="오디오 파일 업로드 영역"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
        style={{
          border: `2px dashed ${isDragging ? '#4a90d9' : '#ccc'}`,
          borderRadius: 8,
          padding: '32px 16px',
          textAlign: 'center',
          cursor: 'pointer',
          background: isDragging ? '#f0f7ff' : 'transparent',
          transition: 'border-color 0.2s, background 0.2s',
        }}
      >
        <p>파일을 드래그하거나 클릭하여 업로드하세요</p>
        <p style={{ fontSize: '0.85em', color: '#888' }}>
          MP3 또는 WAV (최대 50MB)
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".mp3,.wav"
        onChange={handleChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      {fileName && (
        <p style={{ marginTop: 8, color: '#4a90d9' }}>선택된 파일: {fileName}</p>
      )}

      {error && (
        <p role="alert" style={{ marginTop: 8, color: '#d9534f' }}>
          {error}
        </p>
      )}
    </div>
  );
}
