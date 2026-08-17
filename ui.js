/* ============================================================================
   Command palette (⌘K / Ctrl+K) + global keyboard shortcuts
   Depends on main.js (window.LVH).
   ========================================================================== */
(function () {
  "use strict";

  function start(LVH) {
    const { t, svg, $, $$, on, store, KEYS, Toast, Theme, prefersReduced } = LVH;

    const PAGES = [
      { key: "nav.home",     href: "index.html",            icon: "home" },
      { key: "nav.about",    href: "about.html",            icon: "user" },
      { key: "nav.services", href: "services.html",         icon: "grid" },
      { key: "nav.booking",  href: "booking.html",          icon: "calendar" },
      { key: "nav.contact",  href: "contact.html",          icon: "mail" },
      { key: "nav.legal",    href: "mentions-legales.html", icon: "info" }
    ];

    const SERVICES = [
      { key: "svc.coaching",   href: "services.html#coaching" },
      { key: "svc.pilates",    href: "services.html#pilates" },
      { key: "svc.collectif",  href: "services.html#collectif" },
      { key: "svc.smallgroup", href: "services.html#smallgroup" },
      { key: "svc.online",     href: "services.html#online" },
      { key: "svc.mixte",      href: "services.html#mixte" }
    ];

    const FAQS = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
      key: "faq.q" + n,
      href: "services.html#faq-" + n
    }));

    const ACTIONS = [
      { key: "cmdk.act.book",     icon: "calendar", run: () => (location.href = "booking.html") },
      { key: "cmdk.act.whatsapp", icon: "chat",     run: () => window.open("https://wa.me/32475305861", "_blank", "noopener") },
      { key: "cmdk.act.call",     icon: "phone",    run: () => (location.href = "tel:+32475305861") },
      { key: "cmdk.act.email",    icon: "mail",     run: () => (location.href = "mailto:lucie.coach.pt@gmail.com") },
      { key: "cmdk.act.theme",    icon: "moon",     run: () => Theme.toggle() },
      { key: "cmdk.act.top",      icon: "top",      run: () => window.scrollTo({ top: 0, behavior: prefersReduced() ? "auto" : "smooth" }) }
    ];

    /* --------------------------------------------------------------- markup */
    const scrim = document.createElement("div");
    scrim.className = "cmdk-scrim";
    scrim.id = "cmdk";
    scrim.innerHTML = `
      <div class="cmdk" role="dialog" aria-modal="true" aria-label="${t("nav.searchLabel")}">
        <div class="cmdk-search">
          ${svg("search")}
          <input type="search" id="cmdk-input" role="combobox" autocomplete="off" spellcheck="false"
                 aria-expanded="true" aria-controls="cmdk-list" aria-autocomplete="list"
                 placeholder="${t("cmdk.placeholder")}" />
          <kbd class="key">Esc</kbd>
        </div>
        <div class="cmdk-list" id="cmdk-list" role="listbox" aria-label="${t("nav.searchLabel")}"></div>
        <div class="cmdk-foot">
          <span><kbd class="key">↑</kbd><kbd class="key">↓</kbd> ${t("cmdk.navigate")}</span>
          <span><kbd class="key">↵</kbd> ${t("cmdk.select")}</span>
          <span style="margin-left:auto"><kbd class="key">Esc</kbd> ${t("cmdk.close")}</span>
        </div>
      </div>`;
    document.body.appendChild(scrim);

    const input = $("#cmdk-input", scrim);
    const list = $("#cmdk-list", scrim);
    let items = [];
    let cursor = 0;
    let lastFocus = null;

    /* ---------------------------------------------------------------- index */
    function buildIndex() {
      const out = [];
      PAGES.forEach((p) =>
        out.push({ group: t("cmdk.pages"), title: t(p.key), sub: p.href, icon: p.icon, href: p.href })
      );
      SERVICES.forEach((s) =>
        out.push({
          group: t("cmdk.services"),
          title: t(s.key + ".name"),
          sub: t(s.key + ".desc"),
          icon: "grid",
          href: s.href
        })
      );
      FAQS.forEach((f) =>
        out.push({ group: t("cmdk.faq"), title: t(f.key), sub: "", icon: "help", href: f.href })
      );
      ACTIONS.forEach((a) =>
        out.push({ group: t("cmdk.actions"), title: t(a.key), sub: "", icon: a.icon, run: a.run })
      );

      const recent = store.get(KEYS.recent, []) || [];
      recent.slice(0, 3).forEach((r) =>
        out.push({ group: t("cmdk.recent"), title: r.title, sub: r.href, icon: "top", href: r.href })
      );
      return out;
    }
    let INDEX = buildIndex();
    on(document, "i18n:applied", () => {
      INDEX = buildIndex();
      input.placeholder = t("cmdk.placeholder");
      if (scrim.classList.contains("is-open")) render(input.value);
    });

    /* -------------------------------------------------------------- matching */
    const norm = (s) =>
      String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    function score(entry, q) {
      if (!q) return 1;
      const hay = norm(entry.title + " " + (entry.sub || ""));
      const idx = hay.indexOf(q);
      if (idx === 0) return 100;
      if (idx > 0) return 60 - Math.min(idx, 40);
      // loose subsequence match
      let i = 0;
      for (const ch of hay) if (ch === q[i]) i++;
      return i === q.length ? 20 : 0;
    }

    function highlight(text, q) {
      if (!q) return text;
      const i = norm(text).indexOf(q);
      if (i < 0) return text;
      return (
        text.slice(0, i) + "<mark>" + text.slice(i, i + q.length) + "</mark>" + text.slice(i + q.length)
      );
    }

    function render(query) {
      const q = norm(query.trim());
      const ranked = INDEX.map((e) => ({ e, s: score(e, q) }))
        .filter((r) => r.s > 0)
        .sort((a, b) => b.s - a.s)
        .map((r) => r.e);

      items = ranked.slice(0, 24);
      cursor = 0;

      if (!items.length) {
        list.innerHTML = `<div class="cmdk-empty"><div class="ico">🔍</div><strong>${t(
          "cmdk.empty"
        )}</strong><div>${t("cmdk.emptyHint")}</div></div>`;
        return;
      }

      let html = "";
      let group = null;
      items.forEach((e, i) => {
        if (e.group !== group) {
          if (group !== null) html += "</div>";
          group = e.group;
          html += `<div class="cmdk-group"><div class="cmdk-group-label">${group}</div>`;
        }
        html += `<button type="button" class="cmdk-item" role="option" data-i="${i}" aria-selected="${i === 0}">
            <span class="ico">${svg(e.icon)}</span>
            <span class="txt">
              <span class="title">${highlight(e.title, q)}</span>
              ${e.sub ? `<span class="sub">${e.sub}</span>` : ""}
            </span>
            <span class="hint">↵</span>
          </button>`;
      });
      html += "</div>";
      list.innerHTML = html;
    }

    function move(delta) {
      const nodes = $$(".cmdk-item", list);
      if (!nodes.length) return;
      nodes[cursor] && nodes[cursor].setAttribute("aria-selected", "false");
      cursor = (cursor + delta + nodes.length) % nodes.length;
      const active = nodes[cursor];
      active.setAttribute("aria-selected", "true");
      active.scrollIntoView({ block: "nearest" });
    }

    function run(i) {
      const entry = items[i];
      if (!entry) return;
      close();
      if (entry.run) entry.run();
      else if (entry.href) {
        const url = new URL(entry.href, location.href);
        const cur = new URLSearchParams(location.search).get("lang");
        if (cur) url.searchParams.set("lang", cur);
        location.href = url.pathname.split("/").pop() + url.search + url.hash;
      }
    }

    /* ------------------------------------------------------------- open/close */
    function open(prefill = "") {
      lastFocus = document.activeElement;
      scrim.classList.add("is-open");
      document.body.classList.add("is-locked");
      input.value = prefill;
      render(prefill);
      setTimeout(() => input.focus(), 30);
    }
    function close() {
      scrim.classList.remove("is-open");
      document.body.classList.remove("is-locked");
      lastFocus && lastFocus.focus && lastFocus.focus();
    }

    on(input, "input", () => render(input.value));
    on(list, "click", (e) => {
      const btn = e.target.closest(".cmdk-item");
      if (btn) run(Number(btn.dataset.i));
    });
    on(list, "mousemove", (e) => {
      const btn = e.target.closest(".cmdk-item");
      if (!btn) return;
      const i = Number(btn.dataset.i);
      if (i === cursor) return;
      $$(".cmdk-item", list).forEach((n) => n.setAttribute("aria-selected", "false"));
      btn.setAttribute("aria-selected", "true");
      cursor = i;
    });
    on(scrim, "click", (e) => { if (e.target === scrim) close(); });
    on(scrim, "keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); close(); }
      else if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "Home") { e.preventDefault(); cursor = 0; move(0); }
      else if (e.key === "Enter") { e.preventDefault(); run(cursor); }
      else if (e.key === "Tab") {
        const f = $$('button, input, [href]', scrim).filter((el) => el.offsetParent !== null);
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });

    $$("[data-cmdk-open]").forEach((b) => on(b, "click", () => open()));

    /* ---------------------------------------------------------- shortcuts */
    const isTyping = (el) =>
      el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

    on(document, "keydown", (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        scrim.classList.contains("is-open") ? close() : open();
        return;
      }
      if (scrim.classList.contains("is-open") || isTyping(document.activeElement)) return;

      if (e.key === "/") { e.preventDefault(); open(); }
      else if (e.key.toLowerCase() === "b" && !mod) location.href = "booking.html";
      else if (e.key.toLowerCase() === "t" && !mod) Theme.toggle();
      else if (e.key === "?" ) {
        e.preventDefault();
        Toast.show(
          "⌘K " + t("nav.search") + " · B " + t("nav.book") + " · T " + t("nav.theme"),
          "info",
          6000
        );
      }
    });

    // Detect platform for the ⌘/Ctrl hint in the header.
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    $$("[data-kbd-mod]").forEach((el) => (el.textContent = isMac ? "⌘" : "Ctrl"));

    window.LVH.cmdk = { open, close };
  }

  if (window.LVH) start(window.LVH);
  else document.addEventListener("lvh:ready", () => start(window.LVH), { once: true });
})();
