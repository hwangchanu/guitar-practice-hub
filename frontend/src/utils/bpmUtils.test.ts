import { describe, it, expect } from 'vitest';
import { validateBpm, bpmToIntervalMs, intervalMsToBpm } from './bpmUtils';

describe('validateBpm', () => {
  it('accepts BPM at lower bound (40)', () => {
    const result = validateBpm(40);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('accepts BPM at upper bound (240)', () => {
    const result = validateBpm(240);
    expect(result.valid).toBe(true);
  });

  it('accepts BPM in the middle of range', () => {
    expect(validateBpm(120).valid).toBe(true);
  });

  it('rejects BPM below 40', () => {
    const result = validateBpm(39);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('BPM은 40에서 240 사이의 값을 입력해주세요.');
  });

  it('rejects BPM above 240', () => {
    const result = validateBpm(241);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('BPM은 40에서 240 사이의 값을 입력해주세요.');
  });
});

describe('bpmToIntervalMs', () => {
  it('converts 60 BPM to 1000ms', () => {
    expect(bpmToIntervalMs(60)).toBe(1000);
  });

  it('converts 120 BPM to 500ms', () => {
    expect(bpmToIntervalMs(120)).toBe(500);
  });

  it('converts 240 BPM to 250ms', () => {
    expect(bpmToIntervalMs(240)).toBe(250);
  });
});

describe('intervalMsToBpm', () => {
  it('converts 1000ms to 60 BPM', () => {
    expect(intervalMsToBpm(1000)).toBe(60);
  });

  it('converts 500ms to 120 BPM', () => {
    expect(intervalMsToBpm(500)).toBe(120);
  });
});

describe('roundtrip conversion', () => {
  it('bpmToIntervalMs -> intervalMsToBpm returns original BPM', () => {
    for (const bpm of [40, 60, 100, 120, 180, 240]) {
      const ms = bpmToIntervalMs(bpm);
      const recovered = intervalMsToBpm(ms);
      expect(Math.abs(recovered - bpm)).toBeLessThanOrEqual(0.01);
    }
  });

  it('intervalMsToBpm -> bpmToIntervalMs returns original ms', () => {
    for (const ms of [250, 500, 1000, 1500]) {
      const bpm = intervalMsToBpm(ms);
      const recovered = bpmToIntervalMs(bpm);
      expect(Math.abs(recovered - ms)).toBeLessThanOrEqual(0.01);
    }
  });
});
