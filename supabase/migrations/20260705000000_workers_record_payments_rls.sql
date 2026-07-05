-- Workers can insert payments
CREATE POLICY "Workers can insert payments"
ON public.payments
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Workers can read payments
CREATE POLICY "Workers can read payments"
ON public.payments
FOR SELECT
TO authenticated
USING (true);

-- Workers can read deliveries
CREATE POLICY "Workers can read deliveries"
ON public.deliveries
FOR SELECT
TO authenticated
USING (true);

-- Workers can read lots
CREATE POLICY "Workers can read lots"
ON public.lots
FOR SELECT
TO authenticated
USING (true);

-- Workers can read expenses
CREATE POLICY "Workers can read expenses"
ON public.expenses
FOR SELECT
TO authenticated
USING (true);
