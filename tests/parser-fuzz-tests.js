const fs=require('fs'),vm=require('vm'),crypto=require('crypto'),path=require('path');
global.window=global;global.crypto=crypto.webcrypto;global.localStorage={getItem(){return null},setItem(){},removeItem(){}};global.sessionStorage={getItem(){return null},setItem(){},removeItem(){}};global.location={protocol:'http:',href:'http://localhost/'};
vm.runInThisContext(fs.readFileSync(path.join(__dirname,'../assets/js/core.js'),'utf8')+'\nglobalThis.ProjectControlsCore=ProjectControlsCore;');
function rnd(n){return Math.floor(Math.random()*n)}
function randomLine(){const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789\t %_-';let s='';for(let i=0;i<rnd(120);i++)s+=chars[rnd(chars.length)];return s}
let crashed=0,total=300;
for(let i=0;i<total;i++){
 let parts=[];
 if(i%3===0) parts.push('%T\tPROJECT','%F\tproj_id\tproj_short_name','%R\t1\tFuzz');
 if(i%2===0) parts.push('%T\tTASK','%F\ttask_id\tproj_id\ttask_code\ttask_name');
 const rows=5+rnd(30);
 for(let r=0;r<rows;r++) parts.push(randomLine());
 const txt=parts.join('\n');
 try{ProjectControlsCore.schedule.parse({name:`fuzz-${i}.xer`},txt)}catch(e){crashed++;console.error('CRASH',i,e&&e.stack||e);break}
}
console.log(crashed===0?`PASS parser fuzz ${total} malformed/random inputs without uncaught exception`:`FAIL parser fuzz crashes=${crashed}`);
if(crashed)process.exit(1);
