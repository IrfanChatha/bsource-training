# Security Spec

1. Data Invariants:
- A user can only read/write their own profile, unless they are an admin.
- Trainers can create and update trainings where they are the trainer_id.
- Trainees can only read published trainings, their own attendance, and their own quiz attempts.
- Trainees can create attendance records (only for active sessions, but rules can only check static data + parent. To enforce active session strictly, it requires complex getAfter or get() on sessions, but we can do a basic check).
- Trainees can create and update their own quiz attempts.

2. The "Dirty Dozen" Payloads:
- P1: Trainee tries to update another user's profile.
- P2: User creates profile setting role to "admin".
- P3: Trainer modifies another trainer's training.
- P4: Trainee creates a training.
- P5: Trainee updates a training to be published.
- P6: Trainee creates an attendance session.
- P7: Trainee creates an attendance record for another trainee.
- P8: Trainer creates an attendance record for another training not owned by them.
- P9: Trainee modifies quiz questions.
- P10: Trainee creates a quiz attempt for another trainee.
- P11: Trainee modifies the score of an attempt to 100 without answering correctly (can only be prevented by cloud function or client trust in this pure client-side setup, but we'll enforce strict keys update).
- P12: Unauthenticated read of PII.

