import { useState, useCallback } from 'react';
import { useMetronome } from '../hooks/useMetronome';
import { validateBpm } from '../utils/bpmUtils';

export function Metronome() {
  const { isPlaying, bpm, start, stop, setBpm } = useMetronome();
  const [inputValue, setInputValue] = useState(String(bpm));
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setInputValue(raw);

      const num = Number(raw);
      if (raw === '' || isNaN(num)) {
        setError(null);
        return;
      }

      const validation = validateBpm(num);
      if (!validation.valid) {
        setError(validation.error ?? null);
      } else {
        setError(null);
        setBpm(num);
      }
    },
    [setBpm],
  );

  const handleToggle = useCallback(() => {
    if (isPlaying) {
      stop();
    } else {
      const num = Number(inputValue);
      const validation = validateBpm(num);
      if (!validation.valid) {
        setError(validation.error ?? null);
        return;
      }
      setError(null);
      start(num);
    }
  }, [isPlaying, inputValue, start, stop]);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="bpm-input" style={{ marginRight: 8 }}>
          BPM
        </label>
        <input
          id="bpm-input"
          type="number"
          min={40}
          max={240}
          value={inputValue}
          onChange={handleInputChange}
          disabled={isPlaying}
          style={{
            width: 80,
            padding: '6px 8px',
            borderRadius: 4,
            border: error ? '1px solid #d9534f' : '1px solid #ccc',
          }}
          aria-describedby={error ? 'bpm-error' : undefined}
        />
        <span style={{ marginLeft: 12, fontWeight: 600 }}>{bpm} BPM</span>
      </div>

      {error && (
        <p id="bpm-error" role="alert" style={{ color: '#d9534f', margin: '0 0 12px' }}>
          {error}
        </p>
      )}

      <button
        onClick={handleToggle}
        style={{
          padding: '8px 24px',
          borderRadius: 4,
          border: 'none',
          background: isPlaying ? '#d9534f' : '#5cb85c',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 14,
        }}
        aria-label={isPlaying ? '메트로놈 정지' : '메트로놈 시작'}
      >
        {isPlaying ? '정지' : '시작'}
      </button>
    </div>
  );
}
