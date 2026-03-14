import { useState, useCallback, useRef } from 'react';
import { PatternVisualizer } from '../components/PatternVisualizer';
import { BadHabitReport } from '../components/BadHabitReport';
import { useMetronome } from '../hooks/useMetronome';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { ChromaticWebSocket } from '../services/websocket';
import { startChromaticSession, stopChromaticSession, ApiError } from '../services/api';
import { validateBpm } from '../utils/bpmUtils';
import type {
  ChromaticPattern,
  FretPosition,
  BadHabitDetection,
  BadHabitReport as BadHabitReportData,
} from '../types';

const CHROMATIC_PATTERNS: ChromaticPattern[] = [
  { id: '1-2-3-4', name: '1-2-3-4 (ascending)', fretSequence: [1, 2, 3, 4], stringDirection: 'ascending' },
  { id: '1-3-2-4', name: '1-3-2-4 (ascending)', fretSequence: [1, 3, 2, 4], stringDirection: 'ascending' },
  { id: '4-3-2-1', name: '4-3-2-1 (descending)', fretSequence: [4, 3, 2, 1], stringDirection: 'descending' },
  { id: '1-2-4-3', name: '1-2-4-3 (ascending)', fretSequence: [1, 2, 4, 3], stringDirection: 'ascending' },
];

type PageState = 'setup' | 'practicing' | 'report';

