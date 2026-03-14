# 🎸 Guitar Practice Hub

기타 학습자를 위한 올인원 웹 애플리케이션입니다. 네 가지 핵심 기능을 하나의 플랫폼에서 제공합니다.

## 주요 기능

| 기능 | 설명 |
|------|------|
| **오디오 소스 분리** | 혼합 음원(보컬, 드럼, 베이스, 기타)에서 기타 트랙만 자동 분리 (Demucs 기반) |
| **연주 비교 분석** | 원곡 기타 트랙과 사용자 연주를 비교하여 피치·리듬·타이밍 유사도 점수 제공 |
| **타브 악보 생성** | 오디오에서 기타 음을 감지하여 6줄 프렛 번호 형식의 타브 악보 자동 생성 |
| **크로매틱 코칭** | 메트로놈 + 연습 패턴 + 나쁜 버릇(피크 비빔, 뮤트 실패, 박자 이탈, 왼손 지연) 실시간 감지 |

## 기술 스택

- **프론트엔드**: React 19 + TypeScript, Vite, React Router, Web Audio API
- **백엔드**: Python, FastAPI, Demucs, librosa, NumPy
- **통신**: REST API + WebSocket (실시간 크로매틱 코칭)
- **테스트**: Vitest + fast-check (프론트엔드), pytest + hypothesis (백엔드)

## 프로젝트 구조

```
guitar-practice-hub/
├── frontend/                # React + TypeScript 프론트엔드
│   ├── src/
│   │   ├── components/      # UI 컴포넌트 (AudioUploader, Metronome, TabRenderer 등)
│   │   ├── hooks/           # 커스텀 훅 (useAudioRecorder, useMetronome)
│   │   ├── pages/           # 페이지 (Separation, Analysis, Tab, Chromatic)
│   │   ├── services/        # API 호출 및 WebSocket 클라이언트
│   │   ├── types/           # TypeScript 타입 정의
│   │   └── utils/           # 유틸리티 (파일 검증, BPM 변환)
│   └── package.json
├── backend/                 # Python FastAPI 백엔드
│   ├── app/
│   │   ├── engines/         # 핵심 엔진 (분리, 분석, 타브 생성, 크로매틱 코치)
│   │   ├── models/          # Pydantic 데이터 모델
│   │   ├── routers/         # API 엔드포인트
│   │   └── main.py          # FastAPI 앱 진입점
│   ├── tests/               # 백엔드 테스트
│   └── requirements.txt
└── README.md
```

## 시작하기

### 사전 요구사항

- Node.js 18+
- Python 3.10+
- pip

### 백엔드 설정

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

서버가 시작되면 http://localhost:8000/docs 에서 API 문서를 확인할 수 있습니다.

### 프론트엔드 설정

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 http://localhost:5173 으로 접속합니다.

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/separation` | 오디오 소스 분리 요청 |
| `GET` | `/api/separation/{taskId}` | 분리 결과 조회 |
| `POST` | `/api/analysis` | 연주 비교 분석 요청 (원곡 + 연주 업로드) |
| `GET` | `/api/analysis/{taskId}` | 분석 결과 조회 |
| `POST` | `/api/tab` | 타브 악보 생성 요청 |
| `GET` | `/api/tab/{taskId}` | 타브 생성 결과 조회 |
| `POST` | `/api/chromatic/session/start` | 크로매틱 연습 세션 시작 |
| `POST` | `/api/chromatic/session/{sessionId}/stop` | 세션 종료 및 리포트 반환 |
| `WS` | `/ws/chromatic` | 실시간 오디오 스트리밍 및 나쁜 버릇 감지 |

## 테스트 실행

### 프론트엔드 테스트

```bash
cd frontend
npx vitest --run
```

### 백엔드 테스트

```bash
python -m pytest backend/tests/ -v
```

## 지원 오디오 형식

- MP3, WAV
- 최대 파일 크기: 50MB

## 라이선스

MIT
