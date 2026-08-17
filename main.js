/* ============================================================================
   Lucie Van Horenbeke — application layer
   ----------------------------------------------------------------------------
   Vanilla ES2020, no build step, no dependencies. Everything degrades:
   the pages are complete and readable in French before this file executes.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ utils */
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const on = (el, ev, fn, opts) => el && el.addEventListener(ev, fn, opts);
  const raf = (fn) => window.requestAnimationFrame(fn);

  const store = {
    get(key, fallback = null) {
      try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
      catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
    },
    del(key) { try { localStorage.removeItem(key); } catch { /* noop */ } }
  };

  const KEYS = {
    lang: "lvh.lang",
    theme: "lvh.theme",
    consent: "lvh.consent",
    draft: "lvh.contact.draft",
    service: "lvh.booking.service",
    recent: "lvh.recent"
  };

  const prefersReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Tiny icon set (stroke icons, 24×24 viewBox) */
  const ICON = {
    search: '<path d="m21 21-4.34-4.34M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    check: '<path d="m20 6-11 11-5-5"/>',
    close: '<path d="M18 6 6 18M6 6l12 12"/>',
    home: '<path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/>',
    grid: '<path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z"/>',
    calendar: '<path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/>',
    mail: '<path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="m22 7-10 6L2 7"/>',
    phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.4 8.4 0 0 1-3.8-.9L3 21l2-4.9A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z"/>',
    top: '<path d="M12 19V5m-7 7 7-7 7 7"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    map: '<path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z"/><circle cx="12" cy="10" r="3"/>'
  };
  const svg = (name, cls = "") =>
    `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name] || ""}</svg>`;

  /* ==========================================================================
     THEME
     ========================================================================== */
  const Theme = {
    apply(mode, announce) {
      const root = document.documentElement;
      if (mode === "system") root.removeAttribute("data-theme");
      else root.setAttribute("data-theme", mode);
      store.set(KEYS.theme, mode);
      const dark = mode === "dark" ||
        (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      const meta = $('meta[name="theme-color"]');
      if (meta) meta.setAttribute("content", dark ? "#0C0B09" : "#FFFFFF");
      $$("[data-theme-toggle]").forEach((b) => b.setAttribute("aria-pressed", String(dark)));
      if (announce) Toast.show(t(dark ? "toast.themeDark" : "toast.themeLight"), "success");
    },
    current() { return store.get(KEYS.theme, "system"); },
    toggle() {
      const dark = document.documentElement.getAttribute("data-theme") === "dark" ||
        (!document.documentElement.hasAttribute("data-theme") &&
          window.matchMedia("(prefers-color-scheme: dark)").matches);
      Theme.apply(dark ? "light" : "dark", true);
    }
  };

  /* ==========================================================================
     I18N
     ========================================================================== */
  const SUPPORTED = (window.LOCALE_META || []).map((l) => l.code);
  let lang = "fr";

  function t(key) {
    const dict = window.LOCALES[lang] || {};
    return dict[key] || (window.LOCALES.fr || {})[key] || key;
  }

  function detectLang() {
    const fromUrl = new URLSearchParams(location.search).get("lang");
    if (fromUrl && SUPPORTED.includes(fromUrl)) return fromUrl;
    const saved = store.get(KEYS.lang);
    if (saved && SUPPORTED.includes(saved)) return saved;
    for (const nav of navigator.languages || [navigator.language || "fr"]) {
      const base = String(nav).slice(0, 2).toLowerCase();
      if (SUPPORTED.includes(base)) return base;
    }
    return "fr";
  }

  function loadLocale(code) {
    if (code === "fr" || window.LOCALES[code]) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "locales/" + code + ".js";
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function applyTranslations() {
    const meta = (window.LOCALE_META || []).find((l) => l.code === lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = (meta && meta.dir) || "ltr";

    $$("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    $$("[data-i18n-attr]").forEach((el) => {
      el.dataset.i18nAttr.split(";").forEach((pair) => {
        const [attr, key] = pair.split(":").map((s) => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });

    // Keep ?lang= on internal links so a shared URL keeps the language.
    $$('a[href]').forEach((a) => {
      const href = a.getAttribute("href");
      if (!href || /^(https?:|mailto:|tel:|#)/.test(href)) return;
      const url = new URL(href, location.href);
      if (url.origin !== location.origin) return;
      if (lang === "fr") url.searchParams.delete("lang");
      else url.searchParams.set("lang", lang);
      a.setAttribute("href", url.pathname.split("/").pop() + url.search + url.hash);
    });

    // Numerals carry a locale-specific decimal separator (5,0 vs 5.0), so the
    // counters read their target from the dictionary rather than the markup.
    $$("[data-count-key]").forEach((el) => {
      const value = t(el.dataset.countKey);
      el.dataset.countTo = value;
      if (el.dataset.counted === "1") el.textContent = value;
    });

    $$("[data-lang-code]").forEach((el) => {
      el.textContent = lang.toUpperCase();
    });
    $$("[data-lang-menu] button").forEach((b) => {
      b.setAttribute("aria-current", String(b.dataset.lang === lang));
    });
    document.dispatchEvent(new CustomEvent("i18n:applied", { detail: { lang } }));
  }

  function setLang(code, { silent = false } = {}) {
    if (!SUPPORTED.includes(code) || code === lang) return;
    loadLocale(code)
      .then(() => {
        lang = code;
        store.set(KEYS.lang, code);
        const url = new URL(location.href);
        if (code === "fr") url.searchParams.delete("lang");
        else url.searchParams.set("lang", code);
        history.replaceState({}, "", url.pathname + (url.search || "") + url.hash);
        applyTranslations();
        if (!silent) {
          const m = (window.LOCALE_META || []).find((l) => l.code === code);
          Toast.show((m ? m.flag + "  " : "") + (m ? m.native : code), "success");
        }
      })
      .catch(() => Toast.show("Translation unavailable", "error"));
  }

  function buildLangMenu() {
    $$("[data-lang-menu]").forEach((menu) => {
      menu.innerHTML =
        `<div class="menu-label">${t("nav.language")}</div>` +
        (window.LOCALE_META || [])
          .map(
            (l) =>
              `<button type="button" role="menuitemradio" data-lang="${l.code}" aria-current="${l.code === lang}">
                 <span class="flag" aria-hidden="true">${l.flag}</span>
                 <span>${l.label}</span>
                 <span class="native">${l.code.toUpperCase()}</span>
               </button>`
          )
          .join("");
    });
  }

  /* ==========================================================================
     TOASTS
     ========================================================================== */
  const Toast = {
    region: null,
    mount() {
      if (Toast.region) return;
      const r = document.createElement("div");
      r.className = "toast-region";
      r.setAttribute("role", "status");
      r.setAttribute("aria-live", "polite");
      document.body.appendChild(r);
      Toast.region = r;
    },
    show(message, kind = "info", ms = 3600) {
      Toast.mount();
      const el = document.createElement("div");
      el.className = "toast toast--" + kind;
      const icon = kind === "success" ? "check" : kind === "error" ? "alert" : "info";
      el.innerHTML =
        svg(icon) +
        `<span>${message}</span>` +
        `<button type="button" class="toast-close" aria-label="${t("common.close")}">${svg("close")}</button>`;
      Toast.region.appendChild(el);
      const kill = () => {
        el.classList.add("is-leaving");
        setTimeout(() => el.remove(), 260);
      };
      on(el.querySelector(".toast-close"), "click", kill);
      setTimeout(kill, ms);
    }
  };

  /* ==========================================================================
     HEADER — scroll state, hide on scroll down, reading progress
     ========================================================================== */
  function initHeader() {
    const header = $("#site-header");
    if (!header) return;
    const bar = $(".progress-bar", header);
    let lastY = window.scrollY;
    let ticking = false;

    const update = () => {
      const y = window.scrollY;
      header.classList.toggle("is-scrolled", y > 12);
      if (header.classList.contains("is-onDark")) {
        header.classList.toggle("is-solid", y > 12);
      }
      const goingDown = y > lastY && y > 320;
      if (!document.body.classList.contains("is-locked")) {
        header.classList.toggle("is-hidden", goingDown && !$(".is-open, [aria-expanded='true']", header));
      }
      lastY = y;
      if (bar) {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.setProperty("--progress", max > 0 ? (y / max).toFixed(4) : 0);
      }
      ticking = false;
    };

    on(window, "scroll", () => {
      if (!ticking) { ticking = true; raf(update); }
    }, { passive: true });
    update();
  }

  /* ==========================================================================
     MEGA MENU (hover + keyboard)
     ========================================================================== */
  function initMega() {
    $$(".nav-item.has-mega").forEach((item) => {
      const trigger = $(".nav-link", item);
      const panel = $(".mega", item);
      if (!trigger || !panel) return;
      let timer;
      const open = () => {
        clearTimeout(timer);
        item.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
      };
      const close = (delay = 120) => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          item.classList.remove("is-open");
          trigger.setAttribute("aria-expanded", "false");
        }, delay);
      };
      on(item, "mouseenter", open);
      on(item, "mouseleave", () => close());
      on(trigger, "focus", open);
      on(trigger, "click", (e) => {
        e.preventDefault();
        item.classList.contains("is-open") ? close(0) : open();
      });
      on(item, "focusout", (e) => {
        if (!item.contains(e.relatedTarget)) close(0);
      });
      on(item, "keydown", (e) => {
        if (e.key === "Escape") { close(0); trigger.focus(); }
      });
    });
  }

  /* ==========================================================================
     MOBILE DRAWER (focus trap + scroll lock)
     ========================================================================== */
  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function trapFocus(container, e) {
    const items = $$(FOCUSABLE, container).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function initDrawer() {
    const drawer = $("#drawer");
    const scrim = $("#scrim");
    const burger = $("#burger");
    if (!drawer || !burger) return;
    let lastFocus = null;

    const open = () => {
      lastFocus = document.activeElement;
      drawer.classList.add("is-open");
      scrim && scrim.classList.add("is-open");
      burger.setAttribute("aria-expanded", "true");
      drawer.removeAttribute("aria-hidden");
      document.body.classList.add("is-locked");
      const first = $(FOCUSABLE, drawer);
      first && first.focus();
    };
    const close = () => {
      drawer.classList.remove("is-open");
      scrim && scrim.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      drawer.setAttribute("aria-hidden", "true");
      document.body.classList.remove("is-locked");
      lastFocus && lastFocus.focus();
    };

    on(burger, "click", () => (drawer.classList.contains("is-open") ? close() : open()));
    on(scrim, "click", close);
    $$("[data-drawer-close]", drawer).forEach((b) => on(b, "click", close));
    $$("a", drawer).forEach((a) => on(a, "click", close));
    on(drawer, "keydown", (e) => {
      if (e.key === "Escape") close();
      if (e.key === "Tab") trapFocus(drawer, e);
    });
    on(window, "resize", () => {
      if (window.innerWidth > 1023 && drawer.classList.contains("is-open")) close();
    });
  }

  /* ==========================================================================
     SCROLL REVEAL + COUNTERS
     ========================================================================== */
  function initReveal() {
    const items = $$("[data-reveal]");
    if (!items.length) return;
    if (prefersReduced() || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("is-revealed"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const group = el.closest("[data-reveal-group]");
          if (group) {
            const sibs = $$("[data-reveal]", group);
            el.style.setProperty("--reveal-delay", Math.min(sibs.indexOf(el), 8) * 70 + "ms");
          }
          el.classList.add("is-revealed");
          io.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach((el) => io.observe(el));
  }

  function initCounters() {
    const nodes = $$("[data-count-to]");
    if (!nodes.length) return;
    if (prefersReduced() || !("IntersectionObserver" in window)) {
      nodes.forEach((n) => { n.textContent = n.dataset.countTo; n.dataset.counted = "1"; });
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const raw = el.dataset.countTo;
          const decimals = (raw.split(/[.,]/)[1] || "").length;
          const sep = raw.includes(",") ? "," : ".";
          const target = parseFloat(raw.replace(",", "."));
          const dur = 1200;
          const start = performance.now();
          const tick = (now) => {
            const p = Math.min((now - start) / dur, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            const val = (target * eased).toFixed(decimals);
            el.textContent = decimals ? val.replace(".", sep) : val;
            if (p < 1) raf(tick);
            else el.dataset.counted = "1";
          };
          raf(tick);
          io.unobserve(el);
        });
      },
      { threshold: 0.6 }
    );
    nodes.forEach((n) => io.observe(n));
  }

  /* ==========================================================================
     ACCORDION + FAQ FILTER
     ========================================================================== */
  function initAccordion() {
    $$(".acc-item").forEach((item) => {
      const trigger = $(".acc-trigger", item);
      const panel = $(".acc-panel", item);
      if (!trigger || !panel) return;
      on(trigger, "click", () => {
        const open = item.classList.toggle("is-open");
        trigger.setAttribute("aria-expanded", String(open));
        if (open && item.id) history.replaceState({}, "", "#" + item.id);
      });
    });

    // Deep-link: /services.html#faq-3 opens that entry — on load and on any
    // later hash change, so links shared between pages land open too.
    const openFromHash = () => {
      const hash = location.hash.slice(1);
      if (!hash) return;
      const target = document.getElementById(hash);
      if (!target || !target.classList.contains("acc-item")) return;
      target.classList.add("is-open");
      $(".acc-trigger", target).setAttribute("aria-expanded", "true");
      target.scrollIntoView({ behavior: prefersReduced() ? "auto" : "smooth", block: "start" });
    };
    openFromHash();
    on(window, "hashchange", openFromHash);
  }

  function initFaqFilter() {
    const input = $("#faqSearch");
    const list = $("#faqList");
    const empty = $("#faqEmpty");
    if (!input || !list) return;
    const run = () => {
      const q = input.value.trim().toLowerCase();
      let visible = 0;
      $$(".acc-item", list).forEach((item) => {
        const hit = !q || item.textContent.toLowerCase().includes(q);
        item.hidden = !hit;
        if (hit) visible++;
      });
      if (empty) empty.hidden = visible !== 0;
    };
    on(input, "input", run);
    on(input, "keydown", (e) => {
      if (e.key === "Escape") { input.value = ""; run(); }
    });
  }

  /* ==========================================================================
     COPY TO CLIPBOARD
     ========================================================================== */
  function initCopy() {
    $$("[data-copy]").forEach((btn) => {
      on(btn, "click", async (e) => {
        e.preventDefault();
        try {
          await navigator.clipboard.writeText(btn.dataset.copy);
          Toast.show(t("toast.copied"), "success");
        } catch {
          Toast.show(btn.dataset.copy, "info", 6000);
        }
      });
    });
  }

  /* ==========================================================================
     BACK TO TOP
     ========================================================================== */
  function initBackTop() {
    const btn = $("#backTop");
    if (!btn) return;
    on(window, "scroll", () => {
      btn.classList.toggle("is-visible", window.scrollY > 700);
    }, { passive: true });
    on(btn, "click", () => {
      window.scrollTo({ top: 0, behavior: prefersReduced() ? "auto" : "smooth" });
      const skip = $(".skip-link");
      skip && skip.focus({ preventScroll: true });
    });
  }

  /* ==========================================================================
     SCROLLSPY (table of contents / in-page nav)
     ========================================================================== */
  function initSpy() {
    const nav = $("[data-spy]");
    if (!nav || !("IntersectionObserver" in window)) return;
    const links = $$("a[href^='#']", nav);
    const targets = links
      .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
      .filter(Boolean);
    if (!targets.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((a) =>
            a.classList.toggle("is-active", a.getAttribute("href") === "#" + entry.target.id)
          );
        });
      },
      { rootMargin: "-20% 0px -70% 0px" }
    );
    targets.forEach((el) => io.observe(el));
  }

  /* ==========================================================================
     CONSENT (GDPR) — no tracking cookies; gates third-party embeds only
     ========================================================================== */
  const Consent = {
    state() { return store.get(KEYS.consent, null); },
    allowed() { return Consent.state() === "all"; },
    save(value) {
      store.set(KEYS.consent, value);
      const banner = $("#consent");
      banner && banner.classList.remove("is-open");
      if (value === "all") Consent.releaseEmbeds();
      Toast.show(t("toast.consentSaved"), "success");
    },
    releaseEmbeds() {
      $$("[data-embed-gate]").forEach((gate) => {
        const src = gate.dataset.embedSrc;
        if (!src || gate.dataset.loaded === "1") return;
        const frame = document.createElement("iframe");
        frame.src = src;
        frame.title = gate.dataset.embedTitle || "";
        frame.loading = "lazy";
        frame.referrerPolicy = "no-referrer-when-downgrade";
        frame.style.cssText = "width:100%;height:100%;border:0;display:block;min-height:280px";
        frame.setAttribute("allowfullscreen", "");
        gate.replaceChildren(frame);
        gate.dataset.loaded = "1";
        gate.classList.remove("embed-gate");
      });
    },
    mountGates() {
      $$("[data-embed-gate]").forEach((gate) => {
        if (gate.dataset.loaded === "1") return;
        gate.classList.add("embed-gate");
        gate.innerHTML =
          `<div>${svg("map")}</div>` +
          `<strong>${t("consent.gateTitle")}</strong>` +
          `<p>${t("consent.gateText")}</p>` +
          `<button type="button" class="btn btn--secondary btn--sm">${t("consent.gateBtn")}</button>`;
        on($("button", gate), "click", () => Consent.save("all"));
      });
    },
    init() {
      if (Consent.allowed()) { Consent.releaseEmbeds(); }
      else { Consent.mountGates(); }
      if (Consent.state()) return;

      const banner = document.createElement("aside");
      banner.id = "consent";
      banner.className = "consent";
      banner.setAttribute("role", "dialog");
      banner.setAttribute("aria-labelledby", "consent-title");
      banner.innerHTML = `
        <h2 id="consent-title">${t("consent.title")}</h2>
        <p>${t("consent.text")} <a href="mentions-legales.html#cookies">${t("consent.more")}</a></p>
        <div class="consent-actions">
          <button type="button" class="btn btn--secondary btn--sm" data-consent="necessary">${t("consent.reject")}</button>
          <button type="button" class="btn btn--primary btn--sm" data-consent="all">${t("consent.accept")}</button>
        </div>`;
      document.body.appendChild(banner);
      setTimeout(() => banner.classList.add("is-open"), 900);
      $$("[data-consent]", banner).forEach((b) =>
        on(b, "click", () => Consent.save(b.dataset.consent))
      );
    }
  };

  /* ==========================================================================
     RECENTLY VIEWED
     ========================================================================== */
  function trackRecent() {
    const page = document.body.dataset.page;
    if (!page) return;
    const title = document.title.split("—")[0].trim();
    const list = (store.get(KEYS.recent, []) || []).filter((r) => r.href !== location.pathname.split("/").pop());
    list.unshift({ href: location.pathname.split("/").pop() || "index.html", title, page });
    store.set(KEYS.recent, list.slice(0, 4));
  }

  /* ==========================================================================
     BOOT
     ========================================================================== */
  function boot() {
    Theme.apply(Theme.current(), false);

    lang = detectLang();
    const startup = lang === "fr" ? Promise.resolve() : loadLocale(lang).catch(() => { lang = "fr"; });
    startup.then(() => {
      buildLangMenu();
      applyTranslations();
      Consent.init();
    });

    initHeader();
    initMega();
    initDrawer();
    initReveal();
    initCounters();
    initAccordion();
    initFaqFilter();
    initCopy();
    initBackTop();
    initSpy();
    trackRecent();

    // Theme + language controls
    $$("[data-theme-toggle]").forEach((b) => on(b, "click", Theme.toggle));
    $$("[data-lang-switcher]").forEach((sw) => {
      const trigger = $("[data-lang-trigger]", sw);
      const menu = $("[data-lang-menu]", sw);
      on(trigger, "click", (e) => {
        e.stopPropagation();
        const open = sw.classList.toggle("is-open");
        trigger.setAttribute("aria-expanded", String(open));
      });
      on(menu, "click", (e) => {
        const btn = e.target.closest("button[data-lang]");
        if (!btn) return;
        setLang(btn.dataset.lang);
        sw.classList.remove("is-open");
        trigger.setAttribute("aria-expanded", "false");
      });
      on(document, "click", (e) => {
        if (!sw.contains(e.target)) {
          sw.classList.remove("is-open");
          trigger && trigger.setAttribute("aria-expanded", "false");
        }
      });
      on(sw, "keydown", (e) => {
        if (e.key === "Escape") {
          sw.classList.remove("is-open");
          trigger.setAttribute("aria-expanded", "false");
          trigger.focus();
        }
      });
    });

    // Expose the pieces the page-level modules need.
    window.LVH = { t, svg, $, $$, on, store, KEYS, Toast, Theme, setLang, prefersReduced, ICON };
    document.dispatchEvent(new CustomEvent("lvh:ready"));
  }

  if (document.readyState === "loading") on(document, "DOMContentLoaded", boot);
  else boot();
})();
