/* DugongID — PDF report generation (offline, via jsPDF bundled locally).
 * Produces an ID profile sheet for an individual: code, status, marks,
 * sighting history, observation notes, and the best dorsal/fluke photo.
 */
const PDFReport = (() => {

  async function imageDataURL(mediaId, maxW = 900) {
    if (!mediaId) return null;
    const rec = await DB.get('media', mediaId);
    if (!rec) return null;
    const url = URL.createObjectURL(rec.blob);
    const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = url; });
    const ratio = img.height / img.width;
    const w = Math.min(maxW, img.width), h = Math.round(w * ratio);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    c.getContext('2d').drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    return { dataURL: c.toDataURL('image/jpeg', 0.85), w, h };
  }

  async function individualProfile(individual, sightings) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const M = 48; let y = M;

    // Header band
    doc.setFillColor(11, 59, 71); doc.rect(0, 0, W, 70, 'F');
    doc.setTextColor(255); doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
    doc.text('Dugong ID Profile', M, 34);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text('DugongID — Conservation Photo-ID', M, 52);
    y = 96;

    doc.setTextColor(20);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(22);
    doc.text(individual.code || 'Unnamed individual', M, y); y += 8;
    doc.setDrawColor(11, 59, 71); doc.setLineWidth(2); doc.line(M, y, W - M, y); y += 22;

    const PH = doc.internal.pageSize.getHeight();
    const field = (label, val) => {
      const lines = doc.splitTextToSize(String(val || '—'), W - 2 * M - 130);
      const blockH = Math.max(18, lines.length * 15) + 4;
      if (y + blockH > PH - M) { doc.addPage(); y = M; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(90);
      doc.text(label.toUpperCase(), M, y);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(12); doc.setTextColor(20);
      doc.text(lines, M + 130, y);
      y += blockH;
    };

    const BAYS = (window.Matching && Matching.BAYS) || {};
    field('Status', individual.status);
    field('Bay', individual.bay ? `${individual.bay} — ${BAYS[individual.bay] || ''}` : '');
    field('Estimated age class', individual.ageClass);
    field('Sex', individual.sex);
    field('First seen', individual.firstSeen);
    field('Last seen', individual.lastSeen);
    field('Sighting location', individual.locCode);
    field('Distinguishing marks', individual.marksSummary);
    field('Behaviour / character', individual.behaviour);
    field('Conservation notes', individual.notes);

    // Photo
    const photo = await imageDataURL(individual.coverMediaId);
    if (photo) {
      y += 6;
      const dispW = Math.min(W - 2 * M, 360);
      const dispH = dispW * (photo.h / photo.w);
      if (y + dispH > doc.internal.pageSize.getHeight() - M) { doc.addPage(); y = M; }
      doc.addImage(photo.dataURL, 'JPEG', M, y, dispW, dispH);
      y += dispH + 16;
    }

    // Sighting history
    const own = sightings.filter(s => s.individualId === individual.id)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    if (y > doc.internal.pageSize.getHeight() - 120) { doc.addPage(); y = M; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(11, 59, 71);
    doc.text(`Sighting history (${own.length})`, M, y); y += 18;
    doc.setTextColor(40); doc.setFontSize(10);
    if (!own.length) { doc.setFont('helvetica', 'italic'); doc.text('No recorded sightings yet.', M, y); y += 16; }
    own.forEach(s => {
      if (y > doc.internal.pageSize.getHeight() - M) { doc.addPage(); y = M; }
      doc.setFont('helvetica', 'bold'); doc.text(`• ${s.date || 'undated'}`, M, y);
      doc.setFont('helvetica', 'normal');
      const txt = [s.locCode, s.location, s.behaviour, (s.markers ? `${s.markers.length} marks` : '')].filter(Boolean).join(' · ');
      const lines = doc.splitTextToSize(txt || '—', W - 2 * M - 90);
      doc.text(lines, M + 90, y); y += Math.max(14, lines.length * 13) + 4;
    });

    // Footer
    const pages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p); doc.setFontSize(8); doc.setTextColor(150);
      doc.text(`DugongID · generated ${new Date().toLocaleDateString()} · page ${p}/${pages}`,
        M, doc.internal.pageSize.getHeight() - 20);
    }
    doc.save(`DugongID_${(individual.code || 'profile').replace(/\s+/g, '_')}.pdf`);
  }

  return { individualProfile };
})();
