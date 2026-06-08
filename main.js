import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ============================================================================
// 1. ENGINE CONFIGURATION & GLOBAL CONSTANTS
// ============================================================================
const CONFIG = {
    WORLD: {
        CHUNK_SIZE: 32,          // Horizontal width/depth of each chunk
        CHUNK_HEIGHT: 64,        // Vertical block limit
        RENDER_DISTANCE: 2,      // Visual chunk radius around player
        BLOCK_SIZE: 1,           // Scale of a single voxel unit
        WATER_LEVEL: 12,         // Global sea level height
        CAVE_THRESHOLD: 0.42,    // 3D noise density threshold for air pockets
    },
    PLAYER: {
        SPEED: 0.14,
        RUN_MULTIPLIER: 1.6,
        ROTATION_SPEED: 0.045,
        GRAVITY: -0.012,
        JUMP_FORCE: 0.28,
        HEIGHT: 1.6,             // Hitbox height dimension
        RADIUS: 0.4              // Hitbox bounding width
    }
};

// ============================================================================
// 2. SYSTEM INITIALIZATION (SCENE, RENDERER, LOGISTICS)
// ============================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x81d4fa);
scene.fog = new THREE.FogExp2(0x81d4fa, 0.015);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// ============================================================================
// 3. TEXTURE GENERATOR ENGINE (ULTRA-REALISTIC PROCEDURAL PBR)
// ============================================================================
const TextureGenerator = {
    createCanvas(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        return { canvas, ctx: canvas.getContext('2d') };
    },
    
    generateGrass() {
        const { canvas, ctx } = this.createCanvas(512, 512);
        ctx.fillStyle = '#33691e';
        ctx.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 40000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#558b2f' : '#2e7d32';
            ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 6);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    },

    generateRock() {
        const { canvas, ctx } = this.createCanvas(512, 512);
        ctx.fillStyle = '#78909c';
        ctx.fillRect(0, 0, 512, 512);
        for (let i = 0; i < 15000; i++) {
            const grey = Math.floor(90 + Math.random() * 40);
            ctx.fillStyle = `rgb(${grey},${grey},${grey})`;
            ctx.fillRect(Math.random() * 512, Math.random() * 512, Math.random() * 8, Math.random() * 4);
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    },

    generateSand() {
        const { canvas, ctx } = this.createCanvas(256, 256);
        ctx.fillStyle = '#cfb997';
        ctx.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 30000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#dfcbaf' : '#bfa987';
            ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1);
        }
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    }
};

// Material Registry
const MATERIALS = {
    GRASS: new THREE.MeshStandardMaterial({ map: TextureGenerator.generateGrass(), roughness: 0.9, metalness: 0.0 }),
    ROCK: new THREE.MeshStandardMaterial({ map: TextureGenerator.generateRock(), roughness: 0.85, metalness: 0.1 }),
    SAND: new THREE.MeshStandardMaterial({ map: TextureGenerator.generateSand(), roughness: 0.95, metalness: 0.0 }),
    STONE_BRICK: new THREE.MeshStandardMaterial({ color: 0x546e7a, roughness: 0.7, metalness: 0.2 }),
    LEAVES: new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.9 }),
    WOOD: new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9 }),
    WATER: new THREE.MeshStandardMaterial({ color: 0x0077be, transparent: true, opacity: 0.65, roughness: 0.15, metalness: 0.6 })
};

// ============================================================================
// 4. ENVIRONMENT DESIGN (SUN, PLANETS, SKYBOX CLOUDS)
// ============================================================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfffdf0, 1.3);
sunLight.position.set(120, 200, 100);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 500;
const shadowDimension = 100;
sunLight.shadow.camera.left = -shadowDimension;
sunLight.shadow.camera.right = shadowDimension;
sunLight.shadow.camera.top = shadowDimension;
sunLight.shadow.camera.bottom = -shadowDimension;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

// Real-time Visual Sky Box Clouds
const cloudGroup = new THREE.Group();
const cloudGeometry = new THREE.BoxGeometry(12, 3, 16);
const cloudMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });

for (let i = 0; i < 40; i++) {
    const cloud = new THREE.Mesh(cloudGeometry, cloudMaterial);
    cloud.position.set((Math.random() - 0.5) * 400, 50 + Math.random() * 15, (Math.random() - 0.5) * 400);
    cloudGroup.add(cloud);
}
scene.add(cloudGroup);

