/* Cached CPU attributions; no model inference or third-party calls in the browser. */
(() => {
  const root=document.querySelector('#jacobian-demo');
  if(!root)return;
  fetch('assets/data/jacobian-demo.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(data=>{
    const live=root.querySelector('.scope-live');
    const exampleSelect=root.querySelector('select');
    const scopeButtons=[...root.querySelectorAll('[data-scope]')];
    const targets=root.querySelector('.scope-targets');
    const prompt=root.querySelector('.scope-prompt');
    const readout=root.querySelector('.scope-readout');
    let exampleIndex=Math.max(0,data.examples.findIndex(example=>example.id===data.default_example)),scope='semantic',targetIndex=0;
    const explanations={
      semantic:'Which input tokens is this next-token logit most sensitive to?',
      fisher:'Which inputs affect the most sensitive direction of the predictive distribution?',
      temperature:'Which inputs affect the hidden-state norm, an effective inverse temperature?'
    };
    data.examples.forEach((example,i)=>{
      const option=document.createElement('option');option.value=i;option.textContent=example.label;exampleSelect.append(option);
    });
    exampleSelect.value=exampleIndex;
    function render(){
      const example=data.examples[exampleIndex];
      const selected=example.semantic[targetIndex];
      const scores=scope==='semantic'?selected.scores:example[scope];
      const maximum=Math.max(...scores);
      scopeButtons.forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.scope===scope)));
      root.querySelector('.scope-question').textContent=explanations[scope];
      targets.replaceChildren();
      root.querySelector('.scope-target-label').textContent=scope==='semantic'?'Select a next token':'Next-token predictions';
      example.semantic.forEach((entry,i)=>{
        const button=document.createElement('button');button.type='button';button.className='scope-target';
        const token=document.createElement('span');token.textContent=entry.token.trim()||JSON.stringify(entry.token);
        const probability=document.createElement('small');probability.textContent=entry.probability>0 && entry.probability<.001?'<0.1%':(100*entry.probability).toFixed(1)+'%';
        button.append(token,probability);
        button.setAttribute('aria-pressed',String(scope==='semantic'&&i===targetIndex));
        button.setAttribute('aria-label',`Explain token ${JSON.stringify(entry.token)}, probability ${(100*entry.probability).toFixed(2)} percent`);
        button.addEventListener('click',()=>{targetIndex=i;scope='semantic';render();targets.children[i].focus();});
        targets.append(button);
      });
      prompt.replaceChildren();
      example.tokens.forEach((token,i)=>{
        const strength=maximum?scores[i]/maximum:0;
        const button=document.createElement('button');button.type='button';button.className='scope-token';
        button.textContent=token;
        button.style.backgroundColor=`rgba(10,126,168,${(.04+.46*strength).toFixed(3)})`;
        button.style.color='#203540';
        const description=`Token ${i+1}: ${JSON.stringify(token)} · Relative sensitivity ${(100*strength).toFixed(1)}%`;
        button.title=description;button.setAttribute('aria-label',description);
        const inspect=()=>{readout.textContent=description;};
        button.addEventListener('pointerenter',inspect);button.addEventListener('focus',inspect);button.addEventListener('click',inspect);
        prompt.append(button);
      });
      readout.textContent='Hover or tap a token to inspect its sensitivity.';
      root.querySelector('.scope-example-note').textContent=example.id==='politics'
        ? 'A fictional prompt probes model associations; it does not establish anyone’s political views.' : '';
    }
    exampleSelect.addEventListener('change',()=>{exampleIndex=Number(exampleSelect.value);targetIndex=0;render();});
    scopeButtons.forEach(button=>button.addEventListener('click',()=>{scope=button.dataset.scope;render();}));
    render();root.querySelector('.scope-fallback').hidden=true;live.hidden=false;
    root.querySelector('.scope-caption').textContent='Cached Qwen2.5-0.5B examples, computed locally on CPU. Colors show sensitivity magnitude, scaled within each view—not whether a token supports or opposes a prediction. ';
  }).catch(()=>{ /* The original illustration remains available if the cache fails. */ });
})();
