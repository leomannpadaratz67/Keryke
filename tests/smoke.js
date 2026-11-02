/* Drives the real views and event handlers in a headless browser; results land in #report.
   Run: tests\run-smoke.ps1 */
(async function () {
  const lines = [];
  let failed = 0;
  const ok = (name, cond, detail) => {
    if (!cond) failed++;
    lines.push((cond ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  [' + detail + ']' : ''));
  };
  const info = (s) => lines.push('INFO ' + s);
  const tick = (ms) => new Promise((r) => setTimeout(r, ms || 0));
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const until = async (cond) => { for (let i = 0; i < 200 && !cond(); i++) await tick(25); return cond(); };
  const go = async (hash) => { location.hash = hash; await tick(30); };
  window.onerror = (m) => { failed++; lines.push('FAIL uncaught: ' + m); };

  // Map transitions run on animation frames, which headless mode barely produces; the app's reduced-motion path is instant.
  const realMatchMedia = window.matchMedia.bind(window);
  window.matchMedia = (q) => (q.indexOf('reduced-motion') !== -1 ? { matches: true } : realMatchMedia(q));
  try { localStorage.clear(); } catch (e) {}
  window.KERYKE_NO_ONBOARDING = true;
  window.__P = () => window.K.currentExercise();
  window.K.socialDebug = () => ({ firstId: () => Number(document.querySelector('.post').dataset.post) });
  try { localStorage.removeItem('keryke.social.local'); } catch (e) {}
  const K = window.K;
  const t0 = performance.now();
  K.start();
  window.__loadMs = performance.now() - t0;
  K.state.onboarded = true;
  K.state.newsLangs = ['en'];
  K.state.topics = {};
  K.buildStories(['en']);

  /* ---- translations are complete ---- */
  const enKeys = Object.keys(K.strings.en);
  ['pt', 'es', 'fr'].forEach((l) => {
    const missing = enKeys.filter((k) => !(k in K.strings[l]));
    ok('i18n ' + l + ' complete', missing.length === 0, missing.join(','));
  });

  /* ---- clustering ---- */
  const multi = K.stories.filter((s) => s.sourceCount > 1);
  const pol = K.politicalStories();
  const biggest = K.stories.slice().sort((a, b) => b.sourceCount - a.sourceCount)[0];
  ok('articles loaded', K.articles.length > 500, K.articles.length);
  ok('stories clustered', multi.length > 20, multi.length + ' multi-source of ' + K.stories.length);
  ok('no runaway cluster', biggest.sourceCount <= 45, biggest.sourceCount);
  const inMulti = multi.reduce((n, s) => n + s.sourceCount, 0) / K.articles.filter((a) => a.lang === 'en').length;
  ok('a meaningful share of articles are compared across outlets', inMulti >= 0.2, Math.round(inMulti * 100) + '%');
  ok('blindspots are found', K.stories.filter((s) => s.blindspot).length > 0);
  info('TOP STORIES:');
  K.stories.slice(0, 14).forEach((s) => info(`  ${s.sourceCount}src [${s.counts.join(',')}] ${s.countries.join('/')} ${s.topics[0] || '-'} :: ${s.title}`));
  info('MID-SIZE CLUSTERS (false-merge check):');
  multi.filter((s) => s.sourceCount >= 5).slice(10, 18).forEach((s) => { info('  ' + s.title); s.articles.slice(1, 5).forEach((a) => info('      ' + a.title)); });
  info('SAMPLE CLUSTER: ' + biggest.title);
  biggest.articles.slice(0, 10).forEach((a) => info('    ' + a.src.name + ': ' + a.title));
  const blind = K.stories.filter((s) => s.blindspot);
  info('blindspots: ' + blind.length + '; political ' + pol.length);
  const tagged = K.articles.filter((a) => a.countries.length).length;
  info('country tagged articles: ' + tagged + '/' + K.articles.length);
  info('top coverage: ' + Object.keys(K.coverage).sort((a, b) => K.coverage[b] - K.coverage[a]).slice(0, 10).map((c) => c + '=' + K.coverage[c]).join(' '));

  /* ---- country tagging edge cases ---- */
  ok('Georgia the US state is not the country', K.findCountries('Georgia voters head to polls').indexOf('GE') === -1);
  ok('Latin American is not the US', K.findCountries('Latin American leaders meet').indexOf('US') === -1);
  ok('New Mexico is not Mexico', K.findCountries('New Mexico governor speaks').indexOf('MX') === -1);
  ok('Nigeria is not Niger', K.findCountries('Nigeria election').join() === 'NG', K.findCountries('Nigeria election').join());
  ok('US acronym case sensitive', K.findCountries('talk to us', 'talk to us').length === 0 && K.findCountries('US troops', 'US troops').indexOf('US') !== -1);
  ok('fixed country name', K.countryName('PS', 'en') === 'Palestine' && K.countryName('PS', 'pt') === 'Palestina');
  ok('Portuguese country name', K.findCountries('Alemanha e Brasil').join().indexOf('DE') !== -1);

  /* ---- every tab renders ---- */
  for (const r of ['main', 'foryou', 'search', 'map', 'learn', 'social', 'settings', 'about']) {
    await go('#/' + r);
    ok('view ' + r + ' renders', $('#view').textContent.trim().length > 20);
  }
  ok('nav has seven tabs', $$('#nav .nav-link').length === 7);

  /* ---- main ---- */
  await go('#/main');
  ok('hero present', !!$('.card.hero'));
  ok('bias bars present', $$('#view .bias').length > 5);
  const heroHref = $('.card.hero .card-title a').getAttribute('href');

  /* ---- story ---- */
  await go(heroHref);
  ok('story shows sources', $$('.src-row').length >= 2, $$('.src-row').length);
  ok('source links are external and safe', $$('.src-title').every((a) => /^https?:/.test(a.getAttribute('href')) && a.rel.indexOf('noopener') !== -1));
  $('[data-act=save]').click(); await tick();
  ok('save works', K.state.saved.length === 1);
  $('.src-title').addEventListener('click', (e) => e.preventDefault(), { once: true });
  const lean = K.sources[$('.src-title').dataset.source].lean;
  $('.src-title').click();
  ok('reading balance tracked', lean === null || K.state.reads.reduce((a, b) => a + b, 0) === 1);
  await go('#/story/doesnotexist');
  ok('unknown story handled', $('#view').textContent.indexOf(K.t('st_notFound')) !== -1);

  /* ---- for you ---- */
  K.state.topics = { economy: 1 }; K.state.followed = [];
  await go('#/foryou');
  const firstTen = $$('#view .card .reason').slice(0, 10).map((e) => e.textContent);
  ok('For You explains itself', firstTen.some((x) => x.indexOf(K.t('t_economy')) !== -1), firstTen.slice(0, 2).join(' | '));
  const econShare = $$('#view .card .card-meta').slice(0, 8).filter((m) => m.textContent.indexOf(K.t('t_economy')) !== -1).length;
  ok('For You follows interests', econShare >= 5, econShare + '/8 economy');
  $('[data-act=fyTab][data-tab=saved]').click(); await tick();
  ok('saved tab lists story', $$('#view .card').length === 1, $$('#view .card').length);
  $('[data-act=fyTab][data-tab=rec]').click(); await tick();
  ok('tab returns to recommended', $$('#view .card').length > 1);

  /* ---- search: news, lessons and data together ---- */
  await go('#/search/inflation');
  await tick(10);
  const sec = () => $$('#results .section-title').map((e) => e.textContent);
  ok('search finds lessons', sec().indexOf(K.t('s_lessons')) !== -1, sec().join(','));
  ok('search finds data ranking', sec().indexOf(K.t('s_data')) !== -1);
  const rankYears = K.statRanking('inflation').map((c) => c.stats.inflation[1]);
  ok('rankings exclude stale figures', Math.min.apply(null, rankYears) >= Math.max.apply(null, rankYears) - 2, rankYears.join(','));
  await go('#/search/%');
  ok('malformed search link survives', !!$('#q'));
  await go('#/search/Brazil');
  ok('search finds country', $$('.country-hit').some((x) => x.textContent.indexOf('Brazil') !== -1));
  await go('#/search/zzqxqzz');
  ok('no results message', $('#results').textContent.indexOf('zzqxqzz') !== -1);
  await go('#/search/%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E');
  ok('search query is escaped', !$('#results img') && !$('#view input').outerHTML.includes('<img'));

  /* ---- live web search: GDELT's rate limit means both outcomes must render properly ---- */
  await go('#/search/election');
  const realSearchWeb = K.searchWeb;
  K.searchWeb = () => Promise.reject(new Error('HTTP 429'));
  await K.runWebSearch('election'); await tick();
  ok('web search failure explains itself and offers retry', $('#results').textContent.indexOf(K.t('s_webFail')) !== -1 && !!$('[data-act=webSearch]'));
  K.searchWeb = () => Promise.resolve([
    { title: 'Rated <b>result</b>', url: 'https://www.bbc.com/x', domain: 'bbc.com', source: K.sources.bbc },
    { title: 'Unknown outlet', url: 'https://example.org/y', domain: 'example.org', source: null },
  ]);
  await K.runWebSearch('election'); await tick();
  ok('web results list rating and unrated label', $$('.web-list li').length === 2 && $$('.web-list li')[1].textContent.indexOf(K.t('notRated')) !== -1);
  ok('web results escaped', !$('.web-list b'));
  K.searchWeb = realSearchWeb;

  /* ---- map ---- */
  await go('#/map');
  await tick(200);
  ok('map draws countries', $$('path.country').length > 200, $$('path.country').length);
  const byIso = (iso) => { const n = window.d3.selectAll('path.country').filter((f) => f.iso === iso).node(); return n; };
  ok('map contains US, Brazil, Kosovo, Taiwan', ['US', 'BR', 'XK', 'TW'].every(byIso));
  const unresolved = window.d3.selectAll('path.country').data().filter((f) => !f.iso).map((f) => f.properties.name);
  info('map units without a record: ' + unresolved.join(', '));
  byIso('BR').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const zoomK = () => window.d3.zoomTransform($('svg.world')).k;
  await until(() => zoomK() > 2);
  await tick(900);
  ok('selecting a country zooms in', zoomK() > 2, zoomK().toFixed(2));
  ok('selected country is labelled on the map', $$('.country-label').length === 1 && $('.country-label').textContent === 'Brazil');
  ok('selection stays centred in view', (() => { const t = window.d3.zoomTransform($('svg.world')); return t.x <= 0 && t.y <= 0; })());
  ok('war and security hotspots are drawn', $$('.hotspot').length >= 3, $$('.hotspot').length);
  ok('country news shown', $$('#mapPanel .card').length > 3, $$('#mapPanel .card').length);
  ok('country panel shows data', $$('#mapPanel .stat').length >= 6, $$('#mapPanel .stat').length);
  ok('single select stays single', $('#mapPanel').textContent.indexOf('Brazil') !== -1 && $$('path.country.selected').length === 1);
  $('#multi').checked = true; $('#multi').dispatchEvent(new Event('change'));
  byIso('US').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await tick(900);
  const related = K.relatedStories(['BR', 'US']);
  ok('finds news connecting Brazil and the US', related.length >= 3, related.length);
  info('BRAZIL + US:'); related.slice(0, 14).forEach((s) => info('  [' + s.lang + '] ' + s.topics.slice(0, 2).join('/') + ' :: ' + s.title));
  ok('every connecting story has one article naming both', related.every((s) => s.articles.some((a) => a.mentions.indexOf('BR') !== -1 && a.mentions.indexOf('US') !== -1)));
  const chipCount = $$('#mapPanel .topic-chips .pill').length;
  ok('connecting stories can be filtered by topic', chipCount >= 2, chipCount);
  if (chipCount >= 2) { $$('#mapPanel .topic-chips .pill')[1].click(); await tick(); ok('topic filter applied', $('#mapPanel .topic-chips .pill.on') === $$('#mapPanel .topic-chips .pill')[1]); }
  info('related news counts: ' + [['BR','US'],['US','CN'],['RU','UA'],['IL','IR'],['US','IR'],['FR','DE']].map((p) => p.join('+') + '=' + K.relatedStories(p).length).join(' '));
  info('load time: ' + Math.round(window.__loadMs) + ' ms for ' + K.articles.length + ' articles');
  ok('multi-select keeps both', $$('path.country.selected').length === 2);
  ok('comparison table shown', !!$('#mapPanel table.compare'));
  ok('route records selection', /BR,US|US,BR/.test(location.hash), location.hash);
  $('[data-act=mapClear]').click(); await tick();
  ok('clear selection', $$('path.country.selected').length === 0);
  await until(() => zoomK() === 1);
  ok('clearing zooms back out', zoomK() === 1, zoomK());
  $('#multi').checked = false; $('#multi').dispatchEvent(new Event('change'));
  K.mapPick('TW'); await tick();
  ok('territory without World Bank data explains itself', $('#mapPanel').textContent.indexOf(K.t('m_noData')) !== -1);
  K.mapClear();

  /* ---- lessons: content is well formed ---- */
  let bad = 0;
  window.KERYKE_LESSONS.forEach((c) => c.lessons.forEach((l) => l.items.forEach((it) => {
    if (it.type === 'mc' || it.type === 'fill') { if (!it.options[it.a]) bad++; }
    if (it.type === 'fill' && it.q.indexOf('___') === -1) bad++;
    if (it.type === 'match' && (new Set(it.pairs.map((p) => p[0])).size !== it.pairs.length || new Set(it.pairs.map((p) => p[1])).size !== it.pairs.length)) bad++;
    if (it.type === 'tf' && typeof it.a !== 'boolean') bad++;
    if (it.type === 'order' && new Set(it.items).size !== it.items.length) bad++;
  })));
  ok('all lesson items valid', bad === 0, bad);

  /* ---- play a full lesson perfectly, covering every exercise type ---- */
  await go('#/learn');
  ok('locked lessons disabled', $$('.path .node:disabled').length === 3, $$('.path .node:disabled').length);
  const playLesson = async (mistake) => {
    let guard = 0, wrongDone = !mistake;
    while (guard++ < 80) {
      const ov = $('#overlay');
      if (ov.querySelector('.result-screen')) return true;
      const next = ov.querySelector('[data-act=next]');
      if (next) { next.click(); await tick(); continue; }
      const it = window.__P();
      if (it.type === 'mc' || it.type === 'fill' || it.type === 'tf') {
        const want = it.type === 'tf' ? (it.a ? K.t('ln_true') : K.t('ln_false')) : it.options[it.a];
        const btns = Array.from(ov.querySelectorAll('[data-act=pick]'));
        let target = btns.find((b) => b.textContent.endsWith(want));
        if (!wrongDone) { target = btns.find((b) => !b.textContent.endsWith(want)); wrongDone = true; }
        target.click(); await tick();
        ov.querySelector('[data-act=check]').click(); await tick();
      } else if (it.type === 'match') {
        for (const p of it.pairs) {
          const l = Array.from(ov.querySelectorAll('[data-act=matchL]')).find((b) => b.textContent === p[0]);
          l.click(); await tick();
          const r = Array.from(ov.querySelectorAll('[data-act=matchR]')).find((b) => b.textContent === p[1]);
          r.click(); await tick();
        }
      } else if (it.type === 'order') {
        for (const x of it.items) {
          Array.from(ov.querySelectorAll('[data-act=orderAdd]')).find((b) => b.textContent === x).click(); await tick();
        }
        ov.querySelector('[data-act=check]').click(); await tick();
      }
    }
    return false;
  };

  $('.path .node').click(); await tick();
  ok('lesson opens', !$('#overlay').hidden && !!$('.player'));
  ok('lesson starts by teaching', !!$('.teach'));
  const finished = await playLesson(false);
  ok('perfect lesson completes', finished);
  ok('perfect run earns 3 stars', K.state.lessons['pol-spectrum'] && K.state.lessons['pol-spectrum'].stars === 3, JSON.stringify(K.state.lessons['pol-spectrum']));
  ok('xp awarded', K.state.xp === 25, K.state.xp);
  ok('streak started', K.currentStreak() === 1);
  $('[data-act=lessonClose]').click(); await tick();
  ok('overlay closes', $('#overlay').hidden);
  ok('next lesson unlocked', $$('.path .node:disabled').length === 2);

  // A mistake costs a heart, brings the question back, and lowers the score.
  $$('.path .node')[1].click(); await tick();
  const finished2 = await playLesson(true);
  ok('lesson with a mistake completes', finished2);
  const s2 = K.state.lessons['pol-systems'];
  ok('mistake lowers stars', s2 && s2.stars < 3, JSON.stringify(s2));
  $('[data-act=lessonClose]').click(); await tick();

  // Replaying grants less XP, so grinding one lesson is not the best strategy.
  const before = K.state.xp;
  $('.path .node').click(); await tick();
  await playLesson(false);
  ok('replay gives 5 XP', K.state.xp - before === 5, K.state.xp - before);
  ok('replay keeps best stars', K.state.lessons['pol-spectrum'].stars === 3);
  $('[data-act=lessonClose]').click(); await tick();

  // Losing all hearts.
  K.startLesson('eco-supply'); await tick();
  let guard = 0;
  while (!$('.result-screen') && guard++ < 60) {
    const ov = $('#overlay');
    const next = ov.querySelector('[data-act=next]');
    if (next) { next.click(); await tick(); continue; }
    const it = window.__P();
    if (it.type === 'match') {
      const l = ov.querySelector('[data-act=matchL]:not([disabled])'); l.click(); await tick();
      const pairR = it.pairs.find((p) => p[0] === l.textContent)[1];
      Array.from(ov.querySelectorAll('[data-act=matchR]')).find((b) => b.textContent !== pairR).click(); await tick();
      continue;
    }
    const want = it.type === 'tf' ? (it.a ? K.t('ln_true') : K.t('ln_false')) : it.options[it.a];
    Array.from(ov.querySelectorAll('[data-act=pick]')).find((b) => !b.textContent.endsWith(want)).click(); await tick();
    ov.querySelector('[data-act=check]').click(); await tick();
  }
  ok('out of hearts screen', $('.result-screen') && $('.result-screen').textContent.indexOf(K.t('ln_out')) !== -1);
  ok('failed lesson is not marked done', !K.state.lessons['eco-supply']);
  $('[data-act=lessonClose]').click(); await tick();

  /* ---- story -> lesson link ---- */
  await go('#/learn/economics/eco-supply');
  ok('deep link opens lesson', !$('#overlay').hidden && !!$('.player'));
  K.closeLesson(); await tick();

  /* ---- social (single-device preview) ---- */
  await go('#/social');
  await tick(20);
  ok('preview mode is labelled', $('#view .notice') && $('#view .notice').textContent === K.t('c_preview'));
  ok('feed starts empty, no invented users or posts', !$('.post') && $('#socialBody').textContent.indexOf(K.t('c_empty')) !== -1);
  const submitPost = async (text, root) => {
    const form = (root || document).querySelector('[data-form=post]');
    form.querySelector('textarea').value = text;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await tick(30);
  };
  await submitPost('<img src=x onerror=alert(1)> first post');
  ok('posting works', $$('.post').length === 1);
  ok('post text is escaped', !$('.post-body img') && $('.post-body').textContent.indexOf('<img') !== -1);
  const firstId = K.socialDebug().firstId();
  $('[data-act=postLike]').click(); await tick(20);
  ok('like counts and toggles on', $('[data-act=postLike]').getAttribute('aria-pressed') === 'true' && $('[data-act=postLike] span').textContent === '1');
  $('[data-act=postLike]').click(); await tick(20);
  ok('like toggles off', $('[data-act=postLike] span').textContent === '0');
  $('[data-act=postReply]').click(); await tick(20);
  await submitPost('a reply', $('.post'));
  await go('#/social/post/' + firstId);
  await tick(20);
  ok('thread shows post and reply', $$('.post').length === 2 && $$('.post-body')[1].textContent === 'a reply', $$('.post').length);
  ok('reply count updated', $('.post-focus [data-act=postReply] span').textContent === '1');
  await go('#/social');
  await tick(20);
  ok('replies stay out of the main timeline', $$('.post').length === 1);
  $('[data-act=postRepost]').click(); await tick(30);
  ok('repost counts', $('[data-act=postRepost] span').textContent === '1');
  await go('#/social/you'); await tick(20);
  ok('repost appears labelled', $$('.post-repost').length === 1, $$('.post').length);
  await go('#/social'); await tick(20);
  const tooLong = await K.social.createPost({ body: 'x'.repeat(501) }).then(() => false, (e) => e.code === 'too_long');
  ok('over-long posts rejected', tooLong);
  const blank = await K.social.createPost({ body: '   ' }).then(() => false, (e) => e.code === 'empty');
  ok('blank posts rejected', blank);

  /* ---- comments on a story ---- */
  await go('#/main');
  const storyPath = $('.card.hero .card-title a').getAttribute('href');
  await go(storyPath); await tick(30);
  ok('story page has a discussion', !!$('#discussion [data-form=post]'));
  await submitPost('comment on this story', $('#discussion'));
  ok('comment appears on the story', $$('#discussion .post').length === 1);
  ok('comment carries the story', $('#discussion .post-story') !== null);
  await go('#/social'); await tick(20);
  const att = $$('.post-story').find((a) => a.textContent.length > 0);
  ok('story comment appears in the feed, linked to the story', att && att.getAttribute('href') === storyPath, att && att.getAttribute('href'));
  // A discussion must survive the news being regrouped: a story sharing one article finds it.
  const heroStory = K.storyById[storyPath.split('/').pop()];
  const keptUrl = heroStory.articles[0].url;
  ok('discussion is found through any shared article', (await K.social.storyPosts([keptUrl, 'https://other.example/x'])).length === 1);
  ok('unrelated story has no comments', (await K.social.storyPosts(['https://other.example/x'])).length === 0);
  await K.social.deletePost(firstId);
  const after = await K.social.feed({ scope: 'all' });
  ok('delete removes post and its repost', after.every((p) => p.id !== firstId && p.repost_of !== firstId), after.length);
  await go('#/social/post/99999'); await tick(20);
  ok('missing post handled', $('#socialBody').textContent.indexOf(K.t('c_notFound')) !== -1);
  /* ---- Supabase client, with server responses simulated (the database itself: tests\run-remote.ps1) ---- */
  const realFetch = window.fetch;
  const calls = [];
  let responder = () => [200, []];
  window.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts: opts || {} });
    const [status, body] = responder(String(url), opts || {});
    return new Response(body === null ? '' : JSON.stringify(body), { status });
  };
  const rejectCode = (p) => p.then(() => null, (e) => e.code);
  window.KERYKE_CONFIG = { supabaseUrl: 'https://demo.supabase.co/', supabaseAnonKey: 'sb_publishable_demo' };
  try { localStorage.removeItem('keryke.session'); } catch (e) {}
  K.initSocial();
  ok('connects when configured', K.social.mode === 'remote' && !K.social.signedIn());
  await K.social.feed({ scope: 'all' });
  ok('signed-out requests send the key but no bearer token', calls[0].opts.headers.apikey === 'sb_publishable_demo' && !calls[0].opts.headers.Authorization);
  ok('requests go to the Supabase REST API', calls[0].url.indexOf('https://demo.supabase.co/rest/v1/feed_posts') === 0, calls[0].url.slice(0, 60));
  calls.length = 0;
  await K.social.storyPosts(['https://a.example/x?y="1",2']);
  ok('story URLs are safely quoted', decodeURIComponent(calls[0].url).indexOf('ov.{"https://a.example/x?y=\\"1\\",2"}') !== -1, decodeURIComponent(calls[0].url).slice(-50));
  await go('#/social'); await tick(30);
  ok('signed out: no preview notice, sign-in prompt instead of composer', !$('#view .notice') && !!$('.composer-gate') && !$('[data-form=post]'));
  const likeBefore = location.hash;
  await go('#/social/auth'); await tick(10);
  ok('sign-in form shown', !!$('[data-form=auth]') && !$('[name=handle]'));
  $('[data-act=authMode]').click(); await tick(10);
  ok('create-account form asks for username', !!$('[name=handle]'));
  responder = (u) => (u.indexOf('/rest/v1/profile_view') !== -1 ? [200, []] : u.indexOf('/auth/v1/signup') !== -1 ? [200, { id: 'x' }] : [200, []]);
  const form = $('[data-form=auth]');
  form.querySelector('[name=name]').value = '<b>Ana</b>'; form.querySelector('[name=handle]').value = 'ana_k'; form.querySelector('[name=email]').value = 'a@example.com'; form.querySelector('[name=password]').value = 'password1';
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await tick(40);
  ok('sign-up tells the person to confirm by email', $('[data-status]').textContent === K.t('c_checkEmail'));
  const signup = calls.find((c) => c.url.indexOf('/auth/v1/signup') !== -1);
  ok('sign-up sends username for the profile', JSON.parse(signup.opts.body).data.handle === 'ana_k');
  $('[data-act=authMode]').click(); await tick(10);
  responder = () => [400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' }];
  const signin = $('[data-form=auth]');
  signin.querySelector('[name=email]').value = 'a@example.com'; signin.querySelector('[name=password]').value = 'wrongpass1';
  signin.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await tick(40);
  ok('wrong password explained', $('[data-status]').textContent === K.t('c_badLogin'));
  // Expired token: renew once and repeat the request.
  const session = (tok) => ({ access_token: tok, refresh_token: 'r', user: { id: 'u1' } });
  K.social._useSession(session('expired'));
  responder = (u, o) => {
    if (u.indexOf('/auth/v1/token') !== -1) return [200, session('fresh')];
    return o.headers.Authorization === 'Bearer expired' ? [401, { message: 'JWT expired' }] : [200, [{ id: 'u1', handle: 'ana_k', display_name: 'Ana' }]];
  };
  ok('expired login renews itself', (await K.social.me()).handle === 'ana_k');
  K.social._useSession(session('expired'));
  responder = (u) => (u.indexOf('/auth/v1/token') !== -1 ? [400, { error_code: 'refresh_token_not_found' }] : [401, { message: 'JWT expired' }]);
  ok('failed renewal signs out cleanly', (await rejectCode(K.social.me())) === 'auth' && !K.social.signedIn());
  responder = () => { throw new TypeError('offline'); };
  window.fetch = () => Promise.reject(new TypeError('offline'));
  ok('offline is reported as a connection problem', (await rejectCode(K.social.feed({ scope: 'all' }))) === 'network');
  await go('#/social'); await tick(30);
  ok('offline shows a message and retry', $('#socialBody').textContent.indexOf(K.t('c_errNetwork')) !== -1 && !!$('[data-act=socialRefresh]'));
  window.fetch = realFetch;
  window.KERYKE_CONFIG = { supabaseUrl: '', supabaseAnonKey: '' };
  K.initSocial();

  /* ---- settings ---- */
  await go('#/settings');
  const langSel = $('[data-set=lang]');
  langSel.value = 'pt'; langSel.dispatchEvent(new Event('change')); await tick();
  ok('language switches nav', $('#nav').textContent.indexOf('Aprender') !== -1);
  ok('html lang updated', document.documentElement.lang === 'pt');
  ok('country names localized', K.countryName('DE') === 'Alemanha', K.countryName('DE'));
  const unrawKeys = Array.from(document.querySelectorAll('#view *')).filter((e) => e.children.length === 0 && /^(se|so|st|ln|m|s|fy|ab|ob)_[a-zA-Z]+$/.test(e.textContent.trim()));
  ok('no raw i18n keys', unrawKeys.length === 0, unrawKeys.map((e) => e.textContent).join(','));
  await go('#/learn');
  ok('lesson language notice shown', $('.notice') && $('.notice').textContent.indexOf('inglês') !== -1);
  await go('#/settings');
  const l2 = $('[data-set=lang]'); l2.value = 'en'; l2.dispatchEvent(new Event('change')); await tick();
  const before2 = K.stories.length;
  const nl = $('[data-newslang=pt]'); nl.checked = true; nl.dispatchEvent(new Event('change')); await tick();
  ok('news edition adds stories', K.stories.length > before2, before2 + '->' + K.stories.length);
  const nlPt = $('[data-newslang=pt]'); nlPt.checked = false; nlPt.dispatchEvent(new Event('change'));
  const nlEn = $('[data-newslang=en]'); nlEn.checked = false; nlEn.dispatchEvent(new Event('change'));
  ok('at least one news edition stays', K.state.newsLangs.length === 1);
  ok('home country removed from settings and first-run', !$('[data-set=home]') && !('inHome' in K.strings.en));
  K.state.theme = 'dark'; K.applyTheme();
  ok('dark theme applied', document.documentElement.getAttribute('data-theme') === 'dark');
  K.state.theme = 'system'; K.applyTheme();

  /* ---- backup validation ---- */
  ok('current state is valid backup', K.validBackup(JSON.parse(JSON.stringify(K.state))));
  ok('bad backup rejected', !K.validBackup({ lang: 'en' }) && !K.validBackup({ ...K.state, reads: 'x' }));

  /* ---- state survives reload ---- */
  K.save();
  const xp = K.state.xp;
  K.loadState();
  ok('state persists', K.state.xp === xp);

  /* ---- feed content cannot inject markup ---- */
  const fake = { id: 'x', title: '<img src=x onerror=alert(1)>', lang: 'en', excerpt: '', image: 'javascript:alert(1)', counts: [1, 0, 0, 0, 0], sourceCount: 1, date: Date.now(), topics: [], left: 1, center: 0, right: 0 };
  const host = document.createElement('div');
  host.innerHTML = String(K.card(fake, { image: true }));
  ok('card escapes titles', !host.querySelector('.card-title img'));
  ok('card blocks javascript image', host.querySelector('.card-img img').getAttribute('src') === '#');

  $('#report').textContent = (failed ? 'FAILED ' + failed : 'ALL PASSED') + '\n' + lines.join('\n');
})().catch((e) => { document.getElementById('report').textContent = 'CRASHED ' + e.stack; });
