-- Evaluate auth helpers once per statement instead of once per row.
-- These rewrites preserve the existing authorization predicates.
ALTER POLICY "Profiles read own or admin" ON public.profiles
  USING (((id = (SELECT auth.uid())) OR (SELECT has_role(ARRAY['owner'::app_role, 'admin'::app_role]))));

ALTER POLICY "Cashiers manage own cash session" ON public.cash_sessions
  USING ((SELECT is_active_user()) AND ((opened_by = (SELECT auth.uid())) OR (SELECT has_role(ARRAY['owner'::app_role, 'admin'::app_role]))))
  WITH CHECK ((SELECT is_active_user()) AND (SELECT has_role(ARRAY['owner'::app_role, 'admin'::app_role, 'cashier'::app_role])));

ALTER POLICY "Owners and admins can create expenses" ON public.expenses
  WITH CHECK ((SELECT has_role(ARRAY['owner'::app_role, 'admin'::app_role])) AND ((created_by IS NULL) OR (created_by = (SELECT auth.uid()))));

ALTER POLICY "device_credentials_insert" ON public.device_access_credentials
  WITH CHECK ((SELECT has_role(ARRAY['owner'::app_role, 'admin'::app_role, 'technician'::app_role])) AND (created_by = (SELECT auth.uid())));

ALTER POLICY "device_credentials_update" ON public.device_access_credentials
  USING ((SELECT has_role(ARRAY['owner'::app_role, 'admin'::app_role, 'technician'::app_role])))
  WITH CHECK ((SELECT has_role(ARRAY['owner'::app_role, 'admin'::app_role, 'technician'::app_role])) AND (updated_by = (SELECT auth.uid())));
