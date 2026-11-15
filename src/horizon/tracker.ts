import { VolumeDims } from '../types';

/**
 * 层位自动追踪:
 * 1) 从种子点沿当前剖面向两侧逐道追踪(局部波形相关 + 同极性极值 + 倾角约束)
 * 2) 以已追踪剖面为向导,向相邻剖面传播
 */

const get = (data: Float32Array, d: VolumeDims, x: number, y: number, z: number): number =>
  data[
    Math.min(d.nx - 1, Math.max(0, x)) +
    d.nx * (Math.min(d.ny - 1, Math.max(0, y)) + d.ny * Math.min(d.nz - 1, Math.max(0, z)))
  ];

/** 两道在 k 附近 ±halfWin 窗口内的归一化相关系数 */
function correl(data: Float32Array, d: VolumeDims,
  x1: number, y1: number, k1: number,
  x2: number, y2: number, k2: number, halfWin: number): number {
  let s1 = 0, s2 = 0, s11 = 0, s22 = 0, s12 = 0, n = 0;
  for (let w = -halfWin; w <= halfWin; w++) {
    const a = get(data, d, x1, y1, k1 + w);
    const b = get(data, d, x2, y2, k2 + w);
    s1 += a; s2 += b; s11 += a * a; s22 += b * b; s12 += a * b; n++;
  }
  const num = s12 - (s1 * s2) / n;
  const den = Math.sqrt((s11 - (s1 * s1) / n) * (s22 - (s2 * s2) / n));
  return den < 1e-12 ? 0 : num / den;
}

/** 在 [kMin, kMax] 内找与参考道最相关、且与参考同相性(极性一致)的 k */
function bestK(data: Float32Array, d: VolumeDims,
  refX: number, refY: number, refK: number,
  x: number, y: number, kPred: number,
  searchWin: number, halfWin: number, refSign: number): { k: number; score: number } {
  let best = -2, bestK = kPred;
  const k0 = Math.max(halfWin + 1, Math.round(kPred) - searchWin);
  const k1 = Math.min(d.nz - halfWin - 2, Math.round(kPred) + searchWin);
  for (let k = k0; k <= k1; k++) {
    const v = get(data, d, x, y, k);
    if (Math.sign(v) !== refSign && Math.abs(v) > 0.05) continue; // 极性约束
    const c = correl(data, d, refX, refY, refK, x, y, k, halfWin);
    // 振幅越大越可能是同一同相轴
    const score = c + 0.15 * Math.abs(v);
    if (score > best) { best = score; bestK = k; }
  }
  return { k: bestK, score: best };
}

export interface TrackOptions {
  searchWin?: number;   // 垂向搜索半径(采样点)
  halfWin?: number;     // 波形相关半窗
  maxDip?: number;      // 相邻道最大允许垂向跳变
  minScore?: number;    // 相关阈值,低于则中断该方向
}

/** 沿 inline 方向(y 固定)从种子向两侧追踪一条线 */
function trackLine(data: Float32Array, d: VolumeDims, y: number, seedX: number, seedK: number,
  opts: Required<TrackOptions>, guide?: Float32Array): Float32Array {
  const out = new Float32Array(d.nx).fill(NaN);
  out[seedX] = seedK;
  const refSign = Math.sign(get(data, d, seedX, y, seedK)) || 1;

  for (const dir of [1, -1]) {
    let kPrev = seedK, kPrev2 = seedK;
    let refX = seedX, refK = seedK;
    for (let x = seedX + dir; x >= 0 && x < d.nx; x += dir) {
      // 预测:线性外推 + 向导剖面(若有)
      let pred = kPrev + (kPrev - kPrev2);
      if (guide && !Number.isNaN(guide[x])) pred = 0.5 * pred + 0.5 * guide[x];
      const r = bestK(data, d, refX, y, refK, x, y, pred, opts.searchWin, opts.halfWin, refSign);
      if (r.score < opts.minScore || Math.abs(r.k - kPrev) > opts.maxDip) break;
      out[x] = r.k;
      kPrev2 = kPrev; kPrev = r.k;
      // 参考道随追踪移动(滑动参考,适应波形渐变)
      if (x % 4 === 0) { refX = x; refK = r.k; }
    }
  }
  return out;
}

/**
 * 从种子点做全 3D 自动追踪,返回 nx*ny 网格(NaN = 未追踪到)。
 * onProgress 可用于 UI 反馈(0..1)。
 */
export function autoTrack(
  data: Float32Array, dims: VolumeDims,
  seedX: number, seedY: number, seedK: number,
  options: TrackOptions = {},
  onProgress?: (f: number) => void,
): Float32Array {
  const opts: Required<TrackOptions> = {
    searchWin: options.searchWin ?? 7,
    halfWin: options.halfWin ?? 4,
    maxDip: options.maxDip ?? 6,
    minScore: options.minScore ?? 0.35,
  };
  const grid = new Float32Array(dims.nx * dims.ny).fill(NaN);

  // 1) 种子所在剖面
  const seedLine = trackLine(data, dims, seedY, seedX, seedK, opts);
  for (let x = 0; x < dims.nx; x++) grid[x + dims.nx * seedY] = seedLine[x];
  onProgress?.(1 / (dims.ny + 1));

  // 2) 向两侧逐剖面传播,以上一剖面为向导
  for (const dir of [1, -1]) {
    let guide = seedLine;
    for (let y = seedY + dir; y >= 0 && y < dims.ny; y += dir) {
      // 本剖面种子:向导剖面在 seedX 处的值
      const gk = guide[seedX];
      if (Number.isNaN(gk)) break;
      const refSign = Math.sign(get(data, dims, seedX, y - dir, Math.round(gk))) || 1;
      const r = bestK(data, dims, seedX, y - dir, Math.round(gk), seedX, y, gk,
        opts.searchWin, opts.halfWin, refSign);
      if (r.score < opts.minScore) break;
      const line = trackLine(data, dims, y, seedX, r.k, opts, guide);
      // 若该剖面几乎没追踪到点,停止传播
      let cnt = 0;
      for (let x = 0; x < dims.nx; x++) if (!Number.isNaN(line[x])) cnt++;
      if (cnt < dims.nx * 0.2) break;
      for (let x = 0; x < dims.nx; x++) grid[x + dims.nx * y] = line[x];
      guide = line;
      onProgress?.((Math.abs(y - seedY) + 1) / (dims.ny - seedY > seedY ? dims.ny - seedY : seedY + 1) * 0.5 + (dir === 1 ? 0 : 0.5));
    }
  }
  onProgress?.(1);
  return grid;
}
