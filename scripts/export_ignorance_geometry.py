"""Run with NumPy in the remote research directory; writes browser data to stdout.
Uses the figure notebook's cached Llama-3.2-3B weights, prior and Pile frequencies.
Fits approximate top-three PCs to a seeded 8,000-row sample; exports 1,000
frequency-stratified tokens. No model loading, GPU use, or cache mutation.
"""
import json
from pathlib import Path
import numpy as np
root = Path('data')
w = np.load(root / 'fig2_cache/panelA_Wout_meta-llama__Llama-3.2-3B_float32.npy', mmap_mode='r')
p = np.load(root / 'token_stats/tokenizer__vocab128256__edb55f9b5904__monology__pile-uncopyrighted__token_probs.npz')['probs']
d = np.load(root / 'fig2_cache/panelA_meta-llama__Llama-3.2-3B_N200_T300.npz')['d_hat']
rng = np.random.default_rng(0)
x = np.array(w[rng.choice(len(w), 8000, replace=False)], dtype=np.float32)
mean = x.mean(axis=0)
x -= mean
q = rng.standard_normal((w.shape[1], 12)).astype(np.float32)
for _ in range(12):
    q, _ = np.linalg.qr(x.T @ (x @ q))
_, singular, vt = np.linalg.svd(x @ q, full_matrices=False)
basis = q @ vt[:3].T
prior = d @ basis
# Orient PC1 so increasing frequency points right, like panel a.
basis[:, 0] *= 1 if prior[0] >= 0 else -1
prior = d @ basis
ids = np.flatnonzero(p > 0)
ids = ids[np.argsort(p[ids])[::-1]]
# Preserve the original frequency grid while downsampling the displayed tokens.
ranks = np.linspace(0, len(ids)-1, 4000).astype(int)
ranks = ranks[np.array([i * 3999 // 999 for i in range(1000)])
coords = (np.asarray(w[ids[ranks]]) - mean) @ basis
assert np.isfinite(coords).all() and np.linalg.norm(prior) > 0
print(json.dumps({'model':'Llama-3.2-3B','method':'Sampled PCA (8,000 embeddings, seed 0); 1,000 frequency-stratified tokens', 'points':np.round(coords,5).tolist(), 'ranks':np.round(ranks/(len(ids)-1),5).tolist(), 'prior':np.round(prior/np.linalg.norm(prior),6).tolist(), 'variance':np.round(singular[:3]**2/(x*x).sum(),5).tolist()},separators=(',',':')))
