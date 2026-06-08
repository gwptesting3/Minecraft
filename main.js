import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ============================================================================
// 1. ADVANCED ENGINE CONFIG SYSTEM & GLOBAL STATES
// ============================================================================
export const GLOBAL_CONFIG = {
    WORLD: {
        CHUNK_SIZE: 64,            // Width/Depth of each terrain patch
        CHUNK_SEGMENTS: 40,         // Vertex resolution per chunk
        RENDER_RADIUS: 4,          // How many chunks away load dynamically
        SEA_LEVEL: -8.0,
        BEACH_LEVEL: -5.0,
        MOUNTAIN_THRESHOLD: 18.0,
        DAY_NIGHT_DURATION: 300,   // 5 minutes per full cycle
        WIND_BASE_SPEED: 1.2
    },
    PLAYER: {
        WALK_SPEED: 0.18,
        RUN_MULTIPLIER: 1.75,
        GRAVITY: -0.016,
        JUMP_IMPULSE: 0.35,
        HEIGHT: 1.6,
        RADIUS: 0.5,
        MOUSE_SENSITIVITY: 0.0022
    },
    FOLIAGE: {
        TREES_PER_CHUNK: 8,
        RUINS_CHANCE: 0.15,        // 15% chance a chunk spawns an ancient ruin
        LEAF_PARTICLES: 150
    }
};

// Core Logistics Engine States
export const EngineState = {
    player: {
        position: new THREE.Vector3(0, 30, 0),
        velocity: new THREE.Vector3(0, 0, 0),
        isGrounded: false,
        rotationY: 0,
        tiltX: 0
    },
    input: { w: false, a: false, s: false, d: false, Shift: false, ' ': false },
    activePOV: 0, // 0 = Chase Close, 1 = Chase Far, 2 = First Person
    isPointerLocked: false,
    loadedChunks: new Map(),
    time: 0
};

// ============================================================================
// 2. HIGH-RES PROCEDURAL TEXTURE SYNTHESIZER LABS (ANTI-BLUR GRAIN)
// ============================================================================
const TextureGenerator = {
    createCanvasContext(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return { canvas, ctx: canvas.getContext('2d') };
    },

    generateUltraGrass() {
        const { canvas, ctx } = this.createCanvasContext(1024, 1024);
        // Rich Base Fill
        ctx.fillStyle = '#2e7d32';
        ctx.fillRect(0, 0, 1024, 1024);
        
        // Fine Blade Texturing & Realism Noise
        for (let i = 0; i < 250000; i++) {
            const rand = Math.random();
            ctx.fillStyle = rand > 0.7 ? '#4caf50' : rand > 0.35 ? '#1b5e20' : '#33691e';
            ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, Math.random() * 8 + 2);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    },

    generateGraniteRock() {
        const { canvas, ctx } = this.createCanvasContext(1024, 1024);
        ctx.fillStyle = '#455a64';
        ctx.fillRect(0, 0, 1024, 1024);
        
        // Stratified Cliff Grain Shading
        for (let i = 0; i < 180000; i++) {
            const tone = Math.floor(50 + Math.random() * 50);
            ctx.fillStyle = `rgba(${tone}, ${tone + 4}, ${tone + 8}, 0.25)`;
            ctx.fillRect(Math.random() * 1024, Math.random() * 1024, Math.random() * 20 + 5, 2);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    },

    generateWeatheredBrick() {
        const { canvas, ctx } = this.createCanvasContext(512, 512);
        ctx.fillStyle = '#78909c';
        ctx.fillRect(0, 0, 512, 512);
        
        // Procedural brick joint lines
        ctx.strokeStyle = '#37474f';
        ctx.lineWidth = 3;
        for (let y = 0; y < 512; y += 32) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(512, y);
            ctx.stroke();
            
            const offset = (y / 32) % 2 === 0 ? 0 : 32;
            for (let x = offset; x < 512; x += 64) {
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x, y + 32);
                ctx.stroke();
            }
        }
        
        // Add aging dust and crack layers over bricks
        for (let i = 0; i < 40000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#b0bec5' : '#455a64';
            ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    },

    generateFineSand() {
        const { canvas, ctx } = this.createCanvasContext(512, 512);
        ctx.fillStyle = '#cfb997';
        ctx.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 90000; i++) {
            ctx.fillStyle = Math.random() > 0.6 ? '#dfcbaf' : '#bfa987';
            ctx.fillRect(Math.random() * 512, Math.random() * 512, 1, 1);
        }
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }
};

