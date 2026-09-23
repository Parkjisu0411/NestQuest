import {inflateRawSync} from 'node:zlib'
import {writeFile} from 'node:fs/promises'
const response=await fetch('https://www.code.go.kr/etc/codeFullDown.do',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({codeseId:'법정동코드'})})
if(!response.ok)throw new Error('Official code download failed')
const zip=Buffer.from(await response.arrayBuffer())
if(zip.length>10000000)throw new Error('Unexpected archive size')
const central=zip.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]))
if(central<0)throw new Error('Invalid code archive')
const size=zip.readUInt32LE(central+20),local=zip.readUInt32LE(central+42)
const start=local+30+zip.readUInt16LE(local+26)+zip.readUInt16LE(local+28)
const bytes=inflateRawSync(zip.subarray(start,start+size))
const text=new TextDecoder('euc-kr').decode(bytes)
const rows=text.split(/\r?\n/).slice(1).map(line=>{const [code,name,active]=line.split('\t');return {code:code?.trim(),name:name?.trim().replace(/\s+/g,' '),active:active?.trim()==='존재'}}).filter(r=>/^(11|28|41)\d{8}$/.test(r.code))
if(rows.length<1000)throw new Error('Incomplete code list')
const districts=rows.filter(r=>r.code.endsWith('00000')&&!r.code.endsWith('00000000'))
const suffix=r=>{
 const parts=r.name.split(' ')
 if(r.code.startsWith('41')) return [parts[0],parts[1],...parts.slice(parts[2]?.endsWith('구')?3:2)].join(' ')
 return [parts[0],...parts.slice(2)].join(' ')
}
const current=new Map()
for(const row of rows.filter(r=>r.active&&!r.code.endsWith('00000'))) {
 const key=suffix(row);const values=current.get(key)??[]; values.push(row);current.set(key,values)
}
const aliases=[]
for(const row of rows.filter(r=>!r.active&&!r.code.endsWith('00000'))) {
 const matches=current.get(suffix(row))??[]
 if(matches.length===1&&matches[0].code!==row.code) aliases.push([row.code,row.name,matches[0].code,matches[0].name])
}
await writeFile('src/data/metroCodeData.ts','// Official code.go.kr legal codes downloaded 2026-09-23. Includes retired codes for historical transactions.\nexport const districtData = '+JSON.stringify(districts.map(r=>[r.code.slice(0,5),r.name,r.active]))+' as const\nexport const legalAliases = '+JSON.stringify(aliases)+' as const\n')
console.log({districts:districts.length,aliases:aliases.length})
