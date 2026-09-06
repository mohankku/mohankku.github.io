---
layout: post
title: "Benchmarking a Local Coding Model: HumanEval, MBPP+, and Verify-Gated Self-Repair with Devstral 24B"
author: Mohan Kumar
tags: [agents, local-ai, ollama, benchmarking, humaneval, mbpp, evalplus, self-debug]
---

Cloud leaderboards tell you what a model can do on someone else's hardware with someone else's budget. I wanted to know what an open-weights model can do on *my* machine, inside *my* agent loop — so I benchmarked `devstral:24b` (local, via Ollama) on HumanEval and MBPP+, then measured how much of the gap a verify-gated repair loop closes. All runs are reproducible from [Zenith](https://github.com/mohankku/zenith)'s `scripts/` directory.

The headline numbers:

| Benchmark | Single-turn base | Single-turn Plus | After gated repair base | After gated repair Plus |
|---|---|---|---|---|
| HumanEval (164) | 86.0% | 79.9% | **91.5%** | **84.8%** |
| MBPP+ (378) | 75.1% | 65.6% | **85.2%** | **71.4%** |

Setup: one completion per task at temperature 0.2, scored with EvalPlus (base + hidden "plus" tests). The Plus column is the one I quote — more on why below.

---

## 1. The harness bug that scored everything 0.000

The first full HumanEval run generated all 164 completions, ran `evalplus.evaluate`, and reported `pass@1: 0.000`. Every single task "timed out" — including trivial ones the model obviously solved.

Root cause: EvalPlus workers call `setrlimit(RLIMIT_AS, 4GB)` to cap memory, and this machine rejects raising the address-space limit (`ValueError: current limit exceeds maximum limit`). Every worker crashed before running a single test; the harness recorded each crash as a timeout.

The fix uses EvalPlus's own escape hatch:

```bash
EVALPLUS_MAX_MEMORY_BYTES=-1 uv run python scripts/evalplus_devstral.py --limit 164
```

`-1` skips only the memory cap; the other sandbox guards stay on. Real scores: **86.0% base, 79.9% Plus**. Lesson re-learned: a benchmark score of exactly 0.000 (or 1.000) is a harness smell, not a model result. I baked the env default into the script so future runs can't silently score zero.

---

## 2. Naive self-debug doesn't work (I checked)

The obvious next step — feed the failing test output back and ask for a fix — went **0 for 2** on a probe of two failed tasks. Worse, one "repair" turned a clean `NameError` into an infinite loop (timeout). The model repeated the same wrong logic with different formatting.

That failure motivated the protocol that actually worked: **verify-gated repair**. Three rules:

1. **Gate on visible tests only.** A repair replaces the original only if it passes the base test suite. Otherwise round-0 stands — repairs that regress are discarded, not averaged in.
2. **Sample, then select.** Up to 3 candidates per round at temperature 0.6, up to 2 rounds. Diversity beats iteration depth for near-miss bugs.
3. **Never touch hidden tests during repair.** The Plus suite is the final exam; studying for it with the answer key would void the score.

---

## 3. HumanEval: 86.0% → 91.5% (and 8 of 9 fixes generalize)

Gated repair fixed 9 of 23 base failures. The part I care about: **8 of the 9 also pass the hidden Plus tests** — the model actually fixed the logic rather than overfitting the visible asserts. The 9th (HumanEval/91) passes base but still fails Plus: an honest partial win, reported as-is.

Failure clusters were unsurprising: string munging and numeric edge cases. Spot checks confirmed genuine reasoning slips (e.g. a factorization using trial division stepping by 1, dying on the large-prime stress test), not harness artifacts.

---

## 4. MBPP+: lower floor, stricter ceiling

MBPP+ (378 tasks) came in lower across the board: **75.1% base, 65.6% Plus**. MBPP tasks are shorter but fiddlier — exact output formats and off-by-one traps — and the Plus extra tests are brutal. The base→Plus gap is ~10 points vs ~6 on HumanEval: proportionally more misses are robustness, not core logic.

Repair fixed 39 of 94 base failures with zero regressions (all other 284 tasks byte-identical), lifting base to **85.2%**. But only **22 of 39 generalize to Plus** — a notably lower rate than HumanEval's 8/9, suggesting several repairs overfit the visible asserts. That's exactly why the Plus column is the quotable one: **65.6% → 71.4%** is the real gain; the base lift (+10) is flattered.

---

## 5. Caveats, stated plainly

- **One sample per task at temp 0.2** — treat every number as ±3 points. No variance bars were harmed in this post.
- **Contamination.** HumanEval is almost certainly in every model's training data; assume absolute scores are flattered. The Plus deltas are the more honest signal, and uncontaminated benches (LiveCodeBench) are next on my list.
- **This measures the model, not the agent.** The eval scripts call the provider single-turn; they bypass Zenith's ReAct loop entirely. Zenith itself runs verify-after-edit, a critic gate with Reflexion retries, and TDD reproduce→fix→verify guards by default — so these numbers are the floor of what the full agent should achieve, not the ceiling.

## 6. Reproduce it

```bash
# single-turn eval (resumable)
/opt/homebrew/anaconda3/bin/python scripts/evalplus_devstral.py --limit 164 --model devstral:24b
/opt/homebrew/anaconda3/bin/python scripts/evalplus_devstral.py --dataset mbpp --limit 378 --model devstral:24b

# gated repair (visible-tests only) + rescore
/opt/homebrew/anaconda3/bin/python scripts/selfdebug_repair.py --dataset mbpp
```

Next up: BigCodeBench for tool-use headroom, and the big prize — pointing the real Zenith agent loop (not single-turn probes) at tasks, plus real SWE-bench once I have Docker hardware. Terminal-Bench is blocked on this Mac for the same reason.
