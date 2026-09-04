---
layout: post
title: "From FP32 to NPU: Quantization, Fusion, and Lowering with PyTorch and ExecuTorch"
author: Mohan Kumar
tags: [quantization, executorch, pytorch, NPU, edge-ML]
---

Getting a neural network off a workstation GPU and onto a phone or headset NPU is not one step — it is a pipeline of graph transformations, each with its own optimizations. This post walks the full path: an FP32 PyTorch model, through quantization and operator fusion, down through lowering to a delegated NPU binary with ExecuTorch.

## 0. Why this pipeline exists

On an edge SoC, inference cost is dominated by **memory traffic, not FLOPs**. An FP32 ResNet-50 is ~100 MB of weights; every inference drags all of it through a narrow bus while a small NPU's MAC array sits idle waiting. Quantization shrinks the traffic 2–4x and matches the INT8 datapaths NPUs are built around. Lowering then reshapes the program itself — fusing ops, pre-laying-out memory, and carving out subgraphs the NPU can execute natively. Each stage exists to remove a different bottleneck.

## 1. The starting point: an FP32 model and a captured graph

Everything begins with ordinary eager PyTorch, but optimizers can't work on Python bytecode — they need a graph. The modern capture path is `torch.export`:

```python
example = (torch.randn(1, 3, 224, 224),)
exported: torch.export.ExportedProgram = torch.export.export(model.eval(), example)
```

Under the hood, TorchDynamo traces bytecode into an FX graph of ATen operators with shapes and dtypes specialized. This `ExportedProgram` (the "ATen dialect") is the currency every later stage trades in: quantization inserts observers into it, lowering rewrites it, the partitioner cuts it up.

## 2. Quantization

Quantization maps floats to a low-bit grid:

```
x_q = clamp(round(x / s) + z),        x_hat = s * (x_q - z)
```

where `s` is the scale and `z` the zero-point. Two decisions define a scheme: **symmetric** (`z = 0`, one scale for a symmetric range — standard for weights) vs **asymmetric** (nonzero `z`, tighter fit for skewed activations like post-ReLU), and **granularity**: one `(s, z)` per tensor vs per channel (near-mandatory for weights, especially depthwise convolutions where channels have wildly different ranges).

**PTQ vs QAT.** Post-training quantization picks `(s, z)` after training by running representative data through the model and recording activation ranges ("calibration": min-max, moving-average, or histogram/KL methods that trade a little clipping for finer resolution of the dense region). Quantization-aware training instead inserts fake-quantize ops *during* training so the network adapts its weights to the grid; it recovers the last 1–2% of accuracy on sensitive models but costs a retraining loop. On-device practice is overwhelmingly PTQ first, QAT only where accuracy demands it.

