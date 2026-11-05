/* Penumbral Poincare-ball cones, curvature -1.
 * Yu et al., ICLR 2024, Section 3.2 / Formulation 3:
 * https://arxiv.org/html/2305.15215v3#S3.SS2
 * Source Euclidean radius a corresponds to hyperbolic radius 2 atanh(a).
 * Mobius translation gives the geodesic's tangent direction at the apex.
 */
(() => {
  const sourceRadius=0.2, minRadius=sourceRadius+0.012, maxRadius=0.965;
  const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];
  const norm=p=>Math.hypot(...p);
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  function add(a,b) {
    const ab=dot(a,b), aa=dot(a,a), bb=dot(b,b), denominator=1+2*ab+aa*bb;
    return a.map((v,i)=>((1+2*ab+bb)*v+(1-aa)*b[i])/denominator);
  }
  function aperture(p) {
    const r=norm(p);
    return Math.asin(clamp(sourceRadius*(1-r*r)/((1-sourceRadius*sourceRadius)*r),0,1));
  }
  function contains(parent,child) {
    if(norm([parent[0]-child[0],parent[1]-child[1]])<1e-9) return true;
    const tangent=add(parent.map(v=>-v),child);
    return dot(parent,tangent)/(norm(parent)*norm(tangent))>=Math.cos(aperture(parent))-1e-10;
  }
  function relation(a,b) {
    if(norm([a[0]-b[0],a[1]-b[1]])<1e-9) return '=';
    return contains(a,b)?'≼':contains(b,a)?'≽':'∥';
  }
  function constrain(p,previous) {
    const r=norm(p), direction=r>1e-9?p:previous;
    return direction.map(v=>v/norm(direction)*clamp(r,minRadius,maxRadius));
  }
  function boundary(p,side,t) {
    const angle=Math.atan2(p[1],p[0])+side*aperture(p);
    return add(p,[t*Math.cos(angle),t*Math.sin(angle)]);
  }

  const figure=document.querySelector('#shadow-cone-geometry');
  if(!figure) return;
  const svg=figure.querySelector('svg');
  const initial={u:[-0.29,0.075],v:[-0.49,0.09],w:[-0.56,-0.31],x:[0.26,-0.05],y:[0.32,0.13],z:[0.86,0.17]};
  const names=Object.keys(initial), points=Object.fromEntries(names.map(n=>[n,initial[n].slice()]));
  const pairs=[['u','v'],['u','w'],['v','w'],['x','z'],['y','z'],['x','y']];
  const ns='http://www.w3.org/2000/svg';
  const make=(tag,attrs,parent=svg)=>{
    const el=document.createElementNS(ns,tag);
    for(const [key,value] of Object.entries(attrs)) el.setAttribute(key,value);
    parent.appendChild(el);return el;
  };
  const xy=p=>[250+220*p[0],250+220*p[1]];
  const path=list=>list.map((p,i)=>`${i?'L':'M'}${xy(p).join(',')}`).join(' ');
  let selected='z', drag=null, lastRelations='';
  make('circle',{cx:250,cy:250,r:220,fill:'#fff',stroke:'#333e48','stroke-width':2});
  const shadows=make('g',{'aria-hidden':'true'}), rays=make('g',{'aria-hidden':'true'});
  const shapes={};
  for(const name of names) {
    shapes[name]={fill:make('path',{},shadows),edge:make('path',{},shadows),ray:make('path',{},rays)};
  }
  make('circle',{cx:250,cy:250,r:220*sourceRadius,fill:'#ffd6cf',stroke:'#e45c51','stroke-width':2});
  const sourceLabel=make('text',{x:250,y:261,'text-anchor':'middle',fill:'#d44136','font-size':32,'font-style':'italic','font-family':'Georgia, serif'});
  sourceLabel.textContent='S';
  const nodes={};
  for(const name of names) {
    const group=make('g',{'data-point':name,tabindex:0,role:'button','aria-label':`Embedding ${name}. Drag or use arrow keys to move.`,class:'embedding-node'});
    make('circle',{r:20,fill:'transparent'},group);
    const ring=make('circle',{r:12,fill:'none',stroke:'#1d72b8','stroke-width':2},group);
    make('circle',{r:6.5,fill:'#1874d1',stroke:'white','stroke-width':1.5},group);
    const label=make('text',{'font-size':25,'font-family':'Georgia, serif','font-style':'italic',fill:'#1266b2','pointer-events':'none'},group);
    label.textContent=name;
    nodes[name]={group,ring,label};
  }
  const relationElements=pairs.map(([a,b])=>{
    const el=document.createElement('span');el.className='shadow-relation';
    figure.querySelector('.shadow-relations').appendChild(el);return el;
  });
  function render() {
    for(const name of names) {
      const p=points[name], left=[],right=[];
      for(let j=0;j<=48;j++) {
        left.push(boundary(p,-1,j/48));right.push(boundary(p,1,j/48));
      }
      const start=Math.atan2(left[48][1],left[48][0]);
      const end=Math.atan2(right[48][1],right[48][0]);
      const sweep=((end-start+3*Math.PI)%(2*Math.PI))-Math.PI;
      const rim=Array.from({length:33},(_,j)=>[Math.cos(start+sweep*j/32),Math.sin(start+sweep*j/32)]);
      shapes[name].fill.setAttribute('d',path([...left,...rim,...right.slice().reverse()])+' Z');
      shapes[name].fill.setAttribute('fill',name===selected?'rgba(69,127,176,0.15)':'rgba(55,69,80,0.08)');
      shapes[name].edge.setAttribute('d',path(left)+' '+path(right));
      shapes[name].edge.setAttribute('fill','none');
      shapes[name].edge.setAttribute('stroke',name===selected?'#3982b5':'#83ad62');
      shapes[name].edge.setAttribute('stroke-width',name===selected?2.2:1.5);
      // Tangency is reached after distance s, cosh(s)=cosh(d(O,p))/cosh(R).
      const r2=dot(p,p), coshD=(1+r2)/(1-r2), coshR=(1+sourceRadius**2)/(1-sourceRadius**2);
      const t=-Math.tanh(Math.acosh(coshD/coshR)/2);
      const incoming=side=>Array.from({length:33},(_,j)=>boundary(p,side,t*j/32));
      shapes[name].ray.setAttribute('d',path(incoming(-1))+' '+path(incoming(1)));
      shapes[name].ray.setAttribute('fill','none');
      shapes[name].ray.setAttribute('stroke','#e9776d');
      shapes[name].ray.setAttribute('stroke-width',1.2);
      shapes[name].ray.setAttribute('stroke-dasharray','3 4');
      shapes[name].ray.setAttribute('opacity',name===selected?0.9:0.35);
      nodes[name].group.setAttribute('transform',`translate(${xy(p).join(',')})`);
      nodes[name].group.setAttribute('aria-pressed',String(name===selected));
      nodes[name].ring.setAttribute('visibility',name===selected?'visible':'hidden');
      nodes[name].label.setAttribute('x',p[0]>0.8?-15:12);
      nodes[name].label.setAttribute('y',p[1]<-0.8?24:-12);
      nodes[name].label.setAttribute('text-anchor',p[0]>0.8?'end':'start');
    }
    const relations=pairs.map(([a,b],i)=>{
      const symbol=relation(points[a],points[b]);
      relationElements[i].innerHTML=`<i>${a}</i> ${symbol} <i>${b}</i>`;
      const description=symbol==='∥'?`${a} and ${b} are incomparable`:symbol==='='?`${a} and ${b} coincide`:symbol==='≼'?`${a} is an ancestor of ${b}`:`${b} is an ancestor of ${a}`;
      relationElements[i].setAttribute('aria-label',description);
      relationElements[i].classList.toggle('is-comparable',symbol!=='∥');
      return `${a} ${symbol} ${b}`;
    }).join('; ');
    // Announce only actual boundary crossings, not every pointer movement.
    if(relations!==lastRelations) {
      figure.querySelector('.shadow-status').textContent=relations;
      lastRelations=relations;
    }
  }
  function move(p) {points[selected]=constrain(p,points[selected]);render();}
  function pointerPosition(event) {
    const matrix=svg.getScreenCTM();
    if(!matrix) return null;
    const p=svg.createSVGPoint();p.x=event.clientX;p.y=event.clientY;
    const local=p.matrixTransform(matrix.inverse());
    return [(local.x-250)/220,(local.y-250)/220];
  }
  svg.addEventListener('pointerdown',event=>{
    if(drag!==null || !event.isPrimary || event.button!==0) return;
    const hit=event.target.closest('[data-point]');
    const p=pointerPosition(event);if(!p) return;
    if(!hit && (norm(p)>maxRadius || norm(p)<minRadius)) return;
    if(hit) selected=hit.getAttribute('data-point');
    event.preventDefault();nodes[selected].group.focus({preventScroll:true});
    drag=event.pointerId;svg.setPointerCapture(drag);svg.classList.add('is-dragging');
    if(hit) render();else move(p);
  });
  svg.addEventListener('pointermove',event=>{
    if(drag!==event.pointerId) return;
    const p=pointerPosition(event);if(p) move(p);
  });
  function release(event) {
    if(drag!==event.pointerId) return;
    drag=null;svg.classList.remove('is-dragging');
    if(svg.hasPointerCapture(event.pointerId))svg.releasePointerCapture(event.pointerId);
  }
  for(const name of ['pointerup','pointercancel','lostpointercapture']) svg.addEventListener(name,release);
  for(const name of names) {
    nodes[name].group.addEventListener('focus',()=>{selected=name;render();});
    nodes[name].group.addEventListener('keydown',event=>{
      const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
      if(!delta)return;
      event.preventDefault();selected=name;
      move(points[name].map((v,i)=>v+delta[i]*(event.shiftKey?0.04:0.012)));
    });
  }
  figure.querySelector('button').addEventListener('click',()=>{
    for(const name of names)points[name]=initial[name].slice();
    selected='z';render();
  });
  render();
  figure.querySelector('.shadow-fallback').hidden=true;
  figure.querySelector('.shadow-live').hidden=false;
})();
