/* Quiz engine. Questions live in src/data/questions.js as window.QUIZ so that
   adding questions never means touching this file. A question is treated as
   multi-select automatically whenever its answer is an array. */
(function () {
  'use strict';

  /* ---------------- engine ---------------- */

  var root = document.getElementById('quizRoot');
  if (!root) return;

  var QUIZ = window.QUIZ || { categories: {}, questions: [] };
  var DOMAINS = QUIZ.categories;
  var QUESTIONS = QUIZ.questions;

  var state = { domain: 'all', pool: [], i: 0, correct: 0, answered: false, picked: [] };

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function start(domain) {
    state.domain = domain;
    var subset = domain === 'all' ? QUESTIONS : QUESTIONS.filter(function (q) { return String(q.c) === String(domain); });
    state.pool = shuffle(subset);
    state.i = 0;
    state.correct = 0;
    state.answered = false;
    state.picked = [];
    render();
  }

  function answerKey(q) {
    return Array.isArray(q.a) ? q.a.slice().sort() : [q.a];
  }

  function render() {
    if (state.i >= state.pool.length) return renderResult();

    var q = state.pool[state.i];
    var key = answerKey(q);
    var multi = key.length > 1;
    var letters = ['A', 'B', 'C', 'D', 'E'];

    var html = '<div class="q-card">';
    html += '<div class="q-meta"><span>' + esc(DOMAINS[q.c]) + '</span>' +
      '<span>Question ' + (state.i + 1) + ' of ' + state.pool.length + '</span></div>';
    html += '<p class="q-stem">' + esc(q.q) + (multi ? ' <em>(select ' + key.length + ')</em>' : '') + '</p>';
    html += '<ul class="q-options">';

    q.o.forEach(function (opt, idx) {
      var cls = 'q-opt';
      if (state.answered) {
        if (key.indexOf(idx) !== -1) cls += ' correct';
        else if (state.picked.indexOf(idx) !== -1) cls += ' wrong';
      } else if (state.picked.indexOf(idx) !== -1) {
        cls += ' selected';
      }
      html += '<li><button type="button" class="' + cls + '" data-idx="' + idx + '"' +
        (state.answered ? ' disabled' : '') + '>' +
        '<span class="key">' + letters[idx] + '</span><span>' + esc(opt) + '</span></button></li>';
    });

    html += '</ul>';

    if (state.answered) {
      var right = key.length === state.picked.length &&
        key.every(function (k) { return state.picked.indexOf(k) !== -1; });
      html += '<div class="q-explain"><b>' + (right ? 'Correct.' : 'Not quite.') + '</b> ' + esc(q.e) + '</div>';
    }

    html += '<div class="q-actions">';
    if (!state.answered) {
      html += '<button class="btn" id="checkBtn"' + (state.picked.length ? '' : ' disabled') + '>Check answer</button>';
    } else {
      html += '<button class="btn" id="nextBtn">' +
        (state.i + 1 >= state.pool.length ? 'See results' : 'Next question') + '</button>';
    }
    html += '<span class="q-score">Score: ' + state.correct + ' / ' + state.i + (state.answered ? '' : '') + '</span>';
    html += '</div></div>';

    root.innerHTML = html;

    root.querySelectorAll('.q-opt').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = Number(btn.dataset.idx);
        if (multi) {
          var at = state.picked.indexOf(idx);
          if (at === -1) state.picked.push(idx); else state.picked.splice(at, 1);
        } else {
          state.picked = [idx];
        }
        render();
      });
    });

    var check = document.getElementById('checkBtn');
    if (check) {
      check.addEventListener('click', function () {
        var k = answerKey(q);
        var right = k.length === state.picked.length &&
          k.every(function (x) { return state.picked.indexOf(x) !== -1; });
        if (right) state.correct++;
        state.answered = true;
        render();
      });
    }

    var next = document.getElementById('nextBtn');
    if (next) {
      next.addEventListener('click', function () {
        state.i++;
        state.answered = false;
        state.picked = [];
        render();
        window.scrollTo({ top: root.offsetTop - 100, behavior: 'smooth' });
      });
    }
  }

  function renderResult() {
    var total = state.pool.length;
    var pct = total ? Math.round((state.correct / total) * 100) : 0;
    var verdict = pct >= 85 ? 'Exam-ready on this material. Keep it warm.'
      : pct >= 75 ? 'Close. Tighten the topics you missed and re-run.'
      : pct >= 60 ? 'Reasonable base, not yet a pass. Re-read the weak domains.'
      : 'Go back through the lessons before testing again — that is what they are for.';

    root.innerHTML =
      '<div class="result"><div class="big">' + pct + '%</div>' +
      '<p class="verdict">' + state.correct + ' of ' + total + ' correct. ' + esc(verdict) + '</p>' +
      '<div class="btn-row" style="justify-content:center">' +
      '<button class="btn" id="againBtn">Try again</button>' +
      '<a class="btn secondary" href="study-plan.html">Back to the study plan</a>' +
      '</div></div>';

    document.getElementById('againBtn').addEventListener('click', function () { start(state.domain); });
  }

  /* domain filter pills */
  document.querySelectorAll('.pill-toggle[data-category]').forEach(function (pill) {
    pill.addEventListener('click', function () {
      document.querySelectorAll('.pill-toggle[data-category]').forEach(function (p) {
        p.setAttribute('aria-pressed', String(p === pill));
      });
      start(pill.dataset.category);
    });
  });

  start('all');
})();
