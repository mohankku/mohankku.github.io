---
layout: post
title: "llm-rs: LLM Inference in Rust, from cuTile Tiles to Hand-Written SIMT Kernels"
author: Mohan Kumar
tags: [rust, cuda, llm-inference, gpu-kernels, cutile, cuda-oxide]
---

llm-rs is an LLM inference engine written entirely in Rust: weight loading, tokenizer, sampling, the forward pass, the GPU kernels, and an OpenAI-compatible server. It began as a GPT-2 port with a plain CPU implementation and now runs Llama- and Qwen-family models on NVIDIA GPUs, with continuous batching and a paged KV cache. This post gives the overall design, then the main GPU story: starting with **cuTile** tile kernels, and then replacing the hot paths with hand-written **SIMT** kernels. That roughly doubled decode throughput on the same GPU and made long-prompt prefill several times faster.

## 1. The high-level idea

The project follows one rule: **one model, many backends, same math.**

- A **CPU reference** that is simple and readable, and serves as the source of truth.
- A **SIMD CPU** backend (NEON / AVX2) for real speed on laptops and servers.
- An **Apple GPU** backend on Metal.
- An **NVIDIA GPU** backend that keeps weights and the KV cache on the GPU and runs the whole forward pass there.

Each backend is checked against the reference, both kernel by kernel and end to end: greedy GPU output must match the CPU **token for token**. That check is what made aggressive kernel work safe. A faster kernel that changes the output gets rejected.

On top of the model sits a serving layer inspired by vLLM: a scheduler that batches requests continuously, a paged KV cache with prefix sharing, steps that mix prefill and decode, and an HTTP API compatible with OpenAI clients.

```
OpenAI-style HTTP API
        │
   scheduler (continuous batching)
        │
   paged KV cache + prefix cache
        │
   executor ─► CPU | Metal | CUDA
```

## 2. Why decode is a memory problem

Generating one token means reading **every weight once** to produce one vector. A 0.5B-parameter model in BF16 is about 1 GB of weights. On a GPU with ~450 GB/s of memory bandwidth, that puts the best possible single-stream decode at around **450 tokens per second**.

A matrix-vector product does very little math per byte, so decode is really about one thing: **reading weights at full bandwidth.** That ceiling became the yardstick for every kernel change. "Faster" wasn't enough; the question was always "what fraction of the ceiling are we at?"

## 3. First pass: cuTile

cuTile lets you write GPU kernels in Rust as operations on **tiles**. You describe how tensors are split into blocks and what to do with each block. The compiler decides how threads, shared memory, and tensor-core instructions are used.

That made it fast to get a correct, fully GPU-resident forward pass. Tuning then went a long way:

- **Caching compiled kernels and warming them up** so compile time didn't land on the first request.
- **Queuing launches without waiting on the host** after each one.
- **Fusing neighbouring operations** (e.g. the gate and up projections with their activation) so the activations aren't written out and read back.
- **Sweeping tile sizes** for the decode matvecs.

Together these took decode from about a dozen tokens per second to roughly **160 tok/s**, a better than 10x improvement.

Then it stopped improving, at about **35% of the bandwidth ceiling**. The GPU was busy almost all the time, so launch overhead wasn't the problem; the kernels were. Large projections ran reasonably well, but the small ones (attention projections, the output projection) were several times slower than bandwidth allowed. I tried more block shapes, pipelining hints, and split-K reductions. None of them helped.

The underlying problem is that for a small matvec, performance depends almost entirely on **how a row maps onto the lanes of a warp and onto memory transactions**. The tile abstraction is designed to hide exactly that mapping.

## 4. Going down a level: SIMT kernels

So the hot paths moved to **SIMT kernels**: Rust compiled to PTX (via cuda-oxide), with explicit threads, warps, and warp shuffles. This is the classic CUDA style.

The decode matvec becomes the textbook form: **one warp per output row.** Each of the 32 lanes reads consecutive weights, so the warp as a whole reads one contiguous chunk of memory per step. That access pattern is what lets the hardware reach full bandwidth. At the end, the lanes' partial sums are combined with warp shuffles, with no shared memory needed.

Two design choices kept this practical:

- **Both kernel styles share one stream.** SIMT and cuTile kernels can be mixed freely in the same forward pass, so the switch happened one kernel at a time and was A/B tested at every step.
- **The SIMT kernels are prebuilt.** The special toolchain is only needed when changing a kernel, not to build or use the project.

