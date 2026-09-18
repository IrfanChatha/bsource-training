"use client";
import { QrCode } from 'lucide-react';
import { TrainingPicker } from '@/components/TrainingPicker';

export default function TrainerAttendanceIndexPage() {
  return (
    <TrainingPicker
      title="Live QR Attendance"
      description="Pick the session you are running to project its rotating check-in code."
      hrefPrefix="/trainer/attendance"
      icon={<QrCode className="w-4 h-4" />}
    />
  );
}
