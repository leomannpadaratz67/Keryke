/* Exercises the community backend against a real Postgres + PostgREST (see run-remote.ps1).
   Only the sign-in service is simulated, because it has no standalone Windows build. */
(async function () {
  const C = window.REMOTE_TEST;
  const lines = [];
  let failed = 0;
  const ok = (name, cond, detail) => { if (!cond) failed++; lines.push((cond ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  [' + detail + ']' : '')); };
  const tick = (ms) => new Promise((r) => setTimeout(r, ms || 0));
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const rejects = (p) => p.then(() => null, (e) => e.code || String(e));

  window.KERYKE_CONFIG = { supabaseUrl: C.url, supabaseAnonKey: C.anon, restUrl: C.url };
  window.KERYKE_NO_ONBOARDING = true;
  try { localStorage.clear(); } catch (e) {}
  const K = window.K;
  K.start();
  K.state.onboarded = true;
  const S = K.social;
  const as = (u) => S._useSession(u ? { access_token: u.token, refresh_token: 'refresh-' + u.id, user: { id: u.id } } : null);
  const raw = (u, path, opts) => fetch(C.url + '/' + path, Object.assign({}, opts, {
    headers: Object.assign({ apikey: C.anon, Authorization: 'Bearer ' + (u ? u.token : C.anon), 'Content-Type': 'application/json' }, (opts || {}).headers),
  }));
  const A = C.alice, B = C.bob, D = C.dave;

  ok('uses the remote backend', S.mode === 'remote');

  /* ---- signed out: read only ---- */
  as(null);
  ok('feed starts empty', (await S.feed({ scope: 'all' })).length === 0);
  ok('signed-out posting refused', (await rejects(S.createPost({ body: 'hi' }))) === 'auth');
  ok('hidden post is not visible to the public', (await raw(null, 'feed_posts?body=eq.hidden%20by%20moderators').then((r) => r.json())).length === 0);

  /* ---- posting, with a URL that needs careful quoting ---- */
  const trickyUrl = 'https://news.example/a?x=1&y="two",three\\four';
  const story = { title: 'A <b>story</b>', url: 'https://news.example/a', urls: ['https://news.example/a', trickyUrl], counts: [1, 2, 3, 2, 1], lang: 'en' };
  as(A);
  const me = await S.me();
  ok('profile was created with the account', me && me.handle === 'alice_k' && me.display_name === 'Alice');
  await S.createPost({ body: 'Alice on the story', story });
  await S.createPost({ body: 'Plain post from Alice' });
  let feed = await S.feed({ scope: 'all' });
  ok('posts appear newest first with author', feed.length === 2 && feed[0].body === 'Plain post from Alice' && feed[0].handle === 'alice_k');
  const storyPost = feed[1];
  ok('story fields round trip', storyPost.story_title === story.title && storyPost.story_counts.join() === '1,2,3,2,1');
  ok('discussion found through a URL with quotes, commas and backslashes', (await S.storyPosts(['https://x.example/none', trickyUrl])).length === 1);
  ok('discussion not found for other stories', (await S.storyPosts(['https://x.example/none'])).length === 0);

  /* ---- another person interacts ---- */
  as(B);
  await S.setLike(storyPost.id, true);
  await S.setLike(storyPost.id, true); // A double click must not fail or double count.
  await S.setRepost(storyPost.id, true);
  await S.setRepost(storyPost.id, true);
  await S.createPost({ body: 'Bob replies', parentId: storyPost.id });
  await S.setFollow(A.id, true);
  await S.setFollow(A.id, true);
  let th = await S.thread(storyPost.id);
  ok('like counted once', th.post.like_count === 1 && th.post.liked_by_me === true, th.post.like_count);
  ok('repost counted once', th.post.repost_count === 1 && th.post.reposted_by_me === true, th.post.repost_count);
  ok('reply threaded', th.post.reply_count === 1 && th.replies.length === 1 && th.replies[0].handle === 'bob_k');
  const replyThread = await S.thread(th.replies[0].id);
  ok('reply shows its parent', replyThread.parent && replyThread.parent.id === storyPost.id);
  feed = await S.feed({ scope: 'all' });
  ok('replies stay out of the timeline', feed.every((p) => !p.parent_id));
  const repost = feed.find((p) => p.repost_of === storyPost.id);
  ok('repost carries the original post', repost && repost.handle === 'bob_k' && repost.original.body === 'Alice on the story');
  ok('following feed shows followed people', (await S.feed({ scope: 'following' })).some((p) => p.handle === 'alice_k'));
  const profile = await S.profile('alice_k');
  ok('profile counts and follow state', profile.follower_count === 1 && profile.followed_by_me === true);
  ok('bad handle cannot reach a query', (await rejects(S.profile('x&id=eq.1'))) === 'not_found');
  ok('bad post id cannot reach a query', (await rejects(S.thread('1 or 1=1'))) === 'not_found');

  /* ---- the same data seen by its author ---- */
  as(A);
  th = await S.thread(storyPost.id);
  ok('"liked by me" is per viewer', th.post.like_count === 1 && th.post.liked_by_me === false);
  ok('nobody followed yet shows an empty following feed', (await S.feed({ scope: 'following' })).length === 0);
  const activity = await S.activity();
  ok('author is notified of reply, like, repost and follow', ['reply', 'like', 'repost', 'follow'].every((k) => activity.some((x) => x.kind === k && x.actor_handle === 'bob_k')), activity.map((x) => x.kind).join());
  as(B);
  ok('notifications are private', (await S.activity()).length === 0);
  await S.setLike(th.replies[0].id, true); // Bob liking his own reply must not notify himself.
  ok('no self notifications', (await S.activity()).length === 0);

  /* ---- attacks: each is what a hostile person could send with their own valid login ---- */
  const status = async (u, path, opts) => (await raw(u, path, opts)).status;
  const count = async (u, path) => (await raw(u, path).then((r) => r.json())).length;
  let before = await count(A, 'posts?id=eq.' + storyPost.id);
  await raw(B, 'posts?id=eq.' + storyPost.id, { method: 'DELETE' });
  ok('cannot delete someone else\'s post', (await count(A, 'posts?id=eq.' + storyPost.id)) === before && before === 1);
  ok('cannot post as someone else', (await status(B, 'posts', { method: 'POST', body: JSON.stringify({ author_id: A.id, body: 'forged' }) })) >= 400);
  ok('cannot edit a post', (await status(B, 'posts?id=eq.' + storyPost.id, { method: 'PATCH', body: JSON.stringify({ body: 'edited' }) })) >= 400);
  ok('cannot set own post as moderated or unmoderated', (await status(B, 'posts', { method: 'POST', body: JSON.stringify({ body: 'x', hidden: false }) })) >= 400);
  ok('cannot like as someone else', (await status(B, 'likes', { method: 'POST', body: JSON.stringify({ user_id: A.id, post_id: storyPost.id }) })) >= 400);
  ok('cannot make someone else follow', (await status(B, 'follows', { method: 'POST', body: JSON.stringify({ follower_id: A.id, followee_id: B.id }) })) >= 400);
  ok('cannot forge a notification', (await status(B, 'notifications', { method: 'POST', body: JSON.stringify({ user_id: A.id, actor_id: B.id, kind: 'like' }) })) >= 400);
  ok('cannot read other people\'s notifications', (await count(B, 'notifications')) === 0);
  await S.report(storyPost.id);
  await S.report(storyPost.id);
  ok('reports can be filed but not read', (await status(B, 'reports')) >= 400);
  ok('cannot take over a username', (await status(B, 'profiles?id=eq.' + B.id, { method: 'PATCH', body: JSON.stringify({ handle: 'alice_k' }) })) >= 400);
  await raw(B, 'profiles?id=eq.' + A.id, { method: 'PATCH', body: JSON.stringify({ display_name: 'Hacked' }) });
  ok('cannot rename someone else', (await S.profile('alice_k')).display_name === 'Alice');
  ok('can rename self', (await status(B, 'profiles?id=eq.' + B.id, { method: 'PATCH', body: JSON.stringify({ display_name: 'Bobby' }) })) < 300);
  ok('database rejects over-long posts', (await status(B, 'posts', { method: 'POST', body: JSON.stringify({ body: 'x'.repeat(501) }) })) >= 400);
  ok('database rejects unsafe story links', (await status(B, 'posts', { method: 'POST', body: JSON.stringify({ body: 'x', story_url: 'javascript:alert(1)' }) })) >= 400);
  ok('database rejects reposts with text', (await status(B, 'posts', { method: 'POST', body: JSON.stringify({ body: 'x', repost_of: storyPost.id }) })) >= 400);
  ok('signed-out people cannot write at all', (await status(null, 'posts', { method: 'POST', body: JSON.stringify({ body: 'x' }) })) >= 400 && (await status(null, 'likes', { method: 'POST', body: JSON.stringify({ post_id: storyPost.id }) })) >= 400);
  ok('signed-out people cannot delete accounts', (await status(null, 'rpc/delete_my_account', { method: 'POST', body: '{}' })) >= 400);
  ok('a forged login token is refused', (await status({ token: A.token.slice(0, -4) + 'AAAA' }, 'feed_posts')) === 401);

  /* ---- spam limit ---- */
  as(D);
  let limited = null;
  for (let i = 0; i < 11 && !limited; i++) limited = await rejects(S.createPost({ body: 'spam ' + i }));
  ok('posting is rate limited', limited === 'rate_limited', limited);

  /* ---- the interface on real data ---- */
  as(A);
  location.hash = '#/social';
  await tick(300);
  ok('feed renders from the server', $$('.post').length >= 3, $$('.post').length);
  ok('no preview banner when connected', !$('#view .notice'));
  ok('story title in a post is escaped', !$('.post-story b'));
  const liveLike = $$('.post').map((p) => p.querySelector('[data-act=postLike]')).find((b) => b && b.dataset.id === String(storyPost.id));
  liveLike.click();
  await tick(200);
  ok('like from the interface reaches the server', (await S.thread(storyPost.id)).post.like_count === 2);
  location.hash = '#/social/activity';
  await tick(300);
  ok('activity tab lists notifications', $$('.activity-row').length >= 4, $$('.activity-row').length);
  location.hash = '#/social/user/bob_k';
  await tick(300);
  ok('other profile offers follow', !!$('[data-act=followUser]') && !!$('[data-act=postReport]'));
  $('[data-act=followUser]').click();
  await tick(300);
  ok('following from a profile works', (await S.profile('bob_k')).followed_by_me === true);
  location.hash = '#/social/you';
  await tick(300);
  ok('own profile offers sign out', !!$('[data-act=signOut]') && !$('[data-act=followUser]'));
  as(null);
  location.hash = '#/social';
  await tick(300);
  ok('signed-out reader sees the feed and a sign-in prompt', $$('.post').length >= 3 && !!$('.composer-gate') && !$('[data-form=post]'));

  /* ---- sign-in flows, with Supabase's documented responses simulated ---- */
  const realFetch = window.fetch;
  let authResponse = null, authCalls = 0;
  window.fetch = (url, opts) => {
    if (String(url).indexOf('/auth/v1/') === -1) return realFetch(url, opts);
    authCalls++;
    return Promise.resolve(new Response(JSON.stringify(authResponse.body), { status: authResponse.status }));
  };
  const fail = (status, body) => { authResponse = { status, body }; };
  fail(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
  ok('wrong password message', (await rejects(S.signIn({ email: 'a@b.c', password: 'x' }))) === 'bad_login');
  fail(400, { error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
  ok('unconfirmed email message', (await rejects(S.signIn({ email: 'a@b.c', password: 'x' }))) === 'confirm_email');
  fail(422, { error_code: 'weak_password', msg: 'Password should be at least 8 characters' });
  ok('weak password message', (await rejects(S.signUp({ email: 'a@b.c', password: 'x', handle: 'new_user' }))) === 'weak_password');
  fail(422, { error_code: 'user_already_exists', msg: 'User already registered' });
  ok('email in use message', (await rejects(S.signUp({ email: 'a@b.c', password: 'password1', handle: 'new_user' }))) === 'email_taken');
  ok('taken username is caught before sign-up', (await rejects(S.signUp({ email: 'a@b.c', password: 'password1', handle: 'alice_k' }))) === 'handle_taken');
  ok('invalid username rejected', (await rejects(S.signUp({ email: 'a@b.c', password: 'password1', handle: 'No Spaces!' }))) === 'bad_handle');
  authResponse = { status: 200, body: { id: 'x', email: 'a@b.c' } };
  ok('sign-up awaiting email confirmation', (await S.signUp({ email: 'a@b.c', password: 'password1', handle: 'new_user' })).confirmed === false && !S.signedIn());

  // An expired login renews itself and repeats the request.
  authResponse = { status: 200, body: { access_token: A.token, refresh_token: 'r2', user: { id: A.id } } };
  S._useSession({ access_token: C.expired, refresh_token: 'r1', user: { id: A.id } });
  const callsBefore = authCalls;
  ok('expired login renews itself', (await S.me()).handle === 'alice_k' && authCalls === callsBefore + 1, authCalls - callsBefore);
  S._useSession({ access_token: C.expired, refresh_token: 'r1', user: { id: A.id } });
  fail(400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
  ok('failed renewal signs out cleanly', (await rejects(S.me())) === 'auth' && !S.signedIn());
  window.fetch = realFetch;

  /* ---- deletion ---- */
  as(A);
  await S.deletePost(storyPost.id);
  as(B);
  ok('deleting a post removes its replies and reposts', (await S.feed({ scope: 'all' })).every((p) => p.repost_of !== storyPost.id) && (await rejects(S.thread(storyPost.id))) === 'not_found');
  await S.deleteAccount();
  ok('account deletion signs out', !S.signedIn());
  ok('account deletion removes the profile and posts', (await rejects(S.profile('bob_k'))) === 'not_found' && (await count(null, 'posts?author_id=eq.' + B.id)) === 0);

  $('#report').textContent = (failed ? 'FAILED ' + failed : 'ALL PASSED') + '\n' + lines.join('\n');
})().catch((e) => { document.getElementById('report').textContent = 'CRASHED ' + e.stack; });
