import type {
  EvaluationPriorities,
  EvaluationRating,
  UserEvaluation,
} from './models.ts'
import { EVALUATION_METRIC_ORDER } from './models.ts'

export function calculateMyScore(input: {
  hasVisit: boolean
  evaluation: UserEvaluation | undefined
  priorities: EvaluationPriorities
}): number | undefined {
  if (!input.hasVisit || !input.evaluation) {
    return undefined
  }

  return calculateBaseScore(input.evaluation.ratings, input.priorities)
}

export function formatMyScore(score: number): string {
  return score.toFixed(1)
}

export function calculateBaseScore(
  ratings: UserEvaluation['ratings'],
  priorities: EvaluationPriorities,
): number | undefined {
  let weighted = 0
  let weight = 0

  for (const metric of EVALUATION_METRIC_ORDER) {
    const rating = ratings[metric]
    const priority = priorities[metric]
    if (!isEligibleMetric(rating, priority)) {
      continue
    }

    weighted += rating * priority
    weight += priority
  }

  if (weight === 0) {
    return undefined
  }

  return weighted / weight
}

function isEligibleMetric(
  rating: EvaluationRating,
  priority: number,
): rating is 1 | 2 | 3 | 4 | 5 {
  return rating !== null && priority > 0
}

