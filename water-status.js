/* ==========================================================
   SAVE KEARNY AZ — SHARED WATER STATUS (Nov 2026)
   One file, every page. Adds the "rain update" bar to the top
   of each page and keeps reservoir numbers live from USGS.
   To pause the bar on a page: <script src="water-status.js" data-banner="off">
   Last posted values below are used if USGS can't be reached.
   ========================================================== */
(function () {
  var FALLBACK_AF = 102800;            // USGS gage 09469000, Nov 3, 2026, 10:30 MST
  var FALLBACK_DATE = 'Nov 3';
  var MAY_AF = 389;                    // NASA Earth Observatory, May 22, 2026
  var OCT17_AF = 38540;                // USGS, Oct 17, 2026
  var USGS_URL = 'https://waterservices.usgs.gov/nwis/iv/?format=json&sites=09469000&parameterCd=00054&siteStatus=all';

  var me = document.currentScript;
  var showBanner = !(me && me.getAttribute('data-banner') === 'off');

  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }

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
      '<span class="sk-live-date"> (USGS, ' + FALLBACK_DATE + ')</span>' +
      '<span class="sk-hide-sm"> — up from ' + MAY_AF + ' in May</span> <span class="sk-sep">|</span>' +
      'The rain buys time, not security <span class="sk-sep">|</span>' +
      '<a href="situation.html">Latest update &#8594;</a>';
    document.body.insertBefore(bar, document.body.firstChild);
  }

  function update(af, label) {
    var txt = fmt(af);
    document.querySelectorAll('.sk-live-af, .sk-live-ticker').forEach(function (el) { el.textContent = txt; });
    document.querySelectorAll('.sk-live-date').forEach(function (el) { el.textContent = ' (USGS, ' + label + ')'; });
    var maxAF = Math.max(af, OCT17_AF);
    document.querySelectorAll('.btr-mid').forEach(function (el) { el.style.width = (OCT17_AF / maxAF * 100) + '%'; });
    document.querySelectorAll('.sk-live-bar').forEach(function (el) { el.style.width = (af / maxAF * 100) + '%'; });
  }

  function start() {
    addBanner();
    if (!window.fetch) return;
    fetch(USGS_URL).then(function (r) { return r.json(); }).then(function (d) {
      var vals = d.value.timeSeries[0].values[0].value;
      var last = vals[vals.length - 1];
      var af = parseFloat(last.value);
      if (!(af >= 0)) return;
      var label = new Date(last.dateTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/Phoenix' });
      update(af, label);
    }).catch(function () { /* keep the last posted values */ });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
