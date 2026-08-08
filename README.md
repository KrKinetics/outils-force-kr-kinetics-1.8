# Outils de force — KR Kinetics

## Objectif

Outil de terrain pour planifier une montée en charge, estimer un 1RM, calculer une charge cible, charger une barre et comparer des scores (DOTS, Wilks original, IPF GL). Conçu pour un usage rapide en salle, sans backend.

## URL publique

https://krkinetics.github.io/outils-force-kr-kinetics-1.8/

## Architecture

Produit statique (HTML + CSS + JS), sans framework.

| Fichier | Rôle |
|---------|------|
| `force-core.js` | Cœur de calcul canonique (DOM-free) : RPE, 1RM, charge cible, warm-up, plaques, scores |
| `package.json` | Export `@krkinetics/force-core` pour dépendance Git épinglée |
| `index.html` | Interface, meta / OG, structure des outils |
| `styles.css` | Styles et breakpoints responsive |
| `app.js` | Câblage UI / navigateur uniquement (importe `force-core.js`) |
| `test_app.js` | Tests Node sur le même cœur canonique |
| `build.json` | Version / commit affichés dans le footer |
| `assets/` | Logos et favicons locaux |

## Outils

1. **Montée en charge** — échauffement progressif (barre, haltères, machine)
2. **1RM estimé** — estimation à partir de charge × reps × RPE
3. **Charge cible** — conversion d’un 1RM vers une charge de départ suggérée
4. **Chargement de barre** — combinaison de disques (gym lb/kg, IWF)
5. **Scores** — DOTS, Wilks original, IPF GL Points

## Méthodologie (aperçu)

- **Table RPE** : intensités RPE × répétitions
- **1RM** : charge ÷ intensité de la table
- **DOTS / Wilks original / IPF GL** : scores relatifs au poids corporel (plafonds / catégories IPF)
- **IWF** : jeu compétition pour le chargement
- Les résultats sont des **estimations** à adapter au contexte de l’athlète

Détails aussi disponibles dans le panneau « Méthodologie » du site.

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

## Consommation du cœur (dépendance Git)

```json
{
  "dependencies": {
    "@krkinetics/force-core": "git+https://github.com/KrKinetics/outils-force-kr-kinetics-1.8.git#<commit-sha>"
  }
}
```

Puis :

```js
const force = require('@krkinetics/force-core');
```

## Contribution

- Une seule source de calcul : `force-core.js` — ne pas dupliquer les formules dans `app.js`
- Ne pas modifier les formules sans ajouter / mettre à jour les tests dans `test_app.js`
- Préserver tous les IDs JS existants dans `index.html` / `app.js`
- Une seule méthode Pages : branche `main`, root — ne pas ajouter un second mécanisme de publication
