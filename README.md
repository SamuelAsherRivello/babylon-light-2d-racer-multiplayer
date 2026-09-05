<!-- AI: Customize this template from the target repository's actual files, configuration, and user instructions. Preserve the section order, heading styles, and concise format unless asked to change them. Replace placeholders only with verified information; leave unknown values as placeholders. Do not invent features, commands, URLs, contributors, or deployment behavior. Keep these instructions hidden as HTML comments. -->
<!-- AI: Preserve the creator banner unless a replacement is requested. Update its relative path if assets move and verify the file exists with matching filename capitalization. -->
![Samuel Asher Rivello](2D%20Racer/documentation/samuel-asher-rivello-banner.png)

# 2D Racer Multiplayer

<!-- AI: Replace {PROJECT_NAME} with the requested project display name. Write one short introduction sentence explaining what the project does and who it is for, based on implemented behavior. -->
2D Racer Multiplayer is a self-hosted cartoon racer with single-player and invite-code Colyseus rooms for one to four players.

## Images

<!-- AI: Use screenshots that exist in this repository and represent the current project. Keep relative paths, matching link href and image src, and the 400-pixel preview width. Replace placeholder alt text with a brief description. Preserve image order unless instructed otherwise; do not invent asset paths. -->
<a href="2D%20Racer/documentation/screenshot01.png"><img src="2D%20Racer/documentation/screenshot01.png" width="400" alt="Cartoon cars racing around the hillside circuit with tire smoke and the race HUD" /></a>


## Demo

