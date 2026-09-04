---
layout: post
title: "Building Zenith: A Local-First Autonomous Coding Agent with Pluggable Models and Persistent Memory"
author: Mohan Kumar
tags: [agents, local-ai, systems, ollama, coding-assistant, memory]
---

Autonomous coding agents have rapidly evolved from simple chat completions into multi-turn loop runners that read, edit, execute, and verify software repositories. While cloud-hosted frontier models (Claude 3.7 Sonnet, GPT-4o) excel at architectural synthesis, relying entirely on remote APIs presents distinct tradeoffs: strict telemetry/privacy concerns for proprietary codebases, cumulative API costs, network latency, and zero offline availability.

I built [**Zenith**](https://github.com/mohankku/zenith) (formerly `mohan-agent`) to explore a local-first paradigm: running an autonomous agent driven by a local quantized open-weights model (such as `qwen3.5:9b` or `qwen2.5-coder:14b` via Ollama) on device hardware, equipped with persistent long-term memory, an AST-guided code intelligence layer, and a resilient 5-tier fuzzy edit engine.

Here is how Zenith is architected and the engineering lessons learned along the way.

---

## 1. Core Architecture & Execution Loop

Zenith is organized around a ReAct (Reason + Act) loop augmented by token compaction guards and safety checkpoints:

```
                  ┌──────────────────────────────┐
                  │      User Prompt / Task      │
                  └──────────────┬───────────────┘
                                 │
                   [Hydrate Long-Term Memory]
                    (.mohan-agent/memory.md)
                                 │
                                 ▼
            ┌──────────────────────────────────────────┐
            │   Model Router (Local Ollama / Cloud)    │
            └────────────────────┬─────────────────────┘
                                 │ Tool Calls
                                 ▼
            ┌──────────────────────────────────────────┐
            │           Tool Execution Core            │
            │  • File I/O & Multi-Strategy Patch       │
            │  • AST Code Intel (Def/Refs/Symbols)     │
            │  • Bash / Test-Runner (TDD Guards)       │
            │  • Memory Tools (remember_fact / recall) │
            └────────────────────┬─────────────────────┘
                                 │ Pre-mutation Snapshots (/undo)
                                 ▼
            ┌──────────────────────────────────────────┐
            │   Token Compactor & Context Guard        │
            └────────────────────┬─────────────────────┘
                                 │
                   Loop until task completed or test passes
```

Zenith exposes a unified CLI and interactive REPL:
```bash
# Run one-off command with local Qwen
zenith "analyze repo structure and add missing unit tests"

# Or enter the interactive REPL
zenith
> /diff
> /undo
> remember this project uses pytest and ruff
```

---

## 2. Model Routing: Local By Default, Cloud on Demand

A primary goal was ensuring Zenith works completely offline without transmitting a single byte of user source code to third-party servers. By default, Zenith connects to a local Ollama instance running `qwen3.5:9b` or `qwen2.5-coder`:

```yaml
# config.yaml
model:
  default_provider: ollama
  default_model: qwen3.5:9b
```

However, complex multi-file refactors occasionally benefit from frontier reasoning. Zenith implements a unified `ModelProvider` plugin interface:

```python
class ModelProvider(ABC):
    @abstractmethod
    def chat(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        temperature: float = 0.2,
    ) -> ModelResponse:
        pass
```

With providers registered via a lightweight decorator (`@register_provider("provider_name")`), switching execution engines is seamless at runtime:

```bash
# Frontier Cloud
zenith --provider anthropic --model claude-3-7-sonnet-20250219 "architect module"
zenith --provider gemini --model gemini-2.5-flash "profile memory"

# Local / OpenAI-Compatible (vLLM, DeepSeek, Ollama)
zenith --provider openai_compatible --base-url http://localhost:8000/v1 --model deepseek-coder
```

---

## 3. Persistent Two-Tier Memory Across Sessions

Most coding agents suffer from session amnesia: as soon as the process terminates, project context, linting configurations, build flags, and architectural decisions evaporate.

Zenith solves this through a **two-tier memory architecture** stored locally within the repository's `.mohan-agent/` directory:

1. **`memory.md` (Long-Term Semantic Facts)**:
   Curated architectural knowledge, directory conventions (e.g. `"uses poetry not pip"`, `"run tests with pytest -m unit"`), and user preferences.
   - Automatically injected into the system prompt at the start of every session.
   - The agent can explicitly invoke `remember_fact(key, value)` or `recall_memory(query)` during execution.
2. **`history.jsonl` (Short-Term Trajectory)**:
   Maintains the last 30 interaction turns, providing conversational continuity without overflowing context window token budgets.

```bash
zenith
> remember this project requires Python 3.11 and ruff format
[Memory updated in .mohan-agent/memory.md]

> /memory
• [env] Python 3.11, ruff format
• [testing] pytest tests/ --import-mode=importlib
```

---

## 4. The 5-Tier Resilient Edit & Patch Engine

One of the biggest failure modes of smaller local models (7B–14B parameters) is **syntactic edit drift**: when asked to replace code, they may output slightly different indentation (2 spaces instead of 4), collapse trailing whitespace, or omit unchanged comments. Standard `git apply` or exact string matching immediately rejects these diffs, causing agent loops to spin and fail.

Zenith implements a resilient 5-tier search-and-replace pipeline:

1. **Exact Match**: Instant deterministic slice replacement.
2. **Whitespace & Line-Ending Normalization**: Normalizes CRLF/LF line endings and trims trailing whitespace before comparison.
3. **Indentation Shift Adjustment**: Automatically computes the common indentation delta (e.g., model indented by 4 spaces instead of 2) and shifts the replacement block accordingly.
4. **Sliding-Window Fuzzy Match**: Uses `difflib.SequenceMatcher` across candidate line windows. If similarity exceeds threshold ($> 0.88$), it locates the intended target block despite comment drift.
5. **Pure-Python Unified Diff Fallback**: If structured replacement fails, Zenith parses unified diff chunks and reconciles line markers directly in Python, bypassing strict `patch` utility restrictions.

This multi-tier approach reduced tool execution errors from local models by over 60% in benchmarks.

---

## 5. Safety: Pre-Mutation Checkpoints, /undo, and /diff

When an agent operates autonomously with file-writing and bash capabilities, user trust requires instant rollback mechanisms. Zenith takes an in-memory snapshot of every touched file *prior* to mutation.

In the interactive REPL:
- `/diff` displays a color-coded unified diff of all edits made during the current session.
- `/undo` pops the most recent mutation snapshot and restores the affected files instantly.
- `/checkpoints` lists all rollback points with touched files and timestamps.
- `/compact` flushes conversation history into `memory.md` to reclaim context tokens when approaching context limits.

---

## 6. Takeaways

Building Zenith reinforced several core principles for edge and on-device AI engineering:
- **Small local models punch above their weight with scaffolding**: A 9B model equipped with AST symbols, resilient edit engines, and persistent memory frequently accomplishes the same day-to-day coding tasks as frontier cloud models, with zero latency and complete data privacy.
- **Memory should be human-readable**: Storing memory in plain Markdown files (`.mohan-agent/memory.md`) allows developers to inspect, edit, or commit agent knowledge directly alongside code.
- **Fail gracefully on tool drift**: Agent robustness depends less on prompt phrasing and far more on lenient, multi-tier tool execution fallbacks.

The project is open source and actively maintained at [**github.com/mohankku/zenith**](https://github.com/mohankku/zenith).
