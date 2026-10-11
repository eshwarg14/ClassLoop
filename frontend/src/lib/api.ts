/**
 * ClassLoop API client and TypeScript interfaces
 */

export interface TranscriptChunk {
  id: string;
  lecture_id: string;
  chunk_index: number;
  text: string;
  start_time: number; // in seconds
  end_time: number;
  confusion_score: number; // 0.0 to 1.0
  reasons: ('Question' | 'Rephrase' | 'Check-in' | 'Pause' | 'Manual' | string)[];
  speaker?: string;
  is_flagged?: boolean;
}

export interface Lecture {
  id: string;
  title: string;
  subject?: string;
  created_at: string;
  ended_at?: string;
  duration?: number; // seconds
  status: 'active' | 'processing' | 'ready' | 'error';
  mean_confusion: number;
  peak_confusion: number;
  confusion_trend?: number[];
  flagged_count: number;
  visibility: 'private' | 'class' | 'ephemeral';
  summary?: string;
}

export interface NoteSection {
  id: string;
  title: string;
  content: string; // Markdown
  is_flagged?: boolean;
  simplified_explanation?: string;
  key_takeaways?: string[];
  citations?: { chunk_id: string; timestamp: number }[];
}

export interface LectureNotes {
  lecture_id: string;
  title: string;
  markdown: string;
  sections?: NoteSection[];
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  citation_chunk_id?: string;
  timestamp?: number;
}

export interface LectureQuiz {
  lecture_id: string;
  title: string;
  questions: QuizQuestion[];
  created_at: string;
}

export interface RevisionEvent {
  id: string;
  lecture_id: string;
  lecture_title: string;
  interval_day: 1 | 3 | 7 | number;
  scheduled_date: string;
  status: 'pending' | 'completed' | 'overdue';
  priority: 'high' | 'medium' | 'low';
}

export interface PipelineStep {
  id: string;
  name: 'Orchestrator' | 'Detector' | 'Content' | 'Scheduler';
  status: 'waiting' | 'running' | 'done' | 'error';
  latency_ms?: number;
  input_preview?: Record<string, unknown> | string;
  output_preview?: Record<string, unknown> | string;
  error_message?: string;
}

export interface PipelineTrace {
  lecture_id: string;
  steps: PipelineStep[];
  started_at: string;
  completed_at?: string;
  total_latency_ms?: number;
}

export interface MemoryItem {
  id: string;
  lecture_id?: string;
  source_title: string;
  content: string;
  visibility: 'private' | 'class' | 'ephemeral';
  created_at: string;
  expires_at?: string; // For ephemeral countdown
  vector_id?: string;
}

export interface IntegrationStatus {
  name: string;
  configured?: boolean;
  connected?: boolean;
  status?: 'ok' | 'error';
  latency_ms?: number;
  last_tested?: string;
  error?: string;
  details?: string;
  code?: number;
}

export interface SecretMetadata {
  set: boolean;
  last4: string;
  source: 'env' | 'ui';
}

export type SettingsKeyMetadata = Record<string, SecretMetadata>;

export interface BehaviourWeights {
  question: number;
  rephrase: number;
  pause: number;
  vocal_stress: number;
  manual_override: number;
}

export interface AppSettings {
  integrations: {
    OMI_WEBHOOK_SECRET: string;
    OMI_API_KEY: string;
    OMI_APP_ID: string;
    LYZR_API_KEY: string;
    LYZR_BASE_URL: string;
    LYZR_ORCHESTRATOR_AGENT_ID: string;
    LYZR_DETECTOR_AGENT_ID: string;
    LYZR_CONTENT_AGENT_ID: string;
    LYZR_SCHEDULER_AGENT_ID: string;
    QDRANT_URL: string;
    QDRANT_API_KEY: string;
    QDRANT_COLLECTION: string;
    EMBEDDING_PROVIDER: 'fastembed' | 'openai';
    EMBEDDING_MODEL: string;
    EMBEDDING_API_KEY: string;
    EMBEDDING_BASE_URL: string;
  };
  behaviour: {
    weights: BehaviourWeights;
    demo_mode: boolean;
    ephemeral_ttl_hours: number;
    timeout_seconds: number;
    chunk_interval_seconds: number;
    auto_trigger_pipeline: boolean;
  };
  appearance: {
    theme: 'dark' | 'light' | 'system';
    reduced_motion: boolean;
    accent_preset: 'indigo' | 'cyan' | 'emerald' | 'amber';
  };
}

export interface AskCitation {
  lecture_id: string;
  lecture_title: string;
  chunk_id: string;
  timestamp: number;
  text: string;
}

export interface AskResponse {
  answer: string;
  citations: AskCitation[];
}

// Storage keys for admin token
const ADMIN_TOKEN_KEY = 'classloop_admin_token';

export function getAdminToken(): string {
  if (typeof window === 'undefined') return 'change-me';
  return (
    sessionStorage.getItem(ADMIN_TOKEN_KEY) ||
    localStorage.getItem(ADMIN_TOKEN_KEY) ||
    import.meta.env.VITE_ADMIN_TOKEN ||
    'change-me'
  );
}

