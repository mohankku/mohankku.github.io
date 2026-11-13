---
layout: post
title: "llm-rs vs vLLM: Where a Hand-Written Rust Engine Stands"
author: Mohan Kumar
series: llm-rs
tags: [rust, cuda, llm-inference, gpu-kernels, vllm, benchmarking]
---

The [first llm-rs post]({% post_url 2026-11-09-llm-rs-cutile-simt-kernels %}) described the engine: a Rust LLM server with hand-written CUDA kernels, continuous batching, and a paged KV cache. This one puts it next to **vLLM** on the same GPUs and models. The short version: **with one request at a time llm-rs keeps up, and with BF16 weights it can lead. Under heavy load vLLM is 1.4–3.4x ahead.** Below: how I measured, where the time goes, what I built in response, and a bug that kept every test passing while making the code 4x slower.

## 1. Setup

Both servers ran on the same rented GPU, served the same model, and faced the same load generator:

- **GPUs:** an RTX A5000 (24 GB, 768 GB/s) and an RTX 2000 Ada (16 GB, 224 GB/s), rented at about $0.25 an hour.
- **Models:** Qwen2.5-7B-Instruct in BF16 and in 4-bit AWQ, and Qwen2.5-3B-Instruct in BF16 (7B BF16 doesn't fit in 16 GB).
- **Servers:** llm-rs and vLLM 0.33.0, both capped at 64 concurrent sequences, with the same context limit.
- **Two workloads:**
  - *One at a time:* 16 requests in sequence, each 256 prompt tokens in and 256 out.
  - *256 at once:* 256 requests arrive together, each 256 in and 128 out.
- **Metrics:** output tokens per second, time to first token (TTFT), and time per output token (TPOT), as medians.

## 2. Results

**RTX A5000, Qwen2.5-7B**

| | One at a time | 256 at once |
|---|---:|---:|
| llm-rs BF16 | **35.5 tok/s** | 709 tok/s |
| vLLM BF16 | 27.0 tok/s | **1,208 tok/s** |
| llm-rs AWQ (4-bit) | 41.2 tok/s | 550 tok/s |
| vLLM AWQ (4-bit) | **94.6 tok/s** | **1,878 tok/s** |

**RTX 2000 Ada**

| | One at a time | 256 at once | TTFT at 256 | TPOT at 256 |
|---|---:|---:|---:|---:|
| llm-rs 3B BF16 | 32.4 tok/s | 1,143 tok/s | 14.9 s | 44.5 ms |
| vLLM 3B BF16 | 33.1 tok/s | **1,651 tok/s** | **9.9 s** | **37.4 ms** |
| llm-rs 7B AWQ | 30.2 tok/s | 452 tok/s | 37.6 s | 114 ms |
| vLLM 7B AWQ | **44.8 tok/s** | **1,538 tok/s** | **10.6 s** | **39 ms** |

Three patterns:

1. **BF16, one at a time:** llm-rs leads on the A5000 (+32%) and ties on the Ada.
2. **4-bit weights:** vLLM pulls far ahead, both one at a time and under load.
3. **256 at once:** vLLM wins everywhere, with time to first token 1.5–3.5x shorter.

## 3. Why one at a time is close: it's a bandwidth problem

Generating a token for one request means reading every weight once. The 7B model in BF16 is 15 GB, so on a 768 GB/s card no engine can beat about **19.6 ms per token**. llm-rs takes 27.8 ms, about 70% of that limit, and vLLM takes 36.9 ms. With one request, the job is mostly about streaming weights well, and that's where llm-rs's kernels are strongest. Its one-warp-per-row matrix-vector kernels were tuned against exactly this limit.

4-bit weights should cut the time per token by close to 4x, since there are a quarter of the bytes to read. vLLM's Marlin kernels get most of that: 9.9 ms, against a floor of about 5 ms. llm-rs gets 1.2x. Three reasons:

- **The 4-bit kernel streams at about half bandwidth.** It reads roughly 390 GB/s on the A5000.
- **The 4-bit format is fatter.** llm-rs stores an f32 scale and offset for every 32 weights, which adds 50% more bytes. AWQ stores one FP16 pair per 128.
- **The output layer stays in BF16.** It's 1 GB on its own, about 15% of each step.

## 4. Why heavy load isn't: it's a compute problem

At 256 requests at once the GPU is **99.7% busy** in both engines, so the gap isn't idle time or scheduling. It's kernel speed. Here's the A5000 profile of llm-rs (Nsight Systems):

| Kernel | BF16 | AWQ |
|---|---:|---:|
| Matrix multiply (prompts and batched decode) | 81% | 88% |
| Decode attention | 13% | 8% |
| Everything else | 6% | 4% |

Processing 256 prompts of 256 tokens is about 0.9 PFLOP of math, so under load the engine is limited by compute, not memory. llm-rs's hand-written tensor-core GEMM ran at roughly a quarter of the card's tensor peak on these shapes, and vLLM's cuBLAS runs about twice that. The 4-bit path was slower still, because it staged weights through registers before the tensor-core instructions.

## 5. What I built in response

Three kernels, written on a laptop without a GPU and then tested on a rented one:

- **A prefill GEMM for large batches.** It uses 128x128 tiles and eight warps, and both operands stream into shared memory with asynchronous copies (`cp.async`) feeding BF16 `mma.sync`. 4-bit and 8-bit weights stream in still packed and are widened to BF16 just before the tensor cores, as Marlin does.
- **Faster decode attention.** Keys and values are copied into shared memory in their stored format, 16 bytes per thread with `cp.async`, and widened as they are read. The cache reads went from about 50 GB/s (on a 768 GB/s card) to about **115 GB/s on a 224 GB/s card**, and the results stay bit-identical to the old kernel.
- **A rewritten 4-bit matrix-vector kernel**, giving each lane whole blocks of 32 weights.

On the GPU, every test passed on the first build: 21 kernel tests, 161 library tests, and the end-to-end checks that batched output matches running each request alone.

## 6. The bug: every test passed, and it was 4x slower

Then the benchmarks came back worse than before:

- **The 4-bit kernel:** 7B AWQ one at a time fell from 30 to **7.4 tok/s**.
- **The new GEMM:** slower than the kernel it replaced, at 9.3 ms per call.

The cause was in the compiled PTX, not the source. Both kernels had small arrays (the GEMM's 64 accumulators, the gemv's loaded words) indexed inside loops that lived in **helper functions**. The Rust-to-PTX compiler (cuda-oxide) unrolls loops marked `#[unroll]` only in kernel bodies. LLVM left these helper loops rolled, so the arrays could not stay in registers and went to **local memory**, the GPU's slow per-thread memory. The GEMM was making 349 local-memory loads and stores per step of its main loop.

Tests can't see this: the results are correct, just slow. The fix was to move the loops into the kernel body, where they unroll. The GEMM dropped from 9.3 ms to **2.0 ms** per call, with no local memory left. I reverted the gemv rewrite for now. Every PTX build now gets a check that counts local-memory accesses per kernel.

After the fix, the new GEMM is only slightly ahead of the old path (time to first token 1–3% better), and it still takes 54–64% of the time under load. That's where the remaining gap is.

## 7. What's next

The profile gives a clear order:

1. **A deeper GEMM pipeline** (written, not yet measured). Three stages of copies in flight instead of two, and one barrier per step instead of two. To fit three stages in 48 KB of shared memory, rows lose their padding and their 16-byte chunks are shuffled with an XOR swizzle. Each warp read of 8 rows still lands in 8 different groups of shared-memory banks:

   ```
   chunk stored at slot = chunk XOR ((row / 2) % 4)

            G0  G1  G2  G3 | G4  G5  G6  G7
   row 0   [c0] c1  c2  c3 |
   row 1                   | [c0] c1  c2  c3
   row 2    c1 [c0] c3  c2 |
   row 3                   |  c1 [c0] c3  c2
   row 4    c2  c3 [c0] c1 |
   row 5                   |  c2  c3 [c0] c1
   row 6    c3  c2  c1 [c0]|
   row 7                   |  c3  c2  c1 [c0]

   reading chunk 0 of rows 0-7 uses every group once: one pass, not four
   ```

2. **BF16 activations end to end**, so each GEMM no longer needs a separate pass to convert its f32 input.
3. **Marlin-style 4-bit weights.** Weights get repacked at load time so one 16-byte load hands each thread its tensor-core fragment, with a cheaper 4-bit-to-BF16 conversion. This targets the biggest single gap: AWQ decode under load, at 114 ms per token vs 39 ms.
4. **cuBLAS as a yardstick** on the same shapes, so "how far from the best this card can do" becomes a measured number.

## 8. Takeaways

- **Pick the workload before the winner.** The same engine is ahead with one request at a time and 3x behind at 256. A single benchmark number would have told either story.
- **Profile before optimizing.** When the GPU is 99.7% busy, scheduler work won't help. The kernels have to get faster.
- **Read the PTX.** A kernel can be correct and 4x slower because one loop didn't unroll. Counting local-memory accesses takes a few lines of `awk`, and it's now part of every build.
- **Write offline, verify on rented hardware.** All of this was written without a GPU and tested in short sessions on cards that cost about a quarter an hour.
