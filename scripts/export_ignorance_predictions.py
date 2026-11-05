"""Run from the remote research root with this script's directory on sys.path.

Uses the existing offline model on CPU for six forward passes. Writes JSON to
stdout, including raw states and the exact website PCA basis for reproducibility.
No remote files are created. Browser data can omit raw_states and basis.
"""
import json
import sys
import numpy as np
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer
from export_ignorance_geometry import basis, d, root, geometry

torch.set_num_threads(4)
name = 'meta-llama/Llama-3.2-3B'
tokenizer = AutoTokenizer.from_pretrained(name, local_files_only=True)
model = AutoModelForCausalLM.from_pretrained(
    name, local_files_only=True, torch_dtype=torch.float32,
    attn_implementation='eager',
).eval()
cache = np.load(root / 'fig2_cache/panelA_meta-llama__Llama-3.2-3B_N200_T300.npz')
beta = float(cache['beta_star'])
prior = d / np.linalg.norm(d)
projected_prior = prior @ basis
projected_prior /= np.linalg.norm(projected_prior)
contexts = ['In this world', 'On Earth', 'In Europe', 'In France', 'In Paris', 'In the Louvre']
states, raw = [], []
for context in contexts:
    prompt = context + ', we can find the'
    ids = tokenizer.encode(prompt, add_special_tokens=True)
    with torch.inference_mode():
        y = model.model(torch.tensor([ids]), use_cache=False).last_hidden_state[0, -1].float().numpy()
    # These are vectors, not embedding points: do NOT subtract the PCA mean.
    projection = y @ basis
    direction = projection / np.linalg.norm(projection)
    norm = np.linalg.norm(y)
    state = dict(context=context, prompt=prompt, token_ids=ids,
                 direction=direction.tolist(), projection=projection.tolist(),
                 prior_loading=float(y @ prior / beta),
                 full_cosine=float(y @ prior / norm),
                 projected_cosine=float(direction @ projected_prior),
                 retained_norm_fraction=float(np.linalg.norm(projection) / norm))
    states.append(state)
    raw.append(y.tolist())
    print(context, 'lambda=', state['prior_loading'], 'PCA cosine=', state['projected_cosine'], file=sys.stderr)
print(json.dumps(dict(model=name, dtype='float32', device='cpu',
    projection_method='y @ basis; normalize after projection; no mean subtraction',
    states=states, raw_states=raw, basis=basis.tolist(), reference_geometry=geometry), separators=(',', ':')))
