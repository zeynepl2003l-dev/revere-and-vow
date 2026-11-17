import { SUPABASE_URL, SUPABASE_PUBLIC_KEY } from './config.js';

const $ = (q) => document.querySelector(q);
const root = $('#app-root');
let db=null,session=null,profile=null,section='home',lang='tr',activeChannels=[],activeTopic=null,activeThread=null;
const T=(tr,en)=>lang==='tr'?tr:en;
const formatDate=(v)=>{try{return new Date(v).toLocaleString(lang==='tr'?'tr-TR':'en-US',{dateStyle:'short',timeStyle:'short'})}catch{return String(v)}};
const toast=(text)=>{const t=$('#toast');t.textContent=text;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,5000)};
const err=(e)=>toast(e?.message||String(e));
const role=()=>profile?.site_role||'R1',manager=()=>profile?.approval_status==='approved'&&(profile?.is_site_admin===true||['R4','R5'].includes(role())),owner=()=>manager()&&(profile?.is_site_admin===true||role()==='R5');
const displayRole=()=>profile?.is_site_admin===true?'Site Admin':role();
const child=(tag,props={},...children)=>{const e=document.createElement(tag);for(const [k,v] of Object.entries(props||{})){if(v==null)continue;if(k==='class')e.className=v;else if(k==='text')e.textContent=v;else if(k==='value')e.value=v;else if(k==='checked')e.checked=!!v;else if(k.startsWith('on'))e.addEventListener(k.slice(2).toLowerCase(),v);else if(k==='disabled')e.disabled=!!v;else e.setAttribute(k,String(v));}for(const c of children.flat(Infinity)){if(c==null)continue;e.append(c instanceof Node?c:document.createTextNode(String(c)));}return e};
const div=(...kids)=>child('div',{},...kids),p=(text,cls)=>child('p',{class:cls||'',text}),h2=(text)=>child('h2',{text}),h3=(text)=>child('h3',{text}),small=(text)=>child('small',{text});
const btn=(text,fn,cls='mini-btn')=>child('button',{type:'button',class:cls,onclick:fn,text});
const input=(placeholder,type='text')=>child('input',{placeholder,type,autocomplete:'off'});
const textarea=(placeholder)=>child('textarea',{placeholder});
const option=(label,value)=>child('option',{value,text:label});
const select=(opts)=>child('select',{},...opts.map(([v,t])=>option(t,v)));
const labelField=(name,control)=>child('div',{class:'inputgroup'},child('label',{text:name}),control);
const card=(...kids)=>child('section',{class:'panel'},...kids);
const heading=(title,action)=>child('div',{class:'panel-heading'},h2(title),action||div());
const listLine=(main,right)=>child('div',{class:'listline'},child('div',{class:'flex-grow'},...main),child('div',{class:'actions'},...(right||[])));
const empty=(text)=>p(text,'empty');
const run=async(fn)=>{try{return await fn()}catch(e){err(e);return null}};
const assert=(data,error)=>{if(error)throw error;return data};
function clearSubscriptions(){if(db)activeChannels.forEach(ch=>db.removeChannel(ch));activeChannels=[]}
function sub(table,filter,callback){if(!db)return;const chan=db.channel('rav:'+table+':'+filter+':'+Math.random().toString(36).slice(2)).on('postgres_changes',{event:'INSERT',schema:'public',table,filter},callback).subscribe();activeChannels.push(chan)}
const statusBadge=()=>child('span',{class:'pill '+(profile?.approval_status==='approved'?'green':''),text:profile?.approval_status||'pending'});

const publicTranslations={
 tr:{aboutNav:'Hakkımızda',rulesNav:'Kurallar',featuresNav:'Topluluk',heroDesc:'Birlikte ayakta kalır, birlikte güçleniriz. RAV ittifakının resmî olmayan topluluk merkezi.',joinBtn:'İttifaka Katıl ↗',memberBtn:'Üye Portalı →',metric1:'Birlik ve dayanışma',metric2:'Eski kadro görüntüsü*',metric3:'Oyun rütbeleri',aboutTitle:'Büyük hedefler. Tek ittifak.',aboutBody:'Revere and Vow, Last Z: Survival Shooter dünyasında birlikte oynayan bir oyuncu topluluğudur. Bu platform duyuruları, etkinlikleri ve iletişimi tek yerde toplamak için geliştiriliyor.',card1:'Saygı',card1b:'İyi iletişim, karşılıklı destek ve adil topluluk.',card2:'Birlik',card2b:'Ortak hedefler için koordinasyon ve dayanışma.',card3:'Gelişim',card3b:'Rehberler, etkinlikler ve bilgi paylaşımı.',rulesTitle:'İttifak kuralları',rulesIntro:'Bunlar taslak ilkelerdir. Onaylı R4/R5 site yöneticileri bunları daha sonra güncelleyebilir.',ruleA:'Herkesle saygılı ve yapıcı iletişim kur.',ruleB:'İttifak içi özel bilgileri izinsiz paylaşma.',ruleC:'Etkinlik planlarını takip et ve topluluğa yardımcı ol.',communityTitle:'Topluluk merkezi',communityDesc:'Forum, gerçek zamanlı sohbet, birebir özel mesajlar, takvim, kadro ve yönetim araçları. Üye portalı hesap açan herkesin kullanımına açıktır.',fForum:'Forum',fForumB:'Konu aç, yorum yap ve stratejilerini paylaş.',fChat:'Canlı sohbet',fChatB:'İttifak odaları ve özel yönetim kanalı.',fDM:'Özel mesajlar',fDMB:'Kayıtlı üyeler arasında birebir görüşmeler.',snapshotNote:'99 üye sayısı daha önce gönderilen oyun ekranlarının anlık görüntüsüdür, canlı oyun verisi değildir. Bu site Last Z’nin resmî sitesi değildir.',footerNote:'Bağımsız hayran/ittifak sitesi • Oyun şirketiyle bağlantılı değildir'},
 en:{aboutNav:'About',rulesNav:'Rules',featuresNav:'Community',heroDesc:'Stronger together. An independent online home for the RAV alliance.',joinBtn:'Join Alliance ↗',memberBtn:'Member Portal →',metric1:'Unity and support',metric2:'Past roster snapshot*',metric3:'Game ranks',aboutTitle:'One alliance. Shared purpose.',aboutBody:'Revere and Vow is a community of Last Z: Survival Shooter players. The portal brings announcements, events and communication into one space.',card1:'Respect',card1b:'Kind communication, fairness and mutual support.',card2:'Unity',card2b:'Coordinate together toward shared goals.',card3:'Growth',card3b:'Guides, events and helpful community discussions.',rulesTitle:'Community guidelines',rulesIntro:'These are draft guidelines. Verified R4/R5 site managers can update them later.',ruleA:'Communicate respectfully and constructively.',ruleB:'Do not share private alliance information without consent.',ruleC:'Follow event plans and help your teammates.',communityTitle:'Command center',communityDesc:'Forum, real-time chat, direct messages, calendar, roster and management tools. Private spaces require approval.',fForum:'Forum',fForumB:'Start topics and share strategies.',fChat:'Live chat',fChatB:'Alliance chat and leadership room.',fDM:'Direct messages',fDMB:'Private conversations between registered members.',snapshotNote:'99 members are from a past screenshot, not live game data. This is an unofficial fan site.',footerNote:'Independent fan/alliance community • Not affiliated with the game publisher'}
};
function translatePublic(){document.documentElement.lang=lang;document.querySelectorAll('[data-t]').forEach(e=>{e.textContent=publicTranslations[lang][e.dataset.t]||e.textContent});$('#lang-toggle').textContent=lang==='tr'?'EN':'TR';$('#login-top').textContent=T('Üye Girişi','Member Login')}

