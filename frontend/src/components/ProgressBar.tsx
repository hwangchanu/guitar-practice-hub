import { useState, useEffect, useRef } from 'react';

export interface ProgressBarProps {
  /** Whether the operation is currently in progress */
  active: boolean;
  /** Optional label describing the current operation */
  label?: string;
  /** Estimated total duration in seconds (used for time remaining) */
  estimatedDurationSec?: number;
}

export function ProgressBar({ active, label, estimatedDurationSec }: ProgressBarProps) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }

    startRef.current = Date.now();

    const tick = () => {
      setElapsed((Date.now() - startRef.current) / 1000);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  if (!active) return null;

  const total = estimatedDurationSec ?? 0;
  const progress = total > 0 ? Math.min(elapsed / total, 0.95) : undefined;
  const remaining = total > 0 ? Math.max(0, Math.ceil(total - elapsed)) : undefined;

  return (
    <div role="status" aria-live="polite" style={styles.wrapper}>
      {label && <p style={styles.label}>{label}</p>}

      <div
        role="progressbar"
        aria-label={label ?? '처리 중'}
        aria-valuenow={progress !== undefined ? Math.round(progress * 100) : undefined}
        aria-valuemin={0}
        aria-valuemax={100}
        style={styles.track}
      >
        {progress !== undefined ? (
          <div style={{ ...styles.fill, width: `${progress * 100}%` }} />
        ) : (
          <div style={styles.indeterminate} />
        )}
      </div>

      {remaining !== undefined && remaining > 0 && (
        <p style={styles.remaining}>예상 남은 시간: 약 {remaining}초</p>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    padding: '16px 0',
    textAlign: 'center',
  },
  label: {
    margin: '0 0 10px',
    fontSize: 15,
    color: 'var(--text)',
  },
  track: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    background: 'var(--code-bg)',
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
    background: 'var(--accent)',
    transition: 'width 0.4s ease',
  },
  indeterminate: {
    height: '100%',
    width: '30%',
    borderRadius: 4,
    background: 'var(--accent)',
    animation: 'indeterminate 1.5s ease-in-out infinite',
  },
  remaining: {
    margin: '8px 0 0',
    fontSize: 13,
    color: 'var(--text)',
  },
};
