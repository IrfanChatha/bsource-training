import { NextResponse } from 'next/server';
import { getSessionContext } from '../../_lib/session';

/**
 * Records attendance for the signed-in trainee.
 *
 * The browser previously wrote straight to the `attendance` table and never
 * compared the scanned token to anything, so any string marked someone present.
 * The token is now matched against the training's live session here, and the
 * trainee identity comes from the session cookie rather than the request body.
 */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Malformed request body.' }, { status: 400 });
  }

  const trainingId = typeof body?.training_id === 'string' ? body.training_id.trim() : '';
  const rawToken = typeof body?.token === 'string' ? body.token.trim() : '';

  if (!rawToken) {
    return NextResponse.json({ error: 'An attendance token is required.' }, { status: 400 });
  }

  const { supabase, user, profile } = await getSessionContext();
  if (!user) {
    return NextResponse.json({ error: 'You must be signed in to record attendance.' }, { status: 401 });
  }

  // A scanned QR may be the full check-in URL rather than the bare token.
  let token = rawToken;
  let scannedTrainingId = trainingId;
  if (rawToken.includes('token=')) {
    try {
      const url = new URL(rawToken);
      token = url.searchParams.get('token') || rawToken;
      scannedTrainingId = url.searchParams.get('trainingId') || trainingId;
    } catch {
      // Not a URL; treat the whole value as the token.
    }
  }

  if (!scannedTrainingId) {
    return NextResponse.json({ error: 'No training was selected for this check-in.' }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  const { data: session, error: sessionErr } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('training_id', scannedTrainingId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionErr) {
    return NextResponse.json({ error: 'Could not read the attendance session.' }, { status: 500 });
  }
  if (!session) {
    return NextResponse.json(
      { error: 'No attendance session is currently open for this training.' },
      { status: 409 }
    );
  }
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    return NextResponse.json(
      { error: 'That QR code has expired. Please scan the code currently on screen.' },
      { status: 410 }
    );
  }
  if (session.current_qr_token !== token) {
    return NextResponse.json(
      { error: 'That token is not valid for this session. Please scan the code currently on screen.' },
      { status: 403 }
    );
  }

  const { data: existing } = await supabase
    .from('attendance')
    .select('id, marked_at')
    .eq('training_id', scannedTrainingId)
    .eq('trainee_id', user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      message: 'You are already checked in for this session.',
      record: existing,
      alreadyPresent: true,
    });
  }

  const record = {
    id: 'att-' + Math.random().toString(36).substring(2, 10),
    session_id: session.id,
    training_id: scannedTrainingId,
    trainee_id: user.id,
    trainee_name: profile?.full_name || user.email?.split('@')[0] || 'Trainee',
    trainee_email: profile?.email || user.email || null,
    marked_at: nowIso,
    status: 'present',
    verified_by_token: token,
  };

  const { data: inserted, error: insertErr } = await supabase
    .from('attendance')
    .insert([record])
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json(
      { error: `Attendance could not be recorded: ${insertErr.message}` },
      { status: 400 }
    );
  }

  return NextResponse.json({ message: 'Attendance verified successfully.', record: inserted });
}
