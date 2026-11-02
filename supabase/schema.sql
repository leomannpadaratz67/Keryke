-- Keryke community schema. Paste the whole file into Supabase > SQL Editor and press Run.
-- Everything is protected by row level security: anyone may read, and people may only
-- create or remove their own content. Moderators hide a post by setting hidden = true
-- in the Table Editor; reports arrive in the reports table.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.posts (
  id bigint generated always as identity primary key,
  author_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text check (body is null or char_length(body) between 1 and 500),
  parent_id bigint references public.posts (id) on delete cascade,
  repost_of bigint references public.posts (id) on delete cascade,
  -- The story a comment is about. URLs rather than a story id, because stories are
  -- regrouped on every news refresh; a discussion follows any article it shares.
  story_title text check (story_title is null or char_length(story_title) <= 300),
  story_url text check (story_url is null or story_url ~ '^https?://'),
  story_urls text[] check (story_urls is null or cardinality(story_urls) <= 30),
  story_counts int[] check (story_counts is null or cardinality(story_counts) = 5),
  story_lang text check (story_lang is null or char_length(story_lang) <= 5),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  -- A repost carries no text of its own; anything else must have text.
  check ((repost_of is null) = (body is not null)),
  check (repost_of is null or parent_id is null)
);
create index posts_created_idx on public.posts (created_at desc);
create index posts_parent_idx on public.posts (parent_id);
create index posts_author_idx on public.posts (author_id, created_at desc);
create index posts_story_urls_idx on public.posts using gin (story_urls);
create unique index posts_one_repost_idx on public.posts (author_id, repost_of) where repost_of is not null;

create table public.likes (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_id bigint not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index likes_post_idx on public.likes (post_id);

create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on public.follows (followee_id);

create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_id bigint not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (reporter_id, post_id)
);

create table public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('reply', 'like', 'repost', 'follow')),
  post_id bigint references public.posts (id) on delete cascade,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- A profile is created with the account, so a taken handle fails the sign-up cleanly.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, handle, display_name)
  values (new.id, new.raw_user_meta_data ->> 'handle', new.raw_user_meta_data ->> 'display_name');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Slows down spam: at most 10 posts or reposts per person per minute.
create function public.limit_post_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.posts
      where author_id = new.author_id and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'rate_limited';
  end if;
  return new;
end $$;
create trigger posts_rate_limit before insert on public.posts
  for each row execute function public.limit_post_rate();

-- Notifications are written by triggers only, so nobody can forge one.
create function public.notify_post() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  if new.parent_id is not null then
    select author_id into target from public.posts where id = new.parent_id;
    if target <> new.author_id then
      insert into public.notifications (user_id, actor_id, kind, post_id) values (target, new.author_id, 'reply', new.id);
    end if;
  elsif new.repost_of is not null then
    select author_id into target from public.posts where id = new.repost_of;
    if target <> new.author_id then
      insert into public.notifications (user_id, actor_id, kind, post_id) values (target, new.author_id, 'repost', new.repost_of);
    end if;
  end if;
  return new;
end $$;
create trigger posts_notify after insert on public.posts
  for each row execute function public.notify_post();

create function public.notify_like() returns trigger
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  select author_id into target from public.posts where id = new.post_id;
  if target <> new.user_id then
    insert into public.notifications (user_id, actor_id, kind, post_id) values (target, new.user_id, 'like', new.post_id);
  end if;
  return new;
end $$;
create trigger likes_notify after insert on public.likes
  for each row execute function public.notify_like();

create function public.notify_follow() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.notifications (user_id, actor_id, kind) values (new.followee_id, new.follower_id, 'follow');
  return new;
end $$;
create trigger follows_notify after insert on public.follows
  for each row execute function public.notify_follow();

-- Lets a person delete their own account and everything attached to it.
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_signed_in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- Row level security
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.follows enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;

create policy "profiles are public" on public.profiles for select using (true);
create policy "update own profile" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Hidden posts stay visible to their author only, so moderation cannot be probed by others.
create policy "visible posts are public" on public.posts for select using (not hidden or author_id = auth.uid());
create policy "create own posts" on public.posts for insert to authenticated
  with check (author_id = auth.uid() and not hidden);
create policy "delete own posts" on public.posts for delete to authenticated using (author_id = auth.uid());

create policy "likes are public" on public.likes for select using (true);
create policy "like as yourself" on public.likes for insert to authenticated with check (user_id = auth.uid());
create policy "remove own likes" on public.likes for delete to authenticated using (user_id = auth.uid());

create policy "follows are public" on public.follows for select using (true);
create policy "follow as yourself" on public.follows for insert to authenticated with check (follower_id = auth.uid());
create policy "remove own follows" on public.follows for delete to authenticated using (follower_id = auth.uid());

-- Reports can be filed but not read through the API; moderators use the dashboard.
create policy "file reports as yourself" on public.reports for insert to authenticated with check (reporter_id = auth.uid());

create policy "read own notifications" on public.notifications for select to authenticated using (user_id = auth.uid());

-- Read models used by the app. security_invoker keeps the policies above in force.
create view public.feed_posts with (security_invoker = true) as
select p.id, p.author_id, p.body, p.parent_id, p.repost_of, p.story_title, p.story_url, p.story_urls,
       p.story_counts, p.story_lang, p.created_at, a.handle, a.display_name,
       (select count(*) from public.likes l where l.post_id = p.id) as like_count,
       (select count(*) from public.posts r where r.parent_id = p.id and not r.hidden) as reply_count,
       (select count(*) from public.posts r where r.repost_of = p.id and not r.hidden) as repost_count,
       exists (select 1 from public.likes l where l.post_id = p.id and l.user_id = auth.uid()) as liked_by_me,
       exists (select 1 from public.posts r where r.repost_of = p.id and r.author_id = auth.uid()) as reposted_by_me
from public.posts p join public.profiles a on a.id = p.author_id
where not p.hidden;

create view public.profile_view with (security_invoker = true) as
select pr.id, pr.handle, pr.display_name, pr.created_at,
       (select count(*) from public.follows f where f.followee_id = pr.id) as follower_count,
       (select count(*) from public.follows f where f.follower_id = pr.id) as following_count,
       exists (select 1 from public.follows f where f.followee_id = pr.id and f.follower_id = auth.uid()) as followed_by_me
from public.profiles pr;

create view public.activity with (security_invoker = true) as
select n.id, n.kind, n.post_id, n.created_at, a.handle as actor_handle, a.display_name as actor_name, p.body as post_body
from public.notifications n
join public.profiles a on a.id = n.actor_id
left join public.posts p on p.id = n.post_id;

-- Privileges. Policies above decide which rows; these decide which operations.
revoke all on all tables in schema public from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.posts, public.likes, public.follows, public.feed_posts, public.profile_view to anon, authenticated;
grant select on public.notifications, public.activity to authenticated;
grant insert (body, parent_id, repost_of, story_title, story_url, story_urls, story_counts, story_lang), delete on public.posts to authenticated;
grant insert (post_id), delete on public.likes to authenticated;
grant insert (followee_id), delete on public.follows to authenticated;
grant insert (post_id) on public.reports to authenticated;
grant update (display_name) on public.profiles to authenticated;
