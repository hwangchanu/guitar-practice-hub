import { describe, it, expect } from 'vitest';
import { validateFileFormat, validateFileSize } from './fileValidation';

function createFile(name: string, size: number): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name);
}

describe('validateFileFormat', () => {
  it('accepts .mp3 files', () => {
    const result = validateFileFormat(createFile('song.mp3', 100));
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts .wav files', () => {
    const result = validateFileFormat(createFile('recording.wav', 100));
    expect(result.valid).toBe(true);
  });

  it('accepts uppercase extensions', () => {
    expect(validateFileFormat(createFile('song.MP3', 100)).valid).toBe(true);
    expect(validateFileFormat(createFile('song.WAV', 100)).valid).toBe(true);
  });

  it('rejects unsupported formats', () => {
    const result = validateFileFormat(createFile('song.ogg', 100));
    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      '지원하지 않는 파일 형식입니다. MP3 또는 WAV 파일을 업로드해주세요.'
    );
  });

  it('rejects files with no extension', () => {
    const result = validateFileFormat(createFile('noext', 100));
    expect(result.valid).toBe(false);
  });
});

describe('validateFileSize', () => {
  it('accepts files at exactly 50MB', () => {
    const result = validateFileSize(createFile('song.mp3', 50 * 1024 * 1024));
    expect(result.valid).toBe(true);
  });

  it('accepts files under 50MB', () => {
    const result = validateFileSize(createFile('song.mp3', 1024));
    expect(result.valid).toBe(true);
  });

  it('rejects files over 50MB', () => {
    const result = validateFileSize(
      createFile('song.mp3', 50 * 1024 * 1024 + 1)
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe('파일 크기가 50MB를 초과합니다.');
  });
});
