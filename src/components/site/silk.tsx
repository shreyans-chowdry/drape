'use client';
import { useEffect, useRef } from 'react';

// A slowly moving sheet of silk behind the hero: a height field of soft folds,
// domain-warped over time and lit like fabric. Raw WebGL, no libraries.
// Colours come from the page's CSS tokens so it follows light/dark mode.

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `
precision mediump float;
uniform vec2 r;      // canvas size in px
uniform float t;     // seconds
uniform vec2 m;      // pointer, 0..1, smoothed
uniform vec3 base;   // page background
uniform vec3 deep;   // shadow in the folds
uniform vec3 tint;   // accent caught in the folds
uniform float k;     // strength: lower on narrow screens where text covers it

float folds(vec2 p) {
  vec2 q = p;
  q += 0.38 * vec2(sin(q.y * 1.25 + t * 0.22), cos(q.x * 1.05 - t * 0.18));
  q += 0.22 * vec2(sin(q.y * 2.30 - t * 0.27 + m.x * 2.2), cos(q.x * 1.90 + t * 0.24 + m.y * 2.2));
  return sin(q.x * 2.1 + q.y * 0.8 + t * 0.12) * 0.55 + sin(q.x * 0.6 - q.y * 1.7 + t * 0.10) * 0.35;
}

void main() {
  vec2 uv = gl_FragCoord.xy / r;
  vec2 p = (gl_FragCoord.xy - 0.5 * r) / r.y * 2.3 + (m - 0.5) * 0.25;
  float e = 0.012;
  float h = folds(p);
  vec3 n = normalize(vec3(folds(p + vec2(e, 0.0)) - h, folds(p + vec2(0.0, e)) - h, e * 2.2));
  vec3 L = normalize(vec3(-0.45, 0.55, 0.75));
  float diff = clamp(dot(n, L), 0.0, 1.0);
  float sheen = pow(clamp(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 16.0);
  vec3 col = mix(deep, base, diff * 0.8 + 0.2);
  col = mix(col, tint, (1.0 - smoothstep(-0.8, 0.6, h)) * 0.38);
  col += sheen * 0.2;
  // Keep the headline side calm and blend the bottom edge into the page.
  float calm = mix(0.3, 1.0, smoothstep(0.1, 0.8, uv.x)) * k;
  col = mix(base, col, calm * smoothstep(0.0, 0.3, uv.y));
  gl_FragColor = vec4(col, 1.0);
}`;

function rgb(value: string): [number, number, number] | null {
  const s = value.trim();
  const hex = /^#([0-9a-f]{6})$/i.exec(s);
  if (hex) { const n = parseInt(hex[1], 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
  return null;
}

export function Silk({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) return; // no WebGL: the plain page background shows instead

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src); gl.compileShader(sh);
      return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const u = (n: string) => gl.getUniformLocation(prog, n);
    const uR = u('r'), uT = u('t'), uM = u('m'), uBase = u('base'), uDeep = u('deep'), uTint = u('tint'), uK = u('k');

    const setColours = () => {
      const css = getComputedStyle(document.documentElement);
      const base = rgb(css.getPropertyValue('--paper')) ?? [0.965, 0.953, 0.933];
      const accent = rgb(css.getPropertyValue('--accent')) ?? [0.706, 0.325, 0.165];
      const dark = base[0] < 0.5;
      const deep = base.map(c => c * (dark ? 0.5 : 0.8)) as [number, number, number];
      gl.uniform3fv(uBase, base); gl.uniform3fv(uDeep, deep); gl.uniform3fv(uTint, accent);
    };
    setColours();
    const scheme = window.matchMedia('(prefers-color-scheme: dark)');
    scheme.addEventListener('change', setColours);

    // Render below native resolution: the folds are soft, so nobody can tell, and it stays cheap.
    const resize = () => {
      const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.6;
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uR, canvas.width, canvas.height);
      gl.uniform1f(uK, canvas.clientWidth < 768 ? 0.55 : 1);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const target = { x: 0.5, y: 0.5 }, pointer = { x: 0.5, y: 0.5 };
    const onMove = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect();
      target.x = (e.clientX - b.left) / b.width;
      target.y = 1 - (e.clientY - b.top) / b.height;
    };
    window.addEventListener('pointermove', onMove, { passive: true });

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let visible = true, raf = 0;
    const start = performance.now();
    const frame = (now: number) => {
      pointer.x += (target.x - pointer.x) * 0.03;
      pointer.y += (target.y - pointer.y) * 0.03;
      gl.uniform1f(uT, still ? 8 : (now - start) / 1000);
      gl.uniform2f(uM, pointer.x, pointer.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!still && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const resume = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); };
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) resume(); });
    io.observe(canvas);
    const onVis = () => { if (!document.hidden) resume(); };
    document.addEventListener('visibilitychange', onVis);
    resume();
    canvas.dataset.ready = 'true';

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
      scheme.removeEventListener('change', setColours);
      // Free our objects but keep the context: a canvas hands back the same one on remount,
      // and a deliberately lost context can't be drawn into again.
      gl.deleteBuffer(buf); gl.deleteProgram(prog); gl.deleteShader(vs); gl.deleteShader(fs);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={className} />;
}