// ============================================================================
// 5. MATH ENGINES (PROCEDURAL NOISE & ADVANCED WORLD SCULPTING)
// ============================================================================
const NoiseEngine = {
    // Math Simulates multi-octave 2D and 3D terrain density noises
    seed: 4239.123,
    
    hash2D(x, z) {
        let n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453123;
        return n - Math.floor(n);
    },

    noise2D(x, z) {
        const ix = Math.floor(x);
        const iz = Math.floor(z);
        const fx = x - ix;
        const fz = z - iz;

        // Bilinear interpolation smoothing
        const a = this.hash2D(ix, iz);
        const b = this.hash2D(ix + 1, iz);
        const c = this.hash2D(ix, iz + 1);
        const d = this.hash2D(ix + 1, iz + 1);

        const ux = fx * fx * (3.0 - 2.0 * fx);
        const uz = fz * fz * (3.0 - 2.0 * fz);

        return THREE.MathUtils.lerp(a, b, ux) + (c - a) * uz * (1.0 - ux) + (d - b) * ux * uz;
    },

    getLayeredNoise(x, z) {
        let v = 0;
        v += this.noise2D(x * 0.004, z * 0.004) * 35; // Mountains scale
        v += this.noise2D(x * 0.02, z * 0.02) * 10;   // Hills scale
        v += this.noise2D(x * 0.1, z * 0.1) * 2;       // Fine details
        return v;
    },

    get3DNoiseDensity(x, y, z) {
        // Generates structural values for underground 3D caves networks
        const baseNoise = this.noise2D(x * 0.05, z * 0.05);
        const vertNoise = Math.sin(y * 0.15) * 0.5 + 0.5;
        return (baseNoise + vertNoise) / 2;
    }
};

