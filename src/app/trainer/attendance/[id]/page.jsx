"use client";
import { use } from 'react';
import { AttendanceConsole } from '@/components/AttendanceConsole';

export default function TrainerAttendancePage({ params }) {
  const { id } = use(params);
  return <AttendanceConsole trainingId={id} />;
}
