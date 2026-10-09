'use strict';
const $=id=>document.getElementById(id), S={takes:[],active:null,pending:null,playing:false,source:null,position:0,started:0,base:0,pinned:null,focus:false,zoom:1,rowHeight:83,amplitude:1,viewX:0,markers:[]};let ctx,frame;
const fmt=n=>{n=Math.max(0,n);const min=Math.floor(n/60),sec=Math.floor(n%60),hundredths=Math.floor((n-Math.floor(n))*100);return `${min}:${String(sec).padStart(2,'0')}.${String(hundredths).padStart(2,'0')}`};
const colors=['#9eabbc','#4f96ff','#55cb8e','#b37aeb','#e9b44a','#e36f9b','#48c6cc'];
const find=id=>S.takes.find(t=>t.id===id), maxDur=()=>Math.max(1,...S.takes.map(t=>t.buf.duration));
const pos=()=>S.playing?Math.min(find(S.active).buf.duration,S.base+ctx.currentTime-S.started):S.position;
function stop(){if(S.playing){S.position=pos();S.source?.stop();S.source=null;S.playing=false}if(S.pending){S.active=S.pending.id;S.position=S.pending.time;S.pending=null}cancelAnimationFrame(frame);render()}
function play(){if(S.playing){stop();return}let t=find(S.active);if(!t)return;ctx.resume();if(S.position>=t.buf.duration)S.position=0;let src=ctx.createBufferSource();src.buffer=t.buf;src.connect(ctx.destination);S.source=src;S.base=S.position;S.started=ctx.currentTime;S.playing=true;src.onended=()=>{if(S.source===src&&S.playing)stop()};src.start(0,S.position);tick();render()}
function tick(){if(!S.playing)return;if(pos()>=find(S.active).buf.duration-.02){stop();return}cursors();frame=requestAnimationFrame(tick)}
function cue(id,time){const t=find(id);if(!t)return;time=Math.max(0,Math.min(t.buf.duration,time));if(S.playing){const old=S.source;S.source=null;if(old){old.onended=null;try{old.stop()}catch(e){}}const src=ctx.createBufferSource();src.buffer=t.buf;src.connect(ctx.destination);S.active=id;S.position=time;S.base=time;S.started=ctx.currentTime;S.pending=null;S.source=src;src.onended=()=>{if(S.source===src&&S.playing)stop()};if(time<t.buf.duration)src.start(0,time);else{S.playing=false;S.source=null;cancelAnimationFrame(frame)}}else{S.active=id;S.position=time;S.pending=null}render()}
function peaks(buf){let a=buf.getChannelData(0),step=Math.max(1,Math.floor(a.length/1300)),out=[];for(let i=0;i<a.length;i+=step){let m=0;for(let j=i;j<Math.min(a.length,i+step);j+=Math.max(1,Math.floor(step/12)))m=Math.max(m,Math.abs(a[j]));out.push(m)}return out}
async function load(files){ctx ||=new (window.AudioContext||window.webkitAudioContext)();for(let f of files){try{let buf=await ctx.decodeAudioData(await f.arrayBuffer());let id=`t${Date.now()}_${Math.random()}`;S.takes.push({id,name:f.name,buf,peaks:peaks(buf),offset:0,color:colors[S.takes.length%colors.length]});S.active ||=id}catch(e){alert(`Cannot decode ${f.name}: ${e.message}`)}}render()}
function xAt(t,time,w){return 12+S.viewX+t.offset+time*w*S.zoom/maxDur()}
function timeAt(t,x,w){return (x-12-S.viewX-t.offset)*maxDur()/(w*S.zoom)}
function visibleTakes(){return S.focus&&S.active?S.takes.filter(t=>t.id===S.active||t.id===S.pinned):S.takes}
function waveWidth(){return document.querySelector('.wave')?.clientWidth||Math.max(100,document.querySelector('main').clientWidth-115)}
function extents(){const w=waveWidth(),a=visibleTakes();return {left:Math.min(0,...a.map(t=>t.offset)),right:Math.max(0,...a.map(t=>t.offset+t.buf.duration*w*S.zoom/maxDur()))}}
function boundView(){if(!S.takes.length)return;const w=waveWidth(),e=extents(),longest=maxDur()*w*S.zoom/maxDur(),rightPad=longest*.5;const lo=w-12-e.right-rightPad,hi=12-e.left;S.viewX=Math.max(lo,Math.min(hi,S.viewX))}
function fit(){if(!S.takes.length)return;const a=visibleTakes(),w=waveWidth(),duration=maxDur();const left=Math.min(...a.map(t=>t.offset)),right=Math.max(...a.map(t=>t.offset+t.buf.duration*w/duration));const span=Math.max(1,right-left),margin=18;S.zoom=Math.max(.05,Math.min(16,(w-2*margin)/span));S.viewX=margin-12-left;boundView();render()}
function reorder(t,clientY){const rows=$('rows'),siblings=[...rows.children].filter(el=>el.dataset.id!==t.id);let target=siblings.findIndex(el=>clientY<el.getBoundingClientRect().top+el.getBoundingClientRect().height/2);if(target<0)target=siblings.length;const old=S.takes.indexOf(t);S.takes.splice(old,1);const before=siblings[target]?.dataset.id;const idx=before?S.takes.findIndex(x=>x.id===before):S.takes.length;S.takes.splice(idx,0,t);render()}
function draw(t,canvas){let w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;let d=window.devicePixelRatio||1;canvas.width=w*d;canvas.height=h*d;let c=canvas.getContext('2d');c.scale(d,d);let x=12+S.viewX+t.offset,width=t.buf.duration*w*S.zoom/maxDur();c.fillStyle=t.color+'25';c.fillRect(x,8,width,h-16);c.strokeStyle=t.color+'99';c.strokeRect(x,8,width,h-16);c.fillStyle=t.color;let step=Math.max(1,Math.ceil(t.peaks.length/Math.max(1,width)));for(let i=0;i<t.peaks.length;i+=step){let a=0;for(let j=i;j<Math.min(t.peaks.length,i+step);j++)a=Math.max(a,t.peaks[j]);let xx=x+i/t.peaks.length*width,hh=Math.max(1,a*S.amplitude*(h-20)*.48);c.fillRect(xx,h/2-hh,Math.max(1,width*step/t.peaks.length),hh*2)}for(let m of S.markers.filter(m=>m.id===t.id)){let xx=xAt(t,m.time,w);c.fillStyle='#7df2ba';c.fillRect(xx,3,2,h-6);c.font='11px sans-serif';c.fillText(m.label,xx+4,14)}}
function makeRow(t){let el=document.createElement('div');el.className='take'+(S.active===t.id?' active':'');el.dataset.id=t.id;el.style.height=S.rowHeight+'px';let name=document.createElement('div');name.className='name';let b=document.createElement('b');b.textContent=t.name;let small=document.createElement('small');small.textContent=fmt(t.buf.duration);let pin=document.createElement('button');pin.textContent=S.pinned===t.id?'◆':'◇';pin.title=S.pinned===t.id?'Unpin':'Pin';pin.onclick=()=>{S.pinned=S.pinned===t.id?null:t.id;render()};b.title=t.name;name.addEventListener('click',e=>{if(e.target.closest('button')||(name.dataset.dragged==='1'||Date.now()<suppressClickUntil)){name.dataset.dragged='0';return}cue(t.id,0)});name.append(b,small,pin);installGestures(name,t,'labels');let wave=document.createElement('div');wave.className='wave';let canvas=document.createElement('canvas');let cursor=document.createElement('div');cursor.className='cursor';let handle=document.createElement('button');handle.className='handle';handle.textContent='⇆';wave.append(canvas,cursor,handle);let loupe=document.createElement('div');loupe.className='loupe';loupe.hidden=true;wave.append(loupe);el.append(name,wave);wave.addEventListener('click',e=>{if(e.target===handle||(wave.dataset.dragged==='1'||Date.now()<suppressClickUntil)){wave.dataset.dragged='0';return;}let rect=wave.getBoundingClientRect();cue(t.id,timeAt(t,e.clientX-rect.left,rect.width))});let sx,ox;handle.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();sx=e.clientX;ox=t.offset;handle.setPointerCapture(e.pointerId)});handle.addEventListener('pointermove',e=>{if(sx===undefined)return;t.offset=ox+e.clientX-sx;redraw()});handle.addEventListener('pointerup',()=>sx=undefined);handle.addEventListener('pointercancel',()=>sx=undefined);installGestures(wave,t,'canvas');installGestures(el,t,'canvas',true);wave.addEventListener('dblclick',e=>e.preventDefault());return el}

