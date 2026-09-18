"use client";
import { use } from 'react';
import { QuizStudio } from '@/components/QuizStudio';

export default function TrainerQuizPage({ params }) {
  const { id } = use(params);
  return <QuizStudio trainingId={id} />;
}
