# Diffusion RNN article

Open `research/diffusion-rnn/` through an HTTP server rooted at the website repository (for example, `python3 -m http.server 8765`). No build or external JavaScript libraries are required.

## Sources and data

The narrative follows the 41-slide `APS Diffusion_RNN_short.pptx` and its associated speaker notes. `provenance.json` identifies the source deck by SHA-256, pins the original research commit, and records the data/export-script hashes. The private, 176 MB deck is not copied into the website.

The two Python exporters in `scripts/` must run with the original `diffusion_RNN` checkout as their working directory. They require its model definitions, checkpoint Git objects, NumPy, and PyTorch; the MNIST exporter also reads the original training IDX files. Run each script with stdout redirected to its corresponding JSON file in `assets/data/`. They load existing model weights on CPU and do not train or modify the research checkout.

- `export_diffusion_geometry.py` → `diffusion-geometry.json`
- `export_diffusion_control.py` → `diffusion-control.json`

The Gaussian figure is an exact analytical demonstration computed by `gaussian.js`; its chosen covariance eigenvalues are not empirical model estimates. Fractional MNIST playback frames are linear interpolation of the saved integer-time trajectories. The control figure uses only computed control/time samples.

## Citation

The page includes a canonical URL, scholarly citation meta tags, JSON-LD, a version/date, and `citation.bib`. Keep these fields synchronized when revising the article. The canonical URL becomes publicly reachable when the website changes are deployed.
