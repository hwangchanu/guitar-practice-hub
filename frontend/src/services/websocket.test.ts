import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ChromaticWebSocket } from './websocket';
import type { ConnectionState } from './websocket';

// ---------------------------------------------------------------------------
// Mock WebSocket via class replacement on globalThis
// ---------------------------------------------------------------------------
let mockWsInstances: MockWS[] = [];

class MockWS {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readyState = MockWS.OPEN;
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    mockWsInstances.push(this);
    // Trigger onopen asynchronously
    setTimeout(() => this.onopen?.(new Event('open')), 0);
  }

  send(data: string) { this.sent.push(data); }
  close() { this.readyState = MockWS.CLOSED; }

  // helpers
  triggerMessage(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }));
  }
  triggerClose() { this.onclose?.({} as CloseEvent); }
}

const OriginalWebSocket = globalThis.WebSocket;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  mockWsInstances = [];
  // Replace global WebSocket with our mock class
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).WebSocket = MockWS;
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  globalThis.WebSocket = OriginalWebSocket;
});

describe('ChromaticWebSocket', () => {
  it('connects and transitions to connected state', async () => {
    const states: ConnectionState[] = [];
    const client = new ChromaticWebSocket('localhost:8000');
    client.setOnStateChange((s) => states.push(s));

    client.connect('sess-1');
    expect(client.state).toBe('connecting');

    await vi.advanceTimersByTimeAsync(10);
    expect(client.state).toBe('connected');
    expect(states).toContain('connected');

    client.disconnect();
  });

  it('sends audio chunks as JSON', async () => {
    const client = new ChromaticWebSocket('localhost:8000');
    client.connect('sess-1');
    await vi.advanceTimersByTimeAsync(10);

    client.sendAudioChunk([0.1, 0.2], { string_num: 1, fret: 3, timestamp: 1.0 });

    const ws = mockWsInstances[0];
    expect(ws.sent.length).toBe(1);
    const parsed = JSON.parse(ws.sent[0]);
    expect(parsed.session_id).toBe('sess-1');
    expect(parsed.audio_chunk).toEqual([0.1, 0.2]);
    expect(parsed.note_info.string_num).toBe(1);

    client.disconnect();
  });

  it('invokes detection callback on incoming detections', async () => {
    const detections: unknown[] = [];
    const client = new ChromaticWebSocket('localhost:8000');
    client.setOnDetection((d) => detections.push(...d));
    client.connect('sess-1');
    await vi.advanceTimersByTimeAsync(10);

    mockWsInstances[0].triggerMessage({
      detections: [
        { type: 'pick_scratch', timestamp: 1.0, position: { string: 1, fret: 3 }, details: 'test' },
      ],
    });

    expect(detections.length).toBe(1);
    client.disconnect();
  });

  it('invokes error callback on server error message', async () => {
    const errors: string[] = [];
    const client = new ChromaticWebSocket('localhost:8000');
    client.setOnError((e) => errors.push(e));
    client.connect('sess-1');
    await vi.advanceTimersByTimeAsync(10);

    mockWsInstances[0].triggerMessage({ error: '유효하지 않은 세션입니다.' });
    expect(errors).toContain('유효하지 않은 세션입니다.');

    client.disconnect();
  });

  it('attempts reconnection on close (max 3 times)', async () => {
    const errors: string[] = [];
    const client = new ChromaticWebSocket('localhost:8000');
    client.setOnError((e) => errors.push(e));
    client.connect('sess-1');
    await vi.advanceTimersByTimeAsync(10);
    expect(client.state).toBe('connected');

    // Replace WebSocket with one that does NOT auto-fire onopen (simulates failed connection)
    let failCount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).WebSocket = class FailWS {
      static readonly OPEN = 1;
      static readonly CLOSED = 3;
      readonly OPEN = 1;
      readonly CLOSED = 3;
      readonly CONNECTING = 0;
      readonly CLOSING = 2;
      readyState = 0; // CONNECTING
      onopen: ((ev: Event) => void) | null = null;
      onmessage: ((ev: MessageEvent) => void) | null = null;
      onerror: ((ev: Event) => void) | null = null;
      onclose: ((ev: CloseEvent) => void) | null = null;
      url: string;
      sent: string[] = [];
      constructor(url: string) {
        this.url = url;
        failCount++;
        mockWsInstances.push(this as unknown as MockWS);
        // Simulate connection failure: fire onerror then onclose
        setTimeout(() => {
          this.onerror?.(new Event('error'));
          this.onclose?.({} as CloseEvent);
        }, 5);
      }
      send(data: string) { this.sent.push(data); }
      close() { this.readyState = 3; }
    };

    // Trigger close on the original connected socket
    mockWsInstances[0].triggerClose();
    // Wait for reconnect attempts to exhaust (3 attempts with increasing delays)
    await vi.advanceTimersByTimeAsync(20000);

    expect(client.state).toBe('disconnected');
    expect(errors.some((e) => e.includes('최대 재연결'))).toBe(true);
    expect(failCount).toBe(3);

    client.disconnect();
  });

  it('disconnect cleans up and sets state', async () => {
    const client = new ChromaticWebSocket('localhost:8000');
    client.connect('sess-1');
    await vi.advanceTimersByTimeAsync(10);

    client.disconnect();
    expect(client.state).toBe('disconnected');
  });

  it('does not send when not connected', () => {
    const client = new ChromaticWebSocket('localhost:8000');
    client.sendAudioChunk([0.1], { string_num: 1, fret: 0, timestamp: 0 });
    // No WebSocket created, no crash
    expect(mockWsInstances.length).toBe(0);
  });
});
