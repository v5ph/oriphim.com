/* Hopf geometry and fibre shading adapted from the supplied hopf-fibration.html.
   Uses the site's shared camera, voxel canvas and point morphing. */
window.createHopfShape = function (count) {
  const NF = 7 * 15, TAU = Math.PI * 2;
  const lift = new Float32Array(count * 4);
  const latitude = new Float32Array(count);
  const fibre = new Uint16Array(count);
  const latitudeIndex = new Uint8Array(count);
  const bands = new Float64Array(7);
  const order = Array.from({length: NF}, (_, i) => i);
  let seed = 0x9e3779b9;
  const random = () => { seed = Math.imul(seed ^ (seed >>> 15), 0x2545f491); return ((seed >>> 0) % 1000000) / 1000000; };
  for (let i = NF - 1; i > 0; i--) { const j = (random() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
  const rank = new Uint16Array(NF);
  order.forEach((id, index) => { rank[id] = index; });
  for (let i = 0; i < count; i++) {
    const id = i % NF, a = Math.floor(id / 15), b = id % 15;
    const u = (a + .5) / 7, theta = .20 * Math.PI + u * .62 * Math.PI;
    const z = Math.cos(theta), r = Math.sin(theta), phi = (b + .5) / 15 * TAU + a * .41;
    const x = r * Math.cos(phi), y = r * Math.sin(phi), al = 1 / Math.sqrt(2 * (1 + z));
    const samples = Math.floor((count - 1 - id) / NF) + 1;
    const t = Math.floor(i / NF) / samples * TAU, ct = Math.cos(t), st = Math.sin(t), q = i * 4;
    lift[q] = al * (1 + z) * ct;
    lift[q + 1] = al * (x * st - y * ct);
    lift[q + 2] = al * (x * ct + y * st);
    lift[q + 3] = al * (1 + z) * st;
    latitude[i] = u; latitudeIndex[i] = a; fibre[i] = rank[id];
  }
  const points = new Float32Array(count * 3), visible = new Uint8Array(count);
  const brightness = new Float32Array(count), chroma = new Float32Array(count);
  const lfo = (t, p1, p2, ph) => Math.max(0, Math.min(1, .5 + .5 * (.68 * Math.sin(t * TAU / p1 + ph) + .32 * Math.sin(t * TAU / p2 + ph * 1.7))));
  return { points, visible, brightness, chroma,
    prepare(time) {
      const cyc = time * 1.25;
      const density = .40 + .60 * lfo(cyc, 31, 19.7, 1.9);
      const glow = .55 + .8 * (.30 + .70 * lfo(cyc, 47, 29.3, 0));
      const banding = .20 + .80 * lfo(cyc, 59, 37.1, 3.4);
      const nf = Math.max(6, (NF * (.45 + .55 * density)) | 0);
      const ca = Math.cos(time * .115), sa = Math.sin(time * .115);
      const cb = Math.cos(time * .071), sb = Math.sin(time * .071);
      // All samples in a latitude share this band; evaluate it seven times.
      for (let a = 0; a < 7; a++) {
        // Match the Float32 latitude used by the original per-point calculation.
        const u = latitude[a * 15];
        bands[a] = .55 + .85 * Math.abs(Math.sin(u * Math.PI * (1.2 + 2.4 * banding) + u * 3.1));
      }
      for (let i = 0; i < count; i++) {
        const q = i * 4, p = i * 3;
        const r0 = lift[q] * ca - lift[q + 1] * sa, r1 = lift[q] * sa + lift[q + 1] * ca;
        const r2 = lift[q + 2] * cb - lift[q + 3] * sb, r3 = lift[q + 2] * sb + lift[q + 3] * cb;
        // Keep the projection pole just outside S3. Its denominator stays
        // positive along the entire fibre, so rings stay closed instead of
        // being discarded near infinity. Maximum radius is .62/sqrt(1.08²-1).
        const den = 1.08 - r0, sc = .62 / den;
        const x = r1 * sc, y = r2 * sc, z = r3 * sc, d = Math.sqrt(x*x + y*y + z*z);
        // Fit that bounded radius inside the canvas with room for voxel edges.
        const scale = .27 / .41;
        points[p] = x * scale; points[p + 1] = y * scale; points[p + 2] = z * scale;
        visible[i] = fibre[i] < nf ? 1 : 0;
        const lat = latitude[i];
        const band = bands[latitudeIndex[i]];
        brightness[i] = band * glow * (.95 / (1 + .55 * d));
        chroma[i] = (lat - .5) * 1.5 + (.5 - d * .3);
      }
    }
  };
};
