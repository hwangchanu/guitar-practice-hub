# 구현 계획: Guitar Practice Hub

## 개요

React + TypeScript 프론트엔드와 Python FastAPI 백엔드로 구성된 기타 연습 허브를 구현합니다. 프로젝트 구조 설정부터 시작하여 핵심 유틸리티, 백엔드 엔진, 프론트엔드 컴포넌트 순으로 점진적으로 구현하며, 마지막에 전체를 통합합니다.

## Tasks

- [x] 1. 프로젝트 구조 및 핵심 데이터 모델 설정
  - [x] 1.1 프론트엔드 프로젝트 초기화 및 디렉토리 구조 생성
    - React + TypeScript 프로젝트 생성 (Vite 기반)
    - `src/components/`, `src/hooks/`, `src/services/`, `src/types/`, `src/utils/` 디렉토리 구조 생성
    - fast-check, react-router-dom 등 의존성 설치
    - _Requirements: 1.1, 1.2_

  - [x] 1.2 백엔드 프로젝트 초기화 및 디렉토리 구조 생성
    - FastAPI 프로젝트 생성
    - `app/routers/`, `app/engines/`, `app/models/`, `app/utils/` 디렉토리 구조 생성
    - demucs, librosa, numpy, hypothesis, pytest 등 의존성 설정 (requirements.txt)
    - _Requirements: 1.1_

  - [x] 1.3 프론트엔드 TypeScript 타입 및 인터페이스 정의
    - `src/types/` 에 ValidationResult, AnalysisResult, Section, TabData, TabNote, ChromaticPattern, FretPosition, BadHabitType, BadHabitDetection, BadHabitReport, BadHabitSummary, MetronomeConfig 인터페이스 정의
    - _Requirements: 2.3, 4.2, 5.2, 6.2, 8.2_

  - [x] 1.4 백엔드 Pydantic 데이터 모델 정의
    - `app/models/` 에 SeparationResult, DetectedNote, TabNote, TabData, AnalysisResult, BadHabitType, BadHabitDetection, BadHabitSummary, BadHabitReport 모델 정의
    - Field 제약 조건 포함 (ge, le 등)
    - _Requirements: 3.5, 4.2, 5.2, 8.5, 8.6_

- [x] 2. 파일 검증 유틸리티 및 BPM 유틸리티 구현
  - [x] 2.1 프론트엔드 파일 검증 함수 구현
    - `src/utils/fileValidation.ts` 에 validateFileFormat, validateFileSize 함수 구현
    - MP3/WAV 확장자 검증, 50MB 크기 제한 검증
    - 오류 메시지 반환: "지원하지 않는 파일 형식입니다. MP3 또는 WAV 파일을 업로드해주세요.", "파일 크기가 50MB를 초과합니다."
    - _Requirements: 2.3, 2.4, 2.5_

  - [ ]* 2.2 파일 형식 검증 속성 테스트 작성 (fast-check)
    - **Property 1: 파일 형식 검증 일관성**
    - **Validates: Requirements 2.3, 2.4**

  - [ ]* 2.3 파일 크기 검증 속성 테스트 작성 (fast-check)
    - **Property 2: 파일 크기 검증**
    - **Validates: Requirements 2.5**

  - [x] 2.4 BPM 유효성 검증 및 변환 유틸리티 구현
    - `src/utils/bpmUtils.ts` 에 validateBpm, bpmToIntervalMs, intervalMsToBpm 함수 구현
    - BPM 범위: 40-240, 변환 공식: interval = 60000 / bpm
    - _Requirements: 6.2, 6.4, 6.6_

  - [ ]* 2.5 BPM 유효성 검증 속성 테스트 작성 (fast-check)
    - **Property 8: BPM 유효성 검증**
    - **Validates: Requirements 6.2, 6.6**

  - [ ]* 2.6 BPM-밀리초 변환 속성 테스트 작성 (fast-check)
    - **Property 9: BPM-밀리초 변환 정확성**
    - **Validates: Requirements 6.4**

- [x] 3. 체크포인트 - 기본 유틸리티 검증
  - 모든 테스트가 통과하는지 확인하고, 질문이 있으면 사용자에게 문의합니다.

