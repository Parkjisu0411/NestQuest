import { SEOUL_AREAS } from '../data/seoulAreas.ts'
import type { QuestArea } from '../domain/models.ts'

export interface SetupAreaRegion extends QuestArea {
  shortLabel: string
  ring: 'seoul' | 'metro'
  path: string
  labelX: number
  labelY: number
}

export const SETUP_AREA_REGIONS: SetupAreaRegion[] = [
  {
    sidoCode: '41',
    sidoName: '경기도',
    sigunguCode: '41280',
    sigunguName: '고양시',
    shortLabel: '고양',
    ring: 'metro',
    path: 'M102,8 L222,6 L232,58 L198,66 L88,70 L90,22 Z',
    labelX: 160,
    labelY: 38,
  },
  {
    sidoCode: '11',
    sidoName: '서울특별시',
    sigunguCode: '11380',
    sigunguName: '은평구',
    shortLabel: '은평',
    ring: 'seoul',
    path: 'M88,70 L198,66 L186,118 L78,124 Z',
    labelX: 138,
    labelY: 98,
  },
  {
    sidoCode: '41',
    sidoName: '경기도',
    sigunguCode: '41450',
    sigunguName: '하남시',
    shortLabel: '하남',
    ring: 'metro',
    path: 'M292,78 L350,86 L348,158 L286,146 L270,92 Z',
    labelX: 318,
    labelY: 118,
  },
  {
    sidoCode: '11',
    sidoName: '서울특별시',
    sigunguCode: '11500',
    sigunguName: '강서구',
    shortLabel: '강서',
    ring: 'seoul',
    path: 'M24,118 L78,124 L92,180 L30,192 L12,150 Z',
    labelX: 52,
    labelY: 156,
  },
  {
    sidoCode: '11',
    sidoName: '서울특별시',
    sigunguCode: '11440',
    sigunguName: '마포구',
    shortLabel: '마포',
    ring: 'seoul',
    path: 'M78,124 L186,118 L176,174 L92,180 Z',
    labelX: 132,
    labelY: 152,
  },
  {
    sidoCode: '11',
    sidoName: '서울특별시',
    sigunguCode: '11200',
    sigunguName: '성동구',
    shortLabel: '성동',
    ring: 'seoul',
    path: 'M186,118 L268,84 L286,146 L248,170 L176,174 Z',
    labelX: 232,
    labelY: 136,
  },
  {
    sidoCode: '41',
    sidoName: '경기도',
    sigunguCode: '41190',
    sigunguName: '부천시',
    shortLabel: '부천',
    ring: 'metro',
    path: 'M4,168 L24,118 L12,150 L30,192 L38,230 L6,228 Z',
    labelX: 18,
    labelY: 188,
  },
  {
    sidoCode: '11',
    sidoName: '서울특별시',
    sigunguCode: '11470',
    sigunguName: '양천구',
    shortLabel: '양천',
    ring: 'seoul',
    path: 'M30,192 L92,180 L88,228 L38,230 Z',
    labelX: 62,
    labelY: 210,
  },
  {
    sidoCode: '11',
    sidoName: '서울특별시',
    sigunguCode: '11560',
    sigunguName: '영등포구',
    shortLabel: '영등포',
    ring: 'seoul',
    path: 'M92,180 L176,174 L168,226 L88,228 Z',
    labelX: 130,
    labelY: 204,
  },
  {
    sidoCode: '11',
    sidoName: '서울특별시',
    sigunguCode: '11170',
    sigunguName: '용산구',
    shortLabel: '용산',
    ring: 'seoul',
    path: 'M176,174 L248,170 L240,222 L168,226 Z',
    labelX: 208,
    labelY: 200,
  },
  {
    sidoCode: '11',
    sidoName: '서울특별시',
    sigunguCode: '11710',
    sigunguName: '송파구',
    shortLabel: '송파',
    ring: 'seoul',
    path: 'M248,170 L286,146 L292,216 L240,222 Z',
    labelX: 266,
    labelY: 190,
  },
  {
    sidoCode: '41',
    sidoName: '경기도',
    sigunguCode: '41210',
    sigunguName: '광명시',
    shortLabel: '광명',
    ring: 'metro',
    path: 'M8,236 L38,230 L52,276 L18,292 L6,258 Z',
    labelX: 26,
    labelY: 262,
  },
  {
    sidoCode: '11',
    sidoName: '서울특별시',
    sigunguCode: '11530',
    sigunguName: '구로구',
    shortLabel: '구로',
    ring: 'seoul',
    path: 'M38,230 L88,228 L96,274 L52,276 Z',
    labelX: 68,
    labelY: 254,
  },
  {
    sidoCode: '11',
    sidoName: '서울특별시',
    sigunguCode: '11590',
    sigunguName: '동작구',
    shortLabel: '동작',
    ring: 'seoul',
    path: 'M88,228 L168,226 L162,272 L96,274 Z',
    labelX: 128,
    labelY: 252,
  },
  {
    sidoCode: '11',
    sidoName: '서울특별시',
    sigunguCode: '11680',
    sigunguName: '강남구',
    shortLabel: '강남',
    ring: 'seoul',
    path: 'M168,226 L240,222 L246,276 L162,272 Z',
    labelX: 204,
    labelY: 252,
  },
  {
    sidoCode: '41',
    sidoName: '경기도',
    sigunguCode: '41130',
    sigunguName: '성남시',
    shortLabel: '성남',
    ring: 'metro',
    path: 'M246,222 L292,216 L346,236 L342,304 L252,282 Z',
    labelX: 300,
    labelY: 258,
  },
  {
    sidoCode: '11',
    sidoName: '서울특별시',
    sigunguCode: '11620',
    sigunguName: '관악구',
    shortLabel: '관악',
    ring: 'seoul',
    path: 'M52,276 L96,274 L162,272 L154,322 L92,326 L58,300 Z',
    labelX: 108,
    labelY: 300,
  },
  {
    sidoCode: '11',
    sidoName: '서울특별시',
    sigunguCode: '11650',
    sigunguName: '서초구',
    shortLabel: '서초',
    ring: 'seoul',
    path: 'M162,272 L246,276 L238,330 L154,322 Z',
    labelX: 200,
    labelY: 302,
  },
  {
    sidoCode: '41',
    sidoName: '경기도',
    sigunguCode: '41290',
    sigunguName: '과천시',
    shortLabel: '과천',
    ring: 'metro',
    path: 'M176,330 L238,330 L246,372 L182,374 Z',
    labelX: 210,
    labelY: 354,
  },
]

