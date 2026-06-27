
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP POLICY "notifications authenticated insert" ON public.notifications;
CREATE POLICY "notifications self insert" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(user_id,'admin'));
