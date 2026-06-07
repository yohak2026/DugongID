/* DugongID — Computer-assisted matching engine
 *
 * Modelled directly on the El Nido dugong photo-ID methodology
 * (Bacuit Bay catalog). Individuals are identified by durable body &
 * fluke features. Critically, markers differ in PERMANENCE:
 *
 *   PERMANENT (~lifelong): fluke shape, fluke notch, caudal/fluke cut,
 *       pectoral-fin deformity, tail-stock deformity. Most reliable.
 *   LONG-TERM (~1 year): dorsal pigmentation (mole-like spot patterns).
 *   SHORT-TERM (1-3 months): shallow dorsal lacerations. Useful within a
 *       season but they heal — must NOT dominate a long-gap match.
 *
 * Matching ranks catalog individuals by similarity, weighting permanent
 * features highest, then a HUMAN confirms. Works offline on low-quality
 * aerial photos because it relies on the same marks researchers use.
 */
const Matching = (() => {

  // permanence → base reliability multiplier
  const PERMANENCE = {
    permanent: { mult: 1.0,  label: 'Permanent',  note: '~lifelong' },
    long:      { mult: 0.7,  label: 'Long-term',  note: '~1 year' },
    short:     { mult: 0.35, label: 'Short-term', note: '1–3 months (heals)' },
  };

  // Marker catalogue. weight = intrinsic distinctiveness; permanence set per El Nido methodology.
  const MARKER_TYPES = {
    fluke_notch:   { label: 'Fluke notch',          weight: 3.0, permanence: 'permanent', color: '#ef4444', hint: 'V/U cut on the fluke trailing edge' },
    fluke_shape:   { label: 'Fluke shape',          weight: 2.6, permanence: 'permanent', color: '#f97316', hint: 'Overall tail outline / tip shape' },
    caudal_cut:    { label: 'Caudal / fluke cut',   weight: 2.8, permanence: 'permanent', color: '#dc2626', hint: 'Cut on the caudal fin edge' },
    pectoral_def:  { label: 'Pectoral-fin deformity', weight: 2.7, permanence: 'permanent', color: '#a855f7', hint: 'Misshapen / damaged pectoral fin' },
    tailstock_def: { label: 'Tail-stock deformity', weight: 2.7, permanence: 'permanent', color: '#9333ea', hint: 'Abnormal peduncle / tail-stock shape' },
    pigmentation:  { label: 'Dorsal pigmentation',  weight: 1.8, permanence: 'long',      color: '#0ea5e9', hint: 'Mole-like spot pattern (long-term)' },
    boat_strike:   { label: 'Boat-strike mark',     weight: 2.2, permanence: 'long',      color: '#b91c1c', hint: 'Parallel propeller cuts' },
    laceration:    { label: 'Shallow laceration',   weight: 1.0, permanence: 'short',     color: '#22c55e', hint: 'Surface scratch — heals in 1–3 months' },
    other:         { label: 'Other feature',        weight: 1.0, permanence: 'long',      color: '#3b82f6', hint: 'Anything else distinctive' },
  };

  // Body regions, following the El Nido scheme (dorsal = anterior/medial/posterior; fluke edges).
  const REGIONS = [
    'dorsal_anterior', 'dorsal_medial', 'dorsal_posterior',
    'fluke_left', 'fluke_right', 'fluke_center', 'fluke_trailing', 'fluke_leading', 'fluke_tip',
    'peduncle', 'pectoral_left', 'pectoral_right', 'head', 'unknown'
  ];
  const REGION_LABELS = {
    dorsal_anterior: 'Dorsal · anterior', dorsal_medial: 'Dorsal · medial', dorsal_posterior: 'Dorsal · posterior',
    fluke_left: 'Fluke · left', fluke_right: 'Fluke · right', fluke_center: 'Fluke · center',
    fluke_trailing: 'Fluke · trailing edge', fluke_leading: 'Fluke · leading edge', fluke_tip: 'Fluke · tip',
    peduncle: 'Tail stock / peduncle', pectoral_left: 'Pectoral · left', pectoral_right: 'Pectoral · right',
    head: 'Head', unknown: 'Unknown / unspecified'
  };

  // El Nido catalog naming: [BAY]-[SPECIES]-[NUMBER], e.g. BB-DD-01
  const BAYS = {
    BB: 'Bacuit Bay',
    IB: 'Sibaltan / Inner Bay',
    DB: 'Dimakya Bay',
  };
  const SPECIES_CODE = 'DD'; // Dugong dugon
  const AGE_CLASSES = ['', 'calf', 'juvenile', 'subadult', 'adult'];
  // Sighting-location codes used in the field catalog.
  const SIGHTING_LOCATIONS = ['N1', 'N2', 'N3', 'N4', 'N5', 'D1', 'D2', 'D3', 'D4', 'D5'];

  // Suggest the next sequential code for a bay given the existing catalog.
  function nextCode(bay, individuals = []) {
    const prefix = `${bay}-${SPECIES_CODE}-`;
    let max = 0;
    for (const ind of individuals) {
      const m = (ind.code || '').toUpperCase().match(new RegExp(`^${bay}-${SPECIES_CODE}-(\\d+)$`));
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    return prefix + String(max + 1).padStart(2, '0');
  }

  function effectiveWeight(type) {
    const m = MARKER_TYPES[type] || MARKER_TYPES.other;
    return m.weight * (PERMANENCE[m.permanence]?.mult ?? 0.7);
  }

  function fingerprint(markers = []) {
    const fp = { byType: {}, byRegion: {}, points: [], permanentCount: 0 };
    for (const m of markers) {
      const t = m.type || 'other';
      const r = m.region || 'unknown';
      fp.byType[t] = (fp.byType[t] || 0) + 1;
      fp.byRegion[r] = (fp.byRegion[r] || 0) + 1;
      fp.points.push({ t, r, x: m.x, y: m.y });
      if (MARKER_TYPES[t]?.permanence === 'permanent') fp.permanentCount++;
    }
    fp.totalMarkers = markers.length;
    return fp;
  }

  function score(queryFp, candFp) {
    if (!queryFp.totalMarkers || !candFp.totalMarkers) return 0;
    let shared = 0, possible = 0;

    const regions = new Set([...Object.keys(queryFp.byRegion), ...Object.keys(candFp.byRegion)]);
    for (const region of regions) {
      const qPts = queryFp.points.filter(p => p.r === region);
      const cPts = candFp.points.filter(p => p.r === region);
      const types = new Set([...qPts.map(p => p.t), ...cPts.map(p => p.t)]);
      for (const type of types) {
        const w = effectiveWeight(type);
        const q = qPts.filter(p => p.t === type).length;
        const c = cPts.filter(p => p.t === type).length;
        shared += w * Math.min(q, c);
        possible += w * Math.max(q, c);
      }
    }
    const overlap = possible ? shared / possible : 0;

    // Spatial proximity bonus for same-type, same-region markers placed close together.
    let spatial = 0, spatialN = 0;
    for (const qp of queryFp.points) {
      let best = 0;
      for (const cp of candFp.points) {
        if (cp.t === qp.t && cp.r === qp.r && qp.x != null && cp.x != null) {
          const d = Math.hypot(qp.x - cp.x, qp.y - cp.y);
          best = Math.max(best, Math.max(0, 1 - d / 0.3));
        }
      }
      spatial += best; spatialN++;
    }
    const spatialScore = spatialN ? spatial / spatialN : 0;

    const combined = 0.78 * overlap + 0.22 * spatialScore;
    return Math.round(combined * 100);
  }

  function aggregateIndividual(individual, sightings) {
    const own = sightings.filter(s => s.individualId === individual.id);
    const allMarkers = [];
    const seen = new Set();
    const add = (m) => {
      // De-duplicate: the same marker often lives in both the individual's
      // reference set and a sighting. Counting it twice would distort scores
      // and the "marks on file" tally. Key on id when present, else on shape.
      const key = m.id || `${m.type}|${m.region}|${m.x}|${m.y}`;
      if (seen.has(key)) return;
      seen.add(key); allMarkers.push(m);
    };
    for (const m of (individual.referenceMarkers || [])) add(m);
    for (const s of own) for (const m of (s.markers || [])) add(m);
    return fingerprint(allMarkers);
  }

  function rankCandidates(querySighting, individuals, sightings) {
    const qFp = fingerprint(querySighting.markers || []);
    const ranked = individuals.map(ind => {
      const cFp = aggregateIndividual(ind, sightings);
      return { individual: ind, score: score(qFp, cFp), markerCount: cFp.totalMarkers, permanentCount: cFp.permanentCount };
    });
    ranked.sort((a, b) => b.score - a.score);
    return ranked;
  }

  function confidenceLabel(s) {
    if (s >= 70) return { label: 'Strong match', cls: 'strong' };
    if (s >= 45) return { label: 'Possible match', cls: 'possible' };
    if (s >= 20) return { label: 'Weak match', cls: 'weak' };
    return { label: 'Unlikely', cls: 'none' };
  }

  return { MARKER_TYPES, PERMANENCE, REGIONS, REGION_LABELS,
           BAYS, SPECIES_CODE, AGE_CLASSES, SIGHTING_LOCATIONS, nextCode, effectiveWeight,
           fingerprint, score, rankCandidates, aggregateIndividual, confidenceLabel };
})();
