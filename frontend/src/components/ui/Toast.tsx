import * as React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextType {
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  toast: {
    success: (title: string, description?: string) => void;
    error: (title: string, description?: string) => void;
    warning: (title: string, description?: string) => void;
    info: (title: string, description?: string) => void;
  };
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = React.useCallback(
    (toastData: Omit<ToastMessage, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastMessage = { ...toastData, id };
      setToasts((prev) => [...prev, newToast]);

      const duration = toastData.duration ?? 4000;
      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toast = React.useMemo(
    () => ({
      success: (title: string, description?: string) =>
        addToast({ type: 'success', title, description }),
      error: (title: string, description?: string) =>
        addToast({ type: 'error', title, description }),
      warning: (title: string, description?: string) =>
        addToast({ type: 'warning', title, description }),
      info: (title: string, description?: string) =>
        addToast({ type: 'info', title, description }),
    }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl bg-surface/95 backdrop-blur-md',
                t.type === 'success' && 'border-confusion-calm/40 text-foreground',
                t.type === 'error' && 'border-confusion-danger/40 text-foreground',
                t.type === 'warning' && 'border-confusion-warning/40 text-foreground',
                t.type === 'info' && 'border-accent/40 text-foreground'
              )}
            >
              {t.type === 'success' && <CheckCircle2 className="w-5 h-5 text-confusion-calm shrink-0 mt-0.5" />}
              {t.type === 'error' && <AlertCircle className="w-5 h-5 text-confusion-danger shrink-0 mt-0.5" />}
              {t.type === 'warning' && <AlertTriangle className="w-5 h-5 text-confusion-warning shrink-0 mt-0.5" />}
              {t.type === 'info' && <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />}

              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold tracking-tight">{t.title}</h4>
                {t.description && (
                  <p className="text-xs text-muted mt-0.5 leading-relaxed">{t.description}</p>
                )}
              </div>

              <button
                onClick={() => removeToast(t.id)}
                className="text-muted hover:text-foreground transition-colors p-1"
                aria-label="Close notification"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