// ============================================================================
// 6. VOXEL WORLD MANAGER & STRUCTURE BUILDERS
// ============================================================================
const WorldManager = {
    chunks: new Map(),
    blockGeometry: new THREE.BoxGeometry(CONFIG.WORLD.BLOCK_SIZE, CONFIG.WORLD.BLOCK_SIZE, CONFIG.WORLD.BLOCK_SIZE),

    getBlockGlobal(x, y, yFloor, z) {
        // Core structural analyzer for calculating solid voxel space configurations
        if (y < 0 || y >= CONFIG.WORLD.CHUNK_HEIGHT) return null;
        
        // Structure: Overhanging Cliffs versus deep hollowed tunnels
        const surfaceY = Math.floor(CONFIG.WORLD.CHUNK_HEIGHT * 0.3 + NoiseEngine.getLayeredNoise(x, z));
        
        // Cave systems slicing logic
        if (y < surfaceY - 4) {
            const caveDensity = NoiseEngine.get3DNoiseDensity(x, y, z);
            if (caveDensity < CONFIG.WORLD.CAVE_THRESHOLD) {
                return null; // Empty space cave interior pocket
            }
        }

        if (y <= surfaceY) {
            if (y === surfaceY && y > CONFIG.WORLD.WATER_LEVEL + 2) return 'GRASS';
            if (y < CONFIG.WORLD.WATER_LEVEL + 3 && y >= surfaceY - 2) return 'SAND';
            return 'ROCK';
        }
        
        return null;
    },

    spawnAncientStructure(cx, cy, cz, chunkGroup) {
        // Coded multi-tier temples with accurate physical block arrays
        for (let h = 0; h < 5; h++) {
            const size = 6 - h;
            for (let x = -size; x <= size; x++) {
                for (let z = -size; z <= size; z++) {
                    const block = new THREE.Mesh(this.blockGeometry, MATERIALS.STONE_BRICK);
                    block.position.set(cx + x, cy + h, cz + z);
                    block.castShadow = true;
                    block.receiveShadow = true;
                    chunkGroup.add(block);
                }
            }
        }
    },

    generateChunk(cx, cz) {
        const key = `${cx},${cz}`;
        if (this.chunks.has(key)) return;

        const chunkGroup = new THREE.Group();
        const startX = cx * CONFIG.WORLD.CHUNK_SIZE;
        const startZ = cz * CONFIG.WORLD.CHUNK_SIZE;

        // Group optimization mappings
        const instancedData = { GRASS: [], ROCK: [], SAND: [] };

        for (let x = 0; x < CONFIG.WORLD.CHUNK_SIZE; x++) {
            for (let z = 0; z < CONFIG.WORLD.CHUNK_SIZE; z++) {
                const worldX = startX + x;
                const worldZ = startZ + z;

                for (let y = 0; y < CONFIG.WORLD.CHUNK_HEIGHT; y++) {
                    const blockType = this.getBlockGlobal(worldX, y, null, worldZ);
                    if (blockType && instancedData[blockType]) {
                        instancedData[blockType].push(new THREE.Vector3(worldX, y, worldZ));
                    }
                }
            }
        }

        // Render solid geometry buffers
        for (const [type, blockPositions] of Object.entries(instancedData)) {
            if (blockPositions.length === 0) continue;
            const meshInst = new THREE.InstancedMesh(this.blockGeometry, MATERIALS[type], blockPositions.length);
            meshInst.castShadow = true;
            meshInst.receiveShadow = true;

            const dummy = new THREE.Object3D();
            for (let i = 0; i < blockPositions.length; i++) {
                dummy.position.copy(blockPositions[i]);
                dummy.updateMatrix();
                meshInst.setMatrixAt(i, dummy.matrix);
            }
            chunkGroup.add(meshInst);
        }

        // Ocean plane layer inside chunk boundaries
        const waterGeo = new THREE.PlaneGeometry(CONFIG.WORLD.CHUNK_SIZE, CONFIG.WORLD.CHUNK_SIZE);
        const water = new THREE.Mesh(waterGeo, MATERIALS.WATER);
        water.rotateX(-Math.PI / 2);
        water.position.set(startX + CONFIG.WORLD.CHUNK_SIZE / 2, CONFIG.WORLD.WATER_LEVEL + 0.5, startZ + CONFIG.WORLD.CHUNK_SIZE / 2);
        chunkGroup.add(water);

        // Rare random structure/temple placement
        if (NoiseEngine.hash2D(startX, startZ) > 0.94) {
            const surfaceSample = Math.floor(CONFIG.WORLD.CHUNK_HEIGHT * 0.3 + NoiseEngine.getLayeredNoise(startX, startZ));
            if (surfaceSample > CONFIG.WORLD.WATER_LEVEL + 4) {
                this.spawnAncientStructure(startX + 16, surfaceSample + 1, startZ + 16, chunkGroup);
            }
        }

        scene.add(chunkGroup);
        this.chunks.set(key, chunkGroup);
    },

    update(px, pz) {
        const currentCX = Math.floor(px / CONFIG.WORLD.CHUNK_SIZE);
        const currentCZ = Math.floor(pz / CONFIG.WORLD.CHUNK_SIZE);
        const activeKeys = new Set();

        for (let x = -CONFIG.WORLD.RENDER_DISTANCE; x <= CONFIG.WORLD.RENDER_DISTANCE; x++) {
            for (let z = -CONFIG.WORLD.RENDER_DISTANCE; z <= CONFIG.WORLD.RENDER_DISTANCE; z++) {
                const targetCX = currentCX + x;
                const targetCZ = currentCZ + z;
                this.generateChunk(targetCX, targetCZ);
                activeKeys.add(`${targetCX},${targetCZ}`);
            }
        }

        // Clean out memory frames
        for (const [key, group] of this.chunks.entries()) {
            if (!activeKeys.has(key)) {
                scene.remove(group);
                group.traverse(c => { if (c.geometry) c.geometry.dispose(); });
                this.chunks.delete(key);
            }
        }
    }
};

