"""Run from the remote LLMICL_inPCA repository; export the original notebook's
Gaussian sigma=0.1 comparison as JSON on stdout. Reads existing results only.
Uses the saved notebook setup, four-step averaging and Hellinger embedding.
"""
import contextlib
import io
import json
import os
from pathlib import Path
import numpy as np
root = Path.cwd()
notebook = json.loads((root / 'inPCA/inPCA_multi_traj.ipynb').read_text())
ns = {}
with contextlib.redirect_stdout(io.StringIO()):
    os.chdir(root / 'inPCA')
    for idx in [1, 3]:
        exec(''.join(notebook['cells'][idx]['source']), ns)
    names = ['uncorrelated_gaussian_centered_sigma_0.1_4.pkl',
             'uncorrelated_gaussian_centered_sigma_0.1_KDE_0.pkl',
             'uncorrelated_gaussian_centered_sigma_0.1_histogram_0.pkl']
    ns['all_files'] = [root / 'processed_series' / name for name in names]
    for idx in [4, 5, 10, 11, 12, 13, 15]:
        exec(''.join(notebook['cells'][idx]['source']), ns)
pdfs = ns['PDF_emb_list']
# The notebook's squared Hellinger distances equal squared Euclidean distances
# between sqrt(bin probability) vectors. Double centering yields 2 X X^T.
widths = pdfs[0].bin_width_arr
assert all(np.allclose(p.bin_width_arr, widths) for p in pdfs)
assert all(np.allclose(p.bin_center_arr, pdfs[0].bin_center_arr) for p in pdfs)
x = np.sqrt(np.array([p.bin_height_arr for p in pdfs]) * widths)
assert np.isfinite(x).all()
for i,j in [(0,200),(50,450),(600,659)]:
    assert np.isclose(np.linalg.norm(x[i]-x[j]),pdfs[i].Hel_dist(pdfs[j]))
x -= x.mean(axis=0)
sigma, vectors = np.linalg.eigh(2*x@x.T)
order = np.argsort(np.abs(sigma))[::-1]
sigma=sigma[order]
coords=vectors[:,order[:3]]*np.sqrt(np.abs(sigma[:3]))
# Resolve arbitrary eigenvector signs deterministically.
for axis in range(3):
    if coords[np.argmax(np.abs(coords[:,axis])),axis] < 0: coords[:,axis]*=-1
assert coords.shape==(719,3)
def points(a,b): return np.round(coords[a:b],6).tolist()
result={'method':'Original inPCA notebook: Hellinger distance, Gaussian sigma=0.1, four-step averaging; 200 steps per trajectory',
        'sources':names,'eigenvalues':sigma[:3].tolist(),
        'trajectories':[
          {'label':'LLaMA-2 70B','color':'#1f77b4','marker':'square','points':points(0,200)},
          {'label':'Gaussian KDE','color':'#ff0000','marker':'circle','points':points(200,400)},
          {'label':'Bayesian histogram','color':'#800080','marker':'triangle','points':points(400,600)},
          {'label':'Geodesic','color':'#555555','marker':None,'points':points(601,660)},
          {'label':'Gaussian manifold','color':'#f4a0a0','marker':None,'points':points(660,719)}],
        'landmarks':[{'label':'Ignorance','color':'#888888','point':coords[600].tolist()},
                     {'label':'Truth','color':'#0000ff','point':coords[659].tolist()}]}
print(json.dumps(result,separators=(',',':')))
