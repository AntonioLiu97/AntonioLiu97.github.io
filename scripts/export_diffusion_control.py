"""Run in the original diffusion_RNN checkout; write a reproducible figure to stdout.
Reads a pinned checkpoint without modifying the checkout. No training.
The common initial cloud and control grid are new visualization choices.
"""
import io
import json
import subprocess
from pathlib import Path
import numpy as np
import torch
from models.models import Model4  # required to unpickle the original model

torch.set_num_threads(4)
commit = 'ab5cb75a3f08327a82ac808d2b03eb9a4be814ef'
checkpoint = 'pretrained_models/Model4_cylinder_mobius_t_0.5_-1_1_alpha_1.pth'
raw = subprocess.check_output(['git', '-c', f'safe.directory={Path.cwd()}', 'show', f'{commit}:{checkpoint}'])
saved = torch.load(io.BytesIO(raw), map_location='cpu', weights_only=False)
model = saved['model'].eval()
dtype = next(model.parameters()).dtype
rng = np.random.default_rng(0)
initial = rng.normal(size=(1500, 3)) * 5
initial = initial[np.argsort(initial[:, 0])]
controls = np.linspace(-1, 1, 21)
frames = []
with torch.inference_mode():
    for control in controls:
        x = torch.tensor(initial, dtype=dtype)
        c = torch.full((len(x), 1), float(control), dtype=dtype)
        trajectory = [x.numpy().round(4).tolist()]
        for step in range(20):
            x = model(torch.cat([x, c], dim=1))
            trajectory.append(x.numpy().round(4).tolist())
        frames.append(trajectory)
json.dump(dict(controls=controls.round(2).tolist(), times=list(range(21)), frames=frames,
    provenance=dict(commit=commit, checkpoint=checkpoint, training_controls=saved['c_list'],
                    initial_seed=0, initial_sigma=5, points=1500, noise_at_inference=0,
                    description='Recomputed from original weights; visualization grid and initial cloud newly seeded.')),
    __import__('sys').stdout, separators=(',', ':'))