- [x] 4. 백엔드 오디오 소스 분리 엔진 구현
  - [x] 4.1 오디오 소스 분리 엔진 구현
    - `app/engines/separation.py` 에 AudioSourceSeparationEngine 클래스 구현
    - Demucs 모델 로딩 및 4-stem 분리 (보컬, 드럼, 베이스, 기타)
    - 기타 트랙 WAV 형식 추출 및 파일 해시 기반 캐싱
    - 오류 처리: 기타 트랙 분리 불가 시 메시지 반환, 처리 오류 시 로그 기록
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6_

  - [x] 4.2 소스 분리 REST API 엔드포인트 구현
    - `app/routers/separation.py` 에 POST /api/separation, GET /api/separation/{taskId} 엔드포인트 구현
    - 비동기 작업 처리 (taskId 기반 상태 조회)
    - _Requirements: 3.1, 3.3, 9.1_

  - [ ]* 4.3 분리된 기타 트랙 WAV 형식 속성 테스트 작성 (hypothesis)
    - **Property 3: 분리된 기타 트랙 WAV 형식 보장**
    - **Validates: Requirements 3.5**

- [x] 5. 백엔드 연주 분석 엔진 구현
  - [x] 5.1 연주 분석 엔진 구현
    - `app/engines/analysis.py` 에 PerformanceAnalysisEngine 클래스 구현
    - librosa 기반 피치 감지(analyzePitch), 리듬 분석(analyzeRhythm), 타이밍 분석(analyzeTiming) 구현
    - calculateOverallScore, identifyDifferentSections 구현
    - 각 점수 0-100 정수 범위 보장, 차이 구간 유효성 보장
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.7_

  - [x] 5.2 연주 분석 REST API 엔드포인트 구현
    - `app/routers/analysis.py` 에 POST /api/analysis, GET /api/analysis/{taskId} 엔드포인트 구현
    - 원곡 + 연주 오디오 동시 업로드 처리
    - _Requirements: 4.1, 4.4, 4.6, 9.2_

  - [ ]* 5.3 분석 점수 범위 속성 테스트 작성 (hypothesis)
    - **Property 4: 분석 점수 범위 불변 조건**
    - **Validates: Requirements 4.2, 4.3**

  - [ ]* 5.4 차이 구간 유효성 속성 테스트 작성 (hypothesis)
    - **Property 5: 차이 구간 유효성 불변 조건**
    - **Validates: Requirements 4.5**

- [-] 6. 백엔드 타브 생성 엔진 구현
  - [x] 6.1 타브 생성 엔진 구현
    - `app/engines/tab_generation.py` 에 TabGenerationEngine 클래스 구현
    - librosa 기반 피치/온셋 감지(detectNotes), 프렛보드 매핑(mapToFretboard), 타브 데이터 생성(generateTab) 구현
    - 줄 번호 1-6, 프렛 번호 0-24 범위 보장
    - _Requirements: 5.1, 5.2, 5.3, 5.6_

  - [x] 6.2 타브 포맷터 구현
    - `app/engines/tab_formatter.py` 에 TabFormatter 클래스 구현
    - formatToText: TabData → 텍스트 기반 타브 악보 문자열 변환
    - parseFromText: 텍스트 타브 악보 → TabData 파싱
    - 라운드트립 보장: parseFromText(formatToText(tabData)) == tabData
    - _Requirements: 5.7, 5.8_

  - [x] 6.3 타브 생성 REST API 엔드포인트 구현
    - `app/routers/tab.py` 에 POST /api/tab, GET /api/tab/{taskId} 엔드포인트 구현
    - _Requirements: 5.1, 5.4, 9.3_

  - [ ]* 6.4 타브 노트 유효성 속성 테스트 작성 (hypothesis)
    - **Property 6: 타브 노트 구조 유효성**
    - **Validates: Requirements 5.2, 5.3**

  - [ ]* 6.5 타브 라운드트립 속성 테스트 작성 (hypothesis)
    - **Property 7: 타브 악보 라운드트립**
    - **Validates: Requirements 5.7, 5.8**

- [x] 7. 체크포인트 - 백엔드 엔진 검증
  - 모든 테스트가 통과하는지 확인하고, 질문이 있으면 사용자에게 문의합니다.

