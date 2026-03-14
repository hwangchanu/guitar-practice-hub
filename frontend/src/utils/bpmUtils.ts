import type { ValidationResult } from '../types';

const MIN_BPM = 40;
const MAX_BPM = 240;

export function validateBpm(bpm: number): ValidationResult {
  if (bpm < MIN_BPM || bpm > MAX_BPM) {
    return {
      valid: false,
      error: 'BPM은 40에서 240 사이의 값을 입력해주세요.',
    };
  }

  return { valid: true };
}

export function bpmToIntervalMs(bpm: number): number {
  return 60000 / bpm;
}

export function intervalMsToBpm(ms: number): number {
  return 60000 / ms;
}
