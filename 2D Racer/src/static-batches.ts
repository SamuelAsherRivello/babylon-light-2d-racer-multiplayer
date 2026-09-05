import { createMeshFromData, getMeshGeometry, mat4Invert, removeFromScene, addToScene, type EngineContext, type SceneContext, type Mesh } from '@babylonjs/lite';

/** Bake immutable props into material batches once, retaining the exact geometry. */
export function batchStaticMeshes(engine: EngineContext, scene: SceneContext, meshes: Mesh[]) {
  const groups = new Map<Mesh['material'], { positions: number[]; normals: number[]; indices: number[] }>();
  for (const mesh of meshes) {
    let group = groups.get(mesh.material);
    if (!group) { group = { positions: [], normals: [], indices: [] }; groups.set(mesh.material, group); }
    const geometry = getMeshGeometry(mesh), matrix = mesh.worldMatrix, inverse = mat4Invert(matrix);
    if (!geometry) throw new Error(`Missing geometry for static prop: ${mesh.name}`);
    if (!inverse) throw new Error(`Non-invertible static prop: ${mesh.name}`);
    const offset = group.positions.length / 3;
    for (let i = 0; i < geometry.positions.length; i += 3) {
      const x = geometry.positions[i], y = geometry.positions[i+1], z = geometry.positions[i+2];
      group.positions.push(matrix[0]*x+matrix[4]*y+matrix[8]*z+matrix[12],matrix[1]*x+matrix[5]*y+matrix[9]*z+matrix[13],matrix[2]*x+matrix[6]*y+matrix[10]*z+matrix[14]);
      const nx=geometry.normals[i],ny=geometry.normals[i+1],nz=geometry.normals[i+2];
      const a=inverse[0]*nx+inverse[1]*ny+inverse[2]*nz,b=inverse[4]*nx+inverse[5]*ny+inverse[6]*nz,c=inverse[8]*nx+inverse[9]*ny+inverse[10]*nz;
      const length=Math.hypot(a,b,c)||1;group.normals.push(a/length,b/length,c/length);
    }
    for (const index of geometry.indices) group.indices.push(index+offset);
  }
  for (const mesh of meshes) removeFromScene(scene,mesh);
  for (const [material,data] of groups) {
    const mesh=createMeshFromData(engine,'static scenery batch',new Float32Array(data.positions),new Float32Array(data.normals),new Uint32Array(data.indices));
    mesh.material=material;mesh.pickable=false;addToScene(scene,mesh);
  }
  return { before:meshes.length, after:groups.size };
}
