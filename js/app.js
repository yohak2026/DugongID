/* DugongID — main application controller */
const App = (() => {
  let route = 'dashboard';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const el = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
  const esc = (s) => (s == null ? '' : String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));

  // Working state for the Identify flow
  let identify = { mediaId: null, mediaURL: null, markers: [], ranked: [] };

  function toast(msg) {
    let t = $('#toast'); if (!t) { t = el(`<div id="toast" class="toast"></div>`); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function setRoute(r) {
    route = r;
    $$('.nav button, .mobile-nav button').forEach(b => b.classList.toggle('active', b.dataset.route === r));
    render();
  }

  // ---------------- DASHBOARD ----------------
  async function renderDashboard(main) {
    const [inds, sights] = await Promise.all([DB.getAll('individuals'), DB.getAll('sightings')]);
    const matched = sights.filter(s => s.individualId).length;
    const unmatched = sights.filter(s => !s.individualId).length;
    main.innerHTML = `
      <div class="topbar"><div><h1>Catalog overview</h1>
        <div class="sub">Local conservation database · everything stays on this device</div></div>
        <div class="actions">
          <button class="btn btn-ghost" data-act="import">Import backup</button>
          <button class="btn btn-ghost" data-act="export">Export backup</button>
          <button class="btn btn-primary" data-act="go-identify">+ Identify a photo</button>
        </div></div>
      <div class="statline">
        <div class="stat"><b>${inds.length}</b><span>Individuals</span></div>
        <div class="stat"><b>${sights.length}</b><span>Sightings</span></div>
        <div class="stat"><b>${matched}</b><span>Matched</span></div>
        <div class="stat"><b>${unmatched}</b><span>Unmatched</span></div>
      </div>
      <h2 style="font-size:var(--text-lg);margin-bottom:var(--space-4)">Recently updated</h2>
      <div id="dash-cards" class="grid cards"></div>`;
    const cardsWrap = $('#dash-cards', main);
    const recent = inds.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 8);
    if (!recent.length) cardsWrap.innerHTML = emptyState('No individuals yet', 'Start by identifying a dorsal or fluke photo. The app will help you mark distinguishing features and create the first ID profile.');
    for (const ind of recent) cardsWrap.appendChild(await individualCard(ind, sights));
    main.querySelector('[data-act="go-identify"]').onclick = () => setRoute('identify');
    main.querySelector('[data-act="export"]').onclick = doExport;
    main.querySelector('[data-act="import"]').onclick = doImport;
  }

  function emptyState(title, body) {
    return `<div class="empty-state" style="grid-column:1/-1">
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12c3-4 7-6 10-6s7 2 10 6c-3 4-7 6-10 6S5 16 2 12z"/><circle cx="12" cy="12" r="2.5"/></svg>
      <h3 style="margin-bottom:6px">${esc(title)}</h3><p style="margin:0 auto;max-width:46ch">${esc(body)}</p></div>`;
  }

  async function individualCard(ind, sights) {
    const url = ind.coverMediaId ? await DB.getMediaURL(ind.coverMediaId) : null;
    const count = sights.filter(s => s.individualId === ind.id).length;
    const c = el(`<div class="card click" data-id="${ind.id}">
      <div class="thumb">${url ? `<img src="${url}" alt="">` : `<div class="empty">No photo</div>`}</div>
      <div class="body"><h3>${esc(ind.code || 'Unnamed')}</h3>
        <div class="meta">${count} sighting${count === 1 ? '' : 's'} · ${esc(ind.ageClass || 'age unknown')}</div>
        <div style="margin-top:8px"><span class="badge status-${ind.status || 'active'}">${esc(ind.status || 'active')}</span></div>
      </div></div>`);
    c.onclick = () => openIndividual(ind.id);
    return c;
  }

  // ---------------- CATALOG ----------------
  async function renderCatalog(main) {
    const [inds, sights] = await Promise.all([DB.getAll('individuals'), DB.getAll('sightings')]);
    main.innerHTML = `
      <div class="topbar"><div><h1>Individuals</h1><div class="sub">${inds.length} catalogued dugong${inds.length === 1 ? '' : 's'}</div></div>
        <div class="actions">
          <input type="text" id="search" placeholder="Search by code…" style="width:200px">
          <button class="btn btn-primary" data-act="new">+ New individual</button>
        </div></div>
      <div id="cat-cards" class="grid cards"></div>`;
    const wrap = $('#cat-cards', main);
    async function paint(filter = '') {
      wrap.innerHTML = '';
      const list = inds.filter(i => !filter || (i.code || '').toLowerCase().includes(filter.toLowerCase()))
        .sort((a, b) => (a.code || '').localeCompare(b.code || ''));
      if (!list.length) { wrap.innerHTML = emptyState('No matches', 'Try a different search, or create a new individual profile.'); return; }
      for (const ind of list) wrap.appendChild(await individualCard(ind, sights));
    }
    await paint();
    $('#search', main).oninput = (e) => paint(e.target.value);
    main.querySelector('[data-act="new"]').onclick = () => editIndividual(null);
  }

  // ---------------- IDENTIFY (assisted matching) ----------------
  async function renderIdentify(main) {
    main.innerHTML = `
      <div class="topbar"><div><h1>Identify a dugong</h1>
        <div class="sub">Upload a dorsal/fluke photo, mark the distinguishing features, then compare to your catalog</div></div></div>
      <div class="annot-wrap">
        <div>
          <div class="panel" style="margin-bottom:var(--space-4)">
            <div class="canvas-box" id="canvas-box">
              <div class="canvas-empty" id="canvas-empty">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 16l5-5 4 4 3-3 6 6"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                <div><b>Add a photo to begin</b><br><span style="font-size:var(--text-sm);color:var(--color-text-muted)">Aerial fluke or back shots work well, even low quality</span></div>
                <label class="btn btn-primary">Choose photo<input type="file" accept="image/*" id="photo-input" hidden></label>
              </div>
              <canvas id="annot-canvas" style="display:none"></canvas>
            </div>
            <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:8px">Click the photo to drop a marker. Right-click (or long-press) a marker to remove it.</p>
          </div>
          <div class="panel" id="match-panel" style="display:none">
            <h2>Candidate matches</h2>
            <div id="match-list"></div>
          </div>
        </div>
        <div class="marker-tools panel">
          <div class="field"><label>Marker type</label><div class="tool-list" id="type-list"></div></div>
          <div class="field"><label>Body region</label>
            <select id="region-select">${Matching.REGIONS.map(r => `<option value="${r}">${esc(Matching.REGION_LABELS[r] || r)}</option>`).join('')}</select></div>
          <div class="field"><label>Markers placed: <span id="marker-count">0</span></label></div>
          <button class="btn btn-primary" style="width:100%;justify-content:center" data-act="match" disabled id="btn-match">Compare to catalog</button>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-ghost btn-sm" style="flex:1;justify-content:center" data-act="undo" id="btn-undo" disabled>↩ Undo</button>
            <button class="btn btn-ghost btn-sm" style="flex:1;justify-content:center" data-act="redo" id="btn-redo" disabled>↪ Redo</button>
          </div>
          <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;margin-top:8px" data-act="clear">Clear markers</button>
        </div>
      </div>`;

    // marker type list — grouped by permanence (most reliable first)
    const tl = $('#type-list', main);
    let first = true;
    ['permanent', 'long', 'short'].forEach(perm => {
      const p = Matching.PERMANENCE[perm];
      const entries = Object.entries(Matching.MARKER_TYPES).filter(([, m]) => m.permanence === perm);
      if (!entries.length) return;
      tl.appendChild(el(`<div class="perm-head perm-${perm}">${esc(p.label)} <span>· ${esc(p.note)}</span></div>`));
      entries.forEach(([key, m]) => {
        const b = el(`<button data-type="${key}" class="${first ? 'active' : ''}" title="${esc(m.hint)}">
          <span class="swatch" style="background:${m.color}"></span><span>${esc(m.label)}</span></button>`);
        b.onclick = () => { $$('#type-list button').forEach(x => x.classList.remove('active')); b.classList.add('active'); Annotator.setActiveType(key); };
        tl.appendChild(b);
        first = false;
      });
    });
    Annotator.setActiveType('fluke_notch');
    const regionSel = $('#region-select', main);
    regionSel.value = 'fluke_center';
    regionSel.onchange = (e) => Annotator.setActiveRegion(e.target.value);
    Annotator.setActiveRegion('fluke_center');

    identify = { mediaId: null, mediaURL: null, markers: [], ranked: [] };
    const canvas = $('#annot-canvas', main);
    const syncHistoryButtons = () => {
      const u = $('#btn-undo', main), r = $('#btn-redo', main);
      if (u) u.disabled = !Annotator.canUndo();
      if (r) r.disabled = !Annotator.canRedo();
    };
    Annotator.init(canvas, (markers) => {
      identify.markers = markers;
      $('#marker-count', main).textContent = markers.length;
      $('#btn-match', main).disabled = markers.length === 0;
      syncHistoryButtons();
    });

    $('#photo-input', main).onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        identify.mediaId = await DB.saveMedia(file, 'photo');
        identify.mediaURL = await DB.getMediaURL(identify.mediaId);
        $('#canvas-empty', main).style.display = 'none';
        canvas.style.display = 'block';
        await Annotator.loadImage(identify.mediaURL);
      } catch (err) { toast(err.message || 'Could not load photo'); }
    };
    main.querySelector('[data-act="clear"]').onclick = () => Annotator.clear();
    main.querySelector('[data-act="undo"]').onclick = () => Annotator.undo();
    main.querySelector('[data-act="redo"]').onclick = () => Annotator.redo();
    main.querySelector('[data-act="match"]').onclick = () => runMatch(main);
  }

  async function runMatch(main) {
    const [inds, sights] = await Promise.all([DB.getAll('individuals'), DB.getAll('sightings')]);
    const querySighting = { markers: identify.markers };
    const ranked = Matching.rankCandidates(querySighting, inds, sights).slice(0, 6);
    identify.ranked = ranked;
    const panel = $('#match-panel', main), list = $('#match-list', main);
    panel.style.display = 'block';
    if (!inds.length) {
      list.innerHTML = `<p style="color:var(--color-text-muted)">Your catalog is empty. Save this as the first individual to start building it.</p>
        <button class="btn btn-primary" id="save-new" style="margin-top:12px">Save as new individual</button>`;
    } else {
      list.innerHTML = '';
      for (const r of ranked) {
        const url = r.individual.coverMediaId ? await DB.getMediaURL(r.individual.coverMediaId) : null;
        const conf = Matching.confidenceLabel(r.score);
        const color = r.score >= 70 ? 'var(--color-success)' : r.score >= 45 ? 'var(--color-gold)' : 'var(--color-text-faint)';
        const row = el(`<div class="match-row">
          ${url ? `<img class="thumb-sm" src="${url}">` : `<div class="thumb-sm"></div>`}
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px">
              <b>${esc(r.individual.code || 'Unnamed')}</b>
              <span class="conf ${conf.cls}">${conf.label} · ${r.score}</span></div>
            <div class="score-bar"><i style="width:${r.score}%;background:${color}"></i></div>
            <div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:4px">${r.markerCount} reference marks on file</div>
          </div>
          <button class="btn btn-ghost btn-sm" data-confirm="${r.individual.id}">Confirm match</button>
        </div>`);
        row.querySelector('[data-confirm]').onclick = () => confirmMatch(r.individual.id);
        list.appendChild(row);
      }
      list.appendChild(el(`<div style="margin-top:12px;padding-top:12px;border-top:1px dashed var(--color-divider)">
        <p style="font-size:var(--text-sm);color:var(--color-text-muted);margin-bottom:10px">None of these is the right animal?</p>
        <button class="btn btn-primary" id="save-new">This is a new individual</button></div>`));
    }
    const sn = $('#save-new', main); if (sn) sn.onclick = () => saveAsNewIndividual();
  }

  async function confirmMatch(individualId) {
    const sighting = {
      id: crypto.randomUUID(), individualId, date: new Date().toISOString().slice(0, 10),
      mediaIds: identify.mediaId ? [identify.mediaId] : [], markers: identify.markers,
      location: '', behaviour: '', createdAt: Date.now()
    };
    await DB.put('sightings', sighting);
    const ind = await DB.get('individuals', individualId);
    ind.updatedAt = Date.now();
    ind.lastSeen = sighting.date;
    if (!ind.coverMediaId && identify.mediaId) ind.coverMediaId = identify.mediaId;
    await DB.put('individuals', ind);
    toast(`Sighting added to ${ind.code}`);
    openIndividual(individualId);
  }

  async function saveAsNewIndividual() {
    const allInds = await DB.getAll('individuals');
    const suggested = Matching.nextCode('BB', allInds);
    const code = await promptDialog('New individual code', suggested, suggested);
    if (code == null) return;
    const finalCode = code || suggested;
    const bayMatch = finalCode.toUpperCase().match(/^([A-Z]{2})-/);
    const today = new Date().toISOString().slice(0, 10);
    const id = crypto.randomUUID();
    const ind = {
      id, code: finalCode, bay: bayMatch && Matching.BAYS[bayMatch[1]] ? bayMatch[1] : 'BB',
      status: 'active', ageClass: '', sex: '', firstSeen: today, lastSeen: today, locCode: '',
      marksSummary: summariseMarks(identify.markers), behaviour: '', notes: '',
      referenceMarkers: identify.markers, coverMediaId: identify.mediaId,
      createdAt: Date.now(), updatedAt: Date.now()
    };
    await DB.put('individuals', ind);
    const sighting = {
      id: crypto.randomUUID(), individualId: id, date: ind.firstSeen,
      mediaIds: identify.mediaId ? [identify.mediaId] : [], markers: identify.markers,
      location: '', behaviour: '', createdAt: Date.now()
    };
    await DB.put('sightings', sighting);
    toast(`Created ${ind.code}`);
    openIndividual(id);
  }

  function summariseMarks(markers) {
    const counts = {};
    for (const m of (markers || [])) { const l = Matching.MARKER_TYPES[m.type]?.label || m.type; counts[l] = (counts[l] || 0) + 1; }
    return Object.entries(counts).map(([k, v]) => `${v}× ${k}`).join(', ');
  }

  // ---------------- OBSERVATIONS ----------------
  async function renderObservations(main) {
    const sights = (await DB.getAll('sightings')).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const inds = await DB.getAll('individuals');
    const nameOf = (id) => inds.find(i => i.id === id)?.code || 'Unmatched';
    main.innerHTML = `
      <div class="topbar"><div><h1>Observations & research log</h1>
        <div class="sub">Every recorded sighting, behaviour note, and attached media</div></div>
        <div class="actions"><button class="btn btn-primary" data-act="new-obs">+ Log observation</button></div></div>
      <div id="obs-list" class="grid"></div>`;
    const wrap = $('#obs-list', main);
    if (!sights.length) { wrap.innerHTML = emptyState('No observations logged', 'Log sightings to track behaviour, location, and conditions over time. You can attach photos, videos, and PDF field notes.'); }
    for (const s of sights) {
      const row = el(`<div class="panel">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div><b style="font-family:var(--font-display)">${esc(nameOf(s.individualId))}</b>
            <span style="color:var(--color-text-muted);font-size:var(--text-sm)"> · ${esc(s.date || 'undated')}</span></div>
          <div class="chips">${(s.behaviour ? `<span class="chip">${esc(s.behaviour)}</span>` : '')}${(s.locCode ? `<span class="chip">${esc(s.locCode)}</span>` : '')}${(s.location ? `<span class="chip">📍 ${esc(s.location)}</span>` : '')}${s.markers?.length ? `<span class="chip">${s.markers.length} marks</span>` : ''}</div>
        </div>
        ${s.notes ? `<p style="margin-top:8px;font-size:var(--text-sm)">${esc(s.notes)}</p>` : ''}
      </div>`);
      wrap.appendChild(row);
    }
    main.querySelector('[data-act="new-obs"]').onclick = () => editObservation(null);
  }

  // ---------------- INDIVIDUAL DETAIL (modal) ----------------
  async function openIndividual(id) {
    const ind = await DB.get('individuals', id);
    const sights = (await DB.getByIndex('sightings', 'individualId', id)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const cover = ind.coverMediaId ? await DB.getMediaURL(ind.coverMediaId) : null;
    const modal = el(`<div class="modal-bg"><div class="modal">
      <div class="modal-head"><h2 style="margin:0">${esc(ind.code || 'Unnamed')}</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" data-act="add-photo">+ Add photo</button>
          <button class="btn btn-ghost btn-sm" data-act="pdf">Export PDF</button>
          <button class="btn btn-ghost btn-sm" data-act="edit">Edit</button>
          <button class="btn btn-ghost btn-sm" data-act="close">Close</button></div></div>
      <div class="modal-body">
        ${cover ? `<img src="${cover}" style="width:100%;max-height:320px;object-fit:cover;border-radius:var(--radius-md);margin-bottom:var(--space-4)">` : ''}
        <dl class="kv">
          <dt>Status</dt><dd><span class="badge status-${ind.status || 'active'}">${esc(ind.status || 'active')}</span></dd>
          <dt>Bay</dt><dd>${esc(ind.bay ? `${ind.bay} · ${Matching.BAYS[ind.bay] || ''}` : '—')}</dd>
          <dt>Age class</dt><dd>${esc(ind.ageClass || '—')}</dd>
          <dt>Sex</dt><dd>${esc(ind.sex || '—')}</dd>
          <dt>Sightings</dt><dd>${sights.length}</dd>
          <dt>First seen</dt><dd>${esc(ind.firstSeen || '—')}</dd>
          <dt>Last seen</dt><dd>${esc(ind.lastSeen || '—')}</dd>
          <dt>Sighting location</dt><dd>${esc(ind.locCode || '—')}</dd>
          <dt>Marks</dt><dd>${esc(ind.marksSummary || '—')}</dd>
          <dt>Behaviour</dt><dd>${esc(ind.behaviour || '—')}</dd>
          <dt>Conservation notes</dt><dd>${esc(ind.notes || '—')}</dd>
        </dl>
        <h3 style="margin:var(--space-6) 0 var(--space-3);font-size:var(--text-lg)">Sightings (${sights.length})</h3>
        <div id="sight-list"></div>
      </div></div></div>`);
    document.body.appendChild(modal);
    const sl = modal.querySelector('#sight-list');
    if (!sights.length) sl.innerHTML = `<p style="color:var(--color-text-muted)">No sightings recorded.</p>`;
    for (const s of sights) {
      const thumbs = [];
      for (const mid of (s.mediaIds || [])) { const u = await DB.getMediaURL(mid); if (u) thumbs.push(`<div class="m"><img src="${u}"></div>`); }
      const markSummary = s.markers?.length ? summariseMarks(s.markers) : '';
      sl.appendChild(el(`<div class="match-row" style="flex-direction:column;align-items:stretch">
        <div><b>${esc(s.date || 'undated')}</b> ${s.location ? `· ${esc(s.location)}` : ''} ${s.behaviour ? `· ${esc(s.behaviour)}` : ''} · ${s.markers?.length || 0} marks</div>
        ${markSummary ? `<div style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:2px">${esc(markSummary)}</div>` : ''}
        ${thumbs.length ? `<div class="media-grid" style="margin-top:8px">${thumbs.join('')}</div>` : ''}</div>`));
    }
    const close = () => modal.remove();
    modal.querySelector('[data-act="close"]').onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };
    modal.querySelector('[data-act="edit"]').onclick = () => { close(); editIndividual(id); };
    modal.querySelector('[data-act="add-photo"]').onclick = () => { close(); addPhotoToIndividual(id); };
    modal.querySelector('[data-act="pdf"]').onclick = async () => { toast('Generating PDF…'); await PDFReport.individualProfile(ind, await DB.getAll('sightings')); };
  }

  // ---------------- ADD PHOTO + MARKINGS TO AN EXISTING INDIVIDUAL ----------------
  // Reusable marking modal: lets the observer add another photo to an individual,
  // mark its own distinguishing features, and save it as a new dated sighting.
  async function addPhotoToIndividual(individualId) {
    const ind = await DB.get('individuals', individualId);
    const today = new Date().toISOString().slice(0, 10);
    let mediaId = null, mediaURL = null, markers = [];
    const modal = el(`<div class="modal-bg"><div class="modal">
      <div class="modal-head"><h2 style="margin:0">Add photo — ${esc(ind.code || 'Unnamed')}</h2>
        <button class="btn btn-ghost btn-sm" data-act="close">Close</button></div>
      <div class="modal-body">
        <div class="row">
          <div class="field"><label>Date</label><input type="date" id="ap-date" value="${today}"></div>
          <div class="field"><label>Sighting location</label><select id="ap-locode">
            <option value="">—</option>
            ${Matching.SIGHTING_LOCATIONS.map(c => `<option value="${c}">${c}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>Behaviour</label><input type="text" id="ap-beh" placeholder="feeding, resting, travelling, with calf"></div>
        <div class="annot-wrap">
          <div>
            <div class="panel" style="margin-bottom:var(--space-3)">
              <div class="canvas-box" id="ap-box">
                <div class="canvas-empty" id="ap-empty">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 16l5-5 4 4 3-3 6 6"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                  <div><b>Add this sighting's photo</b><br><span style="font-size:var(--text-sm);color:var(--color-text-muted)">Each photo keeps its own markings</span></div>
                  <label class="btn btn-primary">Choose photo<input type="file" accept="image/*" id="ap-input" hidden></label>
                </div>
                <canvas id="ap-canvas" style="display:none"></canvas>
              </div>
              <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:8px">Click to drop a marker. Right-click (or long-press) to remove one.</p>
            </div>
          </div>
          <div class="marker-tools panel">
            <div class="field"><label>Marker type</label><div class="tool-list" id="ap-type-list"></div></div>
            <div class="field"><label>Body region</label>
              <select id="ap-region">${Matching.REGIONS.map(r => `<option value="${r}">${esc(Matching.REGION_LABELS[r] || r)}</option>`).join('')}</select></div>
            <div class="field"><label>Markers placed: <span id="ap-count">0</span></label></div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-ghost btn-sm" style="flex:1;justify-content:center" data-act="undo" id="ap-undo" disabled>↩ Undo</button>
              <button class="btn btn-ghost btn-sm" style="flex:1;justify-content:center" data-act="redo" id="ap-redo" disabled>↪ Redo</button>
            </div>
            <button class="btn btn-ghost btn-sm" style="width:100%;justify-content:center;margin-top:8px" data-act="clear">Clear markers</button>
            <label style="display:flex;align-items:center;gap:6px;margin-top:10px;font-size:var(--text-xs);color:var(--color-text-muted)"><input type="checkbox" id="ap-cover" style="width:auto"> Use as cover photo</label>
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;margin-top:var(--space-4)"><button class="btn btn-primary" data-act="save" id="ap-save" disabled>Save sighting</button></div>
      </div></div></div>`);
    document.body.appendChild(modal);

    // build marker-type list (same grouping as Identify)
    const tl = modal.querySelector('#ap-type-list');
    let first = true;
    ['permanent', 'long', 'short'].forEach(perm => {
      const p = Matching.PERMANENCE[perm];
      const entries = Object.entries(Matching.MARKER_TYPES).filter(([, m]) => m.permanence === perm);
      if (!entries.length) return;
      tl.appendChild(el(`<div class="perm-head perm-${perm}">${esc(p.label)} <span>· ${esc(p.note)}</span></div>`));
      entries.forEach(([key, m]) => {
        const b = el(`<button data-type="${key}" class="${first ? 'active' : ''}" title="${esc(m.hint)}">
          <span class="swatch" style="background:${m.color}"></span><span>${esc(m.label)}</span></button>`);
        b.onclick = () => { [...tl.querySelectorAll('button')].forEach(x => x.classList.remove('active')); b.classList.add('active'); Annotator.setActiveType(key); };
        tl.appendChild(b); first = false;
      });
    });
    Annotator.setActiveType('fluke_notch');
    const regionSel = modal.querySelector('#ap-region');
    regionSel.value = 'fluke_center'; Annotator.setActiveRegion('fluke_center');
    regionSel.onchange = (e) => Annotator.setActiveRegion(e.target.value);

    const canvas = modal.querySelector('#ap-canvas');
    const syncHist = () => {
      const u = modal.querySelector('#ap-undo'), r = modal.querySelector('#ap-redo');
      u.disabled = !Annotator.canUndo(); r.disabled = !Annotator.canRedo();
    };
    Annotator.init(canvas, (m) => {
      markers = m;
      modal.querySelector('#ap-count').textContent = m.length;
      modal.querySelector('#ap-save').disabled = !mediaId;
      syncHist();
    });

    modal.querySelector('#ap-input').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try {
        mediaId = await DB.saveMedia(file, 'photo');
        mediaURL = await DB.getMediaURL(mediaId);
        modal.querySelector('#ap-empty').style.display = 'none';
        canvas.style.display = 'block';
        await Annotator.loadImage(mediaURL);
        modal.querySelector('#ap-save').disabled = false;
      } catch (err) { toast(err.message || 'Could not load photo'); }
    };
    modal.querySelector('[data-act="clear"]').onclick = () => Annotator.clear();
    modal.querySelector('[data-act="undo"]').onclick = () => Annotator.undo();
    modal.querySelector('[data-act="redo"]').onclick = () => Annotator.redo();
    const close = () => modal.remove();
    modal.querySelector('[data-act="close"]').onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    modal.querySelector('[data-act="save"]').onclick = async () => {
      if (!mediaId) { toast('Add a photo first'); return; }
      const date = modal.querySelector('#ap-date').value || today;
      const sighting = {
        id: crypto.randomUUID(), individualId, date,
        locCode: modal.querySelector('#ap-locode').value,
        behaviour: modal.querySelector('#ap-beh').value.trim(),
        location: '', notes: '',
        mediaIds: [mediaId], markers, createdAt: Date.now()
      };
      await DB.put('sightings', sighting);
      ind.updatedAt = Date.now();
      if (!ind.lastSeen || date > ind.lastSeen) ind.lastSeen = date;
      if (!ind.firstSeen || date < ind.firstSeen) ind.firstSeen = date;
      if (modal.querySelector('#ap-cover').checked || !ind.coverMediaId) ind.coverMediaId = mediaId;
      // refresh the aggregated marks summary across ALL the animal's sightings
      const all = await DB.getByIndex('sightings', 'individualId', individualId);
      const merged = [];
      all.forEach(ss => (ss.markers || []).forEach(mk => merged.push(mk)));
      ind.marksSummary = summariseMarks(merged);
      await DB.put('individuals', ind);
      close(); toast(`Photo added to ${ind.code}`); openIndividual(individualId);
    };
  }

  // ---------------- EDIT INDIVIDUAL ----------------
  async function editIndividual(id) {
    const allInds = await DB.getAll('individuals');
    const ind = id ? await DB.get('individuals', id) : {
      id: crypto.randomUUID(), code: '', bay: 'BB', status: 'active', ageClass: '', sex: '',
      firstSeen: new Date().toISOString().slice(0, 10), lastSeen: '', locCode: '',
      marksSummary: '', behaviour: '', notes: '',
      referenceMarkers: [], coverMediaId: null, createdAt: Date.now(), updatedAt: Date.now()
    };
    const modal = el(`<div class="modal-bg"><div class="modal">
      <div class="modal-head"><h2 style="margin:0">${id ? 'Edit' : 'New'} individual</h2>
        <button class="btn btn-ghost btn-sm" data-act="close">Close</button></div>
      <div class="modal-body">
        <div class="row">
          <div class="field"><label>Catalog code</label><input type="text" id="f-code" value="${esc(ind.code)}" placeholder="BB-DD-01"></div>
          <div class="field"><label>Bay <span class="hint" style="display:inline">(auto-numbers code)</span></label><select id="f-bay">
            ${Object.entries(Matching.BAYS).map(([k, v]) => `<option value="${k}" ${ind.bay === k ? 'selected' : ''}>${k} · ${esc(v)}</option>`).join('')}</select></div>
        </div>
        <div class="row">
          <div class="field"><label>Status</label><select id="f-status">
            ${['active', 'archived', 'deceased'].map(s => `<option ${ind.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          <div class="field"><label>Age class</label><select id="f-age">
            ${Matching.AGE_CLASSES.map(s => `<option value="${s}" ${ind.ageClass === s ? 'selected' : ''}>${s || '—'}</option>`).join('')}</select></div>
        </div>
        <div class="row">
          <div class="field"><label>Sex</label><select id="f-sex">
            ${['', 'unknown', 'female', 'male'].map(s => `<option ${ind.sex === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
          <div class="field"><label>First seen</label><input type="date" id="f-first" value="${esc(ind.firstSeen)}"></div>
        </div>
        <div class="row">
          <div class="field"><label>Last seen</label><input type="date" id="f-last" value="${esc(ind.lastSeen || '')}"></div>
          <div class="field"><label>Primary sighting location</label><select id="f-locode">
            <option value="">—</option>
            ${Matching.SIGHTING_LOCATIONS.map(c => `<option value="${c}" ${ind.locCode === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        </div>
        <div class="field"><label>Distinguishing marks</label><textarea id="f-marks" placeholder="e.g. deep V-notch on left fluke, parallel boat scars on back">${esc(ind.marksSummary)}</textarea></div>
        <div class="field"><label>Behaviour & character</label><textarea id="f-behaviour" placeholder="e.g. tolerant of boats, often feeds at the north seagrass bed, seen with a calf">${esc(ind.behaviour)}</textarea></div>
        <div class="field"><label>Conservation notes</label><textarea id="f-notes" placeholder="threats observed, health, entanglement, recommended actions">${esc(ind.notes)}</textarea>
          <div class="hint">Track age, behaviour, character and how to help — all searchable later.</div></div>
        <div class="field"><label>Cover photo</label><label class="btn btn-ghost btn-sm">Replace photo<input type="file" accept="image/*" id="f-cover" hidden></label>
          <span id="cover-name" style="font-size:var(--text-xs);color:var(--color-text-muted);margin-left:8px">${ind.coverMediaId ? 'photo on file' : 'none'}</span></div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:var(--space-4)">
          ${id ? `<button class="btn btn-danger" data-act="delete">Delete</button>` : ''}
          <button class="btn btn-primary" data-act="save">Save</button></div>
      </div></div></div>`);
    document.body.appendChild(modal);
    let newCover = null;
    // Auto-suggest the next code for the selected bay when the code box is empty/blank.
    const codeInput = modal.querySelector('#f-code');
    const baySel = modal.querySelector('#f-bay');
    if (!id && !codeInput.value) codeInput.value = Matching.nextCode(baySel.value, allInds);
    baySel.onchange = () => {
      if (!id || !codeInput.value.trim()) codeInput.value = Matching.nextCode(baySel.value, allInds);
    };
    modal.querySelector('#f-cover').onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { newCover = await DB.saveMedia(f, 'photo'); modal.querySelector('#cover-name').textContent = 'new photo selected'; } catch (err) { toast(err.message || 'Could not save photo'); } };
    const close = () => modal.remove();
    modal.querySelector('[data-act="close"]').onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };
    if (id) modal.querySelector('[data-act="delete"]').onclick = async () => {
      if (!confirm('Delete this individual and all its links? Sightings will be kept but unlinked.')) return;
      const ss = await DB.getByIndex('sightings', 'individualId', id);
      for (const s of ss) { s.individualId = null; await DB.put('sightings', s); }
      await DB.del('individuals', id); close(); toast('Deleted'); render();
    };
    modal.querySelector('[data-act="save"]').onclick = async () => {
      ind.code = modal.querySelector('#f-code').value.trim();
      ind.bay = modal.querySelector('#f-bay').value;
      ind.status = modal.querySelector('#f-status').value;
      ind.ageClass = modal.querySelector('#f-age').value;
      ind.sex = modal.querySelector('#f-sex').value;
      ind.firstSeen = modal.querySelector('#f-first').value;
      ind.lastSeen = modal.querySelector('#f-last').value;
      ind.locCode = modal.querySelector('#f-locode').value;
      ind.marksSummary = modal.querySelector('#f-marks').value.trim();
      ind.behaviour = modal.querySelector('#f-behaviour').value.trim();
      ind.notes = modal.querySelector('#f-notes').value.trim();
      if (newCover) ind.coverMediaId = newCover;
      ind.updatedAt = Date.now();
      await DB.put('individuals', ind); close(); toast('Saved'); render();
    };
  }

  // ---------------- EDIT OBSERVATION ----------------
  async function editObservation(id) {
    const inds = await DB.getAll('individuals');
    const s = { id: crypto.randomUUID(), individualId: '', date: new Date().toISOString().slice(0, 10), locCode: '', location: '', behaviour: '', notes: '', markers: [], mediaIds: [], createdAt: Date.now() };
    const modal = el(`<div class="modal-bg"><div class="modal">
      <div class="modal-head"><h2 style="margin:0">Log observation</h2><button class="btn btn-ghost btn-sm" data-act="close">Close</button></div>
      <div class="modal-body">
        <div class="row">
          <div class="field"><label>Individual</label><select id="o-ind">
            <option value="">Unmatched / unknown</option>
            ${inds.map(i => `<option value="${i.id}">${esc(i.code || 'Unnamed')}</option>`).join('')}</select></div>
          <div class="field"><label>Date</label><input type="date" id="o-date" value="${s.date}"></div>
        </div>
        <div class="row">
          <div class="field"><label>Location code</label><select id="o-locode">
            <option value="">—</option>
            ${Matching.SIGHTING_LOCATIONS.map(c => `<option value="${c}">${c}</option>`).join('')}</select></div>
          <div class="field"><label>Behaviour</label><input type="text" id="o-beh" placeholder="feeding, resting, travelling, with calf"></div>
        </div>
        <div class="field"><label>Location notes</label><input type="text" id="o-loc" placeholder="seagrass bed, bay name, GPS"></div>
        <div class="field"><label>Notes</label><textarea id="o-notes" placeholder="conditions, group size, threats, observer"></textarea></div>
        <div class="field"><label>Attach media (photos, video, PDF)</label>
          <label class="btn btn-ghost btn-sm">Add files<input type="file" id="o-media" accept="image/*,video/*,application/pdf" multiple hidden></label>
          <span id="o-media-count" style="font-size:var(--text-xs);color:var(--color-text-muted);margin-left:8px">none</span></div>
        <div style="display:flex;justify-content:flex-end;margin-top:var(--space-4)"><button class="btn btn-primary" data-act="save">Save observation</button></div>
      </div></div></div>`);
    document.body.appendChild(modal);
    modal.querySelector('#o-media').onchange = async (e) => {
      try { for (const f of e.target.files) { const kind = f.type.startsWith('video') ? 'video' : f.type === 'application/pdf' ? 'pdf' : 'photo'; s.mediaIds.push(await DB.saveMedia(f, kind)); } } catch (err) { toast(err.message || 'Could not attach file'); }
      modal.querySelector('#o-media-count').textContent = `${s.mediaIds.length} file(s)`;
    };
    const close = () => modal.remove();
    modal.querySelector('[data-act="close"]').onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };
    modal.querySelector('[data-act="save"]').onclick = async () => {
      s.individualId = modal.querySelector('#o-ind').value || null;
      s.date = modal.querySelector('#o-date').value;
      s.locCode = modal.querySelector('#o-locode').value;
      s.location = modal.querySelector('#o-loc').value.trim();
      s.behaviour = modal.querySelector('#o-beh').value.trim();
      s.notes = modal.querySelector('#o-notes').value.trim();
      await DB.put('sightings', s);
      if (s.individualId) { const ind = await DB.get('individuals', s.individualId); if (ind) { ind.updatedAt = Date.now(); if (!ind.lastSeen || s.date > ind.lastSeen) ind.lastSeen = s.date; await DB.put('individuals', ind); } }
      close(); toast('Observation logged'); render();
    };
  }

  // ---------------- helpers: prompt, export/import ----------------
  function promptDialog(title, placeholder, prefill = '') {
    return new Promise((resolve) => {
      const modal = el(`<div class="modal-bg"><div class="modal" style="max-width:420px">
        <div class="modal-head"><h2 style="margin:0;font-size:var(--text-lg)">${esc(title)}</h2></div>
        <div class="modal-body"><input type="text" id="pd" placeholder="${esc(placeholder)}" value="${esc(prefill)}" autofocus>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:var(--space-4)">
            <button class="btn btn-ghost" data-a="cancel">Cancel</button><button class="btn btn-primary" data-a="ok">Save</button></div>
        </div></div></div>`);
      document.body.appendChild(modal);
      const input = modal.querySelector('#pd'); input.focus();
      const done = (v) => { modal.remove(); resolve(v); };
      modal.querySelector('[data-a="cancel"]').onclick = () => done(null);
      modal.querySelector('[data-a="ok"]').onclick = () => done(input.value.trim());
      input.onkeydown = (e) => { if (e.key === 'Enter') done(input.value.trim()); if (e.key === 'Escape') done(null); };
    });
  }

  async function doExport() {
    toast('Preparing backup…');
    const data = await DB.exportAll();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dugongid-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    toast('Backup downloaded');
  }
  function doImport() {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json';
    inp.onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { const payload = JSON.parse(await f.text()); await DB.importAll(payload, { merge: true }); toast('Backup imported'); render(); }
      catch (err) { toast('Import failed: ' + err.message); }
    };
    inp.click();
  }

  // ---------------- router ----------------
  async function render() {
    const main = $('#main');
    main.innerHTML = '<div class="empty-state">Loading…</div>';
    try {
      if (route === 'dashboard') await renderDashboard(main);
      else if (route === 'catalog') await renderCatalog(main);
      else if (route === 'identify') await renderIdentify(main);
      else if (route === 'observations') await renderObservations(main);
      else if (route === 'about') renderAbout(main);
    } catch (e) { main.innerHTML = `<div class="empty-state">Something went wrong: ${esc(e.message)}</div>`; console.error(e); }
  }

  function renderAbout(main) {
    main.innerHTML = `
      <div class="topbar"><div><h1>About & how it works</h1><div class="sub">DugongID — offline conservation photo-ID</div></div></div>
      <div class="panel"><h2>How matching works</h2>
        <p style="font-size:var(--text-sm);max-width:70ch">DugongID uses <b>computer-assisted matching</b>, the proven approach for wildlife photo-ID. You mark distinguishing features on each photo — fluke notches, scars, boat-strike marks, skin patterns, body deformities. The app builds a feature fingerprint for every individual and, when you upload a new photo, ranks the most similar catalogue animals by a weighted similarity score. <b>You make the final call</b> — the machine only suggests. Accuracy improves as you record more marks per individual.</p>
        <p style="font-size:var(--text-sm);margin-top:12px;max-width:70ch">This works on low-quality aerial/surface photos because it relies on the durable mutilations and scars researchers already use to tell dugongs apart — not on perfect image clarity.</p>
      </div>
      <div class="panel"><h2>Your data is private and offline</h2>
        <p style="font-size:var(--text-sm);max-width:70ch">Everything — individuals, photos, videos, PDFs, observations — is stored only on this device in the browser's local database. Nothing is uploaded anywhere. Use <b>Export backup</b> regularly to save a single file you can store safely or share with teammates via GitHub, and <b>Import backup</b> to load it on another device.</p>
      </div>
      <div class="panel"><h2>El Nido catalog methodology</h2>
        <p style="font-size:var(--text-sm);max-width:70ch">Individuals follow the field naming scheme <b>[BAY]-[SPECIES]-[NUMBER]</b> — e.g. <b>BB-DD-01</b> (Bacuit Bay, <i>Dugong dugon</i>, #01). Bay codes: ${Object.entries(Matching.BAYS).map(([k, v]) => `<b>${k}</b> ${esc(v)}`).join(' · ')}. Sightings are logged against location codes ${Matching.SIGHTING_LOCATIONS.join(', ')}, and each animal tracks age class, sightings, first/last seen, and a deceased flag.</p>
      </div>
      <div class="panel"><h2>Marker permanence & weights</h2>
        <p style="font-size:var(--text-sm);max-width:70ch;margin-bottom:var(--space-3)">Marks differ in how long they last. Permanent features (fluke shape, notches, cuts, deformities) are the most reliable for matching across years; long-term pigmentation patterns persist about a year; shallow lacerations heal within months and are down-weighted so they don't dominate a long-gap match.</p>
        ${['permanent', 'long', 'short'].map(perm => {
          const p = Matching.PERMANENCE[perm];
          const items = Object.values(Matching.MARKER_TYPES).filter(m => m.permanence === perm);
          return `<h3 style="font-size:var(--text-sm);margin:var(--space-3) 0 6px"><span class="perm-dot perm-${perm}"></span>${esc(p.label)} · <span style="color:var(--color-text-muted);font-weight:400">${esc(p.note)}</span></h3>
            <div class="kv">${items.map(m => `<dt><span class="swatch" style="background:${m.color};display:inline-block;margin-right:6px"></span>${esc(m.label)}</dt><dd>${esc(m.hint)} <span style="color:var(--color-text-faint)">(weight ${m.weight})</span></dd>`).join('')}</div>`;
        }).join('')}
      </div>`;
  }

  function init() {
    $$('.nav button, .mobile-nav button').forEach(b => b.onclick = () => setRoute(b.dataset.route));
    setRoute('dashboard');
  }

  return { init, toast };
})();

window.addEventListener('DOMContentLoaded', App.init);
