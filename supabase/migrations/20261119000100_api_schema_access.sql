-- Declare the API schema privilege instead of depending on the cluster's
-- default PUBLIC grant. pg_dump can then preserve it when restoring the schema.
-- USAGE permits resolving names; table grants and RLS still control every row.
grant usage on schema public to anon, authenticated;
