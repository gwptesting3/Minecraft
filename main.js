import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// 1. Scene & Renderer Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x81d4fa); 
scene.fog = new THREE.FogExp2(0x81d4fa, 0.012); // Fog hides chunk loading at the horizon

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.45); 
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfffde7, 1.4); 
sunLight.position.set(40, 150, 40);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
const d = 80;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
scene.add(sunLight);

// 2. Endless Infinite World Generation Engine
const CHUNK_SIZE = 40;     // Size of each world square
const CHUNK_SEGMENTS = 20; // Mesh detail
const RENDER_DISTANCE = 3; // How many chunks away load in all directions
const loadedChunks = new Map(); // Keeps track of active chunks

// Pseudo-Random Noise generator to create consistent endless geography without external libraries
function noise2D(x, z) {
    let n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453123;
    return n - Math.floor(n);
}

function smoothNoise(x, z) {
    // Large scales for massive mountains & deep valleys
    let mountains = Math.sin(x * 0.005) * Math.cos(z * 0.005) * 25;
    let cliffs = Math.sin(x * 0.02) * Math.sin(z * 0.02) > 0.3 ? 12 : 0; // Sudden cliffs
    
    // Medium scales for rolling valleys and beaches
    let valleys = Math.cos(x * 0.03) * Math.sin(z * 0.03) * 6;
    
    // Winding River Calculation
    let riverGrid = Math.sin(x * 0.01 + z * 0.01) * 30;
    let distanceToRiver = Math.abs(z - riverGrid);
    let riverCarve = 0;
    if (distanceToRiver < 12) {
        riverCarve = (12 - distanceToRiver) * -1.8; // Carves out river basins
    }

    return mountains + cliffs + valleys + riverCarve;
}

// Get height at any absolute x, z coordinate in the endless universe
function getAbsoluteHeight(x, z) {
    let height = smoothNoise(x, z);
    if (height < -5) height = -5; // Floor level for deep water basins/caves entry
    return height;
}

// Procedural Asset Builders (Coded Trees and Temples so we don't need files)
function createTree(x, y, z, chunkGroup) {
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.3, 3, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, y + 1.5, z);
    trunk.castShadow = true;
    
    const leavesGeo = new THREE.ConeGeometry(1.5, 3, 5);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8 });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.set(x, y + 3.5, z);
    leaves.castShadow = true;

    chunkGroup.add(trunk, leaves);
}

function createAncientTemple(x, y, z, chunkGroup) {
    const templeGroup = new THREE.Group();
    templeGroup.position.set(x, y, z);

    const baseGeo = new THREE.BoxGeometry(8, 2, 8);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.9 }); // Ancient stone
    const base = new THREE.Mesh(baseGeo, wallMat);
    base.position.y = 1;
    base.castShadow = true;
    base.receiveShadow = true;
    templeGroup.add(base);

    // Pillars
    const pillarGeo = new THREE.CylinderGeometry(0.3, 0.3, 4, 6);
    for (let px of [-3, 3]) {
        for (let pz of [-3, 3]) {
            const pillar = new THREE.Mesh(pillarGeo, wallMat);
            pillar.position.set(px, 4, pz);
            pillar.castShadow = true;
            templeGroup.add(pillar);
        }
    }

    // Roof
    const roofGeo = new THREE.ConeGeometry(6, 3, 4);
    const roof = new THREE.Mesh(roofGeo, wallMat);
    roof.position.y = 7;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    templeGroup.add(roof);

    chunkGroup.add(templeGroup);
}

