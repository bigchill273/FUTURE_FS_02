'use client';

import { Suspense } from 'react';
import { PublicInquiryPage } from '../../src/screens/PublicInquiryPage';

export default function InquiryRoute() {
  return (
    <Suspense>
      <PublicInquiryPage />
    </Suspense>
  );
}
