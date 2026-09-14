#!/usr/bin/env python3
"""Persistent mflux worker: loads Qwen-Image-Edit ONCE, serves many edits.

Run with the project .venv python (it needs mflux + mlx):
  ./.venv/bin/python script/mflux-worker.py

Protocol — one JSON object per stdin line:
  {"src": "/tmp/.../input.jpg", "prompt": "...", "steps": 20,
   "seed": 123, "out": "/tmp/.../output.png"}
One JSON object per stdout line in reply:
  {"ok": true, "out": "/tmp/.../output.png"}
  {"ok": false, "error": "..."}
First stdout line after the model is loaded:
  {"ready": true, "model": "qwen-image-edit"}

Memory posture mirrors the CLI's --low-ram: tiled VAE decode plus a
MemorySaver that evicts the text encoders after encoding and caps the
MLX cache at 1 GB. The transformer is KEPT (keep_transformer=True):
unlike the one-shot CLI, evicting it here would force a reload per edit.
"""

import json
import sys

GUIDANCE = 2.5  # same default the CLI uses for kontext-style edits
SCHEDULER = "linear"
MODEL_NAME = "qwen-image-edit"


def main():
    import gc

    import mlx.core as mx

    from mflux.models.common.vae.tiling_config import TilingConfig
    from mflux.models.qwen.variants.edit.qwen_image_edit import QwenImageEdit

    # NOTE: no MemorySaver here on purpose. It deletes the text encoders
    # after the first generate with no reload path (built for the one-shot
    # CLI), which breaks every later edit. Instead we keep everything
    # resident and do the cheap parts of low-RAM mode manually: tiled VAE,
    # a 1 GB MLX cache cap, and a gc + cache clear between edits.
    model = QwenImageEdit(quantize=4)
    if model.tiling_config is None:
        model.tiling_config = TilingConfig()
    mx.set_cache_limit(1000**3)
    sys.stdout.write(json.dumps({"ready": True, "model": MODEL_NAME}) + "\n")
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            job = json.loads(line)
            image = model.generate_image(
                seed=int(job["seed"]),
                prompt=str(job["prompt"]),
                image_paths=[str(job["src"])],
                num_inference_steps=int(job["steps"]),
                guidance=GUIDANCE,
                scheduler=SCHEDULER,
            )
            image.save(path=str(job["out"]), export_json_metadata=False)
            gc.collect()
            mx.clear_cache()
            reply = {"ok": True, "out": str(job["out"])}
        except Exception as e:  # noqa: BLE001 - report back, never die silently
            reply = {"ok": False, "error": str(e)[:500]}
        sys.stdout.write(json.dumps(reply) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
