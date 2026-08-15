/* SnowPro Core Academy — UI behaviour.
   Plain ES2019, no framework, no build step. Everything degrades gracefully:
   with JS disabled the pages are still fully readable. */
(function () {
  'use strict';

  // Namespace keys by the first path segment so two courses published under the
  // same github.io domain do not overwrite each other's theme and progress.
  var NS = 'ls:' + location.pathname.split('/').filter(Boolean).slice(0, 1).join('/') + ':';
  var STORE_THEME = NS + 'theme';
  var STORE_PROGRESS = NS + 'progress';
  var slug = document.documentElement.dataset.page;

  /* ---------- tiny storage wrapper (private browsing can throw) ---------- */

  var store = {
    get: function (k, fallback) {
      try { var v = localStorage.getItem(k); return v === null ? fallback : v; }
      catch (e) { return fallback; }
    },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ---------- theme ---------- */

  var themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      store.set(STORE_THEME, next);
    });
  }

  /* ---------- mobile navigation ---------- */

  var navToggle = document.getElementById('navToggle');
  var scrim = document.getElementById('scrim');
  function closeNav() {
    document.body.classList.remove('nav-open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
  }
  if (navToggle) {
    navToggle.addEventListener('click', function () {
      var open = document.body.classList.toggle('nav-open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
  }
  if (scrim) scrim.addEventListener('click', closeNav);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeNav(); });

  /* ---------- progress tracking ---------- */

  function readProgress() {
    try { return JSON.parse(store.get(STORE_PROGRESS, '{}')) || {}; }
    catch (e) { return {}; }
  }
  function writeProgress(p) { store.set(STORE_PROGRESS, JSON.stringify(p)); }

  var topics = window.SPC_TOPICS || {};
  var totalTopics = Object.keys(topics).reduce(function (n, k) { return n + topics[k].length; }, 0);

  function doneCount(progress) {
    return Object.keys(topics).reduce(function (n, page) {
      var set = progress[page] || [];
      return n + topics[page].filter(function (id) { return set.indexOf(id) !== -1; }).length;
    }, 0);
  }

  function renderProgress() {
    var progress = readProgress();
    var done = doneCount(progress);
    var pct = totalTopics ? Math.round((done / totalTopics) * 100) : 0;

    var fill = document.getElementById('progressFill');
    var pctEl = document.getElementById('progressPct');
    var sub = document.getElementById('progressSub');
    if (fill) fill.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
    if (sub) sub.textContent = done + ' of ' + totalTopics + ' topics marked done';

    // Tick pages in the sidebar once every topic on them is complete.
    document.querySelectorAll('.nav-list a').forEach(function (a) {
      var target = (a.getAttribute('href') || '').replace('.html', '');
      var ids = topics[target] || [];
      var set = progress[target] || [];
      var complete = ids.length > 0 && ids.every(function (id) { return set.indexOf(id) !== -1; });
      a.classList.toggle('done', complete);
    });
  }

  document.querySelectorAll('input[data-topic]').forEach(function (box) {
    var progress = readProgress();
    var set = progress[slug] || [];
    box.checked = set.indexOf(box.dataset.topic) !== -1;

    box.addEventListener('change', function () {
      var p = readProgress();
      var list = p[slug] || [];
      var id = box.dataset.topic;
      if (box.checked) { if (list.indexOf(id) === -1) list.push(id); }
      else { list = list.filter(function (x) { return x !== id; }); }
      p[slug] = list;
      writeProgress(p);
      renderProgress();
    });
  });

  var reset = document.getElementById('resetProgress');
  if (reset) {
    reset.addEventListener('click', function () {
      writeProgress({});
      document.querySelectorAll('input[data-topic]').forEach(function (b) { b.checked = false; });
      renderProgress();
    });
  }
  renderProgress();

  /* ---------- search ---------- */

  var input = document.getElementById('searchInput');
  var results = document.getElementById('searchResults');
  var index = window.SPC_INDEX || [];

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function snippet(text, term) {
    var i = text.toLowerCase().indexOf(term);
    if (i === -1) return '';
    var start = Math.max(0, i - 60);
    var raw = (start > 0 ? '…' : '') + text.slice(start, i + term.length + 90) + '…';
    return escapeHtml(raw).replace(
      new RegExp('(' + term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'),
      '<mark>$1</mark>'
    );
  }

  function search(term) {
    term = term.trim().toLowerCase();
    if (term.length < 2) return null;
    var hits = [];

    index.forEach(function (page) {
      var titleHit = page.title.toLowerCase().indexOf(term) !== -1;
      if (titleHit) {
        hits.push({ score: 100, url: page.slug + '.html', title: page.title, crumb: 'Page', snippet: escapeHtml(page.lede.slice(0, 110)) });
      }
      page.headings.forEach(function (h) {
        if (h.text.toLowerCase().indexOf(term) !== -1) {
          hits.push({ score: 60, url: page.slug + '.html#' + h.id, title: h.text, crumb: page.title, snippet: '' });
        }
      });
      if (!titleHit && page.text.toLowerCase().indexOf(term) !== -1) {
        hits.push({ score: 20, url: page.slug + '.html', title: page.title, crumb: 'Mentioned in', snippet: snippet(page.text, term) });
      }
    });

    return hits.sort(function (a, b) { return b.score - a.score; }).slice(0, 12);
  }

  function renderResults(hits) {
    if (hits === null) { results.hidden = true; return; }
    if (!hits.length) {
      results.innerHTML = '<p class="search-empty">No matches. Try a shorter term, e.g. “cache” or “clone”.</p>';
      results.hidden = false;
      return;
    }
    results.innerHTML = hits.map(function (h) {
      return '<a href="' + h.url + '">' +
        '<span class="sr-crumb">' + escapeHtml(h.crumb) + '</span>' +
        '<span class="sr-title">' + escapeHtml(h.title) + '</span>' +
        (h.snippet ? '<span class="sr-snippet">' + h.snippet + '</span>' : '') +
        '</a>';
    }).join('');
    results.hidden = false;
  }

  if (input && results) {
    input.addEventListener('input', function () { renderResults(search(input.value)); });
    input.addEventListener('focus', function () { if (input.value) renderResults(search(input.value)); });
    document.addEventListener('click', function (e) {
      if (!results.contains(e.target) && e.target !== input) results.hidden = true;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement !== input && !/^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName)) {
        e.preventDefault();
        input.focus();
      }
    });
  }

  /* ---------- table of contents scroll spy ---------- */

  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc-list a'));
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var headings = tocLinks
      .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
      .filter(Boolean);

    var visible = new Set();
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) visible.add(entry.target.id);
        else visible.delete(entry.target.id);
      });
      var firstVisible = headings.find(function (h) { return visible.has(h.id); });
      tocLinks.forEach(function (a) {
        a.classList.toggle('active', !!firstVisible && a.getAttribute('href') === '#' + firstVisible.id);
      });
    }, { rootMargin: '-80px 0px -70% 0px' });

    headings.forEach(function (h) { observer.observe(h); });
  }

  /* ---------- lightweight SQL / shell highlighting ---------- */

  var KEYWORDS = ('select|from|where|group|order|by|having|limit|join|inner|left|right|full|outer|on|as|and|or|not|in|is|null|' +
    'create|replace|alter|drop|undrop|table|transient|temporary|permanent|database|schema|view|secure|materialized|warehouse|' +
    'stage|pipe|stream|task|role|user|grant|revoke|to|with|use|show|describe|desc|copy|into|insert|update|delete|merge|values|' +
    'set|when|matched|then|case|else|end|clone|at|before|offset|timestamp|statement|put|get|list|remove|file|format|type|' +
    'auto_ingest|warehouse_size|auto_suspend|auto_resume|initially_suspended|min_cluster_count|max_cluster_count|scaling_policy|' +
    'data_retention_time_in_days|cluster|key|masking|policy|row|access|tag|integration|external|iceberg|dynamic|target_lag|' +
    'lateral|flatten|qualify|over|partition|distinct|union|all|exists|like|between|call|alter|resource|monitor|credit_quota|' +
    'triggers|percent|do|suspend|notify|comment|if|not|exists|revoke|ownership|apply|imported|privileges|share|add|current'
  ).split('|');

  var KW_RE = new RegExp('\\b(' + KEYWORDS.join('|') + ')\\b', 'gi');

  document.querySelectorAll('pre > code').forEach(function (code) {
    if (code.classList.contains('nohighlight')) return;
    var html = escapeHtml(code.textContent);
    var placeholders = [];
    // The token holds no standalone digits and no SQL words, so neither the
    // keyword pass nor the number pass can corrupt it before it is restored.
    function stash(markup) { placeholders.push(markup); return '%%SPCTOK' + (placeholders.length - 1) + '%%'; }

    // Comments and strings are stashed first so keywords inside them keep their colour.
    html = html.replace(/--[^\n]*/g, function (m) { return stash('<span class="tok-com">' + m + '</span>'); });
    html = html.replace(/#[^\n]*/g, function (m) { return stash('<span class="tok-com">' + m + '</span>'); });
    html = html.replace(/'[^'\n]*'/g, function (m) { return stash('<span class="tok-str">' + m + '</span>'); });
    html = html.replace(KW_RE, '<span class="tok-kw">$1</span>');
    html = html.replace(/(^|[^\w"'-])(\d+)(?![\w-])/g, '$1<span class="tok-num">$2</span>');
    html = html.replace(/%%SPCTOK(\d+)%%/g, function (_, i) { return placeholders[i]; });

    code.innerHTML = html;
  });
})();
