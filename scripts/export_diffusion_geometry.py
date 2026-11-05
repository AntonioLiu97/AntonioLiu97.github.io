"""Run from the recovered diffusion_RNN checkout; JSON goes to stdout only.

Reproduces visual/mnist_diffusion_plot_dynamics.ipynb for digits 0,1,2,7,
alpha=1, beta=0, 3,000 initial states and 80 recurrent updates. Reads original
checkpoints from Git without restoring files or retraining. VAE sampling is
seeded here (the plotting notebook did not fix its torch seed).
Exports all 3,000 trajectories and 5,000 background embeddings per digit.
"""
import io
import json
from pathlib import Path
import subprocess
import sys

import numpy as np
import torch

sys.path.insert(0, str(Path.cwd()))
from models.vae_model import VAE  # noqa: F401; needed by checkpoint unpickling
from models.models import Model4_float  # noqa: F401

torch.set_num_threads(4)
torch.manual_seed(0)
root = Path.cwd()
commit = 'ab5cb75a3f08327a82ac808d2b03eb9a4be814ef'


def checkpoint(name):
    raw = subprocess.check_output([
        'git', '-c', f'safe.directory={root}', 'show',
        f'{commit}:pretrained_models/{name}.pth',
    ])
    # These are the user's original model objects, not state-dict-only files.
    return torch.load(io.BytesIO(raw), map_location='cpu', weights_only=False)


vae_name = 'mnist_vae_zdim_3_beta_0.01_seed_1'
rnn_name = vae_name + '_RNN_Model4_float_alpha_1_digit_0127'
vae = checkpoint(vae_name)['model'].eval()
rnn_checkpoint = checkpoint(rnn_name)
rnn = rnn_checkpoint['model'].eval()
control = float(rnn_checkpoint['c_list'][0])
raw = root / 'mnist_data/MNIST/raw'
labels = np.frombuffer((raw / 'train-labels-idx1-ubyte').read_bytes(), dtype=np.uint8, offset=8)
images = np.frombuffer((raw / 'train-images-idx3-ubyte').read_bytes(), dtype=np.uint8, offset=16).reshape(-1, 784)
ids = np.flatnonzero(np.isin(labels, [0, 1, 2, 7]))
latent = []
with torch.inference_mode():
    for start in range(0, len(ids), 1024):
        batch = torch.tensor(images[ids[start:start+1024]].astype(np.float32) / 255)
        mu, log_var = vae.encoder(batch)
        latent.append(vae.sampling(mu, log_var).numpy())
z = np.concatenate(latent)
targets = labels[ids]
centroid = z.mean(axis=0)
np.random.seed(0)
initial = np.random.normal(size=(3000, 3)) * 5 + centroid
initial = initial[np.argsort(initial[:, 0])]
x = torch.tensor(initial, dtype=torch.float32)
trajectory_ids = np.arange(3000)
frames = [x.numpy()[trajectory_ids].copy()]
c = torch.full((len(x), 1), control)
with torch.inference_mode():
    for step in range(80):
        x = rnn(torch.cat((x, c), dim=1))
        frames.append(x.numpy()[trajectory_ids].copy())
frames = np.asarray(frames)
assert np.isfinite(frames).all() and frames.shape == (81, 3000, 3)
rng = np.random.default_rng(0)
background_ids = np.concatenate([rng.choice(np.flatnonzero(targets == digit), 5000, replace=False) for digit in [0, 1, 2, 7]])
print(json.dumps(dict(
    provenance=dict(repository='https://github.com/AntonioLiu97/diffusion_RNN',
                    commit=commit, notebook='visual/mnist_diffusion_plot_dynamics.ipynb',
                    vae_checkpoint=vae_name, rnn_checkpoint=rnn_name,
                    torch_seed=0, numpy_seed=0, alpha=1, beta=0, control=control,
                    computed_trajectories=3000, full_background_count=len(z)),
    axis_labels=['Latent 1', 'Latent 2', 'Latent 3'],
    times=list(range(81)), default_step=2,
    reference=np.round(z[background_ids].astype(float), 4).tolist(),
    labels=targets[background_ids].tolist(),
    frames=np.round(frames.astype(float), 4).tolist(),
), separators=(',', ':')))
print(f'Exported {len(frames)} times, {frames.shape[1]} trajectories, {len(background_ids)} MNIST embeddings', file=sys.stderr)
