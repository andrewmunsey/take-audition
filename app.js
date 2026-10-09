'use strict';
const $=id=>document.getElementById(id), S={takes:[],active:null,pending:null,playing:false,source:null,position:0,started:0,base:0,pinned:null,focus:false,zoom:1,rowHeight:83,markers:[]};let ctx,frame;
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
function draw(t,canvas){let w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;let d=window.devicePixelRatio||1;canvas.width=w*d;canvas.height=h*d;let c=canvas.getContext('2d');c.scale(d,d);let x=12+t.offset,width=t.buf.duration*w*S.zoom/maxDur();c.fillStyle=t.color+'25';c.fillRect(x,8,width,h-16);c.strokeStyle=t.color+'99';c.strokeRect(x,8,width,h-16);c.fillStyle=t.color;let step=Math.max(1,Math.ceil(t.peaks.length/Math.max(1,width)));for(let i=0;i<t.peaks.length;i+=step){let a=0;for(let j=i;j<Math.min(t.peaks.length,i+step);j++)a=Math.max(a,t.peaks[j]);let xx=x+i/t.peaks.length*width,hh=Math.max(1,a*(h-20)*.48);c.fillRect(xx,h/2-hh,Math.max(1,width*step/t.peaks.length),hh*2)}for(let m of S.markers.filter(m=>m.id===t.id)){let xx=xAt(t,m.time,w);c.fillStyle='#7df2ba';c.fillRect(xx,3,2,h-6);c.font='11px sans-serif';c.fillText(m.label,xx+4,14)}}
function makeRow(t){let el=document.createElement('div');el.className='take'+(S.active===t.id?' active':'');el.dataset.id=t.id;el.style.height=S.rowHeight+'px';let name=document.createElement('div');name.className='name';let b=document.createElement('b');b.textContent=t.name;let small=document.createElement('small');small.textContent=fmt(t.buf.duration);let pin=document.createElement('button');pin.textContent=S.pinned===t.id?'Unpin':'Pin';pin.onclick=()=>{S.pinned=S.pinned===t.id?null:t.id;render()};b.title=t.name;b.addEventListener('click',()=>cue(t.id,0));name.append(b,small,pin);let wave=document.createElement('div');wave.className='wave';let canvas=document.createElement('canvas');let cursor=document.createElement('div');cursor.className='cursor';let handle=document.createElement('button');handle.className='handle';handle.textContent='⇆';wave.append(canvas,cursor,handle);el.append(name,wave);wave.addEventListener('click',e=>{if(e.target===handle||wave.dataset.dragged==='1'){wave.dataset.dragged='0';return;}let rect=wave.getBoundingClientRect();cue(t.id,timeAt(t,e.clientX-rect.left,rect.width))});let sx,ox;handle.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();sx=e.clientX;ox=t.offset;handle.setPointerCapture(e.pointerId)});handle.addEventListener('pointermove',e=>{if(sx===undefined)return;t.offset=ox+e.clientX-sx;redraw()});handle.addEventListener('pointerup',()=>sx=undefined);handle.addEventListener('pointercancel',()=>sx=undefined);installGestures(wave,t);wave.addEventListener('dblclick',e=>e.preventDefault());return el}

