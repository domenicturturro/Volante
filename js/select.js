/* =========================================================================
   VOLANTE — styled dropdowns
   Replaces the look of the form's <select> menus with a clean box and a
   floating menu card (search box for long lists). The real <select> stays
   in the page, hidden, so the form works exactly as before: picking an
   option sets the select and fires its normal "change" event.
   Phones and tablets keep their built-in pickers, which work better there.
   ========================================================================= */
(function () {
  var FINE = !window.matchMedia || window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var SEARCH_FROM = 9; // lists with this many options or more get a search box
  var CHEV = '<svg class="dd-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  var CHECK = '<svg class="dd-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 10 17.5 19 7"/></svg>';
  var SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg>';
  var cur = null; // the open menu

  function txt(k, fallback) { var f = window.VOLANTE_DD_TEXT; return (f && f(k)) || fallback; }

  function enhance(root) {
    if (cur && !document.contains(cur.wrap)) cur = null;
    if (!FINE) return;
    Array.prototype.forEach.call((root || document).querySelectorAll('.form select'), build);
  }

  function build(sel) {
    if (sel.getAttribute('data-dd')) return;
    sel.setAttribute('data-dd', '1');
    var wrap = document.createElement('div');
    wrap.className = 'dd';
    sel.parentNode.insertBefore(wrap, sel);
    wrap.appendChild(sel);
    sel.classList.add('dd-native');
    sel.tabIndex = -1;
    sel.setAttribute('aria-hidden', 'true');

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dd-btn';
    btn.id = sel.id + '-dd';
    btn.disabled = sel.disabled;
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    var label = document.querySelector('label[for="' + sel.id + '"]');
    if (label) { if (!label.id) label.id = sel.id + '-lbl'; btn.setAttribute('aria-labelledby', label.id + ' ' + btn.id); }
    if (sel.getAttribute('aria-describedby')) btn.setAttribute('aria-describedby', sel.getAttribute('aria-describedby'));
    if (sel.getAttribute('aria-invalid') === 'true') btn.setAttribute('aria-invalid', 'true');
    btn.innerHTML = '<span class="dd-val"></span>' + CHEV;
    wrap.appendChild(btn);
    sync(sel, btn);

    // anything that focuses the hidden select (its label, re-render focus) lands on the button
    sel.addEventListener('focus', function () { btn.focus(); });
    btn.addEventListener('click', function () { if (cur && cur.sel === sel) close(true); else open(sel, btn, wrap, label); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(sel, btn, wrap, label); }
    });
  }

  function sync(sel, btn) {
    var o = sel.options[sel.selectedIndex];
    btn.querySelector('.dd-val').textContent = o ? o.text : '';
    btn.classList.toggle('is-placeholder', !sel.value && sel.getAttribute('aria-required') === 'true');
  }

  function open(sel, btn, wrap, label) {
    close();
    var required = sel.getAttribute('aria-required') === 'true';
    // a required list doesn't offer its "Choose…" placeholder as an option
    var items = Array.prototype.map.call(sel.options, function (o, i) { return { i: i, text: o.text, value: o.value }; })
      .filter(function (x) { return !(required && x.value === ''); });
    var menu = document.createElement('div');
    menu.className = 'dd-menu';
    var search = null;
    if (items.length >= SEARCH_FROM) {
      menu.innerHTML = '<div class="dd-search">' + SEARCH + '<input type="text" autocomplete="off" spellcheck="false" placeholder="' + txt('search', 'Rechercher') + '"></div>';
      search = menu.querySelector('input');
      search.setAttribute('aria-controls', sel.id + '-list');
      if (label) search.setAttribute('aria-labelledby', label.id);
    }
    var list = document.createElement('ul');
    list.className = 'dd-list';
    list.id = sel.id + '-list';
    list.setAttribute('role', 'listbox');
    list.tabIndex = -1;
    if (label) list.setAttribute('aria-labelledby', label.id);
    menu.appendChild(list);
    wrap.appendChild(menu);

    cur = { sel: sel, btn: btn, wrap: wrap, menu: menu, list: list, search: search, items: items, shown: items, active: -1, typed: '', typedAt: 0 };
    paint();
    var start = 0;
    items.forEach(function (x, n) { if (x.i === sel.selectedIndex) start = n; });
    setActive(start);

    // open upward when there isn't room below
    var r = btn.getBoundingClientRect(), below = window.innerHeight - r.bottom, need = Math.min(menu.scrollHeight, 360) + 16;
    wrap.classList.toggle('dd-up', below < need && r.top > below);
    wrap.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');

    var focusEl = search || list;
    focusEl.focus({ preventScroll: true });
    focusEl.addEventListener('keydown', onKey);
    if (search) search.addEventListener('input', function () { filter(search.value); });
  }

  function paint() {
    var c = cur;
    c.list.innerHTML = '';
    if (!c.shown.length) {
      var none = document.createElement('li');
      none.className = 'dd-none';
      none.textContent = txt('noMatch', 'Aucun résultat');
      c.list.appendChild(none);
      return;
    }
    c.shown.forEach(function (x, n) {
      var li = document.createElement('li');
      li.id = c.sel.id + '-opt' + x.i;
      li.className = 'dd-opt';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', x.i === c.sel.selectedIndex ? 'true' : 'false');
      li.innerHTML = '<span></span>' + CHECK;
      li.firstChild.textContent = x.text;
      li.addEventListener('mousemove', function () { if (c.active !== n) setActive(n, true); });
      li.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep focus in the menu
      li.addEventListener('click', function () { choose(x.i); });
      c.list.appendChild(li);
    });
  }

  function filter(q) {
    var c = cur;
    q = norm(q);
    c.shown = q ? c.items.filter(function (x) { return norm(x.text).indexOf(q) > -1; }) : c.items;
    paint();
    setActive(c.shown.length ? 0 : -1);
  }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function setActive(n, fromMouse) {
    var c = cur;
    c.active = n;
    Array.prototype.forEach.call(c.list.children, function (li, k) { li.classList.toggle('is-active', k === n); });
    var li = c.list.children[n];
    var owner = c.search || c.list;
    if (li && li.id) {
      owner.setAttribute('aria-activedescendant', li.id);
      if (!fromMouse) li.scrollIntoView({ block: 'nearest' });
    } else owner.removeAttribute('aria-activedescendant');
  }

  function onKey(e) {
    var c = cur;
    if (!c) return;
    var n = c.shown.length;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (n) setActive(Math.min(n - 1, c.active + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) setActive(Math.max(0, c.active - 1)); }
    else if (e.key === 'Home' && !c.search) { e.preventDefault(); if (n) setActive(0); }
    else if (e.key === 'End' && !c.search) { e.preventDefault(); if (n) setActive(n - 1); }
    else if (e.key === 'Enter' || (e.key === ' ' && !c.search)) { e.preventDefault(); if (c.shown[c.active]) choose(c.shown[c.active].i); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') { close(); }
    else if (!c.search && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      // type to jump: "4" → 48 mois, "n" → Noir
      var now = Date.now();
      c.typed = (now - c.typedAt < 700 ? c.typed : '') + norm(e.key);
      c.typedAt = now;
      for (var k = 0; k < n; k++) if (norm(c.shown[k].text).indexOf(c.typed) === 0) { setActive(k); break; }
    }
  }

  function choose(i) {
    var c = cur;
    var changed = c.sel.selectedIndex !== i;
    c.sel.selectedIndex = i;
    sync(c.sel, c.btn);
    close(true);
    if (changed) c.sel.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function close(refocus) {
    var c = cur;
    if (!c) return;
    cur = null;
    if (c.menu.parentNode) c.menu.parentNode.removeChild(c.menu);
    c.wrap.classList.remove('open', 'dd-up');
    c.btn.setAttribute('aria-expanded', 'false');
    if (refocus && document.contains(c.btn)) c.btn.focus({ preventScroll: true });
  }

  // click anywhere else closes the menu
  document.addEventListener('mousedown', function (e) { if (cur && !cur.wrap.contains(e.target)) close(); });
  // keep the box in step if the page changes the select's value itself
  document.addEventListener('change', function (e) {
    var s = e.target;
    if (s && s.tagName === 'SELECT' && s.getAttribute('data-dd')) { var b = document.getElementById(s.id + '-dd'); if (b) sync(s, b); }
  });

  window.VolanteSelect = { enhance: enhance, close: close };
})();