// Generates an individual geographic chunk map square
function generateChunk(chunkX, chunkZ) {
    const key = `${chunkX},${chunkZ}`;
    if (loadedChunks.has(key)) return;

    const chunkGroup = new THREE.Group();
    const geo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE, CHUNK_SEGMENTS, CHUNK_SEGMENTS);
    geo.rotateX(-Math.PI / 2);

    const positions = geo.attributes.position;
    const colors = [];

    const startX = chunkX * CHUNK_SIZE;
    const startZ = chunkZ * CHUNK_SIZE;

    // Sculpt the terrain piece coordinates
    for (let i = 0; i < positions.count; i++) {
        const localX = positions.getX(i);
        const localZ = positions.getZ(i);
        const worldX = startX + localX + CHUNK_SIZE / 2;
        const worldZ = startZ + localZ + CHUNK_SIZE / 2;
        
        const y = getAbsoluteHeight(worldX, worldZ);
        positions.setY(i, y);

        // Biome Coloring Logic (Beaches, Rivers, Mountains, Plains)
        const color = new THREE.Color();
        if (y < -3.5) {
            color.setHex(0xc2b280); // Sand beaches & river beds
        } else if (y > 14) {
            color.setHex(0xcfd8dc); // High mountain cliff peaks
        } else if (y > 7 && Math.abs(localX) % 3 < 0.5) {
            color.setHex(0x78909c); // Rocky stone slopes
        } else {
            color.setHex(0x4caf50); // Lush valley plains
        }
        colors.push(color.r, color.g, color.b);

        // Procedural Asset Spawning Loop based on noise checks
        if (i % 23 === 0 && y > -2 && y < 10) {
            const spawnChance = noise2D(worldX, worldZ);
            if (spawnChance > 0.82) {
                createTree(localX, y, localZ, chunkGroup);
            } else if (spawnChance < 0.015 && y > 2) {
                createAncientTemple(localX, y, localZ, chunkGroup);
            }
        }
    }

    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const terrainMesh = new THREE.Mesh(geo, mat);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    chunkGroup.add(terrainMesh);

    // Dynamic water plane inside river basins
    const waterGeo = new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE);
    const waterMat = new THREE.MeshStandardMaterial({ color: 0x00a8cc, transparent: true, opacity: 0.6, roughness: 0.2 });
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.rotateX(-Math.PI / 2);
    waterMesh.position.y = -4.5; 
    chunkGroup.add(waterMesh);

    chunkGroup.position.set(startX, 0, startZ);
    scene.add(chunkGroup);
    loadedChunks.set(key, chunkGroup);
}

// Update what chunks are loaded around Dennis's world position tracker
function updateChunks(playerX, playerZ) {
    const currentChunkX = Math.floor((playerX + CHUNK_SIZE / 2) / CHUNK_SIZE);
    const currentChunkZ = Math.floor((playerZ + CHUNK_SIZE / 2) / CHUNK_SIZE);

    const activeKeys = new Set();

    // Load new chunks in visual radius
    for (let x = -RENDER_DISTANCE; x <= RENDER_DISTANCE; x++) {
        for (let z = -RENDER_DISTANCE; z <= RENDER_DISTANCE; z++) {
            const targetX = currentChunkX + x;
            const targetZ = currentChunkZ + z;
            generateChunk(targetX, targetZ);
            activeKeys.add(`${targetX},${targetZ}`);
        }
    }

    // Garbage collector deletes distant chunks to optimize memory completely
    for (let [key, group] of loadedChunks.entries()) {
        if (!activeKeys.has(key)) {
            scene.remove(group);
            group.traverse(child => { if (child.geometry) child.geometry.dispose(); });
            loadedChunks.delete(key);
        }
    }
}

// 3. Loading Dennis (The Hero Object Wrapper)
let dennis;
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

loader.load('dennis.glb', (gltf) => {
    dennis = gltf.scene;
    const dennisWrapper = new THREE.Group();
    dennisWrapper.position.set(0, 5, 0); 
    dennisWrapper.scale.set(0.7, 0.7, 0.7);
    dennisWrapper.name = "dennisRoot";
    scene.add(dennisWrapper);
    dennisWrapper.add(dennis); 

    dennis.traverse((child) => {
        if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; }
    });
});

