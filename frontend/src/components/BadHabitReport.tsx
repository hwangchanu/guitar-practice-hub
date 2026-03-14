import type {
  BadHabitReport as BadHabitReportData,
  BadHabitDetection,
  BadHabitType,
} from '../types';

const HABIT_LABELS: Record<BadHabitType, string> = {
  pick_scratch: '피크 비빔',
  mute_fail: '뮤트 실패',
  timing_off: '박자 이탈',
  left_hand_delay: '왼손 지연',
};

const HABIT_COLORS: Record<BadHabitType, string> = {
  pick_scratch: '#d9534f',
  mute_fail: '#f0ad4e',
  timing_off: '#5bc0de',
  left_hand_delay: '#9b59b6',
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

interface BadHabitReportProps {
  report: BadHabitReportData;
  realtimeDetections?: BadHabitDetection[];
}

export function BadHabitReport({ report, realtimeDetections }: BadHabitReportProps) {
  const { totalNotes, habits, mostFrequentSection } = report;

  return (
    <div style={{ padding: 16 }}>
      {/* 요약 리포트 */}
      <p style={{ fontWeight: 600, marginBottom: 12 }}>나쁜 버릇 리포트</p>

      <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
        총 {totalNotes}개 음 분석
      </p>

      {habits.length === 0 ? (
        <p style={{ color: '#5cb85c' }}>감지된 나쁜 버릇이 없습니다. 잘하고 있어요!</p>
      ) : (
        <div style={{ marginBottom: 20 }}>
          {habits.map((habit) => (
            <div
              key={habit.type}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                marginBottom: 6,
                borderRadius: 4,
                borderLeft: `4px solid ${HABIT_COLORS[habit.type]}`,
                background: '#fafafa',
              }}
            >
              <span style={{ fontWeight: 500 }}>{HABIT_LABELS[habit.type]}</span>
              <span style={{ fontSize: 13, color: '#666' }}>
                {habit.count}회 ({(habit.ratio * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 최빈 구간 */}
      {mostFrequentSection && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 4,
            background: '#fff3f3',
            border: '1px solid #f5c6cb',
            marginBottom: 20,
          }}
        >
          <span style={{ fontWeight: 500 }}>가장 빈번한 구간: </span>
          <span>
            {formatTime(mostFrequentSection.startTime)} – {formatTime(mostFrequentSection.endTime)}
          </span>
        </div>
      )}

      {/* 실시간 감지 결과 */}
      {realtimeDetections && realtimeDetections.length > 0 && (
        <div>
          <p style={{ fontWeight: 600, marginBottom: 8 }}>실시간 감지</p>
          <div
            role="log"
            aria-label="실시간 나쁜 버릇 감지 결과"
            style={{
              maxHeight: 200,
              overflowY: 'auto',
              border: '1px solid #eee',
              borderRadius: 4,
              padding: 8,
            }}
          >
            {realtimeDetections.map((d, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'center',
                  padding: '4px 0',
                  borderBottom: '1px solid #f5f5f5',
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: HABIT_COLORS[d.type],
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: '#888', minWidth: 40 }}>{formatTime(d.timestamp)}</span>
                <span style={{ fontWeight: 500 }}>{HABIT_LABELS[d.type]}</span>
                <span style={{ color: '#888' }}>
                  ({d.position.string}번줄 {d.position.fret}프렛)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
