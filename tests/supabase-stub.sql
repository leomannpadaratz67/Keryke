-- Recreates the parts of a Supabase database that schema.sql relies on, for local testing only.
create role anon nologin;
create role authenticated nologin;
create role authenticator noinherit login;
grant anon, authenticated to authenticator;

create schema auth;
create table auth.users (id uuid primary key, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
