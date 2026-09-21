import type { MapBundle } from './schema.ts'
export type Point = [number, number]
function inRing([x,y]: Point, ring: Point[]) {
  let inside = false
  for (let i=0, j=ring.length-1; i<ring.length; j=i++) {
    const [ax,ay] = ring[i], [bx,by] = ring[j]
    const cross = (x-ax)*(by-ay)-(y-ay)*(bx-ax)
    if (Math.abs(cross)<1e-12 && x>=Math.min(ax,bx) && x<=Math.max(ax,bx) && y>=Math.min(ay,by) && y<=Math.max(ay,by)) return true
    if ((ay>y)!==(by>y) && x<(bx-ax)*(y-ay)/(by-ay)+ax) inside=!inside
  }
  return inside
}
export function insideRegions(point: Point, regions: MapBundle['regions']) {
  return regions.some((region) => region.polygons.some((polygon) => inRing(point, polygon[0]) && !polygon.slice(1).some((hole) => inRing(point,hole))))
}
export function clusterPoints<T extends { id: string }>(points: { item: T; x: number; y: number }[], width: number, height: number, focusedId: string | null, cell=44) {
  if (!Number.isFinite(cell) || cell <= 0) throw new Error('Marker spacing must be positive')
  const buckets = new Map<string, { items: T[]; x: number; y: number }[]>()
  const groups: { items: T[]; x: number; y: number }[] = []
  // Stable anchors never drift across grid boundaries. Neighbouring cells are
  // checked too, so two 44px touch targets cannot cover each other's centre.
  // The selected apartment anchors its group without inventing a new position.
  const ordered = focusedId ? [...points.filter(p => p.item.id === focusedId), ...points.filter(p => p.item.id !== focusedId)] : points
  for (const point of ordered) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x<0 || point.y<0 || point.x>width || point.y>height) continue
    const col = Math.floor(point.x/cell), row = Math.floor(point.y/cell)
    let nearest: typeof groups[number] | undefined
    let distance = cell * cell
    for (let dx=-1; dx<=1; dx++) for (let dy=-1; dy<=1; dy++) {
      for (const candidate of buckets.get(`${col+dx},${row+dy}`) ?? []) {
        const squared = (candidate.x-point.x)**2 + (candidate.y-point.y)**2
        if (squared < distance) { nearest = candidate; distance = squared }
      }
    }
    if (nearest) nearest.items.push(point.item)
    else {
      const group = { items:[point.item], x:point.x, y:point.y }
      const key = `${col},${row}`
      buckets.set(key, [...(buckets.get(key) ?? []), group]); groups.push(group)
    }
  }
  return groups
}
