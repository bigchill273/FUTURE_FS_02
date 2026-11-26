'use client';

import { Suspense } from 'react';
import { LoginPage } from '../../src/screens/LoginPage';

export default function LoginRoute() {
  return (
    <Suspense>
      <LoginPage />
    </Suspense>
  );
}
