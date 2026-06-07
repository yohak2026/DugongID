/* DugongID — Photo annotation tool
 * Renders a photo on a canvas and lets the observer place markers
 * (notches, scars, patterns...). Markers are stored with NORMALISED
 * coordinates (0..1) so they survive any image size, plus a body region.
 */
const Annotator = (() => {
  let canvas, ctx, img = null;
  let markers = [];
  let activeType = 'fluke_notch';
  let activeRegion = 'fluke_center';
  let onChange = () => {};
  let zoom = 1, panX = 0, panY = 0;
  // Undo / redo history — snapshots of the marker list.
  let undoStack = [];
  let redoStack = [];

  function snapshot() { return markers.map(x => ({ ...x })); }
  function pushHistory() { undoStack.push(snapshot()); redoStack = []; }
  function resetHistory() { undoStack = []; redoStack = []; }

  function init(canvasEl, changeCb) {
    canvas = canvasEl;
    ctx = canvas.getContext('2d');
    onChange = changeCb || (() => {});
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('contextmenu', handleRightClick);
  }

  function loadImage(url) {
    return new Promise((resolve) => {
      markers = [];          // start each photo with a clean marker set
      resetHistory();
      onChange(getMarkers()); // keep the UI counter / match button in sync
      img = new Image();
      img.onload = () => { fit(); draw(); resolve(); };
      img.src = url;
    });
  }

  function setMarkers(m) { markers = (m || []).map(x => ({ ...x })); resetHistory(); draw(); onChange(getMarkers()); }
  function getMarkers() { return markers.map(x => ({ ...x })); }
  function setActiveType(t) { activeType = t; }
  function setActiveRegion(r) { activeRegion = r; }

  function fit() {
    if (!img) return;
    const maxW = canvas.parentElement.clientWidth;
    const ratio = img.height / img.width;
    canvas.width = maxW;
    canvas.height = Math.round(maxW * ratio);
  }

  function handleClick(e) {
    if (!img) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    pushHistory();
    markers.push({
      id: crypto.randomUUID(), type: activeType, region: activeRegion,
      x: +x.toFixed(4), y: +y.toFixed(4), note: ''
    });
    draw(); onChange(getMarkers());
  }

  function handleRightClick(e) {
    e.preventDefault();
    if (!img || !markers.length) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    // remove nearest marker within threshold
    let nearest = -1, best = 0.04;
    markers.forEach((m, i) => {
      const d = Math.hypot(m.x - x, m.y - y);
      if (d < best) { best = d; nearest = i; }
    });
    if (nearest >= 0) { pushHistory(); markers.splice(nearest, 1); draw(); onChange(getMarkers()); }
  }

  function undo() {
    if (!undoStack.length) return false;
    redoStack.push(snapshot());
    markers = undoStack.pop();
    draw(); onChange(getMarkers());
    return true;
  }
  function redo() {
    if (!redoStack.length) return false;
    undoStack.push(snapshot());
    markers = redoStack.pop();
    draw(); onChange(getMarkers());
    return true;
  }
  function canUndo() { return undoStack.length > 0; }
  function canRedo() { return redoStack.length > 0; }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (img) ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    markers.forEach((m, i) => {
      const px = m.x * canvas.width, py = m.y * canvas.height;
      const color = (Matching.MARKER_TYPES[m.type]?.color) || '#3b82f6';
      // halo
      ctx.beginPath(); ctx.arc(px, py, 11, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
      // dot
      ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
      // index label
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), px, py);
    });
  }

  function clear() { if (markers.length) pushHistory(); markers = []; draw(); onChange(getMarkers()); }

  window.addEventListener('resize', () => { fit(); draw(); });

  return { init, loadImage, setMarkers, getMarkers, setActiveType, setActiveRegion, clear, draw, undo, redo, canUndo, canRedo };
})();