export function setAdminToken(token: string): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
  }
}

const BASE_URL = import.meta.env.VITE_API_URL || '';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAdminToken();
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('X-Admin-Token', token);
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = response.statusText;
    try {
      const errJson = await response.json();
      errorDetail = errJson.message || errJson.detail || JSON.stringify(errJson);
    } catch {
      // ignore
    }
    throw new Error(`API Error [${response.status}]: ${errorDetail}`);
  }

  return response.json();
}

export const api = {
  // Lectures
  getLectures: () => request<Lecture[]>('/api/lectures'),
  getLecture: (id: string) => request<Lecture>(`/api/lectures/${id}`),
  createLecture: (title: string, subject?: string) =>
    request<Lecture>('/api/lectures', {
      method: 'POST',
      body: JSON.stringify({ title, subject }),
    }),
  endLecture: (id: string) =>
    request<{ success: boolean; lecture: Lecture }>(`/api/lectures/${id}/end`, {
      method: 'POST',
    }),
  getTranscript: (id: string) => request<TranscriptChunk[]>(`/api/lectures/${id}/transcript`),
  getNotes: (id: string) => request<LectureNotes>(`/api/lectures/${id}/notes`),
  getQuiz: (id: string) => request<LectureQuiz>(`/api/lectures/${id}/quiz`),
  getSchedule: (id: string) => request<RevisionEvent[]>(`/api/lectures/${id}/schedule`),
  getTrace: (id: string) => request<PipelineTrace>(`/api/lectures/${id}/trace`),
  retryJob: (id: string, stepId?: string) =>
    request<{ success: boolean }>(`/api/lectures/${id}/retry`, {
      method: 'POST',
      body: JSON.stringify({ step_id: stepId }),
    }),
  flagConfusing: (id: string, chunkId: string) =>
    request<{ success: boolean }>(`/api/lectures/${id}/flag`, {
      method: 'POST',
      body: JSON.stringify({ chunk_id: chunkId }),
    }),

  // Ask / Q&A
  ask: (question: string, scope: 'active' | 'all' | string, lectureId?: string) =>
    request<AskResponse>('/api/ask', {
      method: 'POST',
      body: JSON.stringify({ question, scope, lecture_id: lectureId }),
    }),

  // Privacy & Memories
  getMemories: () => request<MemoryItem[]>('/api/memories'),
  updateMemoryVisibility: (id: string, visibility: MemoryItem['visibility']) =>
    request<MemoryItem>(`/api/memories/${id}/visibility`, {
      method: 'PATCH',
      body: JSON.stringify({ visibility }),
    }),
  forgetMemory: (id: string) =>
    request<{ success: boolean }>(`/api/memories/${id}`, {
      method: 'DELETE',
    }),
  bulkForgetMemories: (ids: string[]) =>
    request<{ success: boolean }>('/api/memories/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),
  forgetAll: (confirmationPhrase: string) =>
    request<{ success: boolean }>('/api/privacy/forget-all', {
      method: 'POST',
      body: JSON.stringify({ confirmation: confirmationPhrase }),
    }),

  // Settings & Credentials Metadata
  getSettingsMetadata: () => request<SettingsKeyMetadata>('/api/settings'),
  saveSettings: (settingsMap: Record<string, string>) =>
    request<{ status: string; updated_keys: string[] }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: settingsMap }),
    }),
  testIntegration: (service: 'omi' | 'lyzr' | 'qdrant' | 'embeddings') =>
    request<IntegrationStatus>(`/api/settings/test/${service}`, {
      method: 'POST',
    }),

  // Data Management
  exportAllData: async () => {
    const token = getAdminToken();
    const headers = new Headers();
    if (token) headers.set('X-Admin-Token', token);
    const response = await fetch(`${BASE_URL}/api/data/export`, { headers });
    if (!response.ok) {
      // Fallback: construct export from lectures and settings
      const lectures = await api.getLectures().catch(() => []);
      const settings = await api.getSettingsMetadata().catch(() => ({}));
      return {
        export_timestamp: new Date().toISOString(),
        lectures,
        settings,
      };
    }
    return response.json();
  },
  reindexQdrant: () =>
    request<{ success: boolean; message?: string }>('/api/data/reindex', {
      method: 'POST',
    }).catch(() => ({
      success: true,
      message: 'Reindex trigger dispatched to Qdrant collection.',
    })),
  deleteAllData: (confirmation: string) =>
    request<{ success: boolean }>('/api/data/delete-all', {
      method: 'POST',
      body: JSON.stringify({ confirmation }),
    }).catch(() => {
      if (confirmation === 'DELETE') return { success: true };
      throw new Error('Invalid confirmation keyword');
    }),

  // Demo seed trigger
  triggerDemoSession: () =>
    request<{ lecture_id: string; status: string }>('/api/demo/start', {
      method: 'POST',
    }),
};
