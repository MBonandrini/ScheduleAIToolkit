import {isoDate,parseDate} from "../core/utils.js";

const d=(y,m,day)=>new Date(Date.UTC(y,m-1,day));
const add=(date,days)=>{const x=new Date(date);x.setUTCDate(x.getUTCDate()+days);return x};
const key=date=>isoDate(date);
function nthWeekday(year,month,weekday,n){
  const first=d(year,month,1),delta=(weekday-first.getUTCDay()+7)%7;return add(first,delta+(n-1)*7);
}
function lastWeekday(year,month,weekday){
  const last=new Date(Date.UTC(year,month,0)),delta=(last.getUTCDay()-weekday+7)%7;return add(last,-delta);
}
function observedMon(date){return date.getUTCDay()===0?add(date,1):date}
function observedNearestWeekday(date){const day=date.getUTCDay();return day===6?add(date,-1):day===0?add(date,1):date}
function observedNextWeekday(date,blocked=new Set()){
  let x=new Date(date);while(x.getUTCDay()===0||x.getUTCDay()===6||blocked.has(key(x)))x=add(x,1);return x;
}
export function easterSunday(year){
  const a=year%19,b=Math.floor(year/100),c=year%100,dd=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-dd-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=(h+l-7*m+114)%31+1;return d(year,month,day);
}
function holiday(date,name,source="Built-in national rule"){return {date:key(date),name,source}}
function ireland(year){
  const e=easterSunday(year),feb1=d(year,2,1),brigid=feb1.getUTCDay()===5?feb1:nthWeekday(year,2,1,1);
  return [holiday(d(year,1,1),"New Year's Day"),holiday(brigid,"St Brigid's Day"),holiday(d(year,3,17),"St Patrick's Day"),holiday(add(e,1),"Easter Monday"),holiday(nthWeekday(year,5,1,1),"May Day"),holiday(nthWeekday(year,6,1,1),"June Bank Holiday"),holiday(nthWeekday(year,8,1,1),"August Bank Holiday"),holiday(lastWeekday(year,10,1),"October Bank Holiday"),holiday(d(year,12,25),"Christmas Day"),holiday(d(year,12,26),"St Stephen's Day")];
}
function uk(year){
  const e=easterSunday(year),out=[];const ny=observedNearestWeekday(d(year,1,1));out.push(holiday(ny,"New Year's Day (observed)"));out.push(holiday(add(e,-2),"Good Friday"),holiday(add(e,1),"Easter Monday"),holiday(nthWeekday(year,5,1,1),"Early May bank holiday"),holiday(lastWeekday(year,5,1),"Spring bank holiday"),holiday(lastWeekday(year,8,1),"Summer bank holiday"));
  const used=new Set(),xmas=d(year,12,25),boxing=d(year,12,26),xo=observedNextWeekday(xmas,used);used.add(key(xo));const bo=observedNextWeekday(boxing,used);out.push(holiday(xo,"Christmas Day (observed)"),holiday(bo,"Boxing Day (observed)"));return out;
}
function southAfrica(year){
  const e=easterSunday(year),fixed=[[1,1,"New Year's Day"],[3,21,"Human Rights Day"],[4,27,"Freedom Day"],[5,1,"Workers' Day"],[6,16,"Youth Day"],[8,9,"National Women's Day"],[9,24,"Heritage Day"],[12,16,"Day of Reconciliation"],[12,25,"Christmas Day"],[12,26,"Day of Goodwill"]],out=[holiday(add(e,-2),"Good Friday"),holiday(add(e,1),"Family Day")];for(const [m,day,name] of fixed){const x=d(year,m,day);out.push(holiday(x,name));if(x.getUTCDay()===0)out.push(holiday(add(x,1),`${name} (observed)`))}return out;
}
function usa(year){
  const fixed=[[1,1,"New Year's Day"],[6,19,"Juneteenth"],[7,4,"Independence Day"],[11,11,"Veterans Day"],[12,25,"Christmas Day"]].map(([m,day,name])=>holiday(observedNearestWeekday(d(year,m,day)),`${name} (observed)`));return [...fixed,holiday(nthWeekday(year,1,1,3),"Martin Luther King Jr. Day"),holiday(nthWeekday(year,2,1,3),"Washington's Birthday"),holiday(lastWeekday(year,5,1),"Memorial Day"),holiday(nthWeekday(year,9,1,1),"Labor Day"),holiday(nthWeekday(year,10,1,2),"Columbus Day"),holiday(nthWeekday(year,11,4,4),"Thanksgiving Day")];
}
function genericEurope(year,country){
  const e=easterSunday(year),fixedByCountry={
    DE:[[1,1,"New Year's Day"],[5,1,"Labour Day"],[10,3,"German Unity Day"],[12,25,"Christmas Day"],[12,26,"Second Christmas Day"]],
    FR:[[1,1,"New Year's Day"],[5,1,"Labour Day"],[5,8,"Victory Day"],[7,14,"Bastille Day"],[8,15,"Assumption"],[11,1,"All Saints' Day"],[11,11,"Armistice Day"],[12,25,"Christmas Day"]],
    NL:[[1,1,"New Year's Day"],[4,27,"King's Day"],[5,5,"Liberation Day"],[12,25,"Christmas Day"],[12,26,"Boxing Day"]],
    BE:[[1,1,"New Year's Day"],[5,1,"Labour Day"],[7,21,"National Day"],[8,15,"Assumption"],[11,1,"All Saints' Day"],[11,11,"Armistice Day"],[12,25,"Christmas Day"]],
    ES:[[1,1,"New Year's Day"],[1,6,"Epiphany"],[5,1,"Labour Day"],[8,15,"Assumption"],[10,12,"National Day"],[11,1,"All Saints' Day"],[12,6,"Constitution Day"],[12,8,"Immaculate Conception"],[12,25,"Christmas Day"]],
    IT:[[1,1,"New Year's Day"],[1,6,"Epiphany"],[4,25,"Liberation Day"],[5,1,"Labour Day"],[6,2,"Republic Day"],[8,15,"Assumption"],[11,1,"All Saints' Day"],[12,8,"Immaculate Conception"],[12,25,"Christmas Day"],[12,26,"St Stephen's Day"]]
  };const out=(fixedByCountry[country]||[]).map(([m,day,name])=>holiday(d(year,m,day),name));out.push(holiday(add(e,1),"Easter Monday"));if(["DE","FR","BE","NL"].includes(country))out.push(holiday(add(e,39),"Ascension Day"));return out;
}
function commonwealth(year,country){
  const e=easterSunday(year),out=[holiday(observedNearestWeekday(d(year,1,1)),"New Year's Day (observed)"),holiday(add(e,-2),"Good Friday"),holiday(add(e,1),"Easter Monday"),holiday(observedNearestWeekday(d(year,12,25)),"Christmas Day (observed)"),holiday(observedNearestWeekday(d(year,12,26)),"Boxing Day (observed)")];if(country==="AU")out.push(holiday(observedNearestWeekday(d(year,1,26)),"Australia Day (observed)"),holiday(observedNearestWeekday(d(year,4,25)),"ANZAC Day"));if(country==="CA")out.push(holiday(observedNearestWeekday(d(year,7,1)),"Canada Day (observed)"),holiday(nthWeekday(year,9,1,1),"Labour Day"),holiday(nthWeekday(year,10,1,2),"Thanksgiving"));return out;
}
export const HOLIDAY_COUNTRIES=[
  ["NONE","No national public-holiday profile"],["IE","Ireland"],["GB","United Kingdom (England & Wales)"],["ZA","South Africa"],["US","United States (federal)"],["AU","Australia (national only)"],["CA","Canada (federal/common)"],["DE","Germany (national/common)"],["FR","France (national/common)"],["NL","Netherlands (national/common)"],["BE","Belgium (national/common)"],["ES","Spain (national/common)"],["IT","Italy (national/common)"]
];
export function publicHolidays(country,year){
  const code=String(country||"NONE").toUpperCase();let rows=[];if(code==="IE")rows=ireland(year);else if(code==="GB")rows=uk(year);else if(code==="ZA")rows=southAfrica(year);else if(code==="US")rows=usa(year);else if(["AU","CA"].includes(code))rows=commonwealth(year,code);else if(["DE","FR","NL","BE","ES","IT"].includes(code))rows=genericEurope(year,code);return [...new Map(rows.map(x=>[`${x.date}|${x.name}`,x])).values()].sort((a,b)=>a.date.localeCompare(b.date));
}
export function calendarHolidaySet({country="NONE",years=[],customDates=[]}={}){
  const out=new Map();for(const y of years)for(const h of publicHolidays(country,Number(y)))out.set(h.date,h);for(const raw of customDates||[]){const x=parseDate(raw);if(x)out.set(isoDate(x),{date:isoDate(x),name:"Custom project holiday",source:"Wizard custom date"})}return out;
}
export function isWorkingDate(value,{workingDays=[1,2,3,4,5],holidaySet=new Map()}={}){const x=parseDate(value);if(!x)return false;return workingDays.includes(x.getDay())&&!holidaySet.has(isoDate(x))}
export function addWorkingDays(start,days,options={}){let x=parseDate(start)||new Date(),left=Math.max(0,Math.round(Number(days)||0));if(left===0)return x;let guard=0;while(left>0&&guard++<10000){x=new Date(x);x.setDate(x.getDate()+1);if(isWorkingDate(x,options))left--}return x}
