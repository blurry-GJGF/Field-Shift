# Field-Shift
NASA Space Apps Challenge 2026 · **Field Shift: Adapting Farms with NASA Data**

Field Shift uses 25 years of NASA climate data for any field on Earth to tell a farmer, in plain language, **which crop to plant next, when, and why**.

- 🌐 **Live app:** https://field-shift-omega.vercel.app
- 📘 **For judges, how the recommendation algorithm works:** [ALGORITHM.md](ALGORITHM.md)

## What it does
1. Pick your field on the map (or one of Sonora's main agricultural regions).
2. Answer 4 quick questions: what you just harvested, how many times you can water, what matters most to you, and any crops you can't plant.
3. Get a ranked list of 10 crops, with the best pick, a 12-month planting calendar, and the reasons and risks behind each option.

**NASA data used:**
- **NASA POWER:** temperature, precipitation, soil wetness and surface temperature.
- **NASA GIBS:** HLS 30 m imagery, MODIS true color and MODIS NDVI.

## How to run it

First, run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

To open the app from another device on your network over HTTPS (needed for "My location" on phones):

```bash
npm run dev:https
```

## Deployment
- **Vercel** (recommended): every push to `main` deploys https://field-shift-omega.vercel.app automatically.
- **GitHub Pages**: [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds a static export with base path `/Field-Shift`. Some Mexican networks block GitHub Pages servers, so use the Vercel link for demos.

## Tech
Next.js · React · OpenLayers · plain JavaScript for the algorithm ([`lib/ranking.js`](lib/ranking.js)). No server and no API keys: everything runs in the browser against public NASA APIs.
