"use client";

// The 3D execution graph. Plain Three.js (no R3F) for max reliability.
// Renders a central INTENT node with N source nodes arranged on a ring.
// State drives node color/intensity + animated particle pulses along the edges.

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { NODE_REGISTRY, type NodeId } from "@/lib/types";

export type NodeState = "idle" | "running" | "done" | "error";
export interface NodeStateMap {
  [id: string]: NodeState;
}

export interface CompileGraphProps {
  nodes: NodeId[];
  states: NodeStateMap;
  /** idle = hero/intro (calm, pulled back); compiling = active; complete = tightened. */
  phase: "idle" | "compiling" | "complete";
}

const SIGNAL = new THREE.Color("#ffb84d");
const PULSE = new THREE.Color("#5dd5e6");
const ASH = new THREE.Color("#3a3a44");
const EMBER = new THREE.Color("#ff5a47");
const PLATINUM = new THREE.Color("#e7e4dc");

interface SourceObj {
  id: NodeId;
  group: THREE.Group;
  core: THREE.Mesh;
  halo: THREE.Sprite;
  ring: THREE.Mesh;
  line: THREE.Line;
  particles: THREE.Points;
  particleVelocity: number;
  angle: number;
  state: NodeState;
}

function makeHaloTexture(): THREE.Texture {
  // Soft radial gradient sprite for glow.
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 4, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.25, "rgba(255,255,255,0.5)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function colorFor(state: NodeState): THREE.Color {
  if (state === "running") return PULSE;
  if (state === "done") return SIGNAL;
  if (state === "error") return EMBER;
  return ASH;
}

