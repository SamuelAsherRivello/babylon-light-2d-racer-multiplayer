# Performance verification

## Current local evidence (2026-09-05)

Measured in Edge on the development Windows machine, with 300 animation-frame samples per client. These are development-browser measurements, not a claim about untested devices.

| Configuration | FPS | p95 frame interval | Draw calls |
| --- | --- | --- | --- |
| Original renderer, one race | 56.7 | 18.3 ms | 1,110 |
| Batched renderer, one race | 56.6 | 18.3 ms | 206 |
| Four independent browser contexts, all driving | 56.5 each | 18.3 ms each | 206 each |
| Four tabs sharing one context, all driving | 28.2 / 28.2 / 28.2 / 56.7 | 36.2 / 36.2 / 36.2 / 18.3 ms | 206 each |
| Same shared-context case with rendering disabled for diagnosis | 28.3 / 28.3 / 28.3 / 56.6 | 36.2 / 36.2 / 36.2 / 18.3 ms | 0 |
| Four empty pages | 55.9–56.2 each | Not recorded | 0 |

The independent-context race measured approximately 0.7–1.0 ms client CPU work and 0.8–0.9 ms GPU work in the final sampled frames. These are point samples, not aggregate percentiles. The shared-context half-rate remains unresolved and is not explained by rendering cost alone. No external physical machines or phones have been measured yet. The all-machines target remains open.

## Implemented changes

- Bake 930 immutable scenery meshes into 26 material batches, preserving world-space geometry and inverse-transpose transformed normals.
- Update camera/car transforms and render in one animation-frame loop, rather than two independent loops.
- Use native CSS-pixel resolution and single-sample rendering to reduce per-instance GPU load.
- Skip expired-particle transform work; hide inactive particles.
- Update HUD text at 10 Hz with immediate phase changes; do not rewrite multiplayer visibility on every server snapshot.
- Retain 30 Hz server snapshots and per-render-frame positional/heading smoothing.

## Check another machine

Open the normal game with `?stats=1`, for example `http://127.0.0.1:2567/?stats=1`. The optional meter displays FPS and the 95th-percentile interval across the latest 60 frames. Hover it for average client CPU work, most recent GPU timing (if supported), and draw calls. Measure an active race with all expected instances running. Browser scheduling and display refresh affect the result.

For the reproducible four-context developer check:

1. Run the server normally (`npm start`) on 2567.
2. In another terminal in `2D Racer/`, run `npm run dev -- --port 5181 --strictPort`.
3. Open a Playwright CLI Edge session, then run `scripts/profile-four-windows.js` with `playwright-cli run-code --filename=...`.
4. Read `window.__fourPerf` with `playwright-cli eval`. The script drives all cars while taking simultaneous 300-frame samples, then closes its guest contexts.

The developer-only `?profile-no-render` switch exists solely to isolate non-rendering costs; never use that result as gameplay FPS evidence.
