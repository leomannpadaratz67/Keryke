/* App shell: navigation, routing and event delegation. */
(function () {
  const K = window.K;
  const h = K.h, t = (k, v) => K.t(k, v), icon = K.icon;

  const TABS = [
    ['search', 'search', 'nav_search'], ['foryou', 'foryou', 'nav_foryou'], ['main', 'main', 'nav_main'], ['map', 'map', 'nav_map'],
    ['learn', 'learn', 'nav_learn'], ['social', 'social', 'nav_social'], ['settings', 'settings', 'nav_settings'],
  ];
  const ROUTE_TAB = { story: 'main', about: 'settings' };

  function parseRoute() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const name = parts[0] || 'main';
    return { name: K.views[name] ? name : 'main', params: parts.slice(1) };
  }

  K.renderShell = function () {
    document.documentElement.lang = K.lang;
    const route = parseRoute();
    const active = ROUTE_TAB[route.name] || route.name;
    document.getElementById('nav').innerHTML = String(h`
      <a class="brand" href="#/main" aria-label="Keryke">${K.logo()}<span>Keryke</span></a>
      <ul>${TABS.map((tab) => h`<li><a class="nav-link ${tab[0] === active ? 'on' : ''}" href="#/${tab[0]}" ${K.raw(tab[0] === active ? 'aria-current="page"' : '')}>${icon(tab[1])}<span>${t(tab[2])}</span></a></li>`)}</ul>`);
  };

  K.rerender = function () {
    const route = parseRoute();
    const view = document.getElementById('view');
    K.renderShell();
    K.views[route.name](view, route.params);
    document.title = route.name === 'main' ? 'Keryke' : `${t('nav_' + route.name) === 'nav_' + route.name ? '' : t('nav_' + route.name) + ' · '}Keryke`;
  };

  K.applyLanguage = function () {
    K.lang = K.state.lang;
    K.rerender();
  };

  function onRoute() {
    if (K.views.mapLeave) K.views.mapLeave();
    K.rerender();
    window.scrollTo(0, 0);
    const main = document.getElementById('view');
    if (main) main.focus({ preventScroll: true });
  }

  const actions = {
    back(el, e) { e.preventDefault(); if (history.length > 1) history.back(); else location.hash = '#/main'; },
    toggleTopic(el) {
      const id = el.dataset.topic;
      K.state.topics[id] = (K.state.topics[id] || 0) > 0 ? 0 : 1;
      K.save();
      K.rerender();
    },
    lessTopic(el) {
      const id = el.dataset.topic;
      K.state.topics[id] = Math.max(-0.5, (K.state.topics[id] || 0) - 0.6);
      K.save();
      K.toast(t('fy_shownLess', { x: t('t_' + id) }));
      K.rerender();
    },
    fyTab(el) { K.setFyTab && K.setFyTab(el.dataset.tab); K.rerender(); },
    unsave(el) { K.state.saved = K.state.saved.filter((x) => x.id !== el.dataset.id); K.save(); K.rerender(); },
    save(el) { const s = K.storyById[el.dataset.id]; if (s) { K.toggleSaved(s); K.rerender(); } },
    share(el) { const s = K.storyById[el.dataset.id]; if (s) K.shareStory(s); },
    webSearch(el) { K.runWebSearch(el.dataset.q); },
    mapPick(el) { K.mapPick(el.dataset.iso); },
    mapClear() { K.mapClear(); },
    follow(el) {
      const iso = el.dataset.iso;
      const f = K.state.followed;
      K.state.followed = f.indexOf(iso) !== -1 ? f.filter((x) => x !== iso) : f.concat(iso);
      K.save();
      K.mapRefresh();
    },
    startLesson(el) { K.startLesson(el.dataset.id); },
    pick(el) { K.lessonAct.pick(el); }, check() { K.lessonAct.check(); }, next() { K.lessonAct.next(); },
    matchL(el) { K.lessonAct.matchL(el); }, matchR(el) { K.lessonAct.matchR(el); },
    orderAdd(el) { K.lessonAct.orderAdd(el); }, orderRemove(el) { K.lessonAct.orderRemove(el); },
    exitLesson() { K.lessonAct.exit(); }, lessonRetry() { K.lessonAct.retry(); }, lessonClose() { K.lessonAct.close(); }, lessonSeeNews() { K.lessonAct.seeNews(); },
    mapTopic(el) { K.mapTopic(el.dataset.topic); },
    theme(el) { K.state.theme = el.dataset.themeVal; K.save(); K.applyTheme(); K.rerender(); },
    exportData() {
      const blob = new Blob([JSON.stringify(K.state, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'keryke-backup.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    async resetData() {
      if (!(await K.confirmDialog(t('se_resetConfirm'), t('se_delete'), t('se_cancel')))) return;
      K.resetState();
      K.lang = K.state.lang;
      K.applyTheme();
      K.buildStories(K.state.newsLangs);
      K.rerender();
      K.showOnboarding();
    },
  };

  document.addEventListener('click', (e) => {
    const out = e.target.closest('a[data-source]');
    if (out) K.trackOpen(K.sources[out.dataset.source]);
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = actions[el.dataset.act] || K.socialActions[el.dataset.act];
    if (fn) fn(el, e);
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    if (form.dataset.form === 'search') {
      const q = form.querySelector('input').value.trim();
      if (!q) return;
      K.runWebSearch(q);
    } else {
      K.socialSubmit(form);
    }
  });

  document.addEventListener('keydown', (e) => K.lessonKey(e));

  // Feed images come from third parties and sometimes fail; drop the empty frame.
  document.addEventListener('error', (e) => {
    if (e.target.tagName !== 'IMG') return;
    const box = e.target.closest('.card-img, .story-img');
    if (box) {
      const card = box.closest('.card');
      if (card) card.classList.remove('has-img');
      box.remove();
    }
  }, true);

  K.start = function () {
    K.loadState();
    K.initSocial();
    K.lang = K.state.lang;
    K.applyTheme();
    K.buildStories(K.state.newsLangs);
    K.initTooltip();
    window.addEventListener('hashchange', onRoute);
    K.rerender();
    if (!K.state.onboarded && !window.KERYKE_NO_ONBOARDING) K.showOnboarding();
  };
})();
