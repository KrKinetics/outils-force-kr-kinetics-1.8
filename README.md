# Outils de force — KR Kinetics

Outil de terrain pour planifier une montée en charge, estimer un 1RM, calculer une charge cible, charger une barre et comparer des scores (DOTS, Wilks, IPF GL).

**URL publique :** https://krkinetics.github.io/outils-force-kr-kinetics-1.8/

## Architecture

Produit statique (HTML + CSS + JS), sans framework.

| Fichier | Rôle |
|---------|------|
| `index.html` | Interface |
| `app.js` | Logique métier + UI |
| `test_app.js` | Tests Node |
| `build.json` | Version / commit affichés |
| `assets/` | Logos locaux |

## Tests

```bash
node test_app.js
```

## Déploiement

**Une seule méthode :** GitHub Pages depuis la branche `main`, dossier `/ (root)`.

- Settings → Pages → Deploy from a branch → `main` / `/ (root)`
- Aucun workflow Actions Pages en parallèle
- La CI (`.github/workflows/ci.yml`) exécute les tests uniquement ; elle ne publie pas le site

## Version

Voir `build.json` et le footer du site (`Build x.y.z · commit`).
