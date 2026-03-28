'use client';

import { use } from 'react';

import { AuthContext } from '../components/context/auth-context';

// ----------------------------------------------------------------------

export function useAuthContext() {
  const context = use(AuthContext);

  if (!context) {
    throw new Error('useAuthContext: Context must be used inside AuthProvider');
  }

  return context;
}
