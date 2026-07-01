CREATE POLICY "Workers can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);
