import { eokToWon } from '../domain/calculations.ts'
import type { DiscoverableApartment } from '../domain/discover.ts'
import type {
  AIResearch,
  Apartment,
  ApartmentUnitType,
  CommuteEstimate,
  CommuteRouteSegment,
  ManagementFeeSummary,
  PassReason,
  PriceConfidence,
  PriceEstimate,
  QuestArea,
  QuestStage,
  Transaction,
} from '../domain/models.ts'
import { SETUP_AREA_REGIONS, toQuestArea } from './areas.ts'
import { MOCK_COMMUTE_DESTINATIONS } from './commuteDestinations.ts'

/**
 * Phase 1 fixture data only.
 * Names may be recognizable; prices, commute times, coordinates,
 * ages, household counts, research, and stages are invented mock values.
 */
const FIXTURE_AT = '2026-09-01T00:00:00+09:00'

function area(sigunguCode: string): QuestArea {
  const region = SETUP_AREA_REGIONS.find((item) => item.sigunguCode === sigunguCode)
  if (!region) {
    throw new Error(`Unknown mock area ${sigunguCode}`)
  }
  return toQuestArea(region)
}

function estimate(
  apartmentId: string,
  unitTypeId: string,
  estimatedPrice: number,
  transactionCount: number,
  extras: {
    lowPrice?: number
    highPrice?: number
    latestPrice?: number
    confidence?: PriceConfidence
  } = {},
): PriceEstimate {
  return {
    apartmentId,
    unitTypeId,
    estimatedPrice,
    lowPrice: extras.lowPrice ?? Math.round(estimatedPrice * 0.96),
    highPrice: extras.highPrice ?? Math.round(estimatedPrice * 1.03),
    latestPrice: extras.latestPrice ?? estimatedPrice,
    transactionCount,
    periodMonths: 6,
    confidence: extras.confidence ?? 'MEDIUM',
    calculatedAt: FIXTURE_AT,
  }
}

function unitType(
  apartmentId: string,
  areaGroup: number,
  exclusiveArea: number,
  priceEok: number,
  transactionCount = 6,
  extras: {
    lowEok?: number
    highEok?: number
    latestEok?: number
    confidence?: PriceConfidence
  } = {},
): ApartmentUnitType {
  const id = `${apartmentId}-${areaGroup}`
  const estimatedPrice = eokToWon(priceEok)
  return {
    id,
    apartmentId,
    areaGroup,
    exclusiveAreas: [exclusiveArea],
    priceEstimate: estimate(apartmentId, id, estimatedPrice, transactionCount, {
      lowPrice: extras.lowEok === undefined ? undefined : eokToWon(extras.lowEok),
      highPrice: extras.highEok === undefined ? undefined : eokToWon(extras.highEok),
      latestPrice: extras.latestEok === undefined ? undefined : eokToWon(extras.latestEok),
      confidence: extras.confidence,
    }),
  }
}

function sale(
  apartmentId: string,
  areaGroup: number,
  contractDate: string,
  priceEok: number,
  floor: number,
  exclusiveArea: number,
): Transaction {
  return {
    id: `${apartmentId}-${areaGroup}-${contractDate}-${floor}`,
    apartmentId,
    unitTypeId: `${apartmentId}-${areaGroup}`,
    exclusiveArea,
    floor,
    price: eokToWon(priceEok),
    contractDate,
    canceled: false,
  }
}

function defaultRoute(
  totalMinutes: number,
  destinationName: string,
): CommuteRouteSegment[] {
  const access = Math.min(8, Math.max(5, Math.round(totalMinutes * 0.14)))
  const egress = Math.min(8, Math.max(5, Math.round(totalMinutes * 0.12)))
  const subway = Math.max(4, totalMinutes - access - egress)
  const adjustedEgress = totalMinutes - access - subway

  return [
    { type: 'WALK', durationMinutes: access, from: '단지', to: '가까운 역' },
    {
      type: 'SUBWAY',
      durationMinutes: subway,
      lineName: '지하철',
      from: '가까운 역',
      to: destinationName,
    },
    {
      type: 'WALK',
      durationMinutes: adjustedEgress,
      from: destinationName,
      to: destinationName,
    },
  ]
}

function walkingMinutesFrom(route: CommuteRouteSegment[]): number {
  return route
    .filter((segment) => segment.type === 'WALK')
    .reduce((sum, segment) => sum + segment.durationMinutes, 0)
}

function transferCountFrom(route: CommuteRouteSegment[]): number {
  const rides = route.filter(
    (segment) => segment.type === 'SUBWAY' || segment.type === 'BUS',
  ).length
  return Math.max(0, rides - 1)
}

