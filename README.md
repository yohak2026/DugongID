# 🐋 DugongID

**An offline-first photo-ID and research tool for dugong conservation.**

DugongID helps field researchers identify individual dugongs from dorsal and fluke (tail)
photos, build an ID catalog, and track observations — age, behaviour, character, and
conservation notes — over time. It runs entirely on your device. **No internet, no server,
no cloud. Your data never leaves your computer.**

---

## Why this approach

Photo-ID for dugongs (and other sirenians) relies on durable body markings: **fluke notches,
scars, boat-strike marks, skin patterns, and body deformities**. DugongID uses
**computer-assisted matching** — the proven method used by professional wildlife photo-ID
software:

1. You mark the distinguishing features on a photo.
2. The app builds a "feature fingerprint" for each individual.
3. When a new photo arrives, it ranks the most similar catalogued animals with a confidence score.
4. **You make the final identification.** The machine only narrows the candidates.

This works even on low-quality aerial/surface photos because it depends on the same marks
researchers already use — not on perfect image clarity. Accuracy improves as you record more
marks per individual.

---

## Features

- **Identify** — upload a dorsal/fluke photo, drop markers on distinguishing features, and
  compare against your catalog to find the most likely match.
- **Individuals catalog** — one profile per dugong: code/name, status, age class, sex,
  distinguishing marks, behaviour & character, conservation notes, and full sighting history.
- **Observations log** — record sightings with date, location, behaviour, and attach
  **photos, videos, and PDF field notes**.
- **PDF export** — generate a clean ID profile sheet for any individual.
- **Fully offline** — installable as a PWA; all data stored locally in your browser's
  IndexedDB.
- **Backup & share** — export your entire catalog to a single JSON file (photos included)
  for safekeeping or to share with teammates; import it on any device.
- **Light & dark mode.**

---

## Running the app

Because the app uses a service worker and local storage, open it through a tiny local web
server (not by double-clicking the file).

### Option A — Python (already on most machines)

```bash
cd DugongID
python3 -m http.server 8099
```

Then open **http://localhost:8099** in your browser.

### Option B — Node

```bash
cd DugongID
npx serve .
```

### Install as an app (optional)

In Chrome/Edge, click the install icon in the address bar to install DugongID as a desktop/mobile
app that opens in its own window and works offline.

---

## How matching works (the scoring)

DugongID follows the **El Nido dugong catalog methodology** (see
[`docs/METHODOLOGY.md`](docs/METHODOLOGY.md)). Individuals are named
`[BAY]-[SPECIES]-[NUMBER]` (e.g. **BB-DD-01**), and markers are weighted by how long
they persist on the animal — permanent marks are the most trustworthy for matching:

| Permanence | Persists | Marker types | Weight |
|---|---|---|---|
| **Permanent** | ~lifelong | Fluke notch, Fluke shape, Caudal/fluke cut, Pectoral-fin deformity, Tail-stock deformity | 1.0 |
| **Long-term** | ~1 year | Dorsal pigmentation, Boat-strike mark, Other feature | 0.7 |
| **Short-term** | 1–3 months (heals) | Shallow laceration | 0.35 |

Each marker also carries a **body region** (dorsal anterior/medial/posterior, fluke
leading/trailing/tip, peduncle, pectoral, head). The similarity score combines
**permanence-weighted overlap** of matching marks in the same region with a
**spatial proximity** bonus, producing a 0–100 score and a confidence label
(Strong / Possible / Weak / Unlikely).

---

## Data & privacy

- All records live in your browser's local database (IndexedDB) on this device only.
- Nothing is uploaded anywhere.
- **Back up regularly** using *Export backup* — it produces a single portable file with all
  individuals, sightings, and media.

---

## Project structure

```
DugongID/
├── index.html              # App shell
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # Service worker (offline cache)
├── css/style.css           # Ocean/conservation theme
├── js/
│   ├── db.js               # IndexedDB data layer + export/import
│   ├── matching.js         # Computer-assisted matching engine
│   ├── annotator.js        # Photo marker placement (canvas)
│   ├── pdf.js              # Offline PDF report generation
│   └── app.js              # UI controller & routing
├── vendor/jspdf.umd.min.js # Offline PDF library
└── icons/                  # App icons & favicon
```

---

## Quality process — specialist agent council

Development and identification quality are reviewed through an adversarial
**Driver Council** + specialist agents (Research, Development, Observatory, and a
Presider of outputs) using a credit-conserving escalation ladder. See
[`docs/AGENTS.md`](docs/AGENTS.md).

---

## Roadmap ideas

- Batch import of photos from a folder
- Side-by-side photo comparison when confirming a match
- Map view of sighting locations
- CSV export of sightings for statistical analysis
- Optional automatic similarity scoring as the catalog grows

---

## License

Open source for conservation use. See repository for details.

🌊 Built for dugong conservation.
