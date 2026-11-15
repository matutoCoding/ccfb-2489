/// <reference lib="webworker" />
/**
 * Marching Tetrahedra 等值面提取 Worker。
 * 数据体只在 init 时传入一次;之后改阈值只发 iso 消息,实现增量更新。
 */

interface InitMsg {
  type: 'init';
  nx: number; ny: number; nz: number;
  buffer: ArrayBuffer; // Float32 [-1,1]
}
interface IsoMsg { type: 'iso'; id: number; value: number; }

let nx = 0, ny = 0, nz = 0;
let data: Float32Array | null = null;

// 立方体 8 角偏移
const CORNERS = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
];
// 每个立方体剖分为 6 个四面体(角索引)
const TETS = [
  [0, 5, 1, 6], [0, 1, 2, 6], [0, 2, 3, 6],
  [0, 3, 7, 6], [0, 7, 4, 6], [0, 4, 5, 6],
];
// 四面体 6 条边的端点(局部角 0-3)
const EA = [0, 0, 0, 1, 1, 2];
const EB = [1, 2, 3, 2, 3, 3];
// 四面体三角化表(按 inside 掩码;背面剔除关闭,绕序任意)
const TET_TRIS: Record<number, number[][]> = {
  1: [[0, 1, 2]], 14: [[0, 1, 2]],
  2: [[0, 3, 4]], 13: [[0, 3, 4]],
  4: [[1, 3, 5]], 11: [[1, 3, 5]],
  8: [[2, 4, 5]], 7: [[2, 4, 5]],
  3: [[1, 2, 4], [1, 4, 3]], 12: [[1, 2, 4], [1, 4, 3]],
  5: [[0, 3, 5], [0, 5, 2]], 10: [[0, 3, 5], [0, 5, 2]],
  9: [[0, 1, 5], [0, 5, 4]], 6: [[0, 1, 5], [0, 5, 4]],
};

function valAt(x: number, y: number, z: number): number {
  const d = data!;
  return d[
    Math.min(nx - 1, Math.max(0, x)) +
    nx * (Math.min(ny - 1, Math.max(0, y)) + ny * Math.min(nz - 1, Math.max(0, z)))
  ];
}

/** 网格点梯度(中心差分) */
function gradient(x: number, y: number, z: number, out: number[]): void {
  out[0] = valAt(x + 1, y, z) - valAt(x - 1, y, z);
  out[1] = valAt(x, y + 1, z) - valAt(x, y - 1, z);
  out[2] = valAt(x, y, z + 1) - valAt(x, y, z - 1);
}

function extract(iso: number): { positions: Float32Array; normals: Float32Array } {
  const d = data!;
  const positions: number[] = [];
  const normals: number[] = [];
  // 输出归一化网格坐标 [0,1]³,由主线程映射到世界坐标
  const sx = 1 / Math.max(1, nx - 1);
  const sy = 1 / Math.max(1, ny - 1);
  const sz = 1 / Math.max(1, nz - 1);

  const cv = new Float32Array(8);       // 立方体角值
  const tv = new Float32Array(4);       // 四面体角值
  const tg: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]]; // 四面体角梯度
  const edgeP: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const edgeN: number[][] = [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]];

  for (let z = 0; z < nz - 1; z++) {
    for (let y = 0; y < ny - 1; y++) {
      for (let x = 0; x < nx - 1; x++) {
        // 读 8 角值
        let inside = 0;
        for (let c = 0; c < 8; c++) {
          const v = d[(x + CORNERS[c][0]) + nx * ((y + CORNERS[c][1]) + ny * (z + CORNERS[c][2]))];
          cv[c] = v;
          if (v >= iso) inside++;
        }
        if (inside === 0 || inside === 8) continue;

        for (const tet of TETS) {
          let mask = 0;
          for (let i = 0; i < 4; i++) {
            tv[i] = cv[tet[i]];
            if (tv[i] >= iso) mask |= 1 << i;
          }
          const tris = TET_TRIS[mask];
          if (!tris) continue;

          // 计算 4 角世界坐标与梯度
          for (let i = 0; i < 4; i++) {
            const c = CORNERS[tet[i]];
            gradient(x + c[0], y + c[1], z + c[2], tg[i]);
          }
          // 6 条边插值
          for (let e = 0; e < 6; e++) {
            const a = EA[e], b = EB[e];
            const va = tv[a], vb = tv[b];
            const ca = CORNERS[tet[a]], cb = CORNERS[tet[b]];
            const denom = vb - va;
            const t = Math.abs(denom) < 1e-12 ? 0.5 : (iso - va) / denom;
            const tc = Math.max(0, Math.min(1, t));
            edgeP[e][0] = (x + ca[0] + tc * (cb[0] - ca[0])) * sx;
            edgeP[e][1] = (y + ca[1] + tc * (cb[1] - ca[1])) * sy;
            edgeP[e][2] = (z + ca[2] + tc * (cb[2] - ca[2])) * sz;
            for (let k = 0; k < 3; k++) edgeN[e][k] = tg[a][k] + tc * (tg[b][k] - tg[a][k]);
          }
          for (const tri of tris) {
            for (const e of tri) {
              positions.push(edgeP[e][0], edgeP[e][1], edgeP[e][2]);
              const nl = Math.hypot(edgeN[e][0], edgeN[e][1], edgeN[e][2]) || 1;
              normals.push(edgeN[e][0] / nl, edgeN[e][1] / nl, edgeN[e][2] / nl);
            }
          }
        }
      }
    }
  }
  return { positions: new Float32Array(positions), normals: new Float32Array(normals) };
}

self.onmessage = (ev: MessageEvent<InitMsg | IsoMsg>) => {
  const msg = ev.data;
  if (msg.type === 'init') {
    nx = msg.nx; ny = msg.ny; nz = msg.nz;
    data = new Float32Array(msg.buffer);
    (self as unknown as Worker).postMessage({ type: 'ready' });
  } else if (msg.type === 'iso' && data) {
    const { positions, normals } = extract(msg.value);
    (self as unknown as Worker).postMessage(
      { type: 'mesh', id: msg.id, positions: positions.buffer, normals: normals.buffer, count: positions.length / 3 },
      [positions.buffer, normals.buffer],
    );
  }
};

export {};
