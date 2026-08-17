/* Vérifications statiques du site (aucune dépendance).
   Usage : node tools/verify.js
   Contrôle : clés i18n utilisées vs déclarées, liens internes, ancres,
   fichiers images référencés, et cohérence des locales. */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pages = fs.readdirSync(root).filter((f) => f.endsWith(".html"));
let errors = 0;
let warnings = 0;

const fail = (msg) => { console.log("  ✗ " + msg); errors++; };
const warn = (msg) => { console.log("  ! " + msg); warnings++; };

/* ---------------------------------------------- charge les dictionnaires */
function loadDict(file) {
  const src = fs.readFileSync(file, "utf8");
  const sandbox = { window: {} };
  new Function("window", src)(sandbox.window);
  return sandbox.window;
}
const frWin = loadDict(path.join(root, "i18n.js"));
const FR = frWin.LOCALES.fr;
const META = frWin.LOCALE_META;

/* --------------------------------------------------- 1. clés i18n */
console.log("\n1. Clés i18n référencées dans le HTML");
const usedKeys = new Set();
for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  const collect = (re, group = 1) => {
    let m;
    while ((m = re.exec(html))) yield_(m[group]);
  };
  const missing = [];
  function yield_(k) {
    usedKeys.add(k);
    if (!(k in FR)) missing.push(k);
  }
  collect(/data-i18n="([^"]+)"/g);
  collect(/data-i18n-html="([^"]+)"/g);
  collect(/data-count-key="([^"]+)"/g);
  let m;
  const attrRe = /data-i18n-attr="([^"]+)"/g;
  while ((m = attrRe.exec(html))) {
    for (const pair of m[1].split(";")) {
      const key = pair.split(":")[1];
      if (key) yield_(key.trim());
    }
  }
  if (missing.length) fail(`${page} → clés absentes du dictionnaire : ${[...new Set(missing)].join(", ")}`);
}
if (!errors) console.log(`  ✓ ${usedKeys.size} clés utilisées, toutes définies`);

/* les modules JS résolvent aussi des clés via t("…") */
for (const js of ["main.js", "ui.js", "forms.js", "booking.js"]) {
  const src = fs.readFileSync(path.join(root, js), "utf8");
  let m;
  const re = /\bt\(\s*"([^"]+)"\s*\)/g;
  while ((m = re.exec(src))) {
    usedKeys.add(m[1]);
    if (!(m[1] in FR)) fail(`${js} → clé absente du dictionnaire : ${m[1]}`);
  }
}

/* clés déclarées mais jamais utilisées (informatif) */
/* `toast.theme*` est résolu par une ternaire que la regex ci-dessus ne voit pas. */
const dynamicPrefixes = ["cmdk.act.", "svc.", "faq.q", "meta.", "toast.theme"];
const unused = Object.keys(FR).filter(
  (k) => !usedKeys.has(k) && !dynamicPrefixes.some((p) => k.startsWith(p))
);
if (unused.length) warn(`clés définies mais non référencées dans le HTML : ${unused.join(", ")}`);

/* --------------------------------------------------- 2. parité des locales */
console.log("\n2. Parité des locales");
for (const { code } of META) {
  if (code === "fr") continue;
  const file = path.join(root, "locales", code + ".js");
  if (!fs.existsSync(file)) { fail(`locales/${code}.js manquant`); continue; }
  const dict = loadDict(file).LOCALES[code];
  if (!dict) { fail(`locales/${code}.js ne définit pas window.LOCALES.${code}`); continue; }
  const miss = Object.keys(FR).filter((k) => !(k in dict));
  const extra = Object.keys(dict).filter((k) => !(k in FR));
  const empty = Object.entries(dict).filter(([, v]) => !String(v).trim()).map(([k]) => k);
  if (miss.length) fail(`${code}: ${miss.length} clés manquantes → ${miss.slice(0, 5).join(", ")}`);
  if (extra.length) fail(`${code}: ${extra.length} clés en trop → ${extra.slice(0, 5).join(", ")}`);
  if (empty.length) fail(`${code}: valeurs vides → ${empty.join(", ")}`);
  if (!miss.length && !extra.length && !empty.length) {
    console.log(`  ✓ ${code} — ${Object.keys(dict).length} clés`);
  }
}

