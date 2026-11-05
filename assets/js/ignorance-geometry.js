/* Real sampled PCA coordinates; see scripts/export_ignorance_geometry.py. */
(() => {
  const figure = document.querySelector('#ignorance-geometry');
  if (!figure) return;
  const canvas = figure.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let playing = !motion.matches, visible = false, frame = 0, last = 0, angle = 0;
  let tilt = 0.35, hovering = false, drag = null, rotationLocked = false, sliderDragging = false;
  let progressTimer = null;
  const slider = figure.querySelector('input');
  let selected = 0, progressDirection = 1;
  Promise.all(['direction-of-ignorance', 'ignorance-predictions'].map(name => fetch(`assets/data/${name}.json`).then(r => {
    if (!r.ok) throw new Error('Geometry unavailable');
    return r.json();
  }))).then(([data, predictions]) => {
    const points = data.points;
    // Frame the main cloud instead of letting a few distant tokens shrink it.
    const distances = points.map(p => Math.hypot(...p)).sort((a,b)=>a-b);
    const radius = distances[Math.floor(distances.length * 0.98)];
    const colors = data.ranks.map(r => `hsla(${280 * r},85%,55%,0.40)`);
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
      const d=data.prior;
      const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
      const normal=cross(d,Math.abs(d[1])<0.9?[0,1,0]:[1,0,0]);
      const u=normal.map(v=>v/Math.hypot(...normal)), v=cross(d,u);
      const loading=predictions.states[selected].prior_loading;
      const loadings=predictions.states.map(state=>state.prior_loading);
      // Preserve a full-size cone and a short shaft at the lowest loading.
      const displayFraction=0.22+0.78*(loading-Math.min(...loadings))/(Math.max(...loadings)-Math.min(...loadings));
      const componentT=-0.9+2.15*displayFraction;
      const componentTip=data.prior.map(n=>radius*componentT*n);
      const headLength=Math.min(0.34,2.15*displayFraction);
      const headRadius=0.24*Math.min(1,headLength/0.34);
      const componentRim=Array.from({length:24},(_,j)=>d.map((n,i)=>
        radius*((componentT-headLength)*n+headRadius*(u[i]*Math.cos(j*Math.PI/12)+v[i]*Math.sin(j*Math.PI/12)))));
      // Fill each cone's projected silhouette once, avoiding darker overlaps.
      const hull=points=>{
        const sorted=points.slice().sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
        const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
        const half=list=>{const out=[];for(const p of list){
          while(out.length>1&&turn(out[out.length-2],out[out.length-1],p)<=0)out.pop();
          out.push(p);
        }return out.slice(0,-1);};
        return half(sorted).concat(half(sorted.slice().reverse()));
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
        // Orthogonally project the same 3D cone used by the blue arrow.
        const shadow=hull([componentTip,...componentRim].map(p=>facePoint(p[others[0]],p[others[1]])));
        ctx.save();ctx.beginPath();
        face.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
        ctx.closePath();ctx.clip();
        ctx.fillStyle='rgba(25,105,163,0.18)';ctx.beginPath();
        shadow.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));
        ctx.closePath();ctx.fill();ctx.restore();
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
      // The displayed component uses a min-max stretch of measured loading:
      // the six prompt states span the full reference arrow.
      const componentEnd=project(along(componentT));
      const shaft=(start,stop,blue)=>{
        const a=project(along(start)), b=project(along(stop));
        scene.push({kind:'shaft',a,b,blue,p:[0,0,(a[2]+b[2])/2]});
      };
      for (let i=0;i<80;i++) {
        const start=-0.9+1.95*i/80, stop=-0.9+1.95*(i+1)/80;
        if(start<componentT && stop>componentT) {
          shaft(start,componentT,true);shaft(componentT,stop,false);
        } else shaft(start,stop,stop<=componentT);
      }
      const ring=t=>project(d.map((n,i)=>radius*(1.05*n+0.075*(u[i]*Math.cos(t)+v[i]*Math.sin(t)))));
      for (let i=0;i<16;i++) {
        const a=ring(i*Math.PI/8), b=ring((i+1)*Math.PI/8);
        scene.push({kind:'head',a,b,p:[0,0,(a[2]+b[2]+end[2])/3]});
      }
      // Broad 3D cone: protrudes across the cloud while its tip retains the
      // measured component length. Sort its faces with the token embeddings.
      for(let i=0;i<24;i++) {
        const a=project(componentRim[i]), b=project(componentRim[(i+1)%24]);
        scene.push({kind:'component-head',a,b,p:[0,0,(a[2]+b[2]+componentEnd[2])/3]});
      }
      scene.sort((a,b)=>a.p[2]-b.p[2]);
      for (const item of scene) {
        ctx.beginPath();
        if (item.kind==='point') {
          ctx.fillStyle=colors[item.i];
          ctx.arc(item.p[0],item.p[1],2.5*Math.max(1.5,width/240),0,Math.PI*2);ctx.fill();
        } else if (item.kind==='shaft') {
          ctx.strokeStyle=item.blue?'#2775aa':'#888888';ctx.lineWidth=item.blue?10:8;ctx.lineCap='butt';
          ctx.moveTo(item.a[0],item.a[1]);ctx.lineTo(item.b[0],item.b[1]);ctx.stroke();
        } else {
          const tip=item.kind==='component-head'?componentEnd:end;
          ctx.fillStyle=item.kind==='component-head'?'#1969a3':'#888888';
          ctx.moveTo(tip[0],tip[1]);ctx.lineTo(item.a[0],item.a[1]);ctx.lineTo(item.b[0],item.b[1]);ctx.closePath();ctx.fill();
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
      ctx.font='bold italic 30px Georgia, serif';
      const mainWidth=ctx.measureText('λd').width;
      ctx.font='bold 18px Georgia, serif';
      const componentLabelWidth=mainWidth+ctx.measureText('prior').width;
      const componentX=Math.max(16,Math.min(width-componentLabelWidth-16,componentEnd[0]+12));
      const componentY=Math.max(30,Math.min(height-38,componentEnd[1]+46));
      ctx.fillStyle='#155b91';
      ctx.font='bold italic 30px Georgia, serif';ctx.fillText('λd',componentX,componentY);
      ctx.font='bold 18px Georgia, serif';ctx.fillText('prior',componentX+mainWidth,componentY+6);
      ctx.textAlign='center';
    }
    function tick(time) {
      frame=0;
      if (!playing || hovering || drag || rotationLocked || !visible || document.hidden) {last=0;return;}
      if (time-last>40) {angle += last ? Math.min(time-last,100)*0.00012 : 0; last=time; draw();}
      frame=requestAnimationFrame(tick);
    }
    function sync() {
      if (frame) cancelAnimationFrame(frame);
      frame=0; last=0;
      if (progressTimer !== null) clearInterval(progressTimer);
      progressTimer=null;
      if (playing && visible && !document.hidden && !drag && !sliderDragging) {
        progressTimer=setInterval(()=>{
          if(selected===predictions.states.length-1) progressDirection=-1;
          else if(selected===0) progressDirection=1;
          slider.value=selected+progressDirection;
          selectContext();
        },1000);
      }
      if (playing && !hovering && !drag && !rotationLocked && visible && !document.hidden) frame=requestAnimationFrame(tick);
    }
    function selectContext() {
      selected=Number(slider.value);
      const state=predictions.states[selected];
      figure.querySelector('.prompt-context').textContent=state.context;
      figure.querySelector('output').textContent=`${selected+1} of ${predictions.states.length}`;
      figure.querySelector('.prediction-metrics').textContent=`Prior reliance: λ = ${state.prior_loading.toFixed(3)}`;
      slider.setAttribute('aria-valuetext',`${state.prompt}; prior loading ${state.prior_loading.toFixed(3)}`);
      canvas.setAttribute('aria-label',`3D token embeddings with gray prior arrow and a blue prior component with visually rescaled length and measured loading ${state.prior_loading.toFixed(3)} for “${state.prompt}”. Drag to rotate.`);
      draw();
    }
    // Once the reader attends to the prompts, keep their chosen camera view.
    // Prompt playback is independent of camera rotation and keyboard focus.
    function lockRotation() {rotationLocked=true;sync();}
    slider.addEventListener('pointerenter',lockRotation);
    slider.addEventListener('focus',lockRotation);
    slider.addEventListener('input',()=>{rotationLocked=true;selectContext();sync();});
    slider.addEventListener('pointerdown',()=>{rotationLocked=true;sliderDragging=true;sync();});
    function releaseSlider() {
      if (!sliderDragging) return;
      sliderDragging=false;sync();
    }
    document.addEventListener('pointerup',releaseSlider);
    document.addEventListener('pointercancel',releaseSlider);
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
    figure.querySelector('figcaption').textContent='1,000 token embeddings in three PCs. Blue shows the measured prior component λd_prior, computed in the full hidden space and then projected. Blue lengths are rescaled across the six prompts to span the gray arrow.';
    selectContext(); sync();
  }).catch(() => { /* Keep the original panel a visible if data cannot load. */ });
})();