// Global Material Pipeline Allocation
export const MATERIAL_REGISTRY = {
    TERRAIN_GRASS: TextureGenerator.generateUltraGrass(),
    TERRAIN_ROCK: TextureGenerator.generateGraniteRock(),
    RUIN_BRICK: new THREE.MeshStandardMaterial({ map: TextureGenerator.generateWeatheredBrick(), roughness: 0.8, metalness: 0.1 }),
    SAND: new THREE.MeshStandardMaterial({ map: TextureGenerator.generateFineSand(), roughness: 0.95 }),
    WATER: new THREE.MeshStandardMaterial({ color: 0x00695c, transparent: true, opacity: 0.75, roughness: 0.05, metalness: 0.6 }),
    LEAF: new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.6, side: THREE.DoubleSide }),
    TRUNK: new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9 })
};

// ============================================================================
// 3. GL LOGISTICS & WINDOW POINTER-LOCK INITIALIZATION
// ============================================================================
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
export const cameraOffsetGroup = new THREE.Group();
cameraOffsetGroup.add(camera);

export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3; 
document.body.appendChild(renderer.domElement);

// Setup HUD overlay crosshair element
const crosshair = document.createElement('div');
crosshair.style.position = 'absolute';
crosshair.style.top = '50%';
crosshair.style.left = '50%';
crosshair.style.width = '12px';
crosshair.style.height = '12px';
crosshair.style.border = '2px solid rgba(255, 255, 255, 0.8)';
crosshair.style.borderRadius = '50%';
crosshair.style.transform = 'translate(-50%, -50%)';
crosshair.style.pointerEvents = 'none';
document.body.appendChild(crosshair);

// Bind Pointer Lock Engine Interceptors
renderer.domElement.addEventListener('click', () => {
    if (!EngineState.isPointerLocked) renderer.domElement.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
    EngineState.isPointerLocked = document.pointerLockElement === renderer.domElement;
});

document.addEventListener('mousemove', (e) => {
    if (!EngineState.isPointerLocked) return;
    
    EngineState.player.rotationY -= e.movementX * GLOBAL_CONFIG.PLAYER.MOUSE_SENSITIVITY;
    EngineState.player.tiltX -= e.movementY * GLOBAL_CONFIG.PLAYER.MOUSE_SENSITIVITY;
    
    // Clamp vertical tilt looking angles down/up
    EngineState.player.tiltX = Math.max(-Math.PI / 2.8, Math.min(Math.PI / 2.8, EngineState.player.tiltX));
});

// Bind keyboard tracking state maps
window.addEventListener('keydown', (e) => {
    if (e.key in EngineState.input) EngineState.input[e.key] = true;
    if (e.key === ' ') EngineState.input[' '] = true;
    if (e.key === 'F5') {
        e.preventDefault(); // Fixed page reload freeze glitch!
        EngineState.activePOV = (EngineState.activePOV + 1) % 3;
    }
});

