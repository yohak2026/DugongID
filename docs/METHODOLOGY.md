# DugongID — Catalog Methodology

This document describes the real-world photo-identification methodology that DugongID
implements, based on the El Nido (Palawan, Philippines) dugong catalog.

## 1. Individual naming scheme

Every catalogued dugong gets a code in the form:

```
[BAY]-[SPECIES]-[NUMBER]
```

Example: **BB-DD-01**

### Bay codes

| Code | Bay / area              |
| ---- | ----------------------- |
| BB   | Bacuit Bay              |
| IB   | Sibaltan / Inner Bay    |
| DB   | Dimakya Bay             |

### Species code

| Code | Species                       |
| ---- | ----------------------------- |
| DD   | *Dugong dugon* (the dugong)   |

### Number

Zero-padded sequence per bay, assigned in order of first identification
(`01`, `02`, `03`, …). DugongID auto-suggests the next free number for the
selected bay (e.g. the next Bacuit Bay animal becomes `BB-DD-03` if `01` and
`02` already exist).

## 2. Marker permanence

Markers are weighted by how long they persist on the animal. Permanent marks are
the most reliable for matching; short-term marks should be used with caution.

| Permanence  | Persists      | Marker types                                                                 | Match weight |
| ----------- | ------------- | ---------------------------------------------------------------------------- | ------------ |
| **Permanent** | ~lifelong   | Fluke notch, Fluke shape, Caudal / fluke cut, Pectoral-fin deformity, Tail-stock deformity | 1.0 |
| **Long-term** | ~1 year     | Dorsal pigmentation (mole-like spot patterns), Boat-strike mark, Other feature | 0.7 |
| **Short-term**| 1–3 months  | Shallow laceration (heals)                                                   | 0.35 |

The matching engine multiplies each shared marker's contribution by its
permanence weight, so two animals matching only on healing lacerations score far
lower than two matching on fluke notches.

## 3. Body regions

Each marker is tagged with the region of the body where it appears, so the same
mark type in different places does not falsely match.

- **Dorsal:** Anterior / Medial / Posterior
- **Fluke:** Leading edge / Trailing edge / Tip / Left / Right / Center
- **Peduncle (tail-stock)**
- **Pectoral fin**
- **Head**
- **Unknown**

## 4. Sighting location codes

Sightings are logged against named survey locations:

- **N1–N5** — northern survey points
- **D1–D5** — Dimakya / southern survey points

## 5. Per-individual tracking

For each individual the catalog tracks:

- Code, bay, status (active / deceased)
- **Age class:** calf / juvenile / sub-adult / adult
- Sex (if known)
- Reference markers (type + region + position)
- Sighting locations and sighting count
- **First seen** and **Last seen** dates
- Deceased flag (e.g. BB-DD-01 — deceased July 2025)
- Notes, behaviour, marks summary

## 6. Computer-assisted matching (not autonomous AI)

DugongID is **computer-assisted**: when a new photo is annotated, the app ranks
existing individuals by marker similarity and presents candidates with a
confidence score. **A human always confirms the match.** This is appropriate for
low-quality field/drone photos where automated visual ID is unreliable.

## 7. Offline-first

All data stays on the device (IndexedDB). No network connection or server is
required. The app is a Progressive Web App and works fully offline.
