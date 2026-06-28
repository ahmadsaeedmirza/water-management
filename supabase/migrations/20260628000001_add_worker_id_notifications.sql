-- Add worker_id to notifications for worker confirmations filtering
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS worker_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
