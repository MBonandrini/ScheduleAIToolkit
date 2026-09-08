"use strict";
(function(){
const key="projectControlsTheme";
const isShell=window.parent===window;
const allowed=["dark","light","navy"];
function saved(){try{const v=localStorage.getItem(key)||"dark";return allowed.includes(v)?v:"dark"}catch(_){return "dark"}}
function paint(theme){
 if(!isShell)return;
 document.querySelectorAll("[data-theme-select]").forEach(select=>{if(select.value!==theme)select.value=theme});
}
function apply(theme,notify){
 const x=allowed.includes(theme)?theme:"dark";
 document.documentElement.dataset.theme=x;
 document.documentElement.classList.toggle("dark-mode",x==="dark");
 paint(x);
 if(notify&&isShell){
   try{localStorage.setItem(key,x)}catch(_){}
   document.dispatchEvent(new CustomEvent("pc-theme-change",{detail:{theme:x}}));
 }
}
window.setProjectControlsTheme=function(theme){if(isShell)apply(theme,true)};
apply(saved(),false);
if(isShell){
 const bind=()=>document.querySelectorAll("[data-theme-select]").forEach(select=>{
   if(select.dataset.themeBound)return;select.dataset.themeBound="1";select.value=saved();
   select.addEventListener("change",()=>apply(select.value,true));
 });
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
}else{
 window.addEventListener("message",e=>{if(e.data&&e.data.type==="pc-theme")apply(e.data.theme,false)});
 const params=new URLSearchParams(location.search);
 if(params.get("sharedPane")==="1")document.documentElement.classList.add("shared-pane-mode");
}
window.addEventListener("message",async e=>{
 if(!e.data||e.data.type!=="pc-use-shared-file"||isShell)return;
 const item=e.data.file;
 if(!item||!item.blob)return;
 const file=new File([item.blob],item.name,{type:item.type||"",lastModified:item.lastModified||Date.now()});
 if(typeof window.handleFiles==="function"){await window.handleFiles([file]);return}
 if(typeof window.handleScheduleFiles==="function"){await window.handleScheduleFiles([file]);return}
 window.dispatchEvent(new CustomEvent("pc-shared-file",{detail:{file,record:item}}));
});
})();