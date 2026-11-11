/* A Short History of the Brazilian Electricity Market and the Loss of Flexibility: reading interface. */

/* ===================================================================== search engine
   No DOM access here, so the same code runs in the page and in a plain JS shell. */
var BookSearch = (function () {
  'use strict';

  var STOP = {
    en: 'a an and are as at be been but by for from had has have in into is it its of on or our than that the their there these they this those to was we were which while who will with would not also more such can may',
    pt: 'a o as os de da do das dos e em no na nos nas num numa um uma uns umas para por pelo pela pelos pelas com que se ao aos à às é ou como mas sua seu suas seus ser foi são entre sem sobre isso este esta esse essa estes estas esses essas já também lhe lhes nem muito há quando onde ele ela eles elas',
    es: 'a el la los las de del y e en un una unos unas para por con que se al lo es o u como pero su sus ser fue son entre sin sobre este esta ese esa estos estas esos esas ya también le les ni muy hay cuando donde él ella ellos ellas',
    zh: ''
  };
  var STOPSET = {};
  Object.keys(STOP).forEach(function (l) {
    var s = Object.create(null);
    STOP[l].split(' ').forEach(function (w) { if (w) s[fold(w)] = 1; });
    STOPSET[l] = s;
  });

  /* lowercase, no diacritics, unified quotes and dashes, compatibility forms */
  function fold(s) {
    return String(s).normalize('NFKC').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
      .replace(/[‘’‚‛′´`]/g, "'")
      .replace(/[“”„«»「」]/g, '"')
      .replace(/[‐-―−]/g, '-');
  }

  var IRREG = { en: { crises: 'crisis', analyses: 'analysis', data: 'data', news: 'news', gas: 'gas', series: 'series' }, pt: {}, es: {} };

  /* light plural folding; applied identically to the text and to the query */
  function stem(w, lang) {
    var n = w.length;
    if (n < 4 || /\d/.test(w)) return w;
    if (lang === 'en') {
      if (IRREG.en[w]) return IRREG.en[w];
      if (/ies$/.test(w) && n > 4) return w.slice(0, -3) + 'y';
      if (/(ss|us|is)$/.test(w)) return w;
      if (/(sses|xes|ches|shes|zes)$/.test(w)) return w.slice(0, -2);
      if (/s$/.test(w)) return w.slice(0, -1);
      return w;
    }
    if (lang === 'pt') {
      if (/oes$/.test(w) || /aes$/.test(w)) return w.slice(0, -3) + 'ao';
      if (n > 4 && /ais$/.test(w)) return w.slice(0, -3) + 'al';
      if (n > 4 && /eis$/.test(w)) return w.slice(0, -3) + 'el';
      if (n > 4 && /ois$/.test(w)) return w.slice(0, -3) + 'ol';
      if (n > 4 && /uis$/.test(w)) return w.slice(0, -3) + 'ul';
      if (/ns$/.test(w)) return w.slice(0, -2) + 'm';
      if (/(r|z)es$/.test(w)) return w.slice(0, -2);
      if (/ss$/.test(w)) return w;
      if (/s$/.test(w)) return w.slice(0, -1);
      return w;
    }
    if (lang === 'es') {
      if (/ces$/.test(w)) return w.slice(0, -3) + 'z';
      if (/[rlndj]es$/.test(w)) return w.slice(0, -2);
      if (/ss$/.test(w)) return w;
      if (/s$/.test(w)) return w.slice(0, -1);
      return w;
    }
    return w;
  }

  var RE_TOKEN = /(\p{Script=Han}+)|((?:(?!\p{Script=Han})[\p{L}\p{N}\p{M}])+)/gu;

  /* tokens with offsets into the original text: {t: term, s: start, e: end, p: position, u: 1|2 for Han n-grams} */
  function tokenize(text, lang, keepStop) {
    var out = [], pos = 0, m, stop = STOPSET[lang] || {};
    RE_TOKEN.lastIndex = 0;
    while ((m = RE_TOKEN.exec(text))) {
      if (m[1]) {
        var chars = Array.from(m[1]), off = m.index, offs = [], i;
        for (i = 0; i < chars.length; i++) { offs.push(off); off += chars[i].length; }
        for (i = 0; i < chars.length; i++) {
          out.push({ t: chars[i], s: offs[i], e: offs[i] + chars[i].length, p: pos + i, u: 1 });
          if (i + 1 < chars.length) out.push({ t: chars[i] + chars[i + 1], s: offs[i], e: offs[i + 1] + chars[i + 1].length, p: pos + i, u: 2 });
        }
        pos += chars.length;
      } else {
        var w = fold(m[2]);
        if (w.length === 1 && !/\d/.test(w)) continue;
        if (!keepStop && stop[w]) continue;
        out.push({ t: stem(w, lang), w: w, s: m.index, e: m.index + m[2].length, p: pos });
        pos++;
      }
    }
    return out;
  }

  /* query tokens: for Han runs keep bigrams only, unless the run is a single character */
  function queryTokens(q, lang) {
    var toks = tokenize(q, lang, false);
    if (!toks.length) toks = tokenize(q, lang, true);
    var hasBigram = {};
    toks.forEach(function (t) { if (t.u === 2) { hasBigram[t.p] = 1; hasBigram[t.p + 1] = 1; } });
    return toks.filter(function (t) { return !(t.u === 1 && hasBigram[t.p]); });
  }

  /* optimal string alignment distance (Damerau-Levenshtein with adjacent transpositions), bounded */
  function osa(a, b, max) {
    var la = a.length, lb = b.length;
    if (Math.abs(la - lb) > max) return max + 1;
    var p2 = new Array(lb + 1), p1 = new Array(lb + 1), c = new Array(lb + 1), i, j, tmp;
    for (j = 0; j <= lb; j++) p1[j] = j;
    for (i = 1; i <= la; i++) {
      c[0] = i;
      var rowMin = i;
      for (j = 1; j <= lb; j++) {
        var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
        var v = Math.min(p1[j] + 1, c[j - 1] + 1, p1[j - 1] + cost);
        if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) v = Math.min(v, p2[j - 2] + 1);
        c[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > max) return max + 1;
      tmp = p2; p2 = p1; p1 = c; c = tmp;
    }
    return p1[lb];
  }

  var BOOST = { t: 3.2, s: 2.0, a: 2.0, i: 1.4, b: 1.0, f: 1.0, n: 0.8, g: 0.5 };
  var K1 = 1.2, B = 0.6;

  function Index(data) {
    var lang = this.lang = data.lang;
    this.docs = data.docs;
    this.sec = data.sec;
    var post = this.post = Object.create(null);
    var lens = this.lens = new Array(data.docs.length);
    var total = 0;
    var firstAbstract = this.firstAbstract = Object.create(null);
    var order = this.order = Object.create(null);
    for (var i = 0; i < data.docs.length; i++) {
      var d = data.docs[i];
      order[d[0]] = i;
      if (d[2] === 'a' && firstAbstract[d[1]] === undefined) firstAbstract[d[1]] = i;
      var toks = tokenize(d[3], lang, false);
      lens[i] = toks.length || 1;
      total += lens[i];
      var local = Object.create(null);
      for (var k = 0; k < toks.length; k++) {
        var t = toks[k].t;
        (local[t] || (local[t] = [])).push(toks[k].p);
      }
      for (var term in local) (post[term] || (post[term] = [])).push(i, local[term]);
    }
    this.N = data.docs.length;
    this.avgdl = total / Math.max(1, this.N);
    this.vocab = Object.keys(post).sort();
    // synonym groups, each member tokenized like a query
    this.syn = (data.syn || []).map(function (g) {
      return { w: g.w, whole: !!g.whole, m: g.p.map(function (p) { return queryTokens(p, lang).map(function (t) { return t.t; }); }).filter(function (m) { return m.length; }) };
    });
  }

  Index.prototype.df = function (term) { var p = this.post[term]; return p ? p.length / 2 : 0; };
  Index.prototype.idf = function (term) { var df = this.df(term); return Math.log(1 + (this.N - df + 0.5) / (df + 0.5)); };

  Index.prototype.prefixTerms = function (pre, limit) {
    var v = this.vocab, lo = 0, hi = v.length;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (v[mid] < pre) lo = mid + 1; else hi = mid; }
    var out = [];
    for (var i = lo; i < v.length && v[i].lastIndexOf(pre, 0) === 0; i++) if (v[i] !== pre) out.push(v[i]);
    if (out.length > limit) {
      var self = this;
      out.sort(function (a, b) { return self.df(b) - self.df(a); });
      out = out.slice(0, limit);
    }
    return out;
  };

  /* candidate index terms for one query token: exact, prefix, then typo-tolerant */
  Index.prototype.expand = function (tok, isLast, exactOnly) {
    var t = tok.t, cands = Object.create(null), any = false;
    function add(term, w) { if (!(term in cands) || cands[term] < w) cands[term] = w; any = true; }
    if (this.post[t]) add(t, 1);
    if (tok.w && tok.w !== t && this.post[tok.w]) add(tok.w, 1);
    if (tok.u || exactOnly) return cands;
    var minPre = isLast ? 2 : 3;
    if (t.length >= minPre && !/^\d+$/.test(t)) {
      // a complete word that is not the one being typed only weakly pulls in longer words
      var damp = (this.post[t] && !isLast) ? 0.5 : 1;
      var pre = this.prefixTerms(t, 40);
      for (var i = 0; i < pre.length; i++) add(pre[i], damp * (0.62 + 0.3 * (t.length / pre[i].length)));
    }
    if (!this.post[t] && t.length >= 4 && !/\d/.test(t)) {
      var maxd = t.length >= 8 ? 2 : 1, v = this.vocab, near = [], far = [];
      for (var j = 0; j < v.length; j++) {
        var cand = v[j];
        if (Math.abs(cand.length - t.length) > maxd || cand.charCodeAt(0) > 0x2e80) continue;
        var d = osa(t, cand, maxd);
        if (d === 1) near.push(cand); else if (d === 2) far.push(cand);
      }
      // distance 2 only when nothing is one edit away
      near.forEach(function (c) { add(c, 0.6); });
      if (!near.length) far.forEach(function (c) { add(c, 0.42); });
    }
    return cands;
  };

  function minSpan(lists) {
    // smallest window [min, max] that contains one position from every list
    var ev = [];
    lists.forEach(function (l, k) { l.forEach(function (p) { ev.push([p, k]); }); });
    ev.sort(function (a, b) { return a[0] - b[0]; });
    var need = lists.length, have = 0, cnt = new Array(need).fill(0), best = Infinity, lo = 0;
    for (var hi = 0; hi < ev.length; hi++) {
      if (cnt[ev[hi][1]]++ === 0) have++;
      while (have === need) {
        best = Math.min(best, ev[hi][0] - ev[lo][0]);
        if (--cnt[ev[lo][1]] === 0) have--;
        lo++;
      }
    }
    return best;
  }

  function sameSeq(a, b, i) {
    for (var k = 0; k < b.length; k++) if (a[i + k] !== b[k]) return false;
    return true;
  }

  Index.prototype.variants = function (toks) {
    var terms = toks.map(function (t) { return t.t; });
    var out = [{ toks: toks, w: 1, fixed: {} }];
    var seen = {};
    seen[terms.join(' ')] = 1;
    for (var g = 0; g < this.syn.length && out.length < 10; g++) {
      var grp = this.syn[g];
      for (var a = 0; a < grp.m.length; a++) {
        var mem = grp.m[a];
        if (grp.whole && mem.length !== terms.length) continue;
        for (var i = 0; i + mem.length <= terms.length; i++) {
          if (!sameSeq(terms, mem, i)) continue;
          for (var b = 0; b < grp.m.length; b++) {
            if (b === a) continue;
            var repl = grp.m[b].map(function (t) { return { t: t, u: /[㐀-鿿]/.test(t) ? 2 : 0 }; });
            var nt = toks.slice(0, i).concat(repl, toks.slice(i + mem.length));
            var key = nt.map(function (t) { return t.t; }).join(' ');
            if (seen[key]) continue;
            seen[key] = 1;
            var fixed = {};
            for (var k = i; k < i + repl.length; k++) fixed[k] = 1;
            out.push({ toks: nt, w: grp.w, fixed: fixed });
          }
        }
      }
    }
    return out;
  };

  /* search(q, {topics: [...], limit}) -> {results: [...], terms: {term: 1}} */
  Index.prototype.search = function (q, opts) {
    opts = opts || {};
    var lang = this.lang, self = this;
    var toks = queryTokens(q, lang);
    var res = { results: [], terms: Object.create(null), q: q };
    if (!toks.length) return res;
    var typing = !/\s$/.test(q);
    var topics = opts.topics && opts.topics.length ? opts.topics : null;
    var docScore = Object.create(null), docTerms = Object.create(null);

    this.variants(toks).forEach(function (v) {
      var n = v.toks.length;
      var clauses = v.toks.map(function (t, ci) {
        return self.expand(t, typing && ci === n - 1 && !v.fixed[ci], !!v.fixed[ci]);
      });
      var per = Object.create(null); // doc -> {s: [score per clause], pos: [[...]], terms: []}
      clauses.forEach(function (cands, ci) {
        for (var term in cands) {
          var w = cands[term], p = self.post[term], idf = self.idf(term);
          for (var k = 0; k < p.length; k += 2) {
            var d = p[k], positions = p[k + 1], tf = positions.length;
            var sc = w * idf * tf * (K1 + 1) / (tf + K1 * (1 - B + B * self.lens[d] / self.avgdl));
            var e = per[d] || (per[d] = { s: new Array(n).fill(0), pos: new Array(n), terms: [] });
            if (sc > e.s[ci]) e.s[ci] = sc;
            e.pos[ci] = (e.pos[ci] || []).concat(positions);
            e.terms.push(term);
          }
        }
      });
      for (var d in per) {
        var doc = self.docs[d];
        if (topics) {
          var meta = self.sec[doc[1]];
          if (!meta || !meta.tp || !topics.some(function (t) { return meta.tp.indexOf(t) >= 0; })) continue;
        }
        var e = per[d], matched = 0, sum = 0, lists = [];
        for (var c = 0; c < n; c++) if (e.s[c] > 0) { matched++; sum += e.s[c]; lists.push(e.pos[c]); }
        var s = sum;
        if (n > 1) {
          var cov = matched / n;
          s *= cov * cov;
          if (matched === n) {
            s *= 1.35;
            var span = minSpan(lists);
            if (span <= n - 1) s *= 1.7; else if (span <= 2 * n + 2) s *= 1.25;
          }
        }
        s *= (BOOST[doc[2]] || 1) * v.w;
        if (!(d in docScore) || s > docScore[d]) docScore[d] = s;
        var dt = docTerms[d] || (docTerms[d] = Object.create(null));
        e.terms.forEach(function (t) { dt[t] = 1; res.terms[t] = 1; });
      }
    });

    // group by section
    var groups = Object.create(null);
    Object.keys(docScore).forEach(function (d) {
      d = +d;
      var sec = self.docs[d][1];
      var g = groups[sec] || (groups[sec] = { sec: sec, best: -1, bestScore: 0, hits: [], scores: [] });
      g.hits.push(d);
      g.scores.push(docScore[d]);
      if (docScore[d] > g.bestScore) { g.bestScore = docScore[d]; g.best = d; }
    });
    var list = Object.keys(groups).map(function (k) {
      var g = groups[k];
      var others = g.scores.reduce(function (a, b) { return a + b; }, 0) - g.bestScore;
      g.score = g.bestScore + Math.min(0.12 * others, 0.6 * g.bestScore);
      g.hits.sort(function (a, b) { return a - b; });
      // snippet paragraph: the best scoring passage that is not a title
      var snip = -1, snipScore = -1;
      g.hits.forEach(function (d) { var f = self.docs[d][2]; if (f !== 't' && f !== 's' && docScore[d] > snipScore) { snipScore = docScore[d]; snip = d; } });
      if (snip < 0 && self.firstAbstract[k] !== undefined) snip = self.firstAbstract[k];
      g.snippet = snip;
      // land on the passage shown in the snippet; a bare title hit lands on the text itself
      g.target = snip >= 0 ? self.docs[snip][0] : k;
      g.terms = docTerms[g.best];
      g.passages = g.hits.filter(function (d) { var f = self.docs[d][2]; return f !== 't' && f !== 's'; }).map(function (d) { return self.docs[d][0]; });
      return g;
    });
    list.sort(function (a, b) { return b.score - a.score || a.best - b.best; });
    res.results = list.slice(0, opts.limit || 40);
    return res;
  };

  /* plain-text snippet around the first matched term, as HTML with <mark> */
  function escapeHtml(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function matchRanges(text, terms, lang) {
    var toks = tokenize(text, lang, true), ranges = [];
    for (var i = 0; i < toks.length; i++) if (terms[toks[i].t] || (toks[i].w && terms[toks[i].w])) ranges.push([toks[i].s, toks[i].e]);
    ranges.sort(function (a, b) { return a[0] - b[0]; });
    var merged = [];
    ranges.forEach(function (r) {
      var last = merged[merged.length - 1];
      if (last && r[0] <= last[1] + (lang === 'zh' ? 0 : 0)) last[1] = Math.max(last[1], r[1]); else merged.push(r.slice());
    });
    return merged;
  }

  function snippet(text, terms, lang, maxLen) {
    maxLen = maxLen || (lang === 'zh' ? 110 : 220);
    var ranges = matchRanges(text, terms, lang);
    var start = 0;
    if (ranges.length && ranges[0][0] > maxLen * 0.35) {
      start = ranges[0][0] - Math.round(maxLen * 0.3);
      if (lang !== 'zh') { var sp = text.indexOf(' ', start); if (sp > 0 && sp < ranges[0][0]) start = sp + 1; }
    }
    var end = Math.min(text.length, start + maxLen);
    if (end < text.length && lang !== 'zh') { var sp2 = text.lastIndexOf(' ', end); if (sp2 > start + maxLen * 0.6) end = sp2; }
    var out = start > 0 ? '…' : '', pos = start;
    ranges.forEach(function (r) {
      if (r[1] <= start || r[0] >= end) return;
      var a = Math.max(r[0], start), b = Math.min(r[1], end);
      out += escapeHtml(text.slice(pos, a)) + '<mark>' + escapeHtml(text.slice(a, b)) + '</mark>';
      pos = b;
    });
    out += escapeHtml(text.slice(pos, end)) + (end < text.length ? '…' : '');
    return out;
  }

  return { Index: Index, tokenize: tokenize, fold: fold, stem: stem, osa: osa, snippet: snippet, matchRanges: matchRanges, queryTokens: queryTokens };
})();

/* ===================================================================== reading interface */
(function () {
  'use strict';
  if (typeof document === 'undefined') return;
  var doc = document, html = doc.documentElement;
  var dataEl = doc.getElementById('book-data');
  if (!dataEl) return;
  var DATA = JSON.parse(dataEl.textContent);
  var UI = DATA.ui, LANG = DATA.lang;
  var main = doc.getElementById('main');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var wide = window.matchMedia('(min-width: 1100px)');
  var hoverable = window.matchMedia('(hover: hover) and (pointer: fine)');

  function $(sel, root) { return (root || doc).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || doc).querySelectorAll(sel)); }
  function fmt(s, o) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return o[k] !== undefined ? o[k] : m; }); }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };
  function barHeight() { var t = doc.getElementById('topbar'); return t ? t.getBoundingClientRect().height : 56; }

  /* ---------------------------------------------------------- settings */
  var KEY = 'shbem.settings';
  var DEF = { mode: 'full', scale: 1, font: 'serif', width: 'standard', spacing: 'comfortable', theme: 'system', sidebar: 'shown' };
  var S = Object.assign({}, DEF, store.get(KEY, {}));
  if (LANG === 'zh' && S.font === 'legible') S.font = 'sans';
  var PRESETS = [1, 1.125, 1.25, 1.42];

  function applySettings(save) {
    ['mode', 'font', 'width', 'spacing', 'theme'].forEach(function (k) { html.setAttribute('data-' + k, S[k]); });
    html.style.setProperty('--scale', S.scale);
    html.classList.toggle('toc-collapsed', S.sidebar === 'hidden');
    $$('.seg').forEach(function (g) {
      var key = g.getAttribute('data-setting');
      var val = key === 'size' ? String(S.scale) : S[key];
      $$('input', g).forEach(function (inp) {
        inp.checked = key === 'size' ? Math.abs(parseFloat(inp.value) - S.scale) < 0.001 : inp.value === val;
      });
    });
    var out = $('.size-out');
    if (out) out.textContent = Math.round(S.scale * 100) + '%';
    if (save) store.set(KEY, S);
    layoutDirty = true;
  }

  function setSetting(key, value) {
    var anchor = currentAnchor();
    S[key] = value;
    applySettings(true);
    if (key === 'mode' || key === 'scale' || key === 'width' || key === 'spacing' || key === 'font') {
      requestAnimationFrame(function () { if (anchor) restoreAnchor(anchor); });
    }
  }

  doc.addEventListener('change', function (e) {
    var t = e.target;
    if (t.type !== 'radio') return;
    var g = t.closest('.seg');
    if (!g) return;
    var key = g.getAttribute('data-setting');
    if (key === 'size') setSetting('scale', parseFloat(t.value));
    else setSetting(key, t.value);
  });
  $$('.step').forEach(function (b) {
    b.addEventListener('click', function () {
      var v = Math.round((S.scale + 0.0625 * parseFloat(b.getAttribute('data-step'))) * 10000) / 10000;
      setSetting('scale', Math.min(1.9, Math.max(0.8, v)));
    });
  });
  var resetBtn = $('.reset');
  if (resetBtn) resetBtn.addEventListener('click', function () {
    var mode = S.mode;
    S = Object.assign({}, DEF, { mode: mode, sidebar: S.sidebar });
    applySettings(true);
  });

  /* ---------------------------------------------------------- layout model (sections, scroll-spy) */
  var sections = [], layoutDirty = true;
  var secEls = $$('[data-sec]', main);
  function measure() {
    var y = window.pageYOffset;
    sections = [];
    secEls.forEach(function (el) {
      if (el.offsetParent === null && el !== main) return;
      var r = el.getBoundingClientRect();
      sections.push({ id: el.getAttribute('data-sec'), el: el, top: r.top + y, bottom: r.bottom + y });
    });
    layoutDirty = false;
  }
  if (window.ResizeObserver) new ResizeObserver(function () { layoutDirty = true; }).observe(main);
  window.addEventListener('resize', function () { layoutDirty = true; });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { layoutDirty = true; onScroll(); });

  function currentSection() {
    if (layoutDirty) measure();
    var line = window.pageYOffset + barHeight() + window.innerHeight * 0.18, cur = null;
    for (var i = 0; i < sections.length; i++) { if (sections[i].top <= line) cur = sections[i]; else break; }
    return cur;
  }

  /* the block the reader is looking at: used for language switching, position memory and mode changes */
  function currentAnchor() {
    var x = main.getBoundingClientRect().left + main.clientWidth / 2;
    var y = barHeight() + 28;
    for (var k = 0; k < 4; k++) {
      var el = doc.elementFromPoint(x, y + k * 24);
      while (el && el !== main) {
        if (el.id && /-(p|a|fn)\d+$|^(A|C)\d\d$/.test(el.id) && main.contains(el)) {
          return { id: el.id, off: el.getBoundingClientRect().top - barHeight() };
        }
        el = el.parentElement;
      }
    }
    var s = currentSection();
    return s ? { id: s.id, off: s.el.getBoundingClientRect().top - barHeight() } : null;
  }
  function restoreAnchor(a) {
    var el = doc.getElementById(a.id);
    if (!el || el.offsetParent === null) {
      var sec = a.id.replace(/-(p|a|fn)\d+$/, '');
      el = doc.getElementById(sec);
      if (el && el.offsetParent === null) { var c = DATA.art[sec]; el = c ? doc.getElementById(c.c) : null; }
      if (!el) return;
      a = { id: el.id, off: 0 };
    }
    window.scrollTo(0, el.getBoundingClientRect().top + window.pageYOffset - barHeight() - (a.off || 0));
  }

  /* ---------------------------------------------------------- top bar, progress, scroll-spy */
  var progressBar = $('.progress-bar'), ttCurrent = $('.tt-current'), toTop = $('.to-top');
  var tocLinks = {};
  $$('#toc a[href^="#"]').forEach(function (a) { tocLinks[a.getAttribute('href').slice(1)] = a; });
  var lastCurrent = null, ticking = false;

  function onScroll() {
    ticking = false;
    var y = window.pageYOffset;
    html.classList.toggle('scrolled', y > 90);
    if (toTop) toTop.hidden = y < window.innerHeight * 1.6;
    var s = currentSection();
    var id = s ? s.id : null;
    if (s && progressBar) {
      var span = Math.max(1, s.bottom - s.top - window.innerHeight * 0.6);
      var p = Math.min(1, Math.max(0, (y + barHeight() - s.top) / span));
      progressBar.style.transform = 'scaleX(' + p.toFixed(4) + ')';
    }
    if (id !== lastCurrent) {
      lastCurrent = id;
      if (ttCurrent) ttCurrent.textContent = id && DATA.titles[id] ? DATA.titles[id] : '';
      highlightToc(id);
    }
    savePosition();
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  function highlightToc(id) {
    $$('#toc a.is-current').forEach(function (a) { a.classList.remove('is-current'); a.removeAttribute('aria-current'); });
    if (!id) return;
    var a = tocLinks[id];
    var chId = DATA.art[id] ? DATA.art[id].c : (/^C\d\d$/.test(id) ? id : null);
    if (chId) expandTocChapter(chId, true);
    if (a) {
      a.classList.add('is-current');
      a.setAttribute('aria-current', 'location');
      var toc = doc.getElementById('toc');
      if (toc && toc.scrollHeight > toc.clientHeight) {
        var r = a.getBoundingClientRect(), tr = toc.getBoundingClientRect();
        if (r.top < tr.top + 60 || r.bottom > tr.bottom - 60) toc.scrollTop += r.top - tr.top - tr.height / 3;
      }
    }
    if (chId && tocLinks[chId] && chId !== id) tocLinks[chId].classList.add('is-current');
  }

  /* ---------------------------------------------------------- contents: expanders and drawer */
  function expandTocChapter(chId, onlyThis) {
    $$('.toc-ch').forEach(function (li) {
      var btn = $('.toc-exp', li), sub = $('.toc-sub', li);
      if (!btn || !sub) return;
      var open = li.getAttribute('data-ch') === chId ? true : (onlyThis ? false : btn.getAttribute('aria-expanded') === 'true');
      if (onlyThis && li.getAttribute('data-ch') !== chId && li.hasAttribute('data-pinned')) open = true;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      sub.hidden = !open;
    });
  }
  $$('.toc-exp').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var li = btn.closest('.toc-ch'), sub = $('.toc-sub', li);
      var open = btn.getAttribute('aria-expanded') !== 'true';
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      sub.hidden = !open;
      if (open) li.setAttribute('data-pinned', ''); else li.removeAttribute('data-pinned');
    });
  });
  expandTocChapter(null, true);

  var tocBtn = doc.getElementById('toc-button'), toc = doc.getElementById('toc'), scrim = $('.scrim');
  var lastFocus = null;
  function drawerOpen() { return html.classList.contains('toc-open'); }
  function openDrawer() {
    lastFocus = doc.activeElement;
    html.classList.add('toc-open');
    if (scrim) scrim.hidden = false;
    tocBtn.setAttribute('aria-expanded', 'true');
    toc.setAttribute('role', 'dialog');
    toc.setAttribute('aria-modal', 'true');
    setInert(true);
    var cur = $('a.is-current', toc) || $('a', toc);
    setTimeout(function () { (cur || toc).focus(); }, 30);
  }
  function closeDrawer(noFocus) {
    if (!drawerOpen()) return;
    html.classList.remove('toc-open');
    if (scrim) scrim.hidden = true;
    tocBtn.setAttribute('aria-expanded', 'false');
    toc.removeAttribute('role');
    toc.removeAttribute('aria-modal');
    setInert(false);
    if (!noFocus && lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function setInert(on) {
    [main, doc.getElementById('topbar')].forEach(function (el) { if (!el) return; if (on) el.setAttribute('inert', ''); else el.removeAttribute('inert'); });
  }
  if (tocBtn) {
    tocBtn.addEventListener('click', function () {
      if (wide.matches) {
        S.sidebar = S.sidebar === 'hidden' ? 'shown' : 'hidden';
        applySettings(true);
        tocBtn.setAttribute('aria-expanded', S.sidebar === 'hidden' ? 'false' : 'true');
      } else if (drawerOpen()) closeDrawer(); else openDrawer();
    });
    tocBtn.setAttribute('aria-expanded', wide.matches ? (S.sidebar === 'hidden' ? 'false' : 'true') : 'false');
    wide.addEventListener && wide.addEventListener('change', function () {
      closeDrawer(true);
      tocBtn.setAttribute('aria-expanded', wide.matches ? (S.sidebar === 'hidden' ? 'false' : 'true') : 'false');
      layoutDirty = true;
    });
  }
  if (scrim) scrim.addEventListener('click', function () { closeDrawer(); });
  var tocClose = $('.toc-close');
  if (tocClose) tocClose.addEventListener('click', function () { closeDrawer(); });
  if (toc) toc.addEventListener('keydown', function (e) {
    if (!drawerOpen()) return;
    if (e.key === 'Escape') { e.preventDefault(); closeDrawer(); }
    if (e.key === 'Tab') trapTab(e, toc);
  });
  function trapTab(e, root) {
    var f = $$('a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])', root).filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------------------------------------------------------- navigation within the page */
  function articleOf(el) { return el && el.closest ? el.closest('.article') : null; }
  function ensureVisible(el) {
    if (!el) return;
    var art = articleOf(el);
    var mode = S.mode;
    if (art && ((mode === 'abstracts' && el.closest('.article-body')) || mode === 'intros')) reveal(art, true);
    if (mode === 'abstracts' && el.closest('.intro')) setSetting('mode', 'full');
    layoutDirty = true;
  }
  function reveal(art, on) {
    art.classList.toggle('reveal', on);
    var b = $('.expand', art);
    if (b) { b.setAttribute('aria-expanded', on ? 'true' : 'false'); b.textContent = on ? UI.show_abstract_only : UI.read_full; }
    layoutDirty = true;
  }
  function scrollToEl(el, opts) {
    opts = opts || {};
    var top = el.getBoundingClientRect().top + window.pageYOffset - barHeight() - 18;
    var far = Math.abs(top - window.pageYOffset) > window.innerHeight * 3;
    window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion || far || opts.instant ? 'auto' : 'smooth' });
    if (opts.flash) {
      // a whole chapter or article is too large to flash: mark its heading instead
      var fe = el.matches('article, section, header') ? (el.querySelector('h2, h3') || el) : el;
      fe.classList.remove('flash');
      void fe.offsetWidth;
      fe.classList.add('flash');
      setTimeout(function () { fe.classList.remove('flash'); }, 2600);
    }
    if (opts.focus) {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    }
  }
  function resolveId(id) {
    var el = doc.getElementById(id);
    if (el) return el;
    var base = id.replace(/-(p|a|fn|fnref)\d+$/, '');
    el = base !== id ? doc.getElementById(base) : null;
    // a text not yet available in this language: go to its chapter
    if (!el && DATA.chap && DATA.chap[base]) el = doc.getElementById(DATA.chap[base]);
    return el;
  }
  function goTo(id, opts) {
    var el = resolveId(id);
    if (!el) return false;
    closeDrawer(true);
    ensureVisible(el);
    requestAnimationFrame(function () { scrollToEl(el, opts); });
    if (opts && opts.push !== false && location.hash !== '#' + el.id) {
      try { history.pushState(null, '', '#' + el.id); } catch (e) { /* file:// may refuse */ }
    }
    return true;
  }

  doc.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
    if (a.classList.contains('tag') || a.classList.contains('anchor') || a.closest('.fn-ref')) return;
    var id = decodeURIComponent(a.getAttribute('href').slice(1));
    if (!id) return;
    if (id === 'top') { e.preventDefault(); closeDrawer(true); window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }); return; }
    if (resolveId(id)) {
      e.preventDefault();
      goTo(id, { focus: true, flash: a.closest('.fn-pop') !== null || a.classList.contains('fn-back') });
    }
  });
  window.addEventListener('hashchange', function () {
    var id = decodeURIComponent(location.hash.slice(1));
    if (id) goTo(id, { push: false });
  });

  /* expand / collapse one article in the abstracts mode */
  $$('.expand').forEach(function (b) {
    b.addEventListener('click', function () {
      var art = articleOf(b), on = !art.classList.contains('reveal');
      reveal(art, on);
      if (!on && art.getBoundingClientRect().top < 0) scrollToEl(art, { instant: true });
    });
  });

  /* ---------------------------------------------------------- copy a deep link */
  var toastEl = $('.toast'), toastTimer = null;
  function toast(msg, action, onAction, ms) {
    if (!toastEl) return;
    toastEl.textContent = '';
    var span = doc.createElement('span');
    span.textContent = msg;
    toastEl.appendChild(span);
    if (action) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.textContent = action;
      b.addEventListener('click', function () { toastEl.hidden = true; onAction(); });
      toastEl.appendChild(b);
    }
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, ms || 2400);
  }
  function linkFor(id) { return location.href.split('#')[0] + '#' + id; }
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = doc.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      doc.body.appendChild(ta); ta.select();
      try { doc.execCommand('copy') ? resolve() : reject(); } catch (err) { reject(err); }
      doc.body.removeChild(ta);
    });
  }
  function copyLink(id) {
    copy(linkFor(id)).then(function () { toast(UI.link_copied); }, function () { toast(linkFor(id)); });
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* ignore */ }
  }
  $$('.anchor').forEach(function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); copyLink(a.getAttribute('href').slice(1)); });
  });
  var plink = doc.createElement('button');
  plink.type = 'button';
  plink.className = 'plink';
  plink.setAttribute('aria-label', UI.copy_link);
  plink.title = UI.copy_link;
  plink.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-link"></use></svg>';
  plink.tabIndex = -1;
  doc.body.appendChild(plink);
  var plinkTarget = null, plinkHide = null;
  var UNIT = 'p[id], li[id], figure[id], .acronyms > div[id]';
  main.addEventListener('mouseover', function (e) {
    if (!hoverable.matches) return;
    var el = e.target.closest && e.target.closest(UNIT);
    if (!el || !main.contains(el) || el.closest('.cards, .chapter-toc, .topic-articles')) return;
    clearTimeout(plinkHide);
    plinkTarget = el;
    var r = el.getBoundingClientRect();
    var left = r.left - 38;
    if (left < 4) left = r.right + 6;
    plink.style.top = (r.top + window.pageYOffset + 2) + 'px';
    plink.style.left = (left + window.pageXOffset) + 'px';
    plink.classList.add('show');
  });
  main.addEventListener('mouseleave', function () { plinkHide = setTimeout(function () { plink.classList.remove('show'); }, 400); });
  plink.addEventListener('mouseenter', function () { clearTimeout(plinkHide); });
  plink.addEventListener('click', function () { if (plinkTarget) copyLink(plinkTarget.id); });

  /* ---------------------------------------------------------- footnote popovers */
  var pop = null, popRef = null;
  function closePop(focusBack) {
    if (!pop) return;
    pop.remove(); pop = null;
    if (focusBack && popRef) popRef.focus();
    popRef = null;
  }
  doc.addEventListener('click', function (e) {
    var ref = e.target.closest && e.target.closest('.fn-ref a');
    if (ref) {
      e.preventDefault();
      if (pop && popRef === ref) { closePop(true); return; }
      closePop(false);
      var noteId = ref.getAttribute('href').slice(1), note = doc.getElementById(noteId);
      if (!note) return;
      popRef = ref;
      pop = doc.createElement('div');
      pop.className = 'fn-pop';
      pop.setAttribute('role', 'dialog');
      pop.setAttribute('aria-label', ref.getAttribute('aria-label'));
      pop.tabIndex = -1;
      var k = doc.createElement('span');
      k.className = 'label fn-pop-k';
      k.textContent = ref.getAttribute('aria-label');
      pop.appendChild(k);
      var body = $('.fn-text', note).cloneNode(true);
      pop.appendChild(body);
      var go = doc.createElement('a');
      go.className = 'fn-pop-go';
      go.href = '#' + noteId;
      go.textContent = UI.go_to_note;
      pop.appendChild(doc.createElement('br'));
      pop.appendChild(go);
      doc.body.appendChild(pop);
      var r = ref.getBoundingClientRect(), pw = pop.offsetWidth;
      var left = Math.min(Math.max(12, r.left + window.pageXOffset - pw / 2), window.pageXOffset + doc.documentElement.clientWidth - pw - 12);
      pop.style.left = left + 'px';
      pop.style.top = (r.bottom + window.pageYOffset + 8) + 'px';
      pop.focus({ preventScroll: true });
      return;
    }
    if (pop && !pop.contains(e.target)) closePop(false);
  });

  /* ---------------------------------------------------------- language switcher */
  var langMenu = $('.lang-menu'), langBtn = doc.getElementById('lang-button');
  function langOpen(on) {
    langMenu.classList.toggle('open', on);
    langBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) updateLangLinks();
  }
  function updateLangLinks() {
    var a = currentAnchor();
    var id = a ? a.id : '';
    $$('#lang-list a').forEach(function (l) {
      var base = l.getAttribute('href').split('#')[0];
      l.setAttribute('href', id ? base + '#' + id : base);
    });
  }
  if (langBtn) {
    langBtn.addEventListener('click', function (e) { e.stopPropagation(); langOpen(!langMenu.classList.contains('open')); });
    doc.addEventListener('click', function (e) { if (!langMenu.contains(e.target)) langOpen(false); });
    langMenu.addEventListener('keydown', function (e) { if (e.key === 'Escape') { langOpen(false); langBtn.focus(); } });
    $$('#lang-list a').forEach(function (l) { l.addEventListener('pointerdown', updateLangLinks); l.addEventListener('focus', updateLangLinks); });
  }

  /* ---------------------------------------------------------- remembered position */
  var POSKEY = 'shbem.pos.' + LANG, posTimer = null, userScrolled = false;
  function savePosition() {
    clearTimeout(posTimer);
    posTimer = setTimeout(function () {
      if (window.pageYOffset < 200) { store.set(POSKEY, null); return; }
      var a = currentAnchor();
      if (a) store.set(POSKEY, { id: a.id, off: Math.round(a.off) });
    }, 350);
  }
  ['wheel', 'touchmove', 'keydown'].forEach(function (ev) { window.addEventListener(ev, function () { userScrolled = true; }, { passive: true, once: true }); });

  function initialPosition() {
    var hash = decodeURIComponent(location.hash.slice(1));
    if (hash) {
      var el = resolveId(hash);
      if (el) {
        ensureVisible(el);
        var go = function () { if (!userScrolled) scrollToEl(el, { instant: true }); };
        requestAnimationFrame(go);
        if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(go);
      }
      return;
    }
    var pos = store.get(POSKEY, null);
    if (pos && pos.id && doc.getElementById(pos.id)) {
      var again = function () { if (!userScrolled) restoreAnchor(pos); };
      requestAnimationFrame(again);
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(again);
      setTimeout(function () {
        toast(UI.resumed, UI.go_to_start, function () { window.scrollTo({ top: 0, behavior: 'auto' }); store.set(POSKEY, null); }, 6000);
      }, 400);
    }
  }

  /* ---------------------------------------------------------- back to top */
  if (toTop) toTop.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    main.focus({ preventScroll: true });
  });

  /* ---------------------------------------------------------- dialogs */
  function openDialog(dlg) {
    if (!dlg || dlg.open) return;
    lastFocus = doc.activeElement;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  }
  function closeDialog(dlg) {
    if (!dlg || !dlg.open) return;
    if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
  }
  $$('dialog').forEach(function (dlg) {
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closeDialog(dlg); });
    $$('.dlg-close', dlg).forEach(function (b) { b.addEventListener('click', function () { closeDialog(dlg); }); });
    dlg.addEventListener('close', function () { if (lastFocus && lastFocus.focus && doc.contains(lastFocus)) lastFocus.focus({ preventScroll: true }); });
    dlg.addEventListener('keydown', function (e) { if (e.key === 'Tab') trapTab(e, dlg); });
  });
  var settingsDlg = doc.getElementById('settings-dialog');
  var settingsBtn = doc.getElementById('settings-button');
  if (settingsBtn) settingsBtn.addEventListener('click', function () { openDialog(settingsDlg); var c = $('input:checked', settingsDlg) || $('input', settingsDlg); if (c) c.focus(); });

  /* ---------------------------------------------------------- topics: chips and browse list */
  var heroChips = $$('.topics-panel .chip'), browse = doc.getElementById('browse');
  var cards = $$('.cards .card'), cardList = $('.cards');
  var selected = [];
  function renderBrowse() {
    heroChips.forEach(function (c) { c.setAttribute('aria-pressed', selected.indexOf(c.getAttribute('data-topic')) >= 0 ? 'true' : 'false'); });
    if (!browse) return;
    if (!selected.length) { browse.hidden = true; return; }
    var shown = [];
    cards.forEach(function (c) {
      var tp = c.getAttribute('data-topics').split(' ');
      var k = selected.filter(function (t) { return tp.indexOf(t) >= 0; }).length;
      c.hidden = k === 0;
      if (k) shown.push([k, c]);
    });
    shown.sort(function (a, b) { return b[0] - a[0]; }).forEach(function (p) { cardList.appendChild(p[1]); });
    var n = shown.length;
    $('.browse-status', browse).textContent = n === 1 ? UI.one_article : fmt(UI.n_articles, { n: n });
    browse.hidden = false;
  }
  heroChips.forEach(function (c) {
    c.addEventListener('click', function () {
      var t = c.getAttribute('data-topic'), i = selected.indexOf(t);
      if (i >= 0) selected.splice(i, 1); else selected.push(t);
      cards.forEach(function (card) { cardList.appendChild(card); });
      renderBrowse();
    });
  });
  var clearBtn = $('.clear-topics');
  if (clearBtn) clearBtn.addEventListener('click', function () { selected = []; renderBrowse(); });
  var searchInBtn = $('.search-topics');
  if (searchInBtn) searchInBtn.addEventListener('click', function () { openSearch('', selected.slice()); });
  $$('.tag').forEach(function (t) {
    t.addEventListener('click', function (e) { e.preventDefault(); openSearch('', [t.getAttribute('data-topic')]); });
  });

  /* ---------------------------------------------------------- search palette */
  var searchDlg = doc.getElementById('search-dialog'), input = doc.getElementById('search-input');
  var resultsEl = doc.getElementById('search-results'), statusEl = doc.getElementById('search-status');
  var dlgChips = $$('.search-topics .chip', searchDlg || doc);
  var index = null, loading = false, waiters = [], active = -1, lastRes = null, sTopics = [], debounce = null;

  function loadIndex(cb) {
    if (index) { cb(); return; }
    waiters.push(cb);
    if (loading) return;
    loading = true;
    function build() {
      var data = window.BOOK_INDEX && window.BOOK_INDEX[LANG];
      if (!data) return false;
      index = new BookSearch.Index(data);
      loading = false;
      var w = waiters;
      waiters = [];
      w.forEach(function (f) { f(); });
      return true;
    }
    if (build()) return;
    var s = doc.createElement('script');
    s.src = DATA.index;
    s.async = true;
    s.onload = function () { build(); };
    s.onerror = function () { loading = false; statusEl.textContent = ''; };
    doc.head.appendChild(s);
  }
  function openSearch(q, topics) {
    if (!searchDlg) return;
    closeDrawer(true);
    if (typeof q === 'string') input.value = q;
    if (topics) sTopics = topics;
    syncDlgChips();
    openDialog(searchDlg);
    input.focus();
    input.select();
    if (!index) statusEl.textContent = UI.search_loading;
    loadIndex(run);
    run();
  }
  function syncDlgChips() { dlgChips.forEach(function (c) { c.setAttribute('aria-pressed', sTopics.indexOf(c.getAttribute('data-topic')) >= 0 ? 'true' : 'false'); }); }
  dlgChips.forEach(function (c) {
    c.addEventListener('click', function () {
      var t = c.getAttribute('data-topic'), i = sTopics.indexOf(t);
      if (i >= 0) sTopics.splice(i, 1); else sTopics.push(t);
      syncDlgChips();
      run();
      input.focus();
    });
  });
  $$('.sugg', searchDlg || doc).forEach(function (b) { b.addEventListener('click', function () { input.value = b.textContent; run(); input.focus(); }); });
  var searchBtn = doc.getElementById('search-button');
  if (searchBtn) searchBtn.addEventListener('click', function () { openSearch(); });

  function metaLine(sec, id) {
    var m = index ? index.sec[sec] : null;
    if (!m) return '';
    if (m.k === 'a') return [fmt(UI.chapter_n, { n: m.n }), m.d, m.o].filter(Boolean).join(' · ');
    if (m.k === 'c') return fmt(UI.chapter_n, { n: m.n }) + ' · ' + UI.introduction;
    return '';
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function run() {
    clearTimeout(debounce);
    debounce = setTimeout(doRun, 70);
  }
  function doRun() {
    if (!searchDlg || !searchDlg.open) return;
    var q = input.value;
    var hasQ = /\S/.test(q);
    searchDlg.classList.toggle('searching', hasQ || sTopics.length > 0);
    resultsEl.textContent = '';
    active = -1;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    if (!index) { if (hasQ) statusEl.textContent = UI.search_loading; return; }
    var items = [];
    if (hasQ) {
      lastRes = index.search(q, { topics: sTopics, limit: 40 });
      lastRes.results.forEach(function (g) {
        var snipText = g.snippet >= 0 ? index.docs[g.snippet][3] : '';
        var terms = g.terms;
        if (g.snippet >= 0) {
          // highlight with every term matched anywhere by the query
          terms = lastRes.terms;
        }
        items.push({
          target: g.target, sec: g.sec,
          title: BookSearch.snippet(index.sec[g.sec] ? index.sec[g.sec].t : g.sec, lastRes.terms, LANG, 400),
          meta: metaLine(g.sec),
          snip: snipText ? BookSearch.snippet(snipText, terms, LANG) : '',
          more: Math.max(0, g.passages.length - 1)
        });
      });
    } else if (sTopics.length) {
      lastRes = null;
      Object.keys(index.sec).forEach(function (sec) {
        var m = index.sec[sec];
        if (m.k !== 'a' || !m.tp) return;
        var k = sTopics.filter(function (t) { return m.tp.indexOf(t) >= 0; }).length;
        if (!k) return;
        var ai = index.firstAbstract[sec];
        items.push({ k: k, target: sec, sec: sec, title: escapeHtml(m.t), meta: metaLine(sec),
          snip: ai !== undefined ? escapeHtml(firstSentence(index.docs[ai][3])) : '', more: 0 });
      });
      items.sort(function (a, b) { return b.k - a.k; });
    } else {
      statusEl.textContent = '';
      return;
    }
    if (!items.length) {
      statusEl.textContent = fmt(UI.no_results, { q: q.trim() });
      return;
    }
    statusEl.textContent = items.length === 1 ? UI.results_one : fmt(UI.results_count, { n: items.length });
    var frag = doc.createDocumentFragment();
    items.forEach(function (it, i) {
      var li = doc.createElement('li');
      li.className = 'result';
      li.id = 'sr-' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.setAttribute('data-target', it.target);
      li.innerHTML = '<span class="r-title">' + it.title + '</span>' +
        (it.meta ? '<span class="r-meta">' + escapeHtml(it.meta) + '</span>' : '') +
        (it.snip ? '<span class="r-snip">' + it.snip + '</span>' : '') +
        (it.more ? '<span class="r-more">' + escapeHtml(it.more === 1 ? UI.more_match : fmt(UI.more_matches, { n: it.more })) + '</span>' : '');
      li.addEventListener('click', function () { choose(i); });
      li.addEventListener('mousemove', function () { if (active !== i) setActive(i, true); });
      frag.appendChild(li);
    });
    resultsEl.appendChild(frag);
    input.setAttribute('aria-expanded', 'true');
    setActive(0, true);
  }
  function firstSentence(t) {
    var m = LANG === 'zh' ? t.match(/^[^。！？]*[。！？]/) : t.match(/^.*?[.!?](?=\s+[A-ZÀ-Ý“"(])/);
    return m ? m[0] : t;
  }
  function setActive(i, noScroll) {
    var items = $$('.result', resultsEl);
    if (!items.length) return;
    i = (i + items.length) % items.length;
    if (items[active]) items[active].setAttribute('aria-selected', 'false');
    active = i;
    items[i].setAttribute('aria-selected', 'true');
    input.setAttribute('aria-activedescendant', items[i].id);
    if (!noScroll) items[i].scrollIntoView({ block: 'nearest' });
  }
  function choose(i) {
    var items = $$('.result', resultsEl);
    var li = items[i];
    if (!li) return;
    var target = li.getAttribute('data-target');
    var res = lastRes;
    closeDialog(searchDlg);
    if (res) startFind(res, target);
    goTo(target, { flash: true, focus: true });
    if (res) setTimeout(function () { markIn(resolveId(target), res.terms); }, 30);
  }
  if (input) {
    input.addEventListener('input', run);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0) choose(active); }
      else if (e.key === 'Home' && e.ctrlKey) { e.preventDefault(); setActive(0); }
    });
  }

  /* ---------------------------------------------------------- matches in the text: highlight and step through */
  var findbar = $('.findbar'), fbCount = $('.fb-count', findbar || doc), matches = [], mi = -1, findTerms = null;
  function clearMarks() {
    $$('mark.hit', main).forEach(function (m) {
      var p = m.parentNode;
      p.replaceChild(doc.createTextNode(m.textContent), m);
      p.normalize();
    });
  }
  function markIn(el, terms) {
    if (!el || !terms) return;
    clearMarks();
    var walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.parentNode.closest('.anchor, .vh, sup, svg') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    var nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (node) {
      var text = node.data, ranges = BookSearch.matchRanges(text, terms, LANG);
      if (!ranges.length) return;
      var frag = doc.createDocumentFragment(), pos = 0;
      ranges.forEach(function (r) {
        if (r[0] > pos) frag.appendChild(doc.createTextNode(text.slice(pos, r[0])));
        var m = doc.createElement('mark');
        m.className = 'hit';
        m.textContent = text.slice(r[0], r[1]);
        frag.appendChild(m);
        pos = r[1];
      });
      if (pos < text.length) frag.appendChild(doc.createTextNode(text.slice(pos)));
      node.parentNode.replaceChild(frag, node);
    });
  }
  function startFind(res, target) {
    var ids = [];
    res.results.forEach(function (g) { g.passages.forEach(function (id) { if (ids.indexOf(id) < 0) ids.push(id); }); });
    ids.sort(function (a, b) { return (index.order[a] || 0) - (index.order[b] || 0); });
    if (!ids.length) { closeFind(); return; }
    matches = ids;
    findTerms = res.terms;
    mi = Math.max(0, ids.indexOf(target));
    if (ids.indexOf(target) < 0) {
      // the target is a title: start at the first passage of that text
      for (var k = 0; k < ids.length; k++) if (ids[k].indexOf(target + '-') === 0) { mi = k; break; }
    }
    updateFind();
    if (findbar) findbar.hidden = false;
  }
  function updateFind() { if (fbCount) fbCount.textContent = fmt(UI.match_of, { i: mi + 1, n: matches.length }); }
  function stepFind(d) {
    if (!matches.length) return;
    mi = (mi + d + matches.length) % matches.length;
    updateFind();
    var id = matches[mi];
    goTo(id, { flash: true, push: false });
    setTimeout(function () { markIn(doc.getElementById(id), findTerms); }, 30);
  }
  function closeFind() { matches = []; mi = -1; if (findbar) findbar.hidden = true; clearMarks(); }
  if (findbar) {
    $('.fb-prev', findbar).addEventListener('click', function () { stepFind(-1); });
    $('.fb-next', findbar).addEventListener('click', function () { stepFind(1); });
    $('.fb-close', findbar).addEventListener('click', closeFind);
    findbar.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeFind();
      if (e.key === 'Enter' && e.target === findbar) stepFind(e.shiftKey ? -1 : 1);
    });
  }

  /* ---------------------------------------------------------- keyboard shortcuts */
  doc.addEventListener('keydown', function (e) {
    var t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (searchDlg && searchDlg.open) closeDialog(searchDlg); else openSearch(); return; }
    if (typing) return;
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); openSearch(); return; }
    if (e.key === 'Escape') {
      if (pop) { closePop(true); return; }
      if (langMenu && langMenu.classList.contains('open')) { langOpen(false); return; }
      if (drawerOpen()) { closeDrawer(); return; }
      if (findbar && !findbar.hidden) { closeFind(); return; }
    }
    if (findbar && !findbar.hidden && (e.key === 'F3' || (e.key === 'g' && (e.metaKey || e.ctrlKey)))) { e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); }
  });

  /* ---------------------------------------------------------- start */
  applySettings(false);
  initialPosition();
  onScroll();
  // prepare the search index while the reader starts reading
  var idle = window.requestIdleCallback || function (f) { return setTimeout(f, 1500); };
  idle(function () { loadIndex(function () {}); });
})();
