import type { CommuteDestination } from '../domain/models.ts'

/** Curated Phase 1 destinations. Coordinates are mock, not surveyed. */
export const MOCK_COMMUTE_DESTINATIONS: CommuteDestination[] = [
  {
    id: 'yeouido',
    name: '여의도',
    address: '서울특별시 영등포구 여의대로',
    latitude: 37.5219,
    longitude: 126.9245,
  },
  {
    id: 'gwanghwamun',
    name: '광화문',
    address: '서울특별시 종로구 세종대로',
    latitude: 37.5716,
    longitude: 126.9766,
  },
  {
    id: 'gangnam',
    name: '강남역',
    address: '서울특별시 강남구 강남대로',
    latitude: 37.4979,
    longitude: 127.0276,
  },
  {
    id: 'jamsil',
    name: '잠실',
    address: '서울특별시 송파구 올림픽로',
    latitude: 37.5133,
    longitude: 127.1001,
  },
  {
    id: 'pangyo',
    name: '판교',
    address: '경기도 성남시 분당구 판교역로',
    latitude: 37.3948,
    longitude: 127.1112,
  },
  {
    id: 'cityhall',
    name: '서울시청',
    address: '서울특별시 중구 세종대로',
    latitude: 37.5663,
    longitude: 126.9779,
  },
]
