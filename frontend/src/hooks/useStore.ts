import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TranscriptChunk, PipelineStep, Lecture } from '@/lib/api';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export interface OnboardingState {
  omiConnected: boolean;
  qdrantConnected: boolean;
  lyzrConnected: boolean;
  demoCompleted: boolean;
  dismissed: boolean;
}

interface AppStoreState {
  // Session & Lecture state
  activeLecture: Lecture | null;
  liveTranscript: TranscriptChunk[];
  confusionScores: number[];
  latestConfusionScore: number;
  sessionDuration: number; // seconds
  isSessionActive: boolean;

  // Real-time Agent pipeline status
  agentSteps: PipelineStep[];

  // SSE status
  connectionStatus: ConnectionStatus;

  // Demo Replay controls
  demoMode: boolean;
  demoPlaying: boolean;
  demoSpeed: number; // 1, 2, 4

  // Onboarding
  onboarding: OnboardingState;

  // Actions
  setActiveLecture: (lecture: Lecture | null) => void;
  setSessionActive: (active: boolean) => void;
  incrementDuration: () => void;
  setSessionDuration: (duration: number) => void;
  addTranscriptChunk: (chunk: TranscriptChunk) => void;
  setTranscriptChunks: (chunks: TranscriptChunk[]) => void;
  updateChunkScore: (chunkId: string, score: number, reasons?: string[]) => void;
  markChunkFlagged: (chunkId: string) => void;
  setConnectionStatus: (status: ConnectionStatus) => void;
  setAgentSteps: (steps: PipelineStep[]) => void;
  updateAgentStep: (name: PipelineStep['name'], stepUpdate: Partial<PipelineStep>) => void;
  setDemoMode: (enabled: boolean) => void;
  setDemoPlaying: (playing: boolean) => void;
  setDemoSpeed: (speed: number) => void;
  updateOnboarding: (patch: Partial<OnboardingState>) => void;
  resetActiveLecture: () => void;
}

const defaultPipelineSteps: PipelineStep[] = [
  { id: 'step-1', name: 'Orchestrator', status: 'waiting' },
  { id: 'step-2', name: 'Detector', status: 'waiting' },
  { id: 'step-3', name: 'Content', status: 'waiting' },
  { id: 'step-4', name: 'Scheduler', status: 'waiting' },
];

export const useStore = create<AppStoreState>()(
  persist(
    (set, get) => ({
      activeLecture: null,
      liveTranscript: [],
      confusionScores: [0.15],
      latestConfusionScore: 0.15,
      sessionDuration: 0,
      isSessionActive: false,

      agentSteps: defaultPipelineSteps,
      connectionStatus: 'disconnected',

      demoMode: false,
      demoPlaying: false,
      demoSpeed: 1,

      onboarding: {
        omiConnected: false,
        qdrantConnected: false,
        lyzrConnected: false,
        demoCompleted: false,
        dismissed: false,
      },

      setActiveLecture: (lecture) => {
        set({
          activeLecture: lecture,
          isSessionActive: lecture?.status === 'active',
          sessionDuration: lecture?.duration || 0,
        });
      },

      setSessionActive: (active) => set({ isSessionActive: active }),

      incrementDuration: () =>
        set((state) => ({ sessionDuration: state.sessionDuration + 1 })),

      setSessionDuration: (duration) => set({ sessionDuration: duration }),

      addTranscriptChunk: (chunk) => {
        set((state) => {
          const exists = state.liveTranscript.some((c) => c.id === chunk.id);
          const newTranscript = exists
            ? state.liveTranscript.map((c) => (c.id === chunk.id ? chunk : c))
            : [...state.liveTranscript, chunk];

          const newScores = [...state.confusionScores, chunk.confusion_score];
          const latest = chunk.confusion_score;

          return {
            liveTranscript: newTranscript,
            confusionScores: newScores.slice(-60), // keep last 60 for sparkline
            latestConfusionScore: latest,
          };
        });
      },

      setTranscriptChunks: (chunks) => {
        const scores = chunks.map((c) => c.confusion_score);
        set({
          liveTranscript: chunks,
          confusionScores: scores.length ? scores.slice(-60) : [0.15],
          latestConfusionScore: scores.length ? scores[scores.length - 1] : 0.15,
        });
      },

      updateChunkScore: (chunkId, score, reasons) => {
        set((state) => {
          const newTranscript = state.liveTranscript.map((c) => {
            if (c.id === chunkId) {
              return {
                ...c,
                confusion_score: score,
                reasons: reasons || c.reasons,
              };
            }
            return c;
          });
          const newScores = [...state.confusionScores, score].slice(-60);
          return {
            liveTranscript: newTranscript,
            confusionScores: newScores,
            latestConfusionScore: score,
          };
        });
      },

      markChunkFlagged: (chunkId) => {
        set((state) => ({
          liveTranscript: state.liveTranscript.map((c) =>
            c.id === chunkId
              ? {
                  ...c,
                  is_flagged: true,
                  confusion_score: Math.max(c.confusion_score, 0.85),
                  reasons: Array.from(new Set([...c.reasons, 'Manual'])),
                }
              : c
          ),
          latestConfusionScore: 0.85,
          confusionScores: [...state.confusionScores, 0.85].slice(-60),
        }));
      },

      setConnectionStatus: (status) => set({ connectionStatus: status }),

      setAgentSteps: (steps) => set({ agentSteps: steps }),

      updateAgentStep: (name, stepUpdate) => {
        set((state) => ({
          agentSteps: state.agentSteps.map((step) =>
            step.name === name ? { ...step, ...stepUpdate } : step
          ),
        }));
      },

      setDemoMode: (enabled) => set({ demoMode: enabled }),
      setDemoPlaying: (playing) => set({ demoPlaying: playing }),
      setDemoSpeed: (speed) => set({ demoSpeed: speed }),

      updateOnboarding: (patch) =>
        set((state) => ({
          onboarding: { ...state.onboarding, ...patch },
        })),

      resetActiveLecture: () =>
        set({
          activeLecture: null,
          liveTranscript: [],
          confusionScores: [0.15],
          latestConfusionScore: 0.15,
          sessionDuration: 0,
          isSessionActive: false,
          agentSteps: defaultPipelineSteps,
        }),
    }),
    {
      name: 'classloop-store',
      partialize: (state) => ({
        onboarding: state.onboarding,
        demoSpeed: state.demoSpeed,
      }),
    }
  )
);
