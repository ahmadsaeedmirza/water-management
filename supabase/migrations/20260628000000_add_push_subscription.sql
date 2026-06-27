-- Add push_subscription to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_subscription JSONB;