window.addEventListener('keyup', (e) => {
    if (e.key in EngineState.input) EngineState.input[e.key] = false;
    if (e.key === ' ') EngineState.input[' '] = false;
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================================
// 4. FRACTIONAL MULTI-OCTAVE NOISE ENGINE (INFINITE GEOGRAPHY MATH)
// ============================================================================
export const NoiseEngine = {
    hash2D(x, z) {
        let n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453123;
        return n - Math.floor(n);
    },

    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    noise2D(x, z) {
        const ix = Math.floor(x);
        const iz = Math.floor(z);
        const fx = x - ix;
        const fz = z - iz;

        const a = this.hash2D(ix, iz);
        const b = this.hash2D(ix + 1, iz);
        const c = this.hash2D(ix, iz + 1);
        const d = this.hash2D(ix + 1, iz + 1);

        const ux = fx * fx * (3.0 - 2.0 * fx);
        const uz = fz * fz * (3.0 - 2.0 * fz);

        return this.lerp(a, b, ux) + (c - a) * uz * (1.0 - ux) + (d - b) * ux * uz;
    },

    getLayeredHeight(x, z) {
        // High alpine peaks, cliffs, and valley depressions combined
        let height = 0;
        
        // Macro Scale Continent Noise
        height += this.noise2D(x * 0.002, z * 0.002) * 45;
        
        // Medium Scale Ridges & Slopes
        let ridge = this.noise2D(x * 0.012, z * 0.01);
        height += ridge * 15;
        
        // Sheer Escarpment Modification (Creates vertical stone cliffs)
        if (ridge > 0.68) {
            height += (ridge - 0.68) * 35;
        }

        // Micro Ground Bumps
        height += this.noise2D(x * 0.12, z * 0.12) * 0.8;

        // River Basin Carving System
        const riverPathX = Math.sin(z * 0.008) * 50 + Math.cos(z * 0.003) * 20;
        const distToRiver = Math.abs(x - riverPathX);
        if (distToRiver < 35) {
            const dipFactor = (35 - distToRiver) / 35;
            height -= dipFactor * dipFactor * 25; // Carves down deep lake bed trenches
        }

        return height;
    },

    checkCavePocket3D(x, y, z) {
        // Simulates continuous hollow tunnel pathways underground
        const baseSurface = this.getLayeredHeight(x, z);
        if (y > baseSurface - 4.0 || y < baseSurface - 25.0) return false;

        const noiseA = this.noise2D(x * 0.04, y * 0.04);
        const noiseB = this.noise2D(y * 0.04, z * 0.04);
        const density = (noiseA + noiseB) / 2.0;

        return density < 0.32; // True signifies an air pocket cave corridor
    }
};

// ============================================================================
// 5. PROCEDURAL ASSET CONSTRUCTORS (RUINS & TREES DESIGN LABS)
// ============================================================================
export const StructuralAssetFactory = {
    buildTree(chunkGroup, lx, ly, lz) {
        const tree = new THREE.Group();
        tree.position.set(lx, ly, lz);

        // Core Trunk Pillar
        const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, 5, 6);
        const trunk = new THREE.Mesh(trunkGeo, MATERIAL_REGISTRY.TRUNK);
        trunk.position.y = 2.5;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        tree.add(trunk);

        // Volumetric Layered Canopy Leaves
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.85 });
        const canopyGeo = new THREE.SphereGeometry(2.2, 6, 6);
        const canopy = new THREE.Mesh(canopyGeo, leavesMat);
        canopy.position.y = 5.2;
        canopy.scale.set(1, 1.4, 1);
        canopy.castShadow = true;
        tree.add(canopy);

        chunkGroup.add(tree);
    },

    buildAncientRuinTemple(chunkGroup, rx, ry, rz) {
        const ruinContainer = new THREE.Group();
        ruinContainer.position.set(rx, ry, rz);

        const blockGeo = new THREE.BoxGeometry(4, 2.5, 4);
        
        // Construct crumbling segmented masonry walls
        for (let tier = 0; tier < 4; tier++) {
            for (let side = -1; side <= 1; side += 2) {
                if (NoiseEngine.hash2D(rx + tier, rz + side) > 0.45) {
                    const block = new THREE.Mesh(blockGeo, MATERIAL_REGISTRY.RUIN_BRICK);
                    block.position.set(side * 3, tier * 2.5 + 1.25, 0);
                    block.rotation.set(Math.random() * 0.05, Math.random() * 0.1, 0);
                    block.castShadow = true;
                    block.receiveShadow = true;
                    ruinContainer.add(block);
                }
            }
        }

        // Drop physical loose rubble boulders on floor
        const rubbleGeo = new THREE.DodecahedronGeometry(0.7, 0);
        const rubbleMat = new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.9 });
        for (let i = 0; i < 6; i++) {
            const rockNode = new THREE.Mesh(rubbleGeo, rubbleMat);
            rockNode.position.set((Math.random() - 0.5) * 10, 0.3, (Math.random() - 0.5) * 10);
            rockNode.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
            rockNode.castShadow = true;
            ruinContainer.add(rockNode);
        }

        chunkGroup.add(ruinContainer);
    },

    buildCaveEntrancePortals(chunkGroup, cx, cy, cz) {
        // Generates explicit physical cave entry rock arch portals
        const portal = new THREE.Group();
        portal.position.set(cx, cy, cz);

        const archSegment = new THREE.BoxGeometry(5, 5, 5);
        const stoneMat = new THREE.MeshStandardMaterial({ map: MATERIAL_REGISTRY.TERRAIN_ROCK, roughness: 0.85 });

        for (let theta = 0; theta < Math.PI; theta += 0.5) {
            const archStone = new THREE.Mesh(archSegment, stoneMat);
            archStone.position.set(Math.cos(theta) * 10, Math.sin(theta) * 8, 0);
            archStone.castShadow = true;
            archStone.receiveShadow = true;
            portal.add(archStone);
        }

        chunkGroup.add(portal);
    }
};