for (const area of SEOUL_AREAS) {
  if (!SETUP_AREA_REGIONS.some((region) => region.sigunguCode === area.sigunguCode)) SETUP_AREA_REGIONS.push({ ...area, shortLabel: area.sigunguName, ring: 'seoul', path: '', labelX: 0, labelY: 0 })
}

export const SEOUL_SIDO_CODE = '11'
export const GYEONGGI_SIDO_CODE = '41'
export const INCHEON_SIDO_CODE = '28'

export function toQuestArea(region: SetupAreaRegion): QuestArea {
  return {
    sidoCode: region.sidoCode,
    sidoName: region.sidoName,
    sigunguCode: region.sigunguCode,
    sigunguName: region.sigunguName,
  }
}

export function hasSidoAreas(sidoCode: string): boolean {
  return SETUP_AREA_REGIONS.some((region) => region.sidoCode === sidoCode)
}

export function questAreasForSido(sidoCode: string): QuestArea[] {
  return SETUP_AREA_REGIONS.filter((region) => region.sidoCode === sidoCode).map(
    toQuestArea,
  )
}

export function mergeQuestAreas(
  current: readonly QuestArea[],
  adding: readonly QuestArea[],
): QuestArea[] {
  const next = new Map(current.map((area) => [area.sigunguCode, area]))
  for (const area of adding) {
    next.set(area.sigunguCode, area)
  }
  return [...next.values()]
}

export function groupedSetupRegions(): Array<{
  sidoCode: string
  sidoName: string
  regions: SetupAreaRegion[]
}> {
  const groups = new Map<string, { sidoName: string; regions: SetupAreaRegion[] }>()
  for (const region of SETUP_AREA_REGIONS) {
    const group = groups.get(region.sidoCode)
    if (group) {
      group.regions.push(region)
    } else {
      groups.set(region.sidoCode, {
        sidoName: region.sidoName,
        regions: [region],
      })
    }
  }

  const order = [SEOUL_SIDO_CODE, GYEONGGI_SIDO_CODE, INCHEON_SIDO_CODE]
  return [...groups.entries()]
    .sort((left, right) => {
      const leftIndex = order.indexOf(left[0])
      const rightIndex = order.indexOf(right[0])
      const leftRank = leftIndex === -1 ? order.length : leftIndex
      const rightRank = rightIndex === -1 ? order.length : rightIndex
      return leftRank - rightRank
    })
    .map(([sidoCode, group]) => ({
      sidoCode,
      sidoName: group.sidoName.replace('특별시', '').replace('광역시', '').replace('도', ''),
      regions: [...group.regions].sort((left, right) =>
        left.sigunguName.localeCompare(right.sigunguName, 'ko'),
      ),
    }))
}