async function invokeUsernameAuth(payload) {
 const {data,error}=await db.functions.invoke('username-auth',{body:payload});
 if(error){
  let message=T('Kayıt servisine bağlanılamadı.','Could not reach account service.');
  try {const detail=await error.context?.json?.();message=detail?.error||message}
  catch {message=error.message||message}
  throw new Error(message);
 }
 if(data?.error)throw new Error(data.error);
 return data;
}
function showRecoveryCode(code) {
 if(!code)return;
 const dlg=$('#auth-dialog'),content=$('#auth-content');content.replaceChildren(
  h2(T('Hesap kurtarma kodun','Your account recovery code')),
  p(T('Bu kodu güvenli bir yere kaydet. E-posta istemediğimiz için şifreni unutursan hesabını yalnızca bu kodla kurtarabilirsin. Kodu başka kimseyle paylaşma.','Save this code securely. Since we do not ask for email, this code is needed to recover your account if you forget your password. Never share it.')),
  child('pre',{class:'recovery-code',text:code}),
  btn(T('Kodu kopyala','Copy code'),async()=>{try{await navigator.clipboard.writeText(code);toast(T('Kod kopyalandı','Code copied'))}catch{toast(T('Kodu elle kopyalayıp kaydet.','Please copy the code manually.'))}},'gold'),
  btn(T('Kodu kaydettim','I have saved the code'),()=>dlg.close(),'subtlebtn')
 );
 if(!dlg.open)dlg.showModal();
}
function authDialog(mode='signin'){
 const dlg=$('#auth-dialog'),content=$('#auth-content');content.replaceChildren();
 if(!db){content.append(h2(T('Bağlantı kurulumu gerekli','Connection needed')),p(T('Site veritabanına bağlanılamadı.','Could not connect to the site database.')));if(!dlg.open)dlg.showModal();return}
 const title={
  signin:T('Üye girişi','Sign in'),signup:T('E-postasız hesap oluştur','Create account without email'),
  'admin-signup':T('Özel site yöneticisi hesabı','Private site administrator account'),
  recover:T('Kurtarma koduyla şifre yenile','Reset password with recovery code'),
  'forgot-email':T('Eski e-postalı hesap kurtarma','Existing email account recovery'),
  change:T('Yeni şifre belirle','Set new password'),
 };
 content.append(h2(title[mode]||title.signin),p(T(
  'Kayıt olmak için gerçek e-posta veya oyun hesabının şifresi istenmez.',
  'No real email or game account password is required to register.'
 )));
 const f=child('form');let login,pass,display,game,recovery,invite;
 if(mode!=='change'){
  login=input(mode==='signup'||mode==='admin-signup'?T('Kullanıcı adı (3–24 karakter)','Username (3–24 characters)'):
    mode==='forgot-email'?T('Eski hesap e-postası','Existing account email'):
    T('Kullanıcı adı','Username'),mode==='forgot-email'?'email':'text');
  login.required=true;login.maxLength=mode==='forgot-email'?254:80;
  login.autocomplete=mode==='signup'||mode==='admin-signup'?'username':mode==='signin'?'username':'off';
  f.append(labelField(mode==='forgot-email'?T('E-posta','Email'):
    mode==='signin'?T('Kullanıcı adı (eski hesaplar için e-posta)','Username (or email for old accounts)'):T('Kullanıcı adı','Username'),login));
 }
 if(mode==='signup'){
  display=input(T('Sitede görünen ad','Display name'));
  game=input(T('Oyun içi ad','Game name'));
  display.required=true;game.required=true;display.maxLength=48;game.maxLength=80;
  f.append(labelField(T('Görünen ad','Display name'),display),labelField(T('Oyun adı','Game name'),game));
 }
 if(mode==='admin-signup'){
  content.append(p(T('Bu hesap oyun rütbesi değildir ve normal üye listelerinde görünmez. Şifreni kendin belirle; davet kodu bir kez kullanılabilir. Genel sohbete yazılan mesajlar yine görünür.','This is a website-only administrator account, hidden from member lists. Choose your own password; the invite is single-use. Posts to general chat are still visible.'),'note-sm'));
  invite=input(T('Tek kullanımlık admin davet kodu','One-time administrator invite code'));invite.required=true;invite.autocomplete='off';invite.maxLength=120;
  f.append(labelField(T('Admin davet kodu','Admin invite code'),invite));
 }
 if(mode==='recover'){
  recovery=input(T('Kurtarma kodu','Recovery code'));recovery.required=true;recovery.autocomplete='off';
  f.append(labelField(T('Kurtarma kodu','Recovery code'),recovery));
 }
 if(mode!=='forgot-email'){
  pass=input(T(mode==='signin'?'Şifre':'Şifre (en az 12 karakter)',mode==='signin'?'Password':'Password (at least 12 characters)'),'password');
  pass.required=true;pass.minLength=mode==='signin'?1:12;pass.maxLength=128;
  pass.autocomplete=mode==='signin'?'current-password':'new-password';
  f.append(labelField(T('Şifre','Password'),pass));
 }
 f.append(btn(mode==='admin-signup'?T('Admin hesabımı oluştur','Create my admin account'):mode==='signup'?T('E-postasız kayıt ol','Sign up without email'):
   mode==='recover'?T('Kurtarma koduyla yenile','Recover account'):
   mode==='forgot-email'?T('Sıfırlama e-postası gönder','Send reset email'):
   mode==='change'?T('Şifreyi değiştir','Change password'):T('Giriş yap','Sign in'),()=>{},'gold'));
 const submit=f.lastElementChild;submit.type='submit';submit.onclick=null;
 f.addEventListener('submit',async e=>{
  e.preventDefault();submit.disabled=true;
  try {
   if(mode==='signin'){
    const identifier=login.value.trim();
    if(identifier.includes('@')){
     assert(null,(await db.auth.signInWithPassword({email:identifier,password:pass.value})).error);
    }else{
     const result=await invokeUsernameAuth({action:'login',username:identifier,password:pass.value});
     assert(null,(await db.auth.setSession({access_token:result.access_token,refresh_token:result.refresh_token})).error);
    }
   }
   if(mode==='signup'||mode==='admin-signup'){
    const administrator=mode==='admin-signup';
    const result=await invokeUsernameAuth(administrator?
      {action:'admin-register',username:login.value.trim(),password:pass.value,invite_code:invite.value.trim()}:
      {action:'register',username:login.value.trim(),password:pass.value,display_name:display.value.trim(),game_name:game.value.trim()});
    dlg.close();
    if(result.access_token&&result.refresh_token)assert(null,(await db.auth.setSession({access_token:result.access_token,refresh_token:result.refresh_token})).error);
    showRecoveryCode(result.recovery_code);
    return;
   }
   if(mode==='recover'){
    const result=await invokeUsernameAuth({action:'recover',username:login.value.trim(),
      recovery_code:recovery.value.trim(),new_password:pass.value});
    dlg.close();showRecoveryCode(result.recovery_code);
    toast(T('Şifre değiştirildi, yeni kurtarma kodunu kaydet.','Password reset. Save your new recovery code.'));return;
   }
   if(mode==='forgot-email')assert(null,(await db.auth.resetPasswordForEmail(login.value.trim(),{redirectTo:location.origin+location.pathname})).error);
   if(mode==='change')assert(null,(await db.auth.updateUser({password:pass.value})).error);
   dlg.close();
   toast(mode==='forgot-email'?T('E-posta mevcutsa sıfırlama bağlantısı gönderildi.','Reset link requested if the email exists.'):
     mode==='change'?T('Şifre güncellendi.','Password updated.'):T('Giriş başarılı.','Signed in.'));
  }catch(x){err(x)}finally{submit.disabled=false}
 });
 content.append(f);
 const actions=child('div',{class:'auth-extras'});
 if(mode==='signin')actions.append(
  btn(T('E-postasız hesap oluştur','Create account without email'),()=>authDialog('signup'),'subtlebtn'),
  btn(T('Şifremi unuttum','Forgot password'),()=>authDialog('recover'),'subtlebtn'));
 if(mode==='recover')actions.append(btn(T('Eski e-postalı hesabım var','I have an older email account'),()=>authDialog('forgot-email'),'subtlebtn'));
 if(mode!=='signin')actions.append(btn(T('Girişe dön','Back to sign in'),()=>authDialog('signin'),'subtlebtn'));
 content.append(actions);
 if(!dlg.open)dlg.showModal();
}
async function syncAuth(){
 if(!db)return;
 try{
  const r=await db.auth.getSession();assert(null,r.error);
  session=r.data.session;
  if(session?.user){const p=await db.from('profiles').select('*').eq('id',session.user.id).maybeSingle();assert(null,p.error);profile=p.data||null}
  else profile=null;
  await ensureRavAlertListener();
  if(alertsOptedIn()&&ravNativeToken)void registerRavNativeToken();
  render();
 }catch(e){err(e)}
}
function render(){clearSubscriptions();$('#public-screen').hidden=!!session;$('#app-screen').hidden=!session;$('#login-top').textContent=session?T('Hesaptan çık','Log out'):T('Üye Girişi','Member Login');if(!session)return;if(!profile||profile.approval_status!=='approved'){renderPending();return}renderPortal()}
function renderPending(){
 root.replaceChildren(card(h2(T('Hesap durumunuz','Your account status')),p(session.user.email),child('div',{class:'status-row'},statusBadge()),p(!profile?T('Profil henüz oluşturulamadı. Yöneticiyle iletişime geçin.','Profile not found; contact a site admin.'):profile.approval_status==='pending'?T('Hesabın hazırlanıyor. Sayfayı yenilemeyi deneyebilirsin.','Your account is being prepared. Please try refreshing.'):T('Bu hesap onaylanmadı veya erişimi kaldırıldı.','This account is not approved.')),child('div',{class:'actions'},btn(T('Durumu yenile','Refresh'),syncAuth),btn(T('Çıkış yap','Sign out'),logout))));
}
const navDefs=[['home','⌂',()=>T('Panel','Dashboard')],['roster','♟',()=>T('Üye Kadrosu','Roster')],['announcements','▤',()=>T('Duyurular','Announcements')],['alerts','🚨',()=>T('Acil Bildirim','Urgent Alerts')],['events','◷',()=>T('Etkinlikler','Events')],['forum','▣',()=>T('Forum','Forum')],['chat','⌁',()=>T('Canlı Sohbet','Live Chat')],['dm','✉',()=>T('Özel Mesajlar','Messages')],['profile','◉',()=>T('Profil','Profile')],['admin','⚙',()=>T('Yönetim','Admin')]];
const pages={home:showDashboard,roster:showRoster,announcements:showAnnouncements,alerts:showAlerts,events:showEvents,forum:showForum,chat:showChat,dm:showDM,profile:showProfile,admin:showAdmin};
function renderPortal(){const shell=child('div',{class:'app-shell'});const aside=child('aside',{class:'sidebar'});aside.append(h3('RAV / COMMAND'));for(const [key,icon,label] of navDefs){if(key==='admin'&&!manager())continue;aside.append(btn(icon+'  '+label(),()=>navigate(key),'side-link '+(section===key?'active':'')))}aside.append(child('div',{class:'home-exit'},btn(T('Çıkış','Log out'),logout,'subtlebtn')));shell.append(aside);const area=child('div',{id:'content-area'});shell.append(area);root.replaceChildren(shell);(pages[section]||pages.home)(area)}
function navigate(key){section=key;activeTopic=null;activeThread=null;renderPortal();window.scrollTo({top:0,behavior:'smooth'})}
async function logout(){await removeRavDevice();await stopRavAlertListener();await run(async()=>assert(null,(await db.auth.signOut()).error));session=null;profile=null;section='home';render()}
const content=(target,...nodes)=>{target.replaceChildren(...nodes)};
const loading=(target)=>content(target,card(empty(T('Yükleniyor…','Loading…'))));
function notice(text){return child('div',{class:'notice'},p(text))}
function metaLine(title,desc){return listLine([child('strong',{text:title}),small(desc)],[])}
async function getDisplayMap(){const r=await db.from('profiles').select('id,display_name,game_name,site_role').eq('approval_status','approved');assert(null,r.error);return Object.fromEntries((r.data||[]).map(p=>[p.id,p]))}
const nick=(id,mp)=>mp?.[id]?.game_name||mp?.[id]?.display_name||('Üye '+String(id||'').slice(0,6));
async function showDashboard(target){loading(target);try{
 const [ann,events,topics,rosterCount]=await Promise.all([db.from('announcements').select('id,title,created_at').order('created_at',{ascending:false}).limit(3),db.from('events').select('id,title,starts_at').gte('starts_at',new Date().toISOString()).order('starts_at').limit(3),db.from('forum_topics').select('id,title').order('created_at',{ascending:false}).limit(3),db.from('roster').select('source_index',{count:'exact',head:true})]);
 for(const r of [ann,events,topics,rosterCount])assert(null,r.error);
 const stats=child('div',{class:'grid-stats'},...[[T('Kadro','Roster'),rosterCount.count||0],[T('Yeni duyurular','Announcements'),ann.data.length],[T('Yaklaşan etkinlik','Upcoming events'),events.data.length]].map(([title,n])=>child('div',{class:'stat'},child('strong',{text:String(n)}),small(title))));
 const els=[child('div',{class:'banner'},p(T('RAV / ÜYE KOMUTA MERKEZİ','RAV / MEMBER COMMAND CENTER'),'section-title'),h2(T('Hoş geldin, ','Welcome, ')+(profile.display_name||'RAV')),p(T('Site yetkisi: ','Website role: ')+displayRole()+' • '+T('Bu portal gerçek veritabanıyla çalışır.','This portal uses a real database.'))),stats];
 for(const [label,arr,key,dateField] of [[T('Son duyurular','Recent announcements'),ann.data,'announcements','created_at'],[T('Yaklaşan etkinlikler','Upcoming events'),events.data,'events','starts_at'],[T('Forumdaki yeniler','Latest forum threads'),topics.data,'forum',null]]){const panel=card(heading(label,btn(T('Tümünü gör','View all'),()=>navigate(key))));for(const x of arr)panel.append(metaLine(x.title,dateField?formatDate(x[dateField]):''));if(!arr.length)panel.append(empty(T('Henüz içerik yok.','No content yet.')));els.push(panel)}content(target,...els)
}catch(e){content(target,notice(e.message))}}

