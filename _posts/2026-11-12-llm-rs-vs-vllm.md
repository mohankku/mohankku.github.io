---
layout: post
title: "llm-rs vs vLLM: What Actually Decides LLM Serving Speed"
author: Mohan Kumar
series: llm-rs
tags: [rust, cuda, llm-inference, gpu-kernels, vllm, roofline]
---

I benchmarked [llm-rs]({% post_url 2026-11-09-llm-rs-cutile-simt-kernels %}), my Rust inference engine, against **vLLM** on the same GPUs and models. With one request at a time llm-rs keeps up, and with BF16 weights it can lead. With 256 requests at once vLLM is 1.4–3.4x faster. Both results come from a handful of ideas about how a GPU spends its time, and this post explains those ideas, using the benchmark numbers as worked examples.

The setup: Qwen2.5 models (7B in BF16 and 4-bit AWQ, 3B in BF16) on an RTX A5000 (768 GB/s) and an RTX 2000 Ada (224 GB/s). Both servers were capped at 64 concurrent sequences and faced the same client. Prompts were 256 tokens.

| | One request at a time | 256 requests at once |
|---|---:|---:|
| 7B BF16, A5000: llm-rs / vLLM | **35.5** / 27.0 tok/s | 709 / **1,208** tok/s |
| 7B AWQ, A5000: llm-rs / vLLM | 41.2 / **94.6** tok/s | 550 / **1,878** tok/s |
| 3B BF16, RTX 2000 Ada: llm-rs / vLLM | 32.4 / 33.1 tok/s | 1,143 / **1,651** tok/s |

## 1. Every kernel is limited by memory or by math

A GPU kernel takes at least the larger of two times:

```
time ≈ max( bytes moved / memory bandwidth ,  FLOPs / math throughput )
```

Which one wins depends on **arithmetic intensity**: FLOPs done per byte read. An RTX A5000 reads about 768 GB/s and does roughly 110 TFLOPS of dense BF16 tensor-core math, a ratio of about **145 FLOPs per byte**. A kernel below that ratio waits on memory; above it, on math. This is the roofline model, and nearly everything below follows from it.

## 2. Decode with one request is a memory problem

To produce one token, the model multiplies every weight matrix by one vector. Each BF16 weight (2 bytes) gets used for one multiply and one add, so 2 FLOPs per 2 bytes: an intensity of **1**, more than 100x below the ridge. The math units sit mostly idle; the job is streaming weights.

That gives a hard floor. Qwen2.5-7B in BF16 is about 15 GB, and 15 GB / 768 GB/s = **19.6 ms per token**, so no engine can beat about 51 tokens/s for a single stream on that card. The question for single-stream decode is how close a kernel gets to streaming at full bandwidth:

- llm-rs: 27.8 ms per token, about **70% of the floor**. Its matrix-vector kernels give each output row to one warp, whose 32 lanes read consecutive memory, the access pattern DRAM serves fastest.
- vLLM: 36.9 ms per token.

That's why the one-at-a-time column is close: both engines are fighting the same bandwidth limit, and hand-tuned matrix-vector kernels are enough to win it.

## 3. Batching moves decode from memory toward math

Now serve 64 requests at once. The weights are read **once per step** and used for all 64 tokens, so the intensity rises to about 64 FLOPs per byte. The step takes barely longer than a single-token step, but produces 64 tokens. This is why throughput at 256-at-once is 20–45x the one-at-a-time number, and why **continuous batching** is the core idea of modern serving: keep as many requests in each step as possible, admitting new ones as old ones finish.

Two things limit how far batching goes:

