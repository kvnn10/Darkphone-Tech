-- Restrict privileged RPCs to signed-in users; these functions validate active profile and role.
REVOKE ALL ON FUNCTION public.audit_collaborator_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_receivable_account_changes() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_warranty_changes() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.has_role(public.app_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role[]) TO authenticated;

REVOKE ALL ON FUNCTION public.is_active_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;

REVOKE ALL ON FUNCTION public.register_collaborator_payment(uuid, uuid, numeric, text, date, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_collaborator_payment(uuid, uuid, numeric, text, date, text, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.register_receivable_account_payment(uuid, numeric, text, date, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_receivable_account_payment(uuid, numeric, text, date, text, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.register_receivable_payment(uuid, numeric, text, date, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_receivable_payment(uuid, numeric, text, date, text, text, uuid) TO authenticated;
