import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { InteractiveGridBackground } from './components/InteractiveGridBackground';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './hooks/useAuth';
import { useBackendHealth } from './hooks/useBackendHealth';
import { SubscriptionProvider } from './hooks/useSubscription';
import { ThemeProvider } from './hooks/useTheme';
import { MainLayout } from './layouts/MainLayout';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HistoryPage } from './pages/HistoryPage';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { MeetingLobbyPage } from './pages/MeetingLobbyPage';
import { MeetingRoomPage } from './pages/MeetingRoomPage';
import { ProfilePage } from './pages/ProfilePage';
import {
  ContactPage,
  PricingPage,
  PrivacyPage,
  RefundPage,
  TermsPage,
} from './pages/PublicPages';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SchedulePage } from './pages/SchedulePage';
import { SignUpPage } from './pages/SignUpPage';

function AppRoutes() {
  const { data, loading } = useBackendHealth();

  return (
    <>
      <InteractiveGridBackground />
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Public Razorpay-compliant Pricing & Legal Policy Pages */}
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/terms-and-conditions" element={<TermsPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/privacy-policy" element={<PrivacyPage />} />
      <Route path="/refund" element={<RefundPage />} />
      <Route path="/refund-policy" element={<RefundPage />} />
      <Route path="/cancellation-refund" element={<RefundPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/contact-us" element={<ContactPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout backendConnected={Boolean(data)} loading={loading}>
              <HomePage />
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
        path="/schedule"
        element={
          <ProtectedRoute>
            <MainLayout backendConnected={Boolean(data)} loading={loading}>
              <SchedulePage />
            </MainLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <MainLayout backendConnected={Boolean(data)} loading={loading}>
              <HistoryPage />
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
    </>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <SubscriptionProvider>
            <AppRoutes />
          </SubscriptionProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