async function showRoster(target){loading(target);try{
 const r=await db.from('roster').select('source_index,game_name,game_rank,level,power_million,needs_review').order('source_index',{ascending:true}).limit(150);assert(null,r.error);
 let data=r.data||[],filtered=data,sortKey='source_index',rev=false,page=0;const frame=card();const search=input(T('Oyuncu ara…','Search member…'));const ranks=select([['',T('Tüm rütbeler','All ranks')],...['R5','R4','R3','R2','R1'].map(x=>[x,x])]);const sorts=select([['source_index',T('Oyun listesi','Roster order')],['power_million',T('Güç','Power')],['level',T('Seviye','Level')]]);const orderBtn=btn('↓',()=>{rev=!rev;draw()});const bar=child('div',{class:'toolbar'},search,ranks,sorts,orderBtn);const output=div();const headingBox=heading(T('İttifak kadrosu','Alliance roster'),child('span',{class:'pill gray',text:String(data.length)+' kayıt'}));frame.append(headingBox,p(T('Veriler geçmiş ekran görüntülerinden alınmıştır. Oyun API’sine bağlı değildir.','Snapshot imported from screenshots; not live game data.'),'note-sm'),bar,output);search.addEventListener('input',()=>{page=0;draw()});ranks.addEventListener('change',()=>{page=0;draw()});sorts.addEventListener('change',()=>{sortKey=sorts.value;page=0;draw()});
 function draw(){filtered=data.filter(x=>x.game_name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase())&&(!ranks.value||x.game_rank===ranks.value));filtered=[...filtered].sort((a,b)=>{const av=a[sortKey],bv=b[sortKey];return (typeof av==='string'?av.localeCompare(bv):av-bv)*(rev?-1:1)});const table=child('table',{class:'roster-table'});table.append(child('thead',{},child('tr',{},...['Oyuncu','Rütbe','Seviye','Güç (M)','Kontrol'].map(x=>child('th',{text:x})))));const tbody=child('tbody');for(const x of filtered.slice(page*15,(page+1)*15)){const tr=child('tr');const name=child('td',{class:'truncate',text:x.game_name});if(manager())name.append(' ',btn('✎',()=>editRecord(x)));tr.append(name,child('td',{},child('span',{class:'pill',text:x.game_rank})),child('td',{text:String(x.level)}),child('td',{text:Number(x.power_million).toFixed(1)}),child('td',{text:x.needs_review?'⚑':'—'}));tbody.append(tr)}table.append(tbody);const footer=child('div',{class:'toolbar'},small(`${filtered.length} ${T('üye','members')} · ${page+1}/${Math.max(1,Math.ceil(filtered.length/15))}`),btn('←',()=>{page--;draw()},'mini-btn'),btn('→',()=>{page++;draw()},'mini-btn'));footer.children[1].disabled=page<=0;footer.children[2].disabled=(page+1)*15>=filtered.length;output.replaceChildren(child('div',{class:'tablewrap'},table),footer)}
 async function editRecord(x){if(!manager())return;const power=prompt(T('Güç (milyon):','Power (millions):'),String(x.power_million));if(power==null)return;const number=Number(power);if(!Number.isFinite(number)||number<0){toast(T('Geçersiz sayı','Invalid number'));return}await run(async()=>{assert(null,(await db.from('roster').update({power_million:number}).eq('source_index',x.source_index)).error);toast(T('Güncellendi','Updated'));showRoster(target)})}
 draw();content(target,frame)
}catch(e){content(target,notice(e.message))}}


