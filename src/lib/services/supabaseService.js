import { createClient } from '../../utils/supabase/client.js';
import { STORAGE_KEYS, readStored, writeStored, clearStored } from '../storage';
import { extractTextFromFile } from './fileExtractor';
import { SELF_ASSIGNABLE_ROLES } from '../auth/access';
import { getAuthCallbackUrl } from '../auth/site-url';

export const supabase = createClient();

const MATERIALS_BUCKET = 'training-materials';

export const DEFAULT_SETTINGS = {
  id: 1,
  qr_rotation_seconds: 60,
  ai_model: 'claude-opus-5',
  passing_score: 70,
  default_question_count: 10,
  allow_quiz_retries_default: true,
};

/**
 * Turns a PostgREST `{ data, error }` pair into a value or a thrown Error.
 *
 * Nearly every write in this service used to swallow its error and return a
 * fabricated object, so the UI reported success for rows the database had
 * rejected. Failures now reach the caller.
 */
const PG_MESSAGES = {
  // insufficient_privilege / RLS refusal
  '42501': 'You do not have permission to do that.',
  // unique_violation
  '23505': 'That already exists.',
  // foreign_key_violation
  '23503': 'That refers to something which no longer exists.',
  // not_null_violation
  '23502': 'A required field was missing.',
  // check_violation
  '23514': 'That value is not allowed.',
};

function unwrap({ data, error }, action) {
  if (error) {
    const friendly = PG_MESSAGES[error.code];
    const err = new Error(friendly ? `${action}: ${friendly}` : `${action}: ${error.message}`);
    err.code = error.code;
    err.details = error.details;
    err.raw = error.message;
    throw err;
  }
  return data;
}

/** True when `user` may run sessions and edit quizzes for `training`. */
export function canManageTraining(training, user) {
  if (!training || !user) return false;
  return user.role === 'admin' || training.trainer_id === user.id;
}

/**
 * The editor, the quiz player and the `questions` table each named these fields
 * differently, which is why questions rendered blank and answer keys were lost
 * on save. Everything now goes through this one shape.
 */
export function normalizeQuestion(q, index = 0) {
  if (!q) return null;
  return {
    id: q.id,
    question_order: q.question_order ?? index + 1,
    question_text: q.question_text ?? q.question ?? '',
    options: Array.isArray(q.options) ? q.options : [],
    correct_answer: Number(q.correct_answer ?? q.correctAnswer ?? 0),
    explanation: q.explanation ?? '',
  };
}

/** Maps the canonical shape back onto the `questions` table's columns. */
function toQuestionRow(q, quizId, index) {
  const n = normalizeQuestion(q, index);
  return {
    id: n.id || `q-${quizId}-${index + 1}`,
    quiz_id: quizId,
    question_order: index + 1,
    question: n.question_text,
    options: n.options,
    correct_answer: n.correct_answer,
    explanation: n.explanation,
  };
}

function normalizeQuiz(row) {
  if (!row) return null;
  // `items` is the embedded `questions` table. The quizzes row also carries a
  // legacy `questions` jsonb column, which is why the embed is aliased.
  const source = Array.isArray(row.items) && row.items.length
    ? row.items
    : Array.isArray(row.questions)
    ? row.questions
    : [];
  const questions = source
    .map((q, i) => normalizeQuestion(q, i))
    .filter(Boolean)
    .sort((a, b) => a.question_order - b.question_order);

  const rest = { ...row };
  delete rest.items;
  return { ...rest, questions, total_questions: questions.length || row.total_questions || 0 };
}

const QUIZ_SELECT = '*, items:questions(*)';

