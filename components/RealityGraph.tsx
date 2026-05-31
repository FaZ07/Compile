"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { NODE_ORDER, SOURCES, type NodeId } from "@/lib/types";

export type NodeState = "idle" | "running" | "done" | "error";
export type NodeStateMap = { [id: string]: NodeState };
export interface Props {
  nodes: NodeId[];
  states: NodeStateMap;
  phase: "idle" | "compiling" | "complete";
  offsetX?: number;
  fieldVelocity?: number;
}

const INK   = new THREE.Color("#1a1a1b");
const STAMP = new THREE.Color("#ff4500");
const FADE  = new THREE.Color("#8a8880");
const AMBER = new THREE.Color("#d4af37");
const BLUE  = new THREE.Color("#4488ff");

function heatColor(velocity: number): THREE.Color {
  const v = Math.max(0, Math.min(100, velocity));
  if (v < 50) return new THREE.Color().lerpColors(BLUE, AMBER, v / 50);
  return new THREE.Color().lerpColors(AMBER, STAMP, (v - 50) / 50);
}

function targetColor(s: NodeState, heat: THREE.Color): THREE.Color {
  if (s === "running") return STAMP;
  if (s === "done")    return heat;
  if (s === "error")   return FADE;
  return FADE;
}

interface Node {
  id: NodeId;
  group: THREE.Group;
  mesh: THREE.Mesh;
  halo: THREE.Mesh;
  line: THREE.Line;
  particles: THREE.Points;
  angle: number;
  state: NodeState;
  flash: number;
}