/* RAV urgent alerts: the server authorizes R4/R5/Site Admin, never this UI. */
let ravNativeToken=null,ravTokenOwner=null,ravAlertChannel=null,ravAlertUserId=null;
const alertsOptedIn=()=>localStorage.getItem('rav_android_push_optin')==='yes';
async function registerRavNativeToken(){
 if(!db||!session?.user||!profile||profile.approval_status!=='approved'||!alertsOptedIn()||!ravNativeToken)return;
 if(ravTokenOwner===session.user.id)return;
 const {data,error}=await db.functions.invoke('rav-register-device',{body:{action:'register',token:ravNativeToken}});
 if(error||data?.error){console.warn('RAV device registration pending');return}
 ravTokenOwner=session.user.id;
 toast(T('🔔 Telefon bildirimleri kaydedildi','🔔 Phone notifications registered'));
}
window.ravReceivePushToken=(token)=>{
 if(typeof token!=='string'||token.length<80||token.length>400)return;
 ravNativeToken=token;ravTokenOwner=null;
 void registerRavNativeToken();
};
window.ravNotificationPermission=(ok,configured)=>{
 if(ok===true){toast(T('🔔 Bildirim izni açık; telefon kaydı hazırlanıyor.','🔔 Notifications allowed; registering your device.'))}
 else if(configured===false)toast(T('Bildirim sunucusu için Firebase yapılandırması eksik.','Firebase configuration is required for push notifications.'));
 else toast(T('Bildirim izni verilmedi.','Notification permission not granted.'));
};
async function stopRavAlertListener(){
 if(ravAlertChannel&&db)await db.removeChannel(ravAlertChannel);
 ravAlertChannel=null;ravAlertUserId=null;
}
async function ensureRavAlertListener(){
 if(!db||!session?.user||profile?.approval_status!=='approved'){await stopRavAlertListener();return}
 if(ravAlertChannel&&ravAlertUserId===session.user.id)return;
 await stopRavAlertListener();
 const userId=session.user.id;
 ravAlertUserId=userId;
 ravAlertChannel=db.channel('rav-urgent-'+userId)
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'rav_alerts'},payload=>{
   const a=payload.new||{};
   if(a.sender_id===userId)return;
   if(a.target_user_id!==null&&a.target_user_id!==userId)return;
   toast('🚨 RAV: '+String(a.message||'').slice(0,130));
   if(section==='alerts'&&$('#content-area'))void showAlerts($('#content-area'));
  }).subscribe();
}
async function removeRavDevice(){
 if(!db||!session?.user||!ravNativeToken)return;
 await db.functions.invoke('rav-register-device',{body:{action:'unregister',token:ravNativeToken}});
 ravTokenOwner=null;
}
function notificationOptInControl(){
 const text=p(T(
  '🚨 R4/R5 acil bildirimleri: Uygulama kapalıyken sesli bildirim almak için Android uygulamasında izin ver. Şimdilik Firebase sunucu kurulumu tamamlanınca aktif olacaktır.',
  '🚨 R4/R5 urgent alerts: Allow notifications in the Android app to get audible alerts when it is closed. Firebase server setup must also be completed.'
 ),'note-sm');
 const enable=btn('🔔 '+T('Telefon bildirimlerini aç','Enable phone notifications'),()=>{
  if(window.ravNativeAndroid!==true){
   toast(T('Telefon bildirimlerini açmak için RAV Android APK uygulamasını kullan.','Open the RAV Android APK to enable phone notifications.'));return;
  }
  localStorage.setItem('rav_android_push_optin','yes');
  window.location.href='ravapp://notifications/enable';
 },'gold');
 const disable=btn('🔕 '+T('Bildirimleri kapat','Disable notifications'),async()=>{
  await removeRavDevice();
  localStorage.removeItem('rav_android_push_optin');
  toast(T('RAV bildirimleri bu cihazda kapatıldı.','RAV alerts turned off on this device.'));
 },'subtlebtn');
 return child('div',{class:'rav-push-controls'},text,child('div',{class:'actions'},enable,disable));
}
async function sendRavUrgentAlert(message,target='all'){
 const recipient=target.startsWith('member:')?target.slice(7):null;
 const payload={audience:recipient?'member':'all',recipient_id:recipient,message};
 const {data,error}=await db.functions.invoke('rav-send-alert',{body:payload});
 if(error)throw error;
 if(data?.error)throw new Error(data.error);
 if(!data?.ok)throw new Error(T('Bildirim gönderilemedi','Unable to send alert'));
 if(!data.push_configured)toast(T(
  '🚨 Uyarı yayınlandı; telefon bildirimi için Firebase kurulumu gerekiyor.',
  '🚨 Alert posted. Firebase must be configured for phone delivery.'
 ));
 else toast(T('🚨 Uyarı kaydedildi. Telefona gönderilen: ','🚨 Alert posted. Sent to phones: ')+String(data.push_sent||0));
 return data;
}
async function showAlerts(target){
 loading(target);
 try{
  const [r,mp]=await Promise.all([
    db.from('rav_alerts').select('id,sender_id,target_user_id,message,created_at').order('created_at',{ascending:false}).limit(50),
    getDisplayMap()
  ]);
  assert(null,r.error);
  const box=card(heading(T('🚨 RAV Acil Bildirim Merkezi','🚨 RAV Urgent Alerts')),
   p(T('Önemli ittifak duyuruları. Sadece yetkili R4, R5 ve Site Admin gönderebilir.','Important alliance alerts. Only authorized R4, R5 and Site Admin can send.'),'note-sm'),
   notificationOptInControl());
  if(manager()){
   const memberOptions=Object.values(mp).filter(x=>x.id!==session.user.id)
    .sort((a,b)=>(a.game_name||'').localeCompare(b.game_name||''))
    .map(x=>['member:'+x.id,'@'+(x.game_name||x.display_name)]);
   const targetChoice=select([['all','📣 @all — '+T('Tüm üyeler','All members')],...memberOptions]);
   const body=textarea(T('Örn: Kalkan açın, saldırı geliyor!','Example: Activate shields, attack incoming!'));
   body.maxLength=240;
   const sendButton=btn('🚨 '+T('Acil bildirimi gönder','Send urgent alert'),async()=>{
    const msg=body.value.trim();if(msg.length<3)return toast(T('En az 3 karakter yaz.','Enter at least 3 characters.'));
    if(!confirm(T('Bu uyarı seçilen üyelere gönderilsin mi?','Send this alert to the selected members?')))return;
    sendButton.disabled=true;
    try{await sendRavUrgentAlert(msg,targetChoice.value);body.value='';await showAlerts(target)}
    catch(e){err(e)}finally{sendButton.disabled=false}
   },'gold');
   box.append(child('div',{class:'rav-alert-compose'},h3(T('R4/R5 Acil Çağrı','R4/R5 Emergency Call')),
    labelField(T('Kime','Recipients'),targetChoice),
    labelField(T('Uyarı mesajı','Alert text'),body),sendButton,
    p(T('Yetki kontrolü sunucuda yapılır. En fazla 45 saniyede bir ve saatte 8 uyarı gönderilebilir.','Server-side permission checks. Max one alert every 45 seconds and eight per hour.'),'note-sm')));
  }
  box.append(h3(T('Bildirim geçmişi','Alert history')));
  for(const x of r.data||[]){
   const author=nick(x.sender_id,mp);
   const who=x.target_user_id?'@'+nick(x.target_user_id,mp):'@all';
   box.append(child('div',{class:'rav-alert-item'},
    child('strong',{text:'🚨 '+who+' · '+author}),
    p(x.message),small(formatDate(x.created_at))));
  }
  if(!r.data?.length)box.append(empty(T('Henüz acil bildirim yok.','No urgent alerts yet.')));
  content(target,box);
 }catch(e){content(target,notice(e?.message||String(e)))}
}

