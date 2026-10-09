'use strict';
const $=id=>document.getElementById(id), S={takes:[],active:null,pending:null,playing:false,source:null,position:0,started:0,base:0,pinned:null,focus:false,zoom:1,rowHeight:83,amplitude:1,markers:[]};let ctx,frame;
const fmt=n=>{n=Math.max(0,n);const min=Math.floor(n/60),sec=Math.floor(n%60),hundredths=Math.floor((n-Math.floor(n))*100);return `${min}:${String(sec).padStart(2,'0')}.${String(hundredths).padStart(2,'0')}`};
const colors=['#9eabbc','#4f96ff','#55cb8e','#b37aeb','#e9b44a','#e36f9b','#48c6cc'];
const find=id=>S.takes.find(t=>t.id===id), maxDur=()=>Math.max(1,...S.takes.map(t=>t.buf.duration));
const pos=()=>S.playing?Math.min(find(S.active).buf.duration,S.base+ctx.currentTime-S.started):S.position;
function stop(){if(S.playing){S.position=pos();S.source?.stop();S.source=null;S.playing=false}if(S.pending){S.active=S.pending.id;S.position=S.pending.time;S.pending=null}cancelAnimationFrame(frame);render()}
function play(){if(S.playing){stop();return}let t=find(S.active);if(!t)return;ctx.resume();if(S.position>=t.buf.duration)S.position=0;let src=ctx.createBufferSource();src.buffer=t.buf;src.connect(ctx.destination);S.source=src;S.base=S.position;S.started=ctx.currentTime;S.playing=true;src.onended=()=>{if(S.source===src&&S.playing)stop()};src.start(0,S.position);tick();render()}
function tick(){if(!S.playing)return;if(pos()>=find(S.active).buf.duration-.02){stop();return}cursors();frame=requestAnimationFrame(tick)}
function cue(id,time){time=Math.max(0,Math.min(find(id).buf.duration,time));if(S.playing)S.pending={id,time};else{S.active=id;S.position=time;S.pending=null}render()}
function peaks(buf){let a=buf.getChannelData(0),step=Math.max(1,Math.floor(a.length/1300)),out=[];for(let i=0;i<a.length;i+=step){let m=0;for(let j=i;j<Math.min(a.length,i+step);j+=Math.max(1,Math.floor(step/12)))m=Math.max(m,Math.abs(a[j]));out.push(m)}return out}
async function load(files){ctx ||=new (window.AudioContext||window.webkitAudioContext)();for(let f of files){try{let buf=await ctx.decodeAudioData(await f.arrayBuffer());let id=`t${Date.now()}_${Math.random()}`;S.takes.push({id,name:f.name,buf,peaks:peaks(buf),offset:0,color:colors[S.takes.length%colors.length]});S.active ||=id}catch(e){alert(`Cannot decode ${f.name}: ${e.message}`)}}render()}
function xAt(t,time,w){return 12+t.offset+time*w*S.zoom/maxDur()}
function timeAt(t,x,w){return (x-12-t.offset)*maxDur()/(w*S.zoom)}
function draw(t,canvas){let w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;let d=window.devicePixelRatio||1;canvas.width=w*d;canvas.height=h*d;let c=canvas.getContext('2d');c.scale(d,d);let x=12+t.offset,width=t.buf.duration*w*S.zoom/maxDur();c.fillStyle=t.color+'25';c.fillRect(x,8,width,h-16);c.strokeStyle=t.color+'99';c.strokeRect(x,8,width,h-16);c.fillStyle=t.color;let step=Math.max(1,Math.ceil(t.peaks.length/Math.max(1,width)));for(let i=0;i<t.peaks.length;i+=step){let a=0;for(let j=i;j<Math.min(t.peaks.length,i+step);j++)a=Math.max(a,t.peaks[j]);let xx=x+i/t.peaks.length*width,hh=Math.max(1,a*S.amplitude*(h-20)*.48);c.fillRect(xx,h/2-hh,Math.max(1,width*step/t.peaks.length),hh*2)}for(let m of S.markers.filter(m=>m.id===t.id)){let xx=xAt(t,m.time,w);c.fillStyle='#7df2ba';c.fillRect(xx,3,2,h-6);c.font='11px sans-serif';c.fillText(m.label,xx+4,14)}}
function makeRow(t){let el=document.createElement('div');el.className='take'+(S.active===t.id?' active':'');el.dataset.id=t.id;el.style.height=S.rowHeight+'px';let name=document.createElement('div');name.className='name';let b=document.createElement('b');b.textContent=t.name;let small=document.createElement('small');small.textContent=fmt(t.buf.duration);let pin=document.createElement('button');pin.textContent=S.pinned===t.id?'Unpin':'Pin';pin.onclick=()=>{S.pinned=S.pinned===t.id?null:t.id;render()};b.title=t.name;b.addEventListener('click',()=>cue(t.id,0));name.append(b,small,pin);installGestures(name,t,'labels');let wave=document.createElement('div');wave.className='wave';let canvas=document.createElement('canvas');let cursor=document.createElement('div');cursor.className='cursor';let handle=document.createElement('button');handle.className='handle';handle.textContent='⇆';wave.append(canvas,cursor,handle);el.append(name,wave);wave.addEventListener('click',e=>{if(e.target===handle||wave.dataset.dragged==='1'){wave.dataset.dragged='0';return;}let rect=wave.getBoundingClientRect();cue(t.id,timeAt(t,e.clientX-rect.left,rect.width))});let sx,ox;handle.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();sx=e.clientX;ox=t.offset;handle.setPointerCapture(e.pointerId)});handle.addEventListener('pointermove',e=>{if(sx===undefined)return;t.offset=ox+e.clientX-sx;redraw()});handle.addEventListener('pointerup',()=>sx=undefined);handle.addEventListener('pointercancel',()=>sx=undefined);installGestures(wave,t,'canvas');wave.addEventListener('dblclick',e=>e.preventDefault());return el}

