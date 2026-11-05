/* Recomputed original conditioned denoiser. See export_diffusion_control.py. */
(async () => {
  const root=document.querySelector('#control-demo'), canvas=root.querySelector('canvas'), ctx=canvas.getContext('2d');
  if(!ctx)return;
  const time=root.querySelector('#control-time'), noise=root.querySelector('#control-value');
  let data;
  try { const response=await fetch('../../assets/data/diffusion-control.json'); if(!response.ok)throw Error(); data=await response.json(); } catch { root.querySelector('figcaption').textContent='The trajectory data could not load. Please reload to explore the conditioned network.';return; }
  let angle=.65,tilt=.45,drag=null,visible=false,last=0;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  function draw(){
    const w=canvas.clientWidth,h=w/1.5,dpr=Math.min(devicePixelRatio||1,2);
    if(!w)return;
    canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);
    const t=Number(time.value),ci=Number(noise.value);
    root.querySelector('#control-time-output').textContent=t;
    root.querySelector('#control-value-output').textContent=data.controls[ci].toFixed(1);
    const scale=w/25;
    const project=p=>{const x=p[0]*Math.cos(angle)+p[1]*Math.sin(angle),d=-p[0]*Math.sin(angle)+p[1]*Math.cos(angle);return[w/2+x*scale,h/2-(p[2]*Math.cos(tilt)-d*Math.sin(tilt))*scale,p[2]*Math.sin(tilt)+d*Math.cos(tilt)];};
    ctx.font='14px system-ui';
    [0,1,2].forEach((_,i)=>{let p=[0,0,0],q=[0,0,0];p[i]=-7;q[i]=7;let v=project(p),u=project(q);ctx.strokeStyle='#d4dfe5';ctx.beginPath();ctx.moveTo(v[0],v[1]);ctx.lineTo(u[0],u[1]);ctx.stroke();ctx.fillStyle='#63717e';ctx.fillText('x'+(i+1),u[0]+5,u[1]);});
    const points=data.frames[ci][t].map((p,i)=>({q:project(p),i})).sort((a,b)=>a.q[2]-b.q[2]);
    ctx.fillStyle='rgba(35,119,165,.38)';for(const item of points){const p=item.q;ctx.fillStyle=`hsla(${205+120*item.i/points.length},55%,48%,.42)`;ctx.beginPath();ctx.arc(p[0],p[1],2.2,0,2*Math.PI);ctx.fill();}
  }
  for(const el of [time,noise])el.addEventListener('input',draw);
  canvas.addEventListener('pointerdown',e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
  canvas.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;angle+=(e.clientX-drag.x)*.01;tilt=Math.max(-1.5,Math.min(1.5,tilt+(e.clientY-drag.y)*.01));drag.x=e.clientX;drag.y=e.clientY;draw();});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{drag=null;});
  new ResizeObserver(draw).observe(canvas);
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;}).observe(canvas);
  function animate(now){if(visible&&!document.hidden&&!drag&&!motion.matches){if(last)angle+=Math.min(50,now-last)*.00012;draw();}last=now;requestAnimationFrame(animate);}
  draw();requestAnimationFrame(animate);
})();
