# 2D Racer Multiplayer verification

- `npm test`: 26 tests passed, covering driving, audio, independent human controls, valid non-host finishes, room capacity, readiness, host-only starts, invalid codes, authoritative positions, round timeout, and disconnect cleanup.
- `npm run build`: TypeScript checks and the production frontend build passed.
- Four-browser Edge check: four players joined one invite code, readied up, started together, accelerated their own cars, and returned to the main menu after the 30-second timeout.
- Real WebSocket integration checks verify that a non-host winner is announced to every player and the completed room closes.
- `screenshot01.png` is an actual portrait multiplayer guest view with virtual driving controls.
- Dependency audit reported zero vulnerabilities.

The Node server serves both the built frontend and Colyseus WebSockets at `http://127.0.0.1:2567/`. CI runs tests and builds. The manual Pages workflow deploys a labeled single-player-only frontend; the local self-hosted build retains multiplayer.

Internet hosting instructions are provided, but a public server and four separate physical machines have not been tested. The optional Docker configuration has not been executed because Docker is unavailable on this development machine.

Babylon Lite requires WebGPU and provides no WebGL fallback. Unsupported devices receive an explanatory startup message. All game artwork and audio are generated locally.

## Portrait and redundant controls

- Centered 9:16 framing checked at 390x844, 320x568, 1280x720, and 844x390 browser viewports.
- Real browser touch events verified simultaneous gas and steering, partial release, and mixed keyboard/touch holds.
- Both games use independent input sources and clear held controls on cancellation, focus loss, and race completion.
- Touch checks use Edge browser emulation; physical Android/iOS hardware has not been tested.

- Host starts verified with one, two, three, and four humans; empty room seats do not block the start or spawn bots.
