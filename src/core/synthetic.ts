import { VolumeDims } from '../types';

export interface SyntheticOptions {
  nx?: number; ny?: number; nz?: number;
  nLayers?: number;      // 倾斜地层数
  faultThrow?: number;   // 断层断距(采样点)
  seed?: number;
}

/** 简单可复现随机数 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ricker 子波,t 以采样点为单位 */
function ricker(t: number, f: number): number {
  const u = Math.PI * f * t;
  return (1 - 2 * u * u) * Math.exp(-u * u);
}

/**
 * 生成合成地震数据体:若干倾斜反射界面 + 一条走向断层(断距错动界面),
 * 反射系数 × Ricker 子波,加少量噪声。返回归一化 [-1,1] 数据。
 */
export function generateSynthetic(opts: SyntheticOptions = {}): { dims: VolumeDims; data: Float32Array } {
  const nx = opts.nx ?? 128, ny = opts.ny ?? 128, nz = opts.nz ?? 96;
  const nLayers = opts.nLayers ?? 6;
  const throwZ = opts.faultThrow ?? 10;
  const rand = mulberry32(opts.seed ?? 20261115);

  // 界面参数:基准深度 + 双方向倾角 + 振幅
  const interfaces: { z0: number; dipX: number; dipY: number; amp: number }[] = [];
  for (let k = 0; k < nLayers; k++) {
    interfaces.push({
      z0: nz * (0.14 + 0.72 * (k / Math.max(1, nLayers - 1))) + (rand() - 0.5) * nz * 0.04,
      dipX: (rand() - 0.5) * 0.22,
      dipY: (rand() - 0.5) * 0.18,
      amp: (rand() > 0.5 ? 1 : -1) * (0.55 + 0.45 * rand()),
    });
  }
  // 断层:平面 x = fx + (z - fz) * fdip,右侧地层下落 throwZ
  const fx = nx * 0.58, fz = nz * 0.5, fdip = 0.35;

  const data = new Float32Array(nx * ny * nz);
  const fWave = 0.09; // 子波主频(每采样点周期倒数)
  let maxAbs = 1e-9;

  for (let z = 0; z < nz; z++) {
    const zBase = z;
    for (let y = 0; y < ny; y++) {
      let idx = nx * (y + ny * z);
      for (let x = 0; x < nx; x++, idx++) {
        // 断层错动:断层盘一侧的界面深度整体偏移
        const onDownBlock = x > fx + (zBase - fz) * fdip;
        let v = 0;
        for (const itf of interfaces) {
          let zi = itf.z0 + itf.dipX * (x - nx / 2) + itf.dipY * (y - ny / 2);
          if (onDownBlock) zi += throwZ;
          // 横向振幅缓变,让同相轴有能量变化
          const lat = 1 + 0.25 * Math.sin(x * 0.11 + itf.z0) * Math.cos(y * 0.09);
          v += itf.amp * lat * ricker(zBase - zi, fWave);
        }
        v += (rand() - 0.5) * 0.08; // 随机噪声
        data[idx] = v;
        const a = Math.abs(v);
        if (a > maxAbs) maxAbs = a;
      }
    }
  }
  const inv = 1 / maxAbs;
  for (let i = 0; i < data.length; i++) data[i] *= inv;
  return { dims: { nx, ny, nz }, data };
}