async function showAnnouncements(target){loading(target);try{const r=await db.from('announcements').select('*').order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(50);assert(null,r.error);const panel=card(heading(T('Duyurular','Announcements')));if(manager()){const title=input(T('Duyuru başlığı','Announcement title'));const body=textarea(T('Duyuru içeriği','Content'));panel.append(child('div',{class:'new-post'},h3(T('Duyuru yayınla','Post announcement')),labelField(T('Başlık','Title'),title),labelField(T('Metin','Body'),body),btn(T('Yayınla','Publish'),async()=>{await run(async()=>{assert(null,(await db.from('announcements').insert({title:title.value,body:body.value,author_id:session.user.id})).error);showAnnouncements(target)})},'gold')))}
 for(const x of r.data)panel.append(listLine([child('strong',{text:x.title}),p(x.body),small(formatDate(x.created_at))],manager()?[btn(T('Sil','Delete'),async()=>{if(!confirm(T('Duyuru silinsin mi?','Delete announcement?')))return;await run(async()=>{assert(null,(await db.from('announcements').delete().eq('id',x.id)).error);showAnnouncements(target)})},'btn-danger')]:[]));if(!r.data.length)panel.append(empty(T('Henüz duyuru yok.','No announcements yet.')));content(target,panel)}catch(e){content(target,notice(e.message))}}

async function showEvents(target){loading(target);try{const r=await db.from('events').select('*').order('starts_at',{ascending:true}).limit(70);assert(null,r.error);const rsvp=await db.from('event_rsvps').select('event_id,choice').eq('user_id',session.user.id);assert(null,rsvp.error);const current=Object.fromEntries(rsvp.data.map(x=>[x.event_id,x.choice]));const panel=card(heading(T('Etkinlik takvimi','Event calendar')));
 if(manager()){const title=input(T('Etkinlik adı','Event title')),description=textarea(T('Açıklama','Description')),when=input('','datetime-local');const form=child('div',{class:'new-post'},h3(T('Etkinlik oluştur','Create event')),labelField(T('Başlık','Title'),title),labelField(T('Açıklama','Description'),description),labelField(T('Tarih ve saat','Date/time'),when),btn(T('Kaydet','Save'),async()=>{await run(async()=>{if(!when.value)throw new Error(T('Tarih seç','Select a date'));assert(null,(await db.from('events').insert({title:title.value,description:description.value,starts_at:new Date(when.value).toISOString(),author_id:session.user.id})).error);showEvents(target)})},'gold'));panel.append(form)}
 for(const x of r.data){const status=select([['',T('Katılım durumum','My attendance')],['going',T('Katılacağım','Going')],['maybe',T('Belki','Maybe')],['not_going',T('Katılamam','Not going')]]);status.value=current[x.id]||'';status.addEventListener('change',async()=>{if(!status.value)return;await run(async()=>{assert(null,(await db.from('event_rsvps').upsert({event_id:x.id,user_id:session.user.id,choice:status.value},{onConflict:'event_id,user_id'})).error);toast(T('Kaydedildi','Saved'))})});panel.append(listLine([child('strong',{text:x.title}),p(x.description),small(formatDate(x.starts_at))],[status,...(manager()?[btn(T('Sil','Delete'),async()=>{if(!confirm(T('Etkinlik silinsin mi?','Delete event?')))return;await run(async()=>{assert(null,(await db.from('events').delete().eq('id',x.id)).error);showEvents(target)})},'btn-danger')]:[])]))}if(!r.data.length)panel.append(empty(T('Henüz etkinlik yok.','No scheduled events.')));content(target,panel)}catch(e){content(target,notice(e.message))}}

