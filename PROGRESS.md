# Refonte 2026 — terminée

Site statique (HTML/CSS/JS) refondu de A à Z, prêt à publier sur GitHub Pages.

## Décisions structurantes

- **Site statique conservé** (HTML/CSS/JS, GitHub Pages). Pas de migration Next.js : Calendly et
  Web3Forms continuent de fonctionner exactement comme avant, aucun outil de build requis.
- **Six langues** : fr (source), nl, de, en, es, it. Le français reste écrit en dur dans le HTML —
  la page est lisible avant même l'exécution du JavaScript, et pour les moteurs de recherche.
  Les autres langues sont chargées à la demande depuis `locales/<code>.js`.
- **Contenu métier préservé à l'identique** : tarifs, horaires, formules, avis Google, mémoire,
  coordonnées, clé Web3Forms, URL Calendly et préremplissage `a1`.

## Architecture

| Fichier | Rôle |
|---|---|
| `style.css` | Design system complet : tokens, thème clair/sombre, composants, responsive, a11y |
| `i18n.js` | Dictionnaire source français (536 clés) + métadonnées des langues |
| `locales/<code>.js` | Traductions, chargées à la demande dans `window.LOCALES.<code>` |
| `main.js` | Thème, i18n, en-tête, méga-menu, tiroir mobile, révélations, accordéon, consentement |
| `ui.js` | Palette de commandes (⌘K / Ctrl+K), recherche globale, raccourcis clavier |
| `forms.js` | Validation en ligne, brouillon auto-sauvegardé, envoi Web3Forms |
| `booking.js` | Sélecteur de service accessible + widget Calendly |
| `tools/build-shared.ps1` | Recopie en-tête / tiroir / pied de page depuis `index.html` |
| `tools/optimize-images.ps1` | Génère `img/opt/` (les originaux ne sont jamais modifiés) |
| `tools/verify.js` | Contrôles statiques : clés i18n, parité des langues, liens, données métier |
| `tools/browser-test.js` | Recette navigateur : 64 vérifications fonctionnelles et d'accessibilité |

> **Important** : après toute modification de l'en-tête, du tiroir ou du pied de page dans
> `index.html`, relancer `powershell -ExecutionPolicy Bypass -File tools/build-shared.ps1`,
> sinon les cinq autres pages conservent l'ancienne version.

## Contrôles

```bash
node tools/verify.js          # statique, sans dépendance

# recette navigateur (nécessite puppeteer-core + un Chromium/Edge)
python -m http.server 8765
node tools/browser-test.js ./captures
```

Dernier état : **`verify.js` — 0 erreur, 0 avertissement** · **`browser-test.js` — 64/64**.

## Défauts trouvés en recette et corrigés

| Défaut | Conséquence | Correction |
|---|---|---|
| Pot de miel lu via `.value` | `value` vaut `"on"` même décoché : **le formulaire de contact ne partait jamais** | lecture de `.checked` pour une case à cocher |
| `id="consent"` en double (case du formulaire + bandeau cookies) | HTML invalide ; le bandeau ne se fermait plus sur la page contact | case renommée `consent-optin` |
| Révélations `left` / `right` (translation de 24 px) | débordement horizontal sur mobile | translation verticale sous 900 px |
| Tiroir mobile fermé | restait dans le flux et **focalisable au clavier** | `visibility: hidden` tant qu'il est fermé |
| Puce ⌘K de la recherche | blanc sur blanc en thème clair au-dessus du héros sombre | `--surface` redéfini dans l'en-tête sur fond sombre |
| Icône hamburger | trois barres étalées sur 31 px, la dernière débordant du bouton | passage en `flex` colonne avec `gap` |
| Barre d'actions mobile | collée au logo, moitié droite de l'en-tête vide | `margin-left: auto` sous 1024 px |
| Ancre `#faq-N` | n'ouvrait la question qu'au chargement initial | écoute de `hashchange` |
| Compteurs du héros | séparateur décimal français dans toutes les langues | valeurs tirées du dictionnaire (`data-count-key`) |
| Colonnes ✓ / — du tableau | rien d'annoncé aux lecteurs d'écran | libellé traduit en `sr-only` |

## Reste possible (non bloquant)

- Mesurer Lighthouse sur l'hébergement réel (les polices Google et Calendly pèsent sur le score).
- Remplacer les JPEG de `img/opt/` par du WebP/AVIF si un outil d'encodage est disponible :
  gain supplémentaire d'environ 30 % sans perte visible.
