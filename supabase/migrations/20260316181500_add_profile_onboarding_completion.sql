alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz;

update public.profiles
set onboarding_completed_at = timezone('utc', now())
where onboarding_completed_at is null;

notify pgrst, 'reload schema';