async function showForum(target){loading(target);try{if(activeTopic)return showTopic(target,activeTopic);const r=await db.from('forum_topics').select('*').order('pinned',{ascending:false}).order('created_at',{ascending:false}).limit(80);assert(null,r.error);const panel=card(heading(T('İttifak Forumu','Alliance forum')));const category=select(['Genel','Etkinlikler','Strateji','Rehberler','Öneriler'].map(x=>[x,x]));const title=input(T('Başlık','Title')),body=textarea(T('Paylaşmak istediğin konu…','Start a discussion…'));panel.append(child('div',{class:'new-post'},h3(T('Yeni konu','New topic')),labelField(T('Kategori','Category'),category),labelField(T('Başlık','Title'),title),labelField(T('İçerik','Content'),body),btn(T('Konu oluştur','Post topic'),async()=>{await run(async()=>{assert(null,(await db.from('forum_topics').insert({category:category.value,title:title.value,body:body.value,author_id:session.user.id})).error);showForum(target)})},'gold')));
 const search=input(T('Konularda ara…','Search topics…'));const list=div();panel.append(child('div',{class:'toolbar'},search),list);function draw(){const matches=r.data.filter(x=>x.title.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()));list.replaceChildren();for(const x of matches){list.append(listLine([btn((x.pinned?'◆ ':'')+x.title,()=>{activeTopic=x.id;showTopic(target,x.id)},'linklike'),small(x.category+' • '+formatDate(x.created_at)+(x.locked?' • '+T('Kilitli','Locked'):''))],[]))}if(!matches.length)list.append(empty(T('Henüz konu yok.','No topics found.')))}search.addEventListener('input',draw);draw();content(target,panel)}catch(e){content(target,notice(e.message))}}
async function showTopic(target,id){loading(target);try{const [t,rep,mp]=await Promise.all([db.from('forum_topics').select('*').eq('id',id).single(),db.from('forum_replies').select('*').eq('topic_id',id).order('created_at').limit(100),getDisplayMap()]);assert(null,t.error);assert(null,rep.error);const x=t.data;const panel=card(btn('← '+T('Tüm konular','All topics'),()=>{activeTopic=null;showForum(target)},'back'),h2(x.title),small(`${x.category} • ${nick(x.author_id,mp)} • ${formatDate(x.created_at)}`),p(x.body,'post-body'));if(manager()){panel.append(child('div',{class:'toolbar'},btn(x.pinned?T('Sabitlemeyi kaldır','Unpin'):T('Sabitle','Pin'),()=>setFlags(!x.pinned,x.locked)),btn(x.locked?T('Kilidi aç','Unlock'):T('Kilitle','Lock'),()=>setFlags(x.pinned,!x.locked))))}
 async function setFlags(pinned,locked){await run(async()=>{assert(null,(await db.rpc('set_topic_flags',{topic:id,p_pinned:pinned,p_locked:locked})).error);showTopic(target,id)})}
 panel.append(child('div',{class:'spacer'}),h3(T('Yanıtlar','Replies')));for(const r of rep.data)panel.append(listLine([small(nick(r.author_id,mp)+' • '+formatDate(r.created_at)),p(r.body,'post-body')],manager()||r.author_id===session.user.id?[btn(T('Sil','Delete'),async()=>{if(!confirm(T('Yanıt silinsin mi?','Delete reply?')))return;await run(async()=>{assert(null,(await db.from('forum_replies').delete().eq('id',r.id)).error);showTopic(target,id)})},'btn-danger')]:[]));if(!x.locked){const reply=textarea(T('Yanıt yaz…','Write a reply…'));panel.append(labelField(T('Yanıtın','Your reply'),reply),btn(T('Gönder','Post'),async()=>{await run(async()=>{assert(null,(await db.from('forum_replies').insert({topic_id:id,body:reply.value,author_id:session.user.id})).error);showTopic(target,id)})},'gold'))}else panel.append(notice(T('Bu konu kilitli.','This topic is locked.')));content(target,panel)}catch(e){content(target,notice(e.message))}}


/* On-demand community translation; only the general chat has this button. */
const translationLanguages=[['tr','Türkçe'],['en','English'],['de','Deutsch'],['fr','Français'],['es','Español'],['ar','العربية'],['ru','Русский'],['it','Italiano'],['pt','Português'],['pl','Polski'],['nl','Nederlands'],['uk','Українська']];
const translationLanguageCodes=new Set(translationLanguages.map(x=>x[0]));
const translationCache=new Map();
function preferredTranslationLanguage(){
 const code=session?.user?.user_metadata?.preferred_language;
 return translationLanguageCodes.has(code)?code:'tr';
}
function guessChatLanguage(text,target){
 if(/[а-яА-ЯёЁіїєґІЇЄҐ]/u.test(text))return 'ru';
 if(/[\u0600-\u06ff]/u.test(text))return 'ar';
 if(/[çğıöşüÇĞİÖŞÜ]/u.test(text)||/\b(merhaba|selam|nasılsın|arkadaşlar|saldırı|ittifak|gönder|teşekkür|yarın|bugün)\b/i.test(text))return 'tr';
 return target==='en'?'tr':'en';
}
function splitRavTranslation(text){
 const words=text.trim().split(/\s+/u),parts=[];let current='';
 const enc=new TextEncoder();
 for(const word of words){
  if(enc.encode(word).length>490)throw new Error(T('Çok uzun bir kelime çevrilemiyor.','A word is too long to translate.'));
  const candidate=current?current+' '+word:word;
  if(enc.encode(candidate).length>490){if(current)parts.push(current);current=word}else current=candidate;
 }
 if(current)parts.push(current);
 if(parts.length>5)throw new Error(T('Mesaj çevrilemeyecek kadar uzun.','Message is too long to translate.'));
 return parts;
}
async function translateRavText(text,source,target){
 if(source===target)return text;
 if(!translationLanguageCodes.has(source)||!translationLanguageCodes.has(target))throw new Error('Unsupported language');
 const chunks=splitRavTranslation(text),out=[];
 for(const chunk of chunks){
  const url=new URL('https://api.mymemory.translated.net/get');
  url.searchParams.set('q',chunk);
  url.searchParams.set('langpair',source+'|'+target);
  const res=await fetch(url.href,{cache:'no-store'});
  const data=await res.json();
  if(!res.ok||Number(data?.responseStatus)!==200||typeof data?.responseData?.translatedText!=='string')throw new Error(T('Çeviri servisi şu anda yanıt vermiyor veya günlük sınırına ulaştı.','Translation provider unavailable or daily quota exceeded.'));
  out.push(data.responseData.translatedText);
 }
 return out.join(' ');
}
function makeChatTranslate(msg){
 const target=preferredTranslationLanguage();let source=guessChatLanguage(msg.body,target),shown=false;
 const result=child('div',{class:'chat-translation'});
 const toggle=btn('🌐 '+T('Çevir','Translate'),async()=>{
  if(shown){shown=false;result.replaceChildren();toggle.textContent='🌐 '+T('Çevir','Translate');return}
  const key=String(msg.id)+':'+source+':'+target;
  toggle.disabled=true;toggle.textContent=T('Çevriliyor…','Translating…');
  try{
   if(!translationCache.has(key)){
    const translated=await translateRavText(msg.body,source,target);
    if(translationCache.size>160)translationCache.clear();
    translationCache.set(key,translated);
   }
   const sourceSelector=select(translationLanguages);
   sourceSelector.value=source;
   const translatedParagraph=p(translationCache.get(key),'chat-translated-text');
   const meta=p(T('Hedef dil: ','Target language: ')+(translationLanguages.find(x=>x[0]===target)?.[1]||target),'note-sm');
   const privacy=p(T('Genel sohbet metni Çevir düğmesine basılınca MyMemory adlı harici çeviri servisine gönderilir.','General chat text is sent to an external MyMemory translation provider only on request.'),'note-sm');
   result.replaceChildren(translatedParagraph,labelField(T('Kaynak dil (gerekirse değiştir)','Source language (change if needed)'),sourceSelector),meta,privacy);
   sourceSelector.addEventListener('change',()=>{source=sourceSelector.value;shown=false;result.replaceChildren();toggle.textContent='🌐 '+T('Çevir','Translate');toggle.click()});
   shown=true;toggle.textContent=T('Çeviriyi gizle','Hide translation');
  }catch(e){shown=false;result.replaceChildren(p(e?.message||String(e),'note-sm'));toggle.textContent='🌐 '+T('Tekrar dene','Try again')}
  finally{toggle.disabled=false}
 },'subtlebtn');
 return child('div',{class:'chat-translate-wrap'},toggle,result);
}

