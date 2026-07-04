ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agreed_to_tos boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agreed_to_tos_at timestamptz;