const fingers=new Map();let pinch=null;let scrolling=false;let suppressClickUntil=0;let loupeTimer=null;let liftTimer=null;
function installGestures(area,t,zone,gapOnly=false){
 area.addEventListener('pointerdown',e=>{
  if(gapOnly&&e.target!==area)return;
  if(e.target.closest('button,.handle')||e.pointerType==='mouse'||fingers.size>=2)return;
  fingers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY,area,t,zone,moved:false});clearTimeout(loupeTimer);if(fingers.size===1&&zone==='canvas'&&!gapOnly){const px=e.clientX;loupeTimer=setTimeout(()=>{const f=fingers.get(e.pointerId);if(!f||f.moved||fingers.size!==1||S.playing)return;f.loupe=true;showLoupe(f,px)},480)}
  if(fingers.size===2){
   scrolling=false;clearTimeout(loupeTimer);
   const p=[...fingers.values()];
   if(p[0].zone!==p[1].zone){fingers.delete(e.pointerId);return}
   const dx=p[1].x-p[0].x,dy=p[1].y-p[0].y;
   const main=document.querySelector('main'),rect=main.getBoundingClientRect();
   const midY=(p[0].y+p[1].y)/2;
   pinch={x:(p[0].x+p[1].x)/2,y:midY,d:Math.hypot(dx,dy),
    vertical:Math.abs(dy)>Math.abs(dx),mode:null,zone,zoom:S.zoom,height:S.rowHeight,
    amplitude:S.amplitude,offset:p[0].t.offset,t:p[0].t,
    offsets:S.takes.map(t=>[t,t.offset]),anchorX:(p[0].x+p[1].x)/2-(p[0].area.closest('.take')?.querySelector('.wave')||p[0].area).getBoundingClientRect().left,
    main,anchorY:midY-rect.top,contentY:main.scrollTop+midY-rect.top,viewX:S.viewX};
   clearTimeout(liftTimer);if(zone==='canvas'&&p[0].t===p[1].t){liftTimer=setTimeout(()=>{if(pinch&&pinch.mode===null&&fingers.size===2){pinch.mode='move';pinch.tRow=document.querySelector('.take[data-id="'+pinch.t.id+'"]');pinch.tRow?.classList.add('lifted')}},350)}
   p.forEach(v=>v.area.dataset.dragged='1');e.preventDefault();
  }
 });
}
window.addEventListener('pointermove',e=>{
 if(!fingers.has(e.pointerId))return;
 const finger=fingers.get(e.pointerId);
 if(!pinch&&fingers.size===1){
  const dy=e.clientY-finger.lastY,dx=e.clientX-finger.lastX;
  if(Math.hypot(e.clientX-finger.startX,e.clientY-finger.startY)>8)finger.moved=true;
  if(finger.moved){clearTimeout(loupeTimer);scrolling=true;const main=document.querySelector('main');if(finger.loupe){showLoupe(finger,e.clientX)}else{main.scrollTop-=dy;if(finger.zone==='canvas'){S.viewX+=dx;boundView();redraw()}}e.preventDefault()}
  finger.lastX=e.clientX;finger.lastY=e.clientY;finger.x=e.clientX;finger.y=e.clientY;return;
 }
 Object.assign(finger,{x:e.clientX,y:e.clientY});
 if(!pinch||fingers.size!==2)return;
 const p=[...fingers.values()],cx=(p[0].x+p[1].x)/2,cy=(p[0].y+p[1].y)/2;
 const d=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y);
 const travel=Math.hypot(cx-pinch.x,cy-pinch.y),spread=Math.abs(d-pinch.d);
 if(!pinch.mode){if(spread<10)return;clearTimeout(liftTimer);pinch.mode=pinch.vertical?(pinch.zone==='labels'?'height':'amplitude'):(pinch.zone==='canvas'?'time':null)}
 if(pinch.mode==='move'){pinch.t.offset=pinch.offset+cx-pinch.x;if(pinch.tRow)pinch.tRow.style.transform='translateY('+(cy-pinch.y)+'px)';boundView()}
 if(pinch.mode==='time'){
  S.zoom=Math.max(.4,Math.min(16,pinch.zoom*d/Math.max(1,pinch.d)));
  const ratio=S.zoom/pinch.zoom;
  pinch.offsets.forEach(([take,offset])=>{take.offset=offset+(pinch.anchorX-12-pinch.viewX-offset)*(1-ratio)});boundView();
  $('zoom').textContent=S.zoom.toFixed(1)+'×';
 }
 if(pinch.mode==='amplitude')S.amplitude=Math.max(.5,Math.min(4,pinch.amplitude*d/Math.max(1,pinch.d)));
 if(pinch.mode==='height'){
  S.rowHeight=Math.max(52,Math.min(240,Math.round(pinch.height*d/Math.max(1,pinch.d))));
  document.querySelectorAll('.take').forEach(r=>r.style.height=S.rowHeight+'px');
  // Anchor the midpoint of the pinch to its original position in the list.
  const bar=$('rows').getBoundingClientRect().top;
  const rowsTop=pinch.main.scrollTop+bar-pinch.main.getBoundingClientRect().top;
  const relative=Math.max(0,pinch.contentY-rowsTop);
  pinch.main.scrollTop=rowsTop+relative*S.rowHeight/pinch.height-pinch.anchorY;
 }
 redraw();e.preventDefault();
},{passive:false});
function finishFinger(e){
 if(!fingers.has(e.pointerId))return;
 clearTimeout(loupeTimer);clearTimeout(liftTimer);const hadPinch=!!pinch;const endedMove=pinch?.mode==='move',moveTake=pinch?.t,moveY=pinch?.y,moveRow=pinch?.tRow;
 const finger=fingers.get(e.pointerId),area=finger.area;
 fingers.delete(e.pointerId);if(finger.loupe){hideLoupe();finger.moved=true}if(endedMove&&fingers.size===1){const other=[...fingers.values()][0];if(Math.abs(e.clientY-moveY)>18&&moveTake&&S.pinned!==moveTake.id)reorder(moveTake,e.clientY);else if(moveRow)moveRow.style.transform='';}if(fingers.size<2)pinch=null;
 // A normal one-finger tap must never be marked as a drag.
 if(hadPinch||finger.moved){area.dataset.dragged='1';suppressClickUntil=Date.now()+500;if(area.classList.contains('take'))area.querySelector('.wave').dataset.dragged='1'}
 if(!fingers.size&&(hadPinch||finger.moved))setTimeout(()=>document.querySelectorAll('.wave,.name,.take').forEach(w=>w.dataset.dragged='0'),500);
}
window.addEventListener('pointerup',finishFinger);
window.addEventListener('pointercancel',finishFinger);

