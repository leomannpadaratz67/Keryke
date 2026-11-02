/* Social tab and story discussions: comments, replies, likes, reposts and follows. */
(function () {
  const K = (window.K = window.K || {});
  const h = K.h, t = (k, v) => K.t(k, v), icon = K.icon;
  K.views = K.views || {};

  // Latest copy of every post on screen, so an action can redraw just that post.
  const shown = new Map();
  let reloadCurrent = null;
  let renderToken = 0;

  const errorText = (e) => {
    const map = {
      network: 'c_errNetwork', bad_login: 'c_badLogin', confirm_email: 'c_checkEmail', weak_password: 'c_weakPassword',
      email_taken: 'c_emailTaken', handle_taken: 'c_handleTaken', bad_handle: 'c_handleHint', rate_limited: 'c_tooFast',
      too_long: 'c_tooLong', empty: 'c_empty_body', auth: 'c_signInPrompt', not_found: 'c_notFound',
    };
    return t(map[e && e.code] || 'c_errUnknown');
  };
  const isMuted = (p) => (K.state.muted || []).indexOf(p.author_id) !== -1;

  /* ---------- Post rendering ---------- */
  const initial = (n) => (String(n || '?').trim().charAt(0) || '?').toUpperCase();
  const validCounts = (c) => Array.isArray(c) && c.length === 5 && c.every((n) => Number.isFinite(n) && n >= 0);

  function attachment(p) {
    if (!p.story_title) return '';
    const local = (p.story_urls || []).map((u) => K.urlToStory && K.urlToStory[u]).find(Boolean);
    const inner = h`<strong lang="${p.story_lang || ''}">${p.story_title}</strong>${validCounts(p.story_counts) ? K.biasBar(p.story_counts) : ''}`;
    return local
      ? h`<a class="post-story" href="#/story/${local.id}">${inner}</a>`
      : h`<a class="post-story" href="${K.safeUrl(p.story_url)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
  }

  function postCard(p, opts) {
    const o = opts || {};
    shown.set(String(p.id), { post: p, opts: o });
    const content = p.repost_of && p.original ? p.original : p;
    if (content !== p && !shown.has(String(content.id))) shown.set(String(content.id), { post: content, opts: {} });
    const mine = K.socialMe && K.socialMe.id === content.author_id;
    const profileLink = K.social.mode === 'remote' ? `#/social/user/${content.handle}` : '#/social/you';
    const replyOpen = o.replyOpen;
    return h`<article class="post ${o.focus ? 'post-focus' : ''}" data-post="${p.id}">
      ${p.repost_of ? h`<div class="post-repost">${icon('repost')}${t('c_reposted', { x: p.display_name })}</div>` : ''}
      <div class="post-main">
        <a class="avatar" href="${profileLink}" aria-hidden="true" tabindex="-1">${initial(content.display_name)}</a>
        <div class="post-content">
          <header class="post-head">
            <a class="post-name" href="${profileLink}">${content.display_name}</a>
            <span class="muted small">@${content.handle}</span>
            <a class="muted small post-time" href="#/social/post/${content.id}">${K.ago(Date.parse(content.created_at))}</a>
          </header>
          ${o.showParent && content.parent_id ? h`<a class="muted small post-replying" href="#/social/post/${content.parent_id}">${t('c_showThread')}</a>` : ''}
          <p class="post-body">${content.body}</p>
          ${attachment(content)}
          <div class="post-actions">
            <button class="post-act" data-act="postReply" data-id="${content.id}" aria-expanded="${String(!!replyOpen)}" aria-label="${t('c_reply')}: ${content.reply_count}">${icon('reply')}<span>${content.reply_count}</span></button>
            <button class="post-act ${content.reposted_by_me ? 'on-repost' : ''}" data-act="postRepost" data-id="${content.id}" aria-pressed="${String(!!content.reposted_by_me)}" aria-label="${t('c_repost')}: ${content.repost_count}">${icon('repost')}<span>${content.repost_count}</span></button>
            <button class="post-act ${content.liked_by_me ? 'on-like' : ''}" data-act="postLike" data-id="${content.id}" aria-pressed="${String(!!content.liked_by_me)}" aria-label="${t('c_like')}: ${content.like_count}">${icon('heart')}<span>${content.like_count}</span></button>
            <span class="post-spacer"></span>
            ${mine ? h`<button class="link-quiet" data-act="postDelete" data-id="${content.id}">${t('c_delete')}</button>`
              : K.social.mode === 'remote' ? h`<button class="link-quiet" data-act="postMute" data-author="${content.author_id}">${t('c_mute')}</button><button class="link-quiet" data-act="postReport" data-id="${content.id}">${t('c_report')}</button>` : ''}
          </div>
          ${replyOpen ? composer({ parentId: content.id, placeholder: t('c_replyPh'), label: t('c_reply') }) : ''}
        </div>
      </div>
    </article>`;
  }
  K.postCard = postCard;

  function composer(o) {
    if (K.social.needsAccount && !K.social.signedIn()) {
      return h`<div class="composer-gate"><p>${t('c_signInPrompt')}</p><a class="btn btn-primary btn-small" href="#/social/auth">${t('c_signIn')}</a></div>`;
    }
    return h`<form class="composer" data-form="post" ${K.raw(o.parentId ? `data-parent="${K.esc(o.parentId)}"` : '')} ${K.raw(o.storyId ? `data-story="${K.esc(o.storyId)}"` : '')}>
      <textarea name="body" rows="${o.parentId ? 2 : 3}" maxlength="${K.MAX_POST}" placeholder="${o.placeholder}" aria-label="${o.placeholder}"></textarea>
      <div class="composer-foot"><span class="muted small" data-count>0/${K.MAX_POST}</span><button class="btn btn-primary btn-small">${o.label}</button></div>
    </form>`;
  }

  function list(posts, emptyKey, opts) {
    const visible = posts.filter((p) => !isMuted(p.original || p));
    if (!visible.length) return h`<div class="empty-state"><p>${t(emptyKey)}</p></div>`;
    return h`<div class="post-list">${visible.map((p) => postCard(p, opts))}</div>`;
  }

  function redrawPost(id) {
    const entry = shown.get(String(id));
    if (!entry) return;
    document.querySelectorAll('[data-post]').forEach((el) => {
      const rec = shown.get(el.dataset.post);
      if (!rec) return;
      const content = rec.post.original || rec.post;
      if (String(content.id) === String(id)) {
        const tmp = document.createElement('div');
        tmp.innerHTML = String(postCard(rec.post, rec.opts));
        el.replaceWith(tmp.firstElementChild);
      }
    });
  }
  const contentOf = (id) => {
    const entry = shown.get(String(id));
    return entry ? entry.post.original || entry.post : null;
  };
  /** A post can be on screen twice, as itself and inside a repost: every copy gets the change. */
  const updateCopies = (id, change) => {
    const done = new Set();
    shown.forEach((rec) => {
      [rec.post, rec.post.original].forEach((c) => {
        if (c && String(c.id) === String(id) && !done.has(c)) { done.add(c); change(c); }
      });
    });
  };
  const requireAccount = () => {
    if (K.social.needsAccount && !K.social.signedIn()) { location.hash = '#/social/auth'; return false; }
    return true;
  };

  /* ---------- Actions ---------- */
  K.socialActions = {
    postReply(el) {
      if (!requireAccount()) return;
      const rec = shown.get(el.closest('[data-post]').dataset.post);
      rec.opts = Object.assign({}, rec.opts, { replyOpen: !rec.opts.replyOpen });
      const tmp = document.createElement('div');
      tmp.innerHTML = String(postCard(rec.post, rec.opts));
      const fresh = tmp.firstElementChild;
      el.closest('[data-post]').replaceWith(fresh);
      const box = fresh.querySelector('textarea');
      if (box) box.focus();
    },
    async postLike(el) {
      if (!requireAccount()) return;
      const p = contentOf(el.dataset.id);
      const on = !p.liked_by_me;
      const apply = (value) => updateCopies(p.id, (c) => { c.liked_by_me = value; c.like_count += value ? 1 : -1; });
      apply(on);
      redrawPost(p.id);
      try { await K.social.setLike(p.id, on); } catch (e) {
        apply(!on);
        redrawPost(p.id);
        K.toast(errorText(e));
      }
    },
    async postRepost(el) {
      if (!requireAccount()) return;
      const p = contentOf(el.dataset.id);
      const on = !p.reposted_by_me;
      const apply = (value) => updateCopies(p.id, (c) => { c.reposted_by_me = value; c.repost_count += value ? 1 : -1; });
      apply(on);
      redrawPost(p.id);
      try { await K.social.setRepost(p.id, on); K.toast(t(on ? 'c_repostDone' : 'c_repostUndone')); } catch (e) {
        apply(!on);
        redrawPost(p.id);
        K.toast(errorText(e));
      }
    },
    async postDelete(el) {
      if (!(await K.confirmDialog(t('c_deleteConfirm'), t('c_delete'), t('se_cancel')))) return;
      try { await K.social.deletePost(el.dataset.id); if (reloadCurrent) reloadCurrent(); } catch (e) { K.toast(errorText(e)); }
    },
    async postReport(el) {
      if (!requireAccount()) return;
      if (!(await K.confirmDialog(t('c_reportConfirm'), t('c_report'), t('se_cancel')))) return;
      try { await K.social.report(el.dataset.id); K.toast(t('c_reported')); } catch (e) { K.toast(errorText(e)); }
    },
    postMute(el) {
      K.state.muted = (K.state.muted || []).concat(el.dataset.author);
      K.save();
      K.toast(t('c_muted'));
      if (reloadCurrent) reloadCurrent();
    },
    async followUser(el) {
      if (!requireAccount()) return;
      const on = el.getAttribute('aria-pressed') !== 'true';
      try { await K.social.setFollow(el.dataset.user, on); if (reloadCurrent) reloadCurrent(); } catch (e) { K.toast(errorText(e)); }
    },
    socialRefresh() { if (reloadCurrent) reloadCurrent(); },
    async signOut() { await K.social.signOut(); K.socialMe = null; location.hash = '#/social'; K.rerender(); },
    async deleteAccount() {
      if (!(await K.confirmDialog(t('c_deleteAccountConfirm'), t('se_delete'), t('se_cancel')))) return;
      try { await K.social.deleteAccount(); K.socialMe = null; location.hash = '#/social'; K.rerender(); } catch (e) { K.toast(errorText(e)); }
    },
    authMode(el) { authMode = el.dataset.mode; K.rerender(); },
    scrollDiscuss() {
      const box = document.getElementById('discussion');
      if (box) { box.scrollIntoView({ behavior: 'smooth' }); const ta = box.querySelector('textarea'); if (ta) ta.focus({ preventScroll: true }); }
    },
  };

  K.socialSubmit = async function (form) {
    const kind = form.dataset.form;
    if (kind === 'post') {
      const box = form.querySelector('textarea');
      const button = form.querySelector('button');
      const story = form.dataset.story && K.storyById[form.dataset.story];
      button.disabled = true;
      try {
        await K.social.createPost({
          body: box.value,
          parentId: form.dataset.parent || null,
          story: story ? { title: story.title, url: story.articles[0].url, urls: story.articles.map((a) => a.url), counts: story.counts, lang: story.lang } : null,
        });
        box.value = '';
        if (reloadCurrent) await reloadCurrent();
      } catch (e) {
        K.toast(errorText(e));
        button.disabled = false;
      }
    } else if (kind === 'auth') {
      const data = new FormData(form);
      const fields = { email: String(data.get('email') || '').trim(), password: String(data.get('password') || ''), handle: data.get('handle'), name: data.get('name') };
      const status = form.querySelector('[data-status]');
      const button = form.querySelector('button[type=submit]');
      button.disabled = true;
      status.textContent = '';
      try {
        if (authMode === 'signup') {
          const result = await K.social.signUp(fields);
          if (!result.confirmed) { status.textContent = t('c_checkEmail'); button.disabled = false; return; }
        } else {
          await K.social.signIn(fields);
        }
        K.socialMe = await K.social.me();
        location.hash = '#/social';
      } catch (e) {
        status.textContent = errorText(e);
        button.disabled = false;
      }
    }
  };

  // Live character count for any composer on the page.
  document.addEventListener('input', (e) => {
    if (e.target.matches && e.target.matches('.composer textarea')) {
      const c = e.target.closest('.composer').querySelector('[data-count]');
      if (c) c.textContent = `${e.target.value.length}/${K.MAX_POST}`;
    }
  });

  /* ---------- Views ---------- */
  let authMode = 'signin';

  function shell(root, active, inner) {
    const tabs = [['', 'c_latest'], ['following', 'c_following'], ['activity', 'c_activity'], ['you', 'c_you']];
    root.innerHTML = String(h`<div class="page">
      <header class="page-head social-head"><div><h1>${t('so_title')}</h1><p class="muted">${t('so_intro')}</p></div>
        <button class="icon-btn" data-act="socialRefresh" aria-label="${t('c_refresh')}" data-tip="${t('c_refresh')}">${icon('reset')}</button></header>
      ${K.social.mode === 'local' ? h`<div class="notice">${t('c_preview')}</div>` : ''}
      <nav class="segmented social-tabs" aria-label="${t('so_title')}">${tabs.map((x) => h`<a href="#/social${x[0] ? '/' + x[0] : ''}" ${K.raw(active === x[0] ? 'aria-current="page"' : '')}>${t(x[1])}</a>`)}</nav>
      <div id="socialBody">${inner}</div>
    </div>`);
  }
  const loading = () => h`<p class="muted" role="status">${t('c_loading')}</p>`;
  const failure = (e) => h`<div class="empty-state"><p>${errorText(e)}</p><button class="btn" data-act="socialRefresh">${t('c_retry')}</button></div>`;

  /** Runs one load, ignoring its result if the person has navigated away in the meantime. */
  function load(fn) {
    const token = ++renderToken;
    const run = async () => {
      const body = document.getElementById('socialBody');
      try {
        K.socialMe = await K.social.me();
        const html = await fn();
        if (token === renderToken && body.isConnected) body.innerHTML = String(html);
      } catch (e) {
        if (token === renderToken && body.isConnected) body.innerHTML = String(failure(e));
      }
    };
    reloadCurrent = run;
    return run();
  }

  async function feedView(scope, emptyKey) {
    const posts = await K.social.feed({ scope });
    return h`${scope === 'all' ? composer({ placeholder: t('c_composePh'), label: t('c_post') }) : ''}
      ${list(posts, emptyKey)}
      ${posts.length >= 30 ? h`<button class="btn more-btn" data-act="socialMore" data-scope="${scope}" data-before="${posts[posts.length - 1].created_at}">${t('c_more')}</button>` : ''}`;
  }

  K.socialActions.socialMore = async function (el) {
    el.disabled = true;
    try {
      const posts = await K.social.feed({ scope: el.dataset.scope, before: el.dataset.before });
      const wrap = document.createElement('div');
      wrap.innerHTML = String(h`${posts.filter((p) => !isMuted(p.original || p)).map((p) => postCard(p))}`);
      const target = document.querySelector('#socialBody .post-list');
      while (wrap.firstChild) target.appendChild(wrap.firstChild);
      if (posts.length >= 30) { el.dataset.before = posts[posts.length - 1].created_at; el.disabled = false; } else el.remove();
    } catch (e) { el.disabled = false; K.toast(errorText(e)); }
  };

  function activityRow(a) {
    const key = { reply: 'act_reply', like: 'act_like', repost: 'act_repost', follow: 'act_follow' }[a.kind];
    const target = a.post_id ? `#/social/post/${a.post_id}` : `#/social/user/${a.actor_handle}`;
    return h`<li><a class="activity-row" href="${target}"><span class="avatar">${initial(a.actor_name)}</span>
      <span><strong>${t(key, { x: a.actor_name })}</strong>${a.post_body ? h`<span class="muted small activity-body">${a.post_body}</span>` : ''}<span class="muted small">${K.ago(Date.parse(a.created_at))}</span></span></a></li>`;
  }

  function readingBalance() {
    const reads = K.state.reads;
    const total = reads.reduce((a, b) => a + b, 0);
    return h`<section class="panel"><h2 class="mini-title">${t('so_balance')}</h2><p class="muted small">${t('so_balanceIntro')}</p>
      ${total ? h`${K.biasBar(reads, { large: true })}${K.biasLegendCompact()}<p class="muted small">${t('so_opens', { n: total })}</p>` : h`<p class="muted">${t('so_balanceEmpty')}</p>`}</section>`;
  }

  function profileHead(pr, isMe) {
    return h`<section class="profile-card">
      <span class="avatar avatar-lg">${initial(pr.display_name)}</span>
      <div class="profile-text"><h2>${pr.display_name}</h2><span class="muted">@${pr.handle}</span>
        ${K.social.mode === 'remote' ? h`<div class="profile-counts small"><span><strong>${pr.follower_count}</strong> ${t('c_followers')}</span><span><strong>${pr.following_count}</strong> ${t('c_followingN')}</span></div>` : ''}</div>
      ${!isMe && K.social.mode === 'remote' ? h`<button class="btn btn-small ${pr.followed_by_me ? 'btn-on' : ''}" data-act="followUser" data-user="${pr.id}" aria-pressed="${String(!!pr.followed_by_me)}">${pr.followed_by_me ? t('c_unfollow') : t('c_follow')}</button>` : ''}
    </section>`;
  }

  async function userView(pr, isMe) {
    const posts = await K.social.feed({ scope: 'user', authorId: pr.id });
    return h`${profileHead(pr, isMe)}${isMe ? readingBalance() : ''}
      ${isMe && K.social.mode === 'remote' ? h`<div class="row-actions profile-actions"><button class="btn btn-small" data-act="signOut">${t('c_signOut')}</button><button class="btn btn-small btn-danger-ghost" data-act="deleteAccount">${t('c_deleteAccount')}</button></div>` : ''}
      ${list(posts, 'c_emptyProfile')}`;
  }

  function authView(root) {
    reloadCurrent = null;
    const signup = authMode === 'signup';
    root.innerHTML = String(h`<div class="page auth-page">
      <header class="page-head"><h1>${signup ? t('c_signUp') : t('c_signIn')}</h1></header>
      <form class="panel" data-form="auth">
        ${signup ? h`<label class="field"><span>${t('c_displayName')}</span><input name="name" maxlength="40" autocomplete="name" required></label>
        <label class="field"><span>${t('c_handle')}</span><input name="handle" maxlength="20" pattern="[a-z0-9_]{3,20}" autocomplete="username" required><span class="muted small">${t('c_handleHint')}</span></label>` : ''}
        <label class="field"><span>${t('c_email')}</span><input name="email" type="email" autocomplete="email" required></label>
        <label class="field"><span>${t('c_password')}</span><input name="password" type="password" minlength="8" autocomplete="${signup ? 'new-password' : 'current-password'}" required></label>
        <p class="auth-status" data-status role="status"></p>
        <button class="btn btn-primary btn-wide" type="submit">${signup ? t('c_signUp') : t('c_signIn')}</button>
        <button class="link-btn auth-switch" type="button" data-act="authMode" data-mode="${signup ? 'signin' : 'signup'}">${signup ? t('c_haveAccount') : t('c_noAccount')}</button>
      </form>
    </div>`);
  }

  K.views.social = function (root, params) {
    const sub = params[0] || '';
    if (sub === 'auth') {
      if (K.social.signedIn() && K.social.mode === 'remote') { location.hash = '#/social/you'; return; }
      if (K.social.mode === 'local') { location.hash = '#/social'; return; }
      authView(root);
      return;
    }
    if (sub === 'post') {
      shell(root, 'none', loading());
      load(async () => {
        const th = await K.social.thread(params[1]);
        return h`${th.parent ? h`<div class="thread-parent">${postCard(th.parent)}</div>` : ''}
          ${postCard(th.post, { focus: true, replyOpen: true })}
          ${list(th.replies, 'c_noReplies')}`;
      });
      return;
    }
    if (sub === 'user') {
      shell(root, 'none', loading());
      load(async () => {
        const pr = await K.social.profile(params[1]);
        return userView(pr, K.socialMe && K.socialMe.id === pr.id);
      });
      return;
    }
    if (sub === 'you') {
      shell(root, 'you', loading());
      load(async () => {
        if (!K.socialMe) return h`${composer({})}${readingBalance()}`;
        return userView(K.socialMe, true);
      });
      return;
    }
    if (sub === 'following') {
      shell(root, 'following', loading());
      load(() => feedView('following', K.social.mode === 'local' ? 'c_previewFollowing' : 'c_emptyFollowing'));
      return;
    }
    if (sub === 'activity') {
      shell(root, 'activity', loading());
      load(async () => {
        if (K.social.mode === 'local') return h`<div class="empty-state"><p>${t('c_previewActivity')}</p></div>`;
        if (!K.social.signedIn()) return composer({});
        const rows = await K.social.activity();
        return rows.length ? h`<ul class="activity-list">${rows.map(activityRow)}</ul>` : h`<div class="empty-state"><p>${t('c_emptyActivity')}</p></div>`;
      });
      return;
    }
    shell(root, '', loading());
    load(() => feedView('all', 'c_empty'));
  };

  /** Comments on a story, shown on its page. */
  K.loadDiscussion = function (story) {
    const token = ++renderToken;
    const run = async () => {
      const box = document.getElementById('discussionBody');
      try {
        K.socialMe = await K.social.me();
        const posts = await K.social.storyPosts(story.articles.map((a) => a.url));
        if (token !== renderToken || !box.isConnected) return;
        box.innerHTML = String(h`${composer({ storyId: story.id, placeholder: t('c_commentPh'), label: t('c_post') })}${list(posts, 'c_emptyStory')}`);
      } catch (e) {
        if (token === renderToken && box.isConnected) box.innerHTML = String(failure(e));
      }
    };
    reloadCurrent = run;
    return run();
  };
})();
