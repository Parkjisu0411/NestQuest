import { expect, it } from 'vitest'
import { transactionsForUnit } from './unitTransactions.ts'
import type { Transaction } from './models.ts'
it('shows legacy exact-area trades without mixing adjacent areas, apartments or cancellations',()=>{
  const unit={id:'unit',apartmentId:'a',areaGroup:85,exclusiveAreas:[84.908]}
  const sale:Transaction={id:'1',apartmentId:'a',exclusiveArea:84.908,floor:5,price:1000000000,contractDate:'2026-09-01',canceled:false}
  const rows=[sale,{...sale,id:'2',canceled:true},{...sale,id:'3',contractDate:'2026-09-02'},{...sale,id:'4',exclusiveArea:84.95},{...sale,id:'5',apartmentId:'b'}]
  expect(transactionsForUnit(rows,unit).map(t=>t.id)).toEqual(['3'])
  expect(transactionsForUnit(rows,undefined)).toEqual([])
})
