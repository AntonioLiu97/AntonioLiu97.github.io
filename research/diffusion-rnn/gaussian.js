/* Exact Gaussian posterior-mean recurrence. Deterministic seed; no learned model. */
(() => {
  const root=document.querySelector('#gaussian-demo'), canvas=root.querySelector('canvas'), ctx=canvas.getContext('2d');
  if(!ctx)return;
  const time=root.querySelector('#gaussian-time'), noise=root.querySelector('#gaussian-noise');
  const eigenvalues=[9,2,.25];
  let seed=19,angle=.65,tilt=.45,drag=null,visible=false,last=0;
  const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return (seed+.5)/4294967296;};
  const normal=()=>Math.sqrt(-2*Math.log(random()))*Math.cos(2*Math.PI*random());
  const initial=Array.from({length:1400},()=>eigenvalues.map(v=>normal()*Math.sqrt(v)));
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  function draw(){
    const w=canvas.clientWidth,h=w/1.5,dpr=Math.min(devicePixelRatio||1,2);
    if(!w)return;
    canvas.width=w*dpr;canvas.height=h*dpr;ctx.scale(dpr,dpr);
    const a=Number(noise.value),t=Number(time.value),g=eigenvalues.map(v=>v/(v+a*a));
    root.querySelector('#gaussian-time-value').textContent=t;
    root.querySelector('#gaussian-noise-value').textContent=a.toFixed(1);
    root.querySelector('#gaussian-gains').textContent='Gains per step: '+g.map(v=>v.toFixed(3)).join(' · ');
    const scale=w/22;
    const project=p=>{const x=p[0]*Math.cos(angle)+p[1]*Math.sin(angle),d=-p[0]*Math.sin(angle)+p[1]*Math.cos(angle);return[w/2+x*scale,h/2-(p[2]*Math.cos(tilt)-d*Math.sin(tilt))*scale,p[2]*Math.sin(tilt)+d*Math.cos(tilt)];};
    ctx.font='14px system-ui';
    eigenvalues.forEach((_,i)=>{let p=[0,0,0],q=[0,0,0];p[i]=-7;q[i]=7;let v=project(p),u=project(q);ctx.strokeStyle='#d4dfe5';ctx.beginPath();ctx.moveTo(v[0],v[1]);ctx.lineTo(u[0],u[1]);ctx.stroke();ctx.fillStyle='#63717e';ctx.fillText('PC'+(i+1),u[0]+5,u[1]);});
    for(const p of initial){const q=project(p);ctx.beginPath();ctx.fillStyle='rgba(115,140,155,.10)';ctx.arc(q[0],q[1],1.6,0,2*Math.PI);ctx.fill();}
    const points=initial.map(p=>project(p.map((v,i)=>v*Math.pow(g[i],t)))).sort((a,b)=>a[2]-b[2]);
    ctx.fillStyle='rgba(35,119,165,.38)';for(const p of points){ctx.beginPath();ctx.arc(p[0],p[1],2.2,0,2*Math.PI);ctx.fill();}
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
