import type { ChromaticPattern, FretPosition } from '../types';

interface PatternVisualizerProps {
  pattern: ChromaticPattern;
  currentPosition?: FretPosition | null;
}

const STRING_LABELS = ['e', 'B', 'G', 'D', 'A', 'E'];
const NUM_STRINGS = 6;

export function PatternVisualizer({ pattern, currentPosition }: PatternVisualizerProps) {
  const { fretSequence, stringDirection } = pattern;
  const minFret = Math.min(...fretSequence);
  const maxFret = Math.max(...fretSequence);
  const frets = Array.from({ length: maxFret - minFret + 1 }, (_, i) => minFret + i);

  // Build set of positions in the pattern for highlighting
  const stringOrder =
    stringDirection === 'ascending'
      ? Array.from({ length: NUM_STRINGS }, (_, i) => NUM_STRINGS - i) // 6,5,4,3,2,1
      : Array.from({ length: NUM_STRINGS }, (_, i) => i + 1);          // 1,2,3,4,5,6

  const patternPositions = new Set<string>();
  for (const s of stringOrder) {
    for (const f of fretSequence) {
      patternPositions.add(`${s}-${f}`);
    }
  }

  const isCurrent = (s: number, f: number) =>
    currentPosition != null && currentPosition.string === s && currentPosition.fret === f;

  const isInPattern = (s: number, f: number) => patternPositions.has(`${s}-${f}`);

  const cellSize = 36;
  const labelWidth = 24;

  return (
    <div style={{ padding: 16 }}>
      <p style={{ fontWeight: 600, marginBottom: 4 }}>{pattern.name}</p>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
        패턴: {fretSequence.join('-')} | 방향: {stringDirection === 'ascending' ? '↓ 저음→고음' : '↑ 고음→저음'}
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table
          role="grid"
          aria-label={`${pattern.name} 프렛보드 다이어그램`}
          style={{ borderCollapse: 'collapse' }}
        >
          <thead>
            <tr>
              <th style={{ width: labelWidth }} />
              {frets.map((f) => (
                <th
                  key={f}
                  style={{
                    width: cellSize,
                    textAlign: 'center',
                    fontSize: 12,
                    color: '#888',
                    paddingBottom: 4,
                  }}
                >
                  {f}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Render strings top-to-bottom: string 1 (high e) to string 6 (low E) */}
            {Array.from({ length: NUM_STRINGS }, (_, idx) => {
              const stringNum = idx + 1;
              return (
                <tr key={stringNum}>
                  <td
                    style={{
                      fontWeight: 600,
                      fontSize: 13,
                      textAlign: 'right',
                      paddingRight: 6,
                    }}
                  >
                    {STRING_LABELS[idx]}
                  </td>
                  {frets.map((f) => {
                    const active = isInPattern(stringNum, f);
                    const current = isCurrent(stringNum, f);
                    return (
                      <td
                        key={f}
                        aria-label={`${stringNum}번 줄 ${f}번 프렛${current ? ' (현재 위치)' : ''}`}
                        style={{
                          width: cellSize,
                          height: cellSize,
                          textAlign: 'center',
                          border: '1px solid #ddd',
                          background: current
                            ? '#4a90d9'
                            : active
                              ? '#e8f4fd'
                              : '#fff',
                          color: current ? '#fff' : '#333',
                          fontWeight: active || current ? 600 : 400,
                          fontSize: 13,
                          borderRadius: 2,
                        }}
                      >
                        {active ? '●' : ''}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
