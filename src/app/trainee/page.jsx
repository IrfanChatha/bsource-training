"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TraineeRootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/trainee/dashboard');
  }, [router]);

  return (
    <div className="p-8 text-center text-slate-400 text-sm">
      Redirecting to Trainee Portal...
    </div>
  );
}
