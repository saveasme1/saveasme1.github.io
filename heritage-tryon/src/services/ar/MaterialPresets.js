/**
 * Material presets — live (lighter) + save (higher quality) variants.
 */
export const MATERIAL_PRESETS = {
  "yellow-gold-polished": {
    color: 0xd4af37,
    metalness: 0.96,
    roughness: 0.18,
    clearcoat: 0.62,
    clearcoatRoughness: 0.14,
    envMapIntensity: 1.2,
    exposure: 1.05,
  },
  "rose-gold-polished": {
    color: 0xb76e79,
    metalness: 0.95,
    roughness: 0.2,
    clearcoat: 0.55,
    clearcoatRoughness: 0.16,
    envMapIntensity: 1.12,
    exposure: 1.02,
  },
  "white-gold-polished": {
    color: 0xececf0,
    metalness: 0.93,
    roughness: 0.16,
    clearcoat: 0.65,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.25,
    exposure: 1.08,
  },
  "silver-polished": {
    color: 0xc4c4c8,
    metalness: 0.9,
    roughness: 0.22,
    clearcoat: 0.48,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.08,
    exposure: 1.0,
  },
  platinum: {
    color: 0xd9d9de,
    metalness: 0.94,
    roughness: 0.15,
    clearcoat: 0.58,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.18,
    exposure: 1.06,
  },
  "black-metal": {
    color: 0x1c1c20,
    metalness: 0.88,
    roughness: 0.32,
    clearcoat: 0.28,
    clearcoatRoughness: 0.28,
    envMapIntensity: 0.85,
    exposure: 0.95,
  },
  "black-onyx": {
    color: 0x0a0a0c,
    metalness: 0.08,
    roughness: 0.35,
    clearcoat: 0.75,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.7,
    exposure: 0.92,
  },
  diamond: {
    color: 0xffffff,
    metalness: 0.02,
    roughness: 0.04,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    transmission: 0.55,
    ior: 2.42,
    thickness: 0.35,
    attenuationColor: 0xeef6ff,
    attenuationDistance: 0.6,
    envMapIntensity: 1.35,
    exposure: 1.1,
    liveTransmission: 0.25,
    saveTransmission: 0.72,
  },
  pearl: {
    color: 0xf6f0e6,
    metalness: 0.04,
    roughness: 0.32,
    clearcoat: 0.85,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.75,
    exposure: 1.0,
  },
  enamel: {
    color: 0x2a4a8a,
    metalness: 0.12,
    roughness: 0.38,
    clearcoat: 0.72,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.82,
    exposure: 1.0,
  },
};

/**
 * @param {'live'|'save'} quality
 */
export function materialParamsFor(presetName, quality = "live") {
  const p = { ...(MATERIAL_PRESETS[presetName] || MATERIAL_PRESETS["yellow-gold-polished"]) };
  if (presetName === "diamond") {
    p.transmission =
      quality === "save" ? p.saveTransmission ?? 0.72 : p.liveTransmission ?? 0.25;
  }
  return p;
}

export function applyMaterialPreset(THREE, mesh, presetName, quality = "live") {
  const p = materialParamsFor(presetName, quality);
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
      attenuationColor: p.attenuationColor,
      attenuationDistance: p.attenuationDistance,
    });
    if (obj.material?.dispose) obj.material.dispose();
    obj.material = mat;
  });
}

export const GEMSTONE_TRADEOFF_KO = `
라이브: diamond transmission≈0.25, 스파클 애니메이션 없음 → 모바일 프레임 유지.
저장: transmission≈0.72 + 높은 clearcoat → 굴절 느낌 강화, 실시간보다 무거워 저장 패스에서만 사용.
보석 개수·위치는 메시 지오메트리로만 결정하며 자동 생성하지 않음.
`.trim();
