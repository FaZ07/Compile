"use client";

// THE DRAFTING TABLE — a physical reconciliation constellation.
// Matte chalk (MeshLambertMaterial) nodes, raw ink lines, real soft shadows
// cast onto a paper ground plane. No bloom — light fades into paper via fog.
// Charcoal = resolved, International Orange = active logic. Full disposal.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { NODE_ORDER, SOURCES, type NodeId } from "@/lib/types";

export type NodeState = "idle" | "running" | "done" | "error";
export type NodeStateMap = { [id: string]: NodeState };
export interface Props { nodes: NodeId[]; states: NodeStateMap; phase: "idle" | "compiling" | "complete" }

const INK    = new THREE.Color("#1a1a1b");
const STAMP  = new THREE.Color("#ff4500");
const FADE   = new THREE.Color("#8a8880");  // idle charcoal-grey chalk

function targetColor(s: NodeState): THREE.Color {
  if (s === "running") return STAMP;
  if (s === "done")    return INK;
  if (s === "error")   return FADE;
  return FADE;
}

interface Node {
  id: NodeId; group: THREE.Group; mesh: THREE.Mesh; line: THREE.Line;
  particles: THREE.Points; angle: number; state: NodeState; flash: number;
}

export default function RealityGraph({ nodes, states, phase }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef(nodes); const statesRef = useRef(states); const phaseRef = useRef(phase);
  nodesRef.current = nodes; statesRef.current = states; phaseRef.current = phase;

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
    scene.fog = new THREE.FogExp2(0xf9f7f2, 0.055); // distant nodes fade into paper

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

    // paper ground plane that only catches shadow
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
    const built: Node[] = ids.map((id, i) => {
      const angle = (i / ids.length) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * RADIUS, z = Math.sin(angle) * RADIUS;
      const accentStamp = SOURCES[id]?.accent === "gold"; // gold→orange accent in this palette

      const group = new THREE.Group(); group.position.set(x, 0, z); scene.add(group);
      const geo = accentStamp ? new THREE.BoxGeometry(0.42, 0.42, 0.42) : new THREE.IcosahedronGeometry(0.3, 0);
      const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: FADE.clone() }));
      mesh.castShadow = true; group.add(mesh);

      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, 0, z)]),
        new THREE.LineBasicMaterial({ color: 0x1a1a1b, transparent: true, opacity: 0.32 }),
      );
      scene.add(line);

      const PC = 10; const pPos = new Float32Array(PC * 3);
      for (let k = 0; k < PC; k++) { const t = k / PC; pPos[k * 3] = x * t; pPos[k * 3 + 2] = z * t; }
      const pGeom = new THREE.BufferGeometry(); pGeom.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
      const particles = new THREE.Points(pGeom, new THREE.PointsMaterial({ color: 0xff4500, size: 0.1, transparent: true, opacity: 0 }));
      scene.add(particles);

      return { id, group, mesh, line, particles, angle, state: "idle", flash: 0 };
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
      const ph = phaseRef.current; const latest = statesRef.current;

      core.rotation.y += dt * 0.16; core.rotation.x = Math.sin(t * 0.3) * 0.06;
      coreMesh.scale.setScalar(1 + Math.sin(t * 1.5) * 0.03);
      (shell.material as THREE.LineBasicMaterial).opacity = 0.6 + Math.sin(t * 2) * 0.25;

      for (const n of built) {
        const want = (latest[n.id] as NodeState | undefined) ?? "idle";
        if (want !== n.state) { if (want === "done" || want === "running") n.flash = 1; n.state = want; }
        n.flash = Math.max(0, n.flash - dt * 1.5);

        const col = targetColor(n.state);
        const mat = n.mesh.material as THREE.MeshLambertMaterial;
        mat.color.lerp(col, 0.12);
        n.mesh.rotation.y += dt * (n.state === "running" ? 1.5 : 0.25);
        const pulse = n.state === "running" ? 1 + Math.sin(t * 7) * 0.12 : 1;
        n.mesh.scale.setScalar(THREE.MathUtils.lerp(n.mesh.scale.x, pulse + n.flash * 0.5, 0.2));

        const lmat = n.line.material as THREE.LineBasicMaterial;
        lmat.color.lerp(n.state === "running" ? STAMP : INK, 0.1);
        lmat.opacity = THREE.MathUtils.lerp(lmat.opacity, n.state === "running" ? 0.9 : n.state === "done" ? 0.45 : 0.28, 0.1);

        const pmat = n.particles.material as THREE.PointsMaterial;
        pmat.opacity = THREE.MathUtils.lerp(pmat.opacity, n.state === "running" ? 0.95 : 0, 0.1);
        if (n.state === "running") {
          const arr = n.particles.geometry.attributes.position as THREE.BufferAttribute;
          for (let k = 0; k < arr.count; k++) {
            const prog = ((t * 0.7) + k / arr.count) % 1;
            arr.setXYZ(k, Math.cos(n.angle) * RADIUS * prog, 0, Math.sin(n.angle) * RADIUS * prog);
          }
          arr.needsUpdate = true;
        }
      }

      const dest = ph === "complete" ? camDone : ph === "idle" ? camIdle : camWork;
      const swing = ph === "idle" ? 1.4 : 0.5, rate = ph === "idle" ? 0.1 : 0.16;
      camera.position.lerp(new THREE.Vector3(
        dest.x + Math.sin(t * rate) * swing, dest.y, dest.z + Math.cos(t * rate) * swing,
      ), 0.025);
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
