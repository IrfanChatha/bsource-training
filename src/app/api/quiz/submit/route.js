import { NextResponse } from 'next/server';
import { getSessionContext } from '../../_lib/session';

/**
 * Grades and records a quiz attempt.
 *
 * The browser used to compute the score itself from an `is_correct` flag that
 * nothing ever set, so every attempt stored 0. Grading now happens here against
 * the answer key in `questions`, which the trainee cannot read or influence.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  const quizId = typeof body?.quiz_id === 'string' ? body.quiz_id.trim() : '';
  const submitted = Array.isArray(body?.answers) ? body.answers : [];

  if (!quizId) {
    return NextResponse.json({ error: 'A quiz id is required.' }, { status: 400 });
  }

  const { supabase, user, profile } = await getSessionContext();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to submit an assessment.' }, { status: 401 });
  }

  const { data: quiz, error: quizErr } = await supabase
    .from('quizzes')
    .select('id, training_id, is_published, passing_score')
    .eq('id', quizId)
    .maybeSingle();

  if (quizErr || !quiz) {
    return NextResponse.json({ error: 'That quiz could not be found.' }, { status: 404 });
  }
  if (!quiz.is_published) {
    return NextResponse.json({ error: 'That quiz has not been published yet.' }, { status: 403 });
  }

  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('id, question, options, correct_answer, explanation, question_order')
    .eq('quiz_id', quizId)
    .order('question_order', { ascending: true });

  if (qErr || !questions?.length) {
    return NextResponse.json({ error: 'That quiz has no questions.' }, { status: 409 });
  }

  const { data: training } = await supabase
    .from('trainings')
    .select('allow_quiz_retries')
    .eq('id', quiz.training_id)
    .maybeSingle();

  if (training && training.allow_quiz_retries === false) {
    const { data: prior } = await supabase
      .from('quiz_attempts')
      .select('id')
      .eq('quiz_id', quizId)
      .eq('trainee_id', user.id)
      .limit(1);
    if (prior?.length) {
      return NextResponse.json(
        { error: 'Retries are disabled for this training, and you have already submitted an attempt.' },
        { status: 409 }
      );
    }
  }

  const picked = new Map(
    submitted
      .filter((a) => a && typeof a.question_id === 'string')
      .map((a) => [a.question_id, Number.isInteger(a.selected_option) ? a.selected_option : -1])
  );

  const graded = questions.map((q) => {
    const selected = picked.has(q.id) ? picked.get(q.id) : -1;
    return {
      question_id: q.id,
      selected_option: selected,
      correct_option: q.correct_answer,
      is_correct: selected === q.correct_answer,
    };
  });

  const correctCount = graded.filter((a) => a.is_correct).length;
  const percentage = Math.round((correctCount / graded.length) * 100);

  const attempt = {
    id: 'att-sub-' + Math.random().toString(36).substring(2, 10),
    quiz_id: quizId,
    training_id: quiz.training_id,
    trainee_id: user.id,
    trainee_name: profile?.full_name || user.email?.split('@')[0] || 'Trainee',
    score: correctCount,
    total_questions: graded.length,
    percentage,
    status: 'completed',
    started_at: typeof body?.started_at === 'string' ? body.started_at : new Date().toISOString(),
    completed_at: new Date().toISOString(),
    answers: graded,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('quiz_attempts')
    .insert([attempt])
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json(
      { error: `Your attempt could not be saved: ${insertErr.message}` },
      { status: 400 }
    );
  }

  return NextResponse.json({
    attempt: inserted,
    passing_score: quiz.passing_score ?? 70,
    passed: percentage >= (quiz.passing_score ?? 70),
  });
}
