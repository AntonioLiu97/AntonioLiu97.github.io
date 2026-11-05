# Cached Jacobian Scopes demo

The browser reads `assets/data/jacobian-demo.json` only. It does not load model weights, call Hugging Face Spaces, submit prompts, or access any GPU. The existing external live-demo link remains a separate user-initiated link.

`export_jacobian_demo.py` generates the cache with **local CPU** inference and automatic differentiation. It uses Qwen2.5-0.5B, not the LLaMA models used in the paper's illustrations. The three short prompts are new demonstrations, not reproductions of published figures or benchmark results.

## Reproduce

Create an isolated Python environment with `torch==2.5.1`, `transformers==4.46.3`, and `numpy<2`. Run from the website repository, setting `HF_HOME` to a local model cache:

    python scripts/export_jacobian_demo.py --revision MODEL_REVISION

Use `model_revision` from the exported JSON for `MODEL_REVISION`. Downloading weights requires network access; inference is forced onto CPU and never uses a model-hosting API. Model weights are not website assets.

## Meaning of the numbers

- Semantic: norm of the gradient of the selected next-token **logit**, not its probability.
- Fisher: norm of the gradient along the largest-eigenvalue eigenvector of `W.T @ (diag(p) - p p.T) @ W`. The CPU eigensolver's residual is saved. This is the unsquared Eq. 6 definition in the paper; the repository's generalized low-rank implementation also supports eigenvalue-weighted squared norms.
- Temperature: norm of the gradient of the final normalized-layer hidden-state norm. This is a radial sensitivity measure; it should not be equated with total entropy sensitivity when logit shape also varies.

All scores are nonnegative local embedding sensitivities. They do not indicate whether a word supports/opposes the target, and they do not predict the effect of deleting or replacing a whole word. Colors divide scores by the maximum **within the active map**. Probability badges are the actual full-vocabulary softmax probabilities, not renormalized over the displayed candidates. Tokens retain the model's subword segmentation; hovering or focusing reports the token index and relative score.

Source references: arXiv:2601.16407v5, Eqs. 4, 6, 10; AntonioLiu97/JacobianScopes revision `ffbfe96ebb7a24c25c0d34b70a494e134e1f5ed9`, especially `src/JacobianScopes/JacobianScopes.py` and `JacobianScopes_utils.py`.