export function ChromaticPage() {
  const [pageState, setPageState] = useState<PageState>('setup');
  const [bpmInput, setBpmInput] = useState('120');
  const [bpmError, setBpmError] = useState<string | null>(null);
  const [selectedPatternId, setSelectedPatternId] = useState(CHROMATIC_PATTERNS[0].id);
  const [error, setError] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<FretPosition | null>(null);
  const [detections, setDetections] = useState<BadHabitDetection[]>([]);
  const [report, setReport] = useState<BadHabitReportData | null>(null);

  const sessionIdRef = useRef<string | null>(null);
  const wsRef = useRef<ChromaticWebSocket | null>(null);

  const metronome = useMetronome();
  const recorder = useAudioRecorder();

  const selectedPattern = CHROMATIC_PATTERNS.find((p) => p.id === selectedPatternId) ?? CHROMATIC_PATTERNS[0];

  const handleBpmChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setBpmInput(raw);
    const num = Number(raw);
    if (raw === '' || isNaN(num)) {
      setBpmError(null);
      return;
    }
    const validation = validateBpm(num);
    setBpmError(validation.valid ? null : (validation.error ?? null));
  }, []);

  const handleStart = useCallback(async () => {
    const bpm = Number(bpmInput);
    const validation = validateBpm(bpm);
    if (!validation.valid) {
      setBpmError(validation.error ?? null);
      return;
    }

    setError(null);
    setBpmError(null);
    setDetections([]);
    setCurrentPosition(null);

    try {
      const { session_id } = await startChromaticSession(bpm, selectedPatternId);
      sessionIdRef.current = session_id;

      metronome.start(bpm);
      await recorder.startRecording();

      const ws = new ChromaticWebSocket();
      wsRef.current = ws;

      ws.setOnDetection((newDetections) => {
        setDetections((prev) => [...prev, ...newDetections]);
        const last = newDetections[newDetections.length - 1];
        if (last) {
          setCurrentPosition(last.position);
        }
      });

      ws.setOnError((errMsg) => {
        setError(errMsg);
      });

      ws.connect(session_id);
      setPageState('practicing');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '세션 시작 중 오류가 발생했습니다.';
      setError(message);
    }
  }, [bpmInput, selectedPatternId, metronome, recorder]);

  const handleStop = useCallback(async () => {
    metronome.stop();
    recorder.stopRecording();

    if (wsRef.current) {
      wsRef.current.disconnect();
      wsRef.current = null;
    }

    const sid = sessionIdRef.current;
    if (!sid) {
      setPageState('setup');
      return;
    }

    try {
      const sessionReport = await stopChromaticSession(sid);
      setReport(sessionReport);
      setPageState('report');
    } catch (err) {
      const message = err instanceof ApiError ? err.message : '세션 종료 중 오류가 발생했습니다.';
      setError(message);
      setPageState('report');
      setReport(null);
    } finally {
      sessionIdRef.current = null;
    }
  }, [metronome, recorder]);

  const handleReset = useCallback(() => {
    setPageState('setup');
    setError(null);
    setDetections([]);
    setCurrentPosition(null);
    setReport(null);
    recorder.clearRecording();
  }, [recorder]);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>크로매틱 연습</h1>
      <p style={{ color: '#888', marginBottom: 24 }}>
        패턴을 선택하고 메트로놈에 맞춰 연습하세요. 나쁜 버릇을 실시간으로 감지합니다.
      </p>

      {error && (
        <p role="alert" style={{ color: '#d9534f', marginBottom: 12 }}>
          {error}
        </p>
      )}

      {pageState === 'setup' && (
        <div>
          {/* BPM 입력 */}
          <div style={{ marginBottom: 20 }}>
            <label htmlFor="chromatic-bpm" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              BPM (40-240)
            </label>
            <input
              id="chromatic-bpm"
              type="number"
              min={40}
              max={240}
              value={bpmInput}
              onChange={handleBpmChange}
              style={{
                width: 120,
                padding: '8px 10px',
                borderRadius: 4,
                border: bpmError ? '1px solid #d9534f' : '1px solid #ccc',
                fontSize: 16,
              }}
              aria-describedby={bpmError ? 'chromatic-bpm-error' : undefined}
            />
            {bpmError && (
              <p id="chromatic-bpm-error" role="alert" style={{ color: '#d9534f', margin: '4px 0 0', fontSize: 13 }}>
                {bpmError}
              </p>
            )}
          </div>

          {/* 패턴 선택 */}
          <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
            <legend style={{ fontWeight: 600, marginBottom: 8 }}>패턴 선택</legend>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {CHROMATIC_PATTERNS.map((p) => (
                <label
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 4,
                    border: selectedPatternId === p.id ? '2px solid #4a90d9' : '1px solid #ccc',
                    background: selectedPatternId === p.id ? '#e8f4fd' : '#fff',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  <input
                    type="radio"
                    name="chromatic-pattern"
                    value={p.id}
                    checked={selectedPatternId === p.id}
                    onChange={() => setSelectedPatternId(p.id)}
                    style={{ margin: 0 }}
                  />
                  {p.name}
                </label>
              ))}
            </div>
          </fieldset>

          {/* 패턴 미리보기 */}
          <PatternVisualizer pattern={selectedPattern} />

          <button
            onClick={handleStart}
            style={{
              marginTop: 16,
              padding: '10px 24px',
              borderRadius: 4,
              border: 'none',
              background: '#5cb85c',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            연습 시작
          </button>
        </div>
      )}

      {pageState === 'practicing' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <span style={{ fontWeight: 600 }}>{metronome.bpm} BPM</span>
            <span style={{ color: '#5cb85c', fontSize: 13 }}>● 연습 중</span>
          </div>

          <PatternVisualizer pattern={selectedPattern} currentPosition={currentPosition} />

          {/* 실시간 감지 */}
          {detections.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <BadHabitReport
                report={{
                  sessionId: sessionIdRef.current ?? '',
                  totalNotes: 0,
                  habits: [],
                }}
                realtimeDetections={detections}
              />
            </div>
          )}

          <button
            onClick={handleStop}
            style={{
              marginTop: 20,
              padding: '10px 24px',
              borderRadius: 4,
              border: 'none',
              background: '#d9534f',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            연습 종료
          </button>
        </div>
      )}

      {pageState === 'report' && (
        <div>
          {report ? (
            <BadHabitReport report={report} realtimeDetections={detections} />
          ) : (
            <p style={{ color: '#888', padding: 16 }}>리포트를 불러올 수 없습니다.</p>
          )}

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <button
              onClick={handleReset}
              style={{
                padding: '8px 20px',
                borderRadius: 4,
                border: '1px solid #ccc',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              새로운 연습 시작
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
