"use strict";
(function(){
const key="projectControlsTheme";
const isShell=window.parent===window;
const icons={light:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v2M12 19v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M3 12h2M19 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/><circle cx="12" cy="12" r="4"/></svg>',dark:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.2A8 8 0 0 1 8.8 4a8.1 8.1 0 1 0 11.2 11.2Z"/></svg>'};
function saved(){try{return localStorage.getItem(key)||"light"}catch(_){return "light"}}
function paint(theme){if(!isShell)return;document.querySelectorAll("[data-theme-toggle]").forEach(b=>{b.innerHTML=theme==="dark"?icons.light:icons.dark;b.title=theme==="dark"?"Switch to light mode":"Switch to dark mode";b.setAttribute("aria-label",b.title)})}
function apply(theme,notify){const x=theme==="dark"?"dark":"light";document.documentElement.dataset.theme=x;document.documentElement.classList.toggle("dark-mode",x==="dark");paint(x);if(notify&&isShell){try{localStorage.setItem(key,x)}catch(_){}document.dispatchEvent(new CustomEvent("pc-theme-change",{detail:{theme:x}}))}}
window.toggleTheme=function(){if(!isShell)return;apply(document.documentElement.dataset.theme==="dark"?"light":"dark",true)};
apply(saved(),false);
if(isShell){
 const bind=()=>document.querySelectorAll("[data-theme-toggle]").forEach(b=>{if(!b.dataset.themeBound){b.dataset.themeBound="1";b.addEventListener("click",window.toggleTheme)}});
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