const fingers=new Map();let pinch=null;
function installGestures(area,t,zone){
 area.addEventListener('pointerdown',e=>{
  if(e.target.closest('button,.handle')||e.pointerType==='mouse'||fingers.size>=2)return;
  fingers.set(e.pointerId,{x:e.clientX,y:e.clientY,area,t,zone});
  if(fingers.size===2){
   const p=[...fingers.values()];
   if(p[0].zone!==p[1].zone){fingers.delete(e.pointerId);return}
   const dx=p[1].x-p[0].x,dy=p[1].y-p[0].y;
   const main=document.querySelector('main'),rect=main.getBoundingClientRect();
   const midY=(p[0].y+p[1].y)/2;
   pinch={x:(p[0].x+p[1].x)/2,y:midY,d:Math.hypot(dx,dy),
    vertical:Math.abs(dy)>Math.abs(dx),mode:null,zone,zoom:S.zoom,height:S.rowHeight,
    amplitude:S.amplitude,offset:p[0].t.offset,t:p[0].t,
    main,anchorY:midY-rect.top,contentY:main.scrollTop+midY-rect.top};
   p.forEach(v=>v.area.dataset.dragged='1');e.preventDefault();
  }
 });
}
window.addEventListener('pointermove',e=>{
 if(!fingers.has(e.pointerId))return;
 Object.assign(fingers.get(e.pointerId),{x:e.clientX,y:e.clientY});
 if(!pinch||fingers.size!==2)return;
 const p=[...fingers.values()],cx=(p[0].x+p[1].x)/2,cy=(p[0].y+p[1].y)/2;
 const d=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y);
 const travel=Math.hypot(cx-pinch.x,cy-pinch.y),spread=Math.abs(d-pinch.d);
 if(!pinch.mode){
  if(travel<7&&spread<7)return;
  if(travel>spread*1.4&&pinch.zone==='canvas')pinch.mode='align';
  else if(spread>travel*1.1)pinch.mode=pinch.vertical?(pinch.zone==='labels'?'height':'amplitude'):(pinch.zone==='canvas'?'time':null);
  else return;
 }
 if(pinch.mode==='align')pinch.t.offset=pinch.offset+cx-pinch.x;
 if(pinch.mode==='time'){
  S.zoom=Math.max(.4,Math.min(16,pinch.zoom*d/Math.max(1,pinch.d)));
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
 const area=fingers.get(e.pointerId).area;fingers.delete(e.pointerId);
 if(fingers.size<2)pinch=null;
 area.dataset.dragged='1';
 if(!fingers.size)setTimeout(()=>document.querySelectorAll('.wave,.name').forEach(w=>w.dataset.dragged='0'),450);
}
window.addEventListener('pointerup',finishFinger);
window.addEventListener('pointercancel',finishFinger);

function redraw(){document.querySelectorAll('.take').forEach(el=>{let t=find(el.dataset.id);if(t)draw(t,el.querySelector('canvas'))});cursors()}
function cursors(){document.querySelectorAll('.take').forEach(el=>{let t=find(el.dataset.id),v=el.querySelector('.wave'),cur=el.querySelector('.cursor'),pending=S.pending?.id===t.id;if(!pending&&S.active!==t.id){cur.hidden=true;return}cur.hidden=false;cur.classList.toggle('pending',pending);cur.style.left=xAt(t,pending?S.pending.time:pos(),v.clientWidth)+'px'});let t=find(S.active);$('now').firstChild.textContent=t?.name||'No Take selected';$('clock').textContent=t?`${fmt(pos())} / ${fmt(t.buf.duration)}`:'0:00.000';$('play').textContent=S.playing?'Ⅱ':'▶'}
function render(){let visible=S.focus&&S.active?S.takes.filter(t=>t.id===S.active||t.id===S.pinned):S.takes;$('rows').replaceChildren();$('pinned').replaceChildren();for(let t of visible)(S.pinned===t.id?$('pinned'):$('rows')).append(makeRow(t));$('empty').hidden=!!S.takes.length;$('count').textContent=S.takes.length+' Takes';$('pinlabel').textContent=S.pinned?'· 1 pinned':'';$('focus').style.background=S.focus?'#316b8a':'';$('zoom').textContent=S.zoom===1?'Fit':S.zoom.toFixed(1)+'×';$('markers').replaceChildren();for(let m of S.markers){let el=document.createElement('div');el.textContent=m.label+' — '+find(m.id).name;let sm=document.createElement('small');sm.textContent=fmt(m.time);el.append(sm);el.onclick=()=>cue(m.id,m.time);$('markers').append(el)}requestAnimationFrame(redraw)}
$('files').onchange=e=>{load([...e.target.files]);e.target.value=''};$('play').onclick=play;$('stop').onclick=stop;$('fit').onclick=()=>{S.zoom=1;render()};$('focus').onclick=()=>{S.focus=!S.focus;render()};$('plus').onclick=()=>{S.zoom=Math.min(16,S.zoom*1.5);render()};$('minus').onclick=()=>{S.zoom=Math.max(.4,S.zoom/1.5);render()};$('mark').onclick=()=>{if(!S.active)return;S.markers.push({id:S.active,time:pos(),label:'M'+(S.markers.length+1)});render()};window.addEventListener('resize',redraw);render();
