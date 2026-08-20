"use strict";
(function(){
const key="projectControlsTheme";
const icons={light:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v2M12 19v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M3 12h2M19 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/><circle cx="12" cy="12" r="4"/></svg>',dark:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15.2A8 8 0 0 1 8.8 4a8.1 8.1 0 1 0 11.2 11.2Z"/></svg>'};
function saved(){try{return localStorage.getItem(key)||"light"}catch(_){return "light"}}
function paintButtons(theme){document.querySelectorAll("[data-theme-toggle],#themeToggle").forEach(b=>{b.innerHTML=theme==="dark"?icons.light:icons.dark;b.title=theme==="dark"?"Switch to Stark White":"Switch to dark mode";b.setAttribute("aria-label",b.title)})}
function apply(theme,notify){const t=theme==="dark"?"dark":"light";document.documentElement.dataset.theme=t;document.documentElement.classList.toggle("dark-mode",t==="dark");paintButtons(t);if(notify){try{localStorage.setItem(key,t)}catch(_){};if(window.parent!==window)window.parent.postMessage({type:"pc-theme",theme:t},"*");document.dispatchEvent(new CustomEvent("pc-theme-change",{detail:{theme:t}}))}}
window.toggleTheme=function(){apply(document.documentElement.dataset.theme==="dark"?"light":"dark",true)};
apply(saved(),false);
function bind(){paintButtons(document.documentElement.dataset.theme||saved());document.querySelectorAll("[data-theme-toggle]").forEach(b=>{if(!b.dataset.themeBound){b.dataset.themeBound="1";b.addEventListener("click",window.toggleTheme)}})}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
window.addEventListener("message",e=>{if(e.data&&e.data.type==="pc-theme")apply(e.data.theme,false)});
})();
