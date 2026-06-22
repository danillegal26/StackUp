import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Home from './pages/Home';
import CreateRoom from './pages/CreateRoom';
import HostDashboard from './pages/HostDashboard';
import JoinRoom from './pages/JoinRoom';
import PlayerView from './pages/PlayerView';
import Results from './pages/Results';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<CreateRoom />} />
        <Route path="/host/:roomId" element={<HostDashboard />} />
        <Route path="/join/:roomId" element={<JoinRoom />} />
        <Route path="/play/:roomId" element={<PlayerView />} />
        <Route path="/results/:roomId" element={<Results />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
