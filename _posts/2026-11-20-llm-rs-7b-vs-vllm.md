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

- **Rust from the tokenizer to the kernels.** Every GPU kernel is Rust, compiled to PTX with cuda-oxide and built into one server binary. Nothing in the request path is Python, PyTorch or Triton. vLLM builds on PyTorch, with CUDA kernels like Marlin and FlashAttention underneath.
- **A different kernel for each batch size.** llm-rs keeps one copy of the 4-bit weights and picks the kernel by how many tokens the step has:
  - **One token:** a gemv that streams each weight once.
  - **2–64 tokens:** a split-K decode GEMM that still reads every weight once per step.
  - **More (prompts):** a 128×128 tensor-core GEMM.

  vLLM runs its Marlin kernel at every size.
- **Integer weights in the multiply.** Marlin turns each 4-bit weight into a scaled 16-bit float before the tensor-core multiply. llm-rs feeds the multiply the exact integer `code − zero`, and applies each group's scale once to the f32 partial sums afterwards. This week's prompt GEMM in that format reaches 66–78 TFLOPS, 1.19–1.32x its predecessor, and brought time to first token on long prompts within 6–8% of vLLM.
- **Attention shaped for decodes.** A decode has only 7 query heads per KV head on this model, so a 64-row tensor-core tile is mostly empty, and three of its four warps used to sit idle. llm-rs's own varlen kernel instead gives each of the four warps a quarter of every key tile and merges their results at the end. Decode attention reads the KV cache at up to 656 GB/s, 85% of the card's bandwidth. vLLM uses FlashAttention and FlashInfer kernels.
- **A sampler defined by a reference.** The GPU sampler must pick exactly the token llm-rs's CPU sampler picks for the same logits and random draw, and the tests check that at the full 152k vocabulary. That rule is why it selects tokens without sorting: by radix select and running sums, in a fixed order.

## Where vLLM is still ahead

Time between tokens. A single request's decode step takes 10.6 ms against vLLM's 8.15:
- the 4-bit gemvs take 7.4 ms, reading the weights at 380–560 GB/s out of 768;
- the BF16 `lm_head` takes 1.5 ms;
- the RMS norms take 0.65 ms;
- the sampler takes 0.49 ms;
- attention takes 0.41 ms.

Under load the gap is 1.4x at 256 short requests and 1.8x at 16 long ones. Both come down to the batched decode GEMM, where Marlin is faster.

## Next

The batched decode GEMM and the single-token gemvs are being reworked now. After that comes an FP8 KV cache for the new attention kernel, which halves the cache traffic on long contexts. All of the numbers above, plus the runs behind them, are in the repo's `docs/PERF.md`.
