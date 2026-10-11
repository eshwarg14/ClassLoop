import { useEffect, useRef } from 'react';
import { LectureSSEClient, type SSEMessagePayload } from '@/lib/sse';
import { useStore, type ConnectionStatus } from '@/hooks/useStore';
import type { TranscriptChunk, PipelineStep } from '@/lib/api';

export function useSSE(lectureId: string | null | undefined) {
  const {
    setConnectionStatus,
    addTranscriptChunk,
    updateChunkScore,
    markChunkFlagged,
    updateAgentStep,
    setSessionActive,
    demoMode,
  } = useStore();

  const clientRef = useRef<LectureSSEClient | null>(null);

  useEffect(() => {
    if (!lectureId || demoMode) {
      setConnectionStatus('disconnected');
      return;
    }

    const client = new LectureSSEClient(lectureId, (status: ConnectionStatus) => {
      setConnectionStatus(status);
    });

    clientRef.current = client;

    const unsubscribe = client.subscribe((payload: SSEMessagePayload) => {
      const eventType = payload.event_type;
      const data = payload.data || payload;

      switch (eventType) {
        case 'segment': {
          const chunk: TranscriptChunk = {
            id: (data as any).id || (data as any).chunk_id || `chunk-${Date.now()}`,
            lecture_id: lectureId,
            chunk_index: (data as any).chunk_index ?? 0,
            text: (data as any).text || '',
            start_time: (data as any).start_time ?? 0,
            end_time: (data as any).end_time ?? 0,
            confusion_score: (data as any).confusion_score ?? 0.15,
            reasons: (data as any).reasons ?? [],
            speaker: (data as any).speaker,
            is_flagged: (data as any).is_flagged ?? false,
          };
          addTranscriptChunk(chunk);
          break;
        }

        case 'chunk_scored': {
          const chunkId = (data as any).chunk_id || (data as any).id;
          const score = (data as any).confusion_score ?? (data as any).score ?? 0.5;
          const reasons = (data as any).reasons ?? [];
          if (chunkId) {
            updateChunkScore(chunkId, score, reasons);
          }
          break;
        }

        case 'flag_added': {
          const chunkId = (data as any).chunk_id || (data as any).id;
          if (chunkId) {
            markChunkFlagged(chunkId);
          }
          break;
        }

        case 'agent_step': {
          const stepName = (data as any).step_name || (data as any).name as PipelineStep['name'];
          const status = (data as any).status as PipelineStep['status'];
          const latency = (data as any).latency_ms;
          const inputPreview = (data as any).input;
          const outputPreview = (data as any).output;
          if (stepName) {
            updateAgentStep(stepName, {
              status,
              latency_ms: latency,
              input_preview: inputPreview,
              output_preview: outputPreview,
            });
          }
          break;
        }

        case 'lecture_ended': {
          setSessionActive(false);
          break;
        }

        case 'output_ready': {
          // Can signal notes or quiz completion
          break;
        }

        default:
          break;
      }
    });

    client.connect();

    return () => {
      unsubscribe();
      client.disconnect();
      clientRef.current = null;
    };
  }, [
    lectureId,
    demoMode,
    setConnectionStatus,
    addTranscriptChunk,
    updateChunkScore,
    markChunkFlagged,
    updateAgentStep,
    setSessionActive,
  ]);

  return {
    reconnect: () => clientRef.current?.connect(),
    disconnect: () => clientRef.current?.disconnect(),
  };
}
