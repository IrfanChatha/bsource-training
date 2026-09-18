import { redirect } from 'next/navigation';

/** Legacy alias. The real screen needs a training id, so send people to the list. */
export default function TrainingDetailsAliasPage() {
  redirect('/trainer/trainings');
}
