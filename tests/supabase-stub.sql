-- What Supabase provides and plain Postgres (PGlite) lacks: API roles and a minimal auth schema.
-- auth.uid() reads the user id the test sets with: set request.jwt.claim.sub = '<uuid>'.
create role anon;
create role authenticated;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable
  as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
