/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import { AuthLoading } from './components/authentication/AuthLoading';
import { AuthenticationPage } from './pages/AuthenticationPage';
import { SecureEntryPage } from './pages/SecureEntryPage';

function MissionAuthRouter() {
  const { user, authReady, isLoadingProfile } = useAuth();

  if (!authReady || (user && isLoadingProfile)) {
    return <AuthLoading message="Verifying MISSION AI authentication session..." />;
  }

  if (!user) {
    return <AuthenticationPage />;
  }

  return <SecureEntryPage />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MissionAuthRouter />
      </AuthProvider>
    </ErrorBoundary>
  );
}
