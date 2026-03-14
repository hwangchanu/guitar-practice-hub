import type { AnalysisResult } from '../types';

interface ResultVisualizerProps {
  result: AnalysisResult;
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color =
    score >= 80 ? '#5cb85c' : score >= 50 ? '#f0ad4e' : '#d9534f';

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600 }}>{score}점</span>
      </div>
      <div
        style={{
          height: 12,
          borderRadius: 6,
          background: '#eee',
          overflow: 'hidden',
        }}
        role="progressbar"
        aria-valuenow={score}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label} ${score}점`}
      >
        <div
          style={{
            width: `${score}%`,
            height: '100%',
            background: color,
            borderRadius: 6,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function ResultVisualizer({ result }: ResultVisualizerProps) {
  const { overallScore, pitchScore, rhythmScore, timingScore, differentSections } = result;

  const overallColor =
    overallScore >= 80 ? '#5cb85c' : overallScore >= 50 ? '#f0ad4e' : '#d9534f';

  return (
    <div style={{ padding: 16 }}>
      {/* 전체 유사도 점수 */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <p style={{ margin: '0 0 8px', color: '#666' }}>전체 유사도</p>
        <span
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: overallColor,
          }}
        >
          {overallScore}
        </span>
        <span style={{ fontSize: 20, color: '#999' }}> / 100</span>
      </div>

      {/* 항목별 점수 */}
      <div style={{ marginBottom: 24 }}>
        <ScoreBar label="피치 정확도" score={pitchScore} />
        <ScoreBar label="리듬 정확도" score={rhythmScore} />
        <ScoreBar label="타이밍 일치도" score={timingScore} />
      </div>

      {/* 차이 구간 시각화 */}
      {differentSections.length > 0 && (
        <div>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>차이가 큰 구간</p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {differentSections.map((section, i) => (
              <li
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  marginBottom: 4,
                  borderRadius: 4,
                  background: '#fff3f3',
                  border: '1px solid #f5c6cb',
                }}
              >
                <span style={{ color: '#d9534f', fontWeight: 600 }}>⚠</span>
                <span>
                  {formatTime(section.startTime)} – {formatTime(section.endTime)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
