/* Recette navigateur : pilote Edge via puppeteer-core sur le site servi en local. */
const puppeteer = require("puppeteer-core");
const fs = require("fs");
const path = require("path");

const EDGE = process.env.BROWSER_PATH ||
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const BASE = process.env.BASE_URL || "http://127.0.0.1:8765";
const SHOTS = process.argv[2] || ".";

const results = [];
const ok = (m) => { results.push(["ok", m]); console.log("  ✓ " + m); };
const ko = (m) => { results.push(["ko", m]); console.log("  ✗ " + m); };

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: "new",
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"]
  });

  const pageErrors = [];
  const consoleErrors = [];

  async function newPage(width = 1440, height = 960, opts = {}) {
    const p = await browser.newPage();
    await p.setViewport({ width, height, deviceScaleFactor: 1 });
    await p.emulateMediaFeatures([
      { name: "prefers-color-scheme", value: opts.scheme || "light" }
    ]);
    if (!opts.keepState) {
      const c = await browser.defaultBrowserContext();
      await p.evaluateOnNewDocument(() => { try { localStorage.clear(); } catch (e) {} });
    }
    p.on("pageerror", (e) => pageErrors.push(e.message));
    p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
    p.on("requestfailed", (r) => {
      const u = r.url();
      if (u.startsWith(BASE)) consoleErrors.push("requête échouée: " + u);
    });
    return p;
  }

  const pages = ["index.html", "services.html", "about.html", "booking.html", "contact.html", "mentions-legales.html", "404.html"];

  /* ---------------------------------------------- 1. chargement de chaque page */
  console.log("\n1. Chargement des pages (1440px)");
  for (const file of pages) {
    const p = await newPage();
    const before = pageErrors.length + consoleErrors.length;
    await p.goto(`${BASE}/${file}`, { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise((r) => setTimeout(r, 500));

    const info = await p.evaluate(() => ({
      title: document.title,
      lang: document.documentElement.lang,
      header: !!document.querySelector("#site-header"),
      footer: !!document.querySelector(".site-footer"),
      main: !!document.querySelector("main#main"),
      h1: document.querySelectorAll("h1").length,
      cmdk: !!document.querySelector("#cmdk"),
      untranslated: [...document.querySelectorAll("[data-i18n]")]
        .filter((el) => el.textContent.trim() === el.dataset.i18n).length,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      imgNoAlt: [...document.querySelectorAll("img")].filter((i) => !i.hasAttribute("alt")).length,
      brokenImg: [...document.querySelectorAll("img")].filter((i) => i.complete && i.naturalWidth === 0).length
    }));

    const added = (pageErrors.length + consoleErrors.length) - before;
    const problems = [];
    if (!info.header || !info.footer || !info.main) problems.push("structure incomplète");
    if (info.h1 !== 1) problems.push(`${info.h1} <h1>`);
    if (!info.cmdk) problems.push("palette non montée");
    if (info.untranslated) problems.push(`${info.untranslated} clés non résolues`);
    if (info.overflow) problems.push("débordement horizontal");
    if (info.imgNoAlt) problems.push(`${info.imgNoAlt} img sans alt`);
    if (info.brokenImg) problems.push(`${info.brokenImg} img cassée(s)`);
    if (added) problems.push(`${added} erreur(s) JS`);

    problems.length ? ko(`${file} — ${problems.join(", ")}`) : ok(`${file} — ${info.title.slice(0, 42)}…`);
    await p.screenshot({ path: path.join(SHOTS, "desktop-" + file.replace(".html", "") + ".png"), fullPage: false });
    await p.close();
  }

  /* ---------------------------------------------- 2. responsive */
  console.log("\n2. Responsive (débordement horizontal)");
  for (const [w, h, label] of [[390, 844, "mobile"], [768, 1024, "tablette"], [1280, 800, "portable"], [1920, 1080, "large"]]) {
    const p = await newPage(w, h);
    let bad = [];
    for (const file of ["index.html", "services.html", "contact.html", "booking.html"]) {
      await p.goto(`${BASE}/${file}`, { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 350));
      const over = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      if (over) bad.push(file);
    }
    bad.length ? ko(`${label} ${w}px — débordement sur ${bad.join(", ")}`) : ok(`${label} ${w}px — aucun débordement`);
    if (label === "mobile") {
      await p.goto(`${BASE}/index.html`, { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 400));
      await p.screenshot({ path: path.join(SHOTS, "mobile-index.png"), fullPage: false });
    }
    await p.close();
  }

  /* ---------------------------------------------- 3. tiroir mobile */
  console.log("\n3. Tiroir mobile");
  {
    const p = await newPage(390, 844);
    await p.goto(`${BASE}/index.html`, { waitUntil: "networkidle2" });
    await p.click("#burger");
    await new Promise((r) => setTimeout(r, 500));
    const open = await p.evaluate(() => ({
      visible: document.querySelector("#drawer").classList.contains("is-open"),
      expanded: document.querySelector("#burger").getAttribute("aria-expanded"),
      locked: document.body.classList.contains("is-locked"),
      focusInside: document.querySelector("#drawer").contains(document.activeElement)
    }));
    open.visible && open.expanded === "true" && open.locked ? ok("ouverture + verrouillage du défilement") : ko("ouverture: " + JSON.stringify(open));
    open.focusInside ? ok("focus déplacé dans le tiroir") : ko("focus non déplacé dans le tiroir");
    await p.screenshot({ path: path.join(SHOTS, "mobile-drawer.png") });
    await p.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 450));
    const closed = await p.evaluate(() => !document.querySelector("#drawer").classList.contains("is-open"));
    closed ? ok("fermeture par Échap") : ko("Échap ne ferme pas le tiroir");
    await p.close();
  }

  /* ---------------------------------------------- 4. palette de commandes */
  console.log("\n4. Palette de commandes");
  {
    const p = await newPage();
    await p.goto(`${BASE}/index.html`, { waitUntil: "networkidle2" });
    await p.keyboard.down("Control"); await p.keyboard.press("KeyK"); await p.keyboard.up("Control");
    await new Promise((r) => setTimeout(r, 400));
    let st = await p.evaluate(() => ({
      open: document.querySelector("#cmdk").classList.contains("is-open"),
      focused: document.activeElement && document.activeElement.id === "cmdk-input",
      items: document.querySelectorAll(".cmdk-item").length
    }));
    st.open ? ok("Ctrl+K ouvre la palette") : ko("Ctrl+K n’ouvre pas la palette");
    st.focused ? ok("champ de recherche focalisé") : ko("champ non focalisé");
    st.items > 5 ? ok(`${st.items} entrées indexées`) : ko(`seulement ${st.items} entrées`);

    await p.type("#cmdk-input", "pilates");
    await new Promise((r) => setTimeout(r, 300));
    const filtered = await p.evaluate(() => ({
      n: document.querySelectorAll(".cmdk-item").length,
      first: (document.querySelector(".cmdk-item .title") || {}).textContent || "",
      marked: document.querySelectorAll(".cmdk-item mark").length
    }));
    filtered.n > 0 && /pil/i.test(filtered.first) ? ok(`recherche « pilates » → ${filtered.n} résultats, 1er : ${filtered.first.trim().slice(0, 40)}`) : ko("recherche sans résultat pertinent: " + JSON.stringify(filtered));
    filtered.marked > 0 ? ok("termes surlignés dans les résultats") : ko("pas de surlignage");
    await p.screenshot({ path: path.join(SHOTS, "palette.png") });

    await p.keyboard.press("ArrowDown");
    await new Promise((r) => setTimeout(r, 150));
    const moved = await p.evaluate(() => [...document.querySelectorAll(".cmdk-item")].findIndex((n) => n.getAttribute("aria-selected") === "true"));
    moved === 1 ? ok("navigation clavier ↓") : ko("navigation clavier: index " + moved);

    await p.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 300));
    const cl = await p.evaluate(() => !document.querySelector("#cmdk").classList.contains("is-open"));
    cl ? ok("fermeture par Échap") : ko("Échap ne ferme pas la palette");

    // accent-insensible
    await p.keyboard.down("Control"); await p.keyboard.press("KeyK"); await p.keyboard.up("Control");
    await new Promise((r) => setTimeout(r, 300));
    await p.type("#cmdk-input", "reserv");
    await new Promise((r) => setTimeout(r, 300));
    const accent = await p.evaluate(() => document.querySelectorAll(".cmdk-item").length);
    accent > 0 ? ok(`recherche insensible aux accents (« reserv » → ${accent})`) : ko("recherche sensible aux accents");
    await p.close();
  }

  /* ---------------------------------------------- 5. i18n */
  console.log("\n5. Internationalisation");
  {
    for (const [code, probe] of [["en", "Book"], ["nl", "Reserveren"], ["de", "Buchen"], ["es", "Reservar"], ["it", "Prenota"]]) {
      const p = await newPage();
      const before = pageErrors.length + consoleErrors.length;
      await p.goto(`${BASE}/index.html?lang=${code}`, { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 700));
      const st = await p.evaluate(() => ({
        lang: document.documentElement.lang,
        cta: (document.querySelector('.header-actions a[href*="booking"] span') || {}).textContent || "",
        untranslated: [...document.querySelectorAll("[data-i18n]")].filter((el) => el.textContent.trim() === el.dataset.i18n).length,
        frLeft: document.body.innerText.includes("Réserver ma séance"),
        langCode: (document.querySelector("[data-lang-code]") || {}).textContent
      }));
      const added = (pageErrors.length + consoleErrors.length) - before;
      const good = st.lang === code && st.cta.trim() === probe && !st.untranslated && !st.frLeft && !added;
      good ? ok(`?lang=${code} → « ${st.cta.trim()} », html[lang]=${st.lang}, badge ${st.langCode}`)
           : ko(`?lang=${code} → ${JSON.stringify(st)} (+${added} err)`);
      if (code === "nl") await p.screenshot({ path: path.join(SHOTS, "index-nl.png") });
      await p.close();
    }

    // persistance + changement au clic
    const p = await newPage(1440, 960, { keepState: true });
    await p.goto(`${BASE}/index.html`, { waitUntil: "networkidle2" });
    await p.click("[data-lang-trigger]");
    await new Promise((r) => setTimeout(r, 250));
    await p.click('[data-lang-menu] button[data-lang="de"]');
    await new Promise((r) => setTimeout(r, 800));
    const afterClick = await p.evaluate(() => ({ lang: document.documentElement.lang, url: location.search, stored: localStorage.getItem("lvh.lang") }));
    afterClick.lang === "de" && afterClick.url.includes("lang=de") && afterClick.stored === '"de"'
      ? ok("changement au clic : html[lang], URL et localStorage synchronisés") : ko("changement au clic: " + JSON.stringify(afterClick));

    await p.goto(`${BASE}/services.html`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 700));
    const persisted = await p.evaluate(() => document.documentElement.lang);
    persisted === "de" ? ok("langue persistée d’une page à l’autre") : ko("langue non persistée: " + persisted);

    const linkKeeps = await p.evaluate(() => {
      const a = [...document.querySelectorAll('a[href*="booking.html"]')][0];
      return a ? a.getAttribute("href") : "";
    });
    linkKeeps.includes("lang=de") ? ok("les liens internes conservent ?lang=de") : ko("liens sans ?lang: " + linkKeeps);
    await p.close();
  }

  /* ---------------------------------------------- 6. thème */
  console.log("\n6. Thème clair / sombre");
  {
    const p = await newPage(1440, 960, { keepState: true });
    await p.goto(`${BASE}/index.html`, { waitUntil: "networkidle2" });
    await p.click("[data-theme-toggle]");
    await new Promise((r) => setTimeout(r, 500));
    const dark = await p.evaluate(() => ({
      attr: document.documentElement.getAttribute("data-theme"),
      stored: localStorage.getItem("lvh.theme"),
      bg: getComputedStyle(document.body).backgroundColor,
      meta: (document.querySelector('meta[name="theme-color"]') || {}).content
    }));
    dark.attr === "dark" && dark.stored === '"dark"' ? ok(`bascule sombre (fond ${dark.bg}, theme-color ${dark.meta})`) : ko("bascule sombre: " + JSON.stringify(dark));
    await p.screenshot({ path: path.join(SHOTS, "index-dark.png") });

    await p.goto(`${BASE}/contact.html`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 400));
    const persisted = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
    persisted === "dark" ? ok("thème persisté d’une page à l’autre") : ko("thème non persisté: " + persisted);
    await p.screenshot({ path: path.join(SHOTS, "contact-dark.png") });
    await p.close();
  }

  /* ---------------------------------------------- 7. formulaire */
  console.log("\n7. Formulaire de contact");
  {
    const p = await newPage(1440, 960, { keepState: true });
    await p.goto(`${BASE}/contact.html`, { waitUntil: "networkidle2" });
    await p.evaluate(() => { localStorage.removeItem("lvh.contact.draft"); });
    await p.reload({ waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 400));

    // envoi à vide → validation bloque
    await p.click('#contactForm button[type="submit"]');
    await new Promise((r) => setTimeout(r, 400));
    const invalid = await p.evaluate(() => ({
      fields: document.querySelectorAll(".field.is-invalid").length,
      toast: !!document.querySelector(".toast--error"),
      focused: document.activeElement && document.activeElement.id
    }));
    invalid.fields >= 4 ? ok(`validation bloque l’envoi (${invalid.fields} champs en erreur)`) : ko("validation: " + JSON.stringify(invalid));
    invalid.focused === "first_name" ? ok("focus placé sur le 1er champ fautif") : ko("focus: " + invalid.focused);

    // e-mail invalide
    await p.type("#email", "pas-un-email");
    await p.evaluate(() => document.querySelector("#email").blur());
    await new Promise((r) => setTimeout(r, 250));
    const mailBad = await p.evaluate(() => document.querySelector("#email").closest(".field").classList.contains("is-invalid"));
    mailBad ? ok("e-mail invalide détecté") : ko("e-mail invalide non détecté");

    // correction → état valide
    await p.evaluate(() => { document.querySelector("#email").value = ""; });
    await p.type("#email", "sophie@exemple.be");
    await p.evaluate(() => document.querySelector("#email").blur());
    await new Promise((r) => setTimeout(r, 250));
    const mailOk = await p.evaluate(() => document.querySelector("#email").closest(".field").classList.contains("is-valid"));
    mailOk ? ok("e-mail valide accepté") : ko("e-mail valide refusé");

    // compteur + autosave
    await p.type("#message", "Bonjour Lucie, je souhaite commencer le pilates.");
    await new Promise((r) => setTimeout(r, 1200));
    const draft = await p.evaluate(() => ({
      count: (document.querySelector("[data-count-for]") || {}).textContent,
      draft: localStorage.getItem("lvh.contact.draft")
    }));
    /\d+\s*\/\s*1200/.test(draft.count || "") ? ok("compteur de caractères actif : " + draft.count.trim()) : ko("compteur: " + draft.count);
    draft.draft && draft.draft.includes("sophie@exemple.be") ? ok("brouillon auto-sauvegardé") : ko("brouillon non sauvegardé");

    // rechargement → restauration
    await p.reload({ waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 700));
    const restored = await p.evaluate(() => document.querySelector("#email").value);
    restored === "sophie@exemple.be" ? ok("brouillon restauré au rechargement") : ko("restauration: " + restored);

    // le pot de miel et la clé Web3Forms sont intacts
    const intact = await p.evaluate(() => ({
      key: (document.querySelector('input[name="access_key"]') || {}).value,
      hp: !!document.querySelector('input[name="botcheck"]'),
      action: document.querySelector("#contactForm").getAttribute("action")
    }));
    intact.key === "4d25a9b1-e3e0-4d91-ac39-57015a6980f6" ? ok("clé Web3Forms intacte") : ko("clé Web3Forms: " + intact.key);
    intact.hp ? ok("champ anti-robot présent") : ko("champ anti-robot absent");
    await p.close();
  }

  /* ---------------------------------------------- 8. réservation */
  console.log("\n8. Parcours de réservation");
  {
    const p = await newPage();
    await p.goto(`${BASE}/booking.html`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 600));
    const initial = await p.evaluate(() => ({
      choices: document.querySelectorAll("[data-choice]").length,
      step2Hidden: document.querySelector("#bookingStep2").hidden,
      emptyShown: !document.querySelector("#bookingEmpty").hidden
    }));
    initial.choices === 6 ? ok("6 services proposés") : ko(initial.choices + " services");
    initial.step2Hidden && initial.emptyShown ? ok("état vide affiché avant sélection") : ko("état initial: " + JSON.stringify(initial));

    await p.click('[data-choice="Coaching à domicile"]');
    await new Promise((r) => setTimeout(r, 1400));
    const after = await p.evaluate(() => ({
      checked: document.querySelector('[data-choice="Coaching à domicile"]').getAttribute("aria-checked"),
      step2: !document.querySelector("#bookingStep2").hidden,
      badge: (document.querySelector("#selectedService") || {}).textContent,
      stepDone: document.querySelector("#stepDot1").classList.contains("is-done"),
      lineDone: document.querySelector("#stepLine").classList.contains("is-done"),
      stored: localStorage.getItem("lvh.booking.service"),
      calendly: !!document.querySelector("#calendlyMount iframe, #calendlyMount .calendly-inline-widget, #calendlyMount .skeleton")
    }));
    after.checked === "true" && after.step2 ? ok("sélection → étape 2 dévoilée") : ko("sélection: " + JSON.stringify(after));
    after.stepDone && after.lineDone ? ok("indicateur d’étapes mis à jour") : ko("indicateur d’étapes non mis à jour");
    after.stored && after.stored.includes("domicile") ? ok("choix mémorisé : " + after.stored) : ko("choix non mémorisé");
    after.calendly ? ok("widget Calendly monté") : ko("widget Calendly absent");
    await p.screenshot({ path: path.join(SHOTS, "booking-selected.png") });

    // navigation clavier dans le groupe radio
    await p.focus('[data-choice="Coaching à domicile"]');
    await p.keyboard.press("ArrowRight");
    await new Promise((r) => setTimeout(r, 500));
    const nav = await p.evaluate(() => document.activeElement.getAttribute("data-choice"));
    nav && nav !== "Coaching à domicile" ? ok("flèches clavier entre les services → " + nav) : ko("navigation clavier: " + nav);

    // lien profond
    await p.goto(`${BASE}/booking.html?service=Formule%20mixte`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1000));
    const deep = await p.evaluate(() => document.querySelector('[data-choice="Formule mixte"]').getAttribute("aria-checked"));
    deep === "true" ? ok("lien profond ?service=Formule mixte présélectionne") : ko("lien profond: " + deep);
    await p.close();
  }

  /* ---------------------------------------------- 9. accordéon FAQ + filtre */
  console.log("\n9. FAQ");
  {
    const p = await newPage();
    await p.goto(`${BASE}/services.html`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 400));
    await p.click("#faq-1 .acc-trigger");
    await new Promise((r) => setTimeout(r, 600));
    const opened = await p.evaluate(() => {
      const item = document.querySelector("#faq-1");
      const panel = item.querySelector(".acc-panel > div");
      return {
        open: item.classList.contains("is-open"),
        expanded: item.querySelector(".acc-trigger").getAttribute("aria-expanded"),
        height: panel.getBoundingClientRect().height
      };
    });
    opened.open && opened.expanded === "true" && opened.height > 20 ? ok("ouverture d’une question (hauteur " + Math.round(opened.height) + "px)") : ko("accordéon: " + JSON.stringify(opened));

    await p.type("#faqSearch", "annul");
    await new Promise((r) => setTimeout(r, 400));
    const filtered = await p.evaluate(() => ({
      visible: [...document.querySelectorAll("#faqList .acc-item")].filter((i) => !i.hidden).length,
      empty: !document.querySelector("#faqEmpty").hidden
    }));
    filtered.visible > 0 && filtered.visible < 8 ? ok(`filtre « annul » → ${filtered.visible} question(s)`) : ko("filtre: " + JSON.stringify(filtered));

    await p.evaluate(() => { const i = document.querySelector("#faqSearch"); i.value = "zzzzz"; i.dispatchEvent(new Event("input")); });
    await new Promise((r) => setTimeout(r, 300));
    const none = await p.evaluate(() => !document.querySelector("#faqEmpty").hidden);
    none ? ok("état vide affiché quand aucun résultat") : ko("état vide non affiché");

    // lien profond vers une question
    await p.goto(`${BASE}/about.html`, { waitUntil: "networkidle2" });
    await p.goto(`${BASE}/services.html#faq-6`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 600));
    const deep = await p.evaluate(() => document.querySelector("#faq-6").classList.contains("is-open"));
    deep ? ok("lien profond #faq-6 ouvre la question") : ko("lien profond FAQ inopérant");
    await p.close();
  }

  /* ---------------------------------------------- 10. consentement + carte */
  console.log("\n10. Consentement RGPD");
  {
    const p = await newPage(1440, 960, { keepState: true });
    await p.evaluateOnNewDocument(() => { try { localStorage.removeItem("lvh.consent"); } catch (e) {} });
    await p.goto(`${BASE}/contact.html`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    const banner = await p.evaluate(() => ({
      shown: !!document.querySelector("#consent.is-open"),
      gated: !!document.querySelector("[data-embed-gate].embed-gate"),
      iframe: !!document.querySelector("[data-embed-gate] iframe")
    }));
    banner.shown ? ok("bandeau de consentement affiché") : ko("bandeau non affiché");
    banner.gated && !banner.iframe ? ok("carte Google bloquée avant consentement") : ko("carte non bloquée: " + JSON.stringify(banner));

    await p.click('[data-consent="all"]');
    await new Promise((r) => setTimeout(r, 700));
    const accepted = await p.evaluate(() => ({
      hidden: !document.querySelector("#consent.is-open"),
      iframe: !!document.querySelector("[data-embed-gate] iframe"),
      stored: localStorage.getItem("lvh.consent")
    }));
    accepted.hidden && accepted.iframe && accepted.stored === '"all"' ? ok("acceptation → carte chargée et choix mémorisé") : ko("acceptation: " + JSON.stringify(accepted));

    const p2 = await newPage(1440, 960, { keepState: true });
    await p2.goto(`${BASE}/contact.html`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    const again = await p2.evaluate(() => !!document.querySelector("#consent.consent"));
    await p2.close();
    !again ? ok("bandeau non réaffiché après choix") : ko("bandeau réaffiché malgré le choix");
    await p.close();
  }

  /* ---------------------------------------------- 11. accessibilité de base */
  console.log("\n11. Accessibilité");
  {
    const p = await newPage();
    await p.goto(`${BASE}/index.html`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 400));

    await p.keyboard.press("Tab");
    await new Promise((r) => setTimeout(r, 450));
    const firstStop = await p.evaluate(() => ({
      cls: document.activeElement.className,
      text: document.activeElement.textContent.trim().slice(0, 40),
      visible: document.activeElement.getBoundingClientRect().top >= 0
    }));
    firstStop.cls.includes("skip-link") ? ok(`1re tabulation → lien d’évitement (« ${firstStop.text} », visible: ${firstStop.visible})`) : ko("1re tabulation: " + JSON.stringify(firstStop));

    const a11y = await p.evaluate(() => {
      const noName = [...document.querySelectorAll("button, a")].filter((el) => {
        if (el.closest("[aria-hidden='true']")) return false;
        const label = (el.getAttribute("aria-label") || el.textContent || "").trim();
        return !label;
      }).length;
      const headings = [...document.querySelectorAll("h1,h2,h3,h4")].map((h) => +h.tagName[1]);
      let jumps = 0;
      for (let i = 1; i < headings.length; i++) if (headings[i] - headings[i - 1] > 1) jumps++;
      return {
        noName,
        jumps,
        landmarks: ["header", "main", "footer", "nav"].filter((t) => document.querySelector(t)).length,
        langSet: !!document.documentElement.lang,
        listSemantics: document.querySelectorAll("nav ul, nav ol").length
      };
    });
    a11y.noName === 0 ? ok("tous les boutons et liens ont un nom accessible") : ko(a11y.noName + " élément(s) sans nom accessible");
    a11y.jumps === 0 ? ok("hiérarchie de titres sans saut de niveau") : ko(a11y.jumps + " saut(s) de niveau de titre");
    a11y.landmarks === 4 ? ok("repères header/main/footer/nav présents") : ko("repères: " + a11y.landmarks + "/4");

    // focus visible
    const ring = await p.evaluate(() => {
      const btn = document.querySelector(".btn--primary");
      btn.focus();
      const s = getComputedStyle(btn);
      return s.outlineStyle + " " + s.outlineWidth;
    });
    ring.includes("solid") ? ok("anneau de focus visible (" + ring + ")") : ko("focus peu visible: " + ring);
    await p.close();
  }

  /* ---------------------------------------------- 12. mouvement réduit */
  console.log("\n12. prefers-reduced-motion");
  {
    const p = await newPage();
    await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    await p.goto(`${BASE}/index.html`, { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 700));
    const st = await p.evaluate(() => {
      const hidden = [...document.querySelectorAll("[data-reveal]")].filter((el) => getComputedStyle(el).opacity === "0").length;
      const counter = document.querySelector("[data-count-key]");
      return { hidden, counter: counter ? counter.textContent : "" };
    });
    st.hidden === 0 ? ok("contenus révélés immédiatement (aucun bloc masqué)") : ko(st.hidden + " bloc(s) restés invisibles");
    st.counter ? ok("compteurs affichés sans animation : " + st.counter) : ko("compteur vide");
    await p.close();
  }

  /* ---------------------------------------------- bilan */
  console.log("\n" + "─".repeat(60));
  const bad = results.filter((r) => r[0] === "ko");
  console.log(`${results.length - bad.length} vérification(s) OK, ${bad.length} en échec`);
  if (pageErrors.length) console.log("\nErreurs JS:\n  " + [...new Set(pageErrors)].join("\n  "));
  if (consoleErrors.length) console.log("\nErreurs console:\n  " + [...new Set(consoleErrors)].join("\n  "));
  await browser.close();
  process.exit(bad.length ? 1 : 0);
})().catch((e) => { console.error("ÉCHEC:", e); process.exit(2); });
