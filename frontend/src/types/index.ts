// 오디오 입력 관련
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// 분석 결과
export interface AnalysisResult {
  overallScore: number; // 0-100
  pitchScore: number; // 0-100
  rhythmScore: number; // 0-100
  timingScore: number; // 0-100
  differentSections: Section[];
}

export interface Section {
  startTime: number; // 초 단위
  endTime: number; // 초 단위
}

// 타브 악보
export interface TabData {
  notes: TabNote[];
  tuning: string[]; // ["E", "A", "D", "G", "B", "E"]
}

export interface TabNote {
  time: number; // 시작 시간 (초)
  string: number; // 줄 번호 (1-6, 1=고음 E)
  fret: number; // 프렛 번호 (0-24)
}

// 크로매틱 연습
export interface ChromaticPattern {
  id: string;
  name: string;
  fretSequence: number[]; // 예: [1, 2, 3, 4]
  stringDirection: "ascending" | "descending";
}

export interface FretPosition {
  string: number; // 줄 번호
  fret: number; // 프렛 번호
}

// 나쁜 버릇
export type BadHabitType =
  | "pick_scratch"
  | "mute_fail"
  | "timing_off"
  | "left_hand_delay";

export interface BadHabitDetection {
  type: BadHabitType;
  timestamp: number; // 발생 시점 (초)
  position: FretPosition; // 발생 위치
  details: string; // 상세 설명
}

export interface BadHabitReport {
  sessionId: string;
  totalNotes: number;
  habits: BadHabitSummary[];
  mostFrequentSection?: {
    startTime: number;
    endTime: number;
  };
}

export interface BadHabitSummary {
  type: BadHabitType;
  count: number;
  ratio: number; // 전체 음 대비 발생 비율 (0-1)
}

// 메트로놈
export interface MetronomeConfig {
  bpm: number; // 40-240
}
