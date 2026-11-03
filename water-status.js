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
  var FALLBACK_AF = 102800;                      // USGS gage 09469000
  var FALLBACK_LABEL = 'Nov 3, 10:30 am';        // time of that reading (MST)
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

  function update(af, when) {
    var txt = fmt(af);
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
        update(got.af, label(got.time));
      })
      .catch(function () { tryNext(i + 1); });
  }

  function start() { addBanner(); tryNext(0); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