export class SupabaseService {
  constructor() {
    this.currentUser = null;
    this.updateCallbacks = [];
    this.authCallbacks = [];
    this.realtimeChannel = null;

    // Profile reads are async and can be in flight while the user changes
    // their own role. Every local write bumps this counter, and a read that
    // started before the write is discarded instead of clobbering it.
    this.profileEpoch = 0;

    if (typeof window !== 'undefined') {
      // A cached profile makes the first paint less jumpy, but it is only
      // trusted once loadSessionProfile() has confirmed a live session.
      const savedUser = readStored(STORAGE_KEYS.user);
      if (savedUser) {
        try {
          this.currentUser = JSON.parse(savedUser);
        } catch {
          clearStored(STORAGE_KEYS.user);
        }
      }

      supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const epoch = this.profileEpoch;
          const profile = await this.resolveProfile(session.user);
          if (epoch !== this.profileEpoch) return; // A newer local write won.
          this.cacheUser(profile);
          this.authCallbacks.forEach((cb) => {
            try { cb(profile); } catch { /* one listener must not break the rest */ }
          });
        } else {
          this.currentUser = null;
          clearStored(STORAGE_KEYS.user);
          this.authCallbacks.forEach((cb) => {
            try { cb(null); } catch { /* one listener must not break the rest */ }
          });
        }
        this.notifyListeners();
      });

      this.subscribeRealtime();
    }
  }

  subscribeRealtime() {
    try {
      this.realtimeChannel = supabase
        .channel('schema-db-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'trainings' }, () => this.notifyListeners())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions' }, () => this.notifyListeners())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => this.notifyListeners())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_attempts' }, () => this.notifyListeners())
        .subscribe();
    } catch (e) {
      console.warn('Realtime subscription unavailable:', e?.message || e);
    }
  }

  cacheUser(profile) {
    this.currentUser = profile;
    if (profile) {
      writeStored(STORAGE_KEYS.user, JSON.stringify(profile));
    } else {
      clearStored(STORAGE_KEYS.user);
    }
  }

  /**
   * Returns the `profiles` row for an authenticated user, creating it on first
   * sign-in. An admin may have pre-provisioned a row against the same email, so
   * that row is claimed rather than duplicated.
   */
  async resolveProfile(authUser) {
    const { data: byId } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();
    if (byId) return { ...byId, name: byId.full_name };

    const email = authUser.email?.toLowerCase();
    if (email) {
      const { data: byEmail } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (byEmail && byEmail.id !== authUser.id) {
        // Claim the pre-provisioned row so the invited person keeps the role
        // and department the admin chose for them.
        const { data: claimed } = await supabase.rpc('claim_provisioned_profile', {
          provisioned_id: byEmail.id,
          auth_id: authUser.id,
        });
        if (claimed) {
          const row = Array.isArray(claimed) ? claimed[0] : claimed;
          if (row) return { ...row, name: row.full_name };
        }
      }
    }

    const fresh = {
      id: authUser.id,
      email: authUser.email,
      full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
      role: SELF_ASSIGNABLE_ROLES.includes(authUser.user_metadata?.role)
        ? authUser.user_metadata.role
        : 'trainee',
      department: authUser.user_metadata?.department || 'Operations',
    };

    // insert, not upsert: `fresh` is built from signup metadata, which goes
    // stale the moment someone switches workspace. Upserting here would quietly
    // reset an existing profile's role back to whatever they signed up as.
    const { data: inserted, error } = await supabase
      .from('profiles')
      .insert([fresh])
      .select()
      .single();

    if (!error && inserted) return { ...inserted, name: inserted.full_name };

    // A concurrent sign-in may have created it first; prefer the stored row.
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();
    if (existing) return { ...existing, name: existing.full_name };

    console.warn('Could not create profile row:', error?.message);
    return { ...fresh, name: fresh.full_name };
  }

  /** Reads the live session and returns its profile, or null when signed out. */
  async loadSessionProfile() {
    const epoch = this.profileEpoch;
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      if (epoch === this.profileEpoch) this.cacheUser(null);
      return null;
    }
    const profile = await this.resolveProfile(user);
    if (epoch !== this.profileEpoch) return this.currentUser;
    this.cacheUser(profile);
    return profile;
  }

  onAuthChange(callback) {
    this.authCallbacks.push(callback);
    return () => {
      this.authCallbacks = this.authCallbacks.filter((c) => c !== callback);
    };
  }

  isConfigured() {
    return !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  }

  /** The signed-in profile, or null. Callers must handle null. */
  getCurrentUser() {
    return this.currentUser;
  }

  setCurrentUser(user) {
    this.profileEpoch += 1;
    this.cacheUser(user);
    this.notifyListeners();
  }

  /**
   * Moves the signed-in user between the Trainer and Trainee workspaces.
   *
   * Two writes are needed, and both matter:
   *  - `profiles.role` is what row level security reads, so it is the real
   *    authority.
   *  - the auth user's metadata and a token refresh keep the JWT in step. When
   *    the access-token hook is configured the proxy reads the role out of
   *    that token, so a stale token bounced a trainee who had just switched to
   *    trainer straight back off /trainer/*.
   *
   * The profile is then re-read, so a write that silently affected no rows
   * surfaces as an error rather than a UI that disagrees with the database.
   */
  async setOwnRole(newRole) {
    if (!SELF_ASSIGNABLE_ROLES.includes(newRole)) {
      throw new Error('Only an administrator can grant that role.');
    }
    const me = this.getCurrentUser();
    if (!me?.id) throw new Error('You must be signed in to switch workspace.');

    await this.updateUserProfile(me.id, { role: newRole });

    const { error: metaErr } = await supabase.auth.updateUser({ data: { role: newRole } });
    if (metaErr) {
      throw new Error(`Workspace switched, but the session could not be updated: ${metaErr.message}`);
    }

    // updateUser stores the new metadata but does not mint a new access token,
    // and the proxy reads the role out of the JWT. Without this refresh the
    // old role would keep bouncing the user off their new workspace until the
    // token happened to expire.
    const { error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr) {
      throw new Error(`Workspace switched, but the session could not be refreshed: ${refreshErr.message}`);
    }

    const { data: confirmed, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', me.id)
      .maybeSingle();
    if (error) throw new Error(`Could not confirm the workspace switch: ${error.message}`);
    if (!confirmed) throw new Error('Your profile could not be read back after the switch.');
    if (confirmed.role !== newRole) {
      throw new Error('The workspace change was rejected by the database.');
    }

    const profile = { ...confirmed, name: confirmed.full_name };
    this.setCurrentUser(profile);
    return profile;
  }

  // --- AUTHENTICATION ---
  async login(email, password) {
    if (!email || !password) {
      throw new Error('Please provide both work email and password.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      if (
        error.message?.toLowerCase().includes('email not confirmed') ||
        (error.status === 400 && error.message?.includes('Email'))
      ) {
        const customErr = new Error(
          'Your email address has not been verified yet. Please check your inbox for the confirmation link.'
        );
        customErr.isEmailUnconfirmed = true;
        throw customErr;
      }
      if (error.message?.toLowerCase().includes('invalid login credentials')) {
        throw new Error('Invalid email or password. Please verify your credentials or sign up.');
      }
      throw error;
    }

    if (!data?.user) throw new Error('Authentication failed. Please try again.');

    const profile = await this.resolveProfile(data.user);
    this.cacheUser(profile);
    return profile;
  }

  async resendVerificationEmail(email) {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: getAuthCallbackUrl() },
    });
    if (error) throw error;
    return { success: true };
  }

  async register(email, password, fullName, role = 'trainee', department = 'Operations') {
    if (!email?.trim() || !password) {
      throw new Error('Email and password are required.');
    }
    // Admin is never self-assignable at signup.
    const safeRole = SELF_ASSIGNABLE_ROLES.includes(role) ? role : 'trainee';
    const displayName = fullName?.trim() || email.split('@')[0];

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: displayName, role: safeRole, department },
        // Without this Supabase uses the project's Site URL, which points at
        // localhost, so confirmation emails sent from a deployment were
        // unusable for anyone but the developer.
        emailRedirectTo: getAuthCallbackUrl(),
      },
    });

    if (error) {
      if (error.message?.includes('User already registered')) {
        throw new Error('An account with this email already exists. Please sign in instead.');
      }
      throw error;
    }
    if (!data?.user) throw new Error('Registration failed. Please try again.');

    const requiresVerification = !data.session;

    // With verification enabled there is no session yet, so the profile row is
    // created on first sign-in instead.
    if (data.session) {
      const resolved = await this.resolveProfile(data.user);
      this.cacheUser(resolved);
      return { ...resolved, requiresVerification };
    }

    return {
      id: data.user.id,
      email: email.trim().toLowerCase(),
      full_name: displayName,
      name: displayName,
      role: safeRole,
      department,
      requiresVerification,
    };
  }

  async logout() {
    const { error } = await supabase.auth.signOut();
    this.currentUser = null;
    clearStored(STORAGE_KEYS.user);
    this.notifyListeners();
    if (error) throw error;
  }

  async getAllUsers() {
    return (
      unwrap(
        await supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        'Load users'
      ) || []
    );
  }

  /**
   * Pre-provisions a profile. There is no auth user yet — the person still has
   * to sign up with this email, at which point resolveProfile claims the row.
   */
  async createUser(userPayload) {
    if (!userPayload?.email) throw new Error('An email address is required.');
    const cleanProfile = {
      id: userPayload.id || 'inv_' + Math.random().toString(36).substring(2, 12),
      email: userPayload.email.trim().toLowerCase(),
      full_name: userPayload.full_name || userPayload.email.split('@')[0],
      role: userPayload.role || 'trainee',
      department: userPayload.department || 'Operations',
    };
    const data = unwrap(
      await supabase.from('profiles').insert([cleanProfile]).select().single(),
      'Provision user'
    );
    this.notifyListeners();
    return data;
  }

  async updateUserProfile(userId, updates) {
    const allowedKeys = ['full_name', 'role', 'department', 'avatar_url'];
    const cleanUpdates = {};
    for (const key of allowedKeys) {
      if (updates[key] !== undefined) cleanUpdates[key] = updates[key];
    }
    if (updates.name && !cleanUpdates.full_name) cleanUpdates.full_name = updates.name;
    if (Object.keys(cleanUpdates).length === 0) return { id: userId };

    const data = unwrap(
      await supabase.from('profiles').update(cleanUpdates).eq('id', userId).select().single(),
      'Update profile'
    );
    this.notifyListeners();
    return data;
  }

  async deleteUser(userId) {
    unwrap(await supabase.from('profiles').delete().eq('id', userId), 'Delete user');
    this.notifyListeners();
    return true;
  }

  async updateUserRole(userId, newRole) {
    return this.updateUserProfile(userId, { role: newRole });
  }

  async getAllAttendanceLogs() {
    return (
      unwrap(
        await supabase.from('attendance').select('*').order('marked_at', { ascending: false }),
        'Load attendance log'
      ) || []
    );
  }

  async getAllQuizAttempts() {
    return (
      unwrap(
        await supabase.from('quiz_attempts').select('*').order('completed_at', { ascending: false }),
        'Load quiz attempts'
      ) || []
    );
  }

  // --- TRAININGS ---
  async getTrainings() {
    return (
      unwrap(
        await supabase.from('trainings').select('*').order('date', { ascending: true }),
        'Load trainings'
      ) || []
    );
  }

  async getTrainingById(id) {
    if (!id) return null;
    return unwrap(
      await supabase.from('trainings').select('*').eq('id', id).maybeSingle(),
      'Load training'
    );
  }

  async createTraining(data) {
    const me = this.getCurrentUser();
    if (!me) throw new Error('You must be signed in to create a training.');

    const training = {
      id: 'trn-' + Math.random().toString(36).substring(2, 10),
      title: data.title || 'Untitled Training Session',
      description: data.description || '',
      trainer_id: me.id,
      trainer_name: me.full_name || me.name || 'Trainer',
      date: data.date || new Date().toISOString().split('T')[0],
      time: data.time || '10:00 AM',
      duration_minutes: Number(data.duration_minutes) || 60,
      location: data.location || 'Virtual Meeting Room',
      status: data.status || 'upcoming',
      is_published: data.is_published !== undefined ? !!data.is_published : true,
      allow_quiz_retries: data.allow_quiz_retries !== undefined ? !!data.allow_quiz_retries : true,
    };

    const created = unwrap(
      await supabase.from('trainings').insert([training]).select().single(),
      'Create training'
    );
    this.notifyListeners();
    return created;
  }

  async updateTraining(id, updates) {
    const cleanUpdates = { ...updates, updated_at: new Date().toISOString() };
    delete cleanUpdates.id;
    const data = unwrap(
      await supabase.from('trainings').update(cleanUpdates).eq('id', id).select().single(),
      'Update training'
    );
    this.notifyListeners();
    return data;
  }

  async deleteTraining(id) {
    unwrap(await supabase.from('trainings').delete().eq('id', id), 'Delete training');
    this.notifyListeners();
    return true;
  }

  // --- TRAINING MATERIALS ---
  /**
   * Reads the file in the browser, extracts and chunks its text, stores the
   * original in Supabase Storage when the bucket exists, and records the
   * result. The extracted text is what the AI quiz generator reads.
   *
   * This previously discarded the file entirely and wrote a placeholder row.
   */
  async uploadMaterial(trainingId, file, onProgress) {
    if (!trainingId) throw new Error('A training must be selected before uploading material.');
    if (!file) throw new Error('No file provided.');

    const extraction = await extractTextFromFile(file, onProgress);

    let fileUrl = '';
    try {
      if (onProgress) onProgress(85, 'Storing the original document...');
      const path = `${trainingId}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, '_')}`;
      const { error: uploadErr } = await supabase.storage
        .from(MATERIALS_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (uploadErr) {
        console.warn('Material storage upload skipped:', uploadErr.message);
      } else {
        const { data: pub } = supabase.storage.from(MATERIALS_BUCKET).getPublicUrl(path);
        fileUrl = pub?.publicUrl || '';
      }
    } catch (e) {
      console.warn('Material storage upload skipped:', e?.message || e);
    }

    const mat = {
      id: 'mat-' + Math.random().toString(36).substring(2, 10),
      training_id: trainingId,
      file_name: extraction.fileName,
      file_type: extraction.fileType,
      file_url: fileUrl,
      file_size: file.size || 0,
      extracted_text: extraction.text,
      chunks_count: extraction.chunks.length || 1,
    };

    const saved = unwrap(
      await supabase.from('training_materials').insert([mat]).select().single(),
      'Save training material'
    );
    if (onProgress) {
      onProgress(100, `Ingested ${extraction.wordCount} words in ${mat.chunks_count} chunk(s).`);
    }
    this.notifyListeners();
    return { ...saved, wordCount: extraction.wordCount };
  }

  async getMaterials(trainingId) {
    if (!trainingId) return [];
    return (
      unwrap(
        await supabase
          .from('training_materials')
          .select('*')
          .eq('training_id', trainingId)
          .order('uploaded_at', { ascending: false }),
        'Load materials'
      ) || []
    );
  }

  async deleteMaterial(materialId) {
    unwrap(
      await supabase.from('training_materials').delete().eq('id', materialId),
      'Delete material'
    );
    this.notifyListeners();
    return true;
  }

  // --- ATTENDANCE SESSIONS & RECORDS ---
  async getActiveAttendanceSession(trainingId) {
    if (!trainingId) return null;
    const rows = unwrap(
      await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('training_id', trainingId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1),
      'Load attendance session'
    );
    return rows && rows.length ? rows[0] : null;
  }

  /** Issues a fresh token. `ttlSeconds` comes from the configured rotation window. */
  async rotateQRToken(trainingId, ttlSeconds = DEFAULT_SETTINGS.qr_rotation_seconds) {
    if (!trainingId) throw new Error('A training must be selected before projecting a QR code.');

    const newSession = {
      id: 'sess-' + Math.random().toString(36).substring(2, 10),
      training_id: trainingId,
      current_qr_token: 'TRN-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
      expires_at: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      is_active: true,
    };

    unwrap(
      await supabase
        .from('attendance_sessions')
        .update({ is_active: false })
        .eq('training_id', trainingId),
      'Retire the previous attendance session'
    );
    const created = unwrap(
      await supabase.from('attendance_sessions').insert([newSession]).select().single(),
      'Create attendance session'
    );
    this.notifyListeners();
    return created;
  }

  /**
   * Attendance is recorded by a route handler, not from the browser: the token
   * has to be checked against the live session server-side, and the trainee id
   * has to come from the session rather than from the request body.
   */
  async markAttendance(trainingId, token) {
    const res = await fetch('/api/attendance/mark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ training_id: trainingId, token }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, message: body.error || 'Attendance could not be verified.' };
    }
    this.notifyListeners();
    return { success: true, message: body.message || 'Attendance verified.', record: body.record };
  }

  async markAttendanceByToken(paramOrToken) {
    const token =
      typeof paramOrToken === 'string'
        ? paramOrToken.trim()
        : (paramOrToken?.qr_token || '').trim();
    const trainingId = typeof paramOrToken === 'string' ? '' : paramOrToken?.training_id || '';
    return this.markAttendance(trainingId, token);
  }

  async getAttendance(trainingId) {
    if (!trainingId) return [];
    return (
      unwrap(
        await supabase.from('attendance').select('*').eq('training_id', trainingId),
        'Load attendance'
      ) || []
    );
  }

  /** Batched form of getAttendance — avoids one request per training. */
  async getAttendanceForTrainings(trainingIds) {
    if (!trainingIds?.length) return [];
    return (
      unwrap(
        await supabase.from('attendance').select('*').in('training_id', trainingIds),
        'Load attendance'
      ) || []
    );
  }

  // --- QUIZZES ---
  async getQuiz(trainingId) {
    if (!trainingId) return null;
    const row = unwrap(
      await supabase.from('quizzes').select(QUIZ_SELECT).eq('training_id', trainingId).maybeSingle(),
      'Load quiz'
    );
    return normalizeQuiz(row);
  }

  /** Batched form of getQuiz, keyed by training id. */
  async getQuizzesForTrainings(trainingIds) {
    if (!trainingIds?.length) return {};
    const rows =
      unwrap(
        await supabase.from('quizzes').select(QUIZ_SELECT).in('training_id', trainingIds),
        'Load quizzes'
      ) || [];
    const map = {};
    rows.forEach((r) => {
      map[r.training_id] = normalizeQuiz(r);
    });
    return map;
  }

  async getQuizById(quizId) {
    if (!quizId) return null;
    const row = unwrap(
      await supabase.from('quizzes').select(QUIZ_SELECT).eq('id', quizId).maybeSingle(),
      'Load quiz'
    );
    return normalizeQuiz(row);
  }

  async saveQuiz(quiz) {
    if (!quiz?.training_id) throw new Error('A quiz must belong to a training.');
    const questions = (quiz.questions || []).map((q, i) => normalizeQuestion(q, i));
    if (questions.length === 0) throw new Error('A quiz needs at least one question.');
    if (questions.some((q) => !q.question_text.trim())) {
      throw new Error('Every question needs text before the quiz can be saved.');
    }

    const quizId = quiz.id || 'quiz-' + Math.random().toString(36).substring(2, 10);
    const payload = {
      id: quizId,
      training_id: quiz.training_id,
      title: quiz.title || 'Training Comprehension Quiz',
      description: quiz.description || '',
      difficulty: quiz.difficulty || 'Medium',
      total_questions: questions.length,
      passing_score: quiz.passing_score || DEFAULT_SETTINGS.passing_score,
      time_limit_minutes: quiz.time_limit_minutes || 10,
      is_published: quiz.is_published !== undefined ? !!quiz.is_published : false,
      updated_at: new Date().toISOString(),
    };

    const saved = unwrap(
      await supabase.from('quizzes').upsert([payload], { onConflict: 'id' }).select().single(),
      'Save quiz'
    );

    // Replace the question set wholesale so deletions in the editor stick.
    unwrap(await supabase.from('questions').delete().eq('quiz_id', quizId), 'Clear old questions');
    const rows = questions.map((q, i) => toQuestionRow(q, quizId, i));
    unwrap(await supabase.from('questions').insert(rows), 'Save questions');

    this.notifyListeners();
    return normalizeQuiz({ ...saved, items: rows });
  }

  async publishQuiz(quizId) {
    unwrap(
      await supabase.from('quizzes').update({ is_published: true }).eq('id', quizId),
      'Publish quiz'
    );
    this.notifyListeners();
    return true;
  }

  // --- QUIZ ATTEMPTS ---
  /**
   * Grading happens in a route handler against the answer key in the database.
   * The browser only ever sends which option was picked, so a trainee cannot
   * submit their own score.
   */
  async submitQuizAttempt(payload, argTrainingId, argTraineeId, argTraineeName, argAnswers) {
    const quizId = typeof payload === 'string' ? payload : payload.quiz_id;
    const answers = typeof payload === 'string' ? argAnswers : payload.answers;
    const startedAt = typeof payload === 'string' ? undefined : payload.started_at;

    const res = await fetch('/api/quiz/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quiz_id: quizId,
        started_at: startedAt,
        answers: (answers || []).map((a) => ({
          question_id: a.question_id,
          selected_option: a.selected_option,
        })),
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Your answers could not be submitted.');

    this.notifyListeners();
    return { attempt: body.attempt, answers: body.attempt?.answers || [], passed: body.passed };
  }

  async submitQuiz(quizId, trainingId, traineeId, traineeName, answers) {
    const res = await this.submitQuizAttempt(quizId, trainingId, traineeId, traineeName, answers);
    return res.attempt;
  }

  async getAttemptsForTraining(trainingId) {
    if (!trainingId) return [];
    return (
      unwrap(
        await supabase.from('quiz_attempts').select('*').eq('training_id', trainingId),
        'Load quiz attempts'
      ) || []
    );
  }

  /** Batched form of getAttemptsForTraining. */
  async getAttemptsForTrainings(trainingIds) {
    if (!trainingIds?.length) return [];
    return (
      unwrap(
        await supabase.from('quiz_attempts').select('*').in('training_id', trainingIds),
        'Load quiz attempts'
      ) || []
    );
  }

  async getAttemptById(attemptId) {
    if (!attemptId) return null;
    const attempt = unwrap(
      await supabase.from('quiz_attempts').select('*').eq('id', attemptId).maybeSingle(),
      'Load attempt'
    );
    if (!attempt) return null;
    const quiz = await this.getQuizById(attempt.quiz_id);
    return { attempt, answers: attempt.answers || [], quiz };
  }

  async getLiveAttendeeRows(trainingId) {
    if (!trainingId) return [];
    const [atts, attempts, allUsers] = await Promise.all([
      this.getAttendance(trainingId),
      this.getAttemptsForTraining(trainingId),
      this.getAllUsers(),
    ]);

    const participantMap = new Map();
    allUsers.forEach((u) => {
      if (u.role !== 'admin') {
        participantMap.set(u.id, {
          trainee_id: u.id,
          name: u.full_name || u.name,
          email: u.email,
          department: u.department || 'Operations',
        });
      }
    });
    atts.forEach((a) => {
      if (!participantMap.has(a.trainee_id)) {
        participantMap.set(a.trainee_id, {
          trainee_id: a.trainee_id,
          name: a.trainee_name || 'Participant',
          email: a.trainee_email || '',
          department: 'Participant',
        });
      }
    });

    return Array.from(participantMap.values()).map((t) => {
      const hasAttended = atts.find((a) => a.trainee_id === t.trainee_id);
      const attempt = attempts.find((a) => a.trainee_id === t.trainee_id);
      return {
        trainee_id: t.trainee_id,
        name: t.name,
        email: t.email,
        department: t.department,
        attended: !!hasAttended,
        marked_at: hasAttended?.marked_at,
        quiz_status: attempt ? attempt.status : 'not_started',
        score: attempt?.score,
        total_questions: attempt?.total_questions,
        percentage: attempt?.percentage,
        completion_time: attempt?.completed_at,
      };
    });
  }

  // --- APPLICATION SETTINGS ---
  async getSettings() {
    const row = unwrap(
      await supabase.from('app_settings').select('*').eq('id', 1).maybeSingle(),
      'Load settings'
    );
    return row || DEFAULT_SETTINGS;
  }

  async saveSettings(settings) {
    const payload = {
      id: 1,
      qr_rotation_seconds: Number(settings.qr_rotation_seconds) || DEFAULT_SETTINGS.qr_rotation_seconds,
      ai_model: settings.ai_model || DEFAULT_SETTINGS.ai_model,
      passing_score: Number(settings.passing_score) || DEFAULT_SETTINGS.passing_score,
      default_question_count:
        Number(settings.default_question_count) || DEFAULT_SETTINGS.default_question_count,
      allow_quiz_retries_default: !!settings.allow_quiz_retries_default,
      updated_at: new Date().toISOString(),
    };
    const saved = unwrap(
      await supabase.from('app_settings').upsert([payload], { onConflict: 'id' }).select().single(),
      'Save settings'
    );
    this.notifyListeners();
    return saved;
  }

  onRealtimeUpdate(callback) {
    this.updateCallbacks.push(callback);
    return () => {
      this.updateCallbacks = this.updateCallbacks.filter((c) => c !== callback);
    };
  }

  notifyListeners() {
    this.updateCallbacks.forEach((cb) => {
      try {
        cb();
      } catch {
        // A failing listener must not break the others.
      }
    });
  }
}

export const supabaseService = new SupabaseService();
export default supabaseService;
