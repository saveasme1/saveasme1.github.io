/**
 * Material presets for jewelry PBR (MeshPhysicalMaterial params).
 */
export const MATERIAL_PRESETS = {
  "yellow-gold-polished": {
    color: 0xd4af37,
    metalness: 0.95,
    roughness: 0.22,
    clearcoat: 0.55,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.15,
  },
  "rose-gold-polished": {
    color: 0xb76e79,
    metalness: 0.94,
    roughness: 0.24,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.1,
  },
  "white-gold-polished": {
    color: 0xe8e8ea,
    metalness: 0.92,
    roughness: 0.2,
    clearcoat: 0.6,
    clearcoatRoughness: 0.15,
    envMapIntensity: 1.2,
  },
  "silver-polished": {
    color: 0xc0c0c4,
    metalness: 0.9,
    roughness: 0.25,
    clearcoat: 0.45,
    clearcoatRoughness: 0.22,
    envMapIntensity: 1.05,
  },
  platinum: {
    color: 0xd8d8dc,
    metalness: 0.93,
    roughness: 0.18,
    clearcoat: 0.55,
    clearcoatRoughness: 0.14,
    envMapIntensity: 1.15,
  },
  "black-metal": {
    color: 0x222226,
    metalness: 0.85,
    roughness: 0.35,
    clearcoat: 0.3,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.9,
  },
  diamond: {
    color: 0xffffff,
    metalness: 0.05,
    roughness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transmission: 0.6,
    ior: 2.4,
    thickness: 0.4,
    envMapIntensity: 1.4,
  },
  pearl: {
    color: 0xf5f0e6,
    metalness: 0.05,
    roughness: 0.35,
    clearcoat: 0.8,
    clearcoatRoughness: 0.25,
    envMapIntensity: 0.7,
  },
  enamel: {
    color: 0x2a4a8a,
    metalness: 0.15,
    roughness: 0.4,
    clearcoat: 0.7,
    clearcoatRoughness: 0.2,
    envMapIntensity: 0.8,
  },
};

export function applyMaterialPreset(THREE, mesh, presetName) {
  const p = MATERIAL_PRESETS[presetName] || MATERIAL_PRESETS["yellow-gold-polished"];
  mesh.traverse((obj) => {
    if (!obj.isMesh) return;
    const mat = new THREE.MeshPhysicalMaterial({
      color: p.color,
      metalness: p.metalness ?? 0.9,
      roughness: p.roughness ?? 0.25,
      clearcoat: p.clearcoat ?? 0.4,
      clearcoatRoughness: p.clearcoatRoughness ?? 0.2,
      envMapIntensity: p.envMapIntensity ?? 1,
      transmission: p.transmission ?? 0,
      ior: p.ior ?? 1.5,
      thickness: p.thickness ?? 0,
    });
    if (obj.material?.dispose) obj.material.dispose();
    obj.material = mat;
  });
}
