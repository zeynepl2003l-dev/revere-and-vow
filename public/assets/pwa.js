/* RAV PWA installation controls; Chrome/Android and Safari fallback. */
(() => {
 'use strict';
 const button=document.getElementById('pwa-install');
 const help=document.getElementById('pwa-help');
 const helpText=document.getElementById('pwa-help-text');
 const close=document.getElementById('pwa-help-close');
 if(!button||!help||!close)return;
 let deferredPrompt=null;
 const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 const isIOS=()=>/iPhone|iPad|iPod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const isTR=()=>document.documentElement.lang!=='en';
 const refresh=()=>{button.hidden=standalone();button.title=isTR()?'RAV uygulamasını yükle':'Install RAV app';button.setAttribute('aria-label',button.title);};
 const instructions=()=>{
  const tr=isTR();
  document.getElementById('pwa-help-title').textContent=tr?'RAV Uygulamasını Yükle':'Install RAV Alliance';
  close.textContent=tr?'Anladım':'Got it';
  if(isIOS())helpText.textContent=tr?
   'Safari tarayıcısında Paylaş simgesine dokun, ardından Ana Ekrana Ekle seçeneğini seç.':
   'In Safari, tap Share, then Add to Home Screen.';
  else helpText.textContent=tr?
   'Chrome menüsünü (⋮) açıp Ana ekrana ekle veya Uygulamayı yükle seçeneğini seç.':
   'Open Chrome’s menu (⋮), then choose Add to Home screen or Install app.';
  if(!help.open)help.showModal();
 };
 window.addEventListener('beforeinstallprompt',event=>{
  event.preventDefault();deferredPrompt=event;refresh();
 });
 button.addEventListener('click',async()=>{
  if(standalone())return;
  if(!deferredPrompt){instructions();return}
  const prompt=deferredPrompt;deferredPrompt=null;
  button.disabled=true;
  try{await prompt.prompt();await prompt.userChoice;}
  catch{instructions();}
  finally{button.disabled=false;refresh();}
 });
 close.addEventListener('click',()=>help.close());
 window.addEventListener('appinstalled',()=>{deferredPrompt=null;refresh();});
 window.matchMedia('(display-mode: standalone)').addEventListener?.('change',refresh);
 new MutationObserver(refresh).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 refresh();
 if('serviceWorker' in navigator&&location.protocol==='https:'){
  window.addEventListener('load',()=>{
   navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(error=>console.warn('RAV offline support:',error));
  });
 }
})();
