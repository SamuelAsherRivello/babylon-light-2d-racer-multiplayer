# Multiplayer setup

This repository runs its own Colyseus server. Colyseus Cloud, accounts, paid services, databases, and API keys are not required. The server serves the built game and its WebSocket connections on the same port.

## One machine: one server, one to four games

Install Node.js 24 or newer, npm, and a WebGPU-capable browser/device (current Edge or Chrome is recommended).

From PowerShell:

```powershell
git clone https://github.com/SamuelAsherRivello/babylon-light-2d-racer-multiplayer.git
cd "babylon-light-2d-racer-multiplayer/2D Racer"
npm ci
npm run play
```

Keep that terminal running and open **http://127.0.0.1:2567/**. `npm run play` builds the game and starts the server. Later, `npm start` reuses the existing build. Press Ctrl+C in the server terminal to stop it.

1. For one player, click **Single Player** to race three AI cars. This mode does not create a network room.
2. For multiplayer, open the URL in **one, two, three, or four browser tabs/windows**. Each instance has a separate connection; no extra server process is needed.
3. In one instance, enter a name, choose the maximum player count (including the host), and click **Host Multiplayer**.
4. Copy the six-character code. Send it to friends outside the game, or paste it into the other instances' **Invite code** field and click **Join Multiplayer**. Everyone must use the same server.
5. Everyone clicks **Ready**. A newly joined or departed player clears readiness, so finish assembling the group before readying up.
6. The host can click **Start Game** with one, two, three, or four players currently present, once everyone present is Ready. Unused seats do not block starting. All players receive the same three-second countdown.
7. Hold **W** to accelerate, **S** to brake, and **A/D** to steer relative to your own car, or hold the on-screen steering and gas/brake buttons. Multiple touches and keyboard input can be used together. Each camera follows its own player's car; the lobby color identifies it.

In multiplayer, the **first human to complete a valid lap within 30 seconds wins**. If nobody finishes, the round times out. The result appears on everyone's main menu immediately, the room closes, and the code expires. Host and join again to play another round. Single player retains its original timed-lap rules and Retry screen.

Hosting creates a room on the shared server; it does not turn that player's browser into the server. The server owns movement, collisions, checkpoints, the timer, and the winner. Clients send only button states. Empty slots are not filled with bots in multiplayer.

## Disconnects and room lifetime

- The host leaving a waiting lobby closes it for everyone.
- A guest leaving a lobby frees the seat and clears everyone's Ready status.
- Any player leaving or losing connection during a race cancels it for everyone. The game returns to the main menu with an explanation. Automatic reconnection is deliberately disabled, so old sessions cannot rejoin a completed round.
- Unstarted lobbies expire after ten minutes. Server restart discards all rooms.
- A hidden/background multiplayer tab does not pause the shared clock. Focus loss clears held controls; stale input stops after 300 ms.
- Rooms are limited to four players; the self-hosted process allows at most 100 active rooms. Keep one server process/replica; room-code allocation and simulation are intentionally in memory.

## Development and checks

Run commands from `2D Racer/`:

```powershell
npm test
npm run build
```

For hot reload, use two terminals in this folder:

```powershell
# Terminal 1: server with automatic restart
npm run server
```

```powershell
# Terminal 2: Vite frontend
npm run dev
```

Open Vite's printed URL. In development the frontend connects to `http://127.0.0.1:2567`. Server restarts close existing rooms, so host a fresh room afterwards.

The tests use an additional loopback port, **2568**, and real Colyseus clients. Leave that port free while testing. The game server uses **2567** by default. To choose a different port:

```powershell
$env:PORT = "2569"
npm start
```

Open `http://127.0.0.1:2569/`; the built frontend automatically uses the same origin. The menu's **Server connection** section can point a separate frontend to a different server. `VITE_MULTIPLAYER_SERVER` sets that public address at build time; it is configuration, not a secret.

## Four different machines over the internet

