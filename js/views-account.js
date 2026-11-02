/* Social, Settings and first-run views. */
(function () {
  const K = (window.K = window.K || {});
  const h = K.h, t = (k, v) => K.t(k, v);
  K.views = K.views || {};

  /* ---------- Settings ---------- */
  K.views.settings = function (root) {
    const st = K.state;
    const collected = K.articles.length;
    const outlets = Object.values(K.sources).filter((s) => s.n > 0).length;
    root.innerHTML = String(h`<div class="page settings">
      <header class="page-head"><h1>${t('se_title')}</h1></header>

      <section class="panel"><h2 class="mini-title">${t('se_language')}</h2>
        <label class="field"><span>${t('se_appLang')}</span><select data-set="lang">${Object.keys(K.LANGS).map((l) => h`<option value="${l}" ${K.raw(l === st.lang ? 'selected' : '')}>${K.LANGS[l]}</option>`)}</select></label>
        <fieldset class="field"><legend>${t('se_newsLangs')}</legend>
          <div class="checks">${Object.keys(K.LANGS).map((l) => h`<label class="check"><input type="checkbox" data-newslang="${l}" ${K.raw(st.newsLangs.indexOf(l) !== -1 ? 'checked' : '')}><span>${K.LANGS[l]}</span></label>`)}</div>
          <p class="muted small">${t('se_newsLangsHint')}</p>
        </fieldset>
      </section>

      <section class="panel"><h2 class="mini-title">${t('se_account')}</h2>
        <p class="muted small">${t('se_accountNote')}</p>
        <label class="field"><span>${t('se_name')}</span><input data-set="name" value="${st.name}" maxlength="24" autocomplete="off"></label>
        ${K.social.mode === 'remote' ? h`<a class="btn account-link" href="#/social/you">${K.social.signedIn() ? t('c_you') : t('c_signIn')}</a>` : ''}
      </section>

      <section class="panel"><h2 class="mini-title">${t('se_interests')}</h2>
        <div class="pills">${K.TOPIC_IDS.map((id) => { const on = (st.topics[id] || 0) > 0; return h`<button class="pill ${on ? 'on' : ''}" data-act="toggleTopic" data-topic="${id}" aria-pressed="${String(on)}">${t('t_' + id)}</button>`; })}</div>
      </section>

      <section class="panel"><h2 class="mini-title">${t('se_appearance')}</h2>
        <div class="segmented" role="radiogroup" aria-label="${t('se_theme')}">
          ${['system', 'light', 'dark'].map((m) => h`<button role="radio" aria-checked="${String(st.theme === m)}" data-act="theme" data-theme-val="${m}">${t('se_' + m)}</button>`)}
        </div>
      </section>

      <section class="panel"><h2 class="mini-title">${t('se_about')}</h2>
        <p class="muted small">${t('se_collection', { a: collected, b: outlets, time: K.ago(K.generated) })}</p>
        <a class="btn" href="#/about">${t('howRated')}</a>
      </section>

      <section class="panel"><h2 class="mini-title">${t('se_data')}</h2>
        <div class="row-actions">
          <button class="btn" data-act="exportData">${t('se_export')}</button>
          <label class="btn file-btn">${t('se_import')}<input type="file" id="importFile" accept="application/json,.json"></label>
          <button class="btn btn-danger-ghost" data-act="resetData">${t('se_reset')}</button>
        </div>
      </section>
    </div>`);

    root.querySelectorAll('[data-set]').forEach((el) => {
      el.addEventListener('change', () => {
        const key = el.dataset.set;
        K.state[key] = key === 'name' ? el.value.trim().slice(0, 24) : el.value;
        K.save();
        if (key === 'lang') K.applyLanguage();
      });
    });
    root.querySelectorAll('[data-newslang]').forEach((el) => {
      el.addEventListener('change', () => {
        const picked = Array.from(root.querySelectorAll('[data-newslang]')).filter((x) => x.checked).map((x) => x.dataset.newslang);
        if (!picked.length) { el.checked = true; K.toast(t('se_newsLangsHint')); return; }
        K.state.newsLangs = picked;
        K.save();
        K.buildStories(picked);
      });
    });
    root.querySelector('#importFile').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const o = JSON.parse(await file.text());
        if (!K.validBackup(o)) throw new Error('invalid');
        K.loadState(JSON.stringify(o));
        K.save();
        K.applyTheme();
        K.applyLanguage();
        K.buildStories(K.state.newsLangs);
        K.toast(t('se_importOk'));
        K.rerender();
      } catch (err) {
        K.toast(t('se_importBad'));
      }
    });
  };

  /** Backups may be hand-edited or come from elsewhere: check every field the app relies on. */
  K.validBackup = function (o) {
    return !!o && typeof o === 'object'
      && K.LANGS[o.lang] && typeof o.name === 'string'
      && Array.isArray(o.newsLangs) && o.newsLangs.length > 0 && o.newsLangs.every((l) => K.LANGS[l])
      && Number.isFinite(o.xp) && o.xp >= 0 && o.lessons && typeof o.lessons === 'object' && o.topics && typeof o.topics === 'object'
      && Array.isArray(o.reads) && o.reads.length === 5 && o.reads.every(Number.isFinite)
      && Array.isArray(o.saved) && Array.isArray(o.recent) && Array.isArray(o.followed)
      && o.streak && typeof o.streak === 'object' && o.daily && typeof o.daily === 'object' && o.readStories && typeof o.readStories === 'object';
  };

  /* ---------- First run ---------- */
  K.showOnboarding = function () {
    const d = document.createElement('dialog');
    d.className = 'dialog onboarding';
    const render = () => {
      d.innerHTML = String(h`<form method="dialog">
        <div class="ob-mark">${K.logo()}</div>
        <h2>${t('ob_welcome')}</h2><p class="muted">${t('ob_intro')}</p>
        <label class="field"><span>${t('se_appLang')}</span><select id="obLang">${Object.keys(K.LANGS).map((l) => h`<option value="${l}" ${K.raw(l === K.state.lang ? 'selected' : '')}>${K.LANGS[l]}</option>`)}</select></label>
        <label class="field"><span>${t('ob_name')}</span><input id="obName" maxlength="24" autocomplete="off" value="${K.state.name}"></label>
        <fieldset class="field"><legend>${t('ob_topics')}</legend><div class="pills">${K.TOPIC_IDS.map((id) => { const on = (K.state.topics[id] || 0) > 0; return h`<button type="button" class="pill ${on ? 'on' : ''}" data-ob-topic="${id}" aria-pressed="${String(on)}">${t('t_' + id)}</button>`; })}</div></fieldset>
        <div class="dialog-actions"><button class="btn" type="button" data-ob-skip>${t('ob_skip')}</button><button class="btn btn-primary" value="go">${t('ob_go')}</button></div>
      </form>`);
      d.querySelector('[data-ob-skip]').addEventListener('click', () => d.close('skip'));
      d.querySelector('#obLang').addEventListener('change', (e) => {
        K.state.lang = e.target.value;
        K.state.name = d.querySelector('#obName').value;
        K.state.newsLangs = e.target.value === 'en' ? ['en'] : ['en', e.target.value];
        K.lang = e.target.value;
        K.renderShell();
        render();
      });
      d.querySelectorAll('[data-ob-topic]').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.obTopic;
        K.state.topics[id] = (K.state.topics[id] || 0) > 0 ? 0 : 1;
        b.classList.toggle('on');
        b.setAttribute('aria-pressed', String(K.state.topics[id] > 0));
      }));
    };
    render();
    document.body.appendChild(d);
    d.addEventListener('cancel', (e) => e.preventDefault());
    d.addEventListener('close', () => {
      if (d.returnValue === 'go') {
        K.state.name = d.querySelector('#obName').value.trim().slice(0, 24);
      }
      K.state.onboarded = true;
      K.save();
      d.remove();
      K.buildStories(K.state.newsLangs);
      K.rerender();
    });
    d.showModal();
  };
})();