### Decode: from ~35% to ~70% of the ceiling

On the same GPU, the steps that mattered:

| Change | Approx. decode | Share of ceiling |
|---|---:|---:|
| cuTile baseline | ~160 tok/s | ~35% |
| One-warp-per-row matvecs, split-sequence attention, fused small ops | ~250 tok/s | ~55% |
| No memory allocation inside the decode loop | ~300 tok/s | ~66% |
| Norms folded into the projections, better work split per warp | **~315 tok/s** | **~70%** |

That's about **2x** the cuTile throughput on identical hardware, and the output still matches the CPU exactly. The number of kernel launches per layer also dropped by more than half. The main lessons:

1. **Once kernels are fast, the host becomes the bottleneck.** With near-bandwidth kernels, the profiler showed the GPU sitting idle a third of every step while the host allocated and freed temporary buffers. Allocating one workspace per request removed that idle time, and run-to-run noise almost disappeared with it.
2. **Decode attention is about latency, not bandwidth.** It works best split into many small chunks of positions, each handled by one warp with an online softmax, followed by a cheap merge step. More chunks mean more warps to hide memory latency, up to the point where merging costs more than it saves. The best chunk size came from measurement, not a guess.
3. **Fusion can be slower at first.** Moving the normalization into the projection kernels removed launches but initially *slowed* decode. The fused prologue was a chain of dependent memory round trips. Prefetching didn't fix it, and neither did fixing shared-memory bank conflicts. What worked was **issuing several independent loads at once**, and then giving each warp more rows so that fewer blocks repeated the prologue.

At the end, the largest projections run at roughly **80–90% of memory bandwidth**. What's left is mostly the smallest projection and latency-bound attention.

### Prefill: tensor cores, written by hand

Prefill processes the whole prompt at once, so it is limited by compute, the opposite of decode. It got its own SIMT kernels:

- **Short prompts** use a batched matvec that reads each weight once for a group of tokens. Its first version was 10x slower than expected because its accumulators spilled out of registers. Unrolling the loops fixed that, and short-prompt prefill became **~2.5x faster**.
- **Long prompts** use a hand-written **tensor-core GEMM** (BF16 inputs, FP32 accumulation). It is **2.5–5x faster** than the cuTile version, and the gap grows with prompt length.
- **Prefill attention** became flash-style and reads straight from the paged KV cache. It took three attempts. The simple version, where each warp handles its own query row, was *slower* than cuTile. Sharing key/value tiles across query rows brought it level. A tensor-core version was **several times faster** on long prompts. Short prompts don't fill enough tensor-core blocks, so a measured crossover point picks between the two kernels.

End to end, time to first token on a ~1,200-token prompt dropped by more than half.

## 5. Serving on top of the kernels

The same kernels gained batched versions that know each request's position and where its KV blocks live. That is what continuous batching and paging need:

- **Paged KV cache.** Looking up blocks through a table costs essentially nothing once attention fetches one block per chunk.
- **Prefix caching.** A request that shares a long system prompt with an earlier one starts generating about **4x sooner**, because only its new suffix has to be processed.
- **Batched sampling.** Sampling every request in a batch with one kernel launch, instead of many small launches per request, roughly **tripled** sampled throughput and cut queueing delay sharply.

Against vLLM on the same GPU and model, llm-rs keeps up at light load. Under heavy load vLLM is still well ahead. The profile points to two causes:

- **A fixed cost per step:** the scheduler waits on the host for each step's tokens before planning the next step.
- **Batch scaling:** the batched decode matvec still re-reads the weights for every group of tokens. At large batch sizes, decode should run on the tensor-core GEMM that prefill already uses.

Those two are the next items on the list.

## 6. Takeaways

- **Start with tiles, finish with warps.** A tile-level DSL is the fastest route to a correct GPU implementation. For kernels limited by memory bandwidth or latency, the lane-to-byte mapping is the whole problem, and you have to write it yourself.
- **Measure against a ceiling.** Tracking the share of peak bandwidth showed when a kernel was done and where the remaining gap was.
- **Keep a parity check you trust.** Exact agreement with a simple reference made it cheap to try risky ideas and throw away the ones that failed.
- **Rust works all the way down.** Host code, tile kernels, and SIMT kernels are all written in Rust, and users never need the special toolchain.
