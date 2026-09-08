
import {parseDate} from "../core/utils.js";
export function standardWorkingDays(calendar){
  const hpd=Math.max(.1,Number(calendar.hoursPerDay||8)),hpw=Math.max(hpd,Number(calendar.hoursPerWeek||40));
  const days=Math.max(1,Math.min(7,Math.round(hpw/hpd)));
  if(days===7)return new Set([0,1,2,3,4,5,6]);
  if(days===6)return new Set([1,2,3,4,5,6]);
  return new Set([1,2,3,4,5]);
}
export function parseCalendarExceptions(calendar){
  const raw=String(calendar?.raw?.clndr_data||calendar?.raw?.calendar_data||"");const set=new Set();
  const months={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
  const add=(y,m,d)=>{const x=new Date(y,m-1,d);if(x.getFullYear()===y&&x.getMonth()===m-1&&x.getDate()===d)set.add(`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`)};
  for(const m of raw.matchAll(/\b(\d{1,2})[- ](Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[- ](\d{2,4})\b/gi)){
    let y=Number(m[3]);if(y<100)y+=y>=70?1900:2000;add(y,months[m[2].toLowerCase()],Number(m[1]));
  }
  for(const m of raw.matchAll(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/g))add(Number(m[1]),Number(m[2]),Number(m[3]));
  return set;
}
export function calendarYear(calendar,year){
  const working=standardWorkingDays(calendar),exceptions=parseCalendarExceptions(calendar),months=[];
  for(let month=0;month<12;month++){
    const days=[],count=new Date(year,month+1,0).getDate();
    for(let day=1;day<=count;day++){
      const d=new Date(year,month,day),key=`${year}-${String(month+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      days.push({day,date:key,weekday:d.getDay(),working:working.has(d.getDay())&&!exceptions.has(key),exception:exceptions.has(key)});
    }
    months.push({month,days});
  }
  return {year,months};
}
export function projectYears(schedule){
  const dates=(schedule.activities||[]).flatMap(a=>[a.start,a.finish,a.currentStart,a.currentFinish,a.baselineStart,a.baselineFinish]).map(parseDate).filter(Boolean);
  if(!dates.length)return [new Date().getFullYear()];
  const min=Math.min(...dates.map(d=>d.getFullYear())),max=Math.max(...dates.map(d=>d.getFullYear())),out=[];
  for(let y=min;y<=max;y++)out.push(y);return out;
}
