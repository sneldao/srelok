/**
 * Three.js particle field — represents the network of chains.
 *
 * Minimalist: instanced points drifting slowly in 3D space.
 * Each particle cluster represents a chain. Subtle connections
 * (lines) show the cross-chain activity. Ambient breathing animation.
 */
import * as THREE from "three";

const CHAIN_COLORS: Record<string, string> = {
  ethereum: "#627eea",
  base: "#0052ff",
  arbitrum: "#28a0f0",
  optimism: "#ff0420",
  gnosis: "#04795b",
  avalanche: "#e84142",
  polygon: "#8247e5",
  linea: "#61dfff",
  celo: "#fcff52",
  zksync: "#8c8dfc",
  megaeth: "#ff6b35",
  solana: "#9945ff",
};

export function createChainScene(canvas: HTMLCanvasElement) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.z = 30;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // --- Particle system ---
  const chains = Object.entries(CHAIN_COLORS);
  const particlesPerChain = 15;
  const totalParticles = chains.length * particlesPerChain;

  const positions = new Float32Array(totalParticles * 3);
  const colors = new Float32Array(totalParticles * 3);
  const sizes = new Float32Array(totalParticles);
  const velocities = new Float32Array(totalParticles * 3);

  let idx = 0;
  chains.forEach(([_, hex], chainIdx) => {
    const color = new THREE.Color(hex);
    const centerAngle = (chainIdx / chains.length) * Math.PI * 2;
    const radius = 12 + Math.random() * 5;

    for (let i = 0; i < particlesPerChain; i++) {
      const angle = centerAngle + (Math.random() - 0.5) * 0.8;
      const r = radius + (Math.random() - 0.5) * 6;

      positions[idx * 3] = Math.cos(angle) * r;
      positions[idx * 3 + 1] = (Math.random() - 0.5) * 14;
      positions[idx * 3 + 2] = (Math.random() - 0.5) * 10 - 5;

      colors[idx * 3] = color.r;
      colors[idx * 3 + 1] = color.g;
      colors[idx * 3 + 2] = color.b;

      sizes[idx] = 0.08 + Math.random() * 0.12;

      velocities[idx * 3] = (Math.random() - 0.5) * 0.003;
      velocities[idx * 3 + 1] = (Math.random() - 0.5) * 0.002;
      velocities[idx * 3 + 2] = (Math.random() - 0.5) * 0.001;

      idx++;
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  // --- Connection lines (subtle, few) ---
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.04,
  });

  // Connect a few random particles with faint lines
  const lineCount = 20;
  for (let i = 0; i < lineCount; i++) {
    const a = Math.floor(Math.random() * totalParticles);
    const b = Math.floor(Math.random() * totalParticles);

    const lineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(positions[a * 3], positions[a * 3 + 1], positions[a * 3 + 2]),
      new THREE.Vector3(positions[b * 3], positions[b * 3 + 1], positions[b * 3 + 2]),
    ]);
    const line = new THREE.Line(lineGeom, lineMaterial);
    scene.add(line);
  }

  // --- Animation loop ---
  let animationId = 0;
  const clock = new THREE.Clock();

  function animate() {
    animationId = requestAnimationFrame(animate);
    const elapsed = clock.getElapsedTime();

    // Slow drift
    const posAttr = geometry.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < totalParticles; i++) {
      posAttr.array[i * 3] += velocities[i * 3];
      posAttr.array[i * 3 + 1] += velocities[i * 3 + 1] + Math.sin(elapsed * 0.3 + i) * 0.0005;
      posAttr.array[i * 3 + 2] += velocities[i * 3 + 2];
    }
    posAttr.needsUpdate = true;

    // Slow rotation
    points.rotation.y = elapsed * 0.02;
    points.rotation.x = Math.sin(elapsed * 0.1) * 0.05;

    renderer.render(scene, camera);
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    renderer.render(scene, camera);
  } else {
    animate();
  }

  // --- Resize ---
  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener("resize", onResize);

  // --- Cleanup ---
  return {
    destroy() {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}