async function showChat(target,room='general'){clearSubscriptions();loading(target);try{if(room==='leadership'&&!manager())throw new Error('Not authorized');const [r,mp]=await Promise.all([db.from('room_messages').select('*').eq('room_id',room).order('created_at',{ascending:false}).limit(60),getDisplayMap()]);assert(null,r.error);const panel=card(heading(T('Canlı ittifak sohbeti','Alliance live chat')));const tabbar=child('div',{class:'tabs'},btn('# '+T('Genel','General'),()=>showChat(target,'general'),'mini-btn '+(room==='general'?'active':'')),...(manager()?[btn('# '+T('Yönetim','Leadership'),()=>showChat(target,'leadership'),'mini-btn '+(room==='leadership'?'active':''))]:[]));const feed=child('div',{class:'message-feed',role:'log','aria-label':T('Sohbet mesajları','Chat messages')});const draft=input(T('Mesaj yaz…','Write message…'));draft.maxLength=1200;const recipientChoice=manager()&&room==='general'?select([['normal',T('Normal mesaj','Normal message')],['all','🚨 @all — '+T('Acil bildirim','Urgent alert')],...Object.values(mp).filter(x=>x.id!==session.user.id).map(x=>['member:'+x.id,'🚨 @'+(x.game_name||x.display_name)])]):null;
 const send=btn(T('Gönder','Send'),async()=>{
   const raw=draft.value.trim();if(!raw)return;
   send.disabled=true;
   try{
    const inlineAll=room==='general'&&manager()&&/^@all(?:\s|$)/i.test(raw);
    if(room==='general'&&manager()&&(inlineAll||(recipientChoice&&recipientChoice.value!=='normal'))){
      const text=inlineAll?raw.replace(/^@all\s*/i,'').trim():raw;
      if(text.length<3)throw new Error(T('Uyarı metni çok kısa.','Alert is too short.'));
      await sendRavUrgentAlert(text,inlineAll?'all':recipientChoice.value);
      draft.value='';if(recipientChoice)recipientChoice.value='normal';await refresh();
    }else{
      assert(null,(await db.from('room_messages').insert({room_id:room,author_id:session.user.id,body:raw})).error);
      draft.value='';await refresh();
    }
   }catch(e){err(e)}finally{send.disabled=false}
 },'gold');draft.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();send.click()}});panel.append(tabbar,feed);if(recipientChoice)panel.append(labelField(T('Bildirim / etiket','Notification / mention'),recipientChoice));panel.append(child('div',{class:'message-send'},draft,send),p(room==='general'?T('🌐 Çeviri isteğe bağlıdır. Çevirdiğin genel sohbet metni MyMemory adlı dış servise iletilir. Dilini Profil kısmında seçebilirsin.','🌐 Translation is optional. General chat text you translate goes to the external MyMemory service. Choose your language in Profile.'):T('R4/R5 yönetim kanalındaki mesajlar dış çeviri servisine gönderilmez.','Leadership messages are not sent to a translation provider.'),'note-sm'));content(target,panel);
 async function refresh(){const next=await db.from('room_messages').select('*').eq('room_id',room).order('created_at',{ascending:false}).limit(60);assert(null,next.error);feed.replaceChildren();for(const x of next.data.reverse()){const item=child('div',{class:'bubble '+(x.author_id===session.user.id?'mine':'')},small(nick(x.author_id,mp)+' · '+formatDate(x.created_at)),p(x.body));if(room==='general')item.append(makeChatTranslate(x));if(manager())item.append(btn('× '+T('Sil','Delete'),async()=>{if(!confirm(T('Mesaj silinsin mi?','Delete message?')))return;await run(async()=>{assert(null,(await db.from('room_messages').delete().eq('id',x.id)).error);refresh()})},'subtlebtn'));feed.append(item)}feed.scrollTop=feed.scrollHeight}
 await refresh();sub('room_messages',`room_id=eq.${room}`,()=>refresh().catch(err));
}catch(e){content(target,notice(e.message))}}

async function showDM(target){clearSubscriptions();loading(target);try{const [profiles,threads]=await Promise.all([db.from('profiles').select('id,game_name,display_name').eq('approval_status','approved').eq('is_site_admin',false).order('game_name'),db.from('dm_threads').select('*').order('created_at',{ascending:false}).limit(100)]);assert(null,profiles.error);assert(null,threads.error);const myPeers=(profiles.data||[]).filter(x=>x.id!==session.user.id);const map=Object.fromEntries(profiles.data.map(x=>[x.id,x]));const panel=card(heading(T('Özel mesajlar','Direct messages')));panel.append(p(T('Bu mesajları yalnızca konuşmanın katılımcıları okuyabilir. Uçtan uca şifreli değildir.','Only participants can read these messages. This is not end-to-end encrypted.'),'note-sm'));const to=select([['',T('Üye seç','Choose a member')],...myPeers.map(x=>[x.id,x.game_name])]);panel.append(child('div',{class:'toolbar'},to,btn(T('Sohbet başlat','Start chat'),async()=>{if(!to.value)return;await run(async()=>{const r=await db.rpc('start_dm',{target:to.value});assert(null,r.error);activeThread=r.data;await showThread(target,r.data,map)})})));if(activeThread)return showThread(target,activeThread,map);
 const threadsList=child('div');for(const x of threads.data){const peer=x.user_a===session.user.id?x.user_b:x.user_a;threadsList.append(listLine([child('strong',{text:map[peer]?.game_name||T('Üye','Member')}),small(formatDate(x.created_at))],[btn(T('Aç','Open'),()=>{activeThread=x.id;showThread(target,x.id,map)})]))}if(!threads.data.length)threadsList.append(empty(T('Henüz özel konuşman yok.','No direct messages yet.')));panel.append(h3(T('Konuşmalarım','My conversations')),threadsList);content(target,panel)
}catch(e){content(target,notice(e.message))}}
async function showThread(target,threadId,map){clearSubscriptions();loading(target);try{const r=await db.from('dm_threads').select('*').eq('id',threadId).single();assert(null,r.error);const other=r.data.user_a===session.user.id?r.data.user_b:r.data.user_a;const header=card(btn('← '+T('Konuşmalar','Conversations'),()=>{activeThread=null;showDM(target)},'back'),h2(map[other]?.game_name||T('Özel konuşma','Private chat')));const feed=child('div',{class:'message-feed',role:'log'});const draft=input(T('Özel mesaj yaz…','Write direct message…'));draft.maxLength=1200;const send=btn(T('Gönder','Send'),async()=>{if(!draft.value.trim())return;send.disabled=true;try{assert(null,(await db.from('dm_messages').insert({thread_id:threadId,author_id:session.user.id,body:draft.value.trim()})).error);draft.value='';await refresh()}catch(e){err(e)}finally{send.disabled=false}},'gold');draft.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();send.click()}});
 header.append(feed,child('div',{class:'message-send'},draft,send));const extras=child('div',{class:'toolbar'},btn(T('Kullanıcıyı engelle','Block user'),async()=>{if(!confirm(T('Bu kullanıcıdan özel mesaj almayı durdurmak istiyor musun?','Block direct messaging with this user?')))return;await run(async()=>{assert(null,(await db.from('user_blocks').insert({blocker_id:session.user.id,blocked_id:other})).error);toast(T('Engellendi','Blocked'))})}));header.append(extras);content(target,header);
 async function refresh(){const res=await db.from('dm_messages').select('*').eq('thread_id',threadId).order('created_at',{ascending:false}).limit(80);assert(null,res.error);feed.replaceChildren();for(const x of res.data.reverse()){const mine=x.author_id===session.user.id;const b=child('div',{class:'bubble '+(mine?'mine':'')},small((mine?T('Sen','You'):(map[other]?.game_name||T('Üye','Member')))+' · '+formatDate(x.created_at)),p(x.body));if(!mine)b.append(btn(T('Mesajı bildir','Report message'),async()=>{const reason=prompt(T('Şikâyet nedeni (en az 4 karakter)','Reason (at least 4 characters)'));if(!reason)return;await run(async()=>{assert(null,(await db.rpc('report_dm_message',{p_message_id:x.id,p_reason:reason})).error);toast(T('İlgili mesaj yönetime bildirildi.','Selected message reported to moderators.'))})},'subtlebtn'));else b.append(btn(T('Sil','Delete'),async()=>{await run(async()=>{assert(null,(await db.from('dm_messages').delete().eq('id',x.id)).error);refresh()})},'subtlebtn'));feed.append(b)}feed.scrollTop=feed.scrollHeight}
 await refresh();sub('dm_messages',`thread_id=eq.${threadId}`,()=>refresh().catch(err));
}catch(e){content(target,notice(e.message))}}