// ============================================================================
// 6. INFINITE CHUNK LIFECYCLE MANAGEMENT ENGINE
// ============================================================================
export const ChunkManager = {
    createChunkMesh(chunkX, chunkZ) {
        const chunkGroup = new THREE.Group();
        const size = GLOBAL_CONFIG.WORLD.CHUNK_SIZE;
        const segs = GLOBAL_CONFIG.WORLD.CHUNK_SEGMENTS;
        const startX = chunkX * size;
        const startZ = chunkZ * size;

        // Construct customized dynamic terrain geometry mesh
        const chunkGeo = new THREE.PlaneGeometry(size, size, segs, segs);
        chunkGeo.rotateX(-Math.PI / 2);

        const posAttr = chunkGeo.attributes.position;
        const colorArray = [];
        const terrainColors = new THREE.Float32BufferAttribute(colorArray, 3);

        const matSelector = new THREE.MeshStandardMaterial({
            map: MATERIAL_REGISTRY.TERRAIN_GRASS,
            roughness: 0.9,
            metalness: 0.02
        });

        for (let i = 0; i < posAttr.count; i++) {
            const vx = posAttr.getX(i) + startX;
            const vz = posAttr.getZ(i) + startZ;
            const vy = NoiseEngine.getLayeredHeight(vx, vz);
            
            posAttr.setY(i, vy);
        }

        chunkGeo.computeVertexNormals();
        
        const terrainMesh = new THREE.Mesh(chunkGeo, matSelector);
        terrainMesh.position.set(startX + size / 2, 0, startZ + size / 2);
        terrainMesh.receiveShadow = true;
        terrainMesh.castShadow = true;
        chunkGroup.add(terrainMesh);

        // Horizontal Water Surface sheet overlay inside chunk borders
        const waterSheetGeo = new THREE.PlaneGeometry(size, size, 10, 10);
        waterSheetGeo.rotateX(-Math.PI / 2);
        const waterMesh = new THREE.Mesh(waterSheetGeo, MATERIAL_REGISTRY.WATER);
        waterMesh.position.set(startX + size / 2, GLOBAL_CONFIG.WORLD.SEA_LEVEL, startZ + size / 2);
        waterMesh.name = "chunkWater";
        chunkGroup.add(waterMesh);

        // Populate Foliage and architectural structures inside chunk boundaries safely
        const chunkSeed = NoiseEngine.hash2D(chunkX, chunkZ);
        if (chunkSeed > 1.0 - GLOBAL_CONFIG.FOLIAGE.RUINS_CHANCE) {
            const rx = startX + size / 2;
            const rz = startZ + size / 2;
            StructuralAssetFactory.buildAncientRuinTemple(chunkGroup, rx, NoiseEngine.getLayeredHeight(rx, rz), rz);
        } else {
            // Drop routine trees clusters
            for (let t = 0; t < GLOBAL_CONFIG.FOLIAGE.TREES_PER_CHUNK; t++) {
                const lx = startX + 5 + NoiseEngine.hash2D(startX + t, startZ) * (size - 10);
                const lz = startZ + 5 + NoiseEngine.hash2D(startX, startZ + t) * (size - 10);
                const ly = NoiseEngine.getLayeredHeight(lx, lz);

                if (ly > GLOBAL_CONFIG.WORLD.BEACH_LEVEL + 2.0) {
                    StructuralAssetFactory.buildTree(chunkGroup, lx, ly, lz);
                }
            }
        }

        // Add matching structural cave entry nodes if specific topological thresholds are met
        if (chunkSeed < 0.22 && NoiseEngine.getLayeredHeight(startX + 16, startZ + 16) > GLOBAL_CONFIG.WORLD.BEACH_LEVEL + 4.0) {
            StructuralAssetFactory.buildCaveEntrancePortals(chunkGroup, startX + 16, NoiseEngine.getLayeredHeight(startX + 16, startZ + 16), startZ + 16);
        }

        scene.add(chunkGroup);
        return chunkGroup;
    },

    updateInfiniteRadius(playerX, playerZ) {
        const size = GLOBAL_CONFIG.WORLD.CHUNK_SIZE;
        const currentCX = Math.floor(playerX / size);
        const currentCZ = Math.floor(playerZ / size);
        const currentActiveKeys = new Set();

        // Load new chunks inside sliding visibility radius frame
        for (let x = -GLOBAL_CONFIG.WORLD.RENDER_RADIUS; x <= GLOBAL_CONFIG.WORLD.RENDER_RADIUS; x++) {
            for (let z = -GLOBAL_CONFIG.WORLD.RENDER_RADIUS; z <= GLOBAL_CONFIG.WORLD.RENDER_RADIUS; z++) {
                const targetCX = currentCX + x;
                const targetCZ = currentCZ + z;
                const key = `${targetCX},${targetCZ}`;
                currentActiveKeys.add(key);

                if (!EngineState.loadedChunks.has(key)) {
                    const chunkMeshRef = this.createChunkMesh(targetCX, targetCZ);
                    EngineState.loadedChunks.set(key, chunkMeshRef);
                }
            }
        }

        // Memory cleanup: Unload trailing chunks out of player range scope frame
        for (const [key, groupNode] of EngineState.loadedChunks.entries()) {
            if (!currentActiveKeys.has(key)) {
                scene.remove(groupNode);
                groupNode.traverse(assetChild => {
                    if (assetChild.geometry) assetChild.geometry.dispose();
                });
                EngineState.loadedChunks.delete(key);
            }
        }
    }
};

