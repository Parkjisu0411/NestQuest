import type { ApartmentUnitType, Transaction } from './models.ts'

/** Older saved live catalogs lack unitTypeId; exact exclusive area is sufficient. */
export function transactionsForUnit(transactions: readonly Transaction[], unit?: ApartmentUnitType) {
  if (!unit) return []
  const identity=(t:Transaction)=>JSON.stringify([t.apartmentId,t.contractDate,t.exclusiveArea,t.floor,t.price])
  const canceled=new Set(transactions.filter(t=>t.canceled).map(identity))
  return transactions.filter(t=>t.apartmentId===unit.apartmentId && !t.canceled && !canceled.has(identity(t)) &&
    (t.unitTypeId===unit.id || (!t.unitTypeId && unit.exclusiveAreas.includes(t.exclusiveArea))))
    .sort((a,b)=>b.contractDate.localeCompare(a.contractDate))
}
