
SELECT proname, pg_get_functiondef(oid)
FROM pg_proc
WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
