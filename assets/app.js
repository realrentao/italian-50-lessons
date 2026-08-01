/* 意大利语入门 50 篇 —— 前端逻辑
   纯静态：hash 路由 + localStorage 进度，双击 index.html 即可离线使用。 */
(function () {
  'use strict';

  var D = window.APP_DATA;
  var L = D.lessons, BOOKS = D.books, WORDS = D.words || {};
  var byId = {};
  L.forEach(function (x) { byId[x.id] = x; });

  var SPEEDS = [
    { k: 's', label: '慢', title: '慢速 -35%（跟读用）' },
    { k: 'm', label: '中', title: '常速（原速）' },
    { k: 'f', label: '快', title: '快速 +25%（听力挑战）' }
  ];

  // ---------- 存储 ----------
  function ls(k, def) {
    try { var v = localStorage.getItem('it50.' + k); return v === null ? def : JSON.parse(v); }
    catch (e) { return def; }
  }
  function save(k, v) { try { localStorage.setItem('it50.' + k, JSON.stringify(v)); } catch (e) {} }

  var S = {
    speed: ls('speed', 'm'),
    view: ls('view', 'both'),
    theme: ls('theme', 'dark'),
    done: ls('done', []),
    collapsed: ls('collapsed', []),
    id: null, mode: 'none', queue: [], qi: 0, curPara: -1
  };
  if (SPEEDS.map(function (s) { return s.k; }).indexOf(S.speed) < 0) S.speed = 'm';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var app = $('#app'), audio = $('#audio'), navEl = $('#nav');

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function isDone(id) { return S.done.indexOf(id) >= 0; }

  // ---------- 音频 ----------
  function paraSrc(les, i, sp) {
    var a = les.audio && les.audio[i];
    return a && a[sp] ? 'audio/p/' + a[sp] : null;
  }
  function stopAudio() {
    audio.pause(); audio.removeAttribute('src'); audio.load();
    S.mode = 'none'; S.queue = []; S.qi = 0;
    setPara(-1); markVocab(null); syncPlayBtn();
  }
  function setPara(i) {
    S.curPara = i;
    Array.prototype.forEach.call(document.querySelectorAll('.para'), function (el, k) {
      el.classList.toggle('playing', k === i);
    });
    var st = $('#pstatus');
    if (st) {
      var les = byId[S.id], n = les && les.it ? les.it.length : 0;
      st.textContent = i < 0 ? (n ? n + ' 个段落' : '') : ('正在播放 第 ' + (i + 1) + ' / ' + n + ' 段');
    }
  }
  function markVocab(el) {
    Array.prototype.forEach.call(document.querySelectorAll('.vc'), function (v) {
      v.classList.toggle('playing', v === el);
    });
  }
  function syncPlayBtn() {
    var b = $('#playAll');
    if (b) b.innerHTML = (S.mode === 'all' && !audio.paused) ? '❚❚' : '▶';
  }

  function playParas(list, start) {
    var les = byId[S.id];
    if (!les) return;
    S.queue = list; S.qi = start || 0; S.mode = list.length > 1 ? 'all' : 'one';
    step();
  }
  function step() {
    if (S.qi >= S.queue.length) { stopAudio(); return; }
    var i = S.queue[S.qi], src = paraSrc(byId[S.id], i, S.speed);
    if (!src) { S.qi++; step(); return; }
    audio.src = src; setPara(i); markVocab(null);
    audio.play().catch(function () {});
    syncPlayBtn();
  }
  audio.addEventListener('ended', function () {
    if (S.mode === 'all') { S.qi++; step(); }
    else { stopAudio(); }
  });
  audio.addEventListener('play', syncPlayBtn);
  audio.addEventListener('pause', syncPlayBtn);

  function playWord(w, el) {
    var f = WORDS[w];
    if (!f) return;
    S.mode = 'word'; S.queue = []; setPara(-1);
    audio.src = 'audio/w/' + f;
    audio.playbackRate = S.speed === 's' ? 0.72 : (S.speed === 'f' ? 1.22 : 1);
    audio.play().catch(function () {});
    markVocab(el);
  }
  // 段落音频用不同文件控速，需把倍速复位
  audio.addEventListener('loadstart', function () {
    if (S.mode !== 'word') audio.playbackRate = 1;
  });

  function setSpeed(sp) {
    S.speed = sp; save('speed', sp);
    Array.prototype.forEach.call(document.querySelectorAll('[data-speed]'), function (b) {
      b.classList.toggle('on', b.dataset.speed === sp);
    });
    if (S.mode === 'all' || S.mode === 'one') {   // 播放中切速：当前段用新语速重播
      var t = audio.currentTime, was = !audio.paused, i = S.queue[S.qi];
      var src = paraSrc(byId[S.id], i, sp);
      if (src) {
        audio.src = src;
        audio.addEventListener('loadedmetadata', function h() {
          audio.removeEventListener('loadedmetadata', h);
          try { audio.currentTime = Math.min(t, audio.duration - 0.1); } catch (e) {}
          if (was) audio.play().catch(function () {});
        });
      }
    }
  }

  // ---------- 侧栏 ----------
  function matches(les, q) {
    if (!q) return true;
    q = q.toLowerCase();
    if ((les.titleIt + ' ' + les.titleCn + ' ' + les.focus).toLowerCase().indexOf(q) >= 0) return true;
    if (('' + les.id) === q) return true;
    for (var i = 0; i < les.vocab.length; i++) {
      var v = les.vocab[i];
      if ((v.it + ' ' + v.cn).toLowerCase().indexOf(q) >= 0) return true;
    }
    for (var j = 0; j < les.grammar.length; j++)
      if (les.grammar[j].toLowerCase().indexOf(q) >= 0) return true;
    return false;
  }

  function renderNav(q) {
    var html = '', any = false;
    BOOKS.forEach(function (b) {
      var items = L.filter(function (x) { return x.book === b.id && matches(x, q); });
      if (!items.length) return;
      any = true;
      var col = !q && S.collapsed.indexOf(b.id) >= 0;
      html += '<div class="book' + (col ? ' collapsed' : '') + '" data-book="' + b.id + '">' +
        '<div class="book-head"><span class="chev">▼</span>第 ' + b.id + ' 册 · ' + esc(b.name) +
        '<span style="margin-left:auto;opacity:.65">' + b.range[0] + '–' + b.range[1] + '</span></div>' +
        '<ul class="book-list">';
      items.forEach(function (x) {
        html += '<li><a href="#/l/' + x.id + '" data-id="' + x.id + '" class="' +
          (isDone(x.id) ? 'done' : '') + '">' +
          '<span class="num">' + x.id + '</span>' +
          '<span class="t">' + esc(x.titleCn) + '</span></a></li>';
      });
      html += '</ul></div>';
    });
    navEl.innerHTML = any ? html : '<div class="empty">没有匹配的篇目</div>';
    highlightNav();
  }
  function highlightNav() {
    Array.prototype.forEach.call(navEl.querySelectorAll('a'), function (a) {
      a.classList.toggle('active', +a.dataset.id === S.id);
    });
  }
  function updateProgress() {
    var n = S.done.length;
    $('#progText').textContent = '学习进度 ' + n + ' / ' + L.length;
    $('#progBar').style.width = (n / L.length * 100) + '%';
  }

  navEl.addEventListener('click', function (e) {
    var h = e.target.closest('.book-head');
    if (h) {
      var b = +h.parentNode.dataset.book, i = S.collapsed.indexOf(b);
      if (i >= 0) S.collapsed.splice(i, 1); else S.collapsed.push(b);
      save('collapsed', S.collapsed);
      h.parentNode.classList.toggle('collapsed');
    }
    if (e.target.closest('a')) closeSidebar();
  });
  $('#search').addEventListener('input', function (e) { renderNav(e.target.value.trim()); });

  // ---------- 首页 ----------
  function viewHome() {
    var c = D.meta.counts;
    var h = '<div class="page wide"><div class="hero">' +
      '<h2>' + esc(D.meta.title) + '</h2>' +
      '<div class="sub">' + esc(D.meta.subtitle) + '</div>' +
      '<p>全部内容提取自《' + esc(D.meta.source) + '》。每篇提供中意对照原文、' +
      '真人语音朗读（' + esc(D.meta.voice) + '，慢／中／快三档语速）、生词表点读、' +
      '语法要点、配套练习与参考答案。</p>' +
      '<div class="stats">' +
      '<div class="stat"><b>' + c.lessons + '</b><span>短文篇目</span></div>' +
      '<div class="stat"><b>' + c.paras + '</b><span>朗读段落</span></div>' +
      '<div class="stat"><b>' + c.vocab + '</b><span>生词条目</span></div>' +
      '<div class="stat"><b>' + c.quiz + '</b><span>练习题</span></div>' +
      '<div class="stat"><b>' + S.done.length + '</b><span>已学完</span></div>' +
      '</div></div>';

    BOOKS.forEach(function (b) {
      var items = L.filter(function (x) { return x.book === b.id; });
      h += '<div class="bookcard"><h3>第 ' + b.id + ' 册 · ' + esc(b.name) +
        ' <em>' + esc(b.sub) + '</em>' +
        '<span class="tag">第 ' + b.range[0] + '–' + b.range[1] + ' 篇</span></h3>' +
        '<div class="note">' + esc(b.note) + '</div>' +
        '<div class="grid">';
      items.forEach(function (x) {
        h += '<a class="lcard' + (isDone(x.id) ? ' done' : '') + '" href="#/l/' + x.id + '">' +
          '<div class="h"><span class="dot"></span>第 ' + x.id + ' 篇</div>' +
          '<div class="it">' + esc(x.titleIt || x.titleCn) + '</div>' +
          '<div class="cn">' + esc(x.titleCn) + '</div></a>';
      });
      h += '</div><div class="src" style="margin-top:12px">' + esc(b.src) + '</div></div>';
    });
    h += '<div class="callout"><span class="lb">使用提示</span>' +
      '点击段落左侧的喇叭可单段朗读，顶部 ▶ 为整篇连播，播放中可随时切换语速。' +
      '快捷键：<kbd>空格</kbd> 播放/暂停 · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> 慢/中/快 · ' +
      '<kbd>←</kbd><kbd>→</kbd> 上一篇/下一篇。</div></div>';
    app.innerHTML = h;
    $('#crumb').textContent = '目录';
    document.title = D.meta.title;
  }

  // ---------- 课文页 ----------
  function splitStem(stem) {
    var parts = stem.split(/\s+[-–]\s+/);
    if (parts.length < 2) return esc(stem);
    return esc(parts[0]) + parts.slice(1).map(function (p) {
      return '<span class="sub">' + esc(p) + '</span>';
    }).join('');
  }
  function mcqKey(ansText) {
    var m = /^([A-Da-d])(?![A-Za-z])/.exec(String(ansText).trim());
    return m ? m[1].toUpperCase() : null;
  }

  function viewLesson(id) {
    var x = byId[id];
    if (!x) { app.innerHTML = '<div class="empty">找不到第 ' + esc(id) + ' 篇</div>'; return; }
    S.id = id;
    var book = BOOKS.filter(function (b) { return b.id === x.book; })[0];
    var hasAudio = !!(x.audio && x.audio.length);

    var h = '<div class="page"><div class="lesson-head">' +
      '<div class="kicker">第 ' + x.id + ' 篇 · 第 ' + book.id + ' 册 ' + esc(book.name) + '</div>' +
      '<h2>' + esc(x.titleIt || x.titleCn) + '</h2>' +
      '<div class="cn">' + esc(x.titleCn) + '</div></div>';

    if (x.focus)
      h += '<div class="callout"><span class="lb">学习重点</span>' + esc(x.focus) + '</div>';
    if (x.note)
      h += '<div class="callout warn"><span class="lb">原文缺失说明</span>' + esc(x.note) + '</div>';

    // 播放器 + 原文
    if (x.it.length) {
      h += '<div class="section"><h3>意大利语原文 <span class="n">' + x.it.length + ' 段</span></h3>' +
        '<div class="player">' +
        '<button class="play" id="playAll"' + (hasAudio ? '' : ' disabled') + ' title="整篇连播">▶</button>' +
        '<span class="lb">语速</span><div class="seg">' +
        SPEEDS.map(function (s) {
          return '<button data-speed="' + s.k + '" title="' + s.title + '"' +
            (S.speed === s.k ? ' class="on"' : '') + '>' + s.label + '</button>';
        }).join('') + '</div>' +
        '<span class="status" id="pstatus">' + (hasAudio ? x.it.length + ' 个段落' : '本篇暂无音频') + '</span>' +
        '</div><div style="margin-top:13px">';
      x.it.forEach(function (p, i) {
        h += '<div class="para" data-i="' + i + '">' +
          '<div class="row"><span class="spk">▶</span>' +
          '<div class="t-it">' + esc(p) + '</div></div>' +
          '<div class="t-cn">' + esc(x.cn[i] || '') + '</div></div>';
      });
      h += '</div></div>';
    }

    if (x.vocab.length) {
      h += '<div class="section"><h3>生词表 <span class="n">' + x.vocab.length + '</span>' +
        '<span class="right" style="font-size:11px;color:var(--fg-3);letter-spacing:0;text-transform:none">点击可发音</span></h3>' +
        '<div class="vocab">';
      x.vocab.forEach(function (v) {
        var can = !!WORDS[v.it];
        h += '<div class="vc"' + (can ? ' data-w="' + esc(v.it) + '"' : '') +
          ' style="cursor:' + (can ? 'pointer' : 'default') + '">' +
          '<span class="spk">' + (can ? '▶' : '·') + '</span>' +
          '<span class="w">' + esc(v.it) + '</span>' +
          '<span class="pos">' + esc(v.pos) + '</span>' +
          '<span class="m">' + esc(v.cn) + '</span></div>';
      });
      h += '</div></div>';
    }

    if (x.grammar.length) {
      h += '<div class="section"><h3>语法 / 学习要点 <span class="n">' + x.grammar.length + '</span></h3><ul class="glist">';
      x.grammar.forEach(function (g, i) {
        h += '<li><span class="i">' + (i + 1) + '</span><div>' + esc(g) + '</div></li>';
      });
      h += '</ul></div>';
    }

    if (x.pron.length) {
      h += '<div class="section"><h3>发音提示 <span class="n">' + x.pron.length + '</span></h3><div class="pron">';
      x.pron.forEach(function (p) {
        h += '<div class="pc">' + (p.word ? '<div class="w">' + esc(p.word) + '</div>' : '') +
          (p.ipa ? '<div class="ipa">[' + esc(p.ipa) + ']</div>' : '') +
          (p.tip ? '<div class="tip">' + esc(p.tip) + '</div>' : '') + '</div>';
      });
      h += '</div></div>';
    }

    if (x.quiz.length) {
      h += '<div class="section"><h3>练习题 <span class="n">' + x.quiz.length + ' 题</span></h3>' +
        '<div class="quizbar">' +
        '<button class="btn primary" id="checkQuiz">提交批改</button>' +
        '<button class="btn" id="showAns">显示全部答案</button>' +
        '<button class="btn" id="resetQuiz">重做</button>' +
        '<span class="score" id="score"></span></div>';
      x.quiz.forEach(function (q, qi) {
        var a = x.answers[qi] || {};
        h += '<div class="q" data-qi="' + qi + '"><div class="qh">' +
          '<span class="qn">' + q.n + '</span>' +
          (q.type ? '<span class="qt">' + esc(q.type) + '</span>' : '') + '</div>' +
          '<div class="stem">' + splitStem(q.stem) + '</div>';
        if (q.options.length) {
          h += '<ul class="opts">';
          q.options.forEach(function (o) {
            h += '<li data-k="' + o.key + '"><span class="k">' + o.key + '</span><span>' + esc(o.text) + '</span></li>';
          });
          h += '</ul>';
        } else {
          h += '<textarea placeholder="在此作答（可选）…" rows="2"></textarea>';
        }
        h += '<div class="ans"><div><span class="k">参考答案：</span>' + esc(a.answer || '—') + '</div>' +
          (a.explain ? '<div class="ex">解析：' + esc(a.explain) + '</div>' : '') + '</div></div>';
      });
      h += '</div>';
    }

    // 已学完 + 上下篇
    h += '<div class="quizbar" style="margin-top:26px">' +
      '<button class="btn' + (isDone(id) ? ' primary' : '') + '" id="doneBtn">' +
      (isDone(id) ? '✓ 已学完' : '标记为已学完') + '</button></div>';
    var prev = byId[id - 1], next = byId[id + 1];
    h += '<div class="pager">' +
      (prev ? '<a href="#/l/' + prev.id + '"><div class="d">← 上一篇 · 第 ' + prev.id + ' 篇</div>' +
        '<div class="t">' + esc(prev.titleIt || prev.titleCn) + '</div></a>'
        : '<a class="ghost"></a>') +
      (next ? '<a class="next" href="#/l/' + next.id + '"><div class="d">下一篇 · 第 ' + next.id + ' 篇 →</div>' +
        '<div class="t">' + esc(next.titleIt || next.titleCn) + '</div></a>'
        : '<a class="ghost"></a>') +
      '</div></div>';

    app.innerHTML = h;
    $('#crumb').textContent = '第 ' + x.id + ' 篇 · ' + x.titleCn;
    document.title = '第 ' + x.id + ' 篇 ' + x.titleCn + ' · ' + D.meta.title;
    bindLesson(x);
    highlightNav();
    window.scrollTo(0, 0);
  }

  function bindLesson(x) {
    var pa = $('#playAll');
    if (pa) pa.addEventListener('click', function () {
      if (S.mode === 'all' && !audio.paused) { audio.pause(); }
      else if (S.mode === 'all' && audio.paused && audio.src) { audio.play().catch(function () {}); }
      else { playParas(x.it.map(function (_, i) { return i; }), 0); }
      syncPlayBtn();
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-speed]'), function (b) {
      b.addEventListener('click', function () { setSpeed(b.dataset.speed); });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.para'), function (el) {
      el.addEventListener('click', function () {
        var i = +el.dataset.i;
        if (S.mode !== 'all' && S.curPara === i && !audio.paused) { stopAudio(); return; }
        playParas([i], 0);
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.vc[data-w]'), function (el) {
      el.addEventListener('click', function () { playWord(el.dataset.w, el); });
    });

    // 练习交互
    Array.prototype.forEach.call(document.querySelectorAll('.opts'), function (ul) {
      ul.addEventListener('click', function (e) {
        var li = e.target.closest('li'); if (!li) return;
        Array.prototype.forEach.call(ul.children, function (c) { c.classList.remove('sel'); });
        li.classList.add('sel');
      });
    });
    function revealAll(show) {
      Array.prototype.forEach.call(document.querySelectorAll('.ans'), function (a) {
        a.classList.toggle('show', show);
      });
    }
    var sa = $('#showAns');
    if (sa) sa.addEventListener('click', function () {
      var on = !document.querySelector('.ans.show');
      revealAll(on);
      sa.textContent = on ? '隐藏全部答案' : '显示全部答案';
    });
    var cq = $('#checkQuiz');
    if (cq) cq.addEventListener('click', function () {
      var right = 0, total = 0;
      Array.prototype.forEach.call(document.querySelectorAll('.q'), function (qEl) {
        var qi = +qEl.dataset.qi, ans = x.answers[qi] || {};
        var key = mcqKey(ans.answer);
        var ul = qEl.querySelector('.opts');
        if (ul && key) {
          total++;
          var sel = ul.querySelector('.sel');
          Array.prototype.forEach.call(ul.children, function (li) {
            li.classList.remove('right', 'wrong');
            if (li.dataset.k === key) li.classList.add('right');
          });
          if (sel) {
            if (sel.dataset.k === key) right++;
            else sel.classList.add('wrong');
          }
        }
        qEl.querySelector('.ans').classList.add('show');
      });
      $('#score').innerHTML = total
        ? '选择题得分 <b>' + right + '</b> / ' + total + '　（其余为主观题，请对照参考答案）'
        : '本篇均为主观题，请对照参考答案自评';
      if (sa) sa.textContent = '隐藏全部答案';
    });
    var rq = $('#resetQuiz');
    if (rq) rq.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('.opts li'), function (li) {
        li.classList.remove('sel', 'right', 'wrong');
      });
      Array.prototype.forEach.call(document.querySelectorAll('.q textarea'), function (t) { t.value = ''; });
      revealAll(false);
      $('#score').textContent = '';
      if (sa) sa.textContent = '显示全部答案';
    });

    var db = $('#doneBtn');
    if (db) db.addEventListener('click', function () {
      var i = S.done.indexOf(x.id);
      if (i >= 0) S.done.splice(i, 1); else S.done.push(x.id);
      save('done', S.done);
      db.textContent = isDone(x.id) ? '✓ 已学完' : '标记为已学完';
      db.classList.toggle('primary', isDone(x.id));
      updateProgress(); renderNav($('#search').value.trim());
    });
  }

  // ---------- 路由 ----------
  function route() {
    stopAudio();
    var m = /^#\/l\/(\d+)/.exec(location.hash);
    if (m) { viewLesson(+m[1]); }
    else { S.id = null; viewHome(); highlightNav(); }
  }
  window.addEventListener('hashchange', route);

  // ---------- 顶栏 ----------
  function applyTheme() {
    document.documentElement.dataset.theme = S.theme;
    $('#themeBtn').textContent = S.theme === 'dark' ? '◐' : '◑';
  }
  $('#themeBtn').addEventListener('click', function () {
    S.theme = S.theme === 'dark' ? 'light' : 'dark'; save('theme', S.theme); applyTheme();
  });
  function applyView() {
    document.body.dataset.view = S.view;
    Array.prototype.forEach.call($('#viewSeg').children, function (b) {
      b.classList.toggle('on', b.dataset.view === S.view);
    });
  }
  $('#viewSeg').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    S.view = b.dataset.view; save('view', S.view); applyView();
  });

  function closeSidebar() {
    $('#sidebar').classList.remove('open');
    var s = document.querySelector('.scrim'); if (s) s.remove();
  }
  $('#menuBtn').addEventListener('click', function () {
    var sb = $('#sidebar');
    if (sb.classList.contains('open')) return closeSidebar();
    sb.classList.add('open');
    var sc = document.createElement('div');
    sc.className = 'scrim'; sc.addEventListener('click', closeSidebar);
    document.body.appendChild(sc);
  });

  // ---------- 快捷键 ----------
  document.addEventListener('keydown', function (e) {
    var t = e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA') return;
    if (e.key === ' ' && S.id) {
      e.preventDefault();
      var b = $('#playAll'); if (b && !b.disabled) b.click();
    } else if (e.key === '1') setSpeed('s');
    else if (e.key === '2') setSpeed('m');
    else if (e.key === '3') setSpeed('f');
    else if (e.key === 'ArrowLeft' && S.id && byId[S.id - 1]) location.hash = '#/l/' + (S.id - 1);
    else if (e.key === 'ArrowRight' && S.id && byId[S.id + 1]) location.hash = '#/l/' + (S.id + 1);
  });

  // ---------- 启动 ----------
  applyTheme(); applyView(); renderNav(''); updateProgress(); route();
})();
