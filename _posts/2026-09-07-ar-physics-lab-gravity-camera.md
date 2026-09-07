---
layout: post
title: "AR Physics Lab: Measuring Gravity with a Camera, a Stopwatch, and Zero Servers"
author: Mohan Kumar
tags: [physics, computer-vision, local-first, ollama, jekyll, javascript]
---

I wanted a physics lab that runs anywhere — no backend, no video uploads, no app install. The result is this site's [/physics](/physics) page: an AR free-fall lab where a virtual ball falls over your live camera feed, and real drops can be timed or auto-tracked to measure `g`. All vision runs on-device in vanilla JS.

The page has one live experiment (Exp 01 — Dropping a Ball) with four modes. Three more cards (projectile, pendulum, air friction) are placeholders.

## 1. Mode 1: AR simulate — the hook

A virtual ball falls over `<video>` from your camera, or a dark stage if the camera stays off. Controls: planet preset (Mercury through Neptune + custom), drop height, slow motion (1×/0.5×/0.25×), ball skin, trail toggle.

The physics is semi-implicit Euler at `requestAnimationFrame` time steps, clamped to 50 ms so backgrounded tabs don't teleport the ball:

- `v += g·dt`, `y += v·dt`
- theory readout `t = √(2h/g)` alongside live `t / y / v`

The ball itself is pure canvas: radial-gradient sphere shading, rotating seams (tennis felt speckle is deterministic so it doesn't flicker), a fixed specular highlight, and a ground shadow that tightens as `y → h`. A ruler overlay maps frame height to meters, so the fall reads correctly against your room.

One camera lab-wide: opening any stage's camera releases the others (`stopOtherCameras`). Phones can't hold two `getUserMedia` streams, and this also saves battery. A denied request no longer kills already-working stages — streams are pruned only after the new one succeeds.

## 2. Mode 2: measure g with a stopwatch — the real lab

Drop a real ball from measured height `h`, press Start on release, Stop on impact. Each trial computes `g = 2h/t²`, persisted to `localStorage` with CSV export and per-trial delete.

The honest part is the error discussion, stated on the page: human reaction time (~0.15 s) dominates, so taller drops are better. Stats show mean ± sample-std, median, % error vs 9.81, and n. Corrupt stored entries are filtered on load so one bad write can't break rendering.

## 3. Mode 3: auto-track — color centroid + least-squares fit

Point the camera at a plain background, pick the ball color (or click the ball to sample it), press Record just before dropping. Each frame:

1. Downsample to 160×120 into a work canvas.
2. Build a match mask by RGB distance² ≤ tolerance².
3. Flood-fill 4-connected components, keep the **largest blob's centroid** — a global average would let scattered background matches drag the point away.
4. Convert px → meters (explicit scale, or full-frame-height = `h` fallback), keep the falling segment, trim pre-drop loitering, and fit `y = y₀ + v₀·t + ½·g·t²` by closed-form least squares (Cramer's rule on the 3×3 normal equations).

Needs 8+ points, >0.1 s span, and >5 cm of motion, or it refuses with a specific message (too few points → brighter ball / closer camera / higher tolerance). The fit result reports `g`, `v₀`, RMSE in cm, and % vs 9.81. A red ball on a white wall works best — unsurprising, but worth stating.

## 4. Mode 4: hand-hold — the hard vision problem

The virtual ball sticks to your hand; lift it above a dashed drop line to release. This mode earned most of the debugging time:

- **Skin default via YCrCb rule** (`133 ≤ Cr ≤ 173`, `77 ≤ Cb ≤ 127`), no calibration click needed. More lighting-robust than one sampled RGB point.
- **Moving-only gate:** matched pixels must also change luminance frame-to-frame, rejecting static skin-colored clutter (wood, faces sitting still).
- **Sticky lock:** once held, blobs near the last position win over bigger blobs elsewhere — otherwise your face, usually the largest skin blob in frame, steals the ball.
- **Blue-backdrop chroma key:** optionally excludes strongly blue-dominant pixels for the blue-bedsheet-behind-you setup.
- **Tracker view:** overlays match dots so you can see what the tracker sees when the ball sticks wrong.

Failure guidance is on the page, not in a tooltip: keep faces and bare arms out of frame, the lock prefers your hand but a face is a bigger target.

## 5. Lab assistant: local model, scoped context

A "Lab assistant" section talks to Ollama on `localhost:11434` (same browser-direct pattern as the [/chat](/chat) page). It never measures anything — it reads a small on-device event log (trial table, last auto-track fit, last 5 failures) and answers setup/diagnosis/results questions. Laptop only; the page degrades to "Ollama not reachable" elsewhere.

## What I'd do differently

The px-to-meters scale is the weakest link in auto-track: full-frame = `h` is a rough fallback, and a taped ruler + explicit scale entry is still the honest path. Next up is Exp 02 (projectile) reusing the same tracker, and a pendulum mode where period measurement forgives scale errors entirely.
