import type { TrackDefinition, TrackPoint } from './types';

const anchors: TrackPoint[] = [
  { x: -57, z: -35 }, { x: -57, z: 20 }, { x: -28, z: 57 },
  { x: 23, z: 57 }, { x: 54, z: 26 }, { x: 30, z: -3 },
  { x: 57, z: -34 }, { x: 20, z: -58 }, { x: -28, z: -58 },
];
const points: TrackPoint[] = [];
for (let i = 0; i < anchors.length; i++) {
  const a = anchors[(i + anchors.length - 1) % anchors.length]!;
  const b = anchors[i]!;
  const c = anchors[(i + 1) % anchors.length]!;
  const d = anchors[(i + 2) % anchors.length]!;
  for (let j = 0; j < 24; j++) {
    const t = j / 24;
    const component = (key: 'x' | 'z') => .5 * (2 * b[key] + (-a[key] + c[key]) * t +
      (2 * a[key] - 5 * b[key] + 4 * c[key] - d[key]) * t * t +
      (-a[key] + 3 * b[key] - 3 * c[key] + d[key]) * t * t * t);
    points.push({ x: component('x'), z: component('z') });
  }
}
export const TRACK: TrackDefinition = { points, width: 14, ramps: [
  { progress: .105, length: 9, height: 2 }, { progress: .77, length: 9, height: 2 },
] };
const lengths = points.map((p, i) => Math.hypot(points[(i + 1) % points.length]!.x - p.x, points[(i + 1) % points.length]!.z - p.z));
const cumulative = [0];
for (const length of lengths) cumulative.push(cumulative[cumulative.length - 1]! + length);
export const TRACK_LENGTH = cumulative[cumulative.length - 1]!;
export const wrap = (value: number) => ((value % 1) + 1) % 1;

export function sampleTrack(progress: number): { x: number; z: number; heading: number } {
  const distance = wrap(progress) * TRACK_LENGTH;
  let i = 0;
  while (i < points.length - 1 && cumulative[i + 1]! <= distance) i++;
  const a = points[i]!, b = points[(i + 1) % points.length]!;
  const t = (distance - cumulative[i]!) / lengths[i]!;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, heading: Math.atan2(b.x - a.x, b.z - a.z) };
}

export function trackDistance(x: number, z: number): { distance: number; progress: number } {
  let best = Infinity, progress = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!, b = points[(i + 1) % points.length]!;
    const dx = b.x - a.x, dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
    const distance = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
    if (distance < best) { best = distance; progress = (cumulative[i]! + t * lengths[i]!) / TRACK_LENGTH; }
  }
  return { distance: best, progress: wrap(progress) };
}