export default function CompileGraph({ nodes, states, phase }: CompileGraphProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    sources: SourceObj[];
    intent: THREE.Group;
    intentCore: THREE.Mesh;
    intentHalo: THREE.Sprite;
    starfield: THREE.Points;
    targetCam: THREE.Vector3;
    dispose: () => void;
  } | null>(null);
  const nodesRef = useRef(nodes);
  const statesRef = useRef(states);
  const phaseRef = useRef(phase);

  // Always read latest from refs in the animation loop.
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
    scene.fog = new THREE.FogExp2(0x05050a, 0.08);

    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
    camera.position.set(0, 1.7, 8);
    const targetCam = new THREE.Vector3(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    const pl = new THREE.PointLight(0xffb84d, 1.4, 18, 1.6);
    pl.position.set(0, 0, 0);
    scene.add(pl);
    const rim = new THREE.DirectionalLight(0x5dd5e6, 0.35);
    rim.position.set(2, 4, -3);
    scene.add(rim);

    // ---- starfield ------------------------------------------------------
    const starGeom = new THREE.BufferGeometry();
    const STAR_COUNT = 380;
    const positions = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      const r = 16 + Math.random() * 18;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) - 2;
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    starGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xe7e4dc, size: 0.05, transparent: true, opacity: 0.55, sizeAttenuation: true, depthWrite: false,
    });
    const starfield = new THREE.Points(starGeom, starMat);
    scene.add(starfield);

    const halo = makeHaloTexture();

    // ---- intent (centre) ------------------------------------------------
    const intent = new THREE.Group();
    scene.add(intent);

    const intentCoreGeom = new THREE.IcosahedronGeometry(0.55, 1);
    const intentCoreMat = new THREE.MeshStandardMaterial({
      color: 0xffd58a, emissive: 0xffb84d, emissiveIntensity: 1.6,
      metalness: 0.2, roughness: 0.4, flatShading: true,
    });
    const intentCore = new THREE.Mesh(intentCoreGeom, intentCoreMat);
    intent.add(intentCore);

    const intentHaloMat = new THREE.SpriteMaterial({
      map: halo, color: 0xffb84d, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    const intentHalo = new THREE.Sprite(intentHaloMat);
    intentHalo.scale.set(3.2, 3.2, 1);
    intent.add(intentHalo);

    // Wireframe shell — the "compile boundary"
    const shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.95, 1),
      new THREE.MeshBasicMaterial({ color: 0xffb84d, wireframe: true, transparent: true, opacity: 0.18 }),
    );
    intent.add(shell);

    // ---- build source nodes --------------------------------------------
    const ringRadius = 3.3;
    const sources: SourceObj[] = [];
    const orderedIds = (nodesRef.current.length ? nodesRef.current : (Object.keys(NODE_REGISTRY) as NodeId[]));
    orderedIds.forEach((id, idx) => {
      const meta = NODE_REGISTRY[id];
      const angle = (idx / orderedIds.length) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * ringRadius;
      const z = Math.sin(angle) * ringRadius;

      const group = new THREE.Group();
      group.position.set(x, 0, z);
      scene.add(group);

      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x2a2a36, emissive: 0x222229, emissiveIntensity: 0.4,
        metalness: 0.6, roughness: 0.5,
      });
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), coreMat);
      group.add(core);

      const haloMat = new THREE.SpriteMaterial({
        map: halo, color: ASH, transparent: true, opacity: 0.35,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const hSprite = new THREE.Sprite(haloMat);
      hSprite.scale.set(1.1, 1.1, 1);
      group.add(hSprite);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.35, 0.01, 8, 64),
        new THREE.MeshBasicMaterial({ color: 0x444450, transparent: true, opacity: 0.5 }),
      );
      ring.rotation.x = Math.PI / 2;
      group.add(ring);

      // edge line from center to this node
      const lineGeom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(x, 0, z)]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x33333d, transparent: true, opacity: 0.45 });
      const line = new THREE.Line(lineGeom, lineMat);
      scene.add(line);

      // particles streaming along the line
      const PCOUNT = 14;
      const pGeom = new THREE.BufferGeometry();
      const ppos = new Float32Array(PCOUNT * 3);
      const palpha = new Float32Array(PCOUNT);
      for (let i = 0; i < PCOUNT; i++) {
        const t = i / PCOUNT;
        ppos[i * 3] = x * t;
        ppos[i * 3 + 1] = 0;
        ppos[i * 3 + 2] = z * t;
        palpha[i] = 0;
      }
      pGeom.setAttribute("position", new THREE.BufferAttribute(ppos, 3));
      const pMat = new THREE.PointsMaterial({
        color: 0xffb84d, size: 0.08, transparent: true, opacity: 0.0,
        sizeAttenuation: true, blending: THREE.AdditiveBlending, depthWrite: false,
      });
      const particles = new THREE.Points(pGeom, pMat);
      scene.add(particles);

      sources.push({
        id, group, core, halo: hSprite, ring, line, particles,
        particleVelocity: 0.5, angle, state: "idle",
      });
    });

    // ---- resize handling -----------------------------------------------
    function resize() {
      const w = mount!.clientWidth || window.innerWidth;
      const h = mount!.clientHeight || window.innerHeight;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    // ---- animation loop -------------------------------------------------
    let raf = 0;
    const clock = new THREE.Clock();
    const cameraTarget = new THREE.Vector3(0, 1.7, 8);
    const cameraTargetClose = new THREE.Vector3(0, 1.2, 6.4);
    const cameraTargetIdle = new THREE.Vector3(0, 2.0, 9.5);

    function tick() {
      const t = clock.getElapsedTime();
      const dt = Math.min(clock.getDelta(), 0.05);

      // intent: gentle spin + breathing scale
      intent.rotation.y += dt * 0.15;
      intent.rotation.x = Math.sin(t * 0.3) * 0.08;
      const breath = 1 + Math.sin(t * 1.4) * 0.04;
      intentCore.scale.setScalar(breath);
      const phaseNow = phaseRef.current;
      intentHalo.scale.setScalar(3.0 + Math.sin(t * 1.6) * 0.25 + (phaseNow === "complete" ? 0.8 : 0));

      // for each source: update visuals from state, animate particles
      const latest = statesRef.current;
      for (const s of sources) {
        const desiredState = (latest[s.id] as NodeState | undefined) ?? "idle";
        if (desiredState !== s.state) s.state = desiredState;

        const target = colorFor(s.state);
        const coreMat = s.core.material as THREE.MeshStandardMaterial;
        coreMat.color.lerp(target, 0.12);
        coreMat.emissive.lerp(target, 0.12);
        coreMat.emissiveIntensity = THREE.MathUtils.lerp(
          coreMat.emissiveIntensity,
          s.state === "running" ? 1.4 : s.state === "done" ? 1.1 : s.state === "error" ? 1.2 : 0.4,
          0.12,
        );

        const haloMat = s.halo.material as THREE.SpriteMaterial;
        haloMat.color.lerp(target, 0.12);
        haloMat.opacity = THREE.MathUtils.lerp(
          haloMat.opacity,
          s.state === "running" ? 0.85 : s.state === "done" ? 0.6 : 0.3,
          0.1,
        );

        const ringScale = s.state === "running" ? 1 + (Math.sin(t * 6) + 1) * 0.25 : 1;
        s.ring.scale.setScalar(ringScale);
        const ringMat = s.ring.material as THREE.MeshBasicMaterial;
        ringMat.color.lerp(target, 0.1);
        ringMat.opacity = THREE.MathUtils.lerp(ringMat.opacity, s.state === "running" ? 0.9 : 0.4, 0.1);

        const lineMat = s.line.material as THREE.LineBasicMaterial;
        lineMat.color.lerp(target, 0.1);
        lineMat.opacity = THREE.MathUtils.lerp(
          lineMat.opacity,
          s.state === "running" ? 0.95 : s.state === "done" ? 0.55 : 0.25,
          0.1,
        );

        // particles
        const pMat = s.particles.material as THREE.PointsMaterial;
        pMat.color.lerp(target, 0.1);
        const targetOpacity =
          s.state === "running" ? 0.95 : s.state === "done" ? 0.45 : 0.0;
        pMat.opacity = THREE.MathUtils.lerp(pMat.opacity, targetOpacity, 0.08);

        if (s.state === "running" || s.state === "done") {
          const arr = s.particles.geometry.attributes.position as THREE.BufferAttribute;
          const count = arr.count;
          const dir = s.state === "running" ? 1 : 1; // always flow inward→outward
          for (let i = 0; i < count; i++) {
            // walk along the line from center to source
            let prog = ((t * 0.55 * dir) + i / count) % 1;
            if (s.state === "done") prog = 1 - prog; // reverse on done = "data returning"
            const x = Math.cos(s.angle) * 3.3 * prog;
            const z = Math.sin(s.angle) * 3.3 * prog;
            arr.setXYZ(i, x, 0, z);
          }
          arr.needsUpdate = true;
        }
      }

      // camera drift: more visible orbit when idle (hero shot), tighten on complete
      const dest =
        phaseNow === "complete" ? cameraTargetClose :
        phaseNow === "idle"     ? cameraTargetIdle  :
                                  cameraTarget;
      const swing = phaseNow === "idle" ? 1.4 : 0.4;
      const rate  = phaseNow === "idle" ? 0.12 : 0.18;
      camera.position.lerp(new THREE.Vector3(
        dest.x + Math.sin(t * rate) * swing,
        dest.y + (phaseNow === "idle" ? Math.sin(t * 0.08) * 0.25 : 0),
        dest.z + Math.cos(t * rate) * swing,
      ), 0.02);
      camera.lookAt(targetCam);

      starfield.rotation.y += dt * 0.01;

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    }
    tick();

    sceneRef.current = {
      renderer, scene, camera, sources, intent, intentCore, intentHalo, starfield, targetCam,
      dispose: () => {
        cancelAnimationFrame(raf);
        ro.disconnect();
        renderer.dispose();
        starGeom.dispose();
        starMat.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
        scene.traverse((obj) => {
          if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
          const m = (obj as THREE.Mesh).material;
          if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
          else if (m) m.dispose();
        });
      },
    };

    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" />;
}
