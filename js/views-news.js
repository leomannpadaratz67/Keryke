/* Main, For You, Search, Story and About views. */
(function () {
  const K = (window.K = window.K || {});
  const h = K.h, t = (k, v) => K.t(k, v), icon = K.icon;
  K.views = K.views || {};

  function staleNotice() {
    if (Date.now() - K.generated < 24 * 3600e3) return '';
    return h`<div class="notice">${t('staleNews', { time: K.ago(K.generated) })}</div>`;
  }

  /* ---------- Main ---------- */
  K.views.main = function (root) {
    const stories = K.politicalStories();
    const used = new Set();
    const take = (list, n) => {
      const out = [];
      for (const s of list) {
        if (out.length >= n) break;
        if (!used.has(s.id)) { used.add(s.id); out.push(s); }
      }
      return out;
    };
    if (!stories.length) { root.innerHTML = String(h`<div class="page"><p>${t('nothingYet')}</p></div>`); return; }

    const multi = stories.filter((s) => s.sourceCount > 1);
    const pool = multi.length ? multi : stories;
    const hero = take(pool, 1)[0];
    const top = take(pool, 6);
    const blind = take(stories.filter((s) => s.blindspot), 3);
    const dateStr = new Date().toLocaleDateString(K.lang, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const sections = K.TOPIC_IDS.map((id) => ({ id, list: take(pool.filter((s) => s.topics[0] === id), 3) })).filter((x) => x.list.length);

    root.innerHTML = String(h`<div class="page page-wide">
      <header class="masthead">
        <div><h1>Keryke</h1><p class="muted">${t('tagline')}</p></div>
        <div class="masthead-meta"><span>${dateStr}</span><span>${t('updated', { time: K.ago(K.generated) })}</span></div>
      </header>
      ${staleNotice()}
      ${K.biasLegend()}
      <section class="front">
        ${K.card(hero, { cls: 'hero', image: true, excerpt: true, framing: true, kicker: t('topStory') })}
        <div class="front-list">
          <h2 class="section-title">${t('mostCovered')}</h2>
          ${top.map((s) => K.card(s, { cls: 'compact' }))}
        </div>
      </section>
      ${blind.length ? h`<section class="blind-band"><h2 class="section-title">${t('blindspots')}</h2><p class="muted section-intro">${t('blindspotsIntro')}</p><div class="grid">${blind.map((s) => K.card(s))}</div></section>` : ''}
      ${sections.map((sec) => h`<section><h2 class="section-title">${t('t_' + sec.id)}</h2><div class="grid">${sec.list.map((s) => K.card(s, { image: true }))}</div></section>`)}
    </div>`);
  };

  /* ---------- For You ---------- */
  function recommend() {
    const st = K.state;
    const reads = st.reads, total = reads.reduce((a, b) => a + b, 0);
    const leftShare = total ? (reads[0] + reads[1]) / total : 0, rightShare = total ? (reads[3] + reads[4]) / total : 0;
    const scored = K.politicalStories().filter((s) => !st.readStories[s.id]).map((s) => {
      let affinity = 0, because = null, bestWeight = 0;
      s.topics.forEach((tp, i) => {
        const w = (st.topics[tp] || 0) * (i === 0 ? 1 : 0.5);
        if (w > bestWeight) { because = tp; bestWeight = w; }
        affinity += w;
      });
      const followed = s.countries.find((c) => st.followed.indexOf(c) !== -1);
      if (followed) affinity += 1.2;
      const rank = Math.sqrt(s.score + 0.2) * (0.2 + Math.max(-0.15, affinity * 1.5));
      let reason;
      if (followed) reason = t('fy_home', { x: K.countryName(followed) });
      else if (because && st.topics[because] > 0) reason = t('fy_because', { x: t('t_' + because) });
      return { s, rank, reason, primary: s.topics[0] };
    }).sort((a, b) => b.rank - a.rank);

    // Keep variety: no topic takes more than a third of the feed.
    const perTopic = {};
    const feed = [];
    const limit = 24;
    for (const r of scored) {
      perTopic[r.primary] = (perTopic[r.primary] || 0) + 1;
      if (perTopic[r.primary] <= Math.ceil(limit / 3)) feed.push(r);
      if (feed.length >= limit) break;
    }
    // Every sixth slot goes to a well-covered story from the side the reader opens less.
    if (total >= 5 && Math.abs(leftShare - rightShare) > 0.2) {
      const want = leftShare > rightShare ? 'left' : 'right';
      const inFeed = new Set(feed.map((f) => f.s.id));
      const extra = scored.filter((r) => !inFeed.has(r.s.id) && r.s.blindspot === (want === 'left' ? 'right' : 'left'));
      extra.slice(0, Math.floor(feed.length / 6)).forEach((r, i) => {
        feed.splice(5 + i * 6, 0, Object.assign({}, r, { reason: t('fy_outside'), outside: true }));
      });
    }
    return feed;
  }

  let fyTab = 'rec';
  K.setFyTab = (tab) => { fyTab = tab; };
  K.views.foryou = function (root) {
    const chips = K.TOPIC_IDS.map((id) => {
      const on = (K.state.topics[id] || 0) > 0;
      return h`<button class="pill ${on ? 'on' : ''}" data-act="toggleTopic" data-topic="${id}" aria-pressed="${String(on)}">${t('t_' + id)}</button>`;
    });
    const saved = K.state.saved;
    let body;
    if (fyTab === 'saved') {
      body = saved.length ? h`<div class="stack">${saved.map((x) => h`<article class="card">
        <div class="card-body"><h3 class="card-title">${K.storyById[x.id] ? h`<a href="#/story/${x.id}" lang="${x.lang}">${x.title}</a>` : h`<a href="${K.safeUrl(x.url)}" target="_blank" rel="noopener noreferrer" lang="${x.lang}">${x.title}</a>`}</h3>
        ${K.biasBar(x.counts)}
        <div class="card-meta"><span>${K.sourcesLabel(x.sourceCount)}</span><span>${K.ago(x.date)}</span><button class="link-btn" data-act="unsave" data-id="${x.id}">${t('so_remove')}</button></div></div></article>`)}</div>` : h`<div class="empty-state">${icon('bookmark')}<p>${t('fy_noSaved')}</p></div>`;
    } else {
      const feed = recommend();
      body = feed.length ? h`<div class="stack">${feed.map((r) => K.card(r.s, {
        image: true, reason: r.reason, cls: r.outside ? 'outside' : '',
        extra: r.s.topics[0] ? h`<button class="link-btn" data-act="lessTopic" data-topic="${r.s.topics[0]}">${t('fy_notInterested')}</button>` : '',
      }))}</div>` : h`<div class="empty-state"><p>${t('nothingYet')}</p></div>`;
    }
    root.innerHTML = String(h`<div class="page">
      <header class="page-head"><h1>${t('fy_title')}</h1><p class="muted">${t('fy_intro')}</p></header>
      <div class="interests"><h2 class="mini-title">${t('fy_tune')}</h2><div class="pills">${chips}</div><p class="muted small">${t('fy_follow')}</p></div>
      <div class="segmented" role="tablist">
        <button role="tab" aria-selected="${String(fyTab === 'rec')}" data-act="fyTab" data-tab="rec">${t('fy_recommended')}</button>
        <button role="tab" aria-selected="${String(fyTab === 'saved')}" data-act="fyTab" data-tab="saved">${t('fy_saved')} (${saved.length})</button>
      </div>
      ${body}
    </div>`);
  };

  /* ---------- Search ---------- */
  let webState = { q: '', status: '', results: [] };
  K.views.search = function (root, params) {
    let q = '';
    try { q = decodeURIComponent(params[0] || ''); } catch (e) { q = params[0] || ''; }
    root.innerHTML = String(h`<div class="page">
      <header class="page-head"><h1>${t('s_title')}</h1></header>
      <form class="searchbar" data-form="search" role="search">${icon('search')}<input type="search" id="q" name="q" value="${q}" placeholder="${t('s_placeholder')}" aria-label="${t('s_placeholder')}" autocomplete="off"></form>
      <div id="results"></div>
    </div>`);
    const results = root.querySelector('#results');
    renderSearch(results, q);
    const input = root.querySelector('#q');
    let timer;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        history.replaceState(null, '', '#/search/' + encodeURIComponent(input.value));
        renderSearch(results, input.value);
      }, 180);
    });
    if (!q && matchMedia('(min-width: 800px)').matches) input.focus();
  };

  function trending() {
    const counts = {};
    K.politicalStories().slice(0, 60).forEach((s) => s.countries.forEach((c) => (counts[c] = (counts[c] || 0) + s.sourceCount)));
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]).slice(0, 6).map((c) => K.countryName(c))
      .concat(K.TOPIC_IDS.slice(0, 4).map((id) => t('t_' + id)));
  }

  function renderSearch(el, rawQ) {
    const q = rawQ.trim();
    if (!q) {
      el.innerHTML = String(h`<p class="muted section-intro">${t('s_hint')}</p>
        ${K.state.recent.length ? h`<h2 class="mini-title">${t('s_recent')}</h2><div class="pills">${K.state.recent.map((r) => h`<a class="pill" href="#/search/${encodeURIComponent(r)}">${r}</a>`)}</div>` : ''}
        <h2 class="mini-title">${t('s_trending')}</h2><div class="pills">${trending().map((r) => h`<a class="pill" href="#/search/${encodeURIComponent(r)}">${r}</a>`)}</div>`);
      return;
    }
    const stories = K.searchStories(q).slice(0, 20);
    const nq = K.norm(q);
    const lessons = [];
    window.KERYKE_LESSONS.forEach((c) => c.lessons.forEach((l) => {
      const hay = K.norm([l.title, l.blurb, t('cat_' + c.id)].concat(l.items.map((i) => [i.title, i.q, i.body].join(' '))).join(' '));
      const words = K.tokenize(q);
      if (words.length ? words.every((w) => hay.indexOf(w) !== -1) : hay.indexOf(nq) !== -1) lessons.push({ l, c });
    }));
    const isoHits = K.findCountries(q, q);
    const nameHits = nq.length >= 3 ? K.countries.filter((c) => K.norm(K.countryName(c.iso2)).indexOf(nq) !== -1).map((c) => c.iso2) : [];
    const countries = Array.from(new Set(isoHits.concat(nameHits))).filter((i) => K.countryByIso[i]).slice(0, 6);
    const statKey = K.statKeyFor(q);

    const nothing = !stories.length && !lessons.length && !countries.length && !statKey;
    const web = webState.q === q ? webState : { status: '' };

    el.innerHTML = String(h`
      ${nothing ? h`<p class="section-intro">${t('s_noResults', { q })}</p>` : ''}
      ${statKey ? h`<section><h2 class="section-title">${t('s_data')}</h2>
        <p class="muted small">${t('s_rank', { x: t('stat_' + statKey) })}</p>
        <table class="data-table"><tbody>${K.statRanking(statKey).map((c, i) => h`<tr><td class="num">${i + 1}</td><td><a href="#/map/${c.iso2}">${K.countryName(c.iso2)}</a></td><td class="num">${K.fmtStat(statKey, c.stats[statKey][0])}</td><td class="num muted">${c.stats[statKey][1]}</td></tr>`)}</tbody></table>
      </section>` : ''}
      ${countries.length ? h`<section><h2 class="section-title">${t('s_countries')}</h2><div class="country-hits">${countries.map((iso) => countryHit(iso))}</div></section>` : ''}
      ${lessons.length ? h`<section><h2 class="section-title">${t('s_lessons')}</h2><div class="lesson-links">${lessons.slice(0, 6).map((x) => K.lessonLink(x.l, x.c))}</div></section>` : ''}
      ${stories.length ? h`<section><h2 class="section-title">${t('s_stories')}</h2><div class="stack">${stories.map((s) => K.card(s))}</div></section>` : ''}
      <section class="web-section"><h2 class="section-title">${t('s_web')}</h2><p class="muted small">${t('s_webIntro')}</p>
        ${web.status === 'loading' ? h`<p role="status" class="muted">${t('s_webLoading')}</p>`
        : web.status === 'fail' ? h`<p role="status">${t('s_webFail')}</p><button class="btn" data-act="webSearch" data-q="${q}">${t('s_webBtn')}</button>`
        : web.status === 'done' ? (web.results.length ? h`<ul class="web-list">${web.results.map((a) => h`<li><a href="${K.safeUrl(a.url)}" target="_blank" rel="noopener noreferrer" data-source="${a.source ? a.source.id : ''}">${a.title}</a><div class="card-meta"><span>${a.source ? a.source.name : a.domain}</span>${a.source ? K.leanChip(a.source) : h`<span class="chip">${t('notRated')}</span>`}</div></li>`)}</ul>` : h`<p>${t('s_webNone')}</p>`)
        : h`<button class="btn" data-act="webSearch" data-q="${q}">${t('s_webBtn')}</button>`}
      </section>`);
    K.rememberSearch(q);
  }
  K.renderSearch = renderSearch;

  function countryHit(iso) {
    const c = K.countryByIso[iso];
    const pop = c.stats && c.stats.pop;
    return h`<a class="country-hit" href="#/map/${iso}"><strong>${K.countryName(iso)}</strong>
      <span class="muted small">${[c.capital, pop ? K.fmtStat('pop', pop[0]) : ''].filter(Boolean).join(' · ')}</span></a>`;
  }

  let recentTimer;
  K.rememberSearch = function (q) {
    clearTimeout(recentTimer);
    if (q.length < 3) return;
    // Debounced so partially typed words are not stored.
    recentTimer = setTimeout(() => {
      K.state.recent = [q].concat(K.state.recent.filter((r) => r !== q)).slice(0, 6);
      K.save();
    }, 1500);
  };

  K.runWebSearch = async function (q) {
    webState = { q, status: 'loading', results: [] };
    const el = document.getElementById('results');
    if (el) renderSearch(el, q);
    try {
      const results = await K.searchWeb(q);
      webState = { q, status: 'done', results };
    } catch (e) {
      webState = { q, status: 'fail', results: [] };
    }
    const now = document.getElementById('results');
    const input = document.getElementById('q');
    if (now && input && input.value.trim() === q) renderSearch(now, q);
  };

  /* ---------- Story ---------- */
  K.views.story = function (root, params) {
    const s = K.storyById[params[0]];
    if (!s) {
      root.innerHTML = String(h`<div class="page"><p>${t('st_notFound')}</p><a class="btn" href="#/main">${t('st_back')}</a></div>`);
      return;
    }
    K.trackStory(s);
    const groups = [
      { key: 'left', label: t('side_left'), items: s.articles.filter((a) => a.src.lean < 0 && a.src.lean !== null) },
      { key: 'center', label: t('side_center'), items: s.articles.filter((a) => a.src.lean === 0) },
      { key: 'right', label: t('side_right'), items: s.articles.filter((a) => a.src.lean > 0) },
    ];
    const off = s.articles.filter((a) => a.src.lean === null || a.src.lean === undefined);
    const related = K.topicLessons(s.topics, 3);
    const saved = K.isSaved(s.id);

    const sourceRow = (a) => h`<li class="src-row">
      <div class="src-head"><strong>${a.src.name}</strong>${K.leanChip(a.src)}${a.src.stateFunded ? h`<span class="chip">${t('stateFunded')}</span>` : ''}</div>
      <a href="${K.safeUrl(a.url)}" target="_blank" rel="noopener noreferrer" data-source="${a.src.id}" lang="${a.lang}" class="src-title">${a.title}${icon('ext', 'inline')}</a>
      <div class="muted small">${K.ago(a.date)}</div>
    </li>`;

    root.innerHTML = String(h`<div class="page page-story">
      <a class="back" href="#/main" data-act="back">${icon('back')}${t('st_back')}</a>
      <header class="story-head">
        <div class="pills small-pills">${s.topics.slice(0, 3).map((tp) => h`<span class="chip">${t('t_' + tp)}</span>`)}${K.blindTag(s)}</div>
        <h1 lang="${s.lang}">${s.title}</h1>
        ${s.image ? h`<div class="story-img"><img src="${K.safeUrl(s.image)}" alt="" referrerpolicy="no-referrer"></div>` : ''}
        ${s.excerpt ? h`<p class="story-excerpt" lang="${s.lang}">${s.excerpt}</p>` : ''}
        <p class="muted small">${t('st_lead')} · ${K.ago(s.date)}</p>
        <div class="story-actions">
          <button class="btn ${saved ? 'btn-on' : ''}" data-act="save" data-id="${s.id}" aria-pressed="${String(saved)}">${icon('bookmark')}${saved ? t('st_saved') : t('st_save')}</button>
          <button class="btn" data-act="share" data-id="${s.id}">${icon('share')}${t('st_share')}</button>
          <button class="btn" data-act="scrollDiscuss">${icon('reply')}${t('c_discuss')}</button>
        </div>
      </header>

      <section class="coverage">
        <h2 class="mini-title">${t('st_breakdown')} · ${K.sourcesLabel(s.sourceCount)}</h2>
        ${K.biasBar(s.counts, { large: true })}
        <div class="coverage-counts">${K.biasSummary(s)}${s.offSpectrum ? h`<span class="muted">${t('stateMedia')} ${s.offSpectrum}</span>` : ''}</div>
        ${K.biasLegend()}
        ${s.sourceCount === 1 ? h`<p class="notice">${t('st_oneSource')}</p>` : ''}
      </section>

      <section>
        <h2 class="section-title">${t('st_allSources')}</h2>
        <div class="sides">
          ${groups.map((g) => (g.items.length ? h`<div class="side side-${g.key}"><h3>${g.label} <span class="muted">(${g.items.length})</span></h3><ul class="src-list">${g.items.map(sourceRow)}</ul></div>` : ''))}
          ${off.length ? h`<div class="side side-off"><h3>${t('stateMedia')} <span class="muted">(${off.length})</span></h3><ul class="src-list">${off.map(sourceRow)}</ul></div>` : ''}
        </div>
      </section>

      ${s.countries.length ? h`<section><h2 class="mini-title">${t('st_countries')}</h2><div class="pills">${s.countries.map((c) => h`<a class="pill" href="#/map/${c}">${K.countryName(c)}</a>`)}</div></section>` : ''}
      ${related.length ? h`<section><h2 class="section-title">${t('st_learn')}</h2><div class="lesson-links">${related.map((x) => K.lessonLink(x.lesson, x.cat))}</div></section>` : ''}

      <section id="discussion"><h2 class="section-title">${t('c_discussion')}</h2>
        ${K.social.mode === 'local' ? h`<div class="notice">${t('c_preview')}</div>` : ''}
        <div id="discussionBody"><p class="muted" role="status">${t('c_loading')}</p></div></section>
    </div>`);
    K.loadDiscussion(s);
  };

  /* ---------- About ---------- */
  K.views.about = function (root) {
    const all = Object.values(K.sources);
    const group = (list, label) => h`<div class="about-group"><h3>${label}</h3><ul>${list.sort((a, b) => a.name.localeCompare(b.name)).map((src) => h`<li><span>${src.name} <span class="muted small">${K.countryName(src.country)}</span></span><span class="muted small">${src.n ? t('ab_articles', { n: src.n }) : t('ab_silent')}</span></li>`)}</ul></div>`;
    root.innerHTML = String(h`<div class="page">
      <header class="page-head"><h1>${t('ab_title')}</h1></header>
      <div class="prose"><p>${t('ab_p1')}</p><p>${t('ab_p2')}</p><p>${t('ab_p3')}</p><p>${t('ab_p4')}</p><p>${t('ab_p5')}</p></div>
      ${K.biasLegend()}
      <h2 class="section-title">${t('ab_list')}</h2>
      <div class="about-groups">
        ${[-2, -1, 0, 1, 2].map((l) => group(all.filter((s) => s.lean === l), K.leanName(l)))}
        ${group(all.filter((s) => s.lean === null || s.lean === undefined), t('stateMedia'))}
      </div>
    </div>`);
  };
})();