function showLoupe(f,x){const wave=f.area.closest('.wave');if(!wave)return;const box=wave.querySelector('.loupe');if(!box)return;const rect=wave.getBoundingClientRect(),local=x-rect.left,time=Math.max(0,Math.min(f.t.buf.duration,timeAt(f.t,local,rect.width)));cue(f.t.id,time);const current=document.querySelector('.take[data-id="'+f.t.id+'"] .loupe');if(!current)return;current.hidden=false;current.style.left=Math.max(62,Math.min(rect.width-62,local))+'px';current.textContent='⌕ '+fmt(time)}
function hideLoupe(){document.querySelectorAll('.loupe').forEach(el=>el.hidden=true)}
function redraw(){document.querySelectorAll('.take').forEach(el=>{let t=find(el.dataset.id);if(t)draw(t,el.querySelector('canvas'))});cursors()}
function cursors(){document.querySelectorAll('.take').forEach(el=>{let t=find(el.dataset.id),v=el.querySelector('.wave'),cur=el.querySelector('.cursor'),pending=S.pending?.id===t.id;if(!pending&&S.active!==t.id){cur.hidden=true;return}cur.hidden=false;cur.classList.toggle('pending',pending);cur.style.left=xAt(t,pending?S.pending.time:pos(),v.clientWidth)+'px'});let t=find(S.active);$('now').firstChild.textContent=t?.name||'No Take selected';$('clock').textContent=t?`${fmt(pos())} / ${fmt(t.buf.duration)}`:'0:00.000';$('play').textContent=S.playing?'Ⅱ':'▶'}
function render(){let visible=visibleTakes();$('rows').replaceChildren();$('pinned').replaceChildren();for(let t of visible)(S.pinned===t.id?$('pinned'):$('rows')).append(makeRow(t));$('empty').hidden=!!S.takes.length;$('count').textContent=S.takes.length+' Takes';$('pinlabel').textContent=S.pinned?'· 1 pinned':'';$('focus').style.background=S.focus?'#316b8a':'';$('zoom').textContent=S.zoom===1?'Fit':S.zoom.toFixed(1)+'×';$('markers').replaceChildren();for(let m of S.markers){let el=document.createElement('div');el.textContent=m.label+' — '+find(m.id).name;let sm=document.createElement('small');sm.textContent=fmt(m.time);el.append(sm);el.onclick=()=>cue(m.id,m.time);$('markers').append(el)}requestAnimationFrame(redraw)}
$('files').onchange=e=>{load([...e.target.files]);e.target.value=''};$('play').onclick=play;$('stop').onclick=stop;$('fit').onclick=fit;$('focus').onclick=()=>{S.focus=!S.focus;render()};$('plus').onclick=()=>{S.zoom=Math.min(16,S.zoom*1.5);boundView();render()};$('minus').onclick=()=>{S.zoom=Math.max(.05,S.zoom/1.5);boundView();render()};$('mark').onclick=()=>{if(!S.active)return;S.markers.push({id:S.active,time:pos(),label:'M'+(S.markers.length+1)});render()};window.addEventListener('resize',redraw);render();
