import { getSession, openLastProject, saveSettings } from '../core/session';
import { buildLut, getColormap, allColormaps, getActiveColormapId } from '../core/colormaps';
import { listHorizons, HorizonRow } from '../core/db';
import { VolumeRenderer } from '../gl/VolumeRenderer';
import { toast, downloadBlob } from '../ui';
import McWorker from '../workers/mc.worker?worker';

export async function renderViewer(root: HTMLElement): Promise<() => void> {
  const session = await openLastProject();
  if (!session) {
    location.hash = '#/projects';
    return () => {};
  }
  const s = session.settings;

  root.innerHTML = `
    <div class="viewer-layout">
      <div class="viewer-canvas-wrap">
        <canvas id="gl-canvas"></canvas>
        <div class="hud" id="hud"></div>
      </div>
      <div class="sidebar">
        <div class="section">
          <h4>传递函数</h4>
          <div class="row"><label>色标</label>
            <select id="sel-colormap" style="flex:1"></select>
          </div>
          <div class="muted" style="margin:4px 0">不透明度曲线(拖动节点,双击添加,右键删除)</div>
          <canvas class="tf-canvas" id="tf-canvas" width="264" height="110"></canvas>
          <div class="row"><label>光照</label><input type="checkbox" id="chk-light" ${s.lighting ? 'checked' : ''}/></div>
          <div class="row"><label>步进数</label><input type="range" id="rng-steps" min="96" max="640" step="16" value="${s.steps}"/><span class="val" id="val-steps">${s.steps}</span></div>
        </div>
        <div class="section">
          <h4>正交剖面</h4>
          ${(['X', 'Y', 'Z'] as const).map(ax => `
          <div class="row">
            <input type="checkbox" id="chk-s${ax}" ${s[`slice${ax}On` as const] ? 'checked' : ''}/>
            <label style="flex:0 0 20px">${ax}</label>
            <input type="range" id="rng-s${ax}" min="0" max="1" step="0.005" value="${s[`slice${ax}` as const]}"/>
            <span class="val" id="val-s${ax}"></span>
          </div>`).join('')}
        </div>
        <div class="section">
          <h4>任意方向切片</h4>
          <div class="row"><label>启用</label><input type="checkbox" id="chk-arb" ${s.arbOn ? 'checked' : ''}/></div>
          <div class="row"><label>倾角</label><input type="range" id="rng-arb-dip" min="0" max="90" step="1" value="45"/><span class="val" id="val-arb-dip">45°</span></div>
          <div class="row"><label>方位</label><input type="range" id="rng-arb-az" min="0" max="360" step="1" value="45"/><span class="val" id="val-arb-az">45°</span></div>
          <div class="row"><label>偏移</label><input type="range" id="rng-arb-off" min="-1" max="1" step="0.01" value="${s.arbOffset}"/><span class="val" id="val-arb-off">${s.arbOffset.toFixed(2)}</span></div>
        </div>
        <div class="section">
          <h4>等值面(Worker)</h4>
          <div class="row"><label>启用</label><input type="checkbox" id="chk-iso" ${s.isoEnabled ? 'checked' : ''}/></div>
          <div class="row"><label>阈值</label><input type="range" id="rng-iso" min="-1" max="1" step="0.01" value="${s.isoValue}"/><span class="val" id="val-iso">${s.isoValue.toFixed(2)}</span></div>
          <div class="row"><label>不透明度</label><input type="range" id="rng-iso-op" min="0.1" max="1" step="0.05" value="${s.isoOpacity}"/><span class="val">${s.isoOpacity.toFixed(2)}</span></div>
          <div class="muted" id="iso-status">未启用</div>
        </div>
        <div class="section">
          <h4>层位叠加</h4>
          <div id="horizon-list" class="muted">加载中…</div>
        </div>
        <div class="section">
          <h4>导出</h4>
          <button id="btn-shot" class="primary" style="width:100%">截图(PNG)</button>
        </div>
      </div>
    </div>`;

  const $ = <T extends HTMLElement>(q: string) => root.querySelector(q) as T;
  const canvas = $<HTMLCanvasElement>('#gl-canvas');
  const hud = $('#hud');

  const renderer = new VolumeRenderer(canvas);
  renderer.settings = s;
  renderer.setVolume(session.dims, session.data);

  const applyLut = () => {
    renderer.setLut(buildLut(getColormap(s.colormapId), s.opacity));
  };
  applyLut();

  renderer.onStats = st => {
    hud.textContent =
      `FPS ${st.fps.toFixed(0)}  渲染比例 ${(st.renderScale * 100).toFixed(0)}%\n` +
      `${session.dims.nx}×${session.dims.ny}×${session.dims.nz}  拖动旋转 / 滚轮缩放 / Shift+拖动平移`;
    hud.classList.toggle('hud-err', st.fps < 20);
  };
  renderer.start();

  // ---------- 色标 ----------
  const cmSel = $<HTMLSelectElement>('#sel-colormap');
  const fillColormaps = () => {
    cmSel.innerHTML = '';
    for (const cm of allColormaps()) {
      const opt = document.createElement('option');
      opt.value = cm.id;
      opt.textContent = cm.name + (cm.builtin ? '' : '(自定义)');
      cmSel.appendChild(opt);
    }
    cmSel.value = s.colormapId || getActiveColormapId();
  };
  fillColormaps();
  cmSel.onchange = () => { s.colormapId = cmSel.value; applyLut(); saveSettings(); };

  // ---------- 不透明度曲线编辑器 ----------
  const tfCanvas = $<HTMLCanvasElement>('#tf-canvas');
  const tfCtx = tfCanvas.getContext('2d')!;
  let dragIdx = -1;
  const tfToXY = (t: number, o: number) => ({ x: t * tfCanvas.width, y: (1 - o) * tfCanvas.height });
  const xyToTf = (x: number, y: number) => ({
    t: Math.max(0, Math.min(1, x / tfCanvas.width)),
    o: Math.max(0, Math.min(1, 1 - y / tfCanvas.height)),
  });
  function drawTf() {
    tfCtx.clearRect(0, 0, tfCanvas.width, tfCanvas.height);
    // 背景:色标渐变
    const cm = getColormap(s.colormapId);
    const grad = tfCtx.createLinearGradient(0, 0, tfCanvas.width, 0);
    for (const st of cm.stops) {
      grad.addColorStop(st.t, `rgb(${st.color.map(c => Math.round(c * 255)).join(',')})`);
    }
    tfCtx.globalAlpha = 0.35;
    tfCtx.fillStyle = grad;
    tfCtx.fillRect(0, 0, tfCanvas.width, tfCanvas.height);
    tfCtx.globalAlpha = 1;
    // 曲线
    const pts = [...s.opacity].sort((a, b) => a.t - b.t);
    tfCtx.strokeStyle = '#4da3ff';
    tfCtx.lineWidth = 2;
    tfCtx.beginPath();
    pts.forEach((p, i) => {
      const { x, y } = tfToXY(p.t, p.o);
      i === 0 ? tfCtx.moveTo(x, y) : tfCtx.lineTo(x, y);
    });
    tfCtx.stroke();
    // 节点
    for (const p of pts) {
      const { x, y } = tfToXY(p.t, p.o);
      tfCtx.fillStyle = '#fff';
      tfCtx.beginPath();
      tfCtx.arc(x, y, 5, 0, Math.PI * 2);
      tfCtx.fill();
      tfCtx.strokeStyle = '#4da3ff';
      tfCtx.stroke();
    }
  }
  const tfHit = (x: number, y: number) => {
    const pts = [...s.opacity].sort((a, b) => a.t - b.t);
    for (let i = 0; i < pts.length; i++) {
      const p = tfToXY(pts[i].t, pts[i].o);
      if (Math.hypot(p.x - x, p.y - y) < 9) return { pt: pts[i], idx: i };
    }
    return null;
  };
  const tfPos = (e: PointerEvent | MouseEvent) => {
    const r = tfCanvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (tfCanvas.width / r.width), y: (e.clientY - r.top) * (tfCanvas.height / r.height) };
  };
  tfCanvas.addEventListener('pointerdown', e => {
    const { x, y } = tfPos(e);
    const hit = tfHit(x, y);
    if (hit) { dragIdx = s.opacity.indexOf(hit.pt); tfCanvas.setPointerCapture(e.pointerId); }
  });
  tfCanvas.addEventListener('pointermove', e => {
    if (dragIdx < 0) return;
    const { x, y } = tfPos(e);
    const { t, o } = xyToTf(x, y);
    s.opacity[dragIdx] = { t, o };
    drawTf(); applyLut();
  });
  tfCanvas.addEventListener('pointerup', () => { if (dragIdx >= 0) { dragIdx = -1; saveSettings(); } });
  tfCanvas.addEventListener('dblclick', e => {
    const { x, y } = tfPos(e);
    if (tfHit(x, y)) return;
    const { t, o } = xyToTf(x, y);
    s.opacity.push({ t, o });
    drawTf(); applyLut(); saveSettings();
  });
  tfCanvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const { x, y } = tfPos(e);
    const hit = tfHit(x, y);
    if (hit && s.opacity.length > 2) {
      s.opacity.splice(s.opacity.indexOf(hit.pt), 1);
      drawTf(); applyLut(); saveSettings();
    }
  });
  drawTf();

  // ---------- 渲染选项 ----------
  $<HTMLInputElement>('#chk-light').onchange = e => { s.lighting = (e.target as HTMLInputElement).checked; saveSettings(); };
  $<HTMLInputElement>('#rng-steps').oninput = e => {
    s.steps = Number((e.target as HTMLInputElement).value);
    $('#val-steps').textContent = String(s.steps);
    saveSettings();
  };

  // ---------- 正交剖面 ----------
  for (const ax of ['X', 'Y', 'Z'] as const) {
    const rng = $<HTMLInputElement>(`#rng-s${ax}`);
    const val = $(`#val-s${ax}`);
    const dimKey = ax === 'X' ? 'nx' : ax === 'Y' ? 'ny' : 'nz';
    const upd = () => {
      const idx = Math.round((s[`slice${ax}`] as number) * (session.dims[dimKey] - 1));
      val.textContent = String(idx);
    };
    $(`#chk-s${ax}`).addEventListener('change', e => {
      (s as any)[`slice${ax}On`] = (e.target as HTMLInputElement).checked;
      saveSettings();
    });
    rng.addEventListener('input', () => {
      (s as any)[`slice${ax}`] = Number(rng.value);
      upd(); saveSettings();
    });
    upd();
  }

  // ---------- 任意切片(倾角/方位 → 法线) ----------
  const updArb = () => {
    const dip = Number($<HTMLInputElement>('#rng-arb-dip').value) * Math.PI / 180;
    const az = Number($<HTMLInputElement>('#rng-arb-az').value) * Math.PI / 180;
    // 法线:水平分量沿方位角,垂向分量随倾角减小
    s.arbNormal = [
      Math.sin(dip) * Math.cos(az),
      Math.cos(dip),
      Math.sin(dip) * Math.sin(az),
    ];
    s.arbOffset = Number($<HTMLInputElement>('#rng-arb-off').value);
    $('#val-arb-dip').textContent = `${$<HTMLInputElement>('#rng-arb-dip').value}°`;
    $('#val-arb-az').textContent = `${$<HTMLInputElement>('#rng-arb-az').value}°`;
    $('#val-arb-off').textContent = s.arbOffset.toFixed(2);
    saveSettings();
  };
  // 从当前法线反推初始 UI 值
  {
    const n = s.arbNormal;
    const dip = Math.round(Math.acos(Math.max(-1, Math.min(1, n[1]))) * 180 / Math.PI);
    const az = Math.round((Math.atan2(n[2], n[0]) * 180 / Math.PI + 360) % 360);
    $<HTMLInputElement>('#rng-arb-dip').value = String(dip);
    $<HTMLInputElement>('#rng-arb-az').value = String(az);
  }
  $('#chk-arb').addEventListener('change', e => { s.arbOn = (e.target as HTMLInputElement).checked; saveSettings(); });
  $('#rng-arb-dip').addEventListener('input', updArb);
  $('#rng-arb-az').addEventListener('input', updArb);
  $('#rng-arb-off').addEventListener('input', updArb);
  updArb();

  // ---------- 等值面 Worker ----------
  const worker = new McWorker();
  let workerReady = false;
  let isoReqId = 0;
  let isoTimer = 0;
  const isoStatus = $('#iso-status');

  worker.onmessage = (ev: MessageEvent) => {
    const msg = ev.data;
    if (msg.type === 'ready') {
      workerReady = true;
      if (s.isoEnabled) requestIso();
    } else if (msg.type === 'mesh') {
      if (msg.id !== isoReqId) return; // 过期结果丢弃
      const gridPos = new Float32Array(msg.positions);
      const gridNrm = new Float32Array(msg.normals);
      // 归一化网格坐标 → 世界坐标(world.x=inline, world.y=深度浅在上, world.z=crossline)
      const { nx, ny, nz } = session.dims;
      const positions = new Float32Array(gridPos.length);
      const normals = new Float32Array(gridNrm.length);
      for (let i = 0; i < gridPos.length; i += 3) {
        const w = renderer.gridToWorld(
          gridPos[i] * (nx - 1), gridPos[i + 1] * (ny - 1), gridPos[i + 2] * (nz - 1));
        positions[i] = w[0]; positions[i + 1] = w[1]; positions[i + 2] = w[2];
        normals[i] = gridNrm[i]; normals[i + 1] = gridNrm[i + 2]; normals[i + 2] = gridNrm[i + 1];
      }
      renderer.setIsoMesh(positions, normals, '#e0b34d', s.isoOpacity);
      isoStatus.textContent = `阈值 ${s.isoValue.toFixed(2)}:${(msg.count / 3).toLocaleString()} 个三角形`;
    }
  };
  worker.onerror = e => { isoStatus.textContent = `Worker 错误:${e.message}`; };

  // 数据体只传一次(复制一份,原数据继续使用)
  {
    const copy = session.data.slice();
    worker.postMessage({
      type: 'init',
      nx: session.dims.nx, ny: session.dims.ny, nz: session.dims.nz,
      buffer: copy.buffer,
    }, [copy.buffer]);
  }

  function requestIso() {
    if (!workerReady || !s.isoEnabled) return;
    isoReqId++;
    isoStatus.textContent = `阈值 ${s.isoValue.toFixed(2)}:计算中…`;
    worker.postMessage({ type: 'iso', id: isoReqId, value: s.isoValue });
  }
  function requestIsoDebounced() {
    clearTimeout(isoTimer);
    isoTimer = window.setTimeout(requestIso, 150);
  }

  $('#chk-iso').addEventListener('change', e => {
    s.isoEnabled = (e.target as HTMLInputElement).checked;
    if (!s.isoEnabled) { renderer.setIsoMesh(null, null); isoStatus.textContent = '未启用'; }
    else requestIso();
    saveSettings();
  });
  $('#rng-iso').addEventListener('input', e => {
    s.isoValue = Number((e.target as HTMLInputElement).value);
    $('#val-iso').textContent = s.isoValue.toFixed(2);
    requestIsoDebounced();   // 增量更新:只发新阈值
    saveSettings();
  });
  $('#rng-iso-op').addEventListener('input', e => {
    s.isoOpacity = Number((e.target as HTMLInputElement).value);
    (e.target as HTMLElement).parentElement!.querySelector('.val')!.textContent = s.isoOpacity.toFixed(2);
    // 不透明度变化不需要重算网格,只更新颜色
    renderer.setIsoMeshOpacity(s.isoOpacity);
    saveSettings();
  });

  // ---------- 层位叠加 ----------
  const horizonRows: HorizonRow[] = await listHorizons(session.project.id);
  const hzListEl = $('#horizon-list');
  const visibleHorizons = new Set<string>(horizonRows.map(h => h.id));
  const rebuildHorizonPoints = () => {
    const pos: number[] = [];
    const col: number[] = [];
    for (const h of horizonRows) {
      if (!visibleHorizons.has(h.id)) continue;
      const grid = new Float32Array(h.buffer);
      const c = parseInt(h.color.slice(1), 16);
      const cr = ((c >> 16) & 255) / 255, cg = ((c >> 8) & 255) / 255, cb = (c & 255) / 255;
      for (let y = 0; y < session.dims.ny; y++) {
        for (let x = 0; x < session.dims.nx; x++) {
          const z = grid[x + session.dims.nx * y];
          if (Number.isNaN(z)) continue;
          const w = renderer.gridToWorld(x, y, z);
          pos.push(w[0], w[1], w[2]);
          col.push(cr, cg, cb);
        }
      }
    }
    renderer.setHorizonPoints(
      pos.length ? new Float32Array(pos) : null,
      col.length ? new Float32Array(col) : null,
    );
  };
  if (horizonRows.length === 0) {
    hzListEl.textContent = '该工区还没有层位,去「层位解释」页创建';
  } else {
    hzListEl.innerHTML = '';
    for (const h of horizonRows) {
      const row = document.createElement('div');
      row.className = 'row';
      row.innerHTML = `<input type="checkbox" checked/><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${h.color}"></span><span style="font-size:13px">${h.name}</span>`;
      row.querySelector('input')!.onchange = e => {
        const on = (e.target as HTMLInputElement).checked;
        on ? visibleHorizons.add(h.id) : visibleHorizons.delete(h.id);
        rebuildHorizonPoints();
      };
      hzListEl.appendChild(row);
    }
    rebuildHorizonPoints();
  }

  // ---------- 截图 ----------
  $('#btn-shot').onclick = async () => {
    const blob = await renderer.screenshot();
    if (blob) {
      downloadBlob(blob, `${session.project.name}_screenshot.png`);
      toast('截图已导出');
    }
  };

  return () => {
    worker.terminate();
    renderer.destroy();
  };
}
