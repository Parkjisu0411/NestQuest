// Public K-apt list supplement. Never logs or saves transient session/CSRF credentials.
import { mkdir,writeFile } from 'node:fs/promises'
const base='https://www.k-apt.go.kr'
try {
 const home=await fetch(base+'/web/main/index.do',{signal:AbortSignal.timeout(30000)})
 const html=await home.text()
 const cookies=home.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')
 const token=html.match(/name=["']_csrf["'][^>]*content=["']([^"']+)/)?.[1] ?? html.match(/var token\s*=\s*["']([^"']+)/)?.[1]
 if(!token)throw new Error('No public session')
 const date=new Date();date.setDate(1);date.setMonth(date.getMonth()-1)
 const searchDate=String(date.getFullYear())+String(date.getMonth()+1).padStart(2,'0')
 const result=await fetch(base+'/kaptinfo/getKaptList.do',{
  method:'POST',headers:{Cookie:cookies,'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest',Accept:'application/json',Referer:base+'/web/main/index.do'},
  body:new URLSearchParams({bjdCode:'41',searchDate,kaptDuty:'',_csrf:token}),signal:AbortSignal.timeout(30000),redirect:'error',
 })
 const raw=await result.text()
 if(/captcha|checkPageCount|chptcha_area/i.test(raw))throw new Error('Human verification required')
 const data=JSON.parse(raw)
 if(!Array.isArray(data.resultList)||!data.resultList.length)throw new Error('No public records')
 const fields=['kaptCode','kaptName','bjdCode','addr','x','y']
 const rows=data.resultList.map(r=>{
  if(typeof r.kaptCode!=='string'||typeof r.kaptName!=='string'||r.kaptName.includes('?')||!String(r.bjdCode).startsWith('41'))throw new Error('Invalid public data')
  return Object.fromEntries(fields.map(k=>[k,r[k]]))
 })
 await mkdir('local-data/collection',{recursive:true})
 await writeFile('local-data/collection/kapt-web-gyeonggi.json',JSON.stringify({fetchedAt:new Date().toISOString(),searchDate,source:base+'/web/main/index.do',rows}))
 console.log('경기도 공개 목록 저장 '+rows.length+'개 · 기준월 '+searchDate)
}catch{console.error('공개 목록 수집 실패. 이전 파일을 유지합니다.');process.exitCode=1}