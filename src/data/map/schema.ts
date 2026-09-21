import { z } from 'zod'

const id = z.string().trim().min(1).max(120)
const coordinate = z.tuple([z.number().finite().min(124).max(132), z.number().finite().min(33).max(39)])
const ring = z.array(coordinate).min(4).max(50000).refine((points) => points[0][0] === points.at(-1)![0] && points[0][1] === points.at(-1)![1], '경계 고리는 닫혀 있어야 합니다.')
const polygon = z.array(ring).min(1)
export const readyMapSchema = z.object({
  schemaVersion: z.literal(1), status: z.literal('ready'), version: id,
  asOf: z.iso.date(),
  coverageNote: z.string().max(2000).optional(),
  sources: z.array(z.object({ name: id, url: z.url().refine((value) => value.startsWith('https://')), license: id, attribution: z.string().min(1).max(1000) })).min(1),
  regions: z.array(z.object({ code: z.string().regex(/^11\d{3}$/), name: id, polygons: z.array(polygon).min(1), label: coordinate })).length(25),
  stations: z.array(z.object({ id, name: id, lines: z.array(id).min(1), coordinate, address: z.string().max(300).optional() })).min(1).max(5000),
  routes: z.array(z.object({ id, name: id, color: z.string().regex(/^#[0-9a-fA-F]{6}$/), stationIds: z.array(id).min(2).max(1000) })).min(1).max(500),
}).superRefine((value, context) => {
  for (const items of [value.regions.map((x) => x.code), value.stations.map((x) => x.id), value.routes.map((x) => x.id)]) {
    if (new Set(items).size !== items.length) context.addIssue({ code: 'custom', message: '지도 자료의 ID가 중복됩니다.' })
  }
  const stations = new Map(value.stations.map((station) => [station.id, station]))
  for (const route of value.routes) for (const stationId of route.stationIds) {
    const station = stations.get(stationId)
    if (!station || !station.lines.includes(route.name)) context.addIssue({ code: 'custom', message: '노선과 역 연결이 일치하지 않습니다.' })
  }
})
export type MapBundle = z.infer<typeof readyMapSchema>
export type MapStation = MapBundle['stations'][number]
export function parseMapBundle(input: unknown): MapBundle { return readyMapSchema.parse(input) }
