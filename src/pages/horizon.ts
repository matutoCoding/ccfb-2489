import { getSession, openLastProject } from '../core/session';
import { buildLut, getColormap } from '../core/colormaps';
import { listHorizons, putHorizon, deleteHorizon, HorizonRow } from '../core/db';
import { autoTrack } from '../horizon/tracker';
import { VolumeRenderer } from '../gl/VolumeRenderer';
import { uid } from '../types';
import { toast } from '../ui';

const HORIZON_COLORS = ['#ff5d5d', '#4dcc7d', '#ffb84d', '#4da3ff', '#c44dff', '#4dd0d0'];

interface Seed { x: number; y: number; z: number; }

export async function renderHorizonPage(root: HTMLElement): Promise<() => void> {
  const session = await openLastProject();
  if (!session) {
    location.hash = '#/projects';
    return () => {};
  }
  const { dims, data } = session;
  const nx = dims.nx, ny = dims.ny, nz = dims.nz;

  root.innerHTML = `
    <div class="horizon-layout">
      <div class="horizon-main">
        <div class="horizon-sections">
          <div class="section-cell"><canvas id="sec-inline"></canvas><span class="cell-label" id="lbl-inline"></span></div>
          <div class="section-cell"><canvas id="sec-crossline"></canvas><span class="cell-label" id="lbl-crossline"></span></div>
          <div class="section-cell"><canvas id="sec-timeslice"></canvas><span class="cell-label" id="lbl-timeslice"></span></div>
          <div class="section-cell"><canvas id="sec-3d"></canvas><span class="cell-label">3D 预览(可拖动)</span></div>
        </div>
      </div>
      <div class="sidebar">
        <div class="section">
          <h4>层位</h4>
          <div id="hz-list"></div>
          <div class="row">
            <button id="btn-new-hz" style="flex:1">新建层位</button>
            <button id="btn-del-hz" class="danger">删除</button>
          </div>
          <div class="row"><label>名称</label><input id="hz-name" style="flex:1"/></div>
          <div class="row"><label>颜色</label><input type="color" id="hz-color" style="flex:1;height:28px;padding:2px"/></div>
          <div class="muted" id="hz-stats"></div>
        </div>
        <div class="section">
          <h4>拾取模式</h4>
          <div class="row">
            <button class="mode-btn primary" data-mode="pick" style="flex:1">手动拾取</button>
            <button class="mode-btn" data-mode="seed" style="flex:1">种子点</button>
            <button class="mode-btn" data-mode="erase" style="flex:1">擦除</button>
          </div>
          <div class="muted">在剖面/时间切片上点击操作;种子点显示为白色十字</div>
        </div>
        <div class="section">
          <h4>自动追踪</h4>
          <div class="row"><label>搜索窗</label><input type="range" id="trk-win" min="3" max="15" step="1" value="7"/><span class="val" id="trk-win-v">7</span></div>
          <div class="row"><label>最大倾角</label><input type="range" id="trk-dip" min="2" max="15" step="1" value="6"/><span class="val" id="trk-dip-v">6</span></div>
          <button id="btn-track" class="primary" style="width:100%">从种子点自动追踪</button>
          <div class="muted" id="track-status"></div>
        </div>
        <div class="section">
          <h4>剖面位置</h4>
          <div class="row"><label>Inline(Y)</label><input type="range" id="sl-y" min="0" max="${ny - 1}" value="${Math.floor(ny / 2)}"/><span class="val" id="sl-y-v"></span></div>
          <div class="row"><label>Xline(X)</label><input type="range" id="sl-x" min="0" max="${nx - 1}" value="${Math.floor(nx / 2)}"/><span class="val" id="sl-x-v"></span></div>
          <div class="row"><label>切片(Z)</label><input type="range" id="sl-z" min="0" max="${nz - 1}" value="${Math.floor(nz / 2)}"/><span class="val" id="sl-z-v"></span></div>
        </div>
        <div class="section">
          <div class="muted" id="save-status">已保存(IndexedDB)</div>
        </div>
      </div>
    </div>`;

  const $ = <T extends HTMLElement>(q: string) => root.querySelector(q) as T;

  // ---------- 状态 ----------
  let horizons: HorizonRow[] = await listHorizons(session.project.id);
  let activeId: string | null = horizons[0]?.id ?? null;
  let grid: Float32Array = new Float32Array(nx * ny).fill(NaN);
  let seeds: Seed[] = [];
  let mode: 'pick' | 'seed' | 'erase' = 'pick';
  let curX = Math.floor(nx / 2), curY = Math.floor(ny / 2), curZ = Math.floor(nz / 2);
  let dirty = false;

  // 剖面色标 LUT(全不透明)
  const sectionLut = buildLut(getColormap(session.settings.colormapId), [{ t: 0, o: 1 }, { t: 1, o: 1 }]);

  function activeHorizon(): HorizonRow | undefined {
    return horizons.find(h => h.id === activeId);
  }
  function loadActiveGrid() {
    const h = activeHorizon();
    grid = h ? new Float32Array(h.buffer.slice(0)) : new Float32Array(nx * ny).fill(NaN);
    seeds = [];
    updateHzPanel();
  }

  // ---------- 持久化 ----------
  let saveTimer = 0;
  function scheduleSave() {
    dirty = true;
    $('#save-status').textContent = '未保存…';
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveNow, 800);
  }
  async function saveNow() {
    const h = activeHorizon();
    if (!h || !dirty) return;
    h.buffer = grid.slice().buffer as ArrayBuffer;
    h.updated = Date.now();
    await putHorizon(h);
    dirty = false;
    $('#save-status').textContent = `已保存 ${new Date().toLocaleTimeString()}`;
  }

  // ---------- 层位列表 UI ----------
  function updateHzPanel() {
    const listEl = $('#hz-list');
    listEl.innerHTML = '';
    if (horizons.length === 0) {
      listEl.innerHTML = '<div class="muted">还没有层位,点击「新建层位」</div>';
    }
    for (const h of horizons) {
      const row = document.createElement('div');
      row.className = 'cm-item' + (h.id === activeId ? ' active' : '');
      row.innerHTML = `<span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${h.color}"></span><span class="cm-name">${h.name}</span>`;
      row.onclick = () => { saveNow().then(() => { activeId = h.id; loadActiveGrid(); redrawAll(); }); };
      listEl.appendChild(row);
    }
    const h = activeHorizon();
    $<HTMLInputElement>('#hz-name').value = h?.name ?? '';
    $<HTMLInputElement>('#hz-color').value = h?.color ?? '#ff5d5d';
    updateHzStats();
  }
  function updateHzStats() {
    let cnt = 0;
    for (let i = 0; i < grid.length; i++) if (!Number.isNaN(grid[i])) cnt++;
    $('#hz-stats').textContent = activeHorizon()
      ? `已拾取 ${cnt.toLocaleString()} / ${(nx * ny).toLocaleString()} 个CDP(${(100 * cnt / (nx * ny)).toFixed(1)}%)`
      : '';
  }

  $('#btn-new-hz').onclick = async () => {
    await saveNow();
    const h: HorizonRow = {
      id: uid(), projectId: session.project.id,
      name: `层位-${horizons.length + 1}`,
      color: HORIZON_COLORS[horizons.length % HORIZON_COLORS.length],
      buffer: new Float32Array(nx * ny).fill(NaN).buffer as ArrayBuffer,
      updated: Date.now(),
    };
    await putHorizon(h);
    horizons.push(h);
    activeId = h.id;
    loadActiveGrid();
    redrawAll();
  };
  $('#btn-del-hz').onclick = async () => {
    const h = activeHorizon();
    if (!h || !confirm(`删除层位「${h.name}」?`)) return;
    await deleteHorizon(h.id);
    horizons = horizons.filter(x => x.id !== h.id);
    activeId = horizons[0]?.id ?? null;
    loadActiveGrid();
    redrawAll();
  };
  $('#hz-name').addEventListener('change', () => {
    const h = activeHorizon();
    if (h) { h.name = $<HTMLInputElement>('#hz-name').value || h.name; dirty = true; scheduleSave(); updateHzPanel(); }
  });
  $('#hz-color').addEventListener('input', () => {
    const h = activeHorizon();
    if (h) { h.color = $<HTMLInputElement>('#hz-color').value; dirty = true; scheduleSave(); redrawAll(); }
  });

  // ---------- 模式 ----------
  root.querySelectorAll<HTMLButtonElement>('.mode-btn').forEach(btn => {
    btn.onclick = () => {
      mode = btn.dataset.mode as typeof mode;
      root.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('primary', b === btn));
    };
  });

  // ---------- 剖面绘制 ----------
  function drawSection(canvas: HTMLCanvasElement, kind: 'inline' | 'crossline' | 'timeslice') {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(8, Math.floor(canvas.clientWidth * dpr));
    const H = Math.max(8, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    const ctx = canvas.getContext('2d')!;

    const w = kind === 'inline' ? nx : kind === 'crossline' ? ny : nx;
    const h = kind === 'inline' ? nz : kind === 'crossline' ? nz : ny;
    const img = new ImageData(w, h);
    const px = img.data;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let idx: number;
        if (kind === 'inline') idx = i + nx * (curY + ny * j);          // (x=i, z=j)
        else if (kind === 'crossline') idx = curX + nx * (i + ny * j);  // (y=i, z=j)
        else idx = i + nx * (j + ny * curZ);                            // (x=i, y=j)
        const v = Math.max(-1, Math.min(1, data[idx]));
        const li = Math.round((v * 0.5 + 0.5) * 255) * 4;
        const o = (i + w * j) * 4;
        px[o] = sectionLut[li]; px[o + 1] = sectionLut[li + 1];
        px[o + 2] = sectionLut[li + 2]; px[o + 3] = 255;
      }
    }
    const off = document.createElement('canvas');
    off.width = w; off.height = h;
    off.getContext('2d')!.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(off, 0, 0, W, H);

    // 叠加:当前层位拾取点 + 种子
    const hz = activeHorizon();
    const sx = W / w, sy = H / h;
    if (hz) {
      ctx.fillStyle = hz.color;
      if (kind === 'inline') {
        for (let x = 0; x < nx; x++) {
          const z = grid[x + nx * curY];
          if (!Number.isNaN(z)) { ctx.beginPath(); ctx.arc(x * sx, z * sy, 2.2 * dpr, 0, 7); ctx.fill(); }
        }
      } else if (kind === 'crossline') {
        for (let y = 0; y < ny; y++) {
          const z = grid[curX + nx * y];
          if (!Number.isNaN(z)) { ctx.beginPath(); ctx.arc(y * sx, z * sy, 2.2 * dpr, 0, 7); ctx.fill(); }
        }
      } else {
        for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
          const z = grid[x + nx * y];
          if (!Number.isNaN(z) && Math.abs(z - curZ) < 1.5) { ctx.beginPath(); ctx.arc(x * sx, y * sy, 2.2 * dpr, 0, 7); ctx.fill(); }
        }
      }
    }
    // 种子点(白色十字)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5 * dpr;
    for (const sd of seeds) {
      let px2 = -1, py2 = -1;
      if (kind === 'inline' && sd.y === curY) { px2 = sd.x * sx; py2 = sd.z * sy; }
      else if (kind === 'crossline' && sd.x === curX) { px2 = sd.y * sx; py2 = sd.z * sy; }
      else if (kind === 'timeslice' && Math.abs(sd.z - curZ) < 1.5) { px2 = sd.x * sx; py2 = sd.y * sy; }
      if (px2 >= 0) {
        const r = 5 * dpr;
        ctx.beginPath();
        ctx.moveTo(px2 - r, py2); ctx.lineTo(px2 + r, py2);
        ctx.moveTo(px2, py2 - r); ctx.lineTo(px2, py2 + r);
        ctx.stroke();
      }
    }
    // 十字线指示其它剖面位置
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (kind === 'inline') { ctx.moveTo(curX * sx, 0); ctx.lineTo(curX * sx, H); ctx.moveTo(0, curZ * sy); ctx.lineTo(W, curZ * sy); }
    else if (kind === 'crossline') { ctx.moveTo(curY * sx, 0); ctx.lineTo(curY * sx, H); ctx.moveTo(0, curZ * sy); ctx.lineTo(W, curZ * sy); }
    else { ctx.moveTo(curX * sx, 0); ctx.lineTo(curX * sx, H); ctx.moveTo(0, curY * sy); ctx.lineTo(W, curY * sy); }
    ctx.stroke();
  }

  const secInline = $<HTMLCanvasElement>('#sec-inline');
  const secCross = $<HTMLCanvasElement>('#sec-crossline');
  const secTime = $<HTMLCanvasElement>('#sec-timeslice');

  function updateLabels() {
    $('#lbl-inline').textContent = `Inline 剖面 Y=${curY}`;
    $('#lbl-crossline').textContent = `Crossline 剖面 X=${curX}`;
    $('#lbl-timeslice').textContent = `时间切片 Z=${curZ}`;
    $<HTMLInputElement>('#sl-x').value = String(curX);
    $<HTMLInputElement>('#sl-y').value = String(curY);
    $<HTMLInputElement>('#sl-z').value = String(curZ);
    $('#sl-x-v').textContent = String(curX);
    $('#sl-y-v').textContent = String(curY);
    $('#sl-z-v').textContent = String(curZ);
  }

  function redrawAll() {
    drawSection(secInline, 'inline');
    drawSection(secCross, 'crossline');
    drawSection(secTime, 'timeslice');
    updateLabels();
    updateHzStats();
    update3DPoints();
  }

  // ---------- 拾取交互 ----------
  function sectionClick(canvas: HTMLCanvasElement, kind: 'inline' | 'crossline' | 'timeslice', e: MouseEvent) {
    if (!activeHorizon()) { toast('请先新建一个层位'); return; }
    const r = canvas.getBoundingClientRect();
    const u = (e.clientX - r.left) / r.width;
    const v = (e.clientY - r.top) / r.height;
    let x = curX, y = curY, z = curZ;
    if (kind === 'inline') { x = Math.round(u * (nx - 1)); z = Math.round(v * (nz - 1)); }
    else if (kind === 'crossline') { y = Math.round(u * (ny - 1)); z = Math.round(v * (nz - 1)); }
    else { x = Math.round(u * (nx - 1)); y = Math.round(v * (ny - 1)); }
    x = Math.max(0, Math.min(nx - 1, x));
    y = Math.max(0, Math.min(ny - 1, y));
    z = Math.max(0, Math.min(nz - 1, z));

    if (mode === 'pick') {
      grid[x + nx * y] = z;
      scheduleSave();
    } else if (mode === 'seed') {
      seeds.push({ x, y, z });
      if (seeds.length > 8) seeds.shift();
      toast(`种子点 (${x}, ${y}, ${z}),共 ${seeds.length} 个`);
    } else {
      // 擦除:半径 3 CDP
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < nx && yy >= 0 && yy < ny) grid[xx + nx * yy] = NaN;
      }
      scheduleSave();
    }
    redrawAll();
  }
  secInline.addEventListener('click', e => sectionClick(secInline, 'inline', e));
  secCross.addEventListener('click', e => sectionClick(secCross, 'crossline', e));
  secTime.addEventListener('click', e => sectionClick(secTime, 'timeslice', e));

  // ---------- 剖面位置滑块 ----------
  $('#sl-x').addEventListener('input', e => { curX = Number((e.target as HTMLInputElement).value); redrawAll(); });
  $('#sl-y').addEventListener('input', e => { curY = Number((e.target as HTMLInputElement).value); redrawAll(); });
  $('#sl-z').addEventListener('input', e => { curZ = Number((e.target as HTMLInputElement).value); redrawAll(); });
  $('#trk-win').addEventListener('input', e => { $('#trk-win-v').textContent = (e.target as HTMLInputElement).value; });
  $('#trk-dip').addEventListener('input', e => { $('#trk-dip-v').textContent = (e.target as HTMLInputElement).value; });

  // ---------- 自动追踪 ----------
  $('#btn-track').onclick = async () => {
    if (!activeHorizon()) { toast('请先新建一个层位'); return; }
    if (seeds.length === 0) { toast('请先用「种子点」模式在剖面上点至少一个种子'); return; }
    const status = $('#track-status');
    const btn = $<HTMLButtonElement>('#btn-track');
    btn.disabled = true;
    const win = Number($<HTMLInputElement>('#trk-win').value);
    const dip = Number($<HTMLInputElement>('#trk-dip').value);
    try {
      for (let si = 0; si < seeds.length; si++) {
        const sd = seeds[si];
        status.textContent = `追踪种子 ${si + 1}/${seeds.length}…`;
        await new Promise(r => setTimeout(r, 30)); // 让 UI 刷新
        const tracked = autoTrack(data, dims, sd.x, sd.y, sd.z,
          { searchWin: win, maxDip: dip },
          f => { status.textContent = `追踪种子 ${si + 1}/${seeds.length}… ${(f * 100).toFixed(0)}%`; });
        // 合并:只填空缺,保留手动拾取
        let added = 0;
        for (let i = 0; i < grid.length; i++) {
          if (Number.isNaN(grid[i]) && !Number.isNaN(tracked[i])) { grid[i] = tracked[i]; added++; }
        }
        status.textContent = `种子 ${si + 1} 新增 ${added.toLocaleString()} 个CDP`;
        redrawAll();
      }
      scheduleSave();
      status.textContent = '追踪完成,已保存';
      toast('自动追踪完成');
    } finally {
      btn.disabled = false;
    }
  };

  // ---------- 3D 预览 ----------
  const canvas3d = $<HTMLCanvasElement>('#sec-3d');
  const renderer3d = new VolumeRenderer(canvas3d);
  renderer3d.settings = { ...session.settings, sliceXOn: false, sliceYOn: false, sliceZOn: false, arbOn: false, isoEnabled: false };
  renderer3d.setVolume(dims, data);
  renderer3d.setLut(buildLut(getColormap(session.settings.colormapId), session.settings.opacity));
  renderer3d.start();

  let ptsTimer = 0;
  function update3DPoints() {
    clearTimeout(ptsTimer);
    ptsTimer = window.setTimeout(() => {
      const pos: number[] = [];
      const col: number[] = [];
      for (const h of horizons) {
        const g = h.id === activeId ? grid : new Float32Array(h.buffer);
        const c = parseInt(h.color.slice(1), 16);
        const cr = ((c >> 16) & 255) / 255, cg = ((c >> 8) & 255) / 255, cb = (c & 255) / 255;
        for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
          const z = g[x + nx * y];
          if (Number.isNaN(z)) continue;
          const w = renderer3d.gridToWorld(x, y, z);
          pos.push(w[0], w[1], w[2]);
          col.push(cr, cg, cb);
        }
      }
      renderer3d.setHorizonPoints(
        pos.length ? new Float32Array(pos) : null,
        col.length ? new Float32Array(col) : null,
      );
    }, 200);
  }

  // ---------- 窗口尺寸变化重绘 ----------
  const resizeObs = new ResizeObserver(() => redrawAll());
  resizeObs.observe(root.querySelector('.horizon-sections')!);

  loadActiveGrid();
  redrawAll();

  return () => {
    resizeObs.disconnect();
    renderer3d.destroy();
    saveNow();
  };
}
