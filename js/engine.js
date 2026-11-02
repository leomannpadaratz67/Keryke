/* News engine: turns raw articles into tagged, clustered, ranked stories. No DOM here. */
(function () {
  const K = (window.K = window.K || {});

  const norm = (K.norm = (s) =>
    String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[‘’]/g, "'"));

  /* ---------- Topics ---------- */
  K.TOPICS = {
    elections: /\b(election|vote[sr]?\b|voting|ballot|midterm|primar(y|ies)\b|campaign|polls?\b|polling|candidate|eleic|eleitor|candidat|urnas?\b|votacion|votos?\b|scrutin|sondage|electoral)/,
    government: /\b(government|parliament|congress|senate|senator|president|prime minister|minister|lawmaker|legislat|cabinet|white house|republicans?\b|democrats?\b|governo|deputad|camara|senado|ministr|gobierno|diputad|gouvernement|assemblee|depute|senat|partido|parti\b)/,
    economy: /\b(inflation|econom|central bank|federal reserve|interest rate|gdp|recession|budget|tax(es)?\b|debt|deficit|unemployment|wages?\b|minimum wage|jobs report|juros|imposto|orcamento|inflacao|impuesto|presupuesto|inflacion|impots?\b|pension|stock market)/,
    trade: /\b(tariff|trade (war|deal|talks|deficit)|exports?\b|imports?\b|sanction|supply chain|arancel|tarifa|sancoes|sanciones|droits de douane)/,
    security: /\b(war\b|wars\b|military|troops|missile|drones?\b|airstrike|air strike|strikes? on|ceasefire|invasion|army|navy|nuclear|hamas|hezbollah|nato|otan|guerra|ataque|ejercito|exercito|guerre|armee|frappes?\b|pentagon|defen[cs]e minister|terror)/,
    diplomacy: /\b(diplomat|summit|treaty|united nations|\bun\b|embassy|foreign minister|peace (deal|talks|plan)|g7|g20|brics|cupula|cumbre|sommet|onu\b|chancellor|envoy|ambassador)/,
    rights: /\b(supreme court|court rul|judge|justices?\b|constitution|civil rights|human rights|abortion|protest|free speech|censorship|lgbt|transgender|police|stf\b|tribunal|justica|justicia|protesto|protesta|manifestation|droits|voting rights)/,
    migration: /\b(immigra|migrant|refugee|asylum|border|deport|imigra|fronteira|inmigra|frontera|refugiad|refugie)/,
    climate: /\b(climate|emissions?\b|renewable|wildfire|cop\d\d|fossil fuel|oil price|energy (policy|crisis|prices)|clima\b|climatic|energia|petroleo|petrole|energie|flood)/,
    tech: /\b(artificial intelligence|\bai\b|big tech|antitrust|cyber|data privacy|social media ban|semiconductor|hack(ed|ers?)?\b|inteligencia artificial|ciberataque|tiktok)/,
    health: /\b(healthcare|health care|medicaid|medicare|vaccine|public health|pandemic|obamacare|saude|salud|sante|vacina|vacuna|hospitals?\b)/,
  };
  K.TOPIC_IDS = Object.keys(K.TOPICS);

  /* ---------- Countries ---------- */
  const EXTRA_COUNTRIES = [
    { iso2: 'TW', iso3: 'TWN', num: '158', name: 'Taiwan', capital: 'Taipei', region: 'East Asia & Pacific', stats: {} },
    { iso2: 'EH', iso3: 'ESH', num: '732', name: 'Western Sahara', capital: '', region: 'Middle East & North Africa', stats: {} },
    { iso2: 'VA', iso3: 'VAT', num: '336', name: 'Vatican City', capital: 'Vatican City', region: 'Europe & Central Asia', stats: {} },
    { iso2: 'FK', iso3: 'FLK', num: '238', name: 'Falkland Islands', capital: 'Stanley', region: 'Latin America & Caribbean', stats: {} },
  ];
  K.countries = (window.KERYKE_WORLD.countries || []).concat(EXTRA_COUNTRIES);
  // The World Bank still uses the older Russian-derived spelling.
  K.countries.forEach((c) => { if (c.iso2 === 'UA') c.capital = 'Kyiv'; });
  K.countryByIso = {};
  K.countryByNum = {};
  K.countries.forEach((c) => {
    K.countryByIso[c.iso2] = c;
    if (c.num) K.countryByNum[c.num] = c;
  });

  const names = {};
  function displayNames(lang) {
    if (names[lang] !== undefined) return names[lang];
    try {
      names[lang] = {
        long: new Intl.DisplayNames([lang], { type: 'region' }),
        short: new Intl.DisplayNames([lang], { type: 'region', style: 'short' }),
      };
    } catch (e) {
      names[lang] = null;
    }
    return names[lang];
  }
  const SHORT_NAME = new Set(['HK', 'MO']);
  // Browser name data differs on this one, so it is fixed here rather than left to chance.
  const FIXED_NAMES = { PS: { en: 'Palestine', pt: 'Palestina', es: 'Palestina', fr: 'Palestine' } };
  K.countryName = function (iso, lang) {
    const c = K.countryByIso[iso];
    if (FIXED_NAMES[iso]) return FIXED_NAMES[iso][lang || K.lang || 'en'] || FIXED_NAMES[iso].en;
    const dn = displayNames(lang || K.lang || 'en');
    if (dn && iso && /^[A-Z]{2}$/.test(iso)) {
      try {
        const n = (SHORT_NAME.has(iso) ? dn.short : dn.long).of(iso);
        if (n && n !== iso) return n;
      } catch (e) {}
    }
    return c ? c.name : iso;
  };

  // Single words that are also common names or US states get matched through ALIASES only.
  const AMBIGUOUS = new Set(['georgia', 'chad', 'jordan', 'maurice', 'guinee', 'man', 'sint maarten']);
  const ALIASES = {
    US: ['united states','american','americans','white house','pentagon','capitol hill','congress','u.s','trump','vance','biden','rubio','hegseth','gop','midterms','new mexico','new jersey','florida','miami','texas','california','new york','washington d.c','eua','ee.uu','ee uu','etats-unis','estadounidense','americano','americana','norte-americano','norte-americana','estados unidos'],
    GB: ['britain','british','downing street','westminster','starmer','england','scotland','wales','reino unido','royaume-uni'],
    RU: ['russian','russians','moscow','kremlin','putin','russo','russa','russos','ruso','rusa','rusos','russe','russes','moscou','moscu'],
    UA: ['ukrainian','ukrainians','kyiv','kiev','zelensky','zelenskyy','zelenskiy','ucraniano','ukrainien'],
    CN: ['chinese','beijing','xi jinping','chines','chinesa','chino','china\'s','chinois','pequim','pekin'],
    IL: ['israeli','israelis','netanyahu','idf','jerusalem','tel aviv','israelense','israeli','israelien','israelienne'],
    PS: ['palestinian','palestinians','gaza','hamas','west bank','ramallah','palestino','palestinien'],
    IR: ['iranian','iranians','tehran','khamenei','irgc','iraniano','irani','iranien','teera','teheran'],
    IN: ['indian','new delhi','modi','indien'],
    BR: ['brazilian','bolsonaro','lula','brasilia','brasileiro','brasileira','brasileiros','brasileno','bresilien','stf','planalto'],
    FR: ['french','macron','elysee','francesa','francais'],
    DE: ['german','germans','berlin','merz','alemao','alema','aleman','allemand'],
    IT: ['italian','meloni','italiano','italien'],
    ES: ['spanish','madrid','espanhol','espanol','espagnol'],
    JP: ['japanese','tokyo','japones','japonais','toquio'],
    KR: ['south korean','seoul'],
    KP: ['north korean','pyongyang','kim jong un'],
    TW: ['taiwanese','taipei'],
    EH: ['sahrawi','polisario'],
    VA: ['vatican','pope leo','holy see'],
    MX: ['mexican','mexico city','sheinbaum','mexicano'],
    AR: ['argentine','argentinian','milei','buenos aires','argentino','argentina'],
    VE: ['venezuelan','caracas','maduro','venezolano','venezuelano'],
    CO: ['colombian','bogota','petro','colombiano'],
    CU: ['cuban','havana','havana','cubano','la habana'],
    TR: ['turkish','erdogan','ankara','turco','turkiye','turquia'],
    SA: ['saudi','riyadh','saudita'],
    SY: ['syrian','damascus','siria','syrien','sirio'],
    LB: ['lebanese','beirut','hezbollah','hizballah','libanes'],
    IQ: ['iraqi','baghdad','iraquiano'],
    AF: ['afghan','afghans','kabul','taliban','afegao','afgano'],
    PK: ['pakistani','islamabad'],
    EG: ['egyptian','cairo','egipcio'],
    YE: ['yemeni','houthi','houthis','sanaa'],
    QA: ['qatari','doha'],
    PL: ['polish','warsaw','polones'],
    HU: ['hungarian','budapest','orban','hungaro'],
    NG: ['nigerian','abuja'], ZA: ['south african','pretoria'], KE: ['kenyan','nairobi'], SD: ['sudanese','khartoum'], ET: ['ethiopian','addis ababa'],
    AU: ['australian','canberra'], CA: ['canadian','ottawa','carney','canadense','canadiense','canadien'],
    GE: ['georgian','tbilisi'], JO: ['jordanian','amman'], TD: ['chadian','ndjamena'], RS: ['serbian','belgrade'],
    PH: ['philippine','filipino','manila'], ID: ['indonesian','jakarta'], VN: ['vietnamese','hanoi'], TH: ['thai','bangkok'], MM: ['burmese','myanmar'],
    CL: ['chilean','chileno','santiago de chile'], PE: ['peruvian','peruano'], BO: ['bolivian','boliviano'], EC: ['ecuadorian','quito'],
    PT: ['portuguese','lisbon','lisboa','portugues'],
  };

  const gazetteer = new Map();
  (function buildGazetteer() {
    K.countries.forEach((c) => {
      ['en', 'pt', 'es', 'fr'].forEach((l) => {
        const dn = displayNames(l);
        let n = '';
        try { n = dn ? dn.long.of(c.iso2) : ''; } catch (e) {}
        [n, l === 'en' ? c.name : ''].forEach((raw) => {
          const k = norm(raw).replace(/,.*$/, '').trim();
          if (k.length > 2 && !AMBIGUOUS.has(k)) gazetteer.set(k, c.iso2);
        });
      });
    });
    Object.keys(ALIASES).forEach((iso) => ALIASES[iso].forEach((a) => gazetteer.set(norm(a), iso)));
    // Longer phrases that must not count as a country; matching them consumes the text.
    ['latin american', 'south american', 'north american', 'central american', 'native american', 'african american'].forEach((k) => gazetteer.set(k, null));
  })();
  const gazRe = new RegExp(
    "(?<![a-z'])(" + Array.from(gazetteer.keys()).sort((a, b) => b.length - a.length)
      .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ")(?![a-z])", 'g');

  K.findCountries = function (text, original) {
    const out = [];
    const seen = new Set();
    const n = norm(text);
    let m;
    gazRe.lastIndex = 0;
    while ((m = gazRe.exec(n))) {
      const iso = gazetteer.get(m[1]);
      if (iso && !seen.has(iso)) { seen.add(iso); out.push(iso); }
    }
    // Acronyms depend on case ("US" vs "us"), so they are matched on the original text.
    if (original) {
      if (/\b(US|USA)\b/.test(original) && !seen.has('US')) out.push('US');
      if (/\bUK\b/.test(original) && !seen.has('GB')) out.push('GB');
    }
    return out;
  };

  /* ---------- Text tokens ---------- */
  const STOP = new Set(('a an and are as at be been but by for from has have he her his how i if in into is it its more most new no not of on or our out over say says said she should so than that the their them they this to up was we were what when where which who why will with would you your after about after amid against before could can do does did may might just now one two get gets got make made still very all also back off under down first last week year years day today people'
    + ' o os as um uma uns umas de do da dos das em no na nos nas por para com sem que e ou mas se ao aos sobre como mais apos ate foi sao ser diz dizem entre seu sua seus suas ele ela eles elas ja nao pela pelo pelas pelos ha tem'
    + ' el la los las un una unos unas del al en y con sin por para que es son se su sus lo como mas tras ante sobre entre pero fue ser dice esta este estos estas ya no'
    + ' le les un une des du de la et ou en au aux pour par sur dans avec sans que qui est sont ce cette ces son sa ses il elle ils elles ne pas plus apres selon entre mais a').split(' '));

  const tokenize = (K.tokenize = (s) => {
    const seen = new Set();
    norm(s).replace(/'s\b/g, '').split(/[^a-z0-9]+/).forEach((w) => {
      if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) return;
      if (w.length > 3 && /s$/.test(w) && !/(ss|us|is)$/.test(w)) w = w.slice(0, -1);
      seen.add(w);
    });
    return Array.from(seen);
  });

  /* ---------- Build ---------- */
  const data = window.KERYKE_NEWS;
  K.generated = data.generated * 1000;
  K.sources = {};
  K.hostToSource = {};
  data.sources.forEach((s) => (K.sources[s.id] = s));

  const hostOf = (K.hostOf = (u) => {
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  });

  K.articles = data.articles.map((r) => {
    const src = K.sources[r.s];
    if (!src) return null;
    const h = hostOf(r.u);
    if (h) K.hostToSource[h] = src;
    const titleNorm = norm(r.t);
    const descNorm = norm(r.x || '');
    const topics = K.TOPIC_IDS.filter((id) => K.TOPICS[id].test(titleNorm) || K.TOPICS[id].test(descNorm));
    const inTitle = K.findCountries(r.t, r.t);
    const inExcerpt = r.x ? K.findCountries(r.x, r.x) : [];
    let countries = inTitle;
    if (!countries.length) countries = inExcerpt.slice(0, 2);
    if (!countries.length && topics.length) countries = [src.country];
    return {
      src, title: r.t, url: r.u, date: r.d * 1000, excerpt: r.x || '', image: r.i || '',
      lang: src.lang, topics, countries, inTitle, mentions: Array.from(new Set(inTitle.concat(inExcerpt))),
      tokens: tokenize(r.t), search: titleNorm + ' ' + descNorm,
    };
  }).filter(Boolean);

  function hash(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  const RECENCY_HOURS = 36;
  const SIMILARITY = 0.36;
  const MERGE_SIMILARITY = 0.42;

  function clusterLanguage(arts) {
    const df = new Map();
    arts.forEach((a) => a.tokens.forEach((t) => df.set(t, (df.get(t) || 0) + 1)));
    const N = arts.length || 1;
    const idf = (t) => Math.log(1 + N / (df.get(t) || 1));
    // A story is identified by its distinctive words ("Alaska"), not ones in every headline ("Trump").
    const rareLimit = Math.max(6, N * 0.012);
    const isRare = (t) => (df.get(t) || 0) <= rareLimit;

    const clusters = [];
    const index = new Map();
    arts.slice().sort((a, b) => b.date - a.date).forEach((a) => {
      const total = a.tokens.reduce((s, t) => s + idf(t), 0) || 1;
      const cands = new Set();
      a.tokens.forEach((t) => (index.get(t) || []).forEach((c) => cands.add(c)));

      let best = null;
      let bestScore = 0;
      cands.forEach((c) => {
        if (Math.abs(c.seedDate - a.date) > 60 * 3600e3) return;
        let shared = 0, rare = 0, w = 0;
        a.tokens.forEach((t) => {
          // Only the seed headline and terms repeated by members define a story, which stops clusters drifting.
          if (c.seed.has(t) || (c.tf.get(t) || 0) >= 2) { shared++; w += idf(t); if (isRare(t)) rare++; }
        });
        if (shared < 3 || rare < 2) return;
        const score = w / total;
        if (score >= SIMILARITY && score > bestScore) { best = c; bestScore = score; }
      });

      if (!best) {
        best = { seed: new Set(a.tokens), seedDate: a.date, tf: new Map(), arts: [], id: hash(a.url) };
        clusters.push(best);
      }
      best.arts.push(a);
      a.tokens.forEach((t) => {
        best.tf.set(t, (best.tf.get(t) || 0) + 1);
        const list = index.get(t);
        if (!list) index.set(t, [best]);
        else if (!list.includes(best)) list.push(best);
      });
    });
    return mergeClusters(clusters, idf, isRare);
  }

  /** Second pass: two clusters can describe one event when their first headlines were worded differently. */
  function mergeClusters(clusters, idf, isRare) {
    const core = (c) => {
      const need = c.arts.length >= 4 ? 2 : 1;
      return Array.from(c.tf.keys()).filter((t) => c.tf.get(t) >= need);
    };
    const ordered = clusters.slice().sort((a, b) => b.arts.length - a.arts.length);
    const index = new Map();
    const kept = [];
    ordered.forEach((c) => {
      const tokens = core(c);
      const total = tokens.reduce((s, t) => s + idf(t), 0) || 1;
      const cands = new Set();
      tokens.forEach((t) => { if (isRare(t)) (index.get(t) || []).forEach((k) => cands.add(k)); });
      let best = null, bestScore = 0;
      cands.forEach((k) => {
        if (Math.abs(k.seedDate - c.seedDate) > 60 * 3600e3) return;
        let shared = 0, rare = 0, w = 0;
        tokens.forEach((t) => { if (k.coreSet.has(t)) { shared++; w += idf(t); if (isRare(t)) rare++; } });
        if (shared < 3 || rare < 3) return;
        const score = w / total;
        if (score >= MERGE_SIMILARITY && score > bestScore) { best = k; bestScore = score; }
      });
      if (best) {
        best.arts = best.arts.concat(c.arts);
        return;
      }
      c.coreSet = new Set(tokens);
      tokens.forEach((t) => { if (!index.has(t)) index.set(t, []); index.get(t).push(c); });
      kept.push(c);
    });
    return kept;
  }

  function finishCluster(c) {
    const articles = c.arts;
    const bySource = new Map();
    articles.forEach((a) => { if (!bySource.has(a.src.id)) bySource.set(a.src.id, a); });
    const unique = Array.from(bySource.values());

    const counts = [0, 0, 0, 0, 0];
    let offSpectrum = 0;
    unique.forEach((a) => {
      if (a.src.lean === null || a.src.lean === undefined) offSpectrum++;
      else counts[a.src.lean + 2]++;
    });
    const left = counts[0] + counts[1], right = counts[3] + counts[4], center = counts[2];
    const rated = left + right + center;

    // Headline from the source nearest the centre: least likely to carry partisan framing.
    const lead = unique.slice().sort((a, b) => {
      const la = a.src.lean === null ? 3 : Math.abs(a.src.lean);
      const lb = b.src.lean === null ? 3 : Math.abs(b.src.lean);
      return la - lb || b.date - a.date;
    })[0];

    const topicCount = {}, countryCount = {};
    articles.forEach((a) => {
      a.topics.forEach((t) => (topicCount[t] = (topicCount[t] || 0) + 1));
      a.countries.forEach((t) => (countryCount[t] = (countryCount[t] || 0) + 1));
    });
    const rank = (o) => Object.keys(o).sort((x, y) => o[y] - o[x]);
    const countries = rank(countryCount).filter((k, i) => i === 0 || countryCount[k] >= Math.max(1, articles.length * 0.25)).slice(0, 5);

    let blindspot = null;
    if (left + right >= 3) {
      if (right / (left + right) <= 0.15) blindspot = 'right';
      else if (left / (left + right) <= 0.15) blindspot = 'left';
    }

    const newest = Math.max.apply(null, articles.map((a) => a.date));
    const ageH = Math.max(0, (K.generated - newest) / 3600e3);
    const sides = (left ? 1 : 0) + (center ? 1 : 0) + (right ? 1 : 0);
    const topics = rank(topicCount);
    const score = (Math.pow(unique.length, 1.25) + sides * 1.5) * Math.exp(-ageH / RECENCY_HOURS) * (topics.length ? 1 : 0.2);

    const withImage = [lead].concat(unique).find((a) => a.image);
    return {
      id: c.id, title: lead.title, excerpt: lead.excerpt || (unique.find((a) => a.excerpt) || {}).excerpt || '',
      image: withImage ? withImage.image : '', lang: lead.lang, articles: unique, counts, offSpectrum, rated, left, right, center,
      sourceCount: unique.length, topics, countries, blindspot, date: newest, score,
      search: unique.map((a) => a.search).join(' '),
    };
  }

  K.stories = [];
  K.storyById = {};
  K.allStories = null;
  /** Editorial pages follow the chosen news editions; the map always sees every language. */
  K.buildStories = function (langs) {
    if (!K.allStories) {
      const grouped = {};
      K.articles.forEach((a) => { (grouped[a.lang] = grouped[a.lang] || []).push(a); });
      let all = [];
      Object.keys(grouped).forEach((l) => { all = all.concat(clusterLanguage(grouped[l])); });
      K.allStories = all.map(finishCluster).sort((a, b) => b.score - a.score);
      K.storyById = {};
      K.urlToStory = {};
      K.coverage = {};
      K.securityCount = {};
      K.allStories.forEach((s) => {
        K.storyById[s.id] = s;
        s.articles.forEach((a) => { K.urlToStory[a.url] = s; });
        if (!s.topics.length) return;
        s.countries.forEach((c) => {
          K.coverage[c] = (K.coverage[c] || 0) + 1;
          if (s.topics.indexOf('security') !== -1) K.securityCount[c] = (K.securityCount[c] || 0) + 1;
        });
      });
    }
    K.stories = K.allStories.filter((s) => langs.indexOf(s.lang) !== -1);
    return K.stories;
  };

  /** Stories with political weight: the only ones eligible for editorial pages. */
  K.politicalStories = () => K.stories.filter((s) => s.topics.length);

  K.countryStories = (isos) => (K.allStories || []).filter((s) => s.topics.length && isos.every((i) => s.countries.indexOf(i) !== -1));

  /**
   * Stories connecting several countries. A single article has to mention all of them, so two
   * unrelated reports grouped together can't create a false link. Headline mentions rank highest.
   */
  K.relatedStories = function (isos) {
    const strength = (s) => {
      let best = 0;
      s.articles.forEach((a) => {
        if (!isos.every((i) => a.mentions.indexOf(i) !== -1)) return;
        const inHeadline = isos.filter((i) => a.inTitle.indexOf(i) !== -1).length;
        best = Math.max(best, 1 + inHeadline);
      });
      return best;
    };
    return (K.allStories || []).filter((s) => s.topics.length)
      .map((s) => ({ s, rank: strength(s) }))
      .filter((x) => x.rank > 0)
      .sort((a, b) => b.rank - a.rank || b.s.score - a.s.score)
      .map((x) => x.s);
  };

  /** Search the local index. Every word must match, unless nothing matches that way. */
  K.searchStories = function (q) {
    const terms = tokenize(q);
    const raw = norm(q).trim();
    if (!raw) return [];
    const words = terms.length ? terms : [raw];
    const countryHits = K.findCountries(q, q);
    const scoreOf = (s, need) => {
      const matched = words.filter((w) => s.search.indexOf(w) !== -1).length;
      if (matched < need) return 0;
      const titles = norm(s.articles.map((a) => a.title).join(' '));
      return matched + words.filter((w) => titles.indexOf(w) !== -1).length * 2
        + countryHits.filter((c) => s.countries.indexOf(c) !== -1).length * 0.5;
    };
    let hits = K.stories.map((s) => [s, scoreOf(s, words.length)]).filter((x) => x[1]);
    if (!hits.length && words.length > 1) hits = K.stories.map((s) => [s, scoreOf(s, 1)]).filter((x) => x[1]);
    return hits.sort((a, b) => b[1] * (2 + b[0].score) - a[1] * (2 + a[0].score)).map((x) => x[0]);
  };

  /* ---------- GDELT live web search (best effort; strict public rate limit) ---------- */
  let lastGdelt = 0;
  K.searchWeb = async function (q) {
    const wait = lastGdelt + 5500 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastGdelt = Date.now();
    const url = 'https://api.gdeltproject.org/api/v2/doc/doc?format=json&mode=artlist&maxrecords=25&sort=hybridrel&timespan=7d&query=' +
      encodeURIComponent(q.replace(/[^\p{L}\p{N}\s"-]/gu, ' ').trim());
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const text = await res.text();
    const json = JSON.parse(text); // GDELT answers errors in plain text, which lands in the catch.
    const seen = new Set();
    return (json.articles || []).map((a) => ({
      title: a.title, url: a.url, domain: a.domain, source: K.hostToSource[String(a.domain || '').replace(/^www\./, '')] || null,
    })).filter((a) => {
      const key = norm(a.title);
      if (!a.title || seen.has(key) || !/^https?:\/\//.test(a.url)) return false;
      seen.add(key);
      return true;
    });
  };

  /* ---------- Indicators ---------- */
  K.STATS = {
    pop: { fmt: 'compact', re: /population|populacao|poblacion|habitants/ },
    gdp: { fmt: 'usd', re: /\bgdp\b(?!.*(capita|growth))|\bpib\b(?!.*(capita|crescimento|crecimiento))/ },
    gdppc: { fmt: 'usd', re: /per capita/ },
    growth: { fmt: 'pct', re: /growth|crescimento|crecimiento|croissance/ },
    inflation: { fmt: 'pct', re: /inflat|inflac/ },
    unemployment: { fmt: 'pct', re: /unemploy|desemprego|desempleo|chomage/ },
    military: { fmt: 'pct', re: /milit|defen[cs]e/ },
    life: { fmt: 'years', re: /life expectancy|expectativa de vida|esperanza de vida|esperance de vie/ },
  };
  K.statKeyFor = function (q) {
    const n = norm(q);
    return Object.keys(K.STATS).find((k) => K.STATS[k].re.test(n)) || null;
  };
  K.statRanking = function (key, top) {
    const withData = K.countries.filter((c) => c.stats && c.stats[key]);
    // A country whose last figure is years old must not outrank current data.
    const newest = Math.max.apply(null, withData.map((c) => c.stats[key][1]));
    return withData.filter((c) => c.stats[key][1] >= newest - 2).sort((a, b) => b.stats[key][0] - a.stats[key][0]).slice(0, top || 8);
  };
})();
