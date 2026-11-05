"""Compute the portfolio demo on LOCAL CPU only; no inference API is used.

Requires torch==2.5.1 and transformers==4.46.3. Run with a local HF_HOME.
Implements Eq. 4/6/10 of arXiv:2601.16407v5 directly: L2 norms of
input-embedding gradients of a target logit, principal Fisher projection,
and final hidden-state norm. The Fisher direction is solved by CPU eigh.
Unlike the repository's eigenvalue-weighted squared Fisher scores, this
export uses the paper's unsquared Eq. 6. All prompt positions are retained.
"""
import argparse
import json
from pathlib import Path
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='assets/data/jacobian-demo.json')
    parser.add_argument('--revision', default='main')
    args = parser.parse_args()
    torch.manual_seed(0)
    torch.set_num_threads(4)
    model_id = 'Qwen/Qwen2.5-0.5B'
    tokenizer = AutoTokenizer.from_pretrained(model_id, revision=args.revision)
    model = AutoModelForCausalLM.from_pretrained(model_id, revision=args.revision,
        torch_dtype=torch.float32, attn_implementation='eager').to('cpu').eval()
    model.requires_grad_(False)
    W = model.get_output_embeddings().weight.detach()
    examples = [
        ('colors', 'Two clues', 'The apple is red. The banana is yellow. Which color is the apple? Answer:', [' red', ' yellow']),
        ('translation', 'Translation', 'French: Le chat dort sur le tapis.\nEnglish: The cat sleeps on the', [' mat', ' carpet']),
        ('politics', 'Competing cues', 'Alice grew up in the South and studied at Columbia University. Her political views are', [' liberal', ' conservative']),
    ]
    output = {'default_example': 'translation', 'model': model_id, 'model_revision': model.config._commit_hash,
        'paper': 'https://arxiv.org/abs/2601.16407v5',
        'reference_code_commit': 'ffbfe96ebb7a24c25c0d34b70a494e134e1f5ed9',
        'device': 'local CPU', 'dtype': 'float32', 'score': 'L2 gradient norm',
        'normalization': 'divide by maximum within each displayed attribution map',
        'examples': []}
    for slug, label, prompt, targets in examples:
        ids = tokenizer(prompt, return_tensors='pt', add_special_tokens=False).input_ids
        embeds = model.get_input_embeddings()(ids).detach().requires_grad_(True)
        y = model.model(inputs_embeds=embeds, use_cache=False).last_hidden_state[0, -1]
        logits = W @ y
        probabilities = logits.detach().softmax(-1)
        def scores(loss):
            g = torch.autograd.grad(loss, embeds, retain_graph=True)[0][0].norm(dim=-1)
            assert torch.isfinite(g).all() and (g >= 0).all()
            return [round(v, 7) for v in g.tolist()]
        top_ids = probabilities.topk(4).indices.tolist()
        target_ids = []
        for target in targets:
            encoded = tokenizer.encode(target, add_special_tokens=False)
            if len(encoded) != 1:
                raise ValueError(f'Target is not a single token: {target!r}')
            target_ids.append(encoded[0])
        choices = list(dict.fromkeys(target_ids + top_ids))
        semantic = [{'token_id': i, 'token': tokenizer.decode([i]),
            'probability': float(probabilities[i]), 'scores': scores(logits[i])} for i in choices]
        temperature = scores(y.norm())
        # Explicit covariance in hidden space, matching the reference code.
        with torch.no_grad():
            F = torch.zeros(W.shape[1], W.shape[1])
            mean = torch.zeros(W.shape[1])
            for start in range(0, len(W), 4096):
                weights = W[start:start+4096]
                weighted = weights * probabilities[start:start+4096, None]
                F += weights.T @ weighted
                mean += weighted.sum(0)
            F -= torch.outer(mean, mean)
            eigenvalues, directions = torch.linalg.eigh(F)
            direction = directions[:, -1]
            residual = (F @ direction - eigenvalues[-1] * direction).norm() / eigenvalues[-1].abs()
            assert residual < 1e-4
        fisher = scores(y @ direction)
        tokens = [tokenizer.decode([i]) for i in ids[0].tolist()]
        assert ''.join(tokens) == prompt
        output['examples'].append(dict(id=slug, label=label, prompt=prompt, tokens=tokens,
            token_ids=ids[0].tolist(), semantic=semantic, fisher=fisher, temperature=temperature,
            fisher_eigenvalue=float(eigenvalues[-1]), fisher_relative_residual=float(residual)))
        print(f'Cached {label}: {len(tokens)} input tokens, {len(semantic)} target logits', flush=True)
    Path(args.output).write_text(json.dumps(output, ensure_ascii=False, indent=2)+'\n')


if __name__ == '__main__':
    main()
