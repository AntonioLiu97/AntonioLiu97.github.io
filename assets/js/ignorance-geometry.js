/* Real sampled PCA coordinates; see scripts/export_ignorance_geometry.py. */
(() => {
  const figure = document.querySelector('#ignorance-geometry');
  if (!figure) return;
  const canvas = figure.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let playing = !motion.matches, visible = false, frame = 0, last = 0, angle = 0;
  let tilt = 0.35, hovering = false, drag = null;
  fetch('assets/data/direction-of-ignorance.json').then(r => {
    if (!r.ok) throw new Error('Geometry unavailable');
    return r.json();
  }).then(data => {
    const points = data.points;
    // Frame the main cloud instead of letting a few distant tokens shrink it.
    const distances = points.map(p => Math.hypot(...p)).sort((a,b)=>a-b);
    const radius = distances[Math.floor(distances.length * 0.98)];
    const colors = data.ranks.map(r => `hsla(${280 * r},85%,55%,0.55)`);
    function draw() {
      const width = canvas.clientWidth;
      if (!width) return;
      const height = width / 1.5, dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = width * dpr; canvas.height = height * dpr;
      ctx.scale(dpr, dpr); ctx.clearRect(0, 0, width, height);
      const scale = height * 0.42 / radius;
      const project = p => {
        const x = p[0] * Math.cos(angle) + p[2] * Math.sin(angle);
        const z = -p[0] * Math.sin(angle) + p[2] * Math.cos(angle);
        const y = p[1] * Math.cos(tilt) - z * Math.sin(tilt);
        const depth = p[1] * Math.sin(tilt) + z * Math.cos(tilt);
        return [width/2 + scale*x, height*0.47 - scale*y, depth];
      };
      // PC-coordinate box: only the three back panes and their borders, behind
      // the scatter. Use the same projection so the box follows every drag.
      const half=radius*0.7;
      const extents=[2*half,half,half];
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
        // Orthogonal arrow projection onto this panel, clipped to its borders.
        // Construct the shadow in PC coordinates so it follows the box in 3D.
        const du=data.prior[others[0]],dv=data.prior[others[1]];
        const projectedLength=Math.hypot(du,dv);
        if(projectedLength>1e-6) {
          ctx.save();ctx.clip();
          const shadowPoint=(t,offset)=>facePoint(
            radius*(du*t-dv/projectedLength*offset),
            radius*(dv*t+du/projectedLength*offset)
          );
          const shadow=[shadowPoint(-0.9,0.025),shadowPoint(1.05,0.025),
            shadowPoint(1.05,0.075),shadowPoint(1.25,0),
            shadowPoint(1.05,-0.075),shadowPoint(1.05,-0.025),shadowPoint(-0.9,-0.025)];
          ctx.fillStyle='rgba(32,39,49,0.13)';ctx.beginPath();
          shadow.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
          ctx.closePath();ctx.fill();ctx.restore();
        }
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
      ctx.font='16px sans-serif';ctx.textAlign='center';ctx.fillStyle='#535e69';
      for(let axis=0;axis<3;axis++) {
        const [a,b]=panelEdges[axis].reduce((best,edge)=>
          edge[0][1]+edge[1][1]>best[0][1]+best[1][1]?edge:best);
        const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;
        const dx=x-width/2,dy=y-height*0.47,length=Math.hypot(dx,dy)||1;
        ctx.fillText(`PC${axis+1}`,Math.max(22,Math.min(width-22,x+20*dx/length)),Math.max(20,Math.min(height-32,y+20*dy/length+5)));
      }
      // Sort short shaft segments, a 3D cone, and scatter points together.
      // Nearby tokens can obscure the arrow, and its front portions obscure
      // distant tokens, rather than painting the whole arrow over the cloud.
      const scene=points.map((p,i)=>({kind:'point',p:project(p),i}));
      const along=t=>data.prior.map(v=>v*radius*t);
      const end=project(along(1.25));
      for (let i=0;i<80;i++) {
        const a=project(along(-0.9+1.95*i/80));
        const b=project(along(-0.9+1.95*(i+1)/80));
        scene.push({kind:'shaft',a,b,p:[0,0,(a[2]+b[2])/2]});
      }
      const d=data.prior;
      const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
      const normal=cross(d,Math.abs(d[1])<0.9?[0,1,0]:[1,0,0]);
      const u=normal.map(v=>v/Math.hypot(...normal)), v=cross(d,u);
      const ring=t=>project(d.map((n,i)=>radius*(1.05*n+0.075*(u[i]*Math.cos(t)+v[i]*Math.sin(t)))));
      for (let i=0;i<16;i++) {
        const a=ring(i*Math.PI/8), b=ring((i+1)*Math.PI/8);
        scene.push({kind:'head',a,b,p:[0,0,(a[2]+b[2]+end[2])/3]});
      }
      scene.sort((a,b)=>a.p[2]-b.p[2]);
      for (const item of scene) {
        ctx.beginPath();
        if (item.kind==='point') {
          ctx.fillStyle=colors[item.i];
          ctx.arc(item.p[0],item.p[1],2.5*Math.max(1.5,width/240),0,Math.PI*2);ctx.fill();
        } else if (item.kind==='shaft') {
          ctx.strokeStyle='#888888';ctx.lineWidth=8;ctx.lineCap='round';
          ctx.moveTo(item.a[0],item.a[1]);ctx.lineTo(item.b[0],item.b[1]);ctx.stroke();
        } else {
          ctx.fillStyle='#888888';
          ctx.moveTo(end[0],end[1]);ctx.lineTo(item.a[0],item.a[1]);ctx.lineTo(item.b[0],item.b[1]);ctx.closePath();ctx.fill();
        }
      }
      ctx.fillStyle='#202731';
      // Mathematical variable in italic, descriptive subscript in roman type.
      ctx.font='bold italic 28px Georgia, serif';
      const dWidth=ctx.measureText('d').width;
      ctx.font='bold 17px Georgia, serif';
      const labelWidth=dWidth+ctx.measureText('prior').width;
      const labelX=Math.max(8,Math.min(width-labelWidth-8,end[0]+14));
      const labelY=Math.max(30,Math.min(height-38,end[1]-14));
      ctx.textAlign='left';
      ctx.font='bold italic 28px Georgia, serif'; ctx.fillText('d',labelX,labelY);
      ctx.font='bold 17px Georgia, serif'; ctx.fillText('prior',labelX+dWidth,labelY+7);
      ctx.textAlign='center';
    }
    function tick(time) {
      frame=0;
      if (!playing || hovering || drag || !visible || document.hidden) {last=0;return;}
      if (time-last>40) {angle += last ? Math.min(time-last,100)*0.00012 : 0; last=time; draw();}
      frame=requestAnimationFrame(tick);
    }
    function sync() {
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
      angle+=(event.clientX-drag.x)*speed;
      tilt=Math.max(-Math.PI/2,Math.min(Math.PI/2,tilt+(event.clientY-drag.y)*speed));
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
    figure.querySelector('figcaption').textContent='A 3D view of panel a: 1,000 tokens in Llama-3.2-3B, colored by frequency rank. The arrow shows the projected prior direction; its length is illustrative. PCA is estimated from 8,000 embeddings.';
    draw(); sync();
  }).catch(() => { /* Keep the original panel a visible if data cannot load. */ });
})();
