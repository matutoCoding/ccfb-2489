import {
  allColormaps, colormapCss, getActiveColormapId, setActiveColormapId,
  saveCustomColormap, deleteCustomColormap, getColormap,
} from '../core/colormaps';
import { Colormap, ColormapStop, uid } from '../types';
import { toast } from '../ui';

export async function renderColormapPage(root: HTMLElement): Promise<() => void> {
  root.innerHTML = `
    <div class="page">
      <h2>色标编辑</h2>
      <div class="grid2">
        <div class="card">
          <h3>色标库(点击设为当前)</h3>
          <div id="cm-list"></div>
        </div>
        <div class="card">
          <h3>编辑器</h3>
          <div class="muted">拖动控制点调整位置;双击渐变条添加控制点;右键控制点删除(至少保留 2 个)</div>
          <canvas class="cm-canvas" id="cm-editor" width="520" height="120" style="margin:8px 0"></canvas>
          <div class="row">
            <label>选中点颜色</label>
            <input type="color" id="cm-stop-color" style="width:60px;height:28px;padding:2px"/>
            <span class="muted" id="cm-stop-info"></span>
          </div>
          <div class="row">
            <label>名称</label><input id="cm-name" style="flex:1"/>
          </div>
          <div class="row">
            <button class="primary" id="btn-save-cm">保存为自定义色标并启用</button>
            <button class="danger" id="btn-del-cm">删除当前自定义色标</button>
          </div>
        </div>
      </div>
    </div>`;

  const $ = <T extends HTMLElement>(q: string) => root.querySelector(q) as T;
  const editor = $<HTMLCanvasElement>('#cm-editor');
  const ctx = editor.getContext('2d')!;

  // 工作副本:当前正在编辑的色标
  let working: Colormap = structuredClone(getColormap(getActiveColormapId()));
  let selectedStop: ColormapStop | null = null;
  let dragging = false;

  const PAD = 14; // 编辑区左右留白
  const BAR_H = 56;

  function stopXY(t: number) { return { x: PAD + t * (editor.width - 2 * PAD), y: BAR_H + 30 }; }
  function rgbCss(c: [number, number, number]) { return `rgb(${c.map(v => Math.round(v * 255)).join(',')})`; }

  function drawEditor() {
    ctx.clearRect(0, 0, editor.width, editor.height);
    // 渐变条
    const grad = ctx.createLinearGradient(PAD, 0, editor.width - PAD, 0);
    for (const st of [...working.stops].sort((a, b) => a.t - b.t)) grad.addColorStop(st.t, rgbCss(st.color));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(PAD, 8, editor.width - 2 * PAD, BAR_H - 16, 6);
    ctx.fill();
    ctx.strokeStyle = '#333c49';
    ctx.stroke();
    // 控制点
    for (const st of working.stops) {
      const { x, y } = stopXY(st.t);
      ctx.fillStyle = rgbCss(st.color);
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = st === selectedStop ? '#4da3ff' : '#ffffff';
      ctx.lineWidth = st === selectedStop ? 3 : 1.5;
      ctx.stroke();
      // 连接线
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, BAR_H);
      ctx.lineTo(x, y - 9);
      ctx.stroke();
    }
    $('#cm-stop-info').textContent = selectedStop
      ? `位置 ${(selectedStop.t * 100).toFixed(1)}%` : '未选中控制点';
    $<HTMLInputElement>('#cm-name').value = working.name;
  }

  function hitStop(x: number, y: number): ColormapStop | null {
    for (const st of working.stops) {
      const p = stopXY(st.t);
      if (Math.hypot(p.x - x, p.y - y) < 12) return st;
    }
    return null;
  }
  const evPos = (e: MouseEvent | PointerEvent) => {
    const r = editor.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * (editor.width / r.width),
      y: (e.clientY - r.top) * (editor.height / r.height),
    };
  };

  editor.addEventListener('pointerdown', e => {
    const { x, y } = evPos(e);
    const hit = hitStop(x, y);
    if (hit) {
      selectedStop = hit;
      dragging = true;
      editor.setPointerCapture(e.pointerId);
      $<HTMLInputElement>('#cm-stop-color').value = '#' +
        hit.color.map(c => Math.round(c * 255).toString(16).padStart(2, '0')).join('');
      drawEditor();
    }
  });
  editor.addEventListener('pointermove', e => {
    if (!dragging || !selectedStop) return;
    const { x } = evPos(e);
    selectedStop.t = Math.max(0, Math.min(1, (x - PAD) / (editor.width - 2 * PAD)));
    drawEditor();
  });
  editor.addEventListener('pointerup', () => { dragging = false; });
  editor.addEventListener('dblclick', e => {
    const { x, y } = evPos(e);
    if (y > BAR_H || hitStop(x, y)) return;
    const t = Math.max(0, Math.min(1, (x - PAD) / (editor.width - 2 * PAD)));
    // 插值取当前渐变色作为新点颜色
    const stops = [...working.stops].sort((a, b) => a.t - b.t);
    let c: [number, number, number] = [1, 1, 1];
    for (let i = 0; i < stops.length - 1; i++) {
      if (t >= stops[i].t && t <= stops[i + 1].t) {
        const f = (t - stops[i].t) / Math.max(1e-6, stops[i + 1].t - stops[i].t);
        c = [0, 1, 2].map(k => stops[i].color[k] + f * (stops[i + 1].color[k] - stops[i].color[k])) as [number, number, number];
        break;
      }
    }
    const st: ColormapStop = { t, color: c };
    working.stops.push(st);
    selectedStop = st;
    drawEditor();
  });
  editor.addEventListener('contextmenu', e => {
    e.preventDefault();
    const { x, y } = evPos(e);
    const hit = hitStop(x, y);
    if (hit && working.stops.length > 2) {
      working.stops = working.stops.filter(s2 => s2 !== hit);
      if (selectedStop === hit) selectedStop = null;
      drawEditor();
    }
  });

  $('#cm-stop-color').addEventListener('input', () => {
    if (!selectedStop) return;
    const v = $<HTMLInputElement>('#cm-stop-color').value;
    selectedStop.color = [
      parseInt(v.slice(1, 3), 16) / 255,
      parseInt(v.slice(3, 5), 16) / 255,
      parseInt(v.slice(5, 7), 16) / 255,
    ];
    drawEditor();
  });

  $('#btn-save-cm').onclick = () => {
    const name = $<HTMLInputElement>('#cm-name').value.trim() || '自定义色标';
    const existing = allColormaps().find(c => !c.builtin && c.name === name);
    const cm: Colormap = {
      id: existing?.id ?? uid(),
      name,
      stops: [...working.stops].sort((a, b) => a.t - b.t).map(s2 => ({ ...s2 })),
    };
    saveCustomColormap(cm);
    setActiveColormapId(cm.id);
    working = structuredClone(cm);
    toast(`色标「${name}」已保存并设为当前`);
    refreshList();
    drawEditor();
  };
  $('#btn-del-cm').onclick = () => {
    if (working.builtin || !allColormaps().some(c => c.id === working.id && !c.builtin)) {
      toast('内置色标不能删除'); return;
    }
    deleteCustomColormap(working.id);
    working = structuredClone(allColormaps()[0]);
    setActiveColormapId(working.id);
    toast('已删除');
    refreshList();
    drawEditor();
  };

  function refreshList() {
    const listEl = $('#cm-list');
    listEl.innerHTML = '';
    const activeId = getActiveColormapId();
    for (const cm of allColormaps()) {
      const item = document.createElement('div');
      item.className = 'cm-item' + (cm.id === activeId ? ' active' : '');
      item.innerHTML = `
        <div class="cm-swatch" style="background:${colormapCss(cm)}"></div>
        <span class="cm-name">${cm.name}${cm.builtin ? '' : ' (自定义)'}</span>`;
      item.onclick = () => {
        setActiveColormapId(cm.id);
        working = structuredClone(getColormap(cm.id));
        selectedStop = null;
        refreshList();
        drawEditor();
        toast(`「${cm.name}」已设为当前色标`);
      };
      listEl.appendChild(item);
    }
  }

  refreshList();
  drawEditor();
  return () => {};
}
