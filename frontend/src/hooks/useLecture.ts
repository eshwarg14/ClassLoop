import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Lecture, type LectureNotes, type LectureQuiz, type RevisionEvent, type PipelineTrace, type PipelineStep, type AskResponse } from '@/lib/api';

export function useLectures() {
  return useQuery<Lecture[]>({
    queryKey: ['lectures'],
    queryFn: async () => {
      try {
        return await api.getLectures();
      } catch (err) {
        console.warn('API error fetching lectures, falling back to cached or mock data', err);
        return [];
      }
    },
    staleTime: 1000 * 30, // 30s
  });
}

export function useLecture(id: string | undefined) {
  return useQuery<Lecture | null>({
    queryKey: ['lecture', id],
    queryFn: async () => {
      if (!id) return null;
      try {
        return await api.getLecture(id);
      } catch (err) {
        console.warn(`API error fetching lecture ${id}:`, err);
        return null;
      }
    },
    enabled: Boolean(id),
  });
}

export function useLectureNotes(id: string | undefined) {
  return useQuery<LectureNotes | null>({
    queryKey: ['lecture-notes', id],
    queryFn: async () => {
      if (!id) return null;
      try {
        return await api.getNotes(id);
      } catch (err) {
        console.warn(`API error fetching notes for ${id}:`, err);
        return null;
      }
    },
    enabled: Boolean(id),
  });
}

export function useLectureQuiz(id: string | undefined) {
  return useQuery<LectureQuiz | null>({
    queryKey: ['lecture-quiz', id],
    queryFn: async () => {
      if (!id) return null;
      try {
        return await api.getQuiz(id);
      } catch (err) {
        console.warn(`API error fetching quiz for ${id}:`, err);
        return null;
      }
    },
    enabled: Boolean(id),
  });
}

export function useLectureSchedule(id: string | undefined) {
  return useQuery<RevisionEvent[]>({
    queryKey: ['lecture-schedule', id],
    queryFn: async () => {
      if (!id) return [];
      try {
        return await api.getSchedule(id);
      } catch (err) {
        console.warn(`API error fetching schedule for ${id}:`, err);
        return [];
      }
    },
    enabled: Boolean(id),
  });
}

export function useLectureTrace(id: string | undefined) {
  return useQuery<PipelineTrace | null>({
    queryKey: ['lecture-trace', id],
    queryFn: async () => {
      if (!id) return null;
      try {
        const res = await api.getTrace(id);
        if (Array.isArray(res)) {
          const nameMap: Record<string, PipelineStep['name']> = {
            orchestrator: 'Orchestrator',
            confusion_detector: 'Detector',
            content_agent: 'Content',
            scheduler_agent: 'Scheduler',
          };
          const steps: PipelineStep[] = res.map((t: Record<string, unknown>, idx: number) => ({
            id: String(t.id || `step-${idx}`),
            name: nameMap[String(t.agent_name)] || (String(t.agent_name) as PipelineStep['name']) || 'Orchestrator',
            status:
              t.status === 'completed' || t.status === 'done'
                ? 'done'
                : t.status === 'failed' || t.status === 'error'
                ? 'error'
                : 'running',
            latency_ms: Number(t.latency_ms || 0),
            output_preview: (t.output as Record<string, unknown>) || {},
            error_message: t.error ? String(t.error) : undefined,
          }));
          return {
            lecture_id: id,
            steps,
            started_at: new Date().toISOString(),
          };
        }
        if (res && typeof res === 'object' && Array.isArray((res as PipelineTrace).steps)) {
          return res as PipelineTrace;
        }
        return {
          lecture_id: id,
          steps: [],
          started_at: new Date().toISOString(),
        };
      } catch (err) {
        console.warn(`API error fetching trace for ${id}:`, err);
        return null;
      }
    },
    enabled: Boolean(id),
    refetchInterval: (query) => {
      // If trace is still running, poll every 2s
      const data = query.state.data;
      if (!data || !Array.isArray(data.steps) || data.steps.length === 0) return false;
      const isComplete = data.steps.every((s) => s.status === 'done' || s.status === 'error');
      return isComplete ? false : 2000;
    },
  });
}

export function useEndLecture() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lectureId: string) => api.endLecture(lectureId),
    onSuccess: (_, lectureId) => {
      queryClient.invalidateQueries({ queryKey: ['lectures'] });
      queryClient.invalidateQueries({ queryKey: ['lecture', lectureId] });
    },
  });
}

export function useRetryJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lectureId, stepId }: { lectureId: string; stepId?: string }) =>
      api.retryJob(lectureId, stepId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lecture-trace', variables.lectureId] });
    },
  });
}

export function useFlagConfusing() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lectureId, chunkId }: { lectureId: string; chunkId: string }) =>
      api.flagConfusing(lectureId, chunkId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lecture', variables.lectureId] });
    },
  });
}

export function useAskQuestion() {
  return useMutation<AskResponse, Error, { question: string; scope: 'active' | 'all' | string; lectureId?: string }>({
    mutationFn: ({ question, scope, lectureId }) => api.ask(question, scope, lectureId),
  });
}