// ============================================================================
// 7. ATMOSPHERIC PARTICLES & LEAF WIND FLUID SYSTEMS
// ============================================================================
export const ParticleSystem = {
    instancedLeafMesh: null,
    particleTrackingData: [],

    init() {
        const leafGeometry = new THREE.BoxGeometry(0.35, 0.04, 0.5);
        this.instancedLeafMesh = new THREE.InstancedMesh(
            leafGeometry, 
            MATERIAL_REGISTRY.LEAF, 
            GLOBAL_CONFIG.FOLIAGE.LEAF_PARTICLES
        );
        this.instancedLeafMesh.castShadow = true;
        scene.add(this.instancedLeafMesh);

        const calculationDummy = new THREE.Object3D();
        for (let i = 0; i < GLOBAL_CONFIG.FOLIAGE.LEAF_PARTICLES; i++) {
            const px = (Math.random() - 0.5) * 150;
            const pz = (Math.random() - 0.5) * 150;
            const py = NoiseEngine.getLayeredHeight(px, pz) + 10 + Math.random() * 25;

            this.particleTrackingData.push({
                position: new THREE.Vector3(px, py, pz),
                velocity: new THREE.Vector3(
                    -0.08 - Math.random() * 0.12, 
                    -0.03 - Math.random() * 0.05, 
                    (Math.random() - 0.5) * 0.06
                ),
                rotation: new THREE.Vector3(Math.random() * Math.PI, Math.random() * Math.PI, 0),
                spinVelocity: 0.015 + Math.random() * 0.035
            });

            calculationDummy.position.copy(this.particleTrackingData[i].position);
            calculationDummy.updateMatrix();
            this.instancedLeafMesh.setMatrixAt(i, calculationDummy.matrix);
        }
    },

    update(playerX, playerZ, timeTicks) {
        // SAFETY GUARD: Do not execute particle tracking calculation if arrays aren't instantiated
        if (!this.instancedLeafMesh) return;

        const calculationDummy = new THREE.Object3D();
        const windWaveForce = Math.sin(timeTicks * GLOBAL_CONFIG.WORLD.WIND_BASE_SPEED) * 0.03;

        for (let i = 0; i < GLOBAL_CONFIG.FOLIAGE.LEAF_PARTICLES; i++) {
            const data = this.particleTrackingData[i];
            
            data.position.x += data.velocity.x;
            data.position.y += data.velocity.y;
            data.position.z += data.velocity.z + windWaveForce;

            data.rotation.x += data.spinVelocity;
            data.rotation.y += data.spinVelocity * 0.4;

            const distanceToCenter = data.position.distanceTo(new THREE.Vector3(playerX, data.position.y, playerZ));
            const groundFloorHeight = NoiseEngine.getLayeredHeight(data.position.x, data.position.z);

            if (data.position.y < groundFloorHeight || distanceToCenter > 85) {
                data.position.set(
                    playerX + (Math.random() - 0.5) * 80 + 35,
                    NoiseEngine.getLayeredHeight(playerX, playerZ) + 15 + Math.random() * 20,
                    playerZ + (Math.random() - 0.5) * 80
                );
            }

            calculationDummy.position.copy(data.position);
            calculationDummy.rotation.set(data.rotation.x, data.rotation.y, data.rotation.z);
            calculationDummy.updateMatrix();
            this.instancedLeafMesh.setMatrixAt(i, calculationDummy.matrix);
        }
        this.instancedLeafMesh.instanceMatrix.needsUpdate = true;
    }
};

