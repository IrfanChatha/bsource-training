import { redirect } from 'next/navigation';

/** Legacy alias. A result needs an attempt id, so send people to their dashboard. */
export default function QuizResultsAliasPage() {
  redirect('/trainee/dashboard');
}