// ============================================================================
// 7. PHYSICS COLLISION SYSTEM (VOXEL OBJECT INTERSECTION & AXIAL SOLVER)
// ============================================================================
const PhysicsEngine = {
    getSurroundingBlocks(pos) {
        // Scans the immediate 3D block neighborhood around the target entity vector
        const blocks = [];
        const minX = Math.floor(pos.x - CONFIG.PLAYER.RADIUS);
        const maxX = Math.floor(pos.x + CONFIG.PLAYER.RADIUS);
        const minY = Math.floor(pos.y - CONFIG.PLAYER.HEIGHT - 0.5);
        const maxY = Math.floor(pos.y + 0.5);
        const minZ = Math.floor(pos.z - CONFIG.PLAYER.RADIUS);
        const maxZ = Math.floor(pos.z + CONFIG.PLAYER.RADIUS);

        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    if (WorldManager.getBlockGlobal(x, y, null, z) !== null) {
                        blocks.push(new THREE.Box3(
                            new THREE.Vector3(x - 0.5, y - 0.5, z - 0.5),
                            new THREE.Vector3(x + 0.5, y + 0.5, z + 0.5)
                        ));
                    }
                }
            }
        }
        return blocks;
    },

    checkEntityCollision(pos, velocity, state) {
        // Step 1: Apply vertical movement tracking separately (Y axis axis alignment)
        pos.y += velocity.y;
        let entityBox = new THREE.Box3(
            new THREE.Vector3(pos.x - CONFIG.PLAYER.RADIUS, pos.y - CONFIG.PLAYER.HEIGHT, pos.z - CONFIG.PLAYER.RADIUS),
            new THREE.Vector3(pos.x + CONFIG.PLAYER.RADIUS, pos.y, pos.z + CONFIG.PLAYER.RADIUS)
        );

        let blocks = this.getSurroundingBlocks(pos);
        state.isGrounded = false;

        for (const block of blocks) {
            if (entityBox.intersectsBox(block)) {
                if (velocity.y > 0) { // Hit ceiling
                    pos.y = block.min.y - 0.01;
                    velocity.y = 0;
                } else if (velocity.y < 0) { // Landed on floor block
                    pos.y = block.max.y + CONFIG.PLAYER.HEIGHT + 0.01;
                    velocity.y = 0;
                    state.isGrounded = true;
                }
            }
        }

        // Step 2: Resolve horizontal positioning collisions (X and Z axis tracking splits)
        pos.x += velocity.x;
        entityBox.set(
            new THREE.Vector3(pos.x - CONFIG.PLAYER.RADIUS, pos.y - CONFIG.PLAYER.HEIGHT, pos.z - CONFIG.PLAYER.RADIUS),
            new THREE.Vector3(pos.x + CONFIG.PLAYER.RADIUS, pos.y, pos.z + CONFIG.PLAYER.RADIUS)
        );
        blocks = this.getSurroundingBlocks(pos);
        for (const block of blocks) {
            if (entityBox.intersectsBox(block)) {
                if (velocity.x > 0) pos.x = block.min.x - CONFIG.PLAYER.RADIUS - 0.01;
                if (velocity.x < 0) pos.x = block.max.x + CONFIG.PLAYER.RADIUS + 0.01;
            }
        }

        pos.z += velocity.z;
        entityBox.set(
            new THREE.Vector3(pos.x - CONFIG.PLAYER.RADIUS, pos.y - CONFIG.PLAYER.HEIGHT, pos.z - CONFIG.PLAYER.RADIUS),
            new THREE.Vector3(pos.x + CONFIG.PLAYER.RADIUS, pos.y, pos.z + CONFIG.PLAYER.RADIUS)
        );
        blocks = this.getSurroundingBlocks(pos);
        for (const block of blocks) {
            if (entityBox.intersectsBox(block)) {
                if (velocity.z > 0) pos.z = block.min.z - CONFIG.PLAYER.RADIUS - 0.01;
                if (velocity.z < 0) pos.z = block.max.z + CONFIG.PLAYER.RADIUS + 0.01;
            }
        }
    }
};

// ============================================================================
// 8. CONTROLS, IN-GAME INPUT, POVS LOGISTICS
// ============================================================================
const input = { w: false, a: false, s: false, d: false, Shift: false, ' ': false };
const povs = { FIRST_PERSON: 0, THIRD_PERSON_REAR: 1, THIRD_PERSON_FRONT: 2 };
let currentPOV = povs.THIRD_PERSON_REAR;

window.addEventListener('keydown', (e) => {
    if (e.key in input) input[e.key] = true;
    if (e.key === ' ') input[' '] = true;
    if (e.key === 'F5') currentPOV = (currentPOV + 1) % 3;
});
window.addEventListener('keyup', (e) => {
    if (e.key in input) input[e.key] = false;
    if (e.key === ' ') input[' '] = false;
});

// ============================================================================
// 9. ENTITY LOADER & COMPILATION CREATION
// ============================================================================
let dennis;
const playerState = {
    position: new THREE.Vector3(0, 35, 0), // Default safe starting air drop coordinate
    velocity: new THREE.Vector3(0, 0, 0),
    isGrounded: false
};

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

loader.load('dennis.glb', (gltf) => {
    dennis = gltf.scene;
    const wrapper = new THREE.Group();
    wrapper.name = "playerGroup";
    wrapper.position.copy(playerState.position);
    wrapper.scale.set(0.65, 0.65, 0.65);
    wrapper.add(dennis);
    scene.add(wrapper);

    dennis.traverse(child => { if (child.isMesh) child.castShadow = true; child.receiveShadow = true; });
}, undefined, err => console.error(err));