function commutes(
  apartmentId: string,
  minutesByDestination: Record<string, number>,
  routesByDestination: Partial<Record<string, CommuteRouteSegment[]>> = {},
): CommuteEstimate[] {
  return MOCK_COMMUTE_DESTINATIONS.map((destination) => {
    const totalMinutes = minutesByDestination[destination.id]
    if (totalMinutes === undefined) {
      throw new Error(`Missing mock commute for ${apartmentId} / ${destination.id}`)
    }

    const route =
      routesByDestination[destination.id] ?? defaultRoute(totalMinutes, destination.name)

    return {
      apartmentId,
      destinationId: destination.id,
      totalMinutes,
      transferCount: transferCountFrom(route),
      walkingMinutes: walkingMinutesFrom(route),
      route,
      provider: 'mock',
      calculatedAt: FIXTURE_AT,
    }
  })
}

function complex(input: {
  id: string
  name: string
  address: string
  sigunguCode: string
  latitude: number
  longitude: number
  approvalDate: string
  householdCount: number
  buildingCount?: number
  parkingCount?: number
  heatingType?: string
  managementFee?: ManagementFeeSummary
  units: ApartmentUnitType[]
  minutes: Record<string, number>
  routes?: Partial<Record<string, CommuteRouteSegment[]>>
  transactions?: Transaction[]
  research?: AIResearch[]
  initialStage: QuestStage
  passReason?: PassReason
}): DiscoverableApartment {
  const apartment: Apartment = {
    id: input.id,
    name: input.name,
    address: input.address,
    latitude: input.latitude,
    longitude: input.longitude,
    approvalDate: input.approvalDate,
    householdCount: input.householdCount,
    buildingCount: input.buildingCount,
    parkingCount: input.parkingCount,
    heatingType: input.heatingType,
    managementFee: input.managementFee,
    createdAt: FIXTURE_AT,
    updatedAt: FIXTURE_AT,
  }

  return {
    apartment,
    area: area(input.sigunguCode),
    unitTypes: input.units,
    commutes: commutes(input.id, input.minutes, input.routes),
    transactions: input.transactions,
    research: input.research,
    initialStage: input.initialStage,
    passReason: input.passReason,
  }
}

const MAGOK_ID = 'apt-magok-mvalley-7'
const XI_ID = 'apt-yeouido-xi-dignity'
const SANGDO_ID = 'apt-sangdo-harrington'

