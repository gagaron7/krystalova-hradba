/** Polyline path helpers. Distances are in logical pixels. */

export function compilePath(points) {
  const segs = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segs.push({
      ax: a.x,
      ay: a.y,
      bx: b.x,
      by: b.y,
      len,
      start: total,
    });
    total += len;
  }
  return { points, segs, total };
}

export function pointAt(path, dist) {
  const pts = path.points;
  if (dist <= 0) {
    const a = pts[0];
    const b = pts[1];
    return { x: a.x, y: a.y, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }
  if (dist >= path.total) {
    const a = pts[pts.length - 2];
    const b = pts[pts.length - 1];
    return { x: b.x, y: b.y, angle: Math.atan2(b.y - a.y, b.x - a.x) };
  }
  for (const s of path.segs) {
    if (dist <= s.start + s.len) {
      const t = s.len ? (dist - s.start) / s.len : 0;
      return {
        x: s.ax + (s.bx - s.ax) * t,
        y: s.ay + (s.by - s.ay) * t,
        angle: Math.atan2(s.by - s.ay, s.bx - s.ax),
      };
    }
  }
  const last = pts[pts.length - 1];
  return { x: last.x, y: last.y, angle: 0 };
}
