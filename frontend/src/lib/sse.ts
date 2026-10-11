/**
 * Server-Sent Events client for real-time lecture streaming
 */

export interface SSEMessagePayload<T = unknown> {
  event_type: 'segment' | 'chunk_scored' | 'flag_added' | 'lecture_ended' | 'agent_step' | 'output_ready' | string;
  lecture_id: string;
  timestamp: string;
  data?: T;
  [key: string]: unknown;
}

export type SSEEventHandler = (payload: SSEMessagePayload) => void;

export class LectureSSEClient {
  private lectureId: string;
  private url: string;
  private lastEventId: string | null = null;
  private abortController: AbortController | null = null;
  private listeners: Set<SSEEventHandler> = new Set();
  private isConnected: boolean = false;
  private reconnectTimeout: number | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private onStatusChange?: (status: 'connected' | 'connecting' | 'disconnected' | 'error') => void;

  constructor(
    lectureId: string,
    onStatusChange?: (status: 'connected' | 'connecting' | 'disconnected' | 'error') => void
  ) {
    this.lectureId = lectureId;
    this.url = `/api/stream/${lectureId}`;
    this.onStatusChange = onStatusChange;
  }

  public subscribe(handler: SSEEventHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  public connect(): void {
    if (this.isConnected) return;
    this.disconnect();

    this.onStatusChange?.('connecting');
    this.abortController = new AbortController();
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
    };

    if (this.lastEventId) {
      headers['Last-Event-ID'] = this.lastEventId;
    }

    fetch(this.url, {
      signal: this.abortController.signal,
      headers,
    })
      .then(async (response) => {
        if (!response.ok || !response.body) {
          throw new Error(`SSE HTTP Error ${response.status}`);
        }

        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.onStatusChange?.('connected');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            this.processSSEBlock(part);
          }
        }

        // Stream completed normally or was closed by server
        this.handleDisconnect();
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        this.handleDisconnect(err);
      });
  }

  private processSSEBlock(block: string): void {
    const lines = block.split('\n');
    let eventName = 'message';
    let dataStr = '';
    let eventId: string | null = null;

    for (const line of lines) {
      if (line.startsWith(':')) {
        // Comment or keepalive ping
        continue;
      }
      if (line.startsWith('id:')) {
        eventId = line.slice(3).trim();
        this.lastEventId = eventId;
      } else if (line.startsWith('event:')) {
        eventName = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        dataStr += (dataStr ? '\n' : '') + line.slice(5).trim();
      }
    }

    if (!dataStr) return;

    try {
      const parsed = JSON.parse(dataStr);
      const payload: SSEMessagePayload = {
        ...parsed,
        event_type: eventName !== 'message' ? eventName : parsed.event_type || 'message',
      };

      for (const listener of this.listeners) {
        listener(payload);
      }
    } catch {
      // In case data is a plain string
      const payload: SSEMessagePayload = {
        event_type: eventName,
        lecture_id: this.lectureId,
        timestamp: new Date().toISOString(),
        data: dataStr,
      };
      for (const listener of this.listeners) {
        listener(payload);
      }
    }
  }

  private handleDisconnect(error?: Error): void {
    this.isConnected = false;
    this.onStatusChange?.(error ? 'error' : 'disconnected');

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 15000);
      this.reconnectAttempts++;
      this.reconnectTimeout = window.setTimeout(() => {
        this.connect();
      }, delay);
    }
  }

  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.isConnected = false;
    this.onStatusChange?.('disconnected');
  }
}