- [x] 8. 백엔드 크로매틱 코치 엔진 구현
  - [x] 8.1 나쁜 버릇 감지 함수 구현
    - `app/engines/chromatic_coach.py` 에 ChromaticCoach 클래스 구현
    - detectPickScratch: 고주파 잡음 비율 > 15% 시 피크 비빔 판정
    - detectMuteFail: 비대상 줄 음량 > -40dB 시 뮤트 실패 판정
    - detectTimingDeviation: 편차 > 비트 간격 20% 시 박자 이탈 판정
    - detectLeftHandDelay: 실제 간격 > 예상 간격 × 1.3 시 왼손 지연 판정
    - _Requirements: 8.2, 8.3, 8.4_

  - [x] 8.2 나쁜 버릇 리포트 생성 함수 구현
    - generateReport: BadHabitDetection 목록에서 유형별 집계, 발생 비율 계산, 최빈 구간 식별
    - _Requirements: 8.6, 8.7_

  - [x] 8.3 크로매틱 코칭 WebSocket 및 REST API 구현
    - `app/routers/chromatic.py` 에 WebSocket /ws/chromatic 핸들러 구현
    - POST /api/chromatic/session/start, POST /api/chromatic/session/{sessionId}/stop 엔드포인트 구현
    - 실시간 오디오 청크 수신 및 나쁜 버릇 감지 결과 전송
    - _Requirements: 8.1, 8.5, 9.4_

  - [ ]* 8.4 피크 비빔 감지 임계값 속성 테스트 작성 (hypothesis)
    - **Property 10: 피크 비빔 감지 임계값 일관성**
    - **Validates: Requirements 8.3**

  - [ ]* 8.5 뮤트 실패 감지 임계값 속성 테스트 작성 (hypothesis)
    - **Property 11: 뮤트 실패 감지 임계값 일관성**
    - **Validates: Requirements 8.4**

  - [ ]* 8.6 박자 이탈 감지 속성 테스트 작성 (hypothesis)
    - **Property 12: 박자 이탈 감지 일관성**
    - **Validates: Requirements 8.2**

  - [ ]* 8.7 왼손 지연 감지 속성 테스트 작성 (hypothesis)
    - **Property 13: 왼손 지연 감지 일관성**
    - **Validates: Requirements 8.2**

  - [ ]* 8.8 나쁜 버릇 리포트 집계 속성 테스트 작성 (hypothesis)
    - **Property 14: 나쁜 버릇 리포트 집계 정확성**
    - **Validates: Requirements 8.6, 8.7**

- [x] 9. 체크포인트 - 크로매틱 코치 검증
  - 모든 테스트가 통과하는지 확인하고, 질문이 있으면 사용자에게 문의합니다.

- [x] 10. 프론트엔드 오디오 입력 모듈 구현
  - [x] 10.1 오디오 녹음 훅 구현
    - `src/hooks/useAudioRecorder.ts` 에 마이크 접근 권한 요청, 녹음 시작/중지, WAV 형식 변환 로직 구현
    - 마이크 권한 거부 시 오류 메시지 처리
    - _Requirements: 2.1, 2.2, 2.6_

  - [x] 10.2 파일 업로드 컴포넌트 구현
    - `src/components/AudioUploader.tsx` 에 드래그앤드롭 및 파일 선택 업로드 UI 구현
    - fileValidation 유틸리티를 사용한 형식/크기 검증
    - 검증 실패 시 오류 메시지 표시
    - _Requirements: 2.3, 2.4, 2.5_

  - [x] 10.3 오디오 입력 모듈 통합 컴포넌트 구현
    - `src/components/AudioInputModule.tsx` 에 녹음/업로드 통합 UI 구현
    - 녹음 모드와 업로드 모드 전환
    - _Requirements: 2.1, 2.3_

- [x] 11. 프론트엔드 메트로놈 엔진 구현
  - [x] 11.1 메트로놈 엔진 훅 구현
    - `src/hooks/useMetronome.ts` 에 Web Audio API 기반 메트로놈 구현
    - AudioContext.currentTime 기반 look-ahead 스케줄링으로 ±5ms 정밀도 보장
    - start(bpm), stop(), setBpm(bpm), isPlaying() 인터페이스 구현
    - bpmUtils 유틸리티 활용
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

  - [x] 11.2 메트로놈 UI 컴포넌트 구현
    - `src/components/Metronome.tsx` 에 BPM 입력, 시작/정지 버튼, 현재 BPM 표시 UI 구현
    - BPM 범위 초과 시 오류 메시지 표시
    - _Requirements: 6.1, 6.2, 6.6_