// ============================================================================
// 10. RUNNING CORE GAME REALTIME RECURSIVE ENGINE LOOP
// ============================================================================
function animate() {
    requestAnimationFrame(animate);
    const time = performance.now() * 0.005;

    // Slowly move skybox clouds across landscape horizons
    cloudGroup.children.forEach(c => {
        c.position.x += 0.04;
        if (c.position.x > 200) c.position.x = -200;
    });

    const playerGroup = scene.getObjectByName("playerGroup");

    if (playerGroup) {
        // Process vector movement directions based on key flags
        let speed = CONFIG.PLAYER.SPEED;
        if (input.Shift) speed *= CONFIG.PLAYER.RUN_MULTIPLIER;

        const forwardVel = (input.w ? 1 : 0) - (input.s ? 1 : 0);
        const sideVel = (input.a ? 1 : 0) - (input.d ? 1 : 0);

        if (sideVel !== 0) playerGroup.rotation.y += sideVel * CONFIG.PLAYER.ROTATION_SPEED;

        // Apply forward/back step changes along local space vectors
        const direction = new THREE.Vector3(0, 0, forwardVel).applyQuaternion(playerGroup.quaternion);
        playerState.velocity.x = direction.x * speed;
        playerState.velocity.z = direction.z * speed;

        // Force gravity constants down every engine frame update step
        playerState.velocity.y += CONFIG.PLAYER.GRAVITY;

        // Jump Execution Check
        if (input[' '] && playerState.isGrounded) {
            playerState.velocity.y = CONFIG.PLAYER.JUMP_FORCE;
            playerState.isGrounded = false;
        }

        // Run full collision evaluation pipelines
        PhysicsEngine.checkEntityCollision(playerState.position, playerState.velocity, playerState);

        // Lock actual graphic object frame vectors to physics trackers
        playerGroup.position.copy(playerState.position);

        // Handle inner limb mesh hopping animations smoothly
        const innerMesh = playerGroup.children[0];
        const moving = forwardVel !== 0;

        if (moving) {
            const cycleSpeed = input.Shift ? 5.5 : 4.0;
            innerMesh.position.y = Math.abs(Math.sin(time * cycleSpeed)) * 0.4;
            innerMesh.rotation.x = Math.sin(time * cycleSpeed) * 0.14;
        } else {
            innerMesh.position.y = Math.sin(time * 0.5) * 0.03;
            innerMesh.rotation.x = 0;
        }

        // Re-calculate visible chunks around newly adjusted coordinates
        WorldManager.update(playerState.position.x, playerState.position.z);

        // Reposition sun matrices right above player to maximize shadow stability coverage maps
        sunLight.position.set(playerState.position.x + 40, 150, playerState.position.z + 30);
        sunLight.target = playerGroup;

        // POV Cam Calculations
        let relativeCameraOffset;
        let lookAtTarget;

        switch (currentPOV) {
            case povs.FIRST_PERSON:
                relativeCameraOffset = new THREE.Vector3(0, 1.2, 0.2);
                camera.position.copy(relativeCameraOffset.applyMatrix4(playerGroup.matrixWorld));
                lookAtTarget = playerGroup.localToWorld(new THREE.Vector3(0, 1.2, 2));
                camera.lookAt(lookAtTarget);
                playerGroup.visible = false;
                break;
                
            case povs.THIRD_PERSON_REAR:
                relativeCameraOffset = new THREE.Vector3(0, 3.2, -6.5);
                camera.position.copy(relativeCameraOffset.applyMatrix4(playerGroup.matrixWorld));
                lookAtTarget = playerGroup.localToWorld(new THREE.Vector3(0, 0.6, 0));
                camera.lookAt(lookAtTarget);
                playerGroup.visible = true;
                break;

            case povs.THIRD_PERSON_FRONT:
                relativeCameraOffset = new THREE.Vector3(0, 3.2, 7.5);
                camera.position.copy(relativeCameraOffset.applyMatrix4(playerGroup.matrixWorld));
                lookAtTarget = playerGroup.localToWorld(new THREE.Vector3(0, 0.6, 0));
                camera.lookAt(lookAtTarget);
                playerGroup.visible = true;
                break;
        }
    } else {
        // Initial fallback chunk initialization
        WorldManager.update(0, 0);
    }

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
