/* Discrete cached predictions, exported by scripts/export_scaling_snapshots.py. */
(() => {
  const figure=document.querySelector('#scaling-snapshots');
  if(!figure) return;
  const live=figure.querySelector('.scaling-live');
  const slider=figure.querySelector('input');
  const output=figure.querySelector('output');
  const state=figure.querySelector('.current-state');
  const modelLabel=figure.querySelector('.model-label');
  const sequence=figure.querySelector('.sequence-plot');
  const density=figure.querySelector('.density-plot');
  const scaling=figure.querySelector('.scaling-curve');
  const ns='http://www.w3.org/2000/svg';
  const colors={selected:'#db4b4b',prediction:'#3789c9',truth:'#db4b4b'};
  function add(svg,tag,attrs,text) {
    const el=document.createElementNS(ns,tag);
    for(const [key,value] of Object.entries(attrs)) el.setAttribute(key,String(value));
    if(text!==undefined) el.textContent=text;
    svg.appendChild(el);return el;
  }
  function path(svg,points,color,width=2) {
    return add(svg,'path',{d:points.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' '),fill:'none',stroke:color,'stroke-width':width,'stroke-linejoin':'round'});
  }
  function text(svg,x,y,value,anchor='middle',size=13) {
    return add(svg,'text',{x,y,'text-anchor':anchor,'font-size':size,fill:'#56616c'},value);
  }
  function load(url) {
    return fetch(url).then(r=>{
      if(!r.ok) throw new Error('Snapshots unavailable');
      return r.json();
    });
  }
  Promise.all([load('assets/data/scaling-noisy-logistic.json'),load('assets/data/scaling-curves.json')]).then(datasets=>{
    const data=datasets[0];
    data.aggregate=datasets[1]['noisy-logistic'];
    if(!data.frames.length) throw new Error('No snapshots');
    const peak=Math.max(...data.frames.map(f=>Math.max(
      ...f.bins.map(b=>b[2]),f.sigma>0?1/(f.sigma*Math.sqrt(2*Math.PI)):0)));
    data.densityMax=Math.max(10,10**Math.ceil(Math.log10(peak)));
    slider.max=data.frames.length-1;
    function draw() {
      const index=Math.max(0,Math.min(data.frames.length-1,Number(slider.value)));
      const frame=data.frames[index],n=frame.context;
      state.textContent=data.series[n-1].toFixed(2);
      modelLabel.textContent=`${data.model} prediction`;
      output.textContent=n===986?'≈1,000':n.toLocaleString();
      output.title=n===986?'Rounded display; the original cached snapshot contains 986 observations.':`${n} observations`;
      slider.setAttribute('aria-valuetext',`${n} in-context ${n===1?'observation':'observations'}`);
      const width=live.clientWidth;
      if(!width) return;
      const left=44,right=12,plotWidth=width-left-right;
      sequence.replaceChildren();
      sequence.setAttribute('viewBox',`0 0 ${width} 150`);
      add(sequence,'title',{},`Noisy logistic-map states: ${n} observations in context; the next state is highlighted in red.`);
      const sx=i=>left+i/(data.series.length-1)*plotWidth;
      const sy=v=>112-(v-1)/8*100;
      for(const value of [2,5,8]) {
        text(sequence,left-9,sy(value)+4,value,'end');
        path(sequence,[[left,sy(value)],[width-right,sy(value)]],'#edf0f3',1);
      }
      path(sequence,[[left,12],[left,112],[width-right,112]],'#aab3bd',1);
      for(const i of (width<380?[0,500,999]:[0,250,500,750,999])) text(sequence,sx(i),132,i);
      text(sequence,left+plotWidth/2,148,'Observation index','middle',14);
      // Discrete states only: no connecting trajectory lines.
      data.series.forEach((value,i)=>{
        if(i===n) return;
        add(sequence,'circle',{cx:sx(i),cy:sy(value),r:1.5,
          fill:i<n?'#303943':'#b8c3ce','fill-opacity':i<n?0.75:0.45});
      });
      add(sequence,'circle',{cx:sx(n),cy:sy(data.series[n]),r:5,fill:colors.selected,stroke:'white','stroke-width':1.5});

      density.replaceChildren();
      const height=195,top=14,bottom=154;
      density.setAttribute('viewBox',`0 0 ${width} ${height}`);
      add(density,'title',{},`${data.model} predicted density and true transition rule given rescaled x_t = ${data.series[n-1].toFixed(2)}, after ${n} observations. Logarithmic density scale.`);
      const dx=v=>left+v/10*plotWidth;
      const min=0.005,max=data.densityMax;
      const dy=v=>bottom-(Math.log10(Math.max(min,Math.min(max,v)))-Math.log10(min))/(Math.log10(max)-Math.log10(min))*(bottom-top);
      for(const value of [0.01,0.1,1,10,100,1000].filter(v=>v<=max)) {
        text(density,left-9,dy(value)+4,value,'end');
        path(density,[[left,dy(value)],[width-right,dy(value)]],'#edf0f3',1);
      }
      for(const [center,binWidth,prob] of frame.bins) {
        const x0=dx(Math.max(0,center-binWidth/2)),x1=dx(Math.min(10,center+binWidth/2));
        if(x1>x0 && prob>min) add(density,'rect',{x:x0,y:dy(prob),width:x1-x0,height:bottom-dy(prob),fill:colors.prediction,'fill-opacity':0.72});
      }
      // Sample densely around the true mean so the narrow Gaussian stays smooth.
      const samples=Array.from({length:401},(_,i)=>Math.max(0,frame.mean-5*frame.sigma)+i/400*(Math.min(10,frame.mean+5*frame.sigma)-Math.max(0,frame.mean-5*frame.sigma)));
      if(frame.sigma>0) path(density,samples.map(x=>[dx(x),dy(Math.exp(-0.5*((x-frame.mean)/frame.sigma)**2)/(frame.sigma*Math.sqrt(2*Math.PI)))]),colors.truth,2.7);
      else path(density,[[dx(frame.mean),bottom],[dx(frame.mean),top]],colors.truth,2.7);
      path(density,[[left,top],[left,bottom],[width-right,bottom]],'#aab3bd',1);
      for(const value of [0,2,4,6,8,10]) text(density,dx(value),bottom+20,value);
      text(density,left+plotWidth/2,height-2,'Next state (rescaled x)','middle',14);
      const aggregate=data.aggregate;
      scaling.replaceChildren();
      scaling.setAttribute('viewBox',`0 0 ${width} 200`);
      scaling.setAttribute('aria-label',`${data.label}: mean Bhattacharyya loss over ${aggregate.runs} runs, highlighted at ${n} observations.`);
      add(scaling,'title',{},`${data.label} aggregate scaling curve; selected context ${n}.`);
      const lossLow=Math.log10(0.06);
      const lossHigh=Math.log10(1.8);
      const cx=v=>left+Math.log10(v)/3*plotWidth;
      const cy=v=>156-(Math.log10(v)-lossLow)/(lossHigh-lossLow)*140;
      for(const value of [0.1,0.2,0.5,1]) {
        text(scaling,left-9,cy(value)+4,Number(value.toPrecision(2)),'end');
        path(scaling,[[left,cy(value)],[width-right,cy(value)]],'#edf0f3',1);
      }
      path(scaling,[[left,16],[left,156],[width-right,156]],'#aab3bd',1);
      for(const context of [1,10,100,1000]) text(scaling,cx(context),177,context===1000?'1,000':context,context===1000?'end':'middle');
      text(scaling,left+plotWidth/2,198,'In-context observations','middle',14);
      const curve=aggregate.context.map((context,i)=>[cx(context),cy(aggregate.loss[i])]);
      path(scaling,curve,'#c5d8e8',2);
      path(scaling,curve.filter((_,i)=>aggregate.context[i]<=n),colors.prediction,2.5);
      const selected=aggregate.context.indexOf(n);
      if(selected>=0) {
        const x=cx(n),y=cy(aggregate.loss[selected]);
        add(scaling,'line',{x1:x,x2:x,y1:16,y2:156,stroke:colors.selected,'stroke-opacity':0.45,'stroke-dasharray':'3 4'});
        add(scaling,'circle',{cx:x,cy:y,r:5,fill:colors.selected,stroke:'white','stroke-width':1.5});
      }

    }
    let timer=null,visible=false;
    function syncPlayback() {
      if(timer!==null) clearInterval(timer);
      timer=null;
      if(visible && !document.hidden) {
        timer=setInterval(()=>{
          slider.value=(Number(slider.value)+1)%data.frames.length;
          draw();
        },1000);
      }
    }
    slider.addEventListener('input',()=>{draw();syncPlayback();});
    document.addEventListener('visibilitychange',syncPlayback);
    new IntersectionObserver(entries=>{
      visible=entries[0].isIntersecting;syncPlayback();
    }).observe(figure);
    new ResizeObserver(draw).observe(live);
    figure.querySelector('.scaling-fallback').hidden=true;
    live.hidden=false;draw();
  }).catch(()=>{ /* Retain the original animation if the snapshot data fails. */ });
})();
