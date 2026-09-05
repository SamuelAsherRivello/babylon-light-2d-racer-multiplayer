# 2D Racer Multiplayer verification

- `npm test`: 20 tests passed, covering driving, audio, independent human controls, valid non-host finishes, room capacity, readiness, host-only starts, invalid codes, authoritative positions, round timeout, and disconnect cleanup.
- `npm run build`: TypeScript checks and the production frontend build passed.
- Four-browser Edge check: four players joined one invite code, readied up, started together, accelerated their own cars, and returned to the main menu after the 30-second timeout.
- Real WebSocket integration checks verify that a non-host winner is announced to every player and the completed room closes.
- `screenshot01.png` is an actual multiplayer guest view with all four racers.
- Dependency audit reported zero vulnerabilities.

The Node server serves both the built frontend and Colyseus WebSockets at `http://127.0.0.1:2567/`. CI runs tests and builds. The optional manual Pages workflow deploys only the frontend and requires a separately hosted server URL.

Internet hosting instructions are provided, but a public server and four separate physical machines have not been tested. The optional Docker configuration has not been executed because Docker is unavailable on this development machine.

Babylon Lite requires WebGPU and provides no WebGL fallback. Unsupported devices receive an explanatory startup message. All game artwork and audio are generated locally.