- [x] 12. 프론트엔드 결과 시각화 및 타브 렌더러 구현
  - [x] 12.1 분석 결과 시각화 컴포넌트 구현
    - `src/components/ResultVisualizer.tsx` 에 전체 유사도 점수, 항목별 점수, 시간축 비교 시각화 구현
    - _Requirements: 4.4_

  - [x] 12.2 타브 악보 렌더러 컴포넌트 구현
    - `src/components/TabRenderer.tsx` 에 TabData를 6줄 프렛 번호 형식으로 시각적 렌더링
    - 텍스트 형식 내보내기(다운로드) 기능 구현
    - _Requirements: 5.2, 5.4, 5.5_

  - [x] 12.3 크로매틱 패턴 시각화 컴포넌트 구현
    - `src/components/PatternVisualizer.tsx` 에 프렛보드 다이어그램 기반 패턴 표시
    - 현재 연주 위치 강조 표시
    - _Requirements: 7.2, 7.3, 7.4_

  - [x] 12.4 나쁜 버릇 리포트 컴포넌트 구현
    - `src/components/BadHabitReport.tsx` 에 유형별 발생 횟수, 비율, 최빈 구간 표시
    - 실시간 감지 결과 표시 영역 포함
    - _Requirements: 8.5, 8.6, 8.7_

- [x] 13. 프론트엔드 페이지 및 API 서비스 구현
  - [x] 13.1 백엔드 API 호출 서비스 구현
    - `src/services/api.ts` 에 소스 분리, 연주 분석, 타브 생성 API 호출 함수 구현
    - `src/services/websocket.ts` 에 크로매틱 코칭 WebSocket 연결 관리 구현
    - 네트워크 오류 처리 및 재시도 로직, WebSocket 자동 재연결 (최대 3회)
    - _Requirements: 3.1, 4.1, 5.1, 8.1, 9.5_

  - [x] 13.2 소스 분리 페이지 구현
    - `src/pages/SeparationPage.tsx` 에 오디오 업로드, 분리 요청, 진행률 표시, 기타 트랙 파형 미리보기/재생 구현
    - _Requirements: 3.1, 3.3, 9.5_

  - [x] 13.3 연주 분석 페이지 구현
    - `src/pages/AnalysisPage.tsx` 에 원곡 + 연주 오디오 업로드, 분석 요청, 결과 표시 구현
    - 원곡/연주 미제공 시 안내 메시지 표시
    - _Requirements: 4.1, 4.4, 4.6_

  - [x] 13.4 타브 생성 페이지 구현
    - `src/pages/TabPage.tsx` 에 오디오 업로드, 타브 생성 요청, 타브 렌더링, 텍스트 다운로드 구현
    - _Requirements: 5.1, 5.4, 5.5_

  - [x] 13.5 크로매틱 연습 페이지 구현
    - `src/pages/ChromaticPage.tsx` 에 BPM 설정, 패턴 선택(최소 4가지), 메트로놈, 실시간 피드백, 세션 리포트 통합 구현
    - 크로매틱 패턴: 1-2-3-4, 1-3-2-4, 4-3-2-1, 1-2-4-3
    - _Requirements: 6.1, 7.1, 7.2, 7.3, 8.1, 8.5_

- [x] 14. 내비게이션 및 라우팅 통합
  - [x] 14.1 내비게이션 메뉴 및 라우팅 구현
    - `src/components/Navigation.tsx` 에 상단 내비게이션 메뉴 구현 (소스 분리, 연주 분석, 타브 생성, 크로매틱 연습)
    - `src/App.tsx` 에 react-router-dom 기반 라우팅 설정
    - 반응형 레이아웃 적용
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 14.2 진행률 표시 및 로딩 상태 관리 구현
    - 소스 분리, 연주 분석, 타브 생성 요청 시 진행률 표시줄 및 예상 남은 시간 표시
    - _Requirements: 9.5_

- [x] 15. 최종 체크포인트 - 전체 통합 검증
  - 모든 테스트가 통과하는지 확인하고, 질문이 있으면 사용자에게 문의합니다.

## Notes

- `*` 표시된 태스크는 선택 사항이며, 빠른 MVP를 위해 건너뛸 수 있습니다
- 각 태스크는 추적 가능성을 위해 특정 요구사항을 참조합니다
- 체크포인트를 통해 점진적 검증을 수행합니다
- 속성 테스트는 설계 문서의 정확성 속성(Property 1-14)을 검증합니다
- 단위 테스트는 특정 예제와 엣지 케이스를 검증합니다
