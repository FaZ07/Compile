"use client";

// THE ENGINE — a 3D reasoning constellation.
// Raw Three.js + EffectComposer/UnrealBloomPass (both ship inside `three`).
// FogExp2 abyss · emissive nodes that bloom · LERP inertial camera ·
// node states driven live by SSE. Full geometry/material/composer disposal.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { NODE_ORDER, SOURCES, type NodeId } from "@/lib/types";

export type NodeState = "idle" | "running" | "done" | "error";
export type NodeStateMap = { [id: string]: NodeState };

export interface Props {
  nodes: NodeId[];
  states: NodeStateMap;
  phase: "idle" | "compiling" | "complete";
}

const CYAN  = new THREE.Color("#00ffff");
const GOLD  = new THREE.Color("#ffd66b");   // bright gold for bloom flash
const IDLE  = new THREE.Color("#1c5c66");   // dim cyan
const EMBER = new THREE.Color("#ff5a47");
const BASE  = new THREE.Color("#0c0c12");

function targetColor(s: NodeState): THREE.Color {
  if (s === "running") return CYAN;
  if (s === "done")    return GOLD;
  if (s === "error")   return EMBER;
  return IDLE;
}

interface Node {
  id: NodeId;
  group: THREE.Group;
  mesh: THREE.Mesh;
  ring: THREE.Mesh;
  line: THREE.Line;
  particles: THREE.Points;
  angle: number;
  state: NodeState;
  flash: number; // 0-1 decaying flash on resolve
}

function haloTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.4)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function RealityGraph({ nodes, states, phase }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef(nodes);
  const statesRef = useRef(states);
  const phaseRef = useRef(phase);
  nodesRef.current = nodes;
  statesRef.current = states;
  phaseRef.current = phase;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.085);  // the abyss

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    camera.position.set(0, 1.6, 9);
    const lookTarget = new THREE.Vector3(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.2));
    const keyLight = new THREE.PointLight(0x00ffff, 1.1, 22, 1.6);
    scene.add(keyLight);
    const rim = new THREE.DirectionalLight(0xffd66b, 0.3);
    rim.position.set(3, 4, -2);
    scene.add(rim);

    // ── starfield ────────────────────────────────────────────
    const STARS = 320;
    const sPos = new Float32Array(STARS * 3);
    for (let i = 0; i < STARS; i++) {
      const r = 15 + Math.random() * 20, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      sPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      sPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) - 2;
      sPos[i * 3 + 2] = r * Math.cos(ph);
    }
    const starGeom = new THREE.BufferGeometry();
    starGeom.setAttribute("position", new THREE.BufferAttribute(sPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0x9fb6c0, size: 0.045, transparent: true, opacity: 0.5, depthWrite: false });
    const starfield = new THREE.Points(starGeom, starMat);
    scene.add(starfield);

    const halo = haloTexture();

    // ── intent core ──────────────────────────────────────────
    const core = new THREE.Group();
    scene.add(core);
    const coreMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.6, 1),
      new THREE.MeshStandardMaterial({ color: 0x223a3f, emissive: 0x00ffff, emissiveIntensity: 1.4, metalness: 0.3, roughness: 0.35, flatShading: true }),
    );
    core.add(coreMesh);
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.0, 1),
      new THREE.MeshBasicMaterial({ color: 0x00ffff, wireframe: true, transparent: true, opacity: 0.16 }),
    );
    core.add(shell);
    const coreHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0x00ffff, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
    coreHalo.scale.set(3.4, 3.4, 1);
    core.add(coreHalo);

    // ── source nodes ─────────────────────────────────────────
    const RADIUS = 3.4;
    const ids = nodesRef.current.length ? nodesRef.current : NODE_ORDER;
    const built: Node[] = ids.map((id, i) => {
      const angle = (i / ids.length) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * RADIUS, z = Math.sin(angle) * RADIUS;
      const accentGold = SOURCES[id]?.accent === "gold";

      const group = new THREE.Group();
      group.position.set(x, 0, z);
      scene.add(group);

      const mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.26, 0),
        new THREE.MeshStandardMaterial({ color: 0x12121a, emissive: IDLE.clone(), emissiveIntensity: 0.6, metalness: 0.5, roughness: 0.4, flatShading: true }),
      );
      group.add(mesh);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.012, 8, 48),
        new THREE.MeshBasicMaterial({ color: accentGold ? 0xd4af37 : 0x00ffff, transparent: true, opacity: 0.35 }),
      );
      ring.rotation.x = Math.PI / 2;
      group.add(ring);

      const lineGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, 0, z)]);
      const line = new THREE.Line(lineGeom, new THREE.LineBasicMaterial({ color: 0x1c5c66, transparent: true, opacity: 0.4 }));
      scene.add(line);

      const PC = 12;
      const pPos = new Float32Array(PC * 3);
      for (let k = 0; k < PC; k++) { const t = k / PC; pPos[k * 3] = x * t; pPos[k * 3 + 2] = z * t; }
      const pGeom = new THREE.BufferGeometry();
      pGeom.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
      const particles = new THREE.Points(pGeom, new THREE.PointsMaterial({ color: 0x00ffff, size: 0.09, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      scene.add(particles);

      return { id, group, mesh, ring, line, particles, angle, state: "idle", flash: 0 };
    });

    // ── post-processing: bloom ────────────────────────────────
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.6, 0.12);
    composer.addPass(bloom);

    // ── resize ────────────────────────────────────────────────
    function resize() {
      const w = mount!.clientWidth || window.innerWidth;
      const h = mount!.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      bloom.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // ── camera targets per phase ─────────────────────────────
    const camIdle  = new THREE.Vector3(0, 2.0, 10);
    const camWork  = new THREE.Vector3(0, 1.4, 8.2);
    const camDone  = new THREE.Vector3(0, 1.0, 7);

    // ── loop ──────────────────────────────────────────────────
    let raf = 0;
    const clock = new THREE.Clock();
    function tick() {
      const t = clock.getElapsedTime();
      const dt = Math.min(clock.getDelta(), 0.05);
      const ph = phaseRef.current;
      const latest = statesRef.current;

      core.rotation.y += dt * 0.18;
      core.rotation.x = Math.sin(t * 0.3) * 0.07;
      coreMesh.scale.setScalar(1 + Math.sin(t * 1.5) * 0.04);
      coreHalo.scale.setScalar(3.2 + Math.sin(t * 1.6) * 0.3 + (ph === "complete" ? 0.9 : 0));
      (coreMesh.material as THREE.MeshStandardMaterial).emissive.lerp(ph === "complete" ? GOLD : CYAN, 0.04);

      for (const n of built) {
        const want = (latest[n.id] as NodeState | undefined) ?? "idle";
        if (want !== n.state) { if (want === "done") n.flash = 1; n.state = want; }
        n.flash = Math.max(0, n.flash - dt * 1.4);

        const col = targetColor(n.state);
        const mat = n.mesh.material as THREE.MeshStandardMaterial;
        mat.emissive.lerp(col, 0.12);
        const baseI = n.state === "running" ? 1.5 + Math.sin(t * 7) * 0.6 : n.state === "done" ? 1.5 : n.state === "error" ? 1.0 : 0.55;
        mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, baseI + n.flash * 3, 0.2);
        n.mesh.rotation.y += dt * (n.state === "running" ? 1.6 : 0.3);
        n.mesh.scale.setScalar(THREE.MathUtils.lerp(n.mesh.scale.x, 1 + n.flash * 0.5, 0.2));

        const rmat = n.ring.material as THREE.MeshBasicMaterial;
        rmat.color.lerp(col, 0.1);
        rmat.opacity = THREE.MathUtils.lerp(rmat.opacity, n.state === "running" ? 0.9 : n.state === "done" ? 0.6 : 0.3, 0.1);
        n.ring.scale.setScalar(n.state === "running" ? 1 + (Math.sin(t * 6) + 1) * 0.18 : 1 + n.flash * 0.4);

        const lmat = n.line.material as THREE.LineBasicMaterial;
        lmat.color.lerp(col, 0.1);
        lmat.opacity = THREE.MathUtils.lerp(lmat.opacity, n.state === "running" ? 0.95 : n.state === "done" ? 0.55 : 0.28, 0.1);

        const pmat = n.particles.material as THREE.PointsMaterial;
        pmat.color.lerp(col, 0.1);
        pmat.opacity = THREE.MathUtils.lerp(pmat.opacity, n.state === "running" ? 0.95 : n.state === "done" ? 0.4 : 0, 0.08);
        if (n.state === "running" || n.state === "done") {
          const arr = n.particles.geometry.attributes.position as THREE.BufferAttribute;
          for (let k = 0; k < arr.count; k++) {
            let prog = ((t * 0.6) + k / arr.count) % 1;
            if (n.state === "done") prog = 1 - prog; // data returning home
            arr.setXYZ(k, Math.cos(n.angle) * RADIUS * prog, 0, Math.sin(n.angle) * RADIUS * prog);
          }
          arr.needsUpdate = true;
        }
      }

      // LERP inertial camera with gentle orbital drift
      const dest = ph === "complete" ? camDone : ph === "idle" ? camIdle : camWork;
      const swing = ph === "idle" ? 1.5 : 0.5;
      const rate = ph === "idle" ? 0.1 : 0.16;
      camera.position.lerp(new THREE.Vector3(
        dest.x + Math.sin(t * rate) * swing,
        dest.y + (ph === "idle" ? Math.sin(t * 0.07) * 0.3 : 0),
        dest.z + Math.cos(t * rate) * swing,
      ), 0.025);
      camera.lookAt(lookTarget);
      keyLight.position.copy(camera.position);

      starfield.rotation.y += dt * 0.01;
      composer.render();
      raf = requestAnimationFrame(tick);
    }
    tick();

    // ── teardown ──────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      composer.dispose();
      halo.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else if (mat) (mat as THREE.Material).dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" />;
}
