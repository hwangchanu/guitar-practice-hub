import type { ValidationResult } from '../types';

const ALLOWED_EXTENSIONS = ['.mp3', '.wav'];
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB

export function validateFileFormat(file: File): ValidationResult {
  const name = file.name.toLowerCase();
  const isValid = ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));

  if (!isValid) {
    return {
      valid: false,
      error: '지원하지 않는 파일 형식입니다. MP3 또는 WAV 파일을 업로드해주세요.',
    };
  }

  return { valid: true };
}

export function validateFileSize(file: File): ValidationResult {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: '파일 크기가 50MB를 초과합니다.',
    };
  }

  return { valid: true };
}
