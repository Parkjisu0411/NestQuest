import type { QuestStage } from '../../domain/models.ts'

export interface QuestMapApartment {
  id: string
  name: string
  latitude: number
  longitude: number
  stage: QuestStage
}
