/* Opens one view with sample progress so it can be captured: shot.html?theme=dark&lang=pt&lesson=1#/learn */
(function () {
  const q = new URLSearchParams(location.search);
  window.KERYKE_NO_ONBOARDING = true;
  try { localStorage.clear(); } catch (e) {}
  const K = window.K;
  K.start();
  Object.assign(K.state, {
    onboarded: true, name: 'Felipe', theme: q.get('theme') || 'light', lang: q.get('lang') || 'en', xp: 95,
    streak: { n: 4, last: K.todayStr() }, daily: { date: K.todayStr(), xp: 20 }, topics: { economy: 1, security: 1, elections: 1 }, followed: ['BR'], reads: [2, 5, 6, 3, 1],
    lessons: { 'pol-spectrum': { stars: 3 }, 'pol-systems': { stars: 2 }, 'eco-supply': { stars: 3 } },
  });
  K.lang = K.state.lang;
  K.applyTheme();
  if (q.get('demo')) { window.__demo = true; }
  if (q.get('top')) location.hash = '#/story/' + K.politicalStories()[+q.get('top')].id;
  K.rerender();
  if (q.get('lesson')) {
    K.startLesson(q.get('lesson'));
    const skip = +(q.get('skip') || 0);
    for (let i = 0; i < skip; i++) {
      const next = document.querySelector('#overlay [data-act=next]');
      if (next) next.click();
      else {
        const it = K.currentExercise();
        const btns = Array.from(document.querySelectorAll('#overlay [data-act=pick]'));
        const want = it.type === 'tf' ? (it.a ? K.t('ln_true') : K.t('ln_false')) : it.options[it.a];
        btns.find((b) => b.textContent.endsWith(want)).click();
        document.querySelector('#overlay [data-act=check]').click();
        document.querySelector('#overlay [data-act=next]').click();
      }
    }
  }
  // Sample text exists only inside this screenshot helper, never in the app.
  if (window.__demo) (async () => {
    const st = K.politicalStories().find((x) => x.sourceCount > 4);
    await K.social.createPost({ body: 'Sample comment for checking the layout.', story: { title: st.title, url: st.articles[0].url, urls: st.articles.map((a) => a.url), counts: st.counts, lang: st.lang } });
    await K.social.createPost({ body: 'Sample post without a story.' });
    await K.social.setLike(1, true); await K.social.setRepost(2, true);
    K.rerender();
  })();
  if (q.get('pick')) setTimeout(() => q.get('pick').split(',').forEach((i) => K.mapPick(i, true)), 500);
})();
