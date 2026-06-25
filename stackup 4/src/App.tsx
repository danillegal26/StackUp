import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Spinner } from './components/ui';
import { LangToggle } from './components/LangToggle';
import { LangProvider } from './components/LangProvider';

const Home          = lazy(() => import('./pages/Home'));
const CreateRoom    = lazy(() => import('./pages/CreateRoom'));
const HostDashboard = lazy(() => import('./pages/HostDashboard'));
const JoinRoom      = lazy(() => import('./pages/JoinRoom'));
const PlayerView    = lazy(() => import('./pages/PlayerView'));
const Results       = lazy(() => import('./pages/Results'));

function PageLoader() {
  return <div className="flex min-h-screen items-center justify-center"><Spinner /></div>;
}

export default function App() {
  return (
    <LangProvider>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"               element={<Home />} />
            <Route path="/create"         element={<CreateRoom />} />
            <Route path="/host/:roomId"   element={<HostDashboard />} />
            <Route path="/join/:roomId"   element={<JoinRoom />} />
            <Route path="/play/:roomId"   element={<PlayerView />} />
            <Route path="/results/:roomId" element={<Results />} />
            <Route path="*"              element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        <div className="fixed bottom-4 right-4 z-50">
          <LangToggle />
        </div>
      </BrowserRouter>
    </LangProvider>
  );
}
