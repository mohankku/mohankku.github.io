---
layout: post
title: "llm-rs vs vLLM on a 7B Model: What's the Same, What's Different"
author: Mohan Kumar
series: llm-rs
tags: [rust, cuda, llm-inference, gpu-kernels, vllm, int4]
---

The [last post]({% post_url 2026-11-15-llm-rs-serving-design %}) ended with a promise: the 7B models, measured through AIPerf, where quantization and attention start to matter. Here it is, kept short.

The setup: Qwen2.5-7B-Instruct-AWQ (4-bit weights) on one RunPod RTX A5000 (24 GB, 768 GB/s). vLLM 0.34 against llm-rs, both capped at 64 concurrent sequences, both measured with AIPerf 0.13 using fixed lengths, fresh prompts every run (0% prefix-cache hits), and each model's default sampling settings.

| Output tokens/s | llm-rs | vLLM | llm-rs / vLLM |
|---|---:|---:|---:|
| One at a time, 256 in / 256 out | 88.5 | 117.9 | 75% |
| 256 at once, 256 in / 128 out | 1,066 | 1,395 | 76% |
| 16 at once, 2,048 in / 256 out | 284 | 435 | 65% |
| 64 at once, 2,048 in / 512 out | 629 | 767 | 82% |

Before the last round of fixes these ratios were 64%, 66%, 57% and 73%. Most of the gain came from two fixes: a faster sampler and a faster prompt (prefill) kernel, both described below.

## What's the same

On the serving side, llm-rs now makes the same choices vLLM does:

- **Continuous batching with chunked prefill.** New requests join as soon as there is room, and long prompts are fed in pieces so running requests keep decoding.
- **A paged KV cache with prefix caching.** Memory is handed out in 16-token blocks, and requests that share a prompt prefix share its blocks.
- **Mixed steps with one variable-length attention launch.** A single step carries prompt chunks and decode tokens together, and attention for all of them runs as one launch over a packed batch, in the style of FlashAttention's `varlen` kernels.
- **CUDA graphs for steady decoding.** Repeated decode steps replay a captured graph instead of launching every kernel again from the CPU.
- **Sampling on the GPU, with the model's own defaults.** For Qwen that means temperature 0.7, top-k 20, top-p 0.8 and a repetition penalty of 1.05, applied when a request doesn't say otherwise. Both engines do this.

That last point turned out to matter. My own benchmark tool sends `temperature: 0`, which picks the most likely token and is nearly free. AIPerf sends no temperature, so the defaults apply. Under those defaults the llm-rs sampler took **2.74 ms of a 12.5 ms decode step**: it found top-k, top-p and the random draw with three 30-step searches, each step a full pass over the 152,064-entry vocabulary. Now top-k uses a four-pass radix select, and top-p and the draw run over only the 20 tokens that survive top-k. The cost dropped to 0.49 ms, and the results still match the CPU sampler token for token. **Benchmark with the sampling settings your users get**, not the ones your tool happens to send.

## What's different

- **The language.** Every llm-rs kernel is Rust, compiled to PTX with cuda-oxide. There is no Python, no PyTorch and no Triton anywhere in the request path. vLLM uses hand-written CUDA (Marlin for 4-bit weights), FlashAttention-style attention kernels and Triton.
- **4-bit weights.** vLLM's Marlin kernels dequantize the weights to 16-bit floats inside the multiply. llm-rs repacks the weights once into tiles laid out the way the tensor cores read them. Each weight enters the multiply as the exact integer `code − zero`, and the group's scale is applied to the partial sums afterwards. One copy of the weights then serves every kernel: the single-token gemvs, the batched decode GEMM and the prompt GEMM. This week's prompt GEMM uses 64×64 warp tiles and two blocks per streaming multiprocessor (SM). It reaches 66–78 TFLOPS, 1.19–1.32x the old kernel, and cut time to first token on long prompts to within 6–8% of vLLM.
- **Exactness as a feature.** In its exact modes, a llm-rs request produces the same tokens whether it runs alone or in a batch, and llm-rs has checks for exactly that. That guarantee costs something: the fast attention path rounds to BF16, so it turns off in exact mode. This week a change of mine broke the guarantee by routing decode-only steps through that path, and those checks caught it before it reached the main branch.
- **Where the remaining time goes.** One request's decode step now takes 10.6 ms against vLLM's 8.15 ms:

| Per token, one request | Time |
|---|---:|
| 4-bit gemvs (QKV, o, gate/up, down) | 7.4 ms |
| Output layer (`lm_head`, kept in BF16) | 1.5 ms |
| RMS norms | 0.65 ms |
| Sampler | 0.49 ms |
| Attention | 0.41 ms |

The gemvs read the weights at 380–560 GB/s out of 768, so that row is the next target. Under load, the gap is in time between tokens rather than time to first token: 1.4x vLLM at 256 short requests and 1.8x at 16 long ones. Both come down to the batched decode GEMM, where vLLM's Marlin is still ahead.

## Next

The batched decode GEMM and the single-token gemvs are being reworked now. After that comes an FP8 KV cache for the new attention kernel, which halves the cache traffic on long contexts. All of the numbers above, plus the runs behind them, are in the repo's `docs/PERF.md`.
