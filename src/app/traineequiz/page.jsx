import { redirect } from 'next/navigation';

/** Legacy alias. A quiz needs an id, so send people to the list of available quizzes. */
export default function TraineeQuizAliasPage() {
  redirect('/trainee/dashboard');
}
