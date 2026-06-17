
ALTER FUNCTION public.calcular_nivel(INTEGER) SET search_path = public;
ALTER FUNCTION public.atualizar_nivel() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.atualizar_nivel() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.calcular_nivel(INTEGER) FROM PUBLIC, anon;
