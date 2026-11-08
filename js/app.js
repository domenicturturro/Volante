/* =========================================================================
   VOLANTE v2 — APP (request-only)
   Customers don't browse offers: they fill out a request, and the Volante
   team handles lease options on the backend.
   Hash routes:
     #/            home            #/request     stepped request form (gated, see below)
     #/how         home, scrolled  #/dealers     dealership partner page
     #/budget      home, scrolled to the budget gauge
   BUDGET GATE: every request starts at the budget gauge. #/request only opens
   after the visitor sets a budget and presses "Commencer ma demande"
   (state.budgetSet). Any other way in redirects to #/budget, keeping any
   make/model it carried. Old #/offers links also land on #/budget.
   All UI state lives in `state`, so switching language re-renders the
   current page with form values, step and errors intact.
   Form submission: submitForm() — DEMO MODE, nothing leaves the browser.
   ========================================================================= */
(function () {
  'use strict';

  var DATA = window.VOLANTE_DATA;
  var I18N = window.VOLANTE_I18N;
  var app = document.getElementById('app');

  /* Live mode: once js/config.js has the form endpoint, forms are really sent and the demo wording goes away. */
  var ENDPOINT = String((window.VOLANTE_CONFIG || {}).formEndpoint || '').trim();
  var LIVE = /^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(ENDPOINT); // http only allowed for local testing
  if (LIVE && window.VOLANTE_I18N_LIVE) ['fr', 'en'].forEach(function (l) { Object.assign(I18N[l], window.VOLANTE_I18N_LIVE[l]); });

  /* Home budget gauge (monthly, CAD). The top value means "no limit". */
  var B_MIN = 250, B_MAX = 1000, B_STEP = 25;
  /* Request form budget slider */
  var R_MIN = 250, R_MAX = 2000, R_STEP = 25;

  /* ---------- state ---------- */
  function emptyForm(values) { return { values: values || {}, errors: {}, attempted: false, done: false, step: 1, sending: false, sendError: null, startedAt: Date.now() }; }
  function requestDefaults() { return { budget: '550', term: '', km: '', body: '' }; }
  var state = {
    lang: readLang(),
    route: { name: undefined, params: {} },
    navOpen: false,
    dialBudget: 550,
    slide: 0,
    budgetSet: false, // true once the visitor has passed the budget gauge
    forms: { request: emptyForm(requestDefaults()), dealer: emptyForm() }
  };
  /* Theme: dark is always the default (it ignores the device setting). Light is an option the visitor
     picks with the sun button. It lasts while they browse the site; a refresh or new visit is dark again. */
  try { localStorage.removeItem('volante.theme'); } catch (e) {} // forget the choice saved by the earlier version
  function isLight() { return document.documentElement.getAttribute('data-theme') === 'light'; }
  function setTheme(light) {
    if (light) document.documentElement.setAttribute('data-theme', 'light'); else document.documentElement.removeAttribute('data-theme');
    var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', light ? '#f5f6f8' : '#070a11');
  }
  function readLang() { try { var l = localStorage.getItem('volante.lang'); if (l === 'fr' || l === 'en') return l; } catch (e) {} return 'fr'; }
  function saveLang(l) { try { localStorage.setItem('volante.lang', l); } catch (e) {} }

  /* ---------- helpers ---------- */
  function t(key, vars) {
    var s = I18N[state.lang] && I18N[state.lang][key];
    if (s == null) s = I18N.fr[key] != null ? I18N.fr[key] : key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split('{' + k + '}').join(vars[k]); });
    return s;
  }
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function locale() { return state.lang === 'fr' ? 'fr-CA' : 'en-CA'; }
  function money(n) { return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'CAD', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n); }
  function num(n) { return new Intl.NumberFormat(locale()).format(n); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function pct(v, min, max) { return ((v - min) / (max - min) * 100).toFixed(1) + '%'; }
  function budgetLabel(v) { return v >= B_MAX ? t('dial.noLimit') : money(v) + t('freq.short.monthly'); }

  /* ---------- icons ---------- */
  var ICON = {
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    list: '<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M15.5 4.9a3.2 3.2 0 0 1 0 6.2M17.5 14.8c2.1.6 3.5 2.5 3.5 5.2"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    check: '<path d="M4 12.5 9.5 18 20 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'
  };
  function icon(name, cls) { return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[name] + '</svg>'; }

  /* body-type outlines for the request form's chips */
  var BODY = {
    suv: { d: 'M32,106 C30,92 31,78 35,66 C38,56 43,48 52,44 L72,36 C82,33 94,32 110,32 L226,32 C240,32 250,36 258,42 L286,60 C318,63 344,68 358,74 C368,79 372,88 372,100 L370,112 L342,112 A28,28 0 0 0 286,112 L122,112 A28,28 0 0 0 66,112 L38,112 C34,112 32,110 32,106 Z', w: [94, 314], r: 24 },
    truck: { d: 'M24,108 L24,72 L172,72 L176,40 C178,36 182,34 188,34 L254,34 C262,34 268,38 274,46 L292,68 C326,72 352,76 366,82 C374,86 376,94 376,104 L374,114 L344,114 A28,28 0 0 0 288,114 L122,114 A28,28 0 0 0 66,114 L30,114 C26,114 24,112 24,108 Z', w: [94, 316], r: 24 },
    sport: { d: 'M26,108 C25,98 27,90 32,86 L44,82 C60,78 78,74 96,70 L130,48 C140,42 152,40 166,40 L232,40 C248,40 260,44 272,52 L300,70 C330,73 352,78 364,84 C372,88 374,96 374,106 L372,114 L338,114 A25,25 0 0 0 288,114 L118,114 A25,25 0 0 0 68,114 L32,114 C28,114 26,112 26,108 Z', w: [93, 313], r: 21 },
    van: { d: 'M26,110 C24,90 26,66 32,52 C36,42 44,36 56,34 L250,32 C266,32 278,38 288,48 L318,74 C340,78 356,82 366,88 C372,92 374,98 374,106 L372,114 L340,114 A25,25 0 0 0 290,114 L118,114 A25,25 0 0 0 68,114 L32,114 C28,114 26,112 26,110 Z', w: [93, 315], r: 21 }
  };
  function bodyIcon(body) {
    var b = BODY[body] || BODY.suv;
    return '<svg class="body-ic" viewBox="20 28 362 112" aria-hidden="true"><path d="' + b.d + '" fill="none" stroke="currentColor" stroke-width="9" stroke-linejoin="round"/>' +
      '<circle cx="' + b.w[0] + '" cy="114" r="' + (b.r - 2) + '" fill="currentColor"/><circle cx="' + b.w[1] + '" cy="114" r="' + (b.r - 2) + '" fill="currentColor"/></svg>';
  }

  /* ---------- shared pieces ---------- */
  function logo() {
    return '<span class="logo" aria-hidden="true"><svg viewBox="0 0 40 28" class="logo-mark"><path d="M2 3h9l9 15 9-15h9L22 26h-4Z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/><path d="M11 3l9 15" stroke="currentColor" stroke-width="2.4" opacity=".55"/></svg>' +
      '<span class="logo-word">VOL<span class="logo-a">Λ</span>NTE</span></span>';
  }

  function header() {
    var r = state.route.name;
    function link(href, key, active) { return '<a href="' + href + '"' + (active ? ' aria-current="page"' : '') + '>' + esc(t(key)) + '</a>'; }
    return '<a class="skip" href="#main">' + esc(t('skip')) + '</a>' +
      (LIVE ? '' : '<div class="demo-banner" role="note">' + icon('info') + '<span>' + esc(t('demo.banner')) + '</span></div>') +
      '<header class="site-header"><div class="wrap header-in">' +
      '<a href="#/" class="brand" aria-label="' + esc(t('nav.home')) + '">' + logo() + '</a>' +
      '<nav class="main-nav' + (state.navOpen ? ' open' : '') + '" id="main-nav" aria-label="Navigation">' +
      link('#/how', 'nav.how', false) + link('#/budget', 'nav.request', r === 'request' || state.route.params.anchor === 'budget') + link('#/dealers', 'nav.dealers', r === 'dealers') +
      '<a class="btn btn-primary nav-cta-mobile" href="#/budget">' + esc(t('nav.cta')) + icon('arrow') + '</a></nav>' +
      '<div class="header-actions"><div class="lang-switch" role="group" aria-label="' + esc(t('lang.label')) + '">' +
      '<button type="button" id="lang-fr" data-lang="fr" lang="fr" aria-pressed="' + (state.lang === 'fr') + '">FR</button>' +
      '<button type="button" id="lang-en" data-lang="en" lang="en" aria-pressed="' + (state.lang === 'en') + '">EN</button></div>' +
      '<button type="button" class="theme-toggle" id="theme-toggle" aria-label="' + esc(t(isLight() ? 'theme.toDark' : 'theme.toLight')) + '" title="' + esc(t(isLight() ? 'theme.toDark' : 'theme.toLight')) + '">' + icon(isLight() ? 'moon' : 'sun') + '</button>' +
      '<a class="btn btn-primary btn-sm nav-cta" href="#/budget">' + esc(t('nav.cta')) + icon('arrow') + '</a>' +
      '<button type="button" class="nav-toggle" id="nav-toggle" aria-controls="main-nav" aria-expanded="' + state.navOpen + '" aria-label="' + esc(t('nav.menu')) + '"><span></span><span></span><span></span></button>' +
      '</div></div></header>';
  }

  function footer() {
    return '<footer class="site-footer"><div class="wrap">' +
      '<div class="footer-top"><div class="footer-brand"><a href="#/" class="brand" aria-label="' + esc(t('nav.home')) + '">' + logo() + '</a><p>' + esc(t('footer.tag')) + '</p></div>' +
      '<div class="footer-cols"><div><h3>' + esc(t('footer.customers')) + '</h3><ul><li><a href="#/budget">' + esc(t('nav.request')) + '</a></li><li><a href="#/how">' + esc(t('nav.how')) + '</a></li></ul></div>' +
      '<div><h3>' + esc(t('footer.dealers')) + '</h3><ul><li><a href="#/dealers">' + esc(t('footer.partner')) + '</a></li></ul></div></div></div>' +
      '<div class="footer-bottom"><p>' + esc(t('footer.copy', { year: new Date().getFullYear() })) + '</p><p class="legal">' + esc(t('footer.legal')) + '</p></div>' +
      '</div><div class="footer-mark" aria-hidden="true">VOLΛNTE</div></footer>';
  }

  /* ---------- home ---------- */
  /* Cinéma hero: full-bleed slideshow, one Ford per slide. */
  var SLIDE_MS = 6000, slideTimer = null;
  function slideCardHtml(k) {
    var x = DATA.heroSlides[k], en = state.lang === 'en';
    return '<div class="row"><span class="name">' + esc([x.make, x.model, x.trim].filter(Boolean).join(' ')) + '</span><span class="s">' + esc(x.type[en ? 1 : 0]) + '</span></div>' +
      '<p class="desc">' + esc(t('cine.desc')) + '</p>' +
      '<a class="btn btn-primary cine-cta" href="#/budget" data-action="prefill" data-make="' + esc(x.make) + '" data-model="' + esc(x.model) + '" data-trim="' + esc(x.trim || '') + '">' + esc(t('callout.cta')) + icon('arrow') + '</a>';
  }
  function cineHtml() {
    var k = state.slide, S = DATA.heroSlides;
    return '<section class="cine" aria-labelledby="hero-title">' +
      '<div class="cine-slides" aria-hidden="true">' + S.map(function (x, j) { return '<img src="' + esc(x.img) + '" alt=""' + (x.pos || x.dim ? ' style="' + (x.pos ? 'object-position:' + esc(x.pos) + ';' : '') + (x.dim ? 'filter:brightness(' + Number(x.dim) + ');' : '') + '"' : '') + (j === k ? ' class="on"' : '') + '>'; }).join('') + '</div>' +
      '<div class="wrap cine-bottom"><div class="cine-copy"><p class="kicker">' + esc(t('hero.overline')) + '</p>' +
      '<h1 id="hero-title"><span>' + esc(t('hero.title1')) + '</span> <span class="accent">' + esc(t('hero.title2')) + '</span></h1>' +
      '<p class="cine-sub">' + esc(t('hero.sub')) + '</p>' +
      '<div class="hero-ctas"><a class="btn btn-primary btn-lg" href="#/budget">' + esc(t('hero.primary')) + icon('arrow') + '</a>' +
      '<a class="btn btn-ghost btn-lg" href="#/how">' + esc(t('hero.secondary')) + '</a></div></div>' +
      '<div class="cine-card" id="cine-card" aria-live="polite">' + slideCardHtml(k) + '</div></div>' +
      '<div class="wrap"><div class="cine-progress" role="group" aria-label="' + esc(t('cine.slides')) + '">' + S.map(function (x, j) {
        return '<button type="button" data-action="slide" data-i="' + j + '" aria-pressed="' + (j === k) + '" class="' + (j === k ? 'on' : j < k ? 'done' : '') + '"><span class="t"></span><span>' + pad2(j + 1) + ' <span class="l">· ' + esc([x.model, x.trim].filter(Boolean).join(' ')) + '</span></span></button>';
      }).join('') + '</div></div></section>';
  }
  function showSlide(k) {
    state.slide = k;
    var imgs = document.querySelectorAll('.cine-slides img'), card = document.getElementById('cine-card');
    if (!card) return;
    imgs.forEach(function (im, j) { im.classList.toggle('on', j === k); });
    document.querySelectorAll('.cine-progress button').forEach(function (b, j) {
      b.classList.toggle('on', j === k); b.classList.toggle('done', j < k); b.setAttribute('aria-pressed', j === k);
      var bar = b.querySelector('.t'); bar.style.animation = 'none'; bar.offsetHeight; bar.style.animation = '';
    });
    card.style.opacity = 0;
    setTimeout(function () { card.innerHTML = slideCardHtml(k); card.style.opacity = 1; }, 220);
    queueSlide();
  }
  function queueSlide() {
    clearTimeout(slideTimer);
    if (state.route.name !== 'home' || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    slideTimer = setTimeout(function () { showSlide((state.slide + 1) % DATA.heroSlides.length); }, SLIDE_MS);
  }

  function gaugeSvg(v) {
    /* 240° instrument arc, ticks every 50 $, needle at value */
    var cx = 200, cy = 200, r = 160, a0 = -210, a1 = 30, span = a1 - a0;
    var p = (Math.min(v, B_MAX) - B_MIN) / (B_MAX - B_MIN);
    function pt(a, rr) { var rad = a * Math.PI / 180; return [cx + rr * Math.cos(rad), cy + rr * Math.sin(rad)]; }
    function arc(from, to, rr) { var s = pt(from, rr), e = pt(to, rr), large = (to - from) > 180 ? 1 : 0; return 'M' + s[0].toFixed(1) + ',' + s[1].toFixed(1) + ' A' + rr + ',' + rr + ' 0 ' + large + ' 1 ' + e[0].toFixed(1) + ',' + e[1].toFixed(1); }
    var ticks = '', labels = '';
    for (var k = B_MIN; k <= B_MAX; k += 50) {
      var a = a0 + span * (k - B_MIN) / (B_MAX - B_MIN), major = (k % 250 === 0), s = pt(a, r - 16), e = pt(a, r - (major ? 34 : 26));
      var lit = k <= v;
      ticks += '<line x1="' + s[0].toFixed(1) + '" y1="' + s[1].toFixed(1) + '" x2="' + e[0].toFixed(1) + '" y2="' + e[1].toFixed(1) + '" style="stroke:' + (lit ? 'var(--accent)' : 'var(--gauge-off)') + '" stroke-width="' + (major ? 2.5 : 1.4) + '" stroke-linecap="round"/>';
      if (major) { var lp = pt(a, r - 54); labels += '<text x="' + lp[0].toFixed(1) + '" y="' + (lp[1] + 4).toFixed(1) + '" text-anchor="middle" font-family="neue-haas-grotesk-text, Figtree, sans-serif" font-weight="500" font-size="12" style="fill:' + (lit ? 'var(--text)' : 'var(--dim)') + '">' + (k >= B_MAX ? '∞' : k) + '</text>'; }
    }
    var av = a0 + span * p, n1 = pt(av, r - 44), n0 = pt(av + 180, 14);
    return '<svg viewBox="20 20 360 290" aria-hidden="true"><defs><filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>' +
      '<path d="' + arc(a0, a1, r) + '" fill="none" style="stroke:var(--line)" stroke-width="3" stroke-linecap="round"/>' +
      (p > 0.001 ? '<path d="' + arc(a0, av, r) + '" fill="none" style="stroke:var(--accent)" stroke-width="3" stroke-linecap="round"/>' : '') +
      ticks + labels +
      '<line x1="' + n0[0].toFixed(1) + '" y1="' + n0[1].toFixed(1) + '" x2="' + n1[0].toFixed(1) + '" y2="' + n1[1].toFixed(1) + '" style="stroke:var(--text)" stroke-width="2" stroke-linecap="round"/>' +
      '<circle cx="200" cy="200" r="7" style="fill:var(--text)"/></svg>';
  }

  function makeLabel(m) { return m === 'Other' ? t('request.otherMake') : m; }
  function vehText(v) {
    if (v.flexible) return t('request.flexibleValue');
    if (v.make === 'Other') return [v.model || t('request.otherMake'), v.trim].filter(Boolean).join(' ');
    return [v.make, v.model === 'other' ? v.modelOther : v.model, v.trim].filter(Boolean).join(' ');
  }
  function pickedHtml() {
    var v = state.forms.request.values;
    if (v.flexible || !v.make) return '';
    return '<p class="picked">' + icon('check') + '<span>' + esc(t('dial.picked')) + ' <b>' + esc(vehText(v)) + '</b></span></p>';
  }
  function secHead(n, key, id) { return '<div class="sec-head"' + (id ? ' id="' + id + '"' : '') + '><span class="sec-no">' + pad2(n) + '</span><span class="sec-label">' + esc(t(key)) + '</span></div>'; }
  function viewHome() {
    var v = state.dialBudget, bronco = DATA.heroSlides[1] || DATA.heroSlides[0];
    return cineHtml() +

      '<section class="wrap section reveal" id="budget" aria-labelledby="dial-title">' + secHead(1, 'dial.kicker') +
      '<div class="split split-head"><h2 id="dial-title" class="h2">' + esc(t('dial.title')) + '</h2><p class="lead">' + esc(t('dial.text')) + '</p></div>' +
      '<div class="dial-panel"><div class="dial-left">' +
      '<div class="dial-gauge"><div id="dial-gauge">' + gaugeSvg(v) + '</div><div class="dial-readout"><div class="dial-value" id="dial-value">' + esc(v >= B_MAX ? t('dial.noLimit') : money(v)) + '</div><div class="dial-unit">' + esc(t('dial.label')) + '</div></div></div>' +
      '<div class="range"><label class="label" for="dial-range" style="position:absolute;left:-9999px">' + esc(t('dial.label')) + '</label>' +
      '<input type="range" id="dial-range" data-dial min="' + B_MIN + '" max="' + B_MAX + '" step="' + B_STEP + '" value="' + v + '" style="--pct:' + pct(v, B_MIN, B_MAX) + '" aria-valuetext="' + esc(budgetLabel(v)) + '">' +
      '<div class="range-scale" aria-hidden="true"><span>' + money(B_MIN) + '</span><span>' + esc(t('dial.noLimit')) + '</span></div></div></div>' +
      '<div class="dial-right"><p class="dial-count">' + esc(t('dial.next')) + '</p>' + pickedHtml() + '<ol class="next-list">' +
      [1, 2, 3].map(function (n) { return '<li><span class="f-no">' + pad2(n) + '</span><div><strong>' + esc(t('dial.s' + n)) + '</strong><span>' + esc(t('dial.s' + n + 't')) + '</span></div></li>'; }).join('') +
      '</ol><div class="dial-go"><button type="button" class="btn btn-primary btn-lg" data-action="dial-go">' + esc(t('dial.cta')) + icon('arrow') + '</button><span class="time-note">' + esc(t('dial.time')) + '</span></div></div></div></section>' +

      '<section class="statement reveal" aria-labelledby="statement-title"><img src="' + esc(bronco.img) + '" alt="" loading="lazy">' +
      '<div class="wrap statement-in"><h2 id="statement-title">' + esc(t('statement.title')) + '</h2><p>' + esc(t('statement.cap')) + '</p></div></section>' +

      '<section class="wrap section reveal" aria-labelledby="how-title">' + secHead(2, 'how.kicker', 'how') +
      '<div class="split split-head"><h2 id="how-title" class="h2">' + esc(t('how.title')) + '</h2><p class="lead">' + esc(t('handoff')) + '</p></div>' +
      '<ol class="steps">' + [1, 2, 3].map(function (n) {
        return '<li><span class="step-no">' + pad2(n) + '</span><h3>' + esc(t('how.' + n + '.title')) + '</h3><p>' + esc(t('how.' + n + '.text')) + '</p></li>';
      }).join('') + '</ol>' +
      '<div class="row-btns"><a class="btn btn-primary btn-lg" href="#/budget">' + esc(t('hero.primary')) + icon('arrow') + '</a></div></section>' +

      '<section class="band"><div class="wrap reveal" aria-labelledby="faq-title">' + secHead(3, 'faq.kicker', 'faq') +
      '<div class="split"><h2 id="faq-title" class="h2">' + esc(t('faq.title')) + '</h2><div class="faq">' +
      [1, 2, 3, 4, 5].map(function (n) {
        return '<details><summary><span>' + esc(t('faq.' + n + '.q')) + '</span><span class="faq-ic" aria-hidden="true"></span></summary><p>' + esc(t('faq.' + n + '.a')) + '</p></details>';
      }).join('') + '</div></div></div></section>' +

      '<section class="wrap section reveal" aria-labelledby="dealers-title">' + secHead(4, 'dealersSection.kicker') +
      '<div class="dealer-band"><h2 id="dealers-title" class="h2">' + esc(t('dealersSection.title')) + '</h2><div><p class="lead">' + esc(t('dealersSection.text')) + '</p>' +
      '<a class="btn btn-ghost btn-lg" href="#/dealers">' + esc(t('dealersSection.cta')) + icon('arrow') + '</a></div></div></section>';
  }

  /* ---------- form building ---------- */
  function fieldHtml(form, name, opts) {
    var F = state.forms[form], v = F.values[name], err = F.errors[name], id = form + '-' + name, req = opts.required, db = [];
    if (opts.hint) db.push(id + '-hint'); db.push(id + '-err');
    var common = 'id="' + id + '" name="' + name + '" data-form="' + form + '"' + (req ? ' aria-required="true"' : '') + ' aria-invalid="' + (err ? 'true' : 'false') + '" aria-describedby="' + db.join(' ') + '"' + (opts.disabled ? ' disabled' : '');
    var labelText = esc(opts.label) + (req ? ' <span class="req" aria-hidden="true">*</span>' : ' <span class="opt">(' + esc(t('form.optional')) + ')</span>');
    var errP = '<p class="error" id="' + id + '-err">' + (err ? esc(t(err)) : '') + '</p>', control;
    if (opts.type === 'select') {
      control = '<select ' + common + '>' + (opts.placeholder != null ? '<option value="">' + esc(opts.placeholder) + '</option>' : '') +
        opts.options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(v || '') ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>';
    } else if (opts.type === 'textarea') {
      control = '<textarea ' + common + ' rows="3" placeholder="' + esc(opts.placeholder || '') + '">' + esc(v || '') + '</textarea>';
    } else if (opts.type === 'checkbox') {
      return '<div class="field' + (err ? ' has-error' : '') + '"><label class="check-label" for="' + id + '"><input type="checkbox" ' + common + (v ? ' checked' : '') + '><span>' + esc(opts.label) + (req ? ' <span class="req" aria-hidden="true">*</span>' : '') + '</span></label>' + errP + '</div>';
    } else if (opts.type === 'choice') {
      return '<fieldset class="field' + (err ? ' has-error' : '') + '" aria-describedby="' + (opts.hint ? id + '-hint ' : '') + id + '-err"><legend class="label">' + labelText + '</legend>' +
        (opts.hint ? '<p class="hint" id="' + id + '-hint">' + esc(opts.hint) + '</p>' : '') + '<div class="chips" data-n="' + opts.options.length + '">' +
        opts.options.map(function (o, i) {
          return '<label class="chip"><input type="radio" ' + (i === 0 ? 'id="' + id + '" ' : 'id="' + id + '-' + i + '" ') + 'name="' + name + '" value="' + esc(o[0]) + '" data-form="' + form + '"' + (String(o[0]) === String(v == null ? '' : v) ? ' checked' : '') + (req ? ' aria-required="true"' : '') + ' aria-invalid="' + (err ? 'true' : 'false') + '">' + (o[2] || '') + esc(o[1]) + '</label>';
        }).join('') + '</div>' + errP + '</fieldset>';
    } else if (opts.type === 'range') {
      var val = Number(v || opts.min);
      return '<div class="field range-field"><div class="range-head"><label class="label" for="' + id + '">' + esc(opts.label) + '</label><span class="range-out" id="' + id + '-out">' + esc(opts.fmt(val)) + '</span></div>' +
        '<input type="range" ' + common + ' min="' + opts.min + '" max="' + opts.max + '" step="' + opts.step + '" value="' + val + '" style="--pct:' + pct(val, opts.min, opts.max) + '" aria-valuetext="' + esc(opts.fmt(val)) + '">' +
        '<div class="range-scale" aria-hidden="true"><span>' + esc(opts.fmt(opts.min)) + '</span><span>' + esc(opts.fmt(opts.max)) + '</span></div>' + errP + '</div>';
    } else {
      control = '<input type="' + (opts.type || 'text') + '" ' + common + ' value="' + esc(v || '') + '"' + (opts.autocomplete ? ' autocomplete="' + opts.autocomplete + '"' : '') + (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : '') + (opts.placeholder ? ' placeholder="' + esc(opts.placeholder) + '"' : '') + '>';
    }
    return '<div class="field' + (err ? ' has-error' : '') + (opts.wide ? ' wide' : '') + '"><label class="label" for="' + id + '">' + labelText + '</label>' + control +
      (opts.hint ? '<p class="hint" id="' + id + '-hint">' + esc(opts.hint) + '</p>' : '') + errP + '</div>';
  }
  function errorSummary(form) {
    var F = state.forms[form];
    if (F.sendError) return '<div class="error-summary" role="alert" id="' + form + '-summary">' + esc(t(F.sendError)) + '</div>';
    return F.attempted && Object.keys(F.errors).length ? '<div class="error-summary" role="alert" id="' + form + '-summary">' + esc(t('form.errorSummary')) + '</div>' : '';
  }
  /* spam trap: a field people never see; bots fill it in */
  function honeypot() { return '<div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>'; }
  function submitBtn(form, label) {
    var F = state.forms[form];
    return '<button type="submit" class="btn btn-primary btn-lg"' + (F.sending ? ' disabled aria-busy="true"' : '') + '>' + esc(F.sending ? t('form.sending') : label) + (F.sending ? '' : icon('arrow')) + '</button>';
  }
  function demoNote() { return LIVE ? '' : '<p class="demo-note">' + esc(t('form.demoNote')) + '</p>'; }

  /* ---------- validation ---------- */
  var RX = { email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, postal: /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d$/i };
  function filled(v) { return v != null && String(v).trim() !== ''; }
  var RULES = {
    name: function (v) { return filled(v) ? null : 'err.required'; },
    email: function (v) { return !filled(v) ? 'err.required' : RX.email.test(v.trim()) ? null : 'err.email'; },
    phone: function (v, all) { if (!filled(v)) return all && all.contactMethod === 'phone' ? 'err.phoneNeeded' : null; var d = v.replace(/\D/g, ''); if (d.length === 11 && d[0] === '1') d = d.slice(1); return d.length === 10 ? null : 'err.phone'; },
    postal: function (v) { return !filled(v) ? 'err.required' : RX.postal.test(v.trim()) ? null : 'err.postal'; },
    consent: function (v) { return v ? null : 'err.consent'; },
    budget: function (v) { var n = Number(v); return filled(v) && n >= 100 && n <= 5000 ? null : 'err.budget'; },
    required: function (v) { return filled(v) ? null : 'err.required'; }
  };
  var FORM_FIELDS = {
    request: { make: function (v, all) { return all.flexible || filled(v) ? null : 'err.vehicle'; },
      model: function (v, all) { return !all.flexible && all.make === 'Other' && !filled(v) ? 'err.otherModel' : null; },
      modelOther: function (v, all) { return !all.flexible && all.make !== 'Other' && all.model === 'other' && !filled(v) ? 'err.modelOther' : null; }, budget: RULES.budget, term: RULES.required, km: RULES.required,
      firstName: RULES.name, lastName: RULES.name, email: RULES.email, phone: RULES.phone, postal: RULES.postal, contactLang: RULES.required, contactMethod: RULES.required, consent: RULES.consent },
    dealer: { dealership: RULES.required, location: RULES.required, contact: RULES.required, email: RULES.email }
  };
  var REQUEST_STEPS = [['make', 'model', 'modelOther', 'trim', 'flexible', 'body', 'fuel', 'drive', 'color'], ['budget', 'down', 'term', 'km', 'trade', 'timing'], ['firstName', 'lastName', 'email', 'phone', 'postal', 'contactLang', 'contactMethod', 'message', 'consent']];
  /* extra optional choices (labels in i18n.js: fuel.*, drive.*, down.*, trade.*, timing.*) */
  var OPTS = {
    fuel: ['gas', 'hybrid', 'phev', 'electric'],
    drive: ['awd', '4x4'],
    down: ['0', '1000', '2500', '5000', 'more'],
    trade: ['no', 'own', 'lease'],
    timing: ['asap', '3m', 'later'],
    contactLang: ['fr', 'en'],
    contactMethod: ['email', 'phone', 'any']
  };
  function optLabel(group, v) { return v ? t(group + '.' + v) : ''; }
  /* the same choices as a dropdown. Optional: first entry "No preference" (empty). Required: "Choose…" placeholder. */
  function optSelect(name, label, options, required, hint) {
    var ph = required === 'noPlaceholder' ? null : required ? t('form.choose') : t('request.noPref');
    return fieldHtml('request', name, { label: t(label), type: 'select', required: !!required, placeholder: ph, hint: hint ? t(hint) : '', options: options });
  }
  function optList(group) { return OPTS[group].map(function (k) { return [k, t(group + '.' + k)]; }); }
  /* a chosen model already tells us the body type, so that question only shows without a model */
  function showBody(v) { return !!(v.flexible || !v.model || v.model === 'other' || v.make === 'Other'); }
  function optChoice(group, label, withAny, required, hint) {
    var o = OPTS[group].map(function (k) { return [k, t(group + '.' + k)]; });
    return fieldHtml('request', group, { label: t(label), type: 'choice', required: required, hint: hint ? t(hint) : '', options: withAny ? [['', t('request.noPref')]].concat(o) : o });
  }
  function validate(form, only) {
    var vals = state.forms[form].values, errs = {}, rules = FORM_FIELDS[form];
    Object.keys(rules).forEach(function (k) { if (only && only.indexOf(k) === -1) return; var e = rules[k](vals[k], vals); if (e) errs[k] = e; });
    return errs;
  }

  /* ---------- request (3 steps) ---------- */
  function reqBudgetFmt(v) { return money(v) + t('freq.short.monthly'); }
  function termLabel(v) { return v === 'any' ? t('request.noPref') : t('unit.months', { n: v }); }
  function kmLabel(v) { return v === 'any' ? t('request.noPref') : t('unit.kmYear', { n: num(v) }); }
  function requestSummaryHtml() {
    var v = state.forms.request.values;
    function row(label, val) { return '<div><dt>' + esc(label) + '</dt><dd' + (val ? '' : ' class="empty-val"') + '>' + esc(val || t('request.summaryEmpty')) + '</dd></div>'; }
    var veh = vehText(v);
    return '<h2>' + esc(t('request.summary')) + '</h2><dl>' +
      row(t('request.vehicleLabel'), veh) + (showBody(v) || v.body ? row(t('request.body'), v.body ? t('body.' + v.body) : '') : '') + row(t('request.fuel'), optLabel('fuel', v.fuel)) + row(t('request.color'), v.color ? t('color.' + v.color) : '') +
      row(t('dial.label'), v.budget ? reqBudgetFmt(Number(v.budget)) : '') + row(t('request.down'), optLabel('down', v.down)) +
      row(t('request.term'), v.term ? termLabel(v.term) : '') +
      row(t('request.km'), v.km ? kmLabel(v.km) : '') +
      row(t('form.postal'), v.postal ? String(v.postal).toUpperCase() : '') +
      '</dl><p class="small">' + esc(t('handoff')) + '</p>';
  }
  function contactFields(form) {
    return fieldHtml(form, 'firstName', { label: t('form.firstName'), required: true, autocomplete: 'given-name' }) +
      fieldHtml(form, 'lastName', { label: t('form.lastName'), required: true, autocomplete: 'family-name' }) +
      fieldHtml(form, 'email', { label: t('form.email'), type: 'email', required: true, autocomplete: 'email' }) +
      fieldHtml(form, 'phone', { label: t('form.phone'), required: state.forms[form].values.contactMethod === 'phone', type: 'tel', autocomplete: 'tel', inputmode: 'tel' }) +
      fieldHtml(form, 'postal', { label: t('form.postal'), required: true, autocomplete: 'postal-code', hint: t('form.postalHint') });
  }
  /* photo for a request: the matching hero slide, else the default request photo */
  function vehiclePhoto(v) {
    var m = DATA.heroSlides.filter(function (x) { return x.make === v.make && x.model === v.model; })[0];
    return m || DATA.pagePhotos.request;
  }
  function photoImg(x, cls) {
    return '<img class="' + (cls || '') + '" src="' + esc(x.img) + '" alt=""' + (x.pos || x.dim ? ' style="' + (x.pos ? 'object-position:' + esc(x.pos) + ';' : '') + (x.dim ? 'filter:brightness(' + Number(x.dim) + ');' : '') + '"' : '') + '>';
  }
  function pageHero(photo, kicker, title, lead) {
    return '<section class="page-hero">' + photoImg(photo, 'page-hero-img') + '<div class="wrap page-hero-in"><p class="kicker">' + esc(kicker) + '</p><h1 class="h1">' + esc(title) + '</h1>' + (lead ? '<p class="lead">' + esc(lead) + '</p>' : '') + '</div></section>';
  }
  /* request number shown on the ticket and saved in the Sheet: VL-YYMMDD-1234 */
  function makeRef(d) {
    function p2(n) { return (n < 10 ? '0' : '') + n; }
    return 'VL-' + String(d.getFullYear()).slice(2) + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + (1000 + Math.floor(Math.random() * 9000));
  }
  /* "DEMANDE REÇUE" banner: bold capitals + clipboard with a check badge */
  function doneBanner() {
    return '<div class="t-banner"><p class="t-banner-txt">' + esc(t('done.bannerA')) + '<br>' + esc(t('done.bannerB')) + '</p>' +
      '<svg class="t-banner-ic" viewBox="0 0 124 144" aria-hidden="true">' +
      '<rect x="8" y="18" width="88" height="114" rx="10" fill="none" stroke="currentColor" stroke-width="8"/>' +
      '<rect x="32" y="4" width="40" height="24" rx="6" fill="currentColor"/><circle cx="52" cy="12" r="4.5" fill="var(--banner-bg)"/>' +
      '<g stroke="currentColor" stroke-width="5.5"><path d="M26 48h52"/><path d="M26 63h52"/><path d="M26 78h52"/><path d="M26 93h40"/><path d="M26 108h28"/></g>' +
      '<g class="t-badge"><circle cx="94" cy="112" r="28" fill="currentColor" stroke="var(--banner-bg)" stroke-width="7"/>' +
      '<path d="M81 112.5 90 121.5 107 103" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></g></svg></div>';
  }
  function sentAtText(ms) {
    try { return new Intl.DateTimeFormat(state.lang === 'fr' ? 'fr-CA' : 'en-CA', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(ms)); }
    catch (e) { return new Date(ms).toLocaleString(); }
  }
  function viewRequest() {
    var F = state.forms.request, v = F.values, step = F.step;
    if (F.done) {
      shownStep = 0; // a new request starts without a slide
      var d = F.done;
      function row(k, val) { return '<div><dt>' + esc(t(k)) + '</dt><dd>' + esc(val) + '</dd></div>'; }
      return '<section class="wrap section done-wrap"><div class="done-grid">' +
        '<div class="confirm" tabindex="-1" id="confirm"><span class="icon-ring">' + icon('check') + '</span><h1 class="h1">' + esc(t('request.done.title', { name: d.firstName })) + '</h1>' +
        '<p class="lead">' + esc(t('request.done.text', { name: d.firstName })) + '</p>' +
        '<h2 class="done-next-title">' + esc(t('done.nextTitle')) + '</h2><ol class="next-list">' + [1, 2, 3].map(function (n) {
          return '<li><span class="f-no">' + pad2(n) + '</span><div><strong>' + esc(t('done.n' + n)) + '</strong><span>' + esc(t('done.n' + n + 't')) + '</span></div></li>';
        }).join('') + '</ol>' +
        '<div class="row-btns"><a class="btn btn-primary btn-lg" href="#/">' + esc(t('request.done.home')) + icon('arrow') + '</a><button type="button" class="btn btn-ghost btn-lg" data-action="reset-form" data-form-id="request">' + esc(t('request.done.again')) + '</button></div></div>' +
        '<aside class="done-card ticket">' + doneBanner() + '<div class="t-band"><div class="t-top"><span class="t-wm">VOLΛNTE</span>' + (d.ref ? '<span class="t-ref">' + esc(t('done.ref', { ref: d.ref })) + '</span>' : '') + '</div>' +
        '<p class="t-veh">' + esc(vehText(d)) + '</p><p class="t-sub">' + esc(d.sentAt ? t('done.receivedOn', { date: sentAtText(d.sentAt) }) : t('request.done.summary')) + '</p></div><div class="t-cut" aria-hidden="true"></div><dl class="spec-table">' +
        (d.body ? row('request.body', t('body.' + d.body)) : '') + (d.fuel ? row('request.fuel', optLabel('fuel', d.fuel)) : '') + (d.drive ? row('request.drive', optLabel('drive', d.drive)) : '') + (d.color ? row('request.color', t('color.' + d.color)) : '') +
        row('request.budget', reqBudgetFmt(Number(d.budget))) + (d.down ? row('request.down', optLabel('down', d.down)) : '') + row('request.term', termLabel(d.term)) + row('request.km', kmLabel(d.km)) +
        (d.trade ? row('request.trade', optLabel('trade', d.trade)) : '') + (d.timing ? row('request.timing', optLabel('timing', d.timing)) : '') +
        row('form.postal', d.postal.toUpperCase()) + row('form.email', d.email) + (d.phone ? row('form.phone', d.phone) : '') +
        row('request.contactLang', optLabel('contactLang', d.contactLang)) + row('request.contactMethod', optLabel('contactMethod', d.contactMethod)) +
        '</dl></aside></div></section>';
    }
    var titles = ['request.sec.vehicle', 'request.sec.lease', 'request.sec.contact'], body;
    var prevStep = shownStep; shownStep = step;
    if (step === 1) {
      if (!showBody(v)) v.body = '';
      var models = DATA.models[v.make] || [];
      body = '<div class="grid-2">' +
        fieldHtml('request', 'make', { label: t('request.make'), type: 'select', required: !v.flexible, placeholder: t('request.chooseMake'), disabled: !!v.flexible, options: DATA.requestMakes.map(function (m) { return [m, makeLabel(m)]; }) }) +
        (v.make === 'Other' && !v.flexible
          ? fieldHtml('request', 'model', { label: t('request.modelOther'), required: true, placeholder: t('request.modelPhOther'), autocomplete: 'off' })
          : fieldHtml('request', 'model', { label: t('request.model'), type: 'select', placeholder: v.make ? t('request.chooseModel') : t('request.chooseMakeFirst'), disabled: !!v.flexible || !v.make,
              options: models.map(function (m) { return [m, m]; }).concat(v.make ? [['other', t('request.otherModel')]] : []) })) +
        (v.model === 'other' && v.make !== 'Other' && !v.flexible ? fieldHtml('request', 'modelOther', { label: t('request.modelOtherLabel'), required: true, placeholder: t('request.modelOtherPh'), autocomplete: 'off', wide: true }) : '') +
        fieldHtml('request', 'trim', { label: t('request.trim'), placeholder: t('request.trimPh'), disabled: !!v.flexible, autocomplete: 'off', hint: t('request.trimHint') }) +
        '</div>' +
        fieldHtml('request', 'flexible', { label: t('request.flexible'), type: 'checkbox' }) +
        '<div class="grid-2">' +
        (showBody(v) ? optSelect('body', 'request.body', Object.keys(BODY).map(function (b) { return [b, t('body.' + b)]; })) : '') +
        optSelect('fuel', 'request.fuel', optList('fuel')) + optSelect('drive', 'request.drive', optList('drive')) +
        optSelect('color', 'request.color', DATA.colorOptions.map(function (c) { return [c[0], t('color.' + c[0])]; })) +
        '</div>';
    } else if (step === 2) {
      body = fieldHtml('request', 'budget', { label: t('request.budget'), type: 'range', required: true, min: R_MIN, max: R_MAX, step: R_STEP, fmt: reqBudgetFmt }) +
        '<div class="grid-2">' +
        optSelect('term', 'request.term', DATA.termOptions.map(function (n) { return [String(n), t('unit.months', { n: n })]; }).concat([['any', t('request.noPref')]]), true) +
        optSelect('km', 'request.km', DATA.kmOptions.map(function (n) { return [String(n), t('unit.kmYear', { n: num(n) })]; }).concat([['any', t('request.noPref')]]), true) +
        optSelect('down', 'request.down', optList('down'), false, 'request.downHint') +
        '</div>' +
        optChoice('trade', 'request.trade', false) + optChoice('timing', 'request.timing', false);
    } else {
      body = '<div class="grid-2">' + contactFields('request') + '</div>' +
        '<div class="grid-2">' + optSelect('contactLang', 'request.contactLang', optList('contactLang'), 'noPlaceholder') + optSelect('contactMethod', 'request.contactMethod', optList('contactMethod'), true) + '</div>' +
        fieldHtml('request', 'message', { label: t('form.message'), type: 'textarea', wide: true }) +
        '<div class="share-box">' + icon('info') + '<div><h3>' + esc(t('request.share.title')) + '</h3><p class="small">' + esc(t('request.share.text')) + '</p></div></div>' +
        fieldHtml('request', 'consent', { label: t('form.consent'), type: 'checkbox', required: true });
    }
    return '<section class="wrap page-head"><p class="kicker">' + esc(t('nav.request')) + '</p><h1 class="h1">' + esc(t('request.title')) + '</h1><p class="lead">' + esc(t('request.sub')) + '</p></section>' +
      '<section class="wrap request-layout"><form class="form panel" data-form-id="request" novalidate>' +
      '<ol class="steps-bar" aria-label="' + esc(t('request.stepOf', { n: step, total: 3 })) + '">' + titles.map(function (k, i) {
        return '<li class="' + (i + 1 < step ? 'done' : i + 1 === step ? 'current' : '') + '"' + (i + 1 === step ? ' aria-current="step"' : '') + '><span class="sb-no">' + pad2(i + 1) + '</span>' + esc(t(k)) + '</li>';
      }).join('') + '</ol>' + errorSummary('request') +
      '<fieldset class="group' + (prevStep && prevStep !== step ? (step > prevStep ? ' step-in' : ' step-back') : '') + '"><legend class="step-title" id="step-title" tabindex="-1"><span class="step-count" style="display:block">' + esc(t('request.stepOf', { n: step, total: 3 })) + '</span>' + esc(t(titles[step - 1])) + '</legend>' + body + '</fieldset>' +
      '<div class="form-foot">' + (step > 1 ? '<button type="button" class="btn btn-ghost" data-action="req-prev">' + icon('back') + esc(t('request.prev')) + '</button>' : '') + '<span class="spacer"></span>' +
      submitBtn('request', t(step < 3 ? 'request.next' : 'request.submit')) + '</div>' + honeypot() +
      demoNote() + '</form>' +
      '<aside class="summary-card" id="req-summary" aria-live="polite">' + requestSummaryHtml() + '</aside></section>';
  }

  /* ---------- dealers ---------- */
  function viewDealers() {
    var F = state.forms.dealer, form;
    if (F.done) {
      form = '<div class="confirm" tabindex="-1" id="confirm"><span class="icon-ring">' + icon('check') + '</span><h2 class="h2">' + esc(t('dealers.done.title')) + '</h2>' +
        '<p>' + esc(t('dealers.done.text', { name: F.done.contact, dealer: F.done.dealership })) + '</p><div class="row-btns"><button type="button" class="btn btn-ghost" data-action="edit-dealer">' + esc(t('dealers.done.again')) + '</button></div></div>';
    } else {
      form = '<h2 class="h2">' + esc(t('dealers.form.title')) + '</h2><p class="muted">' + esc(t('dealers.form.sub')) + '</p><form class="form" data-form-id="dealer" novalidate>' + errorSummary('dealer') +
        fieldHtml('dealer', 'dealership', { label: t('dealers.dealership'), required: true, autocomplete: 'organization' }) +
        fieldHtml('dealer', 'location', { label: t('dealers.location'), required: true, placeholder: t('dealers.locationPh'), autocomplete: 'address-level2' }) +
        '<div class="grid-2">' + fieldHtml('dealer', 'contact', { label: t('dealers.contact'), required: true, autocomplete: 'name' }) +
        fieldHtml('dealer', 'email', { label: t('dealers.email'), type: 'email', required: true, autocomplete: 'work email' }) + '</div>' +
        '<div class="form-foot">' + submitBtn('dealer', t('dealers.submit')) + '</div>' + honeypot() + demoNote() + '</form>';
    }
    return pageHero(DATA.pagePhotos.dealers, t('dealers.kicker'), t('dealers.title'), t('dealers.sub')) +
      '<section class="wrap dealers-grid"><ol class="lanes">' + [1, 2, 3].map(function (n) {
        return '<li><span class="f-no">' + pad2(n) + '</span><div><h3>' + esc(t('dealers.p' + n + '.title')) + '</h3><p class="muted">' + esc(t('dealers.p' + n + '.text')) + '</p></div></li>';
      }).join('') + '</ol><div class="panel">' + form + '</div></section>';
  }
  function viewNotFound() { return '<section class="wrap page-head"><h1 class="h1">' + esc(t('notFound.title')) + '</h1><a class="btn btn-primary" href="#/">' + esc(t('notFound.cta')) + '</a></section>'; }

  /* ---------- render ---------- */
  var revealObs = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); if (e.target.querySelector('#dial-gauge')) sweepGauge(); } });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;
  var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* small touch: the needle glides up to the chosen budget once, when the gauge first appears */
  function sweepGauge() {
    var box = document.getElementById('dial-gauge'), to = state.dialBudget, t0 = null, dur = 700;
    if (!box || REDUCED || to <= B_MIN) return;
    function frame(ts) {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 3); // ease-out
      if (state.dialBudget !== to || !document.contains(box)) return; // the visitor took over: stop
      box.innerHTML = gaugeSvg(Math.round(B_MIN + (to - B_MIN) * e));
      if (k < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  var shownStep = 0; // request form: animate only when the step changes
  var seen = {}; // reveal each section once per route, so language switches don't replay it
  var lastRendered = null;
  window.VOLANTE_DD_TEXT = function (k) { return t('dd.' + k); };
  function render(opts) {
    opts = opts || {};
    var activeId = document.activeElement && document.activeElement.id, r = state.route, main;
    if (r.name === 'home') main = viewHome(); else if (r.name === 'request') main = viewRequest(); else if (r.name === 'dealers') main = viewDealers(); else main = viewNotFound();
    document.documentElement.lang = state.lang === 'fr' ? 'fr-CA' : 'en-CA';
    document.title = t('meta.title');
    var fresh = r.name !== lastRendered; lastRendered = r.name; // fade only when the page changes
    app.innerHTML = header() + '<main id="main" tabindex="-1"' + (fresh ? ' class="page-in"' : '') + '>' + main + '</main>' + footer();
    if (window.VolanteSelect) window.VolanteSelect.enhance(app); // styled dropdowns (js/select.js)
    Array.prototype.forEach.call(document.querySelectorAll('.reveal'), function (el, i) {
      var key = r.name + i;
      if (!revealObs || seen[key]) { el.classList.add('in'); return; }
      seen[key] = true; revealObs.observe(el);
    });
    if (r.name === 'home') queueSlide(); else clearTimeout(slideTimer);
    if (opts.focus) { var el = document.getElementById(opts.focus); if (el) el.focus({ preventScroll: !!opts.preventScroll }); }
    else if (activeId && opts.keepFocus !== false) { var a = document.getElementById(activeId); if (a) a.focus({ preventScroll: true }); }
  }
  /* anchors land on the section's headline (skipping its top padding and numbered header) */
  function anchorTarget(el) {
    var sec = el.closest('section') || el;
    sec.classList.add('in');
    return sec.querySelector('.split-head') || el;
  }
  function parseRoute() {
    var parts = (location.hash || '#/').replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
    if (!parts.length) return { name: 'home', params: {} };
    if (parts[0] === 'how') return { name: 'home', params: { anchor: 'how' } };
    if (parts[0] === 'budget') return { name: 'home', params: { anchor: 'budget' } };
    if (parts[0] === 'offers' || parts[0] === 'offer') return { name: 'redirect', params: { to: '#/budget' } };
    if (['request', 'dealers'].indexOf(parts[0]) > -1) return { name: parts[0], params: {} };
    return { name: 'notfound', params: {} };
  }
  function onRoute() {
    var prev = state.route, next = parseRoute();
    if (next.name === 'redirect') { location.replace(next.params.to); return; }
    /* Links from landing pages can pre-fill the form: #/budget?make=Ford&model=Bronco (or #/request?…) */
    var query = (location.hash.split('?')[1] || '');
    var isBudget = next.name === 'home' && next.params.anchor === 'budget';
    if ((next.name === 'request' || isBudget) && query) {
      var q = {}; query.split('&').forEach(function (p) { var kv = p.split('='); if (kv[0]) q[decodeURIComponent(kv[0])] = decodeURIComponent((kv[1] || '').replace(/\+/g, ' ')); });
      var pre = {};
      if (q.make && DATA.requestMakes.indexOf(q.make) > -1) { pre.make = q.make; pre.flexible = false; }
      if (q.model && pre.make) { // a model only counts with an allowed make
        var known = DATA.models[pre.make] || [], mq = q.model.slice(0, 60);
        if (pre.make === 'Other' || known.indexOf(mq) > -1) pre.model = mq; else { pre.model = 'other'; pre.modelOther = mq; }
      }
      if (q.trim && pre.make) pre.trim = q.trim.slice(0, 40);
      if (q.budget && Number(q.budget) >= B_MIN && Number(q.budget) <= R_MAX) state.dialBudget = Math.min(Number(q.budget), B_MAX);
      if (Object.keys(pre).length) startRequest(pre);
      history.replaceState(null, '', location.pathname + location.search + (isBudget ? '#/budget' : '#/request'));
    }
    /* BUDGET GATE: the form only opens after the budget step. */
    if (next.name === 'request' && !state.budgetSet && !state.forms.request.done) { location.replace('#/budget'); return; }
    state.route = next; state.navOpen = false;
    if (prev.name !== state.route.name) seen = {};
    render({ keepFocus: false });
    if (state.route.params.anchor) { var el = document.getElementById(state.route.params.anchor); if (el) { anchorTarget(el).scrollIntoView({ behavior: prev.name === 'home' ? 'smooth' : 'auto' }); return; } }
    window.scrollTo(0, 0);
    if (prev.name !== undefined && prev.name !== state.route.name) { var m = document.getElementById('main'); if (m) m.focus({ preventScroll: true }); }
  }

  /* ---------- submit (DEMO MODE) ----------
     To go live: replace the "DEMO" lines with a fetch() POST to your endpoint (see README). */
  function focusFirstError(formId) {
    var F = state.forms[formId], first = Object.keys(FORM_FIELDS[formId]).filter(function (k) { return F.errors[k]; })[0];
    var el = first && document.getElementById(formId + '-' + first);
    if (el) { el.focus(); el.scrollIntoView({ block: 'center' }); }
  }
  function submitForm(formId) {
    var F = state.forms[formId];
    if (formId === 'request' && F.step < 3) {
      var errs = validate('request', REQUEST_STEPS[F.step - 1]);
      F.errors = errs;
      if (Object.keys(errs).length) { F.attempted = true; render({ keepFocus: false }); focusFirstError('request'); return; }
      F.attempted = false; F.step += 1; render({ keepFocus: false });
      var st = document.getElementById('step-title'); if (st) { st.focus({ preventScroll: true }); st.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      return;
    }
    F.attempted = true;
    F.errors = validate(formId);
    if (Object.keys(F.errors).length) {
      if (formId === 'request') { // jump back to the first step with an error
        for (var s = 0; s < 3; s++) if (REQUEST_STEPS[s].some(function (k) { return F.errors[k]; })) { F.step = s + 1; break; }
      }
      render({ keepFocus: false }); focusFirstError(formId); return;
    }
    var payload = JSON.parse(JSON.stringify(F.values));
    if (formId === 'request') { payload.sentAt = Date.now(); payload.ref = makeRef(new Date(payload.sentAt)); }
    function finish() {
      F.done = payload; F.sending = false; F.sendError = null;
      render({ keepFocus: false });
      var c = document.getElementById('confirm'); if (c) { c.focus({ preventScroll: true }); c.scrollIntoView({ block: 'center' }); }
    }
    if (!LIVE) { console.info('[Volante demo] would submit', formId, payload); finish(); return; }
    if (F.sending) return;
    var hpEl = document.querySelector('form[data-form-id="' + formId + '"] input[name="website"]');
    var body = {
      form: formId, lang: state.lang, page: location.href.split('#')[0], elapsed: Date.now() - (F.startedAt || 0), hp: hpEl ? hpEl.value : '',
      fields: inLang('fr', function () { return sheetFields(formId, payload); }),
      columns: inLang('fr', function () { return sheetColumns(formId, payload); })
    };
    F.sending = true; F.sendError = null; render({ keepFocus: false });
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 25000);
    function fail(code) {
      clearTimeout(timer); F.sending = false;
      F.sendError = code === 'rate_limited' ? 'err.sendLimit' : 'err.send';
      render({ keepFocus: false });
      var s = document.getElementById(formId + '-summary'); if (s) { s.setAttribute('tabindex', '-1'); s.focus({ preventScroll: true }); s.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }
    fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), signal: ctrl ? ctrl.signal : undefined })
      .then(function (r) { return r.json(); })
      .then(function (res) { if (res && res.ok) { clearTimeout(timer); finish(); } else fail(res && res.error); })
      .catch(function () { fail(); });
  }
  /* run fn with the interface language temporarily switched (labels for the Google Sheet are always French) */
  function inLang(l, fn) { var o = state.lang; state.lang = l; try { return fn(); } finally { state.lang = o; } }
  /* The Sheet's columns, in order: [key, column title, value]. The script adds any column the Sheet doesn't have yet,
     so new form fields show up in the Sheet without changing the script. */
  function sheetColumns(formId, v) {
    if (formId === 'dealer') return [['dealership', 'Concessionnaire', v.dealership], ['location', 'Ville ou adresse', v.location], ['contact', 'Personne-ressource', v.contact], ['email', 'Courriel', v.email]];
    return [
      ['ref', 'Nº de demande', v.ref || ''], ['firstName', 'Prénom', v.firstName], ['lastName', 'Nom', v.lastName], ['email', 'Courriel', v.email], ['phone', 'Téléphone', v.phone || ''],
      ['postal', 'Code postal', String(v.postal || '').toUpperCase()],
      ['vehicle', 'Véhicule', vehText(v)], ['make', 'Marque', v.flexible ? '' : makeLabel(v.make || '')],
      ['model', 'Modèle', v.flexible ? '' : (v.model === 'other' ? v.modelOther : v.model) || ''], ['trim', 'Version', v.flexible ? '' : v.trim || ''],
      ['flexible', 'Flexible', v.flexible ? 'Oui' : 'Non'], ['body', 'Carrosserie', v.body ? t('body.' + v.body) : ''],
      ['fuel', 'Motorisation', optLabel('fuel', v.fuel)], ['drive', 'Rouage', optLabel('drive', v.drive)], ['color', 'Couleur', v.color ? t('color.' + v.color) : ''],
      ['budget', 'Budget mensuel max.', reqBudgetFmt(Number(v.budget))], ['down', 'Comptant', optLabel('down', v.down)],
      ['term', 'Durée', termLabel(v.term)], ['km', 'Kilométrage annuel', kmLabel(v.km)],
      ['trade', 'Échange', optLabel('trade', v.trade)], ['timing', 'Délai', optLabel('timing', v.timing)],
      ['contactLang', 'Langue de communication', optLabel('contactLang', v.contactLang)], ['contactMethod', 'Moyen de communication', optLabel('contactMethod', v.contactMethod)],
      ['message', 'Message', v.message || ''], ['consent', 'Consentement', v.consent ? 'Oui' : 'Non']
    ];
  }
  /* key → value, plus `name` so the older version of the script still accepts the request */
  function sheetFields(formId, v) {
    var o = {};
    sheetColumns(formId, v).forEach(function (c) { o[c[0]] = c[2]; });
    if (formId === 'request') o.name = [v.firstName, v.lastName].filter(Boolean).join(' ');
    return o;
  }

  function refreshFieldError(formId, name) {
    var F = state.forms[formId];
    if (!F.attempted || !FORM_FIELDS[formId][name]) return;
    var e = FORM_FIELDS[formId][name](F.values[name], F.values);
    if (e) F.errors[name] = e; else delete F.errors[name];
    var input = document.getElementById(formId + '-' + name), errEl = document.getElementById(formId + '-' + name + '-err');
    if (input) {
      var group = input.type === 'radio' ? document.querySelectorAll('input[name="' + name + '"][data-form="' + formId + '"]') : [input];
      Array.prototype.forEach.call(group, function (g) { g.setAttribute('aria-invalid', e ? 'true' : 'false'); });
      input.closest('.field').classList.toggle('has-error', !!e);
    }
    if (errEl) errEl.textContent = e ? t(e) : '';
    if (!Object.keys(F.errors).length) { var s = document.getElementById(formId + '-summary'); if (s) s.remove(); }
  }

  /* ---------- events ---------- */
  function startRequest(values) {
    var F = state.forms.request;
    if (F.done) state.forms.request = F = emptyForm(requestDefaults());
    Object.keys(values).forEach(function (k) { F.values[k] = values[k]; });
    if (!F.values.contactLang) F.values.contactLang = state.lang;
    F.step = 1; F.errors = {}; F.attempted = false;
  }
  document.addEventListener('click', function (e) {
    var langBtn = e.target.closest('[data-lang]');
    if (langBtn) {
      var l = langBtn.getAttribute('data-lang');
      if (l !== state.lang) { state.lang = l; saveLang(l); var y = window.scrollY; render({ focus: langBtn.id, preventScroll: true }); window.scrollTo(0, y); }
      return;
    }
    if (e.target.closest('#theme-toggle')) { setTheme(!isLight()); var sy = window.scrollY; render({ focus: 'theme-toggle', preventScroll: true }); window.scrollTo(0, sy); return; }
    if (e.target.closest('#nav-toggle')) { state.navOpen = !state.navOpen; render({ focus: 'nav-toggle' }); return; }
    var same = e.target.closest('a[href="#/budget"], a[href="#/how"]');
    if (same && same.getAttribute('href') === location.hash) {
      state.navOpen = false;
      if (same.getAttribute('data-action') === 'prefill') startRequest({ make: same.getAttribute('data-make'), model: same.getAttribute('data-model'), trim: same.getAttribute('data-trim') || '', flexible: false });
      e.preventDefault(); render({ keepFocus: false });
      var tgt = document.getElementById(location.hash.slice(2)); if (tgt) { anchorTarget(tgt).scrollIntoView({ behavior: 'smooth' }); }
      return;
    }
    var a = e.target.closest('[data-action]');
    if (!a) {
      var navLink = e.target.closest('.main-nav a');
      if (state.navOpen && navLink) { state.navOpen = false; if (navLink.getAttribute('href') === location.hash) render({ keepFocus: false }); }
      return;
    }
    var act = a.getAttribute('data-action');
    if (act === 'slide') { showSlide(Number(a.getAttribute('data-i'))); return; }
    if (act === 'dial-go') {
      state.budgetSet = true;
      startRequest({ budget: String(state.dialBudget >= B_MAX ? R_MAX : state.dialBudget) });
      location.hash = '#/request';
    } else if (act === 'prefill') {
      startRequest({ make: a.getAttribute('data-make'), model: a.getAttribute('data-model'), trim: a.getAttribute('data-trim') || '', flexible: false });
      // the link's own href (#/budget) does the navigation
    }
    else if (act === 'req-prev') { var F = state.forms.request; F.step = Math.max(1, F.step - 1); F.attempted = false; F.errors = {}; render({ focus: 'step-title' }); }
    else if (act === 'reset-form') { var id = a.getAttribute('data-form-id'); state.forms[id] = emptyForm(id === 'request' ? requestDefaults() : {});
      if (id === 'request') { state.budgetSet = false; location.hash = '#/budget'; return; }
      render({ keepFocus: false }); window.scrollTo(0, 0); }
    else if (act === 'edit-dealer') { state.forms.dealer.done = false; render({ focus: 'dealer-dealership' }); }
  });
  function setRangeVisual(el, label) { el.style.setProperty('--pct', pct(Number(el.value), Number(el.min), Number(el.max))); el.setAttribute('aria-valuetext', label); }
  function onFieldChange(e) {
    var el = e.target;
    if (el.hasAttribute && el.hasAttribute('data-dial')) {
      var v = Number(el.value); state.dialBudget = v; setRangeVisual(el, budgetLabel(v));
      document.getElementById('dial-gauge').innerHTML = gaugeSvg(v);
      document.getElementById('dial-value').textContent = v >= B_MAX ? t('dial.noLimit') : money(v);
      return;
    }
    var formId = el.getAttribute && el.getAttribute('data-form');
    if (!formId) return;
    var F = state.forms[formId];
    if (F.sendError) { F.sendError = null; var es = document.getElementById(formId + '-summary'); if (es) es.remove(); }
    F.values[el.name] = el.type === 'checkbox' ? el.checked : el.value;
    if (el.type === 'range') { var lab = reqBudgetFmt(Number(el.value)); setRangeVisual(el, lab); var out = document.getElementById(el.id + '-out'); if (out) out.textContent = lab; }
    if (formId === 'request' && el.name === 'make' && e.type === 'change') { var ml = DATA.models[el.value] || []; if (el.value === 'Other' ? ml.indexOf(F.values.model) > -1 || F.values.model === 'other' : (F.values.model && F.values.model !== 'other' && ml.indexOf(F.values.model) === -1)) F.values.model = ''; }
    if (formId === 'request' && (el.name === 'make' || (el.name === 'model' && el.tagName === 'SELECT')) && e.type === 'change') { if (F.attempted) F.errors = validate('request', REQUEST_STEPS[0]); render({ focus: el.id, preventScroll: true }); return; }
    if (formId === 'request' && el.name === 'contactMethod' && e.type === 'change') { F.values.contactMethod = el.value; if (F.attempted) F.errors = validate('request', REQUEST_STEPS[2]); render({ focus: el.id, preventScroll: true }); return; }
    if (formId === 'request' && el.name === 'flexible' && e.type === 'change') { if (F.attempted) F.errors = validate('request', REQUEST_STEPS[0]); render({ focus: el.id, preventScroll: true }); return; }
    refreshFieldError(formId, el.name);
    if (formId === 'request') { var sum = document.getElementById('req-summary'); if (sum) sum.innerHTML = requestSummaryHtml(); }
  }
  document.addEventListener('input', onFieldChange);
  document.addEventListener('change', function (e) { if (e.target.type === 'checkbox' || e.target.type === 'radio' || e.target.tagName === 'SELECT') onFieldChange(e); });
  document.addEventListener('submit', function (e) { var f = e.target.closest('form[data-form-id]'); if (!f) return; e.preventDefault(); submitForm(f.getAttribute('data-form-id')); });

  /* ambient light: surfaces lit from the cursor (mouse only) */
  var LIT = '.panel, .benefits, .dial-panel, .summary-card, .cine-card', litRaf = 0, litEvt = null;
  document.addEventListener('pointermove', function (e) {
    if (e.pointerType !== 'mouse') return;
    litEvt = e; if (litRaf) return;
    litRaf = requestAnimationFrame(function () {
      litRaf = 0;
      var el = litEvt.target.closest && litEvt.target.closest(LIT); if (!el) return;
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (litEvt.clientX - r.left) + 'px'); el.style.setProperty('--my', (litEvt.clientY - r.top) + 'px');
    });
  }, { passive: true });

  window.addEventListener('hashchange', onRoute);
  onRoute();
})();