// ============================================================================
// 8. CELESTIAL ENVIRONMENT CONTROLLER (DIURNAL DAY-NIGHT MATRIX)
// ============================================================================
export const CelestialSystem = {
    sunLight: new THREE.DirectionalLight(0xfffee0, 1.6),
    moonLight: new THREE.DirectionalLight(0xa9b3e6, 0.45),
    skyDomeMesh: null,

    init() {
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.bias = -0.0003;
        
        const shadowBounds = 160;
        this.sunLight.shadow.camera.left = -shadowBounds;
        this.sunLight.shadow.camera.right = shadowBounds;
        this.sunLight.shadow.camera.top = shadowBounds;
        this.sunLight.shadow.camera.bottom = -shadowBounds;
        scene.add(this.sunLight);

        this.moonLight.castShadow = true;
        this.moonLight.shadow.mapSize.width = 1024;
        this.moonLight.shadow.mapSize.height = 1024;
        this.moonLight.shadow.camera.left = -shadowBounds;
        this.moonLight.shadow.camera.right = shadowBounds;
        this.moonLight.shadow.camera.top = shadowBounds;
        this.moonLight.shadow.camera.bottom = -shadowBounds;
        scene.add(this.moonLight);

        const skyGeometry = new THREE.SphereGeometry(850, 24, 12);
        const skyMaterial = new THREE.MeshBasicMaterial({ color: 0x81d4fa, side: THREE.BackSide });
        this.skyDomeMesh = new THREE.Mesh(skyGeometry, skyMaterial);
        scene.add(this.skyDomeMesh);
    },

    update(currentTimeSeconds, px, pz) {
        // CRUCIAL CRASH FIX: Guard check to ensure coordinates are valid numbers before copying spatial vectors
        if (px === undefined || pz === undefined || null) {
            px = 0;
            pz = 0;
        }

        const cycleProgressAngle = (currentTimeSeconds / GLOBAL_CONFIG.WORLD.DAY_NIGHT_DURATION) * Math.PI * 2;

        const sx = px + Math.sin(cycleProgressAngle) * 350;
        const sy = Math.cos(cycleProgressAngle) * 350;
        const sz = pz + Math.sin(cycleProgressAngle * 0.5) * 80;
        this.sunLight.position.set(sx, sy, sz);

        const mx = px - Math.sin(cycleProgressAngle) * 350;
        const my = -Math.cos(cycleProgressAngle) * 350;
        const mz = pz - Math.sin(cycleProgressAngle * 0.5) * 80;
        this.moonLight.position.set(mx, my, mz);

        const dayWeightFactor = Math.max(0, Math.min(1, sy / 120));
        const deepNightSky = new THREE.Color(0x040814);
        const radiantDaySky = new THREE.Color(0x81d4fa);
        const targetSkyColor = deepNightSky.clone().lerp(radiantDaySky, dayWeightFactor);

        if (this.skyDomeMesh) this.skyDomeMesh.material.color.copy(targetSkyColor);
        scene.background = targetSkyColor;
        scene.fog = new THREE.FogExp2(targetSkyColor.getHex(), 0.008 + (1.0 - dayWeightFactor) * 0.007);

        this.sunLight.intensity = dayWeightFactor * 1.7;
        this.moonLight.intensity = (1.0 - dayWeightFactor) * 0.6;
    }
};

