import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './hooks/useAuth';
import { useBackendHealth } from './hooks/useBackendHealth';
import { ThemeProvider } from './hooks/useTheme';
import { MainLayout } from './layouts/MainLayout';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MeetingLobbyPage } from './pages/MeetingLobbyPage';
import { MeetingRoomPage } from './pages/MeetingRoomPage';
import { ProfilePage } from './pages/ProfilePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SignUpPage } from './pages/SignUpPage';

function AppRoutes() {
  const { data, loading, error, refresh } = useBackendHealth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout backendConnected={Boolean(data)} loading={loading}>
              <HomePage
                health={data}
                loading={loading}
                error={error}
                onRefresh={() => void refresh()}
              />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <MainLayout backendConnected={Boolean(data)} loading={loading}>
              <ProfilePage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/meet/:code"
        element={
          <ProtectedRoute>
            <MainLayout backendConnected={Boolean(data)} loading={loading}>
              <MeetingLobbyPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/meet/:code/room"
        element={
          <ProtectedRoute>
            <MainLayout backendConnected={Boolean(data)} loading={loading}>
              <MeetingRoomPage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
