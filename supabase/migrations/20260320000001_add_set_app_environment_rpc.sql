-- Add set_app_environment RPC function
CREATE OR REPLACE FUNCTION set_app_environment(env_name TEXT)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_env', env_name, true);
END;
$$ LANGUAGE plpgsql;
