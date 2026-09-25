// Places point labels (e.g. percentiles) next to chart markers without overlapping each other or the
// markers: tries positions around each point (right, left, above, below, then further out with a
// thin leader line) and takes the first free one.
export function drawPointLabels(ctx, items, { size, font, r, halo = 0.45 }) {
  ctx.save();
  ctx.font = font; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.lineJoin = "round";
  const h = size, gap = size * 0.25;
  const obstacles = items.map((it) => [it.x - r, it.y - r, it.x + r, it.y + r]);
  const placed = [];
  const hit = (b) => [...placed, ...obstacles].reduce((a, o) => a + Math.max(0, Math.min(b[2], o[2]) - Math.max(b[0], o[0])) * Math.max(0, Math.min(b[3], o[3]) - Math.max(b[1], o[1])), 0);
  for (const it of [...items].sort((a, b) => a.x - b.x)) {
    const w = ctx.measureText(it.text).width;
    const cands = [
      [it.x + r + gap, it.y - r * 0.2], [it.x + r + gap, it.y + h * 0.9], [it.x - r - gap - w, it.y - r * 0.2], [it.x - r - gap - w, it.y + h * 0.9],
      [it.x - w / 2, it.y - r - gap], [it.x - w / 2, it.y + r + gap + h],
      [it.x + r + gap, it.y - r - h * 1.1], [it.x + r + gap, it.y + r + h * 2.1], [it.x - r - gap - w, it.y - r - h * 1.1], [it.x - r - gap - w, it.y + r + h * 2.1],
      [it.x - w / 2, it.y - r - gap - h * 1.3], [it.x - w / 2, it.y + r + gap + h * 2.3],
    ];
    let best = null;
    for (const [lx, ly] of cands) {
      const box = [lx - 1, ly - h * 0.85, lx + w + 1, ly + h * 0.2];
      const o = hit(box);
      if (!best || o < best.o) best = { lx, ly, box, o };
      if (o === 0) break;
    }
    placed.push(best.box);
    const cx = (best.box[0] + best.box[2]) / 2, cy = (best.box[1] + best.box[3]) / 2;
    if (Math.hypot(cx - it.x, cy - it.y) > r + h * 1.4) { // leader line for labels moved away from their point
      ctx.strokeStyle = it.color; ctx.lineWidth = Math.max(0.6, size * 0.06); ctx.beginPath(); ctx.moveTo(it.x, it.y);
      ctx.lineTo(Math.min(Math.max(it.x, best.box[0]), best.box[2]), Math.min(Math.max(it.y, best.box[1]), best.box[3])); ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255,255,255,.95)"; ctx.lineWidth = size * halo; ctx.strokeText(it.text, best.lx, best.ly);
    ctx.fillStyle = it.color; ctx.fillText(it.text, best.lx, best.ly);
  }
  ctx.restore();
}