The same server supports remote clients. No cloud-specific code is required. You need an always-running machine reachable by the players. This repository does not provision one or change your firewall/router.

### Option A: SSH tunnels, no public game port

This is a simple private setup if the four players have SSH access to a server machine.

1. On the server machine, install Node.js 24+, clone this repository, enter `2D Racer/`, run `npm ci`, `npm run build`, and `npm start`. Keep the process running. Leave the default bind address `127.0.0.1`.
2. Each player opens a terminal on their own machine and keeps this SSH tunnel running, replacing `user@server` with their SSH account and server hostname:

   ```powershell
   ssh -N -L 2567:127.0.0.1:2567 user@server
   ```

3. Each player opens **http://127.0.0.1:2567/** in their own browser and follows the host/join instructions above. The browser's HTTP and WebSocket traffic both travel through the tunnel.

If a player's local port 2567 is busy, use `-L 2569:127.0.0.1:2567` and open `http://127.0.0.1:2569/`. Do not run an extra local game server on the tunnel port.

### Option B: public HTTPS with your own host

For friends who should only need a URL, put this server behind an HTTPS reverse proxy that supports WebSockets. A public Linux host with Node.js 24 and Caddy is one option.

1. Point a domain you control to the host. Install Caddy using its [official instructions](https://caddyserver.com/docs/install).
2. Build and run this game on `127.0.0.1:2567` as above, under your normal process supervisor so it survives terminal closure/reboots.
3. Configure Caddy with your actual domain:

   ```caddyfile
   race.example.com {
       reverse_proxy 127.0.0.1:2567
   }
   ```

4. Allow public TCP **80 and 443** for Caddy's certificate handling and HTTPS game traffic. Keep **2567** private to the host. This exposes the game to anyone who knows the URL; invite codes are room access, not user authentication.
5. All four players open `https://race.example.com/`. HTTP assets, matchmaking and WebSocket traffic use that one origin. No separate server address entry is needed.

Caddy handles WebSocket upgrades and HTTPS; see its [reverse-proxy documentation](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy). A plain HTTP LAN IP or public IP is generally **not** a secure browser context, so WebGPU may be unavailable. Use HTTPS or the localhost SSH-tunnel method instead of disabling browser security.

For containers, the included Dockerfile builds the same app:

```powershell
# From the repository root
docker build -t racer-multiplayer .
docker run --rm -p 127.0.0.1:2567:2567 racer-multiplayer
```

The container listens on `0.0.0.0` internally; the command above publishes it only on the host's loopback interface. A public reverse proxy can sit in front of that binding.

## Free hosting notes

Self-hosting locally has no hosting-service fee. An existing SSH-accessible host also works without a Colyseus Cloud subscription. If you later choose a free managed Node host, it must support a persistent Node process and WebSockets. Render's free web services are one option to evaluate, but sleep after 15 minutes idle, may take about a minute to wake, and can restart; see [Render's current limitations](https://render.com/docs/free). No external host was provisioned by this implementation.

GitHub Pages can host only the frontend, **not this Node server**. The Pages workflow builds a clearly labeled single-player-only demo with `VITE_SINGLE_PLAYER_DEMO=true`; host/join controls are hidden in that build. Normal local/server builds keep multiplayer enabled. For the easiest setup, serve both frontend and server together using `npm run play`.

## Troubleshooting

- **Cannot connect:** keep the server terminal running, open `/health` on the same server, and check every player uses the same server address.
- **Invalid/full/expired code:** copy the current six-character code, check the chosen player count, and host a new room after every completed or cancelled race.
- **Start disabled:** everyone currently present must click Ready, including the host. Only the host has Start Game. The host can start alone; empty seats never block the start.
- **No rendering:** confirm WebGPU is available on the device and the URL is localhost or HTTPS.
- **Friends cannot reach your localhost URL:** localhost always means their own machine. Use the SSH tunnel or HTTPS host instructions.
- **Server reboot / connection loss:** rooms are temporary; everyone hosts/joins again.
