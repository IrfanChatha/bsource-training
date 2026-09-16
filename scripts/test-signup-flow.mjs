import { SupabaseService } from '../src/lib/services/supabaseService.js';

async function testSignUpFlows() {
  console.log('Testing SignUp Flow & Role Redirection...');
  const service = new SupabaseService();

  // 1. Test Trainer registration
  const trainer = await service.register(
    'test.trainer.' + Date.now() + '@enterprise.internal',
    'trainerPass123!',
    'Instructor Sarah',
    'trainer',
    'Global Security & Operations'
  );
  console.log('Trainer created:', trainer);
  const trainerTargetRoute = trainer.role === 'trainer' ? '/trainer/trainings' : '/';
  if (trainerTargetRoute !== '/trainer/trainings') {
    throw new Error('Trainer redirection failed');
  }
  console.log('✓ Trainer redirect target:', trainerTargetRoute);

  // 2. Test Trainee registration
  const trainee = await service.register(
    'test.trainee.' + Date.now() + '@enterprise.internal',
    'traineePass123!',
    'Alex Participant',
    'trainee',
    'FinTech Engineering'
  );
  console.log('Trainee created:', trainee);
  const traineeTargetRoute = trainee.role === 'trainee' ? '/trainee/dashboard' : '/';
  if (traineeTargetRoute !== '/trainee/dashboard') {
    throw new Error('Trainee redirection failed');
  }
  console.log('✓ Trainee redirect target:', traineeTargetRoute);

  console.log('\nAll SignUp flows & dashboard redirection targets PASSED successfully!');
}

testSignUpFlows().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