<!-- AI: Replace both {demo_url} occurrences with the verified public demo URL. Check deployment configuration or a confirmed deployed site; do not assume a hosting URL. Keep the placeholder if no demo is available. -->
* Run the self-hosted game at [localhost:2567](http://127.0.0.1:2567/) after setup below. No public multiplayer server is deployed.

## Table of Contents

<!-- AI: Keep this list synchronized with the top-level sections below it and their Markdown anchors. Exclude the title, Images, Demo, and Table of Contents because they appear above or here. Do not add subsection entries unless requested. -->
1. [Getting Started](#getting-started)
2. [Project Overview](#project-overview)
3. [Project Details](#project-details)
4. [Resources](#resources)
5. [Credits](#credits)

## Getting Started

<!-- AI: Briefly state required tools or prerequisites, using versions supported by the repository. Keep setup steps in the subsections below and use the fewest practical steps. Do not add a separate commands section. -->
Install Node.js 24 and npm. Playing requires a WebGPU-capable browser/device, such as current Microsoft Edge or Google Chrome.

### 📦 Build Project

<!-- AI: Replace {command} with the actual build command or required editor action. Verify it against manifests, scripts, or project settings. Specify the working directory and dependency installation when necessary; do not assume npm or a particular engine. -->
1. From the repository root, run `cd "2D Racer"`, then `npm ci` and `npm run build`.

### 📦 Run Project

<!-- AI: Replace {command} with the actual local launch command or editor action. State where to run it and how to open the app if needed. Refer to the printed URL when the port can vary. Avoid repeating completed build/setup steps. -->
1. From `2D Racer/`, run `npm start` after building, then open [localhost:2567](http://127.0.0.1:2567/) in one to four browser instances. See the [full server and multiplayer guide](2D%20Racer/documentation/MULTIPLAYER.md).

### 📦 Release Version

<!-- AI: Describe the repository's existing release workflow in the fewest steps, based on checked-in workflows or release scripts. Distinguish builds, tags, releases, and deployment accurately. If no release process exists, retain a placeholder rather than inventing one. Documentation edits do not authorize publishing or changing Git history. -->
1. Run `npm test` and `npm run build` in `2D Racer/`, then publish a version tag as a [GitHub Release](https://github.com/SamuelAsherRivello/babylon-light-2d-racer-multiplayer/releases/new) targeting `main`.
2. Update the self-hosted checkout, install dependencies, rebuild, and restart the server using the [server guide](2D%20Racer/documentation/MULTIPLAYER.md). Publishing a release does not deploy the server.

## Project Overview

<!-- AI: Summarize the project's purpose, main capabilities, and intended use cases. Describe current implementation; label planned capabilities explicitly rather than presenting them as complete. Keep detailed tooling under Project Details. -->
In single player, drive the yellow car with **W** to accelerate, **S** to brake, and **A/D** to steer. A centered 9:16 play area fits portrait screens and desktop windows. On-screen steering, gas, and brake buttons support simultaneous touches alongside WASD. The fixed-angle camera follows your car around a winding track with two jumps. Grass slows you down; tire particles and synthesized sounds react to driving. Complete one valid lap within **30 seconds** to win, regardless of position. Single player retains win/loss, Retry, and mute controls. Multiplayer hosts choose a room maximum of 2–4 players, share a six-character code, and can start alone or with the players currently present once everyone is Ready. Empty seats remain empty. The first valid finisher wins. On finish, timeout, or racing disconnect, the room closes and everyone returns to the main menu; host/join again for each round.

### 📝 Documentation

<!-- AI: Link to the main documentation files that actually exist using relative Markdown links and a short purpose for each. Update links when files move; do not reference documentation inherited from another project unless present here. -->
- [README.md](README.md): Setup, controls, and release instructions.
- [Multiplayer and server setup](2D%20Racer/documentation/MULTIPLAYER.md): Complete local, SSH-tunnel, HTTPS, and container instructions.

### 📝 Structure

<!-- AI: Replace PROJECT_NAME with the actual main project directory and list only the few folders needed to understand the repository. Check paths and capitalization. Omit generated output, dependency folders, and exhaustive file inventories. -->
- `2D Racer/src/`: Game simulation, Babylon Lite rendering, menus, and audio.
- `2D Racer/server/`: Self-hosted Colyseus rooms and the HTTP/WebSocket server.
- `2D Racer/tests/`: Driving, audio, and real-client multiplayer tests.
- `2D Racer/documentation/`: Creator banner and current gameplay screenshot.
- `.github/workflows/`: CI tests and optional manual frontend-only Pages deployment.




## Project Details

<!-- AI: Replace this placeholder with a short description of implementation details useful to developers. Verify the stack from repository files and avoid repeating the overview or claiming unverified package versions. -->
TypeScript modules share one race-state contract. Babylon Lite 1.27.0 renders procedural 3D art with 2D-style driving; Web Audio synthesizes effects without remote assets. Vite builds a static site with relative asset paths for GitHub Pages. The Colyseus server authoritatively simulates human inputs and serves the built game on port 2567. Run `npm test` from `2D Racer/` for simulation, audio, and room integration checks.

### 📦 AI

<!-- AI: List AI tools and specification workflows configured or documented for this repository. Use official links and concise descriptions; verify current official wording before using a tagline. Treat inherited entries as examples to validate, not proof of installed tooling. -->
- [Codex](https://openai.com/codex/): Agent-assisted implementation and verification.
- [OpenSpec](https://openspec.dev/): Specification workflows provided in `.agents/skills/`.


### 📦 Packages

<!-- AI: List the key packages actually used, based on manifests and configuration. Link each name to its official site or documentation and describe its role briefly. Replace template examples that do not apply. Include versions only when useful and verified against the repository. -->
- [Babylon Lite](https://www.babylonjs.com/lite/): WebGPU rendering with `@babylonjs/lite` 1.27.0.
- [Colyseus](https://docs.colyseus.io/): Room codes, WebSocket connections, lobby coordination, and server-owned racing.
- [TypeScript](https://www.typescriptlang.org/): Typed game modules.
- [Vite](https://vite.dev/): Static builds and the local development server.



## Resources

<!-- AI: Keep relevant external learning and best-practice links with readable labels and short descriptions. Preserve the existing Best Practices resource unless asked to replace it. Verify new destinations and avoid duplicating local documentation links. -->
- [Best Practices](https://www.SamuelAsherRivello.com/best-practices/) - Procedures prescribed as the most effective


## Credits

<!-- AI: Preserve established attribution and ownership. Customize the following subsections only from confirmed contributor, contact, and license information; do not infer a new owner from the repository name. -->
### 💡 Contributors

<!-- AI: Preserve existing contributor credit and add contributors only when confirmed. Do not automatically advance experience counts or their reference year. -->
- Samuel Asher Rivello - Over 25 years of game development experience as of 2026

### 💡 Contact

<!-- AI: Preserve confirmed contact destinations and their order unless requested otherwise. Use readable display URLs without a protocol or trailing slash while keeping the real link target intact. Do not invent accounts or change target capitalization based on display styling. -->
- [LinkedIn.com/in/SamuelAsherRivello](https://Linkedin.com/in/SamuelAsherRivello) ⭐ 
- [GitHub.com/SamuelAsherRivello](https://github.com/SamuelAsherRivello/)
- [Twitter.com/srivello](https://twitter.com/srivello/)
- Resume / Portfolio: [SamuelAsherRivello.com](http://www.SamuelAsherRivello.com)


### 💡 License

<!-- AI: Keep the license name linked to the actual relative license file and verify that its terms match this statement. Keep the copyright holder and year consistent with that file. Do not change license terms, ownership, or dates without an explicit request. -->
- Provided as-is under the [MIT License](LICENSE).

- Copyright © 2026 Rivello Multimedia Consulting, LLC.