// Initialize dependent environment systems
CelestialSystem.init();
ParticleSystem.init();

// Setup temporary initial camera matrix location so the screen isn't frozen blank on launch
camera.position.set(0, 15, -25);
camera.lookAt(0, 0, 0);

// ============================================================================
// 9. ASYNCHRONOUS GLTF ASSET AND HERO INSTANTIATION PIPELINES
// ============================================================================
let characterGraphicsWrapperGroup = null;

const dracoDecoderNode = new DRACOLoader();
dracoDecoderNode.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const mainAssetLoader = new GLTFLoader();
mainAssetLoader.setDRACOLoader(dracoDecoderNode);

mainAssetLoader.load('dennis.glb', (gltfResource) => {
    const internalDennisMesh = gltfResource.scene;
    
    characterGraphicsWrapperGroup = new THREE.Group();
    characterGraphicsWrapperGroup.name = "playerGroup";
    characterGraphicsWrapperGroup.scale.set(0.65, 0.65, 0.65);
    characterGraphicsWrapperGroup.add(internalDennisMesh);
    
    characterGraphicsWrapperGroup.add(cameraOffsetGroup);
    scene.add(characterGraphicsWrapperGroup);

    internalDennisMesh.traverse(child => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            // Enhanced visual textures fix: Apply repetition tiling parameters onto material textures
            if (child.material.map) {
                child.material.map.wrapS = THREE.RepeatWrapping;
                child.material.map.wrapT = THREE.RepeatWrapping;
                child.material.map.repeat.set(2, 2);
            }
        }
    });

    const initialSurfaceY = NoiseEngine.getLayeredHeight(0, 0);
    EngineState.player.position.set(0, initialSurfaceY + 2.0, 0);
    characterGraphicsWrapperGroup.position.copy(EngineState.player.position);
}, undefined, err => console.error("Critical GLTF Load Fault Stack: ", err));