async function showProfile(target){
 const display=input('Display name'),game=input('Game name');
 display.value=profile.display_name;game.value=profile.game_name;display.maxLength=48;game.maxLength=80;
 const preferred=select(translationLanguages);preferred.value=preferredTranslationLanguage();
 const panel=card(heading(T('Profilim','My profile')),
  p(session.user.email?.endsWith('@accounts.example')?T('Kullanıcı adı: ','Username: ')+(session.user.user_metadata?.login_username||'—'):T('E-posta: ','Email: ')+session.user.email),
  p(T('Site rütbesi: ','Site rank: ')+displayRole()),p(T('Durum: ','Status: ')+profile.approval_status),
  labelField(T('Görünen ad','Display name'),display),
  labelField(T('Oyun içi ad','Game name'),game),
  labelField(T('Tercih ettiğim çeviri dili','My preferred translation language'),preferred),
  p(T('Genel sohbet mesajları 🌐 Çevir düğmesiyle bu dile çevrilir.','Use 🌐 Translate in General Chat to translate into this language.'),'note-sm'),
  btn(T('Profili kaydet','Save profile'),async()=>{
   await run(async()=>{
    assert(null,(await db.from('profiles').update({display_name:display.value,game_name:game.value}).eq('id',session.user.id)).error);
    assert(null,(await db.auth.updateUser({data:{preferred_language:preferred.value}})).error);
    await syncAuth();toast(T('Profil ve çeviri dili kaydedildi','Profile and translation language saved'));
   });
  },'gold'),
  child('div',{class:'spacer'}),btn(T('Şifremi değiştir','Change password'),()=>authDialog('change'))
 );content(target,panel)
}

async function showAdmin(target){if(!manager())return content(target,notice('Not authorized'));loading(target);try{const [pending,approved,reports,audit]=await Promise.all([db.from('profiles').select('*').eq('approval_status','pending').order('created_at'),db.from('profiles').select('*').eq('approval_status','approved').eq('is_site_admin',false).order('game_name').limit(150),db.from('dm_reports').select('*').order('created_at',{ascending:false}).limit(20),db.from('audit_log').select('*').order('recorded_at',{ascending:false}).limit(20)]);for(const r of [pending,approved,reports,audit])assert(null,r.error);
 const box=card(heading(T('Üye yönetimi','Member management')));for(const x of pending.data)box.append(listLine([child('strong',{text:x.game_name+' ('+x.display_name+')'}),small(formatDate(x.created_at))],[btn(T('Onayla','Approve'),()=>decide(x.id,'approved')),btn(T('Reddet','Reject'),()=>decide(x.id,'rejected'),'btn-danger')]));if(!pending.data.length)box.append(empty(T('Bekleyen eski kayıt yok. Yeni üyeler otomatik katılır.','No old pending accounts. New members join automatically.')));
 async function decide(targetId,decision){await run(async()=>{assert(null,(await db.rpc('decide_application',{target:targetId,decision})).error);showAdmin(target)})}
 const users=card(heading(T('Kayıtlı üyeler','Registered accounts')));for(const x of approved.data)users.append(listLine([child('strong',{text:x.game_name}),small(x.display_name+' • '+x.site_role)],[...(owner()&&x.id!==session.user.id?[btn(T('Rütbe ver','Set role'),async()=>{const value=prompt('R1, R2, R3, R4, R5:',x.site_role);if(!value)return;await run(async()=>{assert(null,(await db.rpc('set_site_role',{target:x.id,new_role:value.toUpperCase()})).error);showAdmin(target)})})]:[]),...(x.id!==session.user.id&& (owner()||!['R4','R5'].includes(x.site_role))?[btn(T('Erişimi kaldır','Revoke'),async()=>{if(!confirm(T('Bu hesabın erişimi kaldırılsın mı?','Revoke this account?')))return;await run(async()=>{assert(null,(await db.rpc('revoke_member',{target:x.id})).error);showAdmin(target)})},'btn-danger')]:[])]));
 if(profile?.is_site_admin===true)users.prepend(p(T('Site Admin hesabın üye listelerinde gizlidir. Tam yetkili yönetim hesabın burada görünmez.','Your Site Admin account is hidden from member lists. It is not shown among regular accounts.'),'note-sm'));
 const mods=card(heading(T('Bildirilen özel mesajlar','Reported direct messages')));mods.append(p(T('Yalnızca kullanıcının bildirdiği mesajın metni gösterilir; tüm özel konuşma yöneticiye açılmaz.','Only the explicitly reported message excerpt is available to moderators, not entire conversations.'),'note-sm'));for(const x of reports.data)mods.append(listLine([small(formatDate(x.created_at)+' • '+x.reason),p(x.excerpt,'post-body')],[]));if(!reports.data.length)mods.append(empty(T('Bildirim yok.','No reports.')));
 const logs=card(heading(T('Yönetim işlem geçmişi','Audit history')));for(const x of audit.data)logs.append(metaLine(x.action,formatDate(x.recorded_at)));if(!audit.data.length)logs.append(empty(T('Henüz işlem kaydı yok.','No admin actions yet.')));
 content(target,box,users,mods,logs)
}catch(e){content(target,notice(e.message))}}

async function init(){translatePublic();$('#lang-toggle').addEventListener('click',()=>{lang=lang==='tr'?'en':'tr';translatePublic();if(session)render()});$('#close-auth').addEventListener('click',()=>$('#auth-dialog').close());$('#login-top').addEventListener('click',()=>session?logout():authDialog('signin'));$('#join-btn').addEventListener('click',()=>authDialog('signup'));$('#member-btn').addEventListener('click',()=>session?navigate('home'):authDialog('signin'));$('#go-home').addEventListener('click',e=>{if(session){e.preventDefault();navigate('home')}});
 if(!SUPABASE_URL||!SUPABASE_PUBLIC_KEY)return;
 try{
  const module=await import('https://esm.sh/@supabase/supabase-js@2.119.0?bundle');
  db=module.createClient(SUPABASE_URL,SUPABASE_PUBLIC_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  db.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY')setTimeout(()=>authDialog('change'),0);setTimeout(()=>syncAuth(),0)});
  await syncAuth();
  if(new URLSearchParams(location.search).get('admin-setup')==='1')authDialog('admin-signup');
 }catch(e){err(e)}
}
init();