/* --------------------------------------------------- 3. liens et ancres */
console.log("\n3. Liens internes, ancres et ressources");
const idsByPage = {};
for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  const ids = new Set();
  let m;
  const idRe = /\sid="([^"]+)"/g;
  while ((m = idRe.exec(html))) ids.add(m[1]);
  idsByPage[page] = ids;
}

for (const page of pages) {
  const html = fs.readFileSync(path.join(root, page), "utf8");
  let m;
  const hrefRe = /href="([^"]+)"/g;
  while ((m = hrefRe.exec(html))) {
    const href = m[1];
    if (/^(https?:|mailto:|tel:|data:|#$)/.test(href)) continue;

    if (href.startsWith("#")) {
      const id = href.slice(1);
      if (id && !idsByPage[page].has(id)) fail(`${page} → ancre introuvable ${href}`);
      continue;
    }
    const [file, hash] = href.split("#");
    const target = file.split("?")[0];
    if (!target) continue;
    if (!fs.existsSync(path.join(root, target))) {
      fail(`${page} → fichier introuvable ${target}`);
      continue;
    }
    if (hash && target.endsWith(".html") && idsByPage[target] && !idsByPage[target].has(hash)) {
      fail(`${page} → ancre introuvable ${target}#${hash}`);
    }
  }

  /* images + scripts + styles */
  const srcRe = /(?:src|content)="((?:img|locales)\/[^"]+)"/g;
  while ((m = srcRe.exec(html))) {
    if (!fs.existsSync(path.join(root, m[1]))) fail(`${page} → ressource introuvable ${m[1]}`);
  }
  const srcsetRe = /srcset="([^"]+)"/g;
  while ((m = srcsetRe.exec(html))) {
    for (const part of m[1].split(",")) {
      const url = part.trim().split(/\s+/)[0];
      if (url && !fs.existsSync(path.join(root, url))) fail(`${page} → srcset introuvable ${url}`);
    }
  }
  const scriptRe = /<script src="([^"]+)"/g;
  while ((m = scriptRe.exec(html))) {
    if (/^https?:/.test(m[1])) continue;
    if (!fs.existsSync(path.join(root, m[1]))) fail(`${page} → script introuvable ${m[1]}`);
  }
}
if (!errors) console.log("  ✓ tous les liens, ancres et ressources résolvent");

/* --------------------------------------------------- 4. garde-fous métier */
console.log("\n4. Données métier préservées");
const contact = fs.readFileSync(path.join(root, "contact.html"), "utf8");
const booking = fs.readFileSync(path.join(root, "booking.html"), "utf8");
const bookingJs = fs.readFileSync(path.join(root, "booking.js"), "utf8");

const checks = [
  [contact.includes('value="4d25a9b1-e3e0-4d91-ac39-57015a6980f6"'), "clé Web3Forms"],
  [contact.includes('name="access_key"'), "champ access_key"],
  [contact.includes('name="first_name"') && contact.includes('name="last_name"') &&
   contact.includes('name="email"') && contact.includes('name="message"'), "champs du formulaire"],
  [bookingJs.includes("https://calendly.com/lucie-coach-pt?hide_gdpr_banner=1&primary_color=FF5C1A"), "URL Calendly"],
  [bookingJs.includes("customAnswers: { a1: serviceName }"), "préremplissage a1"],
  [booking.includes("assets.calendly.com/assets/external/widget.js"), "script Calendly"],
  [(booking.match(/data-choice="/g) || []).length === 6, "6 services réservables"]
];
for (const [ok, label] of checks) ok ? console.log("  ✓ " + label) : fail(label + " ABSENT");

/* prix : doivent apparaître quelque part dans les pages */
const all = pages.map((p) => fs.readFileSync(path.join(root, p), "utf8")).join("\n");
for (const price of ["50 €", "40 €", "400 €", "780 €", "15 €", "199 €", "537 €", "999 €", "239 €", "749 €", "1 499 €", "140 €", "99 €"]) {
  if (!all.includes(price)) fail(`tarif absent du site : ${price}`);
}
console.log("  ✓ tarifs d’origine présents");

/* --------------------------------------------------- résultat */
console.log("\n" + "─".repeat(56));
console.log(errors ? `${errors} erreur(s), ${warnings} avertissement(s)` : `Aucune erreur. ${warnings} avertissement(s).`);
process.exit(errors ? 1 : 0);