function installGestures(wave,t){
  const touches=new Map();let gesture=null,blocked=false;
  const point=e=>({x:e.clientX,y:e.clientY});
  const metrics=()=>{const p=[...touches.values()],dx=p[1].x-p[0].x,dy=p[1].y-p[0].y;return {cx:(p[0].x+p[1].x)/2,cy:(p[0].y+p[1].y)/2,dx,dy,distance:Math.hypot(dx,dy)}};
  wave.addEventListener('pointerdown',e=>{
    if(e.target.closest('.handle')||e.pointerType==='mouse')return;
    touches.set(e.pointerId,point(e));
    if(touches.size===2){
      const m=metrics();gesture={initial:m,mode:null,zoom:S.zoom,height:S.rowHeight,offset:t.offset,anchor:timeAt(t,m.cx-wave.getBoundingClientRect().left,wave.clientWidth)};
      blocked=true;e.preventDefault();
    }
  });
  wave.addEventListener('pointermove',e=>{
    if(!touches.has(e.pointerId))return;
    touches.set(e.pointerId,point(e));
    if(touches.size!==2||!gesture)return;
    const m=metrics(),g=gesture,origin=g.initial;
    const translation=Math.hypot(m.cx-origin.cx,m.cy-origin.cy);
    const spread=Math.abs(m.distance-origin.distance);
    // Decide once, using a dead zone so minor touch noise cannot resize tracks.
    if(!g.mode){
      if(translation<7&&spread<7)return;
      if(translation>7&&translation>spread*1.3)g.mode='align';
      else if(spread>7&&spread>translation*1.3){
        const angle=Math.atan2(Math.abs(origin.dy),Math.abs(origin.dx));
        g.mode=angle<Math.PI/4?'time':'height';
      }else return;
    }
    if(g.mode==='align'){
      t.offset=g.offset+(m.cx-origin.cx);
    }else if(g.mode==='time'){
      S.zoom=Math.max(.4,Math.min(16,g.zoom*m.distance/Math.max(1,origin.distance)));
      const rect=wave.getBoundingClientRect();
      t.offset=origin.cx-rect.left-12-g.anchor*wave.clientWidth*S.zoom/maxDur();
      $('zoom').textContent=S.zoom===1?'Fit':S.zoom.toFixed(1)+'×';
    }else if(g.mode==='height'){
      S.rowHeight=Math.max(52,Math.min(240,Math.round(g.height*m.distance/Math.max(1,origin.distance))));
      document.querySelectorAll('.take').forEach(row=>row.style.height=S.rowHeight+'px');
    }
    redraw();e.preventDefault();
  });
  const end=e=>{
    if(!touches.has(e.pointerId))return;
    touches.delete(e.pointerId);
    if(touches.size<2)gesture=null;
    if(touches.size===0){setTimeout(()=>{blocked=false;wave.dataset.dragged='0'},400)}
    if(blocked)wave.dataset.dragged='1';
  };
  wave.addEventListener('pointerup',end);wave.addEventListener('pointercancel',end);
}

function redraw(){document.querySelectorAll('.take').forEach(el=>{let t=find(el.dataset.id);if(t)draw(t,el.querySelector('canvas'))});cursors()}
function cursors(){document.querySelectorAll('.take').forEach(el=>{let t=find(el.dataset.id),v=el.querySelector('.wave'),cur=el.querySelector('.cursor'),pending=S.pending?.id===t.id;if(!pending&&S.active!==t.id){cur.hidden=true;return}cur.hidden=false;cur.classList.toggle('pending',pending);cur.style.left=xAt(t,pending?S.pending.time:pos(),v.clientWidth)+'px'});let t=find(S.active);$('now').firstChild.textContent=t?.name||'No Take selected';$('clock').textContent=t?`${fmt(pos())} / ${fmt(t.buf.duration)}`:'0:00.000';$('play').textContent=S.playing?'Ⅱ':'▶'}
function render(){let visible=S.focus&&S.active?S.takes.filter(t=>t.id===S.active||t.id===S.pinned):S.takes;$('rows').replaceChildren();$('pinned').replaceChildren();for(let t of visible)(S.pinned===t.id?$('pinned'):$('rows')).append(makeRow(t));$('empty').hidden=!!S.takes.length;$('count').textContent=S.takes.length+' Takes';$('pinlabel').textContent=S.pinned?'· 1 pinned':'';$('focus').style.background=S.focus?'#316b8a':'';$('zoom').textContent=S.zoom===1?'Fit':S.zoom.toFixed(1)+'×';$('markers').replaceChildren();for(let m of S.markers){let el=document.createElement('div');el.textContent=m.label+' — '+find(m.id).name;let sm=document.createElement('small');sm.textContent=fmt(m.time);el.append(sm);el.onclick=()=>cue(m.id,m.time);$('markers').append(el)}requestAnimationFrame(redraw)}
$('files').onchange=e=>{load([...e.target.files]);e.target.value=''};$('play').onclick=play;$('stop').onclick=stop;$('fit').onclick=()=>{S.zoom=1;render()};$('focus').onclick=()=>{S.focus=!S.focus;render()};$('plus').onclick=()=>{S.zoom=Math.min(16,S.zoom*1.5);render()};$('minus').onclick=()=>{S.zoom=Math.max(.4,S.zoom/1.5);render()};$('mark').onclick=()=>{if(!S.active)return;S.markers.push({id:S.active,time:pos(),label:'M'+(S.markers.length+1)});render()};window.addEventListener('resize',redraw);render();
