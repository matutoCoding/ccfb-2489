# Seismic Studio — 浏览器三维地震数据体浏览与解释工具

TypeScript + WebGL2,零后端,全部数据留在浏览器本地(IndexedDB)。

## 运行

```bash
npm install
npm run dev      # 开发服务器
npm run build    # 类型检查 + 生产构建(dist/)
npm run preview  # 预览构建产物
```

## 页面

| 页面 | 功能 |
|---|---|
| 工区列表 | 生成演示工区(倾斜地层+断层合成数据)、下载测试 SEG-Y、导入本地 SEG-Y、删除工区 |
| 数据体浏览 | 直接体渲染(光线步进+早停)、传递函数曲线编辑、三正交剖面、任意方向切片、等值面、层位点叠加、截图 |
| 层位解释 | Inline/Crossline/时间切片三视图拾取、种子点自动追踪、3D 联动预览、IndexedDB 自动保存 |
| 色标编辑 | 8 套内置地震色标 + 自定义色标(控制点拖动/增删/改色) |
| 导出 | 截图 PNG、层位 CSV(inline, crossline, z, twt_ms, x, y) |

## 关键技术

- **SEG-Y 解析**(`src/core/segy.ts`):`Blob.slice` 分块读取(16 MB/块),两遍扫描(先道头定几何,再读采样),进度回调;支持格式码 1(IBM 浮点)/2/3/5(IEEE)/6/8。
- **体渲染**(`src/gl/`):全屏三角形 + 解析包围盒求交,前向合成,alpha>0.98 早停,梯度光照;切片(正交×3 + 任意平面)在片元着色器内按射线交点排序解析合成,与体渲染严格按深度次序混合。R16F 3D 纹理(失败回退 R8)。
- **帧率保障**:交互时渲染分辨率降至 50% 且步进数减半,空闲恢复;帧率持续偏低时自动再降档。HUD 实时显示 FPS。
- **等值面**(`src/workers/mc.worker.ts`):Worker 内 marching tetrahedra;数据体只传一次(Transferable),改阈值仅发新阈值,过期结果按请求 id 丢弃。
- **层位追踪**(`src/horizon/tracker.ts`):种子点 → 滑动参考道波形相关 + 同极性约束 + 倾角约束逐道追踪,再以已追踪剖面为向导向两侧传播;手动拾取值优先,追踪只填空缺。
- **坐标约定**:数据 `idx = x + nx*(y + ny*z)`(x=inline, y=crossline, z=采样);世界坐标 x=inline、y=深度(浅部朝上)、z=crossline,纹理工上传时做轴重排。

## 测试数据

`src/core/synthetic.ts` 本地生成:6 层倾斜反射界面 + 一条走向断层(断距可调)、Ricker 子波、横向振幅变化、随机噪声。可生成后直接入库,或写成标准 SEG-Y(rev0,格式码 5)下载用于验证导入链路。