// 4. Input & POV System Configuration
const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
const povs = { FIRST_PERSON: 0, THIRD_PERSON_REAR: 1, THIRD_PERSON_FRONT: 2 };
let currentPOV = povs.THIRD_PERSON_REAR; 

window.addEventListener('keydown', (e) => { 
    if (e.key in keys) keys[e.key] = true; 
    if (e.key === 'F5') currentPOV = (currentPOV + 1) % 3;
});
window.addEventListener('keyup', (e) => { if (e.key in keys) keys[e.key] = false; });

// 5. Game Loop Controls
const moveSpeed = 0.22; // Speed bumped up for exploring big endless worlds
const rotationSpeed = 0.045;

function animate() {
    requestAnimationFrame(animate);
    const time = performance.now() * 0.005;
    const dennisRoot = scene.getObjectByName("dennisRoot");

    if (dennisRoot) {
        let isMoving = false;

        if (keys.w || keys.ArrowUp) { dennisRoot.translateZ(moveSpeed); isMoving = true; }
        if (keys.s || keys.ArrowDown) { dennisRoot.translateZ(-moveSpeed); isMoving = true; }
        if (keys.a || keys.ArrowLeft) dennisRoot.rotation.y += rotationSpeed;
        if (keys.d || keys.ArrowRight) dennisRoot.rotation.y -= rotationSpeed;

        // Dynamic Height Snapping to Endless Terrain Data
        const currentGround = getAbsoluteHeight(dennisRoot.position.x, dennisRoot.position.z);
        dennisRoot.position.y = currentGround + 0.35;

        // Trigger Chunk Loading calculations centered on player positions
        updateChunks(dennisRoot.position.x, dennisRoot.position.z);

        // Animate visual bobs
        const dennisMesh = dennisRoot.children[0];
        if (isMoving) {
            const hopHeight = Math.abs(Math.sin(time * 4)) * 0.4;
            dennisMesh.position.y = hopHeight;
            dennisMesh.rotation.x = Math.sin(time * 4) * 0.15;
        } else {
            dennisMesh.position.y = Math.sin(time * 0.6) * 0.03;
            dennisMesh.rotation.x = 0;
        }

        // Sun light keeps traveling above Dennis so shadows never run out
        sunLight.position.set(dennisRoot.position.x + 30, 120, dennisRoot.position.z + 30);
        sunLight.target = dennisRoot;

        // Multi-POV View Setup Tracker
        let relativeCameraOffset;
        let lookAtTarget;

        switch (currentPOV) {
            case povs.FIRST_PERSON:
                relativeCameraOffset = new THREE.Vector3(0, 1.1, 0); 
                camera.position.copy(relativeCameraOffset.applyMatrix4(dennisRoot.matrixWorld));
                lookAtTarget = dennisRoot.localToWorld(new THREE.Vector3(0, 1.1, 1));
                camera.lookAt(lookAtTarget);
                dennisRoot.visible = false;
                break;
            case povs.THIRD_PERSON_REAR:
                relativeCameraOffset = new THREE.Vector3(0, 3.2, -6.5);
                camera.position.copy(relativeCameraOffset.applyMatrix4(dennisRoot.matrixWorld));
                lookAtTarget = dennisRoot.localToWorld(new THREE.Vector3(0, 0.8, 0));
                camera.lookAt(lookAtTarget);
                dennisRoot.visible = true;
                break;
            case povs.THIRD_PERSON_FRONT:
                relativeCameraOffset = new THREE.Vector3(0, 3.2, 8.5);
                camera.position.copy(relativeCameraOffset.applyMatrix4(dennisRoot.matrixWorld));
                lookAtTarget = dennisRoot.localToWorld(new THREE.Vector3(0, 0.8, 0));
                camera.lookAt(lookAtTarget);
                dennisRoot.visible = true;
                break;
        }
    } else {
        // Initial fallback chunk load before Dennis spawns in
        updateChunks(0, 0);
    }

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
