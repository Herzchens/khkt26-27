import { cloudScaleAtProgress } from "./exploration.ts";

export type MapFogNode = {
  id: string;
  x: number;
  y: number;
  angle: number;
  size: number;
  clearsAt: number;
};

/** The fog opening follows the same approach window as the former cloud cover. */
export function mapFogApertureScale(
  progress: number,
  clearsAt: number,
  approach = 0.02,
): number {
  return 1 - cloudScaleAtProgress(progress, clearsAt, approach);
}

export function mapFogMotionShouldRun(
  intersects: boolean,
  documentVisible: boolean,
  prefersReducedMotion: boolean,
): boolean {
  return intersects && documentVisible && !prefersReducedMotion;
}

/** Guarantees the whole map is clear once exploration reaches 100%. */
export function mapFogLayerOpacity(progress: number): number {
  const current = Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : 0;
  return Math.min(1, Math.max(0, (1 - current) / 0.02));
}

/** Stable, uneven points for broad, cloud-shaped openings around fog nodes. */
export function mapFogBlobPoints(seed: string): { x: number; y: number }[] {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619);
  }
  const phase = ((hash >>> 0) / 0xffffffff) * Math.PI * 2;
  const count = 22;
  return Array.from({ length: count }, (_, i) => {
    const angle = (Math.PI * 2 * i) / count;
    const radius =
      1 +
      0.14 * Math.sin(angle * 2 + phase) +
      0.09 * Math.cos(angle * 3 - phase * 1.3) +
      0.055 * Math.sin(angle * 5 + phase * 0.7) +
      0.03 * Math.cos(angle * 7 - phase * 0.45) +
      0.02 * Math.sin(angle * 11 + phase * 1.1);
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  });
}

/** Overlapping, rotated apertures merge into irregular fog banks instead of isolated circles. */
export function mapFogApertureTransform(cloud: MapFogNode, opening: number): string {
  const boundedOpening = Number.isFinite(opening)
    ? Math.max(0, Math.min(1, opening))
    : 0;
  let hash = 2166136261;
  for (let i = 0; i < cloud.id.length; i++) {
    hash = Math.imul(hash ^ cloud.id.charCodeAt(i), 16777619);
  }
  const angle = cloud.angle + ((((hash >>> 0) % 41) - 20) * 0.8);
  const number = (value: number) => value.toFixed(2);
  return `translate(${number(cloud.x)} ${number(cloud.y)}) rotate(${number(angle)}) scale(${number(178 * cloud.size * boundedOpening)} ${number(120 * cloud.size * boundedOpening)})`;
}

export function mapFogBlobPath(seed: string): string {
  const points = mapFogBlobPoints(seed);
  const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  });
  const number = (value: number) => value.toFixed(3);
  const start = midpoint(points[points.length - 1], points[0]);
  const curves = points.map((point, i) => {
    const end = midpoint(point, points[(i + 1) % points.length]);
    return `Q ${number(point.x)} ${number(point.y)} ${number(end.x)} ${number(end.y)}`;
  });
  return `M ${number(start.x)} ${number(start.y)} ${curves.join(" ")} Z`;
}
