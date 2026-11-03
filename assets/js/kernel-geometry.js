/* Original Hellinger inPCA trajectories; see scripts/export_kernel_geometry.py. */
(() => {
  const figure = document.querySelector('#kernel-geometry');
  if (!figure) return;
  const canvas = figure.querySelector('canvas');
  const slider=figure.querySelector('input');
  const progress=figure.querySelector('output');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let playing = !motion.matches, visible = false, frame = 0, last = 0, angle = 0.4;
  let tilt = Math.PI / 6, hovering = false, drag = null;
  let progressTimer=null;
  fetch('assets/data/kernel-geometry.json').then(r => {
    if (!r.ok) throw new Error('Geometry unavailable');
    return r.json();
  }).then(data => {
    const allPoints=data.trajectories.flatMap(t=>t.points).concat(data.landmarks.map(l=>l.point));
    const lower=[0,1,2].map(i=>Math.min(...allPoints.map(p=>p[i])));
    const upper=[0,1,2].map(i=>Math.max(...allPoints.map(p=>p[i])));
    const center=lower.map((v,i)=>(v+upper[i])/2);
    const centered=p=>p.map((v,i)=>v-center[i]);
    const trajectories=data.trajectories.map(t=>({...t,points:t.points.map(centered)}));
    const stepCount=Math.min(...trajectories.filter(t=>t.marker).map(t=>t.points.length));
    slider.max=stepCount;
    const landmarks=data.landmarks.map(l=>({...l,point:centered(l.point)}));
    const radius=Math.max(...allPoints.map(p=>Math.hypot(...centered(p))));
    const boxExtents=lower.map((v,i)=>Math.max((upper[i]-v)*0.55,radius*0.15));
    function draw() {
      const step=Math.max(1,Math.min(stepCount,Number(slider.value)));
      progress.textContent=`Step ${step} of ${stepCount}`;
      slider.setAttribute('aria-valuetext',`In-context data: step ${step} of ${stepCount}`);
      const width = canvas.clientWidth;
      if (!width) return;
      const height = width / 1.5, dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = width * dpr; canvas.height = height * dpr;
      ctx.scale(dpr, dpr); ctx.clearRect(0, 0, width, height);
      const scale = height * 0.55 / radius;
      const project = p => {
        // Azimuth rotates in the PC1–PC2 base plane; PC3 stays vertical.
        const x = p[0] * Math.cos(angle) + p[1] * Math.sin(angle);
        const baseDepth = -p[0] * Math.sin(angle) + p[1] * Math.cos(angle);
        const y = p[2] * Math.cos(tilt) - baseDepth * Math.sin(tilt);
        const depth = p[2] * Math.sin(tilt) + baseDepth * Math.cos(tilt);
        return [width/2 + scale*x, height*0.47 - scale*y, depth];
      };
      // PC-coordinate box: only the three back panes and their borders, behind
      // the scatter. Use the same projection so the box follows every drag.
      const extents=boxExtents;
      const corners=Array.from({length:8},(_,i)=>[
        (i&1)?extents[0]:-extents[0],(i&2)?extents[1]:-extents[1],(i&4)?extents[2]:-extents[2]
      ]);
      const projectedCorners=corners.map(project);
      const line=(a,b)=>{
        ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
      };
      ctx.lineCap='butt';ctx.lineWidth=1;
      const backSides=[];
      for (let axis=0;axis<3;axis++) {
        const probe=[0,0,0];probe[axis]=extents[axis];
        const back=project(probe)[2]>0?-extents[axis]:extents[axis];
        backSides[axis]=back;
        const others=[0,1,2].filter(i=>i!==axis);
        const facePoint=(u,v)=>{
          const p=[0,0,0];p[axis]=back;p[others[0]]=u;p[others[1]]=v;
          return project(p);
        };
        const u=extents[others[0]],v=extents[others[1]];
        const face=[facePoint(-u,-v),facePoint(u,-v),facePoint(u,v),facePoint(-u,v)];
        ctx.fillStyle='rgba(235,239,243,0.35)';ctx.beginPath();
        face.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
        ctx.closePath();ctx.fill();
      }
      ctx.strokeStyle='#aab3bd';ctx.lineWidth=1.2;
      const panelEdges=[[],[],[]];
      for (let i=0;i<8;i++) {
        for (let axis=0;axis<3;axis++) {
          const j=i^(1<<axis);
          if(i<j && [0,1,2].some(k=>k!==axis && corners[i][k]===backSides[k])) {
            line(projectedCorners[i],projectedCorners[j]);
            panelEdges[axis].push([projectedCorners[i],projectedCorners[j]]);
          }
        }
      }
      // Keep each PC label on a visible panel border.
      ctx.font='20px sans-serif';ctx.textAlign='center';ctx.fillStyle='#535e69';
      for(let axis=0;axis<3;axis++) {
        const [a,b]=panelEdges[axis].reduce((best,edge)=>
          edge[0][1]+edge[1][1]>best[0][1]+best[1][1]?edge:best);
        const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;
        const dx=x-width/2,dy=y-height*0.47,length=Math.hypot(dx,dy)||1;
        ctx.fillText(`PC${axis+1}`,Math.max(22,Math.min(width-22,x+20*dx/length)),Math.max(20,Math.min(height-32,y+20*dy/length+5)));
      }
      // Paint path segments and markers in depth order.
      const scene=[];
      for(const trajectory of trajectories) {
        const projected=trajectory.points.map(project);
        for(let i=1;i<projected.length;i++) {
          const a=projected[i-1],b=projected[i];
          scene.push({kind:'line',a,b,depth:(a[2]+b[2])/2,color:trajectory.color,width:trajectory.marker?3.5:4,alpha:trajectory.marker && i>=step?0.12:0.65});
        }
        if(trajectory.marker) projected.slice(0,step).forEach((p,i)=>scene.push({
          kind:trajectory.marker,p,depth:p[2],color:trajectory.color,
          size:i===step-1?9:6,current:i===step-1
        }));
      }
      for(const landmark of landmarks) {
        const p=project(landmark.point);
        scene.push({kind:'circle',p,depth:p[2],color:landmark.color,size:12});
      }
      scene.sort((a,b)=>a.depth-b.depth);
      for(const item of scene) {
        ctx.beginPath();ctx.fillStyle=item.color;ctx.strokeStyle=item.color;
        if(item.kind==='line') {
          ctx.globalAlpha=item.alpha;ctx.lineWidth=item.width;
          ctx.moveTo(item.a[0],item.a[1]);ctx.lineTo(item.b[0],item.b[1]);ctx.stroke();
        } else {
          ctx.globalAlpha=item.current?1:0.8;
          const [x,y]=item.p,r=item.size;
          if(item.kind==='square') ctx.rect(x-r,y-r,2*r,2*r);
          else if(item.kind==='triangle') {
            ctx.moveTo(x,y-r*1.3);ctx.lineTo(x+r,y+r);ctx.lineTo(x-r,y+r);ctx.closePath();
          } else ctx.arc(x,y,r,0,Math.PI*2);
          ctx.fill();
          if(item.current) {ctx.strokeStyle='white';ctx.lineWidth=2;ctx.stroke();}
        }
      }
      ctx.globalAlpha=1;
    }
    function tick(time) {
      frame=0;
      if (!playing || hovering || drag || !visible || document.hidden) {last=0;return;}
      if (time-last>40) {angle += last ? Math.min(time-last,100)*0.00012 : 0; last=time; draw();}
      frame=requestAnimationFrame(tick);
    }
    function syncProgress() {
      if(progressTimer!==null) clearInterval(progressTimer);
      progressTimer=null;
      if(!motion.matches && visible && !hovering && !drag && !document.hidden) {
        progressTimer=setInterval(()=>{
          slider.value=Number(slider.value)%stepCount+1;
          draw();
        },1000);
      }
    }
    slider.addEventListener('input',()=>{draw();syncProgress();});
    function sync() {
      syncProgress();
      if (frame) cancelAnimationFrame(frame);
      frame=0; last=0;
      if (playing && !hovering && !drag && visible && !document.hidden) frame=requestAnimationFrame(tick);
    }
    canvas.addEventListener('pointerenter',event=>{
      if (event.pointerType !== 'touch') {hovering=true;sync();}
    });
    canvas.addEventListener('pointerleave',()=>{hovering=false;sync();});
    canvas.addEventListener('pointerdown',event=>{
      if (drag || !event.isPrimary || event.button !== 0) return;
      drag={id:event.pointerId,x:event.clientX,y:event.clientY};
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add('is-dragging');
      sync();
    });
    canvas.addEventListener('pointermove',event=>{
      if (!drag || drag.id !== event.pointerId) return;
      const speed=2*Math.PI/Math.max(canvas.clientWidth,1);
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      angle+=dx*speed;
      tilt=Math.max(-Math.PI/2,Math.min(Math.PI/2,tilt+dy*speed));
      drag.x=event.clientX;drag.y=event.clientY;
      draw();
    });
    function endDrag(event) {
      if (!drag || drag.id !== event.pointerId) return;
      drag=null;
      canvas.classList.remove('is-dragging');
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      const bounds=canvas.getBoundingClientRect();
      hovering=event.type==='pointerup' && event.pointerType!=='touch' &&
        event.clientX>=bounds.left && event.clientX<=bounds.right &&
        event.clientY>=bounds.top && event.clientY<=bounds.bottom;
      sync();
    }
    for (const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event,endDrag);
    motion.addEventListener('change',()=>{playing=!motion.matches;sync();});
    document.addEventListener('visibilitychange',sync);
    new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync();}).observe(canvas);
    new ResizeObserver(draw).observe(canvas);
    figure.querySelector('.geometry-fallback').hidden=true;
    figure.querySelector('.geometry-live').hidden=false;
    draw(); sync();
  }).catch(() => { /* Keep the original GIF visible if data cannot load. */ });
})();
