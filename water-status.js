/* ==========================================================
   SAVE KEARNY AZ — SHARED WATER STATUS (Nov 2026)
   One file, every page. Adds the "rain update" bar to the top
   of each page and shows the latest San Carlos Reservoir reading
   from USGS gage 09469000, with the time of that reading.
   To hide the bar on a page: <script src="water-status.js" data-banner="off">
   If USGS can't be reached, the last posted reading below is shown,
   still labeled with its own date and time.
   ========================================================== */
(function () {
  var FALLBACK_AF = 103700;                      // USGS gage 09469000
  var FALLBACK_LABEL = 'Nov 3, 1:30 pm';         // time of that reading (MST)
  var MAY_AF = 389;                              // NASA Earth Observatory, May 22, 2026
  var OCT17_AF = 38540;                          // USGS, Oct 17, 2026
  var SOURCES = [
    { // Save Kearny AZ Cloudflare Worker (reads USGS on Cloudflare's side)
      url: '/api/reservoir',
      read: function (d) { return d && d.af >= 0 ? { af: d.af, time: d.time } : null; }
    },
    { // USGS Water Data API (current)
      url: 'https://api.waterdata.usgs.gov/ogcapi/v0/collections/latest-continuous/items?f=json&monitoring_location_id=USGS-09469000&parameter_code=00054',
      read: function (d) {
        var f = d && d.features && d.features[0] && d.features[0].properties;
        return f ? { af: parseFloat(f.value), time: f.time } : null;
      }
    },
    { // USGS Instantaneous Values service (legacy)
      url: 'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=09469000&parameterCd=00054&siteStatus=all',
      read: function (d) {
        var v = d.value.timeSeries[0].values[0].value;
        var last = v[v.length - 1];
        return { af: parseFloat(last.value), time: last.dateTime };
      }
    }
  ];

  var me = document.currentScript;
  var showBanner = !(me && me.getAttribute('data-banner') === 'off');

  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function label(t) {
    var d = new Date(t);
    if (isNaN(d)) return FALLBACK_LABEL;
    var day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Phoenix' });
    var tm = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Phoenix' }).replace(' AM', ' am').replace(' PM', ' pm');
    return day + ', ' + tm;
  }

  function addBanner() {
    if (!showBanner || document.getElementById('skWaterStatus')) return;
    var css = document.createElement('style');
    css.textContent =
      '#skWaterStatus{background:linear-gradient(90deg,#0e4d6b,#1a6b8a,#0e4d6b);color:#fff;font-family:"Lato","Helvetica Neue",sans-serif;font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;text-align:center;padding:9px 16px;line-height:1.5;position:relative;z-index:100}' +
      '#skWaterStatus a{color:#F5E6B8;text-decoration:underline;text-underline-offset:3px;white-space:nowrap}' +
      '#skWaterStatus .sk-sep{opacity:.6;margin:0 8px}' +
      '@media(max-width:600px){#skWaterStatus{font-size:.68rem;letter-spacing:.03em}#skWaterStatus .sk-hide-sm{display:none}}';
    document.head.appendChild(css);
    var bar = document.createElement('div');
    bar.id = 'skWaterStatus';
    bar.setAttribute('role', 'status');
    bar.innerHTML =
      '&#127783;&#65039; We give thanks for the rain <span class="sk-sep">|</span>' +
      'San Carlos Reservoir: <span class="sk-live-af">' + fmt(FALLBACK_AF) + '</span> acre-feet' +
      '<span class="sk-live-date"> (USGS, ' + FALLBACK_LABEL + ')</span>' +
      '<span class="sk-hide-sm"> — up from ' + MAY_AF + ' on May 22</span> <span class="sk-sep">|</span>' +
      'The rain buys time, not security <span class="sk-sep">|</span>' +
      '<a href="situation.html">Latest update &#8594;</a>';
    document.body.insertBefore(bar, document.body.firstChild);
  }

  var shownMs = 0;
  function update(af, when, ms) {
    if (ms && ms <= shownMs) return;   // keep the newest reading everywhere on the page
    if (ms) shownMs = ms;
    var txt = fmt(af);
    if (window.skCapacity) window.skCapacity(af);
    document.querySelectorAll('.sk-live-af, .sk-live-ticker').forEach(function (el) { el.textContent = txt; });
    document.querySelectorAll('.sk-live-date').forEach(function (el) {
      var lead = el.textContent.charAt(0) === ' ' ? ' ' : '';
      el.textContent = lead + '(USGS, ' + when + ')';
    });
    var maxAF = Math.max(af, OCT17_AF);
    document.querySelectorAll('.btr-mid').forEach(function (el) { el.style.width = (OCT17_AF / maxAF * 100) + '%'; });
    document.querySelectorAll('.sk-live-bar').forEach(function (el) { el.style.width = (af / maxAF * 100) + '%'; });
  }

  function tryNext(i) {
    if (i >= SOURCES.length || !window.fetch) return;
    var src = SOURCES[i];
    fetch(src.url).then(function (r) { if (!r.ok) throw r.status; return r.json(); })
      .then(function (d) {
        var got = src.read(d);
        if (!got || !(got.af >= 0)) throw 'no value';
        update(got.af, label(got.time), Date.parse(got.time));
      })
      .catch(function () { tryNext(i + 1); });
  }

  window.skWaterUpdate = function (af, time) { update(af, label(time), Date.parse(time)); };
  function start() { addBanner(); tryNext(0); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

/* ==========================================================
   LIVE RESERVOIR TRACKER — only runs on pages with #skTracker.
   Data: /api/reservoir/history (Cloudflare Worker, USGS 09469000).
   The section stays hidden if the data can't be loaded.
   ========================================================== */
(function () {
  var GAL_PER_AF = 325851;
  var NS = 'http://www.w3.org/2000/svg';
  var LINE = '#2f9fd6';

  function $(id) { return document.getElementById(id); }
  function n(x) { return Math.round(x).toLocaleString('en-US'); }
  function signed(x) { return (x > 0 ? '+' : x < 0 ? '−' : '') + n(Math.abs(x)); }
  function gallons(af) {
    var g = Math.abs(af) * GAL_PER_AF;
    if (g >= 1e9) return (g / 1e9).toFixed(2) + ' billion';
    if (g >= 1e6) return (g / 1e6).toFixed(1) + ' million';
    return n(g);
  }
  function word(af) { return af < 0 ? 'lost' : 'added'; }
  function fmtDay(t) { return new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Phoenix' }); }
  function fmtWhen(t) {
    var d = new Date(t);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Phoenix' }) + ', ' +
      d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Phoenix' }).replace(' AM', ' am').replace(' PM', ' pm');
  }
  function set(id, txt) { var el = $(id); if (el) el.textContent = txt; }

  var SPILLWAY_AF = 912400; // capacity at spillway crest, El. 2,511 ft (ASDSO / dam safety review)
  function capacity(af) {
    var pct = af / SPILLWAY_AF * 100;
    set('trkCap', pct.toFixed(1) + '%');
    var bar = $('trkCapBar'); if (bar) bar.style.width = Math.min(pct, 100).toFixed(1) + '%';
    var room = SPILLWAY_AF - af;
    set('trkCapRoom', room > 0
      ? 'About ' + n(Math.round(room / 100) * 100) + ' more acre-feet before the spillways come into play. The last time they were needed was 1993.'
      : 'At or above the spillway crest. Follow official dam and National Weather Service updates.');
  }
  window.skCapacity = capacity;
  function records(r) {
    var box = $('trkRecords'); if (!box || !r || !r.gain) return;
    set('trkRecGain', signed(r.gain.af) + ' AF');
    set('trkRecGainS', '\u2248 ' + gallons(r.gain.af) + ' gallons ' + word(r.gain.af) + ' in the 24 hours ending ' + fmtWhen(r.gain.to));
    if (r.loss && r.loss.af < 0) {
      set('trkRecLoss', signed(r.loss.af) + ' AF');
      set('trkRecLossS', '\u2248 ' + gallons(r.loss.af) + ' gallons released or lost in the 24 hours ending ' + fmtWhen(r.loss.to));
    } else {
      set('trkRecLoss', 'None yet');
      set('trkRecLossS', 'The lake hasn\u2019t had a net 24-hour loss since tracking began.');
    }
    box.hidden = false;
  }
  function tiles(h) {
    records(h.records);
    var c = h.change;
    capacity(h.latest.af);
    if (window.skWaterUpdate) window.skWaterUpdate(h.latest.af, h.latest.time);
    set('trkLatest', n(h.latest.af) + ' acre-feet (' + fmtWhen(h.latest.time) + ')');
    if (c.h24) { set('trk24', signed(c.h24.af) + ' AF'); set('trk24s', '≈ ' + gallons(c.h24.af) + ' gallons ' + word(c.h24.af)); }
    else set('trk24s', 'Not enough data yet');
    [['d7', 'trk7', 7], ['d30', 'trk30', 30]].forEach(function (w) {
      var x = c[w[0]];
      if (!x) { set(w[1] + 's', 'Not enough data yet'); return; }
      set(w[1], signed(x.af) + ' AF');
      set(w[1] + 's', 'Avg ≈ ' + gallons(x.af / (x.hours / 24)) + ' gallons ' + word(x.af) + ' per day');
    });
    if (c.h24 && c.h24.hours > 0) {
      var perHr = c.h24.af / c.h24.hours;
      set('trkRate', gallons(perHr) + ' gal/hr');
      set('trkRates', (perHr < 0 ? 'Draining' : 'Filling') + ' — average over the last 24 hours (' + signed(perHr) + ' AF/hr)');
    }
  }

  function table(pts) {
    var body = $('trkRows'); if (!body) return;
    var byDay = {}, order = [];
    pts.forEach(function (p) { var k = fmtDay(p.t); if (!(k in byDay)) order.push(k); byDay[k] = p.af; });
    while (body.firstChild) body.removeChild(body.firstChild);
    var prev = null;
    order.forEach(function (k) {
      var tr = document.createElement('tr');
      [k, n(byDay[k]), prev === null ? '—' : signed(byDay[k] - prev)].forEach(function (v) {
        var td = document.createElement('td'); td.textContent = v; tr.appendChild(td);
      });
      body.insertBefore(tr, body.firstChild);  // newest first
      prev = byDay[k];
    });
  }

  function niceStep(range) {
    var raw = range / 4, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var f = raw / mag; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
  }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e); return e;
  }

  function chart(all, days) {
    var box = $('trkChart'), tip = $('trkTip'); if (!box) return;
    var end = all[all.length - 1].t;
    var pts = all.filter(function (p) { return p.t >= end - days * 864e5; });
    if (pts.length < 2) pts = all;
    var W = Math.max(300, Math.round(box.clientWidth || 800)), H = W < 560 ? 230 : 300, L = W < 560 ? 44 : 64, R = 16, T = 14, B = 34;
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    var lo = Math.min.apply(null, pts.map(function (p) { return p.af; }));
    var hi = Math.max.apply(null, pts.map(function (p) { return p.af; }));
    var step = niceStep(Math.max(hi - lo, 1));
    var y0 = Math.max(0, Math.floor(lo / step) * step), y1 = Math.ceil(hi / step) * step;
    if (y1 === y0) y1 = y0 + step;
    function X(t) { return L + (t - t0) / Math.max(t1 - t0, 1) * (W - L - R); }
    function Y(v) { return T + (1 - (v - y0) / (y1 - y0)) * (H - T - B); }

    while (box.firstChild) box.removeChild(box.firstChild);
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': 'San Carlos Reservoir storage, last ' + days + ' days' }, box);
    for (var v = y0; v <= y1 + 1e-9; v += step) {
      el('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), stroke: 'rgba(255,255,255,0.08)', 'stroke-width': 1 }, svg);
      var lab = el('text', { x: L - 8, y: Y(v) + 4, 'text-anchor': 'end', fill: 'rgba(255,255,255,0.6)', 'font-size': 12, 'font-family': 'Lato, sans-serif' }, svg);
      lab.textContent = v >= 1000 ? Math.round(v / 1000) + 'k' : n(v);
    }
    var ticks = W < 560 ? 3 : (days <= 7 ? 7 : 6);
    for (var i = 0; i <= ticks; i++) {
      var tt = t0 + (t1 - t0) * i / ticks;
      var xl = el('text', { x: X(tt), y: H - 10, 'text-anchor': i === 0 ? 'start' : i === ticks ? 'end' : 'middle', fill: 'rgba(255,255,255,0.6)', 'font-size': 12, 'font-family': 'Lato, sans-serif' }, svg);
      xl.textContent = fmtDay(tt);
    }
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(p.t).toFixed(1) + ' ' + Y(p.af).toFixed(1); }).join(' ');
    el('path', { d: d + ' L' + X(t1).toFixed(1) + ' ' + Y(y0) + ' L' + X(t0).toFixed(1) + ' ' + Y(y0) + ' Z', fill: 'rgba(47,159,214,0.16)' }, svg);
    el('path', { d: d, fill: 'none', stroke: LINE, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    var last = pts[pts.length - 1];
    el('circle', { cx: X(last.t), cy: Y(last.af), r: 5, fill: LINE, stroke: '#0c2233', 'stroke-width': 2 }, svg);

    var cross = el('line', { y1: T, y2: H - B, stroke: 'rgba(255,255,255,0.35)', 'stroke-width': 1, visibility: 'hidden' }, svg);
    var dot = el('circle', { r: 5, fill: LINE, stroke: '#0c2233', 'stroke-width': 2, visibility: 'hidden' }, svg);
    var hit = el('rect', { x: L, y: T, width: W - L - R, height: H - T - B, fill: 'transparent' }, svg);
    function show(evt) {
      var r = svg.getBoundingClientRect();
      var sx = (evt.clientX - r.left) / r.width * W;
      var best = pts[0], bd = Infinity;
      pts.forEach(function (p) { var dd = Math.abs(X(p.t) - sx); if (dd < bd) { bd = dd; best = p; } });
      var px = X(best.t), py = Y(best.af);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('visibility', 'visible');
      dot.setAttribute('cx', px); dot.setAttribute('cy', py); dot.setAttribute('visibility', 'visible');
      tip.firstChild.textContent = n(best.af) + ' acre-feet';
      tip.lastChild.textContent = fmtWhen(best.t);
      tip.hidden = false;
      var wrap = box.getBoundingClientRect();
      tip.style.left = Math.min(Math.max(px / W * r.width, 70), r.width - 70) + 'px';
      tip.style.top = (py / H * r.height + (r.top - wrap.top) + box.offsetTop - 10) + 'px';
    }
    function hide() { cross.setAttribute('visibility', 'hidden'); dot.setAttribute('visibility', 'hidden'); tip.hidden = true; }
    hit.addEventListener('pointermove', show);
    hit.addEventListener('pointerdown', show);
    hit.addEventListener('pointerleave', hide);
  }

  function start() {
    var root = $('skTracker'); if (!root || !window.fetch) return;
    fetch('/api/reservoir/history').then(function (r) { if (!r.ok) throw r.status; return r.json(); }).then(function (h) {
      if (!h || !h.series || h.series.length < 2) return;
      var pts = h.series.map(function (s) { return { t: Date.parse(s[0]), af: s[1] }; }).filter(function (p) { return isFinite(p.t); });
      tiles(h); table(pts);
      var days = 30;
      var btns = root.querySelectorAll('.trk-range button');
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          days = +b.getAttribute('data-days');
          btns.forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
          chart(pts, days);
        });
      });
      root.hidden = false;
      chart(pts, days);
      var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { chart(pts, days); }, 200); });
    }).catch(function () { /* leave the tracker hidden */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