- **Past the ridge (~145 tokens per step here), a step is bound by math**, and the speed of the matrix-multiply kernel decides everything.
- **The KV cache.** Each request's past keys and values are re-read every step. For Qwen2.5-7B that is 2 (K and V) x 28 layers x 4 KV heads x 128 dims x 2 bytes = **57 KB per token of context**. At 64 requests with ~400 tokens each, that's ~1.5 GB per step, a tenth of the weights, and it grows with every generated token. Two ideas keep it in check:
  - **Grouped-query attention (GQA):** 28 query heads share 4 KV heads, so the cache is 7x smaller than it would be. A good kernel loads each KV head once for all 7 query heads that use it.
  - **Paged KV memory (vLLM's PagedAttention):** the cache lives in fixed-size blocks found through a table, so memory isn't reserved for each request's maximum length. More requests fit, so batches get bigger.

## 4. Under load, everything comes down to the GEMM

With 256 requests arriving together, the server also has to process 256 prompts of 256 tokens. A prompt is the extreme case of batching: hundreds of tokens against the same weights, far past the ridge. 65,536 prompt tokens x 2 FLOPs x 7B weights is about **0.9 PFLOP** of matrix multiplication.

The profile of llm-rs under that load shows where the time goes:

| What the GPU was doing (7B, A5000) | BF16 | AWQ |
|---|---:|---:|
| Matrix multiply (prompts and batched decode) | 81% | 88% |
| Decode attention | 13% | 8% |
| Everything else | 6% | 4% |
| **GPU busy** | 99.7% | 99.8% |

The GPU is never idle, so scheduling isn't the gap. The gap is how many FLOPs per second the matrix multiply (GEMM) achieves. llm-rs's hand-written tensor-core GEMM reaches roughly a quarter of the card's tensor peak on these shapes; vLLM uses cuBLAS, which by my estimate gets about twice that. That one kernel accounts for most of the 1.7x difference at 256-at-once.

## 5. What makes a GEMM fast

Reaching the tensor cores' peak is mostly about keeping them fed. Four ideas do most of the work.

**Tiling for reuse.** A block of threads computes a 128 x 128 tile of the output. It loads a 128-row slice of the input and of the weights into on-chip **shared memory**, and every loaded value is used 128 times. Bigger tiles mean fewer bytes per FLOP, which pushes the kernel past the ridge point.

**Tensor-core instructions.** Each warp issues `mma.sync`, which multiplies a 16x16 by 16x8 block of BF16 values into FP32 sums in one instruction. Operands come from shared memory via `ldmatrix`, which loads them straight into the register layout the instruction expects.

**Pipelining.** Loading the next slice of K must overlap with computing on the current one. Asynchronous copies (`cp.async`) let a block start fetching step *s + 2* while computing step *s*. Each extra stage gives slow memory more time to arrive, at the cost of more shared memory per block.

**Bank-conflict-free layouts.** Shared memory is split into 32 banks of 4 bytes. If several threads of a warp read different addresses in the same bank, the reads are serialized. `ldmatrix` reads one 16-byte chunk from each of 8 consecutive rows. With rows of 64 bytes, those 8 reads pile into the same two groups of banks: a 4-way conflict. Padding each row fixes it but wastes 25% of shared memory. An **XOR swizzle** fixes it for free, by storing chunk *c* of row *r* at slot *c XOR ((r / 2) mod 4)*:

```
           bank groups (4 banks each)
          G0  G1  G2  G3 | G4  G5  G6  G7
row 0    [c0] c1  c2  c3 |
row 1                    | [c0] c1  c2  c3
row 2     c1 [c0] c3  c2 |
row 3                    |  c1 [c0] c3  c2
row 4     c2  c3 [c0] c1 |
row 5                    |  c2  c3 [c0] c1
row 6     c3  c2  c1 [c0]|
row 7                    |  c3  c2  c1 [c0]

chunk 0 of rows 0-7 lands in all 8 groups: one pass instead of four
```

A fifth idea is easy to miss: **everything hot must stay in registers.** A warp's 64 x 32 output tile is 64 FP32 sums per thread. If the compiler can't keep them in registers, for example because a loop indexing them wasn't unrolled, they spill to *local memory*, per-thread storage backed by DRAM. I hit exactly this: a GEMM whose accumulators had spilled was **4.6x slower** (9.3 ms vs 2.0 ms per call) and passed every correctness test. The only reliable check is to read the compiled PTX and count `ld.local`/`st.local` instructions.

## 6. Quantization helps memory-bound work, and can hurt compute-bound work

4-bit weights cut bytes by 4x, so they should help wherever bandwidth is the limit. Two details decide how much.

**The format's overhead.** Weights are stored in groups, each with a scale (and often a zero point):

| Format | Bits per weight |
|---|---:|
| BF16 | 16 |
| AWQ: 4-bit, FP16 scale + zero per 128 | 4 + 32/128 = **4.25** |
| llm-rs today: 4-bit, f32 scale + offset per 32 | 4 + 64/32 = **6** |

**The cost of unpacking.** Each 4-bit code has to become BF16 before the tensor cores can use it. In the memory-bound regime that work hides behind the memory traffic. In the compute-bound regime it adds instructions to an already-full pipeline, and the FLOP count doesn't drop at all.

The benchmark shows both effects:

- **One at a time (memory-bound),** vLLM's AWQ runs at 9.9 ms per token, within 1.6x of the ~6 ms floor (4.25-bit weights plus a BF16 output layer). llm-rs gets 23.7 ms: its format is 40% fatter, its 4-bit kernel streams at about half bandwidth, and its output layer stays in BF16 (1 GB by itself).
- **Under load (compute-bound),** llm-rs's AWQ is *slower* than its BF16 (550 vs 709 tok/s): it unpacks weights through registers before each multiply. vLLM's AWQ is *faster* than its BF16 (1,878 vs 1,208) thanks to **Marlin**, a GEMM built for 4-bit weights. Marlin reorders the weights at load time so that one 16-byte load hands each thread exactly the fragment it needs. It converts 4-bit codes to BF16 with a few bit operations instead of float math, and it keeps several asynchronous copy stages in flight. Much of a decode batch stays memory-bound, so fewer bytes still win.

## 7. Reading the scoreboard

With those ideas, each cell of the opening table has a reason:

| Result | Why |
|---|---|
| llm-rs leads 7B BF16 one at a time | Both engines are bandwidth-bound; llm-rs's matrix-vector kernels stream closer to the 19.6 ms floor |
| vLLM leads 2.3x on AWQ one at a time | Compact 4.25-bit format and Marlin kernels near the bandwidth floor |
| vLLM leads 1.4–1.7x on BF16 under load | Compute-bound GEMM: cuBLAS gets about twice the tensor throughput |
| vLLM leads 3.4x on AWQ under load | Marlin keeps 4-bit fast under load; llm-rs's unpacking makes 4-bit slower than BF16 |

So the roadmap for llm-rs is the GEMM, in order:

1. **Deeper pipelines and swizzled shared memory** for the BF16 GEMM.
2. **BF16 activations end to end**, so no conversion pass sits in front of each GEMM.
3. **Marlin-style 4-bit**: reordered weights, bit-trick unpacking, and a compact AWQ-sized format.

## 8. Takeaways

- **Ask which roof you're under.** With one request, decode is about bandwidth; with many requests and prompts, it's about the GEMM. The same engine can win one and lose the other.
- **Batching is the multiplier.** Continuous batching and paged KV memory exist to make each weight read serve as many tokens as possible.
- **Quantization is a bandwidth tool.** It pays off when bytes are the limit, and only if the format is compact and unpacking is nearly free.
- **A kernel can be correct and 4x slow.** Registers, shared-memory banks, and pipeline depth don't show up in correctness tests; read the PTX and profile against a ceiling.
