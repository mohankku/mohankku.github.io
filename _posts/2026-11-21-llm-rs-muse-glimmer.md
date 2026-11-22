---
layout: post
title: "llm-rs: Bringing Up Muse Glimmer 30B on the CPU and on One GPU"
author: Mohan Kumar
series: llm-rs
tags: [rust, cuda, llm-inference, muse-glimmer, quantization, int4]
---

[Muse Glimmer 30B](https://huggingface.co/meta-models/Muse-Glimmer-30B) came out in August 2026: a dense 28B text decoder with a 2B vision encoder beside it. Until now llm-rs only knew Llama-family decoders: Llama, Qwen2, Qwen3 and Mistral. This post covers adding Muse Glimmer's text decoder, first on the CPU and then on one 24 GB RTX A5000. The result: it serves at **29.5 tokens/s one request at a time and 226.6 tokens/s with 16 at once**, in 20.4 GB of GPU memory.

## What's different about this model

On paper it's a 52-layer transformer with grouped-query attention: 32 query heads, 2 KV heads, head_dim 128. Reading the [transformers implementation](https://github.com/huggingface/transformers/tree/main/src/transformers/models/muse_glimmer) shows eight places where it departs from the Llama block:

- **A sigmoid gate on attention.** An extra projection of the layer's normed input multiplies the attention output elementwise, `attn × sigmoid(gate_proj(x))`, before `o_proj`.
- **Sandwich norms.** Each sub-layer's output is RMS-normed before it joins the residual stream, not just its input.
- **Centered norm weights.** The layer norms scale by `1 + w`, not `w`.
- **Weightless QK norms.** Each query and key head is RMS-normed with no learned weight, then queries are multiplied by 3.87.
- **A hybrid layer pattern.** Three sliding-window layers (2,048 tokens) with RoPE, then one full-attention layer with no positional encoding at all, repeated 13 times.
- **Normed embeddings.** Each token embedding is scaled to unit RMS.
- **Softcapped logits.** The logits become `20 · tanh(0.196 · z / 20)`.
- **A multimodal checkpoint.** The decoder's weights live under `model.language_model.*`, next to a vision tower the text model doesn't need.

None of these is hard alone. Together they're enough to make the model produce nonsense if any one is slightly off.

## The CPU path

The CPU model came first, because it's the easiest to check. llm-rs's CPU forward pass is one function that every backend's per-token path shares, so the eight differences mostly fit in as additions:

- **Centered norms:** the weights load as `1 + w`, so the existing `x / rms(x) × w` produces Muse's norm exactly.
- **QK norm:** the weightless head norm with its query scale is Qwen3's head norm with synthesized weights: 3.87 for queries, 1 for keys.
- **Everything else:** the gate is an optional eighth projection, and the two output norms are optional fields. Models that don't have them never touch them.

**Checking it was the hard part.** A tiny randomly initialized checkpoint, compared against a line-by-line transcription of the transformers code, catches plumbing bugs. It can't catch a misreading of the transformers code itself. That needs a comparison against transformers on the real weights, and the real weights didn't fit. The BF16 decoder is 56 GB, transformers in float32 needs about twice that, and the cloud pod I used is capped at 50 GB of RAM.

The way out was truncation. Both implementations read a config saying the model has 4 layers, and they load only those layers' weights. Four layers cover both kinds: three sliding-window layers with RoPE, then a full-attention layer without it. On a 13-token prompt the two agreed at every position:

| | Top-1 | Top-5 overlap | Max logit difference | Cosine |
|---|---|---|---|---|
| 2,048-token window | 13/13 | 5/5 | 6e-5 | 1.0000000 |
| 4-token window | 13/13 | 5/5 | 6e-5 | 1.0000000 |

The second row matters. A 13-token prompt never reaches a 2,048-token window, so I shrank the window to 4 in both configs. That changed the last position's logits by up to 6.2, and llm-rs still matched transformers exactly. The window semantics, inclusive or exclusive and off by one or not, are right.

Running the full model on the CPU needs a machine with more than 56 GB of RAM. It also isn't something you'd use day to day: a token takes seconds.

## The CUDA path

The GPU is where the model becomes usable, and it brought three challenges.

**1. Getting the model into memory at all.** llm-rs read every tensor of a checkpoint into RAM before the model touched any of them, so peak host memory was the whole checkpoint, vision tower included. Two changes fixed that:
- **Lazy reads:** tensors are now read from disk only when the model takes them. Tensors it never asks for, like the vision encoder, are never read.
- **Quantize as you go:** with `--quantization`, each projection is quantized right after it's read, so the full-precision weights are never all in memory at once.

**2. Making INT4 actually small.** The first attempt loaded fine and then had no room left for the KV cache. llm-rs's built-in INT4 used a scale for every 32 weights. On the GPU, each group of 32 also carried an offset and a zero-point word, so a weight cost about 0.9 bytes instead of the 0.5 the name suggests. Muse's 23.7B projection weights came to 20.7 GB before the 5.4 GB BF16 embedding and output layer.

The fix was a new scheme, `int4-g128`: asymmetric quantization (a scale and a zero point) in groups of 128. That's the same shape AWQ checkpoints use, so the GPU kernels already handled it. It brings a weight to 0.56 bytes, and the whole model to 20.4 GB with a 16k-token KV cache. Accuracy held: against the BF16 CPU model, logits stay at cosine 0.994–0.997, about the same as the per-32 scheme.

**3. New math in a fused, batched pipeline.** llm-rs's CUDA serving runs every step as one batched forward pass: prompt chunks, decodes, or both, under CUDA graphs. Muse needed:
- **Three new kernels:** a per-head RMS norm, the sigmoid gate, and the logit softcap.
- **NoPE layers:** the existing RoPE kernel learned that a frequency base of 0 means no rotation. That's an exact identity, since angle 0 gives cos 1 and sin 0.
- **The rest:** the embedding and sub-layer output norms reuse the existing norm kernel, run in place.

To check the GPU path, a small tool prefills part of a prompt on the GPU, decodes the rest one token at a time, and compares every position with the CPU model's logits. In BF16 the two agree on the top token everywhere, with logit differences around 0.02. Those come from the GPU rounding activations to BF16 inside its matrix multiplies.

## Results

One RTX A5000 (24 GB), `serve --quantization int4-g128`, 256-token prompts, 128-token outputs:

| | Output tokens/s | Median time to first token | Median time per token |
|---|---|---|---|
| One at a time | 29.5 | 271 ms | 32.2 ms |
| 16 at once | 226.6 | 3.0 s | 54.8 ms |

Each token has to stream about 15.7 GB of weights: 13 GB of INT4 projections plus the 2.7 GB output layer. At the card's 768 GB/s that's a floor of about 20 ms per token, so one request at a time is running at about 63% of what the memory allows.

## What's still missing

- **Speed.** The new operations run as separate kernel launches, and the RMS norm takes a slow path at this model's 6,656-wide hidden size. Fusing those and widening the fast path are the obvious next steps.
- **Other entry points.** Only the serving engine runs the model; llm-rs's single-request `generate` path refuses it for now.
- **Images.** The vision encoder isn't supported, so this is text-only Muse Glimmer.

The bigger lesson is about checking. Porting a new architecture is mostly careful reading. A checkpoint too big to load is no reason to skip comparing against the reference: truncate the model and compare a prefix that covers every kind of layer, and when a feature isn't exercised, as the window wasn't here, change the config until it is. All of the numbers above are in the repo's `docs/PERF.md`.