export const MOCK_APARTMENTS: DiscoverableApartment[] = [
  complex({
    id: MAGOK_ID,
    name: '마곡엠밸리7단지',
    address: '서울특별시 강서구 마곡중앙로 161',
    sigunguCode: '11500',
    latitude: 37.5604,
    longitude: 126.8251,
    approvalDate: '2014-08-20',
    householdCount: 1004,
    buildingCount: 12,
    parkingCount: 1205,
    heatingType: '지역난방',
    managementFee: {
      monthlyAverage: 182_000,
      periodMonths: 12,
      calculatedAt: '2026-08-01',
    },
    units: [
      unitType(MAGOK_ID, 49, 48.85, 6.8, 5),
      unitType(MAGOK_ID, 59, 59.12, 7.6, 9, {
        lowEok: 7.3,
        highEok: 7.9,
        latestEok: 7.8,
        confidence: 'HIGH',
      }),
      unitType(MAGOK_ID, 84, 84.91, 8.3, 4, {
        lowEok: 8.0,
        highEok: 8.6,
        latestEok: 8.4,
        confidence: 'MEDIUM',
      }),
    ],
    minutes: {
      yeouido: 43,
      gwanghwamun: 52,
      gangnam: 58,
      jamsil: 62,
      pangyo: 71,
      cityhall: 50,
    },
    routes: {
      yeouido: [
        { type: 'WALK', durationMinutes: 7, from: '단지', to: '마곡나루' },
        {
          type: 'SUBWAY',
          durationMinutes: 28,
          lineName: '9호선',
          from: '마곡나루',
          to: '여의도',
        },
        { type: 'WALK', durationMinutes: 8, from: '여의도', to: '여의도' },
      ],
    },
    transactions: [
      sale(MAGOK_ID, 59, '2026-08-12', 7.8, 12, 59.12),
      sale(MAGOK_ID, 59, '2026-06-20', 7.9, 8, 59.12),
      sale(MAGOK_ID, 59, '2026-05-08', 7.7, 15, 59.12),
      sale(MAGOK_ID, 84, '2026-08-03', 8.4, 10, 84.91),
      sale(MAGOK_ID, 84, '2026-04-18', 8.2, 22, 84.91),
    ],
    research: [
      {
        id: 'research-magok-commercial',
        questId: 'mock',
        apartmentId: MAGOK_ID,
        category: 'COMMERCIAL',
        summary:
          '마곡 중앙로 일대는 오피스와 근린 상가가 붙어 평일 점심 수요가 있습니다. 주말 저녁 선택지는 한정적입니다. 이 문장은 예시이며 현재 상권을 조사한 결과가 아닙니다.',
        sources: [
          {
            title: '마곡 일대 상권 메모 (예시)',
            url: 'https://example.com/mock/magok-commerce',
            publisher: 'NestQuest mock',
          },
        ],
        researchedAt: '2026-09-10',
      },
      {
        id: 'research-magok-school',
        questId: 'mock',
        apartmentId: MAGOK_ID,
        category: 'SCHOOL_DISTRICT',
        summary:
          '단지 근처에 초·중학교가 있으나 배정과 선호는 해마다 달라질 수 있습니다. 통학 거리와 최근 배정은 직접 확인이 필요합니다. 예시 조사입니다.',
        sources: [
          {
            title: '마곡 학구 안내 (예시)',
            url: 'https://example.com/mock/magok-school',
            publisher: 'NestQuest mock',
          },
        ],
        researchedAt: '2026-09-08',
      },
    ],
    initialStage: 'DISCOVERED',
  }),
  complex({
    id: XI_ID,
    name: '영등포자이 디그니티',
    address: '서울특별시 영등포구 여의대로 108',
    sigunguCode: '11560',
    latitude: 37.5258,
    longitude: 126.9037,
    approvalDate: '2023-03-15',
    householdCount: 987,
    buildingCount: 5,
    parkingCount: 1086,
    heatingType: '개별난방',
    units: [
      unitType(XI_ID, 59, 59.98, 7.9, 7, {
        lowEok: 7.6,
        highEok: 8.1,
        latestEok: 7.8,
        confidence: 'HIGH',
      }),
    ],
    minutes: {
      yeouido: 18,
      gwanghwamun: 36,
      gangnam: 42,
      jamsil: 48,
      pangyo: 58,
      cityhall: 32,
    },
    routes: {
      yeouido: [
        { type: 'WALK', durationMinutes: 6, from: '단지', to: '여의나루' },
        {
          type: 'SUBWAY',
          durationMinutes: 6,
          lineName: '5호선',
          from: '여의나루',
          to: '여의도',
        },
        { type: 'WALK', durationMinutes: 6, from: '여의도', to: '여의도' },
      ],
    },
    transactions: [
      sale(XI_ID, 59, '2026-08-21', 7.8, 12, 59.98),
      sale(XI_ID, 59, '2026-06-14', 7.9, 8, 59.98),
      sale(XI_ID, 59, '2026-05-03', 7.7, 15, 59.98),
    ],
    initialStage: 'CANDIDATE',
  }),
  complex({
    id: SANGDO_ID,
    name: '상도효성해링턴플레이스',
    address: '서울특별시 동작구 상도로 346',
    sigunguCode: '11590',
    latitude: 37.5034,
    longitude: 126.9478,
    approvalDate: '2018-11-01',
    householdCount: 612,
    buildingCount: 7,
    parkingCount: 650,
    heatingType: '지역난방',
    units: [
      unitType(SANGDO_ID, 59, 59.43, 8.2, 6, {
        lowEok: 7.9,
        highEok: 8.4,
        latestEok: 8.3,
        confidence: 'MEDIUM',
      }),
      unitType(SANGDO_ID, 84, 84.72, 10.1, 3),
    ],
    minutes: {
      yeouido: 35,
      gwanghwamun: 44,
      gangnam: 38,
      jamsil: 46,
      pangyo: 55,
      cityhall: 41,
    },
    routes: {
      yeouido: [
        { type: 'WALK', durationMinutes: 8, from: '단지', to: '상도' },
        {
          type: 'SUBWAY',
          durationMinutes: 14,
          lineName: '7호선',
          from: '상도',
          to: '노량진',
        },
        {
          type: 'SUBWAY',
          durationMinutes: 7,
          lineName: '9호선',
          from: '노량진',
          to: '여의도',
        },
        { type: 'WALK', durationMinutes: 6, from: '여의도', to: '여의도' },
      ],
    },
    transactions: [
      sale(SANGDO_ID, 59, '2026-07-30', 8.3, 7, 59.43),
      sale(SANGDO_ID, 59, '2026-05-12', 8.1, 19, 59.43),
    ],
    initialStage: 'DISCOVERED',
  }),
  complex({
    id: 'apt-yeouido-thesharp',
    name: '여의도더샵아일랜드',
    address: '서울특별시 영등포구 국제금융로 10',
    sigunguCode: '11560',
    latitude: 37.5206,
    longitude: 126.9308,
    approvalDate: '2011-06-10',
    householdCount: 448,
    buildingCount: 3,
    parkingCount: 480,
    heatingType: '지역난방',
    units: [unitType('apt-yeouido-thesharp', 84, 84.88, 7.4, 8)],
    minutes: {
      yeouido: 12,
      gwanghwamun: 34,
      gangnam: 40,
      jamsil: 47,
      pangyo: 56,
      cityhall: 30,
    },
    initialStage: 'SHORTLIST',
  }),
  complex({
    id: 'apt-heukseok-centreville',
    name: '흑석한강센트레빌',
    address: '서울특별시 동작구 현충로 151',
    sigunguCode: '11590',
    latitude: 37.5082,
    longitude: 126.9614,
    approvalDate: '2016-04-22',
    householdCount: 720,
    buildingCount: 8,
    parkingCount: 756,
    heatingType: '개별난방',
    units: [unitType('apt-heukseok-centreville', 59, 59.67, 7.7, 5)],
    minutes: {
      yeouido: 32,
      gwanghwamun: 40,
      gangnam: 36,
      jamsil: 44,
      pangyo: 52,
      cityhall: 38,
    },
    initialStage: 'VISITED',
  }),
  complex({
    id: 'apt-dangsan-raemian',
    name: '당산래미안',
    address: '서울특별시 영등포구 당산로 214',
    sigunguCode: '11560',
    latitude: 37.5341,
    longitude: 126.9024,
    approvalDate: '2012-09-01',
    householdCount: 880,
    units: [unitType('apt-dangsan-raemian', 59, 59.21, 7.5, 11)],
    minutes: {
      yeouido: 25,
      gwanghwamun: 38,
      gangnam: 46,
      jamsil: 52,
      pangyo: 63,
      cityhall: 36,
    },
    initialStage: 'PASSED',
    passReason: 'NEIGHBORHOOD',
  }),
  complex({
    id: 'apt-gayang-ipark',
    name: '가양역센트럴아이파크',
    address: '서울특별시 강서구 양천로 431',
    sigunguCode: '11500',
    latitude: 37.5615,
    longitude: 126.8542,
    approvalDate: '2019-05-30',
    householdCount: 1520,
    units: [unitType('apt-gayang-ipark', 59, 59.55, 9.2, 4)],
    minutes: {
      yeouido: 40,
      gwanghwamun: 48,
      gangnam: 55,
      jamsil: 60,
      pangyo: 68,
      cityhall: 46,
    },
    initialStage: 'DISCOVERED',
  }),
  complex({
    id: 'apt-hanam-misa',
    name: '미사강변도시12단지',
    address: '경기도 하남시 미사강변대로 135',
    sigunguCode: '41450',
    latitude: 37.5572,
    longitude: 127.1924,
    approvalDate: '2018-02-14',
    householdCount: 1840,
    units: [unitType('apt-hanam-misa', 59, 59.33, 7.0, 10)],
    minutes: {
      yeouido: 78,
      gwanghwamun: 74,
      gangnam: 68,
      jamsil: 66,
      pangyo: 64,
      cityhall: 72,
    },
    initialStage: 'DISCOVERED',
  }),
  complex({
    id: 'apt-magok-sumyeong',
    name: '마곡수명산파크1단지',
    address: '서울특별시 강서구 수명로 50',
    sigunguCode: '11500',
    latitude: 37.5681,
    longitude: 126.8384,
    approvalDate: '2014-12-01',
    householdCount: 806,
    units: [unitType('apt-magok-sumyeong', 49, 48.92, 6.5, 8)],
    minutes: {
      yeouido: 45,
      gwanghwamun: 54,
      gangnam: 59,
      jamsil: 64,
      pangyo: 73,
      cityhall: 51,
    },
    initialStage: 'DISCOVERED',
  }),
  complex({
    id: 'apt-sangdo-hyundai',
    name: '상도현대아파트',
    address: '서울특별시 동작구 상도로 107',
    sigunguCode: '11590',
    latitude: 37.4994,
    longitude: 126.9332,
    approvalDate: '1999-05-20',
    householdCount: 180,
    units: [unitType('apt-sangdo-hyundai', 84, 84.15, 5.8, 12)],
    minutes: {
      yeouido: 38,
      gwanghwamun: 46,
      gangnam: 41,
      jamsil: 49,
      pangyo: 57,
      cityhall: 44,
    },
    initialStage: 'DISCOVERED',
  }),
]

