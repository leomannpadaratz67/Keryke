/* Learn tab: Duolingo-style path and lesson player. */
(function () {
  const K = (window.K = window.K || {});
  const h = K.h, t = (k, v) => K.t(k, v), icon = K.icon;
  K.views = K.views || {};
  const CATS = window.KERYKE_LESSONS;
  const DAILY_GOAL = 30;
  const HEARTS = 4;
  let activeCat = CATS[0].id;

  const shuffled = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  /** Avoids showing an ordering exercise already in the right order. */
  const shuffledDifferent = (arr) => {
    let a = shuffled(arr);
    for (let i = 0; i < 8 && a.every((x, k) => x === arr[k]); i++) a = shuffled(arr);
    return a;
  };

  function findLesson(id) {
    for (const c of CATS) { const l = c.lessons.find((x) => x.id === id); if (l) return { lesson: l, cat: c }; }
    return null;
  }
  const isDone = (id) => !!K.state.lessons[id];
  const isUnlocked = (cat, i) => i === 0 || isDone(cat.lessons[i - 1].id);

  K.views.learn = function (root, params) {
    if (params[0] && CATS.some((c) => c.id === params[0])) activeCat = params[0];
    const cat = CATS.find((c) => c.id === activeCat);
    const doneAll = CATS.reduce((n, c) => n + c.lessons.filter((l) => isDone(l.id)).length, 0);
    const totalAll = CATS.reduce((n, c) => n + c.lessons.length, 0);
    const today = K.state.daily.date === K.todayStr() ? K.state.daily.xp : 0;
    const firstOpen = cat.lessons.findIndex((l) => !isDone(l.id));

    root.innerHTML = String(h`<div class="page learn-page">
      <div class="learn-stats">
        <div class="learn-stat"><span class="flame">${icon('flame')}</span><strong>${K.currentStreak()}</strong><span class="muted small">${t('ln_streak')}</span></div>
        <div class="learn-stat"><span class="xp-star">${icon('star')}</span><strong>${K.state.xp}</strong><span class="muted small">${t('ln_xp')}</span></div>
        <div class="learn-stat goal"><div class="goal-top"><span class="small">${t('ln_goal')}</span><span class="small muted">${Math.min(today, DAILY_GOAL)}/${DAILY_GOAL} ${t('ln_xp')}</span></div><div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="${DAILY_GOAL}" aria-valuenow="${Math.min(today, DAILY_GOAL)}"><span style="width:${Math.min(100, (today / DAILY_GOAL) * 100)}%"></span></div><span class="small muted">${t('ln_lessonsOf', { a: doneAll, b: totalAll })}</span></div>
      </div>
      ${K.lang !== 'en' ? h`<p class="notice">${t('ln_enOnly')}</p>` : ''}
      <div class="cat-tabs" role="tablist">
        ${CATS.map((c) => {
          const d = c.lessons.filter((l) => isDone(l.id)).length;
          return h`<a class="cat-tab cat-${c.color} ${c.id === activeCat ? 'on' : ''}" role="tab" aria-selected="${String(c.id === activeCat)}" href="#/learn/${c.id}"><strong>${t('cat_' + c.id)}</strong><span class="small">${d}/${c.lessons.length}</span></a>`;
        })}
      </div>
      <ol class="path cat-${cat.color}">
        ${cat.lessons.map((l, i) => {
          const done = isDone(l.id), open = isUnlocked(cat, i), current = i === firstOpen;
          const stars = done ? K.state.lessons[l.id].stars : 0;
          return h`<li class="path-item offset${i % 4}">
            <button class="node ${done ? 'done' : ''} ${current ? 'current' : ''}" ${K.raw(open ? '' : 'disabled')} data-act="startLesson" data-id="${l.id}"
              aria-label="${l.title}${open ? '' : ' — ' + t('ln_locked')}" ${K.raw(open ? '' : `data-tip="${K.esc(t('ln_locked'))}"`)}>
              ${open ? (done ? icon('check') : h`<span class="node-num">${i + 1}</span>`) : icon('lock')}
            </button>
            <div class="node-label">
              <strong>${l.title}</strong><span class="muted small">${l.blurb}</span>
              ${done ? h`<span class="stars" aria-label="${stars}/3">${[1, 2, 3].map((n) => h`<span class="${n <= stars ? 'on' : ''}">${icon('star')}</span>`)}</span>` : ''}
              ${open ? h`<button class="link-btn" data-act="startLesson" data-id="${l.id}">${done ? t('ln_review') : t('ln_start')}</button>` : ''}
            </div>
          </li>`;
        })}
      </ol>
    </div>`);
    if (params[1]) {
      const found = findLesson(params[1]);
      if (found) {
        const idx = found.cat.lessons.indexOf(found.lesson);
        if (isUnlocked(found.cat, idx)) { K.startLesson(params[1]); }
        history.replaceState(null, '', '#/learn/' + found.cat.id);
      }
    }
  };

  /* ---------- Player ---------- */
  let P = null;

  K.startLesson = function (id) {
    const found = findLesson(id);
    if (!found) return;
    P = {
      lesson: found.lesson, cat: found.cat, queue: found.lesson.items.map((it) => ({ it })), pos: 0, hearts: HEARTS,
      graded: found.lesson.items.filter((i) => i.type !== 'teach').length, firstTryRight: 0, answer: null, checked: false, result: null, retry: new Set(), matched: [], matchLeft: null, matchOrder: null, orderPick: [], orderPool: null,
    };
    openOverlay();
    renderStep();
  };

  function overlay() { return document.getElementById('overlay'); }
  function openOverlay() {
    const o = overlay();
    o.hidden = false;
    o.className = 'overlay cat-' + P.cat.color;
    document.body.classList.add('no-scroll');
  }
  K.closeLesson = function () {
    P = null;
    const o = overlay();
    o.hidden = true;
    o.innerHTML = '';
    document.body.classList.remove('no-scroll');
    K.rerender();
  };

  function resetStepState() {
    P.answer = null; P.checked = false; P.result = null; P.matched = []; P.matchLeft = null; P.matchOrder = null; P.orderPick = []; P.orderPool = null; P.flash = null;
  }

  function renderStep() {
    const entry = P.queue[P.pos];
    const it = entry.it;
    const progress = (P.pos / P.queue.length) * 100;
    const hearts = h`<div class="hearts" role="img" aria-label="${t('ln_hearts', { n: P.hearts })}">${Array.from({ length: HEARTS }, (_, i) => h`<span class="${i < P.hearts ? 'on' : ''}">${icon('heart')}</span>`)}</div>`;
    overlay().innerHTML = String(h`<div class="player" role="dialog" aria-modal="true" aria-label="${P.lesson.title}">
      <div class="player-top">
        <button class="icon-btn" data-act="exitLesson" aria-label="${t('ln_exit')}">${icon('x')}</button>
        <div class="progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}"><span style="width:${progress}%"></span></div>
        ${hearts}
      </div>
      <div class="player-body">${stepBody(it)}</div>
      ${footer(it)}
    </div>`);
    const focusEl = overlay().querySelector('[data-focus]');
    if (focusEl) focusEl.focus();
  }

  function correctAnswerText(it) {
    if (it.type === 'mc' || it.type === 'fill') return it.options[it.a];
    if (it.type === 'tf') return t(it.a ? 'ln_true' : 'ln_false');
    return '';
  }

  function footer(it) {
    if (it.type === 'teach') return h`<div class="player-foot"><button class="btn btn-primary btn-wide" data-act="next" data-focus>${t('ln_gotIt')}</button></div>`;
    if (P.checked) {
      const ok = P.result;
      return h`<div class="player-foot feedback ${ok ? 'good' : 'bad'}" role="status">
        <div class="feedback-text">
          <strong>${icon(ok ? 'check' : 'x')} ${t(ok ? 'ln_correct' : 'ln_wrong')}</strong>
          ${!ok && correctAnswerText(it) ? h`<span>${t('ln_answer', { x: correctAnswerText(it) })}</span>` : ''}
          ${!ok && it.type === 'order' ? h`<span>${t('ln_correctOrder', { x: it.items.join(' → ') })}</span>` : ''}
          ${it.why ? h`<span>${it.why}</span>` : ''}
        </div>
        <button class="btn btn-primary btn-wide" data-act="next" data-focus>${t('ln_continue')}</button>
      </div>`;
    }
    if (it.type === 'match') return h`<div class="player-foot"><button class="btn btn-primary btn-wide" disabled>${t('ln_check')}</button></div>`;
    const ready = it.type === 'order' ? P.orderPick.length === it.items.length : P.answer !== null;
    return h`<div class="player-foot"><button class="btn btn-primary btn-wide" data-act="check" ${K.raw(ready ? 'data-focus' : 'disabled')}>${t('ln_check')}</button></div>`;
  }

  function stepBody(it) {
    if (it.type === 'teach') return h`<div class="teach"><div class="kicker">${t('ln_newIdea')}</div><h2>${it.title}</h2><p>${it.body}</p></div>`;
    if (it.type === 'mc' || it.type === 'fill' || it.type === 'tf') {
      if (!P.optOrder || P.optFor !== it) {
        P.optFor = it;
        P.optOrder = it.type === 'tf' ? [{ label: t('ln_true'), v: true }, { label: t('ln_false'), v: false }]
          : shuffled(it.options.map((label, v) => ({ label, v })));
      }
      const correctV = it.a;
      const q = it.type === 'fill' ? fillSentence(it) : it.q;
      return h`<div class="exercise"><h2 class="ex-q">${q}</h2>
        <div class="options" role="radiogroup">${P.optOrder.map((o, i) => {
          let cls = '';
          if (P.checked && o.v === correctV) cls = 'right';
          else if (P.checked && P.answer === o.v) cls = 'wrong';
          else if (P.answer === o.v) cls = 'picked';
          return h`<button class="option ${cls}" role="radio" aria-checked="${String(P.answer === o.v)}" data-act="pick" data-i="${i}" ${K.raw(P.checked ? 'disabled' : '')}><span class="opt-key">${i + 1}</span>${o.label}</button>`;
        })}</div></div>`;
    }
    if (it.type === 'match') {
      if (!P.matchOrder) P.matchOrder = { left: shuffled(it.pairs.map((p) => p[0])), right: shuffled(it.pairs.map((p) => p[1])) };
      const pairOf = (l) => it.pairs.find((p) => p[0] === l)[1];
      const isMatchedL = (l) => P.matched.indexOf(l) !== -1;
      const isMatchedR = (r) => P.matched.some((l) => pairOf(l) === r);
      return h`<div class="exercise"><h2 class="ex-q">${it.q}</h2><p class="muted small">${t('ln_matchHint')}</p>
        <div class="match-grid">
          <div class="match-col">${P.matchOrder.left.map((l, i) => h`<button class="option ${isMatchedL(l) ? 'matched' : ''} ${P.matchLeft === l ? 'picked' : ''}" aria-pressed="${String(P.matchLeft === l)}" data-act="matchL" data-i="${i}" ${K.raw(isMatchedL(l) ? 'disabled' : '')}>${l}</button>`)}</div>
          <div class="match-col">${P.matchOrder.right.map((r, i) => h`<button class="option ${isMatchedR(r) ? 'matched' : ''} ${P.flash === r ? 'wrong' : ''}" data-act="matchR" data-i="${i}" ${K.raw(isMatchedR(r) ? 'disabled' : '')}>${r}</button>`)}</div>
        </div></div>`;
    }
    if (it.type === 'order') {
      if (!P.orderPool) P.orderPool = shuffledDifferent(it.items);
      const pool = P.orderPool.filter((x) => P.orderPick.indexOf(x) === -1);
      return h`<div class="exercise"><h2 class="ex-q">${it.q}</h2><p class="muted small">${t('ln_orderHint')}</p>
        <ol class="order-picked">${P.orderPick.map((x, i) => {
          const cls = P.checked ? (it.items[i] === x ? 'right' : 'wrong') : 'picked';
          return h`<li><button class="option ${cls}" data-act="orderRemove" data-i="${i}" ${K.raw(P.checked ? 'disabled' : '')}><span class="opt-key">${i + 1}</span>${x}</button></li>`;
        })}</ol>
        <div class="options">${pool.map((x) => h`<button class="option" data-act="orderAdd" data-v="${P.orderPool.indexOf(x)}" ${K.raw(P.checked ? 'disabled' : '')}>${x}</button>`)}</div></div>`;
    }
    return '';
  }

  function fillSentence(it) {
    if (P.answer === null && !P.checked) return it.q;
    const word = it.options[P.answer];
    return it.q.replace('___', word);
  }

  function recordResult(ok) {
    const entry = P.queue[P.pos];
    if (ok) {
      if (!P.retry.has(entry.it)) P.firstTryRight++;
    } else {
      P.hearts--;
      if (!P.retry.has(entry.it)) {
        // Missed exercises come back once at the end of the lesson.
        P.retry.add(entry.it);
        P.queue.push({ it: entry.it });
      }
    }
  }

  K.lessonAct = {
    pick(el) { P.answer = P.optOrder[+el.dataset.i].v; renderStep(); },
    check() {
      const it = P.queue[P.pos].it;
      const ok = it.type === 'order' ? P.orderPick.every((x, i) => it.items[i] === x) : P.answer === it.a;
      P.checked = true; P.result = ok;
      recordResult(ok);
      renderStep();
    },
    next() {
      if (P.hearts <= 0) return outOfHearts();
      P.pos++;
      if (P.pos >= P.queue.length) return finish();
      P.optOrder = null;
      resetStepState();
      renderStep();
    },
    matchL(el) { P.matchLeft = P.matchOrder.left[+el.dataset.i]; P.flash = null; renderStep(); },
    matchR(el) {
      if (P.matchLeft === null) return;
      const it = P.queue[P.pos].it;
      const r = P.matchOrder.right[+el.dataset.i];
      const correct = it.pairs.find((p) => p[0] === P.matchLeft)[1] === r;
      if (correct) {
        P.matched.push(P.matchLeft);
        P.matchLeft = null;
        P.flash = null;
        if (P.matched.length === it.pairs.length) {
          P.checked = true; P.result = P.mistakeOn !== it;
          if (P.result && !P.retry.has(it)) P.firstTryRight++;
          P.result = true; // A completed match always ends positively; mistakes already cost hearts.
        }
      } else {
        P.flash = r;
        P.mistakeOn = it;
        P.hearts--;
        if (P.hearts <= 0) return outOfHearts();
      }
      renderStep();
    },
    orderAdd(el) { P.orderPick.push(P.orderPool[+el.dataset.v]); renderStep(); },
    orderRemove(el) { P.orderPick.splice(+el.dataset.i, 1); renderStep(); },
    async exit() {
      const leave = await K.confirmDialog(t('ln_exitConfirm'), t('ln_leave'), t('ln_stay'));
      if (leave) K.closeLesson();
    },
    retry() { const id = P.lesson.id; K.startLesson(id); },
    close() { K.closeLesson(); },
    seeNews() {
      const topic = P.lesson.topics[0];
      K.closeLesson();
      location.hash = '#/search/' + encodeURIComponent(t('t_' + topic));
    },
  };

  function outOfHearts() {
    overlay().innerHTML = String(h`<div class="player result-screen" role="dialog" aria-modal="true">
      <div class="result-icon bad">${icon('heart')}</div>
      <h2>${t('ln_out')}</h2><p class="muted">${t('ln_outBody')}</p>
      <div class="result-actions"><button class="btn btn-primary btn-wide" data-act="lessonRetry">${t('ln_retry')}</button><button class="btn btn-wide" data-act="lessonClose">${t('ln_backPath')}</button></div>
    </div>`);
  }

  function finish() {
    const accuracy = P.graded ? Math.round((P.firstTryRight / P.graded) * 100) : 100;
    const stars = accuracy >= 90 ? 3 : accuracy >= 60 ? 2 : 1;
    const repeat = !!K.state.lessons[P.lesson.id];
    const xp = repeat ? 5 : 10 + stars * 5;
    const prev = K.state.lessons[P.lesson.id];
    K.state.lessons[P.lesson.id] = { stars: Math.max(stars, prev ? prev.stars : 0), at: Date.now() };
    K.addXp(xp);
    overlay().innerHTML = String(h`<div class="player result-screen" role="dialog" aria-modal="true">
      <div class="result-icon">${icon('star')}</div>
      <h2>${t('ln_done')}</h2><p class="muted">${P.lesson.title}</p>
      <div class="stars big" aria-label="${stars}/3">${[1, 2, 3].map((n) => h`<span class="${n <= stars ? 'on' : ''}">${icon('star')}</span>`)}</div>
      <div class="result-stats">
        <div><strong>+${xp}</strong><span class="muted small">${t('ln_earned')}</span></div>
        <div><strong>${accuracy}%</strong><span class="muted small">${t('ln_accuracy')}</span></div>
        <div><strong>${K.currentStreak()}</strong><span class="muted small">${t('ln_streak')}</span></div>
      </div>
      <div class="result-actions"><button class="btn btn-primary btn-wide" data-act="lessonClose" data-focus>${t('ln_continue')}</button><button class="btn btn-wide" data-act="lessonSeeNews">${t('ln_seeNews')}</button></div>
    </div>`);
  }

  K.currentExercise = () => (P ? P.queue[P.pos].it : null);

  K.lessonKey = function (e) {
    if (!P || overlay().hidden) return;
    if (document.querySelector('dialog[open]')) return;
    if (e.key >= '1' && e.key <= '9') {
      const btn = overlay().querySelectorAll('.options .option:not([disabled])')[+e.key - 1];
      if (btn) btn.click();
    } else if (e.key === 'Escape') {
      K.lessonAct.exit();
    }
  };
})();
