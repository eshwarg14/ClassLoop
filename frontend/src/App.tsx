import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '@/components/ui/Toast';
import { Layout } from '@/components/layout/Layout';
import { LivePage } from '@/pages/LivePage';
import { PipelinePage } from '@/pages/PipelinePage';
import { LectureDetailPage } from '@/pages/LectureDetailPage';
import { LibraryPage } from '@/pages/LibraryPage';
import { AskPage } from '@/pages/AskPage';
import { PrivacyPage } from '@/pages/PrivacyPage';
import { SettingsPage } from '@/pages/SettingsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<LivePage />} />
              <Route path="pipeline" element={<PipelinePage />} />
              <Route path="library" element={<LibraryPage />} />
              <Route path="lectures/:id" element={<LectureDetailPage />} />
              <Route path="ask" element={<AskPage />} />
              <Route path="privacy" element={<PrivacyPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

export default App;
