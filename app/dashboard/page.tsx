'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to Retreat Listings (first menu item)
    router.replace('/dashboard/retreat');
  }, [router]);

  return null;
}