**Where it happens in the ExecuTorch flow matters:** quantization runs *before* lowering, in PyTorch land (`prepare_pt2e` → calibrate → `convert_pt2e`, with a quantizer such as `XNNPACKQuantizer` for CPU or a backend-specific one like `QnnQuantizer` that matches the NPU's exact numeric behavior). The output is a graph whose linear layers carry quantized weights — the artifact lowering will consume.

## 3. Optimizations during quantization: fusion

The single most important quantization-time optimization is **operator fusion**, and batch-norm folding is the canonical example. At inference time batch norm is an affine map, `y = γ(x−μ)/σ + β`, so it can be absorbed into the preceding convolution algebraically:

```
W' = W · γ/σ,        b' = (b − μ) · γ/σ + β
```

Fusing conv+bn (+relu) before quantizing buys three things at once: the BN parameters and their memory traffic disappear; the quantizer sees one operator with one scale/zero-point instead of three chained ones (every quantize/dequantize boundary injects rounding noise, so fewer boundaries means less error); and the backend later receives a single fused kernel instead of three dispatches. In eager PyTorch this is `fuse_modules(model, [["conv", "bn", "relu"]])`; in the export-based flow the same fusion is expressed as graph patterns the quantizer recognizes. The principle is identical: **never quantize across a boundary you could have erased.**

## 4. Lowering, step by step

Lowering converts the portable graph into an executable artifact. In ExecuTorch it is an explicit, inspectable sequence:

1. **Edge dialect.** `to_edge()` rewrites the ATen graph into a constrained opset: functional (no mutation), no data-dependent control flow, no dynamic shapes beyond declared constraints. If your model can't be expressed here, it can't run on-device — this stage is where that verdict arrives early instead of at 2 AM on hardware.
2. **Decomposition.** Complex ops are broken into core ATen ops via the decomposition table (e.g., a `layer_norm` becomes reductions and elementwise math). Quantized layers appear in their decomposed form — `dequantize → fp-op → quantize` sandwiches — which looks verbose but is deliberate: it exposes the boundaries the next passes will optimize.
3. **Partitioning / delegation.** A backend *partitioner* tags the subgraphs an accelerator supports ("this conv chain can run on the NPU; this custom op cannot"). Each tagged partition is handed to the backend's ahead-of-time compiler, which returns an opaque blob (compiled NPU binary, Core ML model, QNN graph). Untagged ops stay on CPU (XNNPACK) as fallback.
4. **Finalization.** `to_executorch()` emits the `.pte` file: bytecode for the CPU parts, delegate blobs for the NPU parts, and a static memory plan.

```python
edge = exir.to_edge(quantized_program)     # 1+2: edge dialect, decomposed
edge = edge.to_backend(QnnPartitioner())   # 3: delegate NPU subgraphs
with open("model.pte", "wb") as f:         # 4: executable artifact
    f.write(edge.to_executorch().buffer)
```

## 5. Optimizations during lowering

With the graph fully visible, the lowering passes do the work that makes on-device execution fast:

- **Quantize/dequantize cleanup.** The sandwiches from step 2 are matched back into single quantized kernels (`qconv`, `qlinear`) wherever producer and consumer scales permit — the rounding-error equivalent of the fusion in section 3, now at graph scope.
- **Constant folding and propagation.** Anything computable at compile time (reshapes of constants, folded scales, static slices) is evaluated once on the host and baked in as bytes.
- **Dead-code and common-subexpression elimination.** Export often leaves redundant transposes, unused branches, and duplicated shape math; these passes strip them before they cost cycles or bytes.
- **Layout transformation.** NPUs typically want channels-last (NHWC) while PyTorch defaults to NCHW. The lowering inserts layout conversions and then *pushes them to the graph boundaries*, so the entire interior runs in the accelerator's native layout with conversions only at input/output.
- **Static memory planning.** Because shapes are frozen, every tensor's lifetime is known at compile time. The planner allocates one arena and reuses buffers whose lifetimes don't overlap — no allocator, no fragmentation, no `malloc` in the hot path. This is a large part of why `.pte` files boot instantly and sip RAM.
- **Partition hygiene.** Every CPU↔NPU boundary costs a copy and a synchronization. A model split into twenty tiny partitions can run *slower* than fewer, larger ones; good lowering (and good model design) minimizes boundary crossings, sometimes by leaving a fusible op on CPU-adjacent fallback rather than shattering a partition.

## 6. At runtime

The ExecuTorch runtime loads the `.pte`, maps the arena, and walks the bytecode: CPU ops execute via kernels (XNNPACK), delegate blobs execute on the NPU through the backend driver, tensors hand off at the planned boundaries. If a delegate call fails, execution can fall back to CPU — graceful degradation instead of a crash, bought by the partition structure from section 4.

## 7. A practical checklist

1. `torch.export` a representative, eval-mode model; confirm it replays numerically.
2. Fuse (conv+bn+relu at minimum) *before* choosing quantization parameters.
3. PTQ with calibration data that covers deployment inputs; per-channel weights; check accuracy — QAT only if needed.
4. `to_edge`, inspect the partition report: which ops fell back to CPU, and why?
5. Iterate on fragmentation: unsupported-ops islands are usually fixed by decomposing, replacing, or pre/post-processing them on CPU by design.
6. Measure on hardware with the backend's profiler — delegate time vs boundary-copy time tells you whether to fuse more or partition less.

## Closing

The pipeline is long, but each stage has one job: quantization shrinks the data, fusion erases boundaries, lowering reshapes the program for the hardware, and the runtime just walks the plan. Internalize that division of labor and every accuracy drop or perf cliff maps to exactly one stage — which is what makes on-device deployment debuggable instead of mystical.
