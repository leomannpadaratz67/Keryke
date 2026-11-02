/* Social data layer. The interface is the same whether it talks to Supabase or to the
   single-device preview, so the views never need to know which one is active. */
(function () {
  const K = (window.K = window.K || {});
  const SESSION_KEY = 'keryke.session';
  const LOCAL_KEY = 'keryke.social.local';
  const PAGE = 30;
  const MAX_BODY = 500;
  K.MAX_POST = MAX_BODY;

  class SocialError extends Error {
    constructor(code) { super(code); this.code = code; }
  }
  K.SocialError = SocialError;

  const readJson = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  };
  const writeJson = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} };

  const cleanBody = (body) => {
    const text = String(body || '').trim();
    if (!text) throw new SocialError('empty');
    if (text.length > MAX_BODY) throw new SocialError('too_long');
    return text;
  };
  const storyFields = (story) => (story ? {
    story_title: String(story.title).slice(0, 300),
    story_url: story.url,
    story_urls: story.urls.slice(0, 30),
    story_counts: story.counts,
    story_lang: story.lang,
  } : {});
  const validId = (id) => { if (!/^\d+$/.test(String(id))) throw new SocialError('not_found'); return String(id); };
  const validHandle = (h) => { if (!/^[a-z0-9_]{3,20}$/.test(String(h))) throw new SocialError('not_found'); return String(h); };

  /* ---------- Supabase ---------- */
  function remoteBackend(cfg) {
    const base = cfg.supabaseUrl.replace(/\/+$/, '');
    const restBase = cfg.restUrl || base + '/rest/v1';
    let session = readJson(SESSION_KEY, null);
    const saveSession = (s) => {
      session = s;
      if (s) writeJson(SESSION_KEY, s);
      else { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }
    };

    const send = (url, opts) => fetch(url, opts).catch(() => { throw new SocialError('network'); });

    async function authCall(path, body) {
      const res = await send(base + '/auth/v1/' + path, {
        method: 'POST',
        headers: { apikey: cfg.supabaseAnonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return data;
      const msg = String(data.msg || data.error_description || data.message || '').toLowerCase();
      const code = String(data.error_code || data.code || '');
      if (code === 'invalid_credentials' || /invalid login/.test(msg)) throw new SocialError('bad_login');
      if (code === 'email_not_confirmed' || /not confirmed/.test(msg)) throw new SocialError('confirm_email');
      if (code === 'weak_password' || /password/.test(msg)) throw new SocialError('weak_password');
      if (code === 'user_already_exists' || /already registered/.test(msg)) throw new SocialError('email_taken');
      // Sign-up fails this way when the database refuses the profile, normally a taken handle.
      if (/database error/.test(msg)) throw new SocialError('handle_taken');
      if (res.status === 429) throw new SocialError('rate_limited');
      throw new SocialError('unknown');
    }

    let refreshing = null;
    function refreshSession() {
      if (!session || !session.refresh_token) return Promise.resolve(false);
      if (!refreshing) {
        refreshing = authCall('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
          .then((s) => { saveSession(s); return true; })
          .catch((e) => { if (e.code !== 'network') saveSession(null); return false; })
          .finally(() => { refreshing = null; });
      }
      return refreshing;
    }

    async function rest(path, opts, retried) {
      const o = opts || {};
      // The key alone means "signed out". Newer publishable keys are not tokens, so never send one as a bearer.
      const headers = { apikey: cfg.supabaseAnonKey };
      if (session && session.access_token) headers.Authorization = 'Bearer ' + session.access_token;
      if (o.body !== undefined) headers['Content-Type'] = 'application/json';
      if (o.prefer) headers.Prefer = o.prefer;
      const res = await send(restBase + '/' + path, { method: o.method || 'GET', headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
      if (res.status === 401 && !retried && session) {
        if (await refreshSession()) return rest(path, opts, true);
        throw new SocialError('auth');
      }
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
      if (res.ok) return data;
      const message = String((data && data.message) || '');
      if (/rate_limited/.test(message)) throw new SocialError('rate_limited');
      if (data && data.code === '23505') throw new SocialError('duplicate');
      if (res.status === 401 || res.status === 403) throw new SocialError('auth');
      throw new SocialError('unknown');
    }

    async function hydrate(rows) {
      const needed = Array.from(new Set(rows.filter((r) => r.repost_of).map((r) => r.repost_of)));
      if (!needed.length) return rows;
      const originals = await rest('feed_posts?select=*&id=in.(' + needed.map(validId).join(',') + ')');
      const byId = new Map(originals.map((o) => [o.id, o]));
      return rows.map((r) => (r.repost_of ? Object.assign({}, r, { original: byId.get(r.repost_of) }) : r)).filter((r) => !r.repost_of || r.original);
    }
    const beforeClause = (before) => (before ? '&created_at=lt.' + encodeURIComponent(before) : '');
    const NEWEST = '&order=created_at.desc,id.desc&limit=' + PAGE;

    let cachedMe = null;
    const api = {
      mode: 'remote',
      needsAccount: true,
      signedIn: () => !!session,
      async me() {
        if (!session) return null;
        const id = session.user && session.user.id;
        if (cachedMe && cachedMe.id === id) return cachedMe;
        const rows = await rest('profile_view?select=*&id=eq.' + encodeURIComponent(id));
        cachedMe = rows[0] || null;
        return cachedMe;
      },
      async signUp(fields) {
        const handle = String(fields.handle || '').toLowerCase();
        if (!/^[a-z0-9_]{3,20}$/.test(handle)) throw new SocialError('bad_handle');
        const name = String(fields.name || '').trim().slice(0, 40) || handle;
        const taken = await rest('profile_view?select=id&handle=eq.' + handle);
        if (taken.length) throw new SocialError('handle_taken');
        const data = await authCall('signup', { email: fields.email, password: fields.password, data: { handle, display_name: name } });
        if (data.access_token) { saveSession(data); return { confirmed: true }; }
        return { confirmed: false };
      },
      async signIn(fields) {
        saveSession(await authCall('token?grant_type=password', { email: fields.email, password: fields.password }));
        cachedMe = null;
      },
      async signOut() {
        const token = session && session.access_token;
        saveSession(null);
        cachedMe = null;
        if (token) {
          await send(base + '/auth/v1/logout', { method: 'POST', headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + token } }).catch(() => {});
        }
      },
      async deleteAccount() {
        await rest('rpc/delete_my_account', { method: 'POST', body: {} });
        saveSession(null);
        cachedMe = null;
      },
      async feed(q) {
        const scope = q.scope || 'all';
        let filter = 'parent_id=is.null';
        if (scope === 'following') {
          const me = await api.me();
          if (!me) return [];
          const follows = await rest('follows?select=followee_id&follower_id=eq.' + encodeURIComponent(me.id));
          if (!follows.length) return [];
          filter += '&author_id=in.(' + follows.map((f) => f.followee_id).join(',') + ')';
        } else if (scope === 'user') {
          filter += '&author_id=eq.' + encodeURIComponent(q.authorId);
        }
        return hydrate(await rest('feed_posts?select=*&' + filter + beforeClause(q.before) + NEWEST));
      },
      async storyPosts(urls) {
        if (!urls.length) return [];
        const list = urls.slice(0, 12).map((u) => '"' + String(u).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"').join(',');
        return rest('feed_posts?select=*&parent_id=is.null&repost_of=is.null&story_urls=ov.' + encodeURIComponent('{' + list + '}') + NEWEST);
      },
      async thread(id) {
        const safe = validId(id);
        const rows = await hydrate(await rest('feed_posts?select=*&id=eq.' + safe));
        if (!rows.length) throw new SocialError('not_found');
        const post = rows[0];
        const parent = post.parent_id ? (await rest('feed_posts?select=*&id=eq.' + validId(post.parent_id)))[0] || null : null;
        const replies = await rest('feed_posts?select=*&parent_id=eq.' + safe + '&order=created_at.asc,id.asc&limit=100');
        return { post, parent, replies };
      },
      async createPost(p) {
        const body = Object.assign({ body: cleanBody(p.body) }, storyFields(p.story));
        if (p.parentId) body.parent_id = +validId(p.parentId);
        await rest('posts', { method: 'POST', body, prefer: 'return=minimal' });
      },
      async deletePost(id) { await rest('posts?id=eq.' + validId(id), { method: 'DELETE' }); },
      async setLike(id, on) {
        const safe = validId(id);
        const me = await api.me();
        if (on) {
          try { await rest('likes', { method: 'POST', body: { post_id: +safe }, prefer: 'return=minimal' }); } catch (e) { if (e.code !== 'duplicate') throw e; }
        } else {
          await rest('likes?post_id=eq.' + safe + '&user_id=eq.' + encodeURIComponent(me.id), { method: 'DELETE' });
        }
      },
      async setRepost(id, on) {
        const safe = validId(id);
        const me = await api.me();
        if (on) {
          try { await rest('posts', { method: 'POST', body: { repost_of: +safe }, prefer: 'return=minimal' }); } catch (e) { if (e.code !== 'duplicate') throw e; }
        } else {
          await rest('posts?repost_of=eq.' + safe + '&author_id=eq.' + encodeURIComponent(me.id), { method: 'DELETE' });
        }
      },
      async profile(handle) {
        const rows = await rest('profile_view?select=*&handle=eq.' + validHandle(handle));
        if (!rows.length) throw new SocialError('not_found');
        return rows[0];
      },
      async setFollow(userId, on) {
        const me = await api.me();
        if (on) {
          try { await rest('follows', { method: 'POST', body: { followee_id: userId }, prefer: 'return=minimal' }); } catch (e) { if (e.code !== 'duplicate') throw e; }
        } else {
          await rest('follows?follower_id=eq.' + encodeURIComponent(me.id) + '&followee_id=eq.' + encodeURIComponent(userId), { method: 'DELETE' });
        }
      },
      async activity() {
        if (!session) return [];
        return rest('activity?select=*&order=created_at.desc,id.desc&limit=50');
      },
      async report(id) {
        try { await rest('reports', { method: 'POST', body: { post_id: +validId(id) }, prefer: 'return=minimal' }); } catch (e) { if (e.code !== 'duplicate') throw e; }
      },
      /** Test hook: use an existing token without going through the auth service. */
      _useSession(s) { saveSession(s); cachedMe = null; },
    };
    return api;
  }

  /* ---------- Single-device preview: same behaviour, only this browser's posts ---------- */
  function localBackend() {
    const load = () => readJson(LOCAL_KEY, { nextId: 1, posts: [], likes: [] });
    const store = (d) => writeJson(LOCAL_KEY, d);
    const ME = 'local';
    const identity = () => ({
      id: ME, handle: 'you', display_name: (K.state && K.state.name) || K.t('ob_defaultName'),
      follower_count: 0, following_count: 0, followed_by_me: false,
    });

    const view = (d, p) => ({
      id: p.id, author_id: ME, body: p.body, parent_id: p.parent_id || null, repost_of: p.repost_of || null,
      story_title: p.story_title || null, story_url: p.story_url || null, story_urls: p.story_urls || null,
      story_counts: p.story_counts || null, story_lang: p.story_lang || null, created_at: p.created_at,
      handle: identity().handle, display_name: identity().display_name,
      like_count: d.likes.indexOf(p.id) !== -1 ? 1 : 0,
      reply_count: d.posts.filter((r) => r.parent_id === p.id).length,
      repost_count: d.posts.filter((r) => r.repost_of === p.id).length,
      liked_by_me: d.likes.indexOf(p.id) !== -1,
      reposted_by_me: d.posts.some((r) => r.repost_of === p.id),
    });
    const hydrate = (d, list) => list.map((p) => {
      const row = view(d, p);
      if (p.repost_of) row.original = view(d, d.posts.find((x) => x.id === p.repost_of));
      return row;
    });
    const newest = (a, b) => b.id - a.id;
    const addPost = (d, fields) => {
      d.posts.push(Object.assign({ id: d.nextId++, created_at: new Date().toISOString() }, fields));
      store(d);
    };

    return {
      mode: 'local',
      needsAccount: false,
      signedIn: () => true,
      async me() { return identity(); },
      async feed(q) {
        const d = load();
        if ((q.scope || 'all') === 'following') return [];
        return hydrate(d, d.posts.filter((p) => !p.parent_id).sort(newest));
      },
      async storyPosts(urls) {
        const d = load();
        return hydrate(d, d.posts.filter((p) => !p.parent_id && !p.repost_of && (p.story_urls || []).some((u) => urls.indexOf(u) !== -1)).sort(newest));
      },
      async thread(id) {
        const d = load();
        const n = +validId(id);
        const post = d.posts.find((p) => p.id === n);
        if (!post) throw new SocialError('not_found');
        const parent = post.parent_id ? d.posts.find((p) => p.id === post.parent_id) : null;
        return {
          post: hydrate(d, [post])[0],
          parent: parent ? hydrate(d, [parent])[0] : null,
          replies: hydrate(d, d.posts.filter((p) => p.parent_id === n).sort((a, b) => a.id - b.id)),
        };
      },
      async createPost(p) {
        const d = load();
        addPost(d, Object.assign({ body: cleanBody(p.body), parent_id: p.parentId ? +validId(p.parentId) : null }, storyFields(p.story)));
      },
      async deletePost(id) {
        const d = load();
        const doomed = new Set([+validId(id)]);
        // Matches the database's cascade: replies and reposts go with the post.
        let grew = true;
        while (grew) {
          grew = false;
          d.posts.forEach((p) => {
            if (!doomed.has(p.id) && (doomed.has(p.parent_id) || doomed.has(p.repost_of))) { doomed.add(p.id); grew = true; }
          });
        }
        d.posts = d.posts.filter((p) => !doomed.has(p.id));
        d.likes = d.likes.filter((l) => !doomed.has(l));
        store(d);
      },
      async setLike(id, on) {
        const d = load();
        const n = +validId(id);
        d.likes = d.likes.filter((l) => l !== n);
        if (on) d.likes.push(n);
        store(d);
      },
      async setRepost(id, on) {
        const d = load();
        const n = +validId(id);
        d.posts = d.posts.filter((p) => p.repost_of !== n);
        if (on) addPost(d, { repost_of: n, body: null });
        else store(d);
      },
      async profile() { return identity(); },
      async setFollow() {},
      async activity() { return []; },
      async report() {},
      async deleteAccount() { try { localStorage.removeItem(LOCAL_KEY); } catch (e) {} },
    };
  }

  K.initSocial = function () {
    const cfg = window.KERYKE_CONFIG || {};
    K.social = cfg.supabaseUrl && cfg.supabaseAnonKey ? remoteBackend(cfg) : localBackend();
    return K.social;
  };
})();
