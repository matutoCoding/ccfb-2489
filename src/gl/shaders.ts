/** GLSL 着色器源码 */

// ---------- 体渲染:光线步进(早停 + 切片解析合成) ----------
export const RAYMARCH_VS = `#version 300 es
layout(location=0) in vec2 aPos;
out vec2 vNdc;
void main() { vNdc = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }
`;

export const RAYMARCH_FS = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vNdc;
out vec4 fragColor;

uniform mat4 uInvVP;
uniform vec3 uCamPos;
uniform vec3 uBoxMin;
uniform vec3 uBoxMax;
uniform sampler3D uVol;
uniform sampler2D uLut;
uniform int uSteps;
uniform float uDensity;
uniform bool uLighting;
uniform vec4 uPlanes[4];   // xyz=法线 w=d,体数据归一化坐标
uniform int uNumPlanes;

float sampleVol(vec3 p) { return texture(uVol, p).r; }

void main() {
  vec4 far4 = uInvVP * vec4(vNdc, 1.0, 1.0);
  vec3 ro = uCamPos;
  vec3 rd = normalize(far4.xyz / far4.w - ro);

  vec3 inv = 1.0 / rd;
  vec3 tA = (uBoxMin - ro) * inv;
  vec3 tB = (uBoxMax - ro) * inv;
  vec3 tmn = min(tA, tB), tmx = max(tA, tB);
  float t0 = max(max(tmn.x, tmn.y), tmn.z);
  float t1 = min(min(tmx.x, tmx.y), tmx.z);
  if (t1 <= t0) discard;
  t0 = max(t0, 0.0);

  // 切片平面与射线的交点,插入排序(最多 4 个)
  float tc[4];
  int nc = 0;
  for (int i = 0; i < 4; i++) {
    if (i >= uNumPlanes) break;
    vec3 n = uPlanes[i].xyz;
    float denom = dot(n, rd);
    if (abs(denom) < 1e-7) continue;
    float t = (uPlanes[i].w - dot(n, ro)) / denom;
    if (t > t0 && t < t1) { tc[nc] = t; nc++; }
  }
  for (int i = 1; i < 4; i++) {
    if (i >= nc) break;
    float key = tc[i];
    int j = i - 1;
    while (j >= 0 && tc[j] > key) { tc[j + 1] = tc[j]; j--; }
    tc[j + 1] = key;
  }

  vec3 boxSize = uBoxMax - uBoxMin;
  float stepLen = (t1 - t0) / float(uSteps);
  vec3 texel = 1.0 / vec3(textureSize(uVol, 0));
  vec3 lightDir = normalize(vec3(0.4, 0.7, 0.6));

  vec4 acc = vec4(0.0);
  int ci = 0;
  float t = t0;
  for (int i = 0; i < 2048; i++) {
    if (i >= uSteps || t > t1) break;
    // 切片(不透明)交点:合成后终止
    while (ci < nc && tc[ci] <= t) {
      vec3 p = ro + rd * tc[ci];
      vec3 uvw = (p - uBoxMin) / boxSize;
      float v = sampleVol(uvw);
      vec3 sc = texture(uLut, vec2(v, 0.5)).rgb;
      acc.rgb += (1.0 - acc.a) * sc;
      acc.a = 1.0;
      ci++;
    }
    if (acc.a > 0.98) break;   // 早停

    vec3 p = ro + rd * t;
    vec3 uvw = (p - uBoxMin) / boxSize;
    float v = sampleVol(uvw);
    vec4 c = texture(uLut, vec2(v, 0.5));
    float a = clamp(c.a * uDensity, 0.0, 1.0);
    if (a > 0.004) {
      vec3 col = c.rgb;
      if (uLighting) {
        vec3 g = vec3(
          sampleVol(uvw + vec3(texel.x, 0.0, 0.0)) - sampleVol(uvw - vec3(texel.x, 0.0, 0.0)),
          sampleVol(uvw + vec3(0.0, texel.y, 0.0)) - sampleVol(uvw - vec3(0.0, texel.y, 0.0)),
          sampleVol(uvw + vec3(0.0, 0.0, texel.z)) - sampleVol(uvw - vec3(0.0, 0.0, texel.z)));
        float gl2 = dot(g, g);
        if (gl2 > 1e-8) {
          float diff = abs(dot(normalize(-g), lightDir));
          col *= 0.45 + 0.55 * diff;
        }
      }
      // 步长不透明度修正(参考步长 1/256 包围盒对角)
      float aa = 1.0 - pow(1.0 - a, stepLen * 256.0);
      acc.rgb += (1.0 - acc.a) * col * aa;
      acc.a += (1.0 - acc.a) * aa;
    }
    t += stepLen;
  }

  vec3 bg = vec3(0.045, 0.055, 0.075);
  fragColor = vec4(acc.rgb + (1.0 - acc.a) * bg, 1.0);
}
`;

// ---------- 等值面网格 ----------
export const MESH_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNrm;
uniform mat4 uVP;
out vec3 vNrm;
void main() { vNrm = aNrm; gl_Position = uVP * vec4(aPos, 1.0); }
`;

export const MESH_FS = `#version 300 es
precision highp float;
in vec3 vNrm;
out vec4 fragColor;
uniform vec4 uColor;
void main() {
  vec3 n = normalize(vNrm);
  vec3 l = normalize(vec3(0.4, 0.7, 0.6));
  float diff = abs(dot(n, l));
  vec3 h = normalize(l + vec3(0.0, 0.0, 1.0));
  float spec = pow(abs(dot(n, h)), 32.0) * 0.35;
  vec3 col = uColor.rgb * (0.35 + 0.65 * diff) + spec;
  fragColor = vec4(col, uColor.a);
}
`;

// ---------- 层位拾取点 ----------
export const POINTS_VS = `#version 300 es
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aColor;
uniform mat4 uVP;
uniform float uPointSize;
out vec3 vColor;
void main() {
  vColor = aColor;
  gl_Position = uVP * vec4(aPos, 1.0);
  gl_PointSize = uPointSize;
}
`;

export const POINTS_FS = `#version 300 es
precision highp float;
in vec3 vColor;
out vec4 fragColor;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  if (dot(d, d) > 0.25) discard;
  fragColor = vec4(vColor, 0.95);
}
`;

// ---------- 包围盒线框 ----------
export const BOX_VS = `#version 300 es
layout(location=0) in vec3 aPos;
uniform mat4 uVP;
void main() { gl_Position = uVP * vec4(aPos, 1.0); }
`;

export const BOX_FS = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec4 uColor;
void main() { fragColor = uColor; }
`;
