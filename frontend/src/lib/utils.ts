import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatTimestamp(dateString: string | number | Date): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '00:00:00';
  }
}

export function formatDate(dateString: string | number | Date): string {
  try {
    const d = new Date(dateString);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

/**
 * Confusion color mapping:
 * Low: 0.0 - 0.39 -> Calm teal (#2DD4BF)
 * Medium: 0.4 - 0.69 -> Warning amber (#F5B84B)
 * High: 0.7 - 1.0 -> Danger coral (#FF6B6B)
 */
export function confusionColor(score: number): string {
  if (score < 0.4) return '#2DD4BF';
  if (score < 0.7) return '#F5B84B';
  return '#FF6B6B';
}

export function confusionLabel(score: number): 'Low' | 'Medium' | 'High' {
  if (score < 0.4) return 'Low';
  if (score < 0.7) return 'Medium';
  return 'High';
}

export function confusionColorClass(score: number): {
  bg: string;
  text: string;
  border: string;
  badge: string;
} {
  if (score < 0.4) {
    return {
      bg: 'bg-confusion-calm/15',
      text: 'text-confusion-calm',
      border: 'border-confusion-calm/30',
      badge: 'bg-confusion-calm/20 text-confusion-calm border-confusion-calm/40',
    };
  }
  if (score < 0.7) {
    return {
      bg: 'bg-confusion-warning/15',
      text: 'text-confusion-warning',
      border: 'border-confusion-warning/30',
      badge: 'bg-confusion-warning/20 text-confusion-warning border-confusion-warning/40',
    };
  }
  return {
    bg: 'bg-confusion-danger/15',
    text: 'text-confusion-danger',
    border: 'border-confusion-danger/30',
    badge: 'bg-confusion-danger/20 text-confusion-danger border-confusion-danger/40',
  };
}

export function truncateText(text: string, maxLen: number = 80): string {
  if (!text || text.length <= maxLen) return text;
  return text.substring(0, maxLen) + '...';
}