// ============================================================================
// 10. REALTIME KINEMATIC CORE GAME LOOP RUNTIME
// ============================================================================
function executionEngineFrameStep() {
    requestAnimationFrame(executionEngineFrameStep);
    
    const timeInSeconds = performance.now() / 1000;
    EngineState.time = timeInSeconds;

    // Fluid vertex wave modifier loop
    EngineState.loadedChunks.forEach(chunkGroup => {
        const waterMeshInstance = chunkGroup.getObjectByName("chunkWater");
        if (waterMeshInstance) {
            const wPosAttr = waterMeshInstance.geometry.attributes.position;
            for (let v = 0; v < wPosAttr.count; v++) {
                const globalVertexX = wPosAttr.getX(v) + waterMeshInstance.position.x;
                const globalVertexZ = wPosAttr.getZ(v) + waterMeshInstance.position.z;
                
                const waveCalculationY = Math.sin(globalVertexX * 0.12 + timeInSeconds * 1.6) * 0.22 + 
                                         Math.cos(globalVertexZ * 0.10 + timeInSeconds * 1.3) * 0.18;
                wPosAttr.setY(v, waveCalculationY);
            }
            wPosAttr.needsUpdate = true;
            waterMeshInstance.geometry.computeVertexNormals();
        }
    });

    // CRUCIAL RUNTIME RECONCILIATION FIX: Update environment variables even while model graphics download
    if (!characterGraphicsWrapperGroup) {
        ChunkManager.updateInfiniteRadius(0, 0);
        CelestialSystem.update(timeInSeconds, 0, 0);
        renderer.render(scene, camera);
        return; // Safely bypass player input maps until asset allocation finishes
    }

    // Kinematic Velocity Calculations
    let calculatedMovementVelocity = GLOBAL_CONFIG.PLAYER.WALK_SPEED;
    if (EngineState.input.Shift) {
        calculatedMovementVelocity *= GLOBAL_CONFIG.PLAYER.RUN_MULTIPLIER;
    }

    const forwardInputUnit = (EngineState.input.w ? 1 : 0) - (EngineState.input.s ? 1 : 0);
    const sideInputUnit = (EngineState.input.d ? 1 : 0) - (EngineState.input.a ? 1 : 0);

    characterGraphicsWrapperGroup.rotation.y = EngineState.player.rotationY;
    cameraOffsetGroup.rotation.x = EngineState.player.tiltX;

    const directionalVector = new THREE.Vector3(sideInputUnit, 0, forwardInputUnit).normalize();
    directionalVector.applyQuaternion(characterGraphicsWrapperGroup.quaternion);

    EngineState.player.position.x += directionalVector.x * calculatedMovementVelocity;
    EngineState.player.position.z += directionalVector.z * calculatedMovementVelocity;

    EngineState.player.velocity.y += GLOBAL_CONFIG.PLAYER.GRAVITY;
    EngineState.player.position.y += EngineState.player.velocity.y;

    const terrainSlopeY = NoiseEngine.getLayeredHeight(EngineState.player.position.x, EngineState.player.position.z);
    
    if (EngineState.player.position.y <= terrainSlopeY) {
        EngineState.player.position.y = terrainSlopeY;
        EngineState.player.velocity.y = 0;
        EngineState.player.isGrounded = true;
    } else {
        EngineState.player.isGrounded = false;
    }

    if (EngineState.input[' '] && EngineState.player.isGrounded) {
        EngineState.player.velocity.y = GLOBAL_CONFIG.PLAYER.JUMP_IMPULSE;
        EngineState.player.isGrounded = false;
    }

    characterGraphicsWrapperGroup.position.copy(EngineState.player.position);

    // Update operational engine sub-loops
    ChunkManager.updateInfiniteRadius(EngineState.player.position.x, EngineState.player.position.z);
    CelestialSystem.update(timeInSeconds, EngineState.player.position.x, EngineState.player.position.z);
    ParticleSystem.update(EngineState.player.position.x, EngineState.player.position.z, timeInSeconds);

    const graphicModelRootNode = characterGraphicsWrapperGroup.children[0];
    const identityMovementActive = forwardInputUnit !== 0 || sideInputUnit !== 0;

    if (identityMovementActive && EngineState.player.isGrounded) {
        const movementFrequency = EngineState.input.Shift ? 7.0 : 4.8;
        graphicModelRootNode.position.y = Math.abs(Math.sin(timeInSeconds * movementFrequency)) * 0.38;
        graphicModelRootNode.rotation.x = Math.sin(timeInSeconds * movementFrequency) * 0.14;
    } else if (!EngineState.player.isGrounded) {
        graphicModelRootNode.position.y = 0.22;
        graphicModelRootNode.rotation.x = -0.12;
    } else {
        graphicModelRootNode.position.y = Math.sin(timeInSeconds * 2.2) * 0.03;
        graphicModelRootNode.rotation.x = 0;
    }

    // Dynamic camera calculations based on view selection indices
    if (EngineState.activePOV === 0) {
        camera.position.set(0, 3.2, -7.5);
        camera.lookAt(characterGraphicsWrapperGroup.position.clone().add(new THREE.Vector3(0, 1.3, 0)));
    } else if (EngineState.activePOV === 1) {
        camera.position.set(0, 5.5, -13.0);
        camera.lookAt(characterGraphicsWrapperGroup.position.clone().add(new THREE.Vector3(0, 1.6, 0)));
    } else {
        camera.position.set(0, GLOBAL_CONFIG.PLAYER.HEIGHT, 0.4);
        const lookTargetVector = new THREE.Vector3(0, 0, 5).applyQuaternion(cameraOffsetGroup.quaternion).applyQuaternion(characterGraphicsWrapperGroup.quaternion);
        camera.lookAt(characterGraphicsWrapperGroup.position.clone().add(lookTargetVector));
    }

    renderer.render(scene, camera);
}

executionEngineFrameStep();