export default function RealityGraph({ nodes, states, phase, offsetX = 0, fieldVelocity = 50 }: Props) {
  const mountRef   = useRef<HTMLDivElement>(null);
  const nodesRef   = useRef(nodes);
  const statesRef  = useRef(states);
  const phaseRef   = useRef(phase);
  const offRef     = useRef(offsetX);
  const velRef     = useRef(fieldVelocity);
  nodesRef.current  = nodes;
  statesRef.current = states;
  phaseRef.current  = phase;
  offRef.current    = offsetX;
  velRef.current    = fieldVelocity;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf9f7f2, 0.052);

    const camera = new THREE.PerspectiveCamera(46, 1, 0.1, 100);
    camera.position.set(0, 4, 11);
    const lookTarget = new THREE.Vector3(0, -0.3, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.72));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(10, 15, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -12; sun.shadow.camera.right = 12;
    sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12;
    sun.shadow.radius = 7; sun.shadow.bias = -0.0004;
    scene.add(sun);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 60),
      new THREE.ShadowMaterial({ opacity: 0.13, color: 0x1a1a1b }),
    );
    ground.rotation.x = -Math.PI / 2; ground.position.y = -1.6; ground.receiveShadow = true;
    scene.add(ground);

    // ── intent core ──────────────────────────────────────────
    const core = new THREE.Group(); scene.add(core);
    const coreMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.62, 0),
      new THREE.MeshLambertMaterial({ color: 0x1a1a1b }),
    );
    coreMesh.castShadow = true; core.add(coreMesh);
    const shell = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.0, 0)),
      new THREE.LineBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0.85 }),
    );
    core.add(shell);

    // ── source nodes ─────────────────────────────────────────
    const RADIUS = 3.5;
    const ids = nodesRef.current.length ? nodesRef.current : NODE_ORDER;

    // ring connections between adjacent nodes (holy-shit visual)
    const ringLines: THREE.Line[] = [];
    ids.forEach((idA, i) => {
      const idB = ids[(i + 1) % ids.length];
      const angleA = (i / ids.length) * Math.PI * 2 - Math.PI / 2;
      const angleB = ((i + 1) / ids.length) * Math.PI * 2 - Math.PI / 2;
      const pts = [
        new THREE.Vector3(Math.cos(angleA) * RADIUS, 0, Math.sin(angleA) * RADIUS),
        new THREE.Vector3(Math.cos(angleB) * RADIUS, 0, Math.sin(angleB) * RADIUS),
      ];
      const rl = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x1a1a1b, transparent: true, opacity: 0.08 }),
      );
      scene.add(rl);
      ringLines.push(rl);
    });

    const built: Node[] = ids.map((id, i) => {
      const angle = (i / ids.length) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * RADIUS, z = Math.sin(angle) * RADIUS;
      const accentStamp = SOURCES[id]?.accent === "gold";

      const group = new THREE.Group(); group.position.set(x, 0, z); scene.add(group);
      const geo = accentStamp ? new THREE.BoxGeometry(0.52, 0.52, 0.52) : new THREE.IcosahedronGeometry(0.42, 0);
      const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: FADE.clone(), emissive: FADE.clone(), emissiveIntensity: 0.15 }));
      mesh.castShadow = true; group.add(mesh);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x1a1a1b, transparent: true, opacity: 0.55 }));
      mesh.add(edge);

      // halo ring — expands when node is active/selected
      const haloGeo = new THREE.RingGeometry(0.65, 0.8, 24);
      const halo = new THREE.Mesh(haloGeo, new THREE.MeshBasicMaterial({ color: 0xff4500, transparent: true, opacity: 0, side: THREE.DoubleSide }));
      halo.rotation.x = -Math.PI / 2;
      group.add(halo);

      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, 0, z)]),
        new THREE.LineBasicMaterial({ color: 0x1a1a1b, transparent: true, opacity: 0.32 }),
      );
      scene.add(line);

      const PC = 14;
      const pPos = new Float32Array(PC * 3);
      for (let k = 0; k < PC; k++) { const t = k / PC; pPos[k * 3] = x * t; pPos[k * 3 + 2] = z * t; }
      const pGeom = new THREE.BufferGeometry(); pGeom.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
      const particles = new THREE.Points(pGeom, new THREE.PointsMaterial({ color: 0xff4500, size: 0.1, transparent: true, opacity: 0 }));
      scene.add(particles);

      return { id, group, mesh, halo, line, particles, angle, state: "idle", flash: 0 };
    });

    function resize() {
      const w = mount!.clientWidth || window.innerWidth, h = mount!.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize); ro.observe(mount);

    const camIdle = new THREE.Vector3(0, 4.2, 11.5);
    const camWork = new THREE.Vector3(0, 3.4, 9.5);
    const camDone = new THREE.Vector3(0, 3.0, 8.5);

    let raf = 0; const clock = new THREE.Clock();
    function tick() {
      const t = clock.getElapsedTime(); const dt = Math.min(clock.getDelta(), 0.05);
      const ph = phaseRef.current; const latest = statesRef.current; const vel = velRef.current;

      const compilingNow = ph === "compiling";
      const completeNow  = ph === "complete";
      const heat = heatColor(vel);

      // core animation — more dramatic rotation during compile
      core.rotation.y += dt * (compilingNow ? 0.62 : completeNow ? 0.22 : 0.16);
      core.rotation.x = Math.sin(t * 0.32) * 0.07;
      coreMesh.scale.setScalar(1 + Math.sin(t * (compilingNow ? 4.5 : completeNow ? 2 : 1.5)) * (compilingNow ? 0.09 : 0.04));
      (shell.material as THREE.LineBasicMaterial).opacity = 0.5 + Math.sin(t * (compilingNow ? 6 : completeNow ? 3.5 : 2)) * 0.35;

      // ring connection lines pulse in complete phase
      ringLines.forEach((rl, i) => {
        const rmat = rl.material as THREE.LineBasicMaterial;
        const target = completeNow ? 0.16 + Math.sin(t * 1.8 + i * 0.9) * 0.10 : 0.06;
        rmat.opacity = THREE.MathUtils.lerp(rmat.opacity, target, 0.08);
        rmat.color.lerp(heat, 0.04);
      });

      for (const n of built) {
        const want = (latest[n.id] as NodeState | undefined) ?? "idle";
        if (want !== n.state) { if (want === "done" || want === "running") n.flash = 1; n.state = want; }
        n.flash = Math.max(0, n.flash - dt * 1.4);

        const col = targetColor(n.state, heat);
        const mat = n.mesh.material as THREE.MeshLambertMaterial;
        mat.color.lerp(col, 0.12);
        mat.emissive.lerp(col, 0.12);
        mat.emissiveIntensity = THREE.MathUtils.lerp(
          mat.emissiveIntensity,
          n.state === "running" ? 0.6 : n.state === "done" ? (0.2 + (vel / 100) * 0.3) : 0.14,
          0.15,
        );
        n.mesh.rotation.y += dt * (n.state === "running" ? 1.8 : 0.28);

        // alive pulsing in complete phase — staggered by angle
        const wave = completeNow ? Math.sin(t * 2.2 + n.angle * 1.5) : 0;
        const pulse =
          n.state === "running" ? 1 + Math.sin(t * 7.5) * 0.14 :
          completeNow           ? 1 + wave * 0.07 + n.flash * 0.4 :
          1 + n.flash * 0.5;
        n.mesh.scale.setScalar(THREE.MathUtils.lerp(n.mesh.scale.x, pulse, 0.22));

        // halo — glow when running, gentle when done in complete phase
        const haloMat = n.halo.material as THREE.MeshBasicMaterial;
        const haloTarget =
          n.state === "running" ? 0.6 + Math.sin(t * 4) * 0.25 :
          completeNow           ? 0.06 + wave * 0.06 : 0;
        haloMat.opacity = THREE.MathUtils.lerp(haloMat.opacity, haloTarget, 0.12);
        const haloScale = n.state === "running"
          ? 1 + ((Math.sin(t * 3 + n.angle) + 1) / 2) * 0.55
          : completeNow ? 1 + wave * 0.12 : 1;
        n.halo.scale.setScalar(THREE.MathUtils.lerp(n.halo.scale.x, haloScale, 0.14));
        haloMat.color.lerp(n.state === "running" ? STAMP : heat, 0.1);

        // spoke line
        const lmat = n.line.material as THREE.LineBasicMaterial;
        lmat.color.lerp(n.state === "running" ? STAMP : n.state === "done" ? heat : INK, 0.1);
        const idlePulse = (compilingNow || completeNow) ? 0.3 + Math.sin(t * 2.6 + n.angle * 2) * 0.2 : 0.28;
        lmat.opacity = THREE.MathUtils.lerp(
          lmat.opacity,
          n.state === "running" ? 0.95 : n.state === "done" ? 0.55 + (vel / 100) * 0.3 : idlePulse,
          0.1,
        );

        // particles
        const flowing = compilingNow || completeNow || n.state === "running";
        const pmat = n.particles.material as THREE.PointsMaterial;
        pmat.opacity = THREE.MathUtils.lerp(
          pmat.opacity,
          n.state === "running" ? 1 : compilingNow ? 0.65 : completeNow ? 0.38 : 0,
          0.12,
        );
        pmat.color.lerp(heat, 0.06);
        if (flowing) {
          const arr = n.particles.geometry.attributes.position as THREE.BufferAttribute;
          const speed = n.state === "running" ? 1.1 : completeNow ? 0.42 : 0.52;
          for (let k = 0; k < arr.count; k++) {
            const prog = 1 - (((t * speed) + k / arr.count) % 1);
            arr.setXYZ(k, Math.cos(n.angle) * RADIUS * prog, 0, Math.sin(n.angle) * RADIUS * prog);
          }
          arr.needsUpdate = true;
        }
      }

      const dest = ph === "complete" ? camDone : ph === "idle" ? camIdle : camWork;
      const ox = offRef.current;
      // On portrait/mobile, pull camera back so nodes don't fill the frame
      const portraitZBoost = camera.aspect < 0.9 ? 4.5 : camera.aspect < 1.2 ? 2.0 : 0;
      const swing = ph === "idle" ? 1.4 : compilingNow ? 1.2 : completeNow ? 0.6 : 0.5;
      const rate  = ph === "idle" ? 0.1 : compilingNow ? 0.26 : 0.18;
      camera.position.lerp(new THREE.Vector3(
        dest.x + ox + Math.sin(t * rate) * swing,
        dest.y + (compilingNow ? Math.sin(t * 0.52) * 0.45 : completeNow ? Math.sin(t * 0.2) * 0.12 : 0),
        dest.z + Math.cos(t * rate) * swing + portraitZBoost,
      ), 0.026);
      lookTarget.x = ox;
      camera.lookAt(lookTarget);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }
    tick();

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else if (mat) (mat as THREE.Material).dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" />;
}
