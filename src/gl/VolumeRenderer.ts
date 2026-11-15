import { VolumeDims, ViewerSettings } from '../types';
import {
  createProgram, mat4Perspective, mat4LookAt, mat4Multiply, mat4Invert,
  float32ToFloat16, Mat4,
} from './glutil';
import { RAYMARCH_VS, RAYMARCH_FS, MESH_VS, MESH_FS, POINTS_VS, POINTS_FS, BOX_VS, BOX_FS } from './shaders';

export interface RendererStats { fps: number; renderScale: number; }

const hexToRgb = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/**
 * 三维体渲染器:光线步进(早停)+ 解析切片合成 + 等值面网格 + 层位点。
 * 交互时自动降分辨率保帧率。
 */
export class VolumeRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private rayProg: WebGLProgram;
  private meshProg: WebGLProgram;
  private ptsProg: WebGLProgram;
  private boxProg: WebGLProgram;
  private quadVao: WebGLVertexArrayObject;
  private boxVao: WebGLVertexArrayObject;
  private boxBuf: WebGLBuffer;

  private volTex: WebGLTexture | null = null;
  private lutTex: WebGLTexture;
  private dims: VolumeDims = { nx: 1, ny: 1, nz: 1 };
  private boxMin = [-0.5, -0.5, -0.5];
  private boxMax = [0.5, 0.5, 0.5];

  private meshVao: WebGLVertexArrayObject | null = null;
  private meshCount = 0;
  private meshColor: [number, number, number, number] = [0.9, 0.7, 0.3, 0.85];

  private ptsVao: WebGLVertexArrayObject | null = null;
  private ptsCount = 0;

  // 相机
  private yaw = -0.7;
  private pitch = 0.55;
  private dist = 2.2;
  private target = [0, 0, 0];

  // 帧率 / 动态分辨率
  private fpsEma = 60;
  private lastTime = 0;
  private interacting = false;
  private lastInteract = 0;
  private renderScale = 1;
  private raf = 0;
  private destroyed = false;
  private running = false;

  settings: ViewerSettings | null = null;
  onStats: ((s: RendererStats) => void) | null = null;
  onCameraChange: (() => void) | null = null;
  private statsTimer = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      antialias: false, depth: true, preserveDrawingBuffer: false, alpha: false,
    });
    if (!gl) throw new Error('当前浏览器不支持 WebGL2');
    this.gl = gl;

    this.rayProg = createProgram(gl, RAYMARCH_VS, RAYMARCH_FS);
    this.meshProg = createProgram(gl, MESH_VS, MESH_FS);
    this.ptsProg = createProgram(gl, POINTS_VS, POINTS_FS);
    this.boxProg = createProgram(gl, BOX_VS, BOX_FS);

    // 全屏三角形
    this.quadVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.quadVao);
    const qb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, qb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // 包围盒线框
    this.boxVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.boxVao);
    this.boxBuf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.boxBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(24 * 3), gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    // LUT 纹理
    this.lutTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const initLut = new Uint8Array(256 * 4).fill(255);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, initLut);

    this.attachInput();
  }

  // ---------------- 数据 ----------------

  setVolume(dims: VolumeDims, data: Float32Array): void {
    const gl = this.gl;
    this.dims = dims;
    const { nx, ny, nz } = dims;
    // 世界坐标轴:world.x = inline(x), world.y = 深度(z,浅部朝上), world.z = crossline(y)
    const m = Math.max(nx, ny, nz);
    this.boxMin = [-nx / m / 2, -nz / m / 2, -ny / m / 2];
    this.boxMax = [nx / m / 2, nz / m / 2, ny / m / 2];

    // 纹理轴重排:texel(u,v,w) = data[x=u, z=nz-1-v, y=w](z 翻转使浅部在 +v)
    const tex = new Float32Array(data.length);
    for (let z = 0; z < nz; z++) {
      const v = nz - 1 - z;
      for (let y = 0; y < ny; y++) {
        const srcRow = nx * (y + ny * z);
        const dstRow = nx * (v + nz * y);
        for (let x = 0; x < nx; x++) {
          tex[x + dstRow] = data[x + srcRow] * 0.5 + 0.5;
        }
      }
    }

    if (this.volTex) gl.deleteTexture(this.volTex);
    this.volTex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_3D, this.volTex);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
    try {
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.R16F, nx, nz, ny, 0,
        gl.RED, gl.HALF_FLOAT, float32ToFloat16(tex));
      if (gl.getError() !== gl.NO_ERROR) throw new Error('R16F 上传失败');
    } catch {
      const bytes = new Uint8Array(tex.length);
      for (let i = 0; i < tex.length; i++) bytes[i] = Math.round(tex[i] * 255);
      gl.texImage3D(gl.TEXTURE_3D, 0, gl.R8, nx, nz, ny, 0,
        gl.RED, gl.UNSIGNED_BYTE, bytes);
    }

    // 更新包围盒线框顶点
    const [x0, y0, z0] = this.boxMin, [x1, y1, z1] = this.boxMax;
    const c = [
      [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
      [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
    ];
    const edges = [0,1, 1,2, 2,3, 3,0, 4,5, 5,6, 6,7, 7,4, 0,4, 1,5, 2,6, 3,7];
    const verts = new Float32Array(edges.length * 3);
    edges.forEach((e, i) => verts.set(c[e], i * 3));
    gl.bindVertexArray(this.boxVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.boxBuf);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
  }

  setLut(rgba: Uint8Array): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 256, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
  }

  setIsoMesh(positions: Float32Array | null, normals: Float32Array | null, colorHex = '#e0b34d', opacity = 0.85): void {
    const gl = this.gl;
    if (this.meshVao) { gl.deleteVertexArray(this.meshVao); this.meshVao = null; }
    this.meshCount = 0;
    const [r, g, b] = hexToRgb(colorHex);
    this.meshColor = [r, g, b, opacity];
    if (!positions || !normals || positions.length === 0) return;
    const n = positions.length / 3;
    const interleaved = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      interleaved[i * 6 + 0] = positions[i * 3 + 0];
      interleaved[i * 6 + 1] = positions[i * 3 + 1];
      interleaved[i * 6 + 2] = positions[i * 3 + 2];
      interleaved[i * 6 + 3] = normals[i * 3 + 0];
      interleaved[i * 6 + 4] = normals[i * 3 + 1];
      interleaved[i * 6 + 5] = normals[i * 3 + 2];
    }
    this.meshVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.meshVao);
    const vb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindVertexArray(null);
    this.meshCount = n;
  }

  /** 只更新等值面不透明度(无需重算网格) */
  setIsoMeshOpacity(opacity: number): void {
    this.meshColor[3] = opacity;
  }

  setHorizonPoints(positions: Float32Array | null, colors: Float32Array | null): void {
    const gl = this.gl;
    if (this.ptsVao) { gl.deleteVertexArray(this.ptsVao); this.ptsVao = null; }
    this.ptsCount = 0;
    if (!positions || !colors || positions.length === 0) return;
    const n = positions.length / 3;
    const interleaved = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      interleaved[i * 6 + 0] = positions[i * 3 + 0];
      interleaved[i * 6 + 1] = positions[i * 3 + 1];
      interleaved[i * 6 + 2] = positions[i * 3 + 2];
      interleaved[i * 6 + 3] = colors[i * 3 + 0];
      interleaved[i * 6 + 4] = colors[i * 3 + 1];
      interleaved[i * 6 + 5] = colors[i * 3 + 2];
    }
    this.ptsVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.ptsVao);
    const vb = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, interleaved, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.bindVertexArray(null);
    this.ptsCount = n;
  }

  /** 网格坐标 (x∈[0,nx), y∈[0,ny), z∈[0,nz)) → 世界坐标(z 浅部朝上) */
  gridToWorld(x: number, y: number, z: number): [number, number, number] {
    const { nx, ny, nz } = this.dims;
    return [
      this.boxMin[0] + (x / Math.max(1, nx - 1)) * (this.boxMax[0] - this.boxMin[0]),
      this.boxMin[1] + (1 - z / Math.max(1, nz - 1)) * (this.boxMax[1] - this.boxMin[1]),
      this.boxMin[2] + (y / Math.max(1, ny - 1)) * (this.boxMax[2] - this.boxMin[2]),
    ];
  }

  // ---------------- 相机与输入 ----------------

  private attachInput(): void {
    const c = this.canvas;
    let dragging = false, panning = false, lx = 0, ly = 0;
    c.addEventListener('pointerdown', e => {
      dragging = true;
      panning = e.button === 2 || e.shiftKey;
      lx = e.clientX; ly = e.clientY;
      c.setPointerCapture(e.pointerId);
      this.interacting = true;
      this.lastInteract = performance.now();
    });
    c.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      if (panning) {
        const s = this.dist * 0.0016;
        const right = [Math.cos(this.yaw), 0, -Math.sin(this.yaw)];
        const upv = [0, 1, 0];
        this.target[0] -= right[0] * dx * s;
        this.target[2] -= right[2] * dx * s;
        this.target[1] += upv[1] * dy * s;
      } else {
        this.yaw += dx * 0.008;
        this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch + dy * 0.008));
      }
      this.lastInteract = performance.now();
      this.onCameraChange?.();
    });
    c.addEventListener('pointerup', () => { dragging = false; this.interacting = false; });
    c.addEventListener('pointerleave', () => { dragging = false; this.interacting = false; });
    c.addEventListener('wheel', e => {
      e.preventDefault();
      this.dist = Math.max(0.4, Math.min(8, this.dist * (1 + Math.sign(e.deltaY) * 0.1)));
      this.lastInteract = performance.now();
      this.interacting = true;
      setTimeout(() => { this.interacting = false; }, 120);
      this.onCameraChange?.();
    }, { passive: false });
    c.addEventListener('contextmenu', e => e.preventDefault());
  }

  private camera(): { vp: Mat4; invVp: Mat4; eye: number[] } {
    const eye = [
      this.target[0] + this.dist * Math.cos(this.pitch) * Math.sin(this.yaw),
      this.target[1] + this.dist * Math.sin(this.pitch),
      this.target[2] + this.dist * Math.cos(this.pitch) * Math.cos(this.yaw),
    ];
    const aspect = Math.max(1e-3, this.canvas.width / Math.max(1, this.canvas.height));
    const proj = mat4Perspective(50 * Math.PI / 180, aspect, 0.02, 50);
    const view = mat4LookAt(eye, this.target, [0, 1, 0]);
    const vp = mat4Multiply(proj, view);
    return { vp, invVp: mat4Invert(vp), eye };
  }

  // ---------------- 渲染 ----------------

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    const loop = (now: number) => {
      if (this.destroyed || !this.running) return;
      const dt = Math.max(1, now - this.lastTime);
      this.lastTime = now;
      const fps = 1000 / dt;
      this.fpsEma += (fps - this.fpsEma) * 0.08;
      this.updateRenderScale(now);
      this.render();
      this.statsTimer += dt;
      if (this.statsTimer > 250 && this.onStats) {
        this.statsTimer = 0;
        this.onStats({ fps: this.fpsEma, renderScale: this.renderScale });
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy(): void {
    this.destroyed = true;
    this.stop();
    this.gl.getExtension('WEBGL_lose_context')?.loseContext();
  }

  /** 交互中降分辨率;帧率持续偏低时进一步降低 */
  private updateRenderScale(now: number): void {
    const recentlyActive = this.interacting || now - this.lastInteract < 250;
    let target = recentlyActive ? 0.5 : 1.0;
    if (!recentlyActive && this.fpsEma < 20) target = 0.6;
    else if (!recentlyActive && this.fpsEma < 35) target = Math.min(target, 0.8);
    this.renderScale += (target - this.renderScale) * 0.5;
    if (Math.abs(this.renderScale - target) < 0.02) this.renderScale = target;
  }

  private resize(): void {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(8, Math.floor(this.canvas.clientWidth * dpr * this.renderScale));
    const h = Math.max(8, Math.floor(this.canvas.clientHeight * dpr * this.renderScale));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  private buildPlanes(): number[] {
    const s = this.settings;
    const planes: number[] = [];
    if (!s) return planes;
    const [x0, y0, z0] = this.boxMin, [x1, y1, z1] = this.boxMax;
    // 世界轴:x=inline, y=深度(浅在上), z=crossline
    if (s.sliceXOn) planes.push(1, 0, 0, x0 + s.sliceX * (x1 - x0));
    if (s.sliceYOn) planes.push(0, 0, 1, z0 + s.sliceY * (z1 - z0));
    if (s.sliceZOn) planes.push(0, 1, 0, y0 + (1 - s.sliceZ) * (y1 - y0));
    if (s.arbOn) {
      const n = s.arbNormal;
      const len = Math.hypot(n[0], n[1], n[2]) || 1;
      const diag = Math.hypot(x1 - x0, y1 - y0, z1 - z0);
      planes.push(n[0] / len, n[1] / len, n[2] / len, s.arbOffset * diag * 0.5);
    }
    return planes;
  }

  render(): void {
    const gl = this.gl;
    this.resize();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.clearColor(0.045, 0.055, 0.075, 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const { vp, invVp, eye } = this.camera();
    const s = this.settings;

    // --- 体渲染(光线步进,切片在着色器内解析合成) ---
    if (this.volTex && s) {
      gl.useProgram(this.rayProg);
      gl.bindVertexArray(this.quadVao);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_3D, this.volTex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.lutTex);
      const u = (n: string) => gl.getUniformLocation(this.rayProg, n);
      gl.uniform1i(u('uVol'), 0);
      gl.uniform1i(u('uLut'), 1);
      gl.uniformMatrix4fv(u('uInvVP'), false, invVp);
      gl.uniform3fv(u('uCamPos'), eye);
      gl.uniform3fv(u('uBoxMin'), this.boxMin);
      gl.uniform3fv(u('uBoxMax'), this.boxMax);
      gl.uniform1i(u('uSteps'), this.interacting ? Math.max(96, Math.floor(s.steps / 2)) : s.steps);
      gl.uniform1f(u('uDensity'), 1.0);
      gl.uniform1i(u('uLighting'), s.lighting ? 1 : 0);
      const planes = this.buildPlanes();
      const planeArr = new Float32Array(16);
      planeArr.set(planes);
      gl.uniform4fv(u('uPlanes'), planeArr);
      gl.uniform1i(u('uNumPlanes'), planes.length / 4);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // --- 等值面网格 ---
    if (this.meshVao && this.meshCount > 0 && s?.isoEnabled) {
      gl.useProgram(this.meshProg);
      gl.enable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.meshProg, 'uVP'), false, vp);
      gl.uniform4fv(gl.getUniformLocation(this.meshProg, 'uColor'), this.meshColor);
      gl.bindVertexArray(this.meshVao);
      gl.drawArrays(gl.TRIANGLES, 0, this.meshCount);
      gl.disable(gl.BLEND);
      gl.disable(gl.DEPTH_TEST);
    }

    // --- 层位拾取点 ---
    if (this.ptsVao && this.ptsCount > 0) {
      gl.useProgram(this.ptsProg);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(gl.getUniformLocation(this.ptsProg, 'uVP'), false, vp);
      gl.uniform1f(gl.getUniformLocation(this.ptsProg, 'uPointSize'), 4.0);
      gl.bindVertexArray(this.ptsVao);
      gl.drawArrays(gl.POINTS, 0, this.ptsCount);
      gl.disable(gl.BLEND);
    }

    // --- 包围盒 ---
    gl.useProgram(this.boxProg);
    gl.uniformMatrix4fv(gl.getUniformLocation(this.boxProg, 'uVP'), false, vp);
    gl.uniform4f(gl.getUniformLocation(this.boxProg, 'uColor'), 0.45, 0.55, 0.7, 0.6);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindVertexArray(this.boxVao);
    gl.drawArrays(gl.LINES, 0, 24);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(null);
  }

  /** 全分辨率渲染一帧并截图 */
  screenshot(): Promise<Blob | null> {
    const saved = this.renderScale;
    this.renderScale = 1;
    this.render();
    this.renderScale = saved;
    return new Promise(resolve => this.canvas.toBlob(b => resolve(b), 'image/png'));
  }
}
