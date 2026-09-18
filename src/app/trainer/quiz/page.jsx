"use client";
import { FileQuestion } from 'lucide-react';
import { TrainingPicker } from '@/components/TrainingPicker';

export default function TrainerQuizIndexPage() {
  return (
    <TrainingPicker
      title="AI Quiz Builder"
      description="Pick the session whose assessment you want to generate, edit or publish."
      hrefPrefix="/trainer/quiz"
      icon={<FileQuestion className="w-4 h-4" />}
    />
  );
}
