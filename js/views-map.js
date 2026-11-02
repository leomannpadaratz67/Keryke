/* World tab, the only place countries drive the experience. Selecting a country zooms in and shows
   its news and data; selecting several shows the news connecting them. */
(function () {
  const K = (window.K = window.K || {});
  const h = K.h, t = (k, v) => K.t(k, v), icon = K.icon;
  K.views = K.views || {};

  const WIDTH = 960, HEIGHT = 520;
  let multi = false;
  let selected = [];
  let topicFilter = '';
  let features = null;
  let mapState = null;

  function loadAtlas() {
    if (window.KERYKE_ATLAS) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/countries-50m.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Natural Earth units with no ISO numeric code, tied back to a country record by name.
  const NAME_FIX = { Kosovo: 'XK' };

  function prepareFeatures() {
    if (features) return features;
    const atlas = window.KERYKE_ATLAS;
    features = window.topojson.feature(atlas, atlas.objects.countries).features.filter((f) => f.id !== '010');
    features.forEach((f) => {
      const c = K.countryByNum[f.id] || K.countryByIso[NAME_FIX[f.properties.name]];
      f.iso = c ? c.iso2 : null;
    });
    return features;
  }

  const nameOf = (f) => (f.iso ? K.countryName(f.iso) : f.properties.name);
  function coverageBin(n) {
    if (!n) return 0;
    const max = Math.max.apply(null, Object.values(K.coverage).concat(1));
    return Math.min(5, 1 + Math.floor((Math.sqrt(n) / Math.sqrt(max)) * 5));
  }

  /** The mainland, so Alaska or overseas islands don't pull the zoom out over an ocean. */
  function mainPolygon(f) {
    if (f.geometry.type !== 'MultiPolygon') return f;
    let best = null, bestArea = -1;
    f.geometry.coordinates.forEach((coordinates) => {
      const poly = { type: 'Polygon', coordinates };
      const area = window.d3.geoArea(poly);
      if (area > bestArea) { bestArea = area; best = poly; }
    });
    return best;
  }

  K.views.map = function (root, params) {
    selected = (params[0] || '').split(',').filter((i) => K.countryByIso[i]);
    if (selected.length > 1) multi = true;
    topicFilter = '';
    mapState = null;
    const trending = Object.keys(K.coverage).filter((i) => K.countryByIso[i]).sort((a, b) => K.coverage[b] - K.coverage[a]).slice(0, 12);
    root.innerHTML = String(h`<div class="map-page">
      <div class="map-col">
        <header class="map-head">
          <div><h1>${t('m_title')}</h1><p class="muted small">${t('m_hint')}</p></div>
          <div class="map-tools">
            <label class="toggle"><input type="checkbox" id="multi" ${K.raw(multi ? 'checked' : '')}><span>${t('m_multi')}</span></label>
            <select id="countryFind" aria-label="${t('m_find')}"><option value="">${t('m_find')}</option>${K.countrySelectOptions('')}</select>
          </div>
        </header>
        <div class="map-frame" id="mapFrame">
          <p class="muted map-loading" role="status">${t('m_loading')}</p>
          <div class="zoom">
            <button class="icon-btn" id="zoomIn" aria-label="${t('m_zoomIn')}" data-tip="${t('m_zoomIn')}">${icon('plus')}</button>
            <button class="icon-btn" id="zoomOut" aria-label="${t('m_zoomOut')}" data-tip="${t('m_zoomOut')}">${icon('minus')}</button>
            <button class="icon-btn" id="zoomReset" aria-label="${t('m_reset')}" data-tip="${t('m_reset')}">${icon('reset')}</button>
          </div>
        </div>
        <div class="map-legend"><span>${t('m_legend')}</span><span class="ramp-end">${t('m_none')}</span><div class="ramp"><i class="bin0"></i><i class="bin1"></i><i class="bin2"></i><i class="bin3"></i><i class="bin4"></i><i class="bin5"></i></div><span class="ramp-end">${t('m_many')}</span><span class="legend-hotspot"><i class="hotspot-dot"></i>${t('m_hotspots')}</span></div>
        <p class="muted small map-note">${t('m_borderNote')}</p>
        <div class="map-trending"><h2 class="mini-title">${t('s_trending')}</h2>
        <div class="pills">${trending.map((i) => h`<button class="pill" data-act="mapPick" data-iso="${i}">${K.countryName(i)} <span class="muted">${K.coverage[i]}</span></button>`)}</div></div>
      </div>
      <aside class="map-panel" id="mapPanel" aria-live="polite"></aside>
    </div>`);

    root.querySelector('#multi').addEventListener('change', (e) => {
      multi = e.target.checked;
      if (!multi && selected.length > 1) { selected = selected.slice(-1); syncSelection(); }
    });
    root.querySelector('#countryFind').addEventListener('change', (e) => {
      if (e.target.value) pick(e.target.value);
      e.target.value = '';
    });
    renderPanel();

    loadAtlas().then(() => {
      if (document.getElementById('mapFrame') === root.querySelector('#mapFrame')) drawMap(root);
    }).catch(() => {
      const l = root.querySelector('.map-loading');
      if (l) l.textContent = t('m_loadFail');
    });
  };

  function drawMap(root) {
    const frame = root.querySelector('#mapFrame');
    const load = frame.querySelector('.map-loading');
    if (load) load.remove();
    const d3 = window.d3;
    const list = prepareFeatures();
    const projection = d3.geoNaturalEarth1().fitExtent([[4, 4], [WIDTH - 4, HEIGHT - 4]], { type: 'FeatureCollection', features: list });
    const path = d3.geoPath(projection);
    const svg = d3.select(frame).insert('svg', ':first-child')
      .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`).attr('class', 'world').attr('role', 'img').attr('aria-label', t('m_title'));
    const g = svg.append('g');
    g.selectAll('path.country').data(list).join('path')
      .attr('d', path)
      .attr('class', (f) => `country bin${coverageBin(K.coverage[f.iso] || 0)}${f.iso ? '' : ' no-iso'}`)
      .attr('data-tip', (f) => `${nameOf(f)}: ${f.iso ? K.coverage[f.iso] || 0 : 0}`)
      .on('click', (e, f) => {
        if (!f.iso) { K.toast(`${f.properties.name}: ${t('m_noData')}`); return; }
        pick(f.iso, e.ctrlKey || e.metaKey || e.shiftKey);
      });

    // Hotspots: like a conflict tracker's pins, but derived from the current news, so they carry no judgement beyond coverage.
    const hotspotData = list.filter((f) => f.iso && (K.securityCount[f.iso] || 0) >= 3);
    const maxHot = Math.max.apply(null, hotspotData.map((f) => K.securityCount[f.iso]).concat(1));
    const overlay = g.append('g').attr('class', 'overlay-layer');
    const hotspots = overlay.selectAll('g.hotspot').data(hotspotData).join('g').attr('class', 'hotspot')
      .attr('data-tip', (f) => `${nameOf(f)}: ${K.securityCount[f.iso]} · ${t('m_hotspots')}`)
      .on('click', (e, f) => pick(f.iso, e.ctrlKey || e.metaKey || e.shiftKey));
    hotspots.append('circle').attr('r', (f) => 4 + 6 * Math.sqrt(K.securityCount[f.iso] / maxHot));
    const labels = overlay.append('g').attr('class', 'label-layer');

    const place = (k) => {
      hotspots.attr('transform', (f) => { const c = path.centroid(mainPolygon(f)); return `translate(${c[0]},${c[1]}) scale(${1 / k})`; });
      labels.selectAll('text').attr('transform', (f) => { const c = path.centroid(mainPolygon(f)); return `translate(${c[0]},${c[1]}) scale(${1 / k})`; });
    };
    const zoom = d3.zoom().scaleExtent([1, 24]).translateExtent([[0, 0], [WIDTH, HEIGHT]])
      .on('zoom', (e) => { g.attr('transform', e.transform); place(e.transform.k); });
    svg.call(zoom);
    root.querySelector('#zoomIn').addEventListener('click', () => svg.transition().duration(200).call(zoom.scaleBy, 1.7));
    root.querySelector('#zoomOut').addEventListener('click', () => svg.transition().duration(200).call(zoom.scaleBy, 1 / 1.7));
    root.querySelector('#zoomReset').addEventListener('click', () => svg.transition().duration(300).call(zoom.transform, d3.zoomIdentity));
    mapState = { svg, g, zoom, path, labels, place };
    place(1);
    highlight();
    focusSelection(false);
  }

  function highlight() {
    if (!mapState) return;
    const isSel = (f) => f.iso && selected.indexOf(f.iso) !== -1;
    mapState.svg.selectAll('path.country').classed('selected', isSel);
    mapState.svg.selectAll('path.country').filter(isSel).raise();
    mapState.g.select('.overlay-layer').raise();
    mapState.labels.selectAll('text').data(prepareFeatures().filter(isSel), (f) => f.iso).join('text')
      .attr('class', 'country-label').attr('text-anchor', 'middle').attr('dy', '-1.3em').text(nameOf);
    mapState.place(window.d3.zoomTransform(mapState.svg.node()).k);
  }

  /** Flies the map to the selection, or back out when nothing is selected. */
  function focusSelection(animate) {
    if (!mapState) return;
    const d3 = window.d3;
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = animate && !reduce ? 750 : 0;
    const chosen = prepareFeatures().filter((f) => f.iso && selected.indexOf(f.iso) !== -1);
    let target = d3.zoomIdentity;
    if (chosen.length) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      chosen.forEach((f) => {
        const b = mapState.path.bounds(mainPolygon(f));
        x0 = Math.min(x0, b[0][0]); y0 = Math.min(y0, b[0][1]);
        x1 = Math.max(x1, b[1][0]); y1 = Math.max(y1, b[1][1]);
      });
      const k = Math.max(1, Math.min(20, 0.7 / Math.max((x1 - x0) / WIDTH, (y1 - y0) / HEIGHT)));
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      // Keep the view inside the map so a coastal country doesn't sit against empty space.
      const tx = Math.min(0, Math.max(WIDTH - WIDTH * k, WIDTH / 2 - k * cx));
      const ty = Math.min(0, Math.max(HEIGHT - HEIGHT * k, HEIGHT / 2 - k * cy));
      target = d3.zoomIdentity.translate(tx, ty).scale(k);
    }
    if (duration) mapState.svg.transition().duration(duration).ease(d3.easeCubicInOut).call(mapState.zoom.transform, target);
    else mapState.svg.call(mapState.zoom.transform, target);
  }

  function pick(iso, additive) {
    const i = selected.indexOf(iso);
    if (multi || additive) {
      if (i !== -1) selected.splice(i, 1);
      else selected.push(iso);
      if (selected.length > 1 && !multi) {
        multi = true;
        const box = document.getElementById('multi');
        if (box) box.checked = true;
      }
    } else {
      selected = i !== -1 && selected.length === 1 ? [] : [iso];
    }
    topicFilter = '';
    syncSelection();
  }
  K.mapPick = pick;
  K.mapRefresh = () => renderPanel();
  K.mapClear = function () { selected = []; topicFilter = ''; syncSelection(); };
  K.mapTopic = function (id) { topicFilter = id; renderPanel(); };

  function syncSelection() {
    history.replaceState(null, '', '#/map/' + selected.join(','));
    highlight();
    focusSelection(true);
    renderPanel();
  }

  const STAT_KEYS = ['pop', 'gdp', 'gdppc', 'growth', 'inflation', 'unemployment', 'military', 'life'];

  function statBlock(c) {
    const rows = STAT_KEYS.filter((k) => c.stats && c.stats[k]);
    if (!rows.length) return h`<p class="muted small">${t('m_noData')}</p>`;
    return h`<dl class="stats">${rows.map((k) => h`<div class="stat"><dt>${t('stat_' + k)}</dt><dd>${K.fmtStat(k, c.stats[k][0])}</dd><span class="muted small">${c.stats[k][1]}</span></div>`)}</dl><p class="muted small">${t('m_source')}</p>`;
  }

  /** Filter chips built from what the stories are actually about: military, deals, elections and so on. */
  function topicChips(stories) {
    const counts = {};
    stories.forEach((s) => s.topics.forEach((tp) => (counts[tp] = (counts[tp] || 0) + 1)));
    const ids = K.TOPIC_IDS.filter((id) => counts[id]);
    if (ids.length < 2) return '';
    return h`<div class="pills topic-chips" role="group">
      <button class="pill ${topicFilter ? '' : 'on'}" data-act="mapTopic" data-topic="" aria-pressed="${String(!topicFilter)}">${t('m_all')} <span class="muted">${stories.length}</span></button>
      ${ids.sort((a, b) => counts[b] - counts[a]).map((id) => h`<button class="pill ${topicFilter === id ? 'on' : ''}" data-act="mapTopic" data-topic="${id}" aria-pressed="${String(topicFilter === id)}">${t('t_' + id)} <span class="muted">${counts[id]}</span></button>`)}
    </div>`;
  }
  const applyTopic = (stories) => (topicFilter ? stories.filter((s) => s.topics.indexOf(topicFilter) !== -1) : stories);
  const storyList = (stories, emptyKey) => (stories.length
    ? h`<div class="stack tight">${stories.slice(0, 25).map((s) => K.card(s, { cls: 'compact', showLang: true }))}</div>`
    : h`<p class="muted">${t(emptyKey)}</p>`);

  function renderPanel() {
    const el = document.getElementById('mapPanel');
    if (!el) return;
    el.parentElement.classList.toggle('has-sel', selected.length > 0);
    if (!selected.length) {
      el.innerHTML = String(h`<p class="muted">${t('m_pick')}</p>
        <h3 class="mini-title">${t('mostCovered')}</h3>
        <div class="stack tight">${K.politicalStories().filter((s) => s.sourceCount > 1).slice(0, 6).map((s) => K.card(s, { cls: 'compact' }))}</div>`);
      return;
    }
    const chips = h`<div class="sel-chips">${selected.map((i) => h`<button class="pill on" data-act="mapPick" data-iso="${i}" aria-label="${K.countryName(i)}: ${t('so_remove')}">${K.countryName(i)} ${icon('x')}</button>`)}${selected.length > 1 ? h`<button class="link-btn" data-act="mapClear">${t('m_clear')}</button>` : ''}</div>`;
    el.innerHTML = String(selected.length === 1 ? single(selected[0], chips) : several(chips));
  }

  function aggregateCounts(stories) {
    const c = [0, 0, 0, 0, 0];
    stories.forEach((s) => s.counts.forEach((n, i) => (c[i] += n)));
    return c;
  }

  function single(iso, chips) {
    const c = K.countryByIso[iso];
    const stories = K.countryStories([iso]);
    const following = K.state.followed.indexOf(iso) !== -1;
    return h`
      ${chips}
      <div class="panel-head">
        <h2>${K.countryName(iso)}</h2>
        <button class="btn btn-small ${following ? 'btn-on' : ''}" data-act="follow" data-iso="${iso}" aria-pressed="${String(following)}">${following ? t('m_following') : t('m_follow')}</button>
      </div>
      <p class="facts">
        ${c.capital ? h`<span><span class="muted">${t('m_capital')}:</span> ${c.capital}</span>` : ''}
        ${c.region ? h`<span><span class="muted">${t('m_region')}:</span> ${c.region}</span>` : ''}
        ${c.income ? h`<span><span class="muted">${t('m_income')}:</span> ${c.income}</span>` : ''}
      </p>
      <h3 class="mini-title">${t('m_news')}</h3>
      ${stories.length ? h`<p class="muted small">${t('m_translated')}</p>${K.biasBar(aggregateCounts(stories), { large: true })}${K.biasLegendCompact()}` : ''}
      ${topicChips(stories)}
      ${storyList(applyTopic(stories), 'm_noStories')}
      <h3 class="mini-title">${t('m_data')}</h3>
      ${statBlock(c)}
      <a class="btn btn-small" href="#/search/${encodeURIComponent(K.countryName(iso, 'en'))}">${t('m_webSearch')}</a>`;
  }

  function several(chips) {
    const names = selected.map((i) => K.countryName(i)).join(' + ');
    const all = K.relatedStories(selected);
    const list = selected.map((i) => K.countryByIso[i]);
    const rows = STAT_KEYS.filter((k) => list.some((c) => c.stats && c.stats[k]));
    return h`
      ${chips}
      <h2 class="panel-title">${t('m_related', { x: names })}</h2>
      ${all.length ? h`<p class="muted small">${t('m_relatedCount', { n: all.length })} · ${t('m_translated')}</p>` : ''}
      ${topicChips(all)}
      ${storyList(applyTopic(all), 'm_noStoriesBetween')}
      <a class="btn btn-small" href="#/search/${encodeURIComponent(selected.map((i) => K.countryName(i, 'en')).join(' '))}">${t('m_webSearch')}</a>
      <h3 class="mini-title">${t('m_compare')}</h3>
      <div class="table-scroll"><table class="data-table compare">
        <thead><tr><th></th>${list.map((c) => h`<th class="num">${K.countryName(c.iso2)}</th>`)}</tr></thead>
        <tbody>${rows.map((k) => h`<tr><th scope="row">${t('stat_' + k)}</th>${list.map((c) => h`<td class="num">${c.stats && c.stats[k] ? K.fmtStat(k, c.stats[k][0]) : '–'}</td>`)}</tr>`)}</tbody>
      </table></div>
      <p class="muted small">${t('m_source')}</p>`;
  }

  K.biasLegendCompact = () => h`<div class="legend compact">${[0, 1, 2, 3, 4].map((i) => h`<span class="legend-item"><i class="dot lean${i}"></i>${t('l' + i)}</span>`)}</div>`;
  K.views.mapLeave = function () { mapState = null; };
})();
