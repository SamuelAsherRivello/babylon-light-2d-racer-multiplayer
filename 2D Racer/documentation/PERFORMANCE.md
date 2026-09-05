# Performance verification

## Multiplayer network timing (2026-09-05)

The original snapshot accumulator discarded its remainder after every send. Four real SDK clients measured only 20.1 updates/second instead of the intended 30. A 60 Hz simulation timer also suffered coarse Windows scheduling; sampling simulation at 120 Hz and preserving the snapshot accumulator produced 60.05 updates/second for all four clients over five seconds.

- Original packet gap: p95 63 ms, maximum 64 ms.
- Corrected packet gap: p95 31 ms, maximum 33 ms. The client timeline smooths this scheduling variation.
- One local SDK input-to-authoritative-motion sample: 16.5 ms after the final change. This is a sample, not a latency percentile.
- Four real Edge browser clients joined, readied and drove using keyboard events: approximately 32 ms from the test trigger to visible local motion on each client, 56.2 received updates/second in the final two-second window, and 56.6 render FPS each. Trigger timing includes Playwright event dispatch.

A deterministic four-car constant-velocity replay also passes at 30, 60 and 120 render Hz with ordered packet delays varying from 10 to 30 ms, including batched delivery. After warm-up, every sampled car advances uniformly. This checks interpolation continuity for that synthetic pattern; it does not measure device FPS or arbitrary internet conditions.

These are localhost measurements on one physical machine. Internet latency and other hardware remain unmeasured. Render FPS and network update rate are separate metrics.

Run `npm exec -- tsx scripts/profile-network.ts` with the local server running for a repeatable four-connection network check. The script closes its test rooms afterwards.

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
- Restore the original 1.5 device-pixel-ratio cap and 4x MSAA for sharp rendering. The temporary 1x/no-antialiasing setting was removed after network latency was isolated. The renderer measurements above used that temporary setting.
- Skip expired-particle transform work; hide inactive particles.
- Update HUD text at 10 Hz with immediate phase changes; do not rewrite multiplayer visibility on every server snapshot.
- Send snapshots at a measured 60 Hz using a 120 Hz simulation timer with retained fractional send time.
- Send control transitions immediately, with 100 ms heartbeats to preserve held input.
- Interpolate remote cars on a 33 ms timestamp buffer; project the local car for at most 50 ms between packets, without exponential catch-up delay.

## Check another machine

Open the normal game with `?stats=1`, for example `http://127.0.0.1:2567/?stats=1`. The optional meter displays FPS and the 95th-percentile interval across the latest 60 frames. During multiplayer it also displays NET updates/second separately from FPS. Hover it for average client CPU work, most recent GPU timing (if supported), and draw calls. Measure an active race with all expected instances running. Browser scheduling and display refresh affect the result.

For the reproducible four-context developer check:

1. Run the server normally (`npm start`) on 2567.
2. In another terminal in `2D Racer/`, run `npm run dev -- --port 5181 --strictPort`.
3. Open a Playwright CLI Edge session, then run `scripts/profile-four-windows.js` with `playwright-cli run-code --filename=...`.
4. Read `window.__fourPerf` with `playwright-cli eval`. The script drives all cars while taking simultaneous 300-frame samples, then closes its guest contexts.

The developer-only `?profile-no-render` switch exists solely to isolate non-rendering costs; never use that result as gameplay FPS evidence.
