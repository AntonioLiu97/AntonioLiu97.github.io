/* Original MNIST VAE and diffusion RNN trajectories; see scripts/export_diffusion_geometry.py. */
(() => {
  const figure = document.querySelector('#diffusion-geometry');
  if (!figure) return;
  const canvas = figure.querySelector('canvas');
  const slider=figure.querySelector('input');
  const progress=figure.querySelector('output');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let playing = !motion.matches, visible = false, frame = 0, last = 0, angle = 0.7;
  let tilt = Math.PI / 6, hovering = false, drag = null;
  let progressTimer=null, progressDirection=1, sliderDragging=false;
  fetch(figure.dataset.source || 'assets/data/diffusion-geometry.json').then(r => {
    if (!r.ok) throw new Error('Geometry unavailable');
    return r.json();
  }).then(data => {
    const allPoints=data.reference.concat(...data.frames);
    const lower=[0,1,2].map(i=>allPoints.reduce((min,p)=>Math.min(min,p[i]),Infinity));
    const upper=[0,1,2].map(i=>allPoints.reduce((max,p)=>Math.max(max,p[i]),-Infinity));
    const center=lower.map((v,i)=>(v+upper[i])/2);
    const centered=p=>p.map((v,i)=>v-center[i]);
    const reference=data.reference.map(centered);
    const states=data.frames.map(points=>points.map(centered));
    const stepCount=states.length;
    const boundaries=[0,6,14,70,80];
    const keyframes=[3,9,18,80];
    // Each visual regime occupies one quarter of the slider, despite unequal
    // recurrent-time ranges. Data remain in their original time coordinates.
    const timeAt=position=>{
      const i=Math.min(3,Math.floor(position));
      return boundaries[i]+(boundaries[i+1]-boundaries[i])*(position-i);
    };
    const positionAt=time=>{
      const i=Math.min(3,boundaries.findIndex((end,index)=>index>0 && time<=end)-1);
      return i+(time-boundaries[i])/(boundaries[i+1]-boundaries[i]);
    };
    slider.max=4;slider.step='any';slider.value=positionAt(3);
    const radius=allPoints.reduce((max,p)=>Math.max(max,Math.hypot(...centered(p))),0);
    // Frame the main cloud; keep the box inside the canvas at every angle.
    const boxExtents=lower.map((v,i)=>(upper[i]-v)*0.205);
    const digitColors={0:'rgba(31,119,180,0.045)',1:'rgba(255,127,14,0.045)',2:'rgba(44,160,44,0.045)',7:'rgba(127,127,127,0.045)'};
    function draw() {
      const step=Math.max(0,Math.min(stepCount-1,timeAt(Number(slider.value))));
      const time=Number(step.toFixed(2));
      const lo=Math.floor(step), hi=Math.min(stepCount-1,lo+1), fraction=step-lo;
      const regime=time<6?'3D volume':time<14?'2D sheets':time<70?'1D lines':'0D fixed points';
      progress.textContent=`t = ${time} · ${regime}`;
      slider.setAttribute('aria-valuetext',`Recurrent time ${time} of ${data.times[stepCount-1]}, ${regime}${fraction?", interpolated between computed steps":""}`);
      const width = canvas.clientWidth;
      if (!width) return;
      const height = width / 1.5, dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = width * dpr; canvas.height = height * dpr;
      ctx.scale(dpr, dpr); ctx.clearRect(0, 0, width, height);
      const scale = height * 0.85 / radius;
      const project = p => {
        // Azimuth rotates around the third latent axis.
        const x = p[0] * Math.cos(angle) + p[1] * Math.sin(angle);
        const baseDepth = -p[0] * Math.sin(angle) + p[1] * Math.cos(angle);
        const y = p[2] * Math.cos(tilt) - baseDepth * Math.sin(tilt);
        const depth = p[2] * Math.sin(tilt) + baseDepth * Math.cos(tilt);
        return [width/2 + scale*x, height*0.47 - scale*y, depth];
      };
      // Latent-coordinate box: only the three back panes and their borders, behind
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
      // Keep each latent-axis label on a visible panel border.
      ctx.font='16px sans-serif';ctx.textAlign='center';ctx.fillStyle='#535e69';
      for(let axis=0;axis<3;axis++) {
        const [a,b]=panelEdges[axis].reduce((best,edge)=>
          edge[0][1]+edge[1][1]>best[0][1]+best[1][1]?edge:best);
        const x=(a[0]+b[0])/2,y=(a[1]+b[1])/2;
        const dx=x-width/2,dy=y-height*0.47,length=Math.hypot(dx,dy)||1;
        ctx.fillText(data.axis_labels[axis],Math.max(22,Math.min(width-22,x+20*dx/length)),Math.max(20,Math.min(height-32,y+20*dy/length+5)));
      }
      // Static digit embeddings and evolving states share the original VAE
      // coordinates and camera; no new PCA or per-frame rescaling is applied.
      const scene=reference.map((p,i)=>({p:project(p),color:digitColors[data.labels[i]],size:1.7}));
      states[lo].forEach((p,i)=>{
        const position=fraction?p.map((v,j)=>v+(states[hi][i][j]-v)*fraction):p;
        scene.push({p:project(position),color:'rgba(224,51,54,0.70)',size:2.4});
      });
      scene.sort((a,b)=>a.p[2]-b.p[2]);
      for(const item of scene) {
        ctx.beginPath();ctx.fillStyle=item.color;
        ctx.arc(item.p[0],item.p[1],item.size*Math.max(0.85,width/500),0,Math.PI*2);ctx.fill();
      }
    }
    function tick(time) {
      frame=0;
      if (!playing || hovering || drag || !visible || document.hidden) {last=0;return;}
      if (time-last>40) {angle += last ? Math.min(time-last,100)*0.00012 : 0; last=time; draw();}
      frame=requestAnimationFrame(tick);
    }
    function syncProgress() {
      if(progressTimer!==null) clearTimeout(progressTimer);
      progressTimer=null;
      if(motion.matches || !visible || drag || sliderDragging || document.hidden)return;
      const start=timeAt(Number(slider.value));
      if(start>=80)progressDirection=-1;
      else if(start<=0)progressDirection=1;
      const target=progressDirection>0
        ? keyframes.find(t=>t>start+1e-6)
        : [0,...keyframes].reverse().find(t=>t<start-1e-6);
      const hold=keyframes.some(t=>Math.abs(t-start)<1e-6)?2000:0;
      progressTimer=setTimeout(()=>{
        const began=performance.now();
        function advance() {
          const fraction=Math.min(1,(performance.now()-began)/1000);
          slider.value=positionAt(start+(target-start)*fraction);
          draw();
          if(fraction<1)progressTimer=setTimeout(advance,1000/30);
          else syncProgress();
        }
        advance();
      },hold);
    }
    slider.addEventListener('input',()=>{draw();syncProgress();});
    slider.addEventListener('pointerdown',()=>{sliderDragging=true;syncProgress();});
    const releaseSlider=()=>{if(sliderDragging){sliderDragging=false;sync();}};
    document.addEventListener('pointerup',releaseSlider);
    document.addEventListener('pointercancel',releaseSlider);
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
