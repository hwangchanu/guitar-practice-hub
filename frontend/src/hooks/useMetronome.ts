import { useState, useRef, useCallback, useEffect } from 'react';
import { validateBpm, bpmToIntervalMs } from '../utils/bpmUtils';

export interface UseMetronomeReturn {
  isPlaying: boolean;
  bpm: number;
  start: (bpm: number) => void;
  stop: () => void;
  setBpm: (bpm: number) => void;
}

// Look-ahead scheduling constants
const SCHEDULE_AHEAD_TIME = 0.1; // seconds to look ahead
const SCHEDULER_INTERVAL = 25; // ms between scheduler calls

export function useMetronome(): UseMetronomeReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpmState] = useState(120);

  const audioContextRef = useRef<AudioContext | null>(null);
  const timerIdRef = useRef<number | null>(null);
  const nextNoteTimeRef = useRef(0);
  const bpmRef = useRef(bpm);

  // Keep bpmRef in sync
  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  const scheduleClick = useCallback((time: number) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = 1000;
    osc.type = 'square';

    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.05);
  }, []);

  const scheduler = useCallback(() => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    const intervalSec = bpmToIntervalMs(bpmRef.current) / 1000;

    while (nextNoteTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD_TIME) {
      scheduleClick(nextNoteTimeRef.current);
      nextNoteTimeRef.current += intervalSec;
    }
  }, [scheduleClick]);

  const start = useCallback((startBpm: number) => {
    const validation = validateBpm(startBpm);
    if (!validation.valid) return;

    // Stop any existing playback
    if (timerIdRef.current !== null) {
      clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }

    setBpmState(startBpm);
    bpmRef.current = startBpm;

    const ctx = audioContextRef.current ?? new AudioContext();
    audioContextRef.current = ctx;

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    nextNoteTimeRef.current = ctx.currentTime;
    setIsPlaying(true);

    // Start the look-ahead scheduler loop
    const id = window.setInterval(() => {
      const c = audioContextRef.current;
      if (!c) return;
      const intervalSec = bpmToIntervalMs(bpmRef.current) / 1000;
      while (nextNoteTimeRef.current < c.currentTime + SCHEDULE_AHEAD_TIME) {
        scheduleClick(nextNoteTimeRef.current);
        nextNoteTimeRef.current += intervalSec;
      }
    }, SCHEDULER_INTERVAL);
    timerIdRef.current = id;
  }, [scheduleClick]);

  const stop = useCallback(() => {
    if (timerIdRef.current !== null) {
      clearInterval(timerIdRef.current);
      timerIdRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const setBpm = useCallback((newBpm: number) => {
    const validation = validateBpm(newBpm);
    if (!validation.valid) return;
    setBpmState(newBpm);
    bpmRef.current = newBpm;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIdRef.current !== null) {
        clearInterval(timerIdRef.current);
      }
      audioContextRef.current?.close();
    };
  }, []);

  return { isPlaying, bpm, start, stop, setBpm };
}
