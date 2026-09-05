import { batchStaticMeshes } from './static-batches';
import { createEngine, createSceneContext, createArcRotateCamera, createHemisphericLight, createDirectionalLight, createStandardMaterial, createBox, createCylinder, createSphere, createMeshFromData, createTransformNode, addToScene, setParent, registerScene, renderFrame, setMeshVisible, setGpuTimingEnabled, resizeEngine, disposeEngine, type Mesh, type TransformNode, type StandardMaterialProps } from '@babylonjs/lite';
import { TRACK, TRACK_LENGTH, sampleTrack, trackDistance } from './track';
import type { Car, RaceState } from './types';

/** A deliberately presentation-only world: all positions come from the simulation. */
export async function createWorld(canvas: HTMLCanvasElement, onProgress: (message: string) => void = () => {}) {
  onProgress('Loading graphics…');
  const engine = await createEngine(canvas, { maxDevicePixelRatio: 1, msaaSamples: 1 });
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('stats')) setGpuTimingEnabled(engine, true);
  onProgress('Building the track…');
  const scene = createSceneContext(engine);
  scene.clearColor = { r: 0.56, g: 0.79, b: 0.87, a: 1 };
  const camera = createArcRotateCamera(-Math.PI / 2, 0.62, 72, { x: 0, y: 0, z: 0 });
  camera.fov = 0.82;
  camera.farPlane = 600;
  scene.camera = camera;
  addToScene(scene, createHemisphericLight([0, 1, 0], 0.65));
  addToScene(scene, createDirectionalLight([-0.6, -1, 0.35], 0.35));
  let collectingStatic = true;
  const staticMeshes: Mesh[] = [];
  const materials = new Map<string, StandardMaterialProps>();
  function mat(hex: string) {
    let material = materials.get(hex);
    if (!material) {
      material = createStandardMaterial();
      const n = parseInt(hex.replace('#', ''), 16);
      material.diffuseColor = [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
      material.specularColor = [0.025, 0.025, 0.025];
      materials.set(hex, material);
    }
    return material;
  }
  function place(mesh: Mesh, color: string, x: number, y: number, z: number, parent?: TransformNode) {
    mesh.material = mat(color);
    if (parent) setParent(mesh, parent);
    // setParent preserves world pose, so apply our explicitly local coordinates afterwards.
    mesh.position.x = x; mesh.position.y = y; mesh.position.z = z;
    mesh.rotation.x = mesh.rotation.y = mesh.rotation.z = 0;
    addToScene(scene, mesh);
    if (collectingStatic) staticMeshes.push(mesh);
    return mesh;
  }
  function box(color: string, x: number, y: number, z: number, w: number, h: number, d: number, heading = 0, parent?: TransformNode) {
    const mesh = place(createBox(engine, { width: w, height: h, depth: d }), color, x, y, z, parent);
    mesh.rotation.y = heading;
    return mesh;
  }
  function sphere(color: string, x: number, y: number, z: number, size: number, parent?: TransformNode) {
    return place(createSphere(engine, { diameter: size, segments: 5 }), color, x, y, z, parent);
  }
  const terrain = box('#78b852', 0, -0.45, 0, 600, 0.8, 600);
  terrain.name = 'meadow';
  // Use the simulation's physical length and sampler so road and ramp bounds agree.
  const samples = 400;
  const length = TRACK_LENGTH;
  function strip(name: string, offset: number, width: number, y: number, color: string) {
    const positions: number[] = [], normals: number[] = [], indices: number[] = [];
    for (let i = 0; i <= samples; i++) {
      const p = sampleTrack(i / samples);
      for (const side of [-1, 1]) {
        const d = offset + side * width / 2;
        positions.push(p.x + Math.cos(p.heading) * d, y, p.z - Math.sin(p.heading) * d);
        normals.push(0, 1, 0);
      }
      // Lite's left-handed front faces use the same winding as createGroundData.
      if (i < samples) { const j = i * 2; indices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
    }
    return place(createMeshFromData(engine, name, new Float32Array(positions), new Float32Array(normals), new Uint32Array(indices)), color, 0, 0, 0);
  }
  strip('road shoulder', 0, TRACK.width + 1.6, 0.005, '#cfbe86');
  strip('asphalt circuit', 0, TRACK.width, 0.025, '#394954');
  strip('left road line', -TRACK.width / 2 + 0.22, 0.15, 0.04, '#f1edcf');
  strip('right road line', TRACK.width / 2 - 0.22, 0.15, 0.04, '#f1edcf');
  const curbCount = Math.round(length / 2.7);
  for (let i = 0; i < curbCount; i++) {
    const p = sampleTrack(i / curbCount);
    for (const side of [-1, 1]) {
      const d = side * (TRACK.width / 2 + 0.38);
      box(i % 2 ? '#f2edda' : '#e75d51', p.x + Math.cos(p.heading) * d, 0.09, p.z - Math.sin(p.heading) * d, 0.7, 0.15, length / curbCount + 0.07, p.heading);
    }
    if (i % 4 === 0) box('#90a3a6', p.x, 0.04, p.z, 0.12, 0.015, 1.2, p.heading);
  }
  for (const ramp of TRACK.ramps) {
    const center = sampleTrack(ramp.progress + ramp.length / length / 2);
    const slope = Math.atan2(ramp.height, ramp.length);
    const rampRoot = createTransformNode('jump ramp');
    rampRoot.position.x = center.x; rampRoot.position.z = center.z; rampRoot.rotation.y = center.heading;
    addToScene(scene, rampRoot);
    const surface = box('#d3a25e', 0, ramp.height / 2 + 0.09, 0, TRACK.width - 0.9, 0.19, Math.hypot(ramp.length, ramp.height), 0, rampRoot);
    surface.rotation.x = -slope;
    for (let i = 0; i < 3; i++) {
      const z = (i - 1) * ramp.length * 0.22;
      const h = ramp.height * (z / ramp.length + 0.5) + 0.21;
      for (const side of [-1, 1]) {
        const stripe = box('#fff3ae', side * 0.48, h, z, 0.2, 0.025, 1.2, -side * 0.7, rampRoot);
        stripe.rotation.x = -slope;
      }
    }
  }
  const finish = sampleTrack(0);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 12; col++) {
    const dx = (col + 0.5) * TRACK.width / 12 - TRACK.width / 2, dz = (row - 1) * 0.8;
    box((row + col) % 2 ? '#283742' : '#fff7db', finish.x + Math.cos(finish.heading) * dx + Math.sin(finish.heading) * dz, 0.055, finish.z - Math.sin(finish.heading) * dx + Math.cos(finish.heading) * dz, TRACK.width / 12, 0.025, 0.8, finish.heading);
  }
  const gate = createTransformNode('finish arch');
  gate.position.x = finish.x; gate.position.z = finish.z; gate.rotation.y = finish.heading; addToScene(scene, gate);
  for (const side of [-1, 1]) {
    box('#fff1cb', side * (TRACK.width / 2 + 1.2), 2.5, 0, 0.45, 5, 0.45, 0, gate);
    box('#e96b4c', side * (TRACK.width / 2 + 1.2), 0.25, 0, 1.1, 0.5, 1.1, 0, gate);
  }
  box('#193b42', 0, 5.05, 0, TRACK.width + 3, 1.0, 0.48, 0, gate);
  for (let i = 0; i < 14; i++) box(i % 2 ? '#fff1cb' : '#e5af47', (i - 6.5) * 0.6, 5.05, -0.255, 0.45, 0.45, 0.05, 0, gate);
  // Deterministic scenery avoids covering the road and keeps the circuit identical on retry.
  let seed = 12421;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 95; i++) {
    const p = sampleTrack(random()), side = random() > 0.5 ? 1 : -1;
    const offset = side * (TRACK.width / 2 + 4 + random() * 19);
    const x = p.x + Math.cos(p.heading) * offset, z = p.z - Math.sin(p.heading) * offset;
    if (trackDistance(x, z).distance < TRACK.width / 2 + 3) continue;
    const h = 2.4 + random() * 2.3;
    const shadow = sphere('#609942', x + 0.5, 0.03, z - 0.3, h * 1.2); shadow.scaling.y = 0.02;
    place(createCylinder(engine, { diameter: 0.4, height: h * 0.65, tessellation: 6 }), '#9e724b', x, h * 0.28, z);
    place(createCylinder(engine, { diameterBottom: h * 1.1, diameterTop: 0, height: h, tessellation: 6 }), i % 3 ? '#2d8059' : '#459553', x, h * 0.9, z);
    place(createCylinder(engine, { diameterBottom: h * 0.77, diameterTop: 0, height: h * 0.8, tessellation: 6 }), '#65ad60', x, h * 1.22, z);
  }
  // Trackside pennants and safety blocks provide scale and a festival feeling.
  for (let i = 5; i < 60; i += 5) {
    const p = sampleTrack(i / 60), d = TRACK.width / 2 + 2;
    const x = p.x + Math.cos(p.heading) * d, z = p.z - Math.sin(p.heading) * d;
    box('#e5e5ca', x, 1.5, z, 0.13, 3, 0.13);
    box(i % 2 ? '#efb543' : '#e66751', x + 0.35, 2.6, z, 0.8, 0.65, 0.06);
    box('#eee7cc', x, 0.3, z, 2, 0.6, 0.8, p.heading);
  }
  for (const side of [-1, 1]) {
    box('#d4b37b', side * 92, 0.9, 0, 0.4, 0.5, 184);
    box('#d4b37b', 0, 0.9, side * 92, 184, 0.5, 0.4);
    for (let v = -92; v <= 92; v += 8) {
      box('#ad8559', side * 92, 0.65, v, 0.65, 1.5, 0.65);
      box('#ad8559', v, 0.65, side * 92, 0.65, 1.5, 0.65);
    }
  }
  collectingStatic = false;
  const batching = batchStaticMeshes(engine, scene, staticMeshes);
  const cars = new Map<number, { root: TransformNode; shadow: Mesh; frontWheels: Mesh[]; wasAirborne: boolean }>();
  function carModel(car: Car) {
    const root = createTransformNode('racer ' + car.id); addToScene(scene, root);
    box('#24313b', 0, 0.35, 0, 1.7, 0.35, 2.85, 0, root);
    box(car.color, 0, 0.65, 0, 1.7, 0.55, 2.7, 0, root);
    box(car.color, 0, 1.04, -0.25, 1.3, 0.55, 1.2, 0, root);
    box('#bce8e5', 0, 1.08, 0.365, 1.13, 0.4, 0.025, 0, root);
    box('#365b6a', 0, 1.08, -0.865, 1.1, 0.33, 0.025, 0, root);
    for (const side of [-1, 1]) {
      box('#9ed5d8', side * 0.66, 1.1, -0.22, 0.02, 0.33, 0.84, 0, root);
      box('#fff4b8', side * 0.55, 0.69, 1.37, 0.37, 0.19, 0.05, 0, root);
      box('#ff715c', side * 0.55, 0.65, -1.37, 0.36, 0.17, 0.05, 0, root);
    }
    box('#fff2cf', 0, 0.94, 0.86, 0.28, 0.025, 0.91, 0, root);
    box('#fff2cf', 0, 1.33, -0.25, 0.28, 0.03, 1.2, 0, root);
    const frontWheels: Mesh[] = [];
    for (const x of [-0.9, 0.9]) for (const z of [-0.9, 0.85]) {
      const wheel = place(createCylinder(engine, { diameter: 0.67, height: 0.32, tessellation: 10 }), '#24313b', x, 0.34, z, root);
      wheel.rotation.z = Math.PI / 2;
      if (z > 0) frontWheels.push(wheel);
      const hub = place(createCylinder(engine, { diameter: 0.3, height: 0.34, tessellation: 8 }), '#d6d8d0', x, 0.34, z, root); hub.rotation.z = Math.PI / 2;
    }
    if (car.id === 0) {
      box('#f7e8b9', 0, 1.52, -0.25, 0.5, 0.1, 0.58, 0, root);
      box('#233b45', 0, 1.58, -0.25, 0.12, 0.015, 0.36, 0, root);
    }
    const shadow = sphere('#426143', car.x, 0.055, car.z, 2.8); shadow.scaling.y = 0.025; shadow.scaling.x = 0.76;
    const visual = { root, shadow, frontWheels, wasAirborne: false }; cars.set(car.id, visual); return visual;
  }
  const particles = Array.from({ length: 90 }, () => {
    const mesh = sphere('#e5d3a2', 0, -20, 0, 1); mesh.scaling.x = mesh.scaling.y = mesh.scaling.z = 0.001;
    return { mesh, visible: true, life: 0, maxLife: 1, vx: 0, vz: 0 };
  });
  let cursor = 0, emitClock = 0;
  function emit(car: Car, count: number, landing = false) {
    for (let i = 0; i < count; i++) {
      const p = particles[cursor++ % particles.length];
      const side = i % 2 ? 1 : -1;
      p.mesh.position.x = car.x - Math.sin(car.heading) + Math.cos(car.heading) * side * 0.8;
      p.mesh.position.y = 0.2;
      p.mesh.position.z = car.z - Math.cos(car.heading) - Math.sin(car.heading) * side * 0.8;
      p.mesh.material = mat(car.offroad || landing ? '#d3c28f' : '#dce2d8');
      if (!p.visible) { setMeshVisible(p.mesh,true); p.visible=true; }
      p.life = p.maxLife = landing ? 0.8 : 0.55;
      p.vx = (random() - 0.5) * (landing ? 7 : 2);
      p.vz = (random() - 0.5) * (landing ? 7 : 2);
    }
  }
  // Register all car parts up front: Lite compiles the scene's pipelines at registration.
  const palette = ['#ffca3a', '#ff597b', '#6bdbff', '#b09bff'];
  for (let id = 0; id < 4; id++) carModel({ id, color: palette[id], x: 0, z: 0 } as Car);
  onProgress('Preparing track graphics…');
  await registerScene(scene);
  onProgress('Starting the first frame…');
  // Background/occluded windows may not receive animation frames. Scheduling
  // rendering must not block network menus on the first frame being painted.
  // The game loop updates transforms and renders once in the same animation frame.
  let initialized = false;
  return {
    update(state: RaceState, dt: number) {
      const player = state.cars[0];
      if (!player) return;
      const follow = initialized ? 1 - Math.exp(-dt * 7) : 1;
      camera.target.x += (player.x - camera.target.x) * follow;
      camera.target.z += (player.z + 2 - camera.target.z) * follow;
      camera.target.y = 0;
      initialized = true;
      emitClock += dt;
      const emitting = emitClock > 0.065 && state.phase === 'racing';
      if (emitting) emitClock = 0;
      for(const [id,visual] of cars){const size=state.cars.some(car=>car.id===id)?1:0;visual.root.scaling.x=visual.root.scaling.y=visual.root.scaling.z=size;if(!size)visual.shadow.position.y=-20;else visual.shadow.position.y=.055;}
      for (const car of state.cars) {
        const visual = cars.get(car.id)!;
        visual.root.position.x = car.x; visual.root.position.y = car.y; visual.root.position.z = car.z;
        visual.root.rotation.y = car.heading;
        visual.root.rotation.z = -car.steer * Math.min(Math.abs(car.speed) / 28, 1) * 0.055;
        visual.root.rotation.x = car.airborne ? -0.09 : 0;
        visual.shadow.position.x = car.x; visual.shadow.position.z = car.z;
        visual.shadow.rotation.y = car.heading;
        const shadowSize = 1 + Math.max(0, car.y) * 0.15;
        visual.shadow.scaling.x = 0.76 * shadowSize; visual.shadow.scaling.z = shadowSize;
        for (const wheel of visual.frontWheels) wheel.rotation.y = car.steer * 0.35;
        if (emitting && !car.airborne && Math.abs(car.speed) > 4 && (car.offroad || Math.abs(car.steer) > 0.2)) emit(car, 2);
        if (visual.wasAirborne && !car.airborne) emit(car, 10, true);
        visual.wasAirborne = car.airborne;
      }
      for (const p of particles) {
        if (p.life <= 0) { if(p.visible){setMeshVisible(p.mesh,false);p.visible=false;} continue; }
        p.life = Math.max(0, p.life - dt);
        p.mesh.position.x += p.vx * dt; p.mesh.position.z += p.vz * dt; p.mesh.position.y += dt * 0.55;
        const scale = p.life > 0 ? (0.18 + (1 - p.life / p.maxLife) * 0.7) * Math.min(p.life * 5, 1) : 0.001;
        p.mesh.scaling.x = p.mesh.scaling.y = p.mesh.scaling.z = scale;
      }
    },
    render(dt: number) { renderFrame(engine,dt * 1000); },
    stats() { return { drawCalls: engine.drawCallCount, batching, gpuMs: engine.gpuFrameTimeMs }; },
    resize() { resizeEngine(engine); },
    dispose() { disposeEngine(engine); },
  };
}
