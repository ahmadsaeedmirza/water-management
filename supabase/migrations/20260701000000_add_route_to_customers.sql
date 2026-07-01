ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS route text CHECK (route IN ('A', 'B')) DEFAULT 'A';
