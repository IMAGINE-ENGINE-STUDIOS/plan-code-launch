

## Integrate 3D/WebGL Libraries for User Projects

### What Changes

Two files need updating so users can build 3D apps and games inside their projects:

### 1. `src/components/SandpackPreview.tsx` — Add 3D dependencies

Add these three libraries to the Sandpack `dependencies` object (after the existing entries, before `extraDependencies`):

```
'three': '^0.170.0',
'@react-three/fiber': '^8.18.0',
'@react-three/drei': '^9.122.0',
```

These run only inside the Sandpack preview sandbox — they are not installed into the host app.

### 2. `supabase/functions/chat/index.ts` — Update AI system prompt

Add a "3D / WebGL" section to the system prompt (after the "Charts" / "Notifications" lines, around line 267) so the AI knows these libraries are available and generates correct code:

```
3D / WebGL (use for any 3D scenes, games, or WebGL features):
  three (Three.js core), @react-three/fiber (React renderer for Three.js — use <Canvas>),
  @react-three/drei (helpers: OrbitControls, Text3D, Environment, useGLTF, Stars, Sky, etc.)

  3D GUIDELINES:
  - Always wrap 3D content in <Canvas> from @react-three/fiber
  - Use drei helpers for common needs: OrbitControls, PerspectiveCamera, Environment
  - For games: use useFrame() for game loops, drei Physics helpers for collisions
  - For lighting: <ambientLight>, <pointLight>, <directionalLight>
  - For models: useGLTF from drei to load .glb/.gltf files
  - Standard meshes: <mesh>, <boxGeometry>, <sphereGeometry>, <planeGeometry>
  - Materials: <meshStandardMaterial>, <meshPhongMaterial>, <meshBasicMaterial>
```

### Version Pinning Rationale

- `@react-three/fiber` v8 is required for React 18 compatibility (v9+ needs React 19)
- `@react-three/drei` v9 matches fiber v8
- `three` v0.170 is current stable

