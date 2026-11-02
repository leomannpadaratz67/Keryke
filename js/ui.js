/* Shared state, safe templating and reusable components. */
(function () {
  const K = (window.K = window.K || {});

  /* ---------- Safe templating: interpolated values are escaped unless wrapped in raw() ---------- */
  class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
  K.raw = (s) => new Raw(String(s));
  const esc = (K.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const ser = (v) => {
    if (v === null || v === undefined || v === false) return '';
    if (v instanceof Raw) return v.s;
    if (Array.isArray(v)) return v.map(ser).join('');
    return esc(v);
  };
  const h = (K.h = (st, ...vals) => new Raw(st.reduce((o, s, i) => o + s + (i < vals.length ? ser(vals[i]) : ''), '')));
  K.safeUrl = (u) => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '#');
  const t = (k, v) => K.t(k, v);

  /* ---------- Persistent state ---------- */
  const KEY = 'keryke.v1';
  const browserLang = () => {
    const l = String((navigator.language || 'en')).slice(0, 2);
    return K.LANGS[l] ? l : 'en';
  };
  const defaults = () => {
    const lang = browserLang();
    return {
      id: Math.random().toString(36).slice(2, 10), onboarded: false, lang, theme: 'system', name: '',
      newsLangs: lang === 'en' ? ['en'] : ['en', lang], topics: {}, followed: [], xp: 0, streak: { n: 0, last: '' }, daily: { date: '', xp: 0 },
      lessons: {}, reads: [0, 0, 0, 0, 0], readStories: {}, saved: [], recent: [], muted: [],
    };
  };
  K.loadState = function (raw) {
    let saved = {};
    try { saved = JSON.parse(raw === undefined ? localStorage.getItem(KEY) : raw) || {}; } catch (e) { saved = {}; }
    K.state = Object.assign(defaults(), saved);
  };
  K.save = function () {
    try { localStorage.setItem(KEY, JSON.stringify(K.state)); } catch (e) { /* private mode: state lasts for this session */ }
  };
  K.resetState = function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    K.state = defaults();
  };
  K.todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
  K.addXp = function (n) {
    const s = K.state;
    const today = K.todayStr();
    s.xp += n;
    if (s.daily.date !== today) s.daily = { date: today, xp: 0 };
    s.daily.xp += n;
    if (s.streak.last !== today) {
      const y = new Date(Date.now() - 864e5);
      const yesterday = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
      s.streak = { n: s.streak.last === yesterday ? s.streak.n + 1 : 1, last: today };
    }
    K.save();
  };
  /** A streak is only alive if the last lesson was today or yesterday. */
  K.currentStreak = function () {
    const s = K.state.streak;
    if (!s.last) return 0;
    const y = new Date(Date.now() - 864e5);
    const yesterday = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
    return s.last === K.todayStr() || s.last === yesterday ? s.n : 0;
  };

  /* ---------- Formatting ---------- */
  K.ago = function (ms) {
    const diff = (Date.now() - ms) / 1000;
    if (diff < 60) return t('now');
    let rtf;
    try { rtf = new Intl.RelativeTimeFormat(K.lang, { numeric: 'auto', style: 'short' }); } catch (e) { return new Date(ms).toLocaleDateString(); }
    if (diff < 3600) return rtf.format(-Math.round(diff / 60), 'minute');
    if (diff < 86400) return rtf.format(-Math.round(diff / 3600), 'hour');
    return rtf.format(-Math.round(diff / 86400), 'day');
  };
  K.fmtStat = function (key, val) {
    const f = K.STATS[key].fmt;
    if (f === 'compact') return new Intl.NumberFormat(K.lang, { notation: 'compact', maximumFractionDigits: 1 }).format(val);
    if (f === 'usd') return new Intl.NumberFormat(K.lang, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(val);
    if (f === 'pct') return new Intl.NumberFormat(K.lang, { maximumFractionDigits: 1 }).format(val) + '%';
    return t('yearsUnit', { n: new Intl.NumberFormat(K.lang, { maximumFractionDigits: 1 }).format(val) });
  };
  K.sourcesLabel = (n) => (n === 1 ? t('source1') : t('sources', { n }));

  /* ---------- Icons ---------- */
  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>',
    foryou: '<path d="M12 3l2.5 5.6 6 .6-4.5 4.1 1.3 6L12 16.2 6.700 19.300l1.300-6L3.500 9.200l6-.6z"/>',
    main: '<path d="M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2h-1M7.500 9h6M7.500 12.500h6M7.500 16h4"/>',
    map: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.500 2.700 3.800 5.700 3.800 9s-1.300 6.300-3.800 9c-2.500-2.700-3.800-5.700-3.800-9S9.500 5.700 12 3z"/>',
    learn: '<path d="M2.500 9.500 12 5l9.500 4.500L12 14zM6.500 11.500V16c1.500 1.500 3.300 2.200 5.500 2.200s4-.7 5.500-2.200v-4.500M21.500 9.500V15"/>',
    social: '<circle cx="9" cy="8" r="3.500"/><path d="M2.500 20c.5-3.800 3-6 6.500-6s6 2.200 6.500 6M16 4.800a3.500 3.500 0 0 1 0 6.400M18 14.500c2 .8 3.200 2.700 3.500 5.500"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.400 15a1.700 1.700 0 0 0 .3 1.800l.1.100a2 2 0 1 1-2.800 2.800l-.1-.1a1.700 1.700 0 0 0-2.900 1.200V21a2 2 0 0 1-4 0v-.1a1.700 1.700 0 0 0-2.900-1.200l-.1.100a2 2 0 1 1-2.800-2.800l.1-.1a1.700 1.700 0 0 0-1.200-2.900H3a2 2 0 0 1 0-4h.1a1.700 1.700 0 0 0 1.200-2.900l-.1-.1a2 2 0 1 1 2.800-2.800l.1.100a1.700 1.700 0 0 0 2.900-1.200V3a2 2 0 0 1 4 0v.1a1.700 1.700 0 0 0 2.900 1.200l.1-.1a2 2 0 1 1 2.800 2.800l-.1.1a1.700 1.700 0 0 0 1.200 2.900h.1a2 2 0 0 1 0 4h-.1a1.700 1.700 0 0 0-1.500 1z"/>',
    bookmark: '<path d="M6 3.500h12V21l-6-4.200L6 21z"/>',
    share: '<path d="M12 15V3.500M7.500 8 12 3.500 16.500 8M5 13v7h14v-7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    check: '<path d="m4.500 12.500 5 5 10-11"/>',
    lock: '<rect x="5" y="11" width="14" height="9.500" rx="2"/><path d="M8 11V7.500a4 4 0 0 1 8 0V11"/>',
    heart: '<path d="M12 20.500S3.500 15.500 3.500 9.200A4.700 4.700 0 0 1 12 6.500a4.700 4.700 0 0 1 8.500 2.700c0 6.300-8.500 11.300-8.500 11.300z"/>',
    flame: '<path d="M12 2.500c.5 3.500 5.500 5.700 5.500 11a5.500 5.500 0 0 1-11 0c0-2 .8-3.400 2-4.500.2 1.500 1 2.300 2 2.700-.5-3.500.2-6.700 1.500-9.200z"/>',
    star: '<path d="M12 3l2.700 5.800 6.300.7-4.700 4.300 1.300 6.200-5.600-3.200-5.600 3.200 1.300-6.200L3 9.500l6.300-.7z"/>',
    reply: '<path d="M4 5.500h16v11H10l-4.500 3.500V16.500H4z"/>',
    repost: '<path d="M7 19.500 3.500 16 7 12.500M3.500 16H17a3 3 0 0 0 3-3v-1.500M17 4.500 20.500 8 17 11.500M20.500 8H7a3 3 0 0 0-3 3v1.500"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', reset: '<path d="M4 12a8 8 0 1 0 2.500-5.800M4 4.500v4h4"/>',
    back: '<path d="M15 5l-7 7 7 7"/>', ext: '<path d="M8 16 19 5M11 5h8v8M19 15v4H5V5h4"/>', eyeoff: '<path d="M4 4l16 16M10 5.300A9 9 0 0 1 21 12a12 12 0 0 1-2.500 3.300M6.200 7.300A12 12 0 0 0 3 12c1.700 3.800 5 6.200 9 6.200 1.500 0 2.800-.3 4-.9"/>',
  };
  const icon = (K.icon = (n, cls) => K.raw(`<svg class="icon ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[n] || ''}</svg>`));
  K.logo = () => K.raw('<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><path d="M16 5v24" stroke-width="2.200"/><circle cx="16" cy="4.500" r="2" class="fill"/><path d="M10 7c0 3 3 3.500 6 5s6 2.500 6 5.500-3 3.500-6 5-6 1.500-6 4M22 7c0 3-3 3.500-6 5s-6 2.500-6 5.500 3 3.500 6 5 6 1.500 6 4" stroke-width="1.800"/></svg>');

  /* ---------- Bias components ---------- */
  K.leanName = (lean) => t('l' + (lean + 2));
  K.biasBar = function (counts, opts) {
    const o = opts || {};
    const total = counts.reduce((a, b) => a + b, 0);
    const label = counts.map((n, i) => `${t('l' + i)}: ${n}`).join(', ');
    if (!total) return h`<div class="bias empty ${o.large ? 'large' : ''}" role="img" aria-label="${t('notRated')}"></div>`;
    const segs = counts.map((n, i) => (n ? h`<span class="seg lean${i}" style="flex-grow:${n}" data-tip="${t('l' + i)}: ${n}"></span>` : ''));
    return h`<div class="bias ${o.large ? 'large' : ''}" role="img" aria-label="${label}">${segs}</div>`;
  };
  K.leanChip = function (src) {
    if (src.stateRun) return h`<span class="chip chip-state" data-tip="${t('stateMedia')}">${t('stateRun')}</span>`;
    if (src.lean === null || src.lean === undefined) return h`<span class="chip">${t('notRated')}</span>`;
    return h`<span class="chip lean-chip"><i class="dot lean${src.lean + 2}"></i>${K.leanName(src.lean)}</span>`;
  };
  K.biasSummary = function (s) {
    return h`<span class="bias-sum"><span>${t('side_left')} ${s.left}</span><span>${t('side_center')} ${s.center}</span><span>${t('side_right')} ${s.right}</span></span>`;
  };
  K.biasLegend = () => h`<div class="legend" aria-label="${t('legendCount')}">${[0, 1, 2, 3, 4].map((i) => h`<span class="legend-item"><i class="dot lean${i}"></i>${t('l' + i)}</span>`)}<a class="legend-link" href="#/about">${t('howRated')}</a></div>`;

  /* ---------- Story cards ---------- */
  K.blindTag = (s) => (s.blindspot ? h`<span class="tag tag-blind" data-tip="${t('blindTip')}">${icon('eyeoff')}${t(s.blindspot === 'right' ? 'blindRight' : 'blindLeft')}</span>` : '');
  K.card = function (s, o) {
    o = o || {};
    const framing = o.framing && s.sourceCount > 1 ? K.framing(s) : '';
    const img = o.image && s.image ? h`<div class="card-img"><img src="${K.safeUrl(s.image)}" alt="" loading="lazy" referrerpolicy="no-referrer"></div>` : '';
    return h`<article class="card ${o.cls || ''} ${s.image && o.image ? 'has-img' : ''}">
      ${img}
      <div class="card-body">
        ${o.kicker ? h`<div class="kicker">${o.kicker}</div>` : ''}
        ${o.reason ? h`<div class="reason">${o.reason}</div>` : ''}
        <h3 class="card-title"><a href="#/story/${s.id}" lang="${s.lang}">${s.title}</a></h3>
        ${o.excerpt && s.excerpt ? h`<p class="card-excerpt" lang="${s.lang}">${s.excerpt}</p>` : ''}
        ${K.biasBar(s.counts)}
        <div class="card-meta">
          <span>${K.sourcesLabel(s.sourceCount)}</span><span>${K.ago(s.date)}</span>
          ${s.topics[0] ? h`<span>${t('t_' + s.topics[0])}</span>` : ''}
          ${o.showLang && s.lang !== K.lang ? h`<span class="chip">${K.LANGS[s.lang] || s.lang}</span>` : ''}
          ${K.blindTag(s)}
          ${o.extra || ''}
        </div>
        ${framing}
      </div>
    </article>`;
  };

  /** One real headline per side, so the difference in framing is visible before opening the story. */
  K.framing = function (s) {
    const pick = (test, prefer) => s.articles.filter(test).sort((a, b) => prefer(b.src.lean) - prefer(a.src.lean))[0];
    const rows = [
      { key: 'left', label: t('side_left'), a: pick((a) => a.src.lean < 0 && a.src.lean !== null, (l) => -l) },
      { key: 'center', label: t('side_center'), a: pick((a) => a.src.lean === 0, () => 0) },
      { key: 'right', label: t('side_right'), a: pick((a) => a.src.lean > 0, (l) => l) },
    ].filter((r) => r.a);
    if (rows.length < 2) return '';
    return h`<div class="framing"><h4>${t('st_sideBySide')}</h4><div class="framing-cols">${rows.map((r) => h`<div class="framing-col side-${r.key}">
      <span class="framing-side">${r.label}</span>
      <a href="${K.safeUrl(r.a.url)}" target="_blank" rel="noopener noreferrer" data-source="${r.a.src.id}" lang="${r.a.lang}">${r.a.title}</a>
      <span class="muted small">${r.a.src.name}</span></div>`)}</div></div>`;
  };

  K.topicLessons = function (topics, limit) {
    const out = [];
    window.KERYKE_LESSONS.forEach((c) => c.lessons.forEach((l) => {
      const m = l.topics.filter((x) => topics.indexOf(x) !== -1).length;
      if (m) out.push({ lesson: l, cat: c, rank: m + topics.indexOf(l.topics.find((x) => topics.indexOf(x) !== -1)) * -0.1 });
    }));
    return out.sort((a, b) => b.rank - a.rank).slice(0, limit || 3);
  };
  K.lessonLink = (l, c) => h`<a class="lesson-link cat-${c.color}" href="#/learn/${c.id}/${l.id}"><span class="lesson-link-cat">${t('cat_' + c.id)}</span><strong>${l.title}</strong><span class="muted">${l.blurb}</span></a>`;

  K.countrySelectOptions = function (selected) {
    const items = K.countries.map((c) => [c.iso2, K.countryName(c.iso2)]);
    items.sort((a, b) => a[1].localeCompare(b[1], K.lang));
    return items.map((c) => h`<option value="${c[0]}" ${K.raw(c[0] === selected ? 'selected' : '')}>${c[1]}</option>`);
  };

  /* ---------- Toast & tooltip ---------- */
  let toastTimer;
  K.toast = function (msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  };

  K.initTooltip = function () {
    const tip = document.getElementById('tip');
    const move = (e) => {
      const r = tip.getBoundingClientRect();
      const x = Math.min(window.innerWidth - r.width - 8, Math.max(8, e.clientX + 12));
      const y = e.clientY - r.height - 10 < 4 ? e.clientY + 18 : e.clientY - r.height - 10;
      tip.style.transform = `translate(${x}px, ${y}px)`;
    };
    document.addEventListener('mouseover', (e) => {
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (!el) { tip.classList.remove('show'); return; }
      tip.textContent = el.getAttribute('data-tip');
      tip.classList.add('show');
      move(e);
    });
    document.addEventListener('mousemove', (e) => { if (tip.classList.contains('show')) move(e); });
  };

  /* ---------- Dialogs ---------- */
  K.confirmDialog = function (message, okLabel, cancelLabel) {
    return new Promise((resolve) => {
      const d = document.createElement('dialog');
      d.className = 'dialog';
      d.innerHTML = String(h`<p>${message}</p><div class="dialog-actions"><button class="btn" value="no">${cancelLabel}</button><button class="btn btn-danger" value="yes">${okLabel}</button></div>`);
      document.body.appendChild(d);
      const done = (v) => { d.close(); d.remove(); resolve(v); };
      d.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) done(b.value === 'yes'); });
      d.addEventListener('cancel', (e) => { e.preventDefault(); done(false); });
      d.showModal();
    });
  };

  /* ---------- Saving, sharing, tracking ---------- */
  K.isSaved = (id) => K.state.saved.some((x) => x.id === id);
  K.toggleSaved = function (s) {
    if (K.isSaved(s.id)) K.state.saved = K.state.saved.filter((x) => x.id !== s.id);
    else K.state.saved.unshift({ id: s.id, title: s.title, lang: s.lang, url: s.articles[0].url, counts: s.counts, sourceCount: s.sourceCount, date: s.date });
    K.save();
  };
  K.trackOpen = function (src) {
    if (src && src.lean !== null && src.lean !== undefined) { K.state.reads[src.lean + 2]++; K.save(); }
  };
  K.trackStory = function (s) {
    if (K.state.readStories[s.id]) return;
    K.state.readStories[s.id] = Date.now();
    s.topics.slice(0, 2).forEach((tp) => { K.state.topics[tp] = Math.min(3, (K.state.topics[tp] || 0) + 0.1); });
    // Only the recent read history matters, so the store cannot grow without limit.
    const ids = Object.keys(K.state.readStories);
    if (ids.length > 400) ids.sort((a, b) => K.state.readStories[a] - K.state.readStories[b]).slice(0, ids.length - 400).forEach((i) => delete K.state.readStories[i]);
    K.save();
  };

  K.shareStory = function (s) {
    const d = document.createElement('dialog');
    d.className = 'dialog';
    d.innerHTML = String(h`<form method="dialog">
      <h2>${t('so_shareTitle')}</h2><p class="muted" lang="${s.lang}">${s.title}</p>
      <label class="field"><span>${t('so_shareNote')}</span><input name="note" maxlength="140" autocomplete="off"></label>
      <div class="dialog-actions"><button class="btn" type="button" data-dialog-cancel>${t('so_shareCancel')}</button><button class="btn btn-primary" value="send" type="submit">${t('so_shareSend')}</button></div>
    </form>`);
    document.body.appendChild(d);
    d.querySelector('[data-dialog-cancel]').addEventListener('click', () => d.close('cancel'));
    d.addEventListener('close', async () => {
      const send = d.returnValue === 'send';
      const note = d.querySelector('[name=note]').value.trim();
      d.remove();
      if (!send) return;
      const url = s.articles[0].url;
      const summary = `${t('side_left')} ${s.left} · ${t('side_center')} ${s.center} · ${t('side_right')} ${s.right}`;
      const text = [note, s.title, summary + ' (Keryke)', url].filter(Boolean).join('\n');
      try {
        if (navigator.share) { await navigator.share({ title: s.title, text }); return; }
      } catch (e) { if (e.name === 'AbortError') return; }
      K.copyText(text).then((ok) => { if (ok) K.toast(t('so_shareCopied')); });
    });
    d.showModal();
  };

  K.copyText = async function (text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    ta.remove();
    return ok;
  };

  K.applyTheme = function () {
    const th = K.state.theme;
    if (th === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', th);
  };
})();
