ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS empty_bottles integer DEFAULT 0;
