"use client";
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TrainerRootPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/trainer/trainings');
  }, [router]);

  return (
    <div className="p-8 text-center text-slate-400 text-sm">
      Redirecting to Trainer Hub...
    </div>
  );
}
