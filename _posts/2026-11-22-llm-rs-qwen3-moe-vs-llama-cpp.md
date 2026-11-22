---
layout: post
title: "llm-rs vs llama.cpp on Qwen3-30B-A3B: Mixture-of-Experts on One GPU"
author: Mohan Kumar
series: llm-rs
tags: [rust, cuda, llm-inference, mixture-of-experts, qwen3, llama-cpp, int4]
---

This post covers adding mixture-of-experts models to llm-rs, starting with Qwen3-30B-A3B, and how it compares with llama.cpp on one 24 GB RTX A5000. It was prompted by [a comparison of vLLM and SGLang offloading MoE experts](https://dplouffe.ca/2026/11/15/vllm-vs-sglang-moe-offload/).

The short version:
- **Everything on the GPU:** llm-rs is ahead with 16 requests at once (439 vs 424 tokens/s) and behind with one request (127 vs 135 tokens/s).
- **Experts that don't fit:** when three quarters of the experts stay in host memory, llm-rs is 5.8× faster than llama.cpp for one request.

## Why MoE is different

Qwen3-30B-A3B has 30.5B parameters, but only about 3.3B are used per token. Each of its 48 layers has 128 small feed-forward networks, the experts: 2048 → 768 → 2048, gated with SiLU. A router picks 8 of them for each token. Attention is ordinary grouped-query attention: 32 query heads, 4 KV heads, head_dim 128.

That changes what's expensive:
- **Decode:** a token reads only 8 of the 128 experts' weights per layer. Which 8 changes with every token.
- **Batches:** 16 requests decoding together route 128 (token, expert) pairs per layer, but only to about 80 distinct experts. An engine that reads each expert once per step instead of once per pair saves almost half the weight traffic.
- **Prefill:** a 256-token prompt routes 2,048 pairs per layer, about 16 per expert. That's too few rows per expert for a matrix-multiply kernel to be efficient unless all the experts run in one launch.
- **Memory:** at 4 bits the experts are 14.5 GB of the model's ~17 GB. If they don't all fit, the question is whether the missing ones should be copied in over PCIe or computed on the CPU.

## The setup

Everything ran on one RunPod pod, both engines on the same machine, on November 22, 2026.

**Hardware**
- GPU: NVIDIA RTX A5000, 24 GB, 768 GB/s, driver 595.112.07, CUDA 13.2
- Host: Intel Xeon Gold 6342 @ 2.80 GHz, 9 vCPUs and 50 GB of RAM allotted to the pod

**Model**
- llm-rs: [Qwen/Qwen3-30B-A3B](https://huggingface.co/Qwen/Qwen3-30B-A3B) in BF16 (57 GB on disk), quantized as it loads with `--quantization int4-g128`. That's asymmetric INT4 with a scale and an offset per 128 weights, about 4.5 bits a weight. The router stays in BF16.
- llama.cpp: [unsloth/Qwen3-30B-A3B-GGUF](https://huggingface.co/unsloth/Qwen3-30B-A3B-GGUF), `Qwen3-30B-A3B-Q4_K_M.gguf` (18.6 GB). Q4_K_M mixes 4- and 6-bit blocks and averages about 4.9 bits a weight, so llama.cpp reads somewhat more bytes per token and should be slightly more accurate.

**Servers**
- llm-rs (Rust, hand-written CUDA kernels):
  ```
  serve --device cuda --quantization int4-g128 --max-num-seqs 16 --model-dir qwen3-30b-a3b
  ```
  For the offloaded run, add `LLM_RS_MOE_GPU_EXPERTS=32`.
- llama.cpp, commit `f505c30` (Nov 22, 2026), built with `-DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=86`:
  ```
  llama-server -m Qwen3-30B-A3B-Q4_K_M.gguf -ngl 99 --n-cpu-moe 0 -c 16384 -np 16
  ```
  For the offloaded run, `--n-cpu-moe 36`. The 16 slots share the 16k-token context, which is 1,024 tokens each, enough for 256 in and 128 out.

**Load**

Both servers were measured with the same client, llm-rs's `bench_serve`, a Rust port of vLLM's `benchmark_serving.py`. Each request:
- has a 256-token prompt of random token ids, so there are no prefix-cache hits;
- asks for exactly 128 output tokens (`max_tokens: 128, ignore_eos: true`) at temperature 0;
- streams its tokens back through the OpenAI-compatible `/v1/completions`.

The requests are sent all at once (`--request-rate inf`), with a concurrency cap of 1 (2 requests) or 16 (32 requests). The metrics are:
- **output tokens/s** across the whole run;
- **median time to first token (TTFT)**;
- **median time per output token after the first (TPOT)**.

**Offload configurations**

The two engines offload differently, so the offloaded runs aren't the same split:
- **llama.cpp (`--n-cpu-moe 36`):** the experts of 36 of the 48 layers live in host memory and run on the CPU. The GPU holds every expert of the other 12 layers, a quarter of all experts.
- **llm-rs (`LLM_RS_MOE_GPU_EXPERTS=32`):** every layer keeps 32 of its 128 experts in GPU slots, also a quarter, and keeps all 128 in pinned host memory. Before a step runs, the experts it routes to are copied into slots, least recently used first. All the computing happens on the GPU.

## Results: everything on the GPU

| Engine | GPU memory | 1 at a time: tokens/s | TTFT | TPOT | 16 at once: tokens/s | TTFT | TPOT |
|---|---|---|---|---|---|---|---|
| llm-rs | 21.3 GB | 126.8 | **188 ms** | 6.70 ms | **439.1** | 718 ms | **30.9 ms** |
| llama.cpp | 19.4 GB | **134.8** | 257 ms | **6.19 ms** | 424.3 | **621 ms** | 33.1 ms |

The result is split:
- **One request:** llama.cpp decodes about 8% faster per token, and llm-rs starts answering 27% sooner.
- **16 requests:** llm-rs decodes 7% faster per token and has 3.5% more throughput, and llama.cpp gets the first token out sooner.

Both engines answer "The capital of France is" with " Paris." llm-rs's GPU memory includes a KV cache that grows to fill whatever the weights leave free, so its 21.3 GB isn't the minimum it needs.

## Results: three quarters of the experts off the GPU

| Engine | GPU memory | 1 at a time: tokens/s | TTFT | TPOT | 16 at once: tokens/s | TTFT | TPOT |
|---|---|---|---|---|---|---|---|
| llm-rs, 32 of 128 experts a layer on the GPU | 21.3 GB | **40.7** | 1,127 ms | **23.8 ms** | **25.5** | **3.8 s** | **604 ms** |
| llama.cpp, 12 of 48 layers' experts on the GPU | 7.1 GB | 7.0 | **1,000 ms** | 136.5 ms | 18.2 | 5.8 s | 843 ms |

**One request at a time:** paging experts over PCIe is 5.8× faster than running them on 9 vCPUs. A single request reuses many of the same experts from token to token, so most steps find their experts already in a slot, and the GPU computes them far faster than the CPU can.

**16 requests at once:** both engines collapse. Sixteen requests route to about 80 distinct experts per layer, so llm-rs has to reload around 50 experts per layer every step, about 6 GB over PCIe. llama.cpp's CPU has to compute 36 layers of experts for 16 tokens. llm-rs is still 1.4× ahead, but neither is usable at this concurrency.

**Memory:** llama.cpp's GPU memory really does drop, to 7.1 GB. llm-rs hands what paging frees to the KV cache, so its GPU memory stays at 21.3 GB. Capping that is on the list.

## How llm-rs got here

The first working version was much slower. Three changes on the GPU path closed the gap. All four rows use the same card and the same load; the first was measured a day earlier, on a different pod:

| llm-rs version | 1 at a time: tokens/s | TTFT | TPOT | 16 at once: tokens/s | TTFT | TPOT |
|---|---|---|---|---|---|---|
| First version: a kernel launch per (token, expert) pair | 53.3 | 1,274 ms | 9.07 ms | 67.3 | 12.7 s | 139 ms |
| + prefill experts on the tensor cores | 76.8 | 590 ms | 8.97 ms | 164.1 | 1.61 s | 86.1 ms |
| + decode grouped by expert | 97.2 | 522 ms | 6.49 ms | 354.2 | 1.55 s | 33.6 ms |
| + prefill grouped by expert, one launch | 126.8 | 188 ms | 6.70 ms | 439.1 | 718 ms | 30.9 ms |

**1. Tensor cores for prefill.** For each layer, the routing results came back to the host, the pairs were sorted by expert there, and each expert's rows ran through llm-rs's existing INT4 prefill GEMM. That GEMM reads the stacked expert weights directly at an offset, with no copy.

**2. Decode grouped by expert.** A small kernel sorts the step's pairs by expert on the GPU, with no host round trip, so decode steps can still run as CUDA graphs. Then one block per (row tile, expert) reads each weight word once and applies it to up to four of that expert's tokens. The block reuses the dense INT4 kernels' load pattern: 16-byte input loads and several weight rows per warp.
- **16 requests:** 2.6× faster per token. Most of that is reading each expert once instead of once per pair.
- **One request:** 1.4× faster per token, from the better loads alone. One token gets no reuse.

My earlier attempt at grouping had been slower. It always computed eight pairs per block, even when an expert had only one, so at one request it did eight times the arithmetic for nothing. The fix is a uniform branch that skips the unused slots.

**3. Prefill grouped by expert, in one launch.** Step 1 still waited on the host and launched about 256 small GEMMs per layer, each only 12–16 blocks wide on a 64-SM GPU. Now:
- the GPU sorting kernel also writes a work list: one item per (expert, up to 128 rows);
- the prefill GEMM gained a mode where block (b, i) runs work item i against its expert's slice of the weights;
- every expert's gated MLP is then one launch, and every expert's down projection another.

With one request, time to first token fell from 514 ms to 188 ms. With 16 it fell from 2.35 s to 718 ms. Each row is computed exactly as before, so the logits match the old path bit for bit.

**Checks.** Each step was checked the same way as earlier models. Qwen3-30B-A3B truncated to 4 layers, compared on a 13-token prompt:
- llm-rs's CPU path against Hugging Face transformers in float32: max logit difference 4e-5;
- every GPU path against the CPU in the same INT4 format: the same top token at every position, cosine 0.999998 or better.

## How fair is this?

These are the caveats I'd want to know as a reader:
- **One run per configuration.** The 16-at-once runs are 32 requests each, and sessions varied by about 0.2 ms per token. A 3.5% lead is at the edge of what one run can show. I'd want three runs of each, interleaved, before calling it.
- **Different quantization.** Q4_K_M uses about 0.4 bits more per weight than int4-g128 and loses less accuracy. A same-format comparison isn't possible: llm-rs doesn't read GGUF, and llama.cpp doesn't read llm-rs's format.
- **Not interleaved.** llama.cpp ran once, between llm-rs's runs, on the same pod and the same day. The llm-rs rows in the "How llm-rs got here" table are each paired with a same-session control run.
- **Output length not checked for llama.cpp.** I didn't confirm that llama.cpp honored `ignore_eos` on every request. TPOT doesn't depend on it, but tokens/s would be lower if a request stopped early. Random-token prompts make an early stop unlikely.
- **Different offload splits.** The offloaded runs compare per-layer splits (llama.cpp) against per-expert ones (llm-rs). Both hold about a quarter of the experts on the GPU, but they're different quarters. llm-rs also keeps the full GPU memory.
- **llama.cpp settings.** Defaults for everything except the flags above. Some other flags might well make llama.cpp faster on this card, and I didn't search for them.

## What's next

- **One request, all on the GPU:** llm-rs is 0.5 ms per token behind llama.cpp. A profile should show whether the gap is in the experts, in attention, or in the many small kernels between them.
- **Paging under load:** overlap the expert copies with computing the previous layer, give more slots to layers that miss more, and cap the KV cache so paging actually frees GPU memory.
- **Bigger batches:** above 16 requests each expert gets more tokens per step, and the decode kernel's chunks of four and the switch to the tensor-core path need retuning.

All the numbers are in the llm-rs repo's `docs/PERF.md`.
