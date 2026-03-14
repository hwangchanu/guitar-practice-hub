import type { BadHabitDetection } from '../types';

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_DELAY_MS = 1000;

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface ChromaticMessage {
  session_id: string;
  audio_chunk: number[];
  note_info?: {
    string_num: number;
    fret: number;
    timestamp: number;
    expected_time?: number;
    prev_note_time?: number;
  };
}

export interface ChromaticResponse {
  detections?: BadHabitDetection[];
  error?: string;
}

export type DetectionCallback = (detections: BadHabitDetection[]) => void;
export type StateChangeCallback = (state: ConnectionState) => void;
export type ErrorCallback = (error: string) => void;

export class ChromaticWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private sessionId: string | null = null;
  private _state: ConnectionState = 'disconnected';

  private onDetection: DetectionCallback | null = null;
  private onStateChange: StateChangeCallback | null = null;
  private onError: ErrorCallback | null = null;

  private url: string;

  constructor(baseUrl = '') {
    const protocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = baseUrl || (typeof window !== 'undefined' ? window.location.host : 'localhost');
    this.url = `${protocol}//${host}/ws/chromatic`;
  }

  get state(): ConnectionState {
    return this._state;
  }

  private setState(state: ConnectionState): void {
    this._state = state;
    this.onStateChange?.(state);
  }

  setOnDetection(cb: DetectionCallback | null): void {
    this.onDetection = cb;
  }

  setOnStateChange(cb: StateChangeCallback | null): void {
    this.onStateChange = cb;
  }

  setOnError(cb: ErrorCallback | null): void {
    this.onError = cb;
  }

  connect(sessionId: string): void {
    this.sessionId = sessionId;
    this.reconnectAttempts = 0;
    this.openConnection();
  }

  private openConnection(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try { this.ws.close(); } catch { /* ignore */ }
    }

    this.setState('connecting');

    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.setState('error');
      this.onError?.('WebSocket 연결을 생성할 수 없습니다.');
      return;
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.setState('connected');
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data: ChromaticResponse = JSON.parse(event.data);
        if (data.error) {
          this.onError?.(data.error);
          return;
        }
        if (data.detections && data.detections.length > 0) {
          this.onDetection?.(data.detections);
        }
      } catch {
        // ignore malformed messages
      }
    };

    this.ws.onerror = () => {
      this.setState('error');
    };

    this.ws.onclose = () => {
      if (this._state === 'disconnected') return;
      this.attemptReconnect();
    };
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      this.setState('disconnected');
      this.onError?.('연결이 끊어졌습니다. 최대 재연결 시도 횟수를 초과했습니다.');
      return;
    }

    this.reconnectAttempts++;
    this.setState('connecting');
    this.onError?.(`연결이 끊어졌습니다. 재연결 중... (${this.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    setTimeout(() => {
      if (this._state === 'disconnected') return;
      this.openConnection();
    }, RECONNECT_DELAY_MS * this.reconnectAttempts);
  }

  send(message: ChromaticMessage): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(JSON.stringify(message));
  }

  sendAudioChunk(
    audioChunk: number[],
    noteInfo?: ChromaticMessage['note_info'],
  ): void {
    if (!this.sessionId) return;
    this.send({
      session_id: this.sessionId,
      audio_chunk: audioChunk,
      note_info: noteInfo,
    });
  }

  disconnect(): void {
    this.setState('disconnected');
    this.sessionId = null;
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try { this.ws.close(); } catch { /* ignore */ }
      this.ws = null;
    }
  }
}
