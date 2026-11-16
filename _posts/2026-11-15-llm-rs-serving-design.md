---
layout: post
title: "llm-rs: Keeping the GPU Fed — Batching, Mixed Steps, and the Prefix Cache"
author: Mohan Kumar
series: llm-rs
tags: [rust, cuda, llm-inference, gpu-kernels, scheduling, kv-cache]
---

The [first post]({% post_url 2026-11-09-llm-rs-cutile-simt-kernels %}) in this series covered llm-rs's kernels; the [second]({% post_url 2026-11-12-llm-rs-vs-vllm %}) used the roofline model to explain a benchmark against vLLM. This one is about the layer above the kernels: the serving engine that decides what the GPU does each step. Good kernels set the ceiling; the scheduler decides how close to it you run. All numbers below are Qwen2.5-0.5B-Instruct on a RunPod RTX A5000 (24 GB, 768 GB/s), `serve --device cuda --max-num-seqs 64`, measured with `bench_serve` (16 single-stream requests of 256 in / 256 out; bursts of 256 requests of 256 in / 128 out).

## 1. Continuous batching with chunked prefill

The engine admits a waiting request as soon as blocks free up, instead of waiting for the whole batch to finish. A new request's prompt is prefilled in chunks that fit the step's token budget, so running requests keep decoding while the newcomer catches up. Admission leaves a small watermark of free blocks so running requests can grow without all preempting at once. The point, from the roofline view: every weight read should serve as many tokens as possible, and an idle GPU serves none.

## 2. Mixed steps: prefill and decode in one launch sequence

Prefill chunks and decode tokens used to run as separate passes. Now one step carries both, with fused kernels and a workspace kept across steps. On this GPU that took a 256-request burst from 3,745 to 4,068 tok/s while host synchronizations fell from ~77k to ~5k and allocations from ~190k to ~32k per run. The GPU stopped waiting on the host and the host stopped drowning in launch overhead.

## 3. Queued steps: plan the next step while collecting this one

The engine now queues the next step (admissions, prefill chunks, finishes) before collecting the one in flight. Eight alternating runs after warm-up, 256 requests at once:

| | Queued (default) | Pipeline off |
|---|---|---|
| Output tok/s, mean (range) | 6,526 (5,035–7,513) | 5,922 (4,614–7,313) |
| Median time per output token | 8.2 ms | 10.1 ms |
| GPU busy (one traced run) | 96.7% | 84.7% |

Plus 10% throughput and 18% off the per-token time; the GPU's idle share drops from ~15% to ~3%. Queued wins every paired run, though runs still vary ~20% between server starts — something to keep in mind when comparing any two numbers in this post.

## 4. CUDA graphs for the steady state

Decode steps with stable shapes run as captured graphs instead of re-launched kernels. Shape changes capture lazily, and a capture that fails on a timing-dependent driver error is retried for a later shape instead of disabling graphs for the whole run. Graphs don't show up as a line item in the tables; they show up as the absence of launch overhead in every table.

## 5. Sampling and penalties on the device

A sampling step used to mean ~150 host-side launches per request (bisection search, one launch each). One SIMT kernel now samples every row in a single launch, and repetition penalties run as one fused pass over all rows. On an earlier run (32 requests at 8 req/s, temperature 0.8) that took throughput from 131 to 410 tok/s and time-between-tokens from 89 to 18 ms. Moving work onto the device is the same idea as graphs: the host plans, the GPU executes.

## 6. A decode GEMM that reads the weights once

The old batched decode read the weights once per 16 tokens, so 64 sequences read them four times per step. The decode GEMM streams them once at high bandwidth — per-batch throughput at 64 sequences roughly doubled, and a batch-64 step takes 9.4 ms on a 2000 Ada. Smaller batches still use the matrix-vector path, which streams better one token at a time.

## 7. The prefix cache, and its newest upgrade

Requests that share a system prompt share its KV blocks: the pool hashes each block's tokens in a chain, so a new request's lookup walks the chain and attaches whatever prefix is already written. Two things bit in practice. First, every admission looked the prefix up twice (once to check, once to attach) and every *waiting* request re-walked the whole cache on every step while blocked. Second, taking a hit off the least-recently-used list was a linear scan.

The latest change fixes all three: one lookup returns the hit plus a reusable hint (hit blocks with their chain hashes), the attach revalidates the hashes instead of re-walking, each request memoizes its lookup against the pool's generation counter, and the LRU list is intrusive (O(1) removal). A stale hint — the pool changed between check and attach — falls back to the full walk, so the result is always identical. The engine test that counts every query and hit is bit-identical before and after.

A methodological footnote the cache forced: it is always on in `serve`, and it works *too* well on repeated prompts. The same seed twice gave 352 then 633 tok/s, with a 93.8% hit rate the second time. Every number below uses fresh prompts per run (0.0% hit rate), so this is the no-cache-help case.

## 8. The latest 0.5B numbers on the A5000

One request at a time, then 256 at once (two runs each):

| Option | Single tok/s (per token) | Burst tok/s |
|---|---|---|
| Default (BF16 weights and KV) | 422 (2.34 ms) | 8,143 / 7,899 |
| `--kv-cache-dtype fp8` | 388 (2.55 ms) | 6,191 / 6,062 |
| `--quantization int8` | 398 (2.49 ms) | 5,515 / 5,606 |
| `--quantization int4` | 427 (2.32 ms) | 5,682 / 6,296 |
| `--batch-invariant` | 257 (3.87 ms) | 5,436 / 5,358 |

Two honest readings. First, on a 0.5B model with short contexts none of the compressed formats is faster: the weights are ~1 GB, and staging quantized weights through registers (or converting FP8 per element) costs more than the bytes saved. They buy memory — FP8 holds twice BF16's tokens, INT4 a quarter of the weights — and should pay on bigger models and longer contexts, which these runs don't measure. Second, exact batch invariance costs ~65% at batch 1 and ~33% at burst: the price of bit-identical reruns.

## 9. What's next

Two follow-ups are queued. First, the same story measured through **AIPerf** instead of the in-house harness, so the numbers are comparable with anyone else's. Second, the **7B models**, where the trade-offs above flip: the weights stop fitting comfortably, attention and the KV cache grow teeth, and quantization starts paying. Both get their own post.
