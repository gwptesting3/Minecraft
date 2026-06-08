import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ============================================================================
// 1. ADVANCED ENGINE CONFIGURATION & GLOBAL MATRICES
// ============================================================================
const CONFIG = {
    WORLD: {
        DIMENSION: 600,
        RESOLUTION: 250,
        SEA_LEVEL: -6.0,
        SAND_LINE: -4.0,
        MOUNTAIN_LINE: 15.0,
        DAY_CYCLE_DURATION: 300, // Complete loop from day to night in seconds (5 Minutes)
    },
    PLAYER: {
        WALK_SPEED: 0.16,
        RUN_BOOST: 1.65,
        GRAVITY: -0.015,
        JUMP_FORCE: 0.33,
        HEIGHT: 1.6,
        MOUSE_SENSITIVITY: 0.002
    },
    PARTICLES: {
        LEAF_COUNT: 400,
        RUBBLE_COUNT: 150
    }
};

// ============================================================================
// 2. STAGE, RENDERER, & HUD CROSSHAIR INITIALIZATION
// ============================================================================
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);
// Camera wrapper group used to cleanly handle FPS Mouse rotations without breaking player physics
const cameraOffsetGroup = new THREE.Group();
cameraOffsetGroup.position.set(0, CONFIG.PLAYER.HEIGHT, 0);
cameraOffsetGroup.add(camera);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.3; // Boosted baseline exposure to fix darkness
document.body.appendChild(renderer.domElement);

// Create HTML UI Crosshair Element
const crosshair = document.createElement('div');
crosshair.style.position = 'absolute';
crosshair.style.top = '50%';
crosshair.style.left = '50%';
crosshair.style.width = '10px';
crosshair.style.height = '10px';
crosshair.style.border = '2px solid rgba(255, 255, 255, 0.8)';
crosshair.style.borderRadius = '50%';
crosshair.style.transform = 'translate(-50%, -50%)';
crosshair.style.pointerEvents = 'none';
document.body.appendChild(crosshair);

// ============================================================================
// 3. MOUSE POINTER LOCK ENGINE SYSTEM
// ============================================================================
let isPointerLocked = false;
renderer.domElement.addEventListener('click', () => {
    renderer.domElement.requestPointerLock();
});

document.addEventListener('pointerlockchange', () => {
    isPointerLocked = document.pointerLockElement === renderer.domElement;
});

document.addEventListener('mousemove', (e) => {
    if (!isPointerLocked) return;
    const playerGroup = scene.getObjectByName("playerGroup");
    if (playerGroup) {
        // Horizontal mouse motion turns player character model body
        playerGroup.rotation.y -= e.movementX * CONFIG.PLAYER.MOUSE_SENSITIVITY;
        
        // Vertical mouse motion tilts camera neck wrapper smoothly
        cameraOffsetGroup.rotation.x -= e.movementY * CONFIG.PLAYER.MOUSE_SENSITIVITY;
        cameraOffsetGroup.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, cameraOffsetGroup.rotation.x));
    }
});

// ============================================================================
// 4. TEXTURE GENERATOR LABORATORIES (HIGH-FIDELITY GRAIN & DETAIL PACKS)
// ============================================================================
const TextureFactory = {
    createContext(w, h) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        return { canvas, ctx: canvas.getContext('2d') };
    },
    generateGrass() {
        const { canvas, ctx } = this.createContext(1024, 1024);
        ctx.fillStyle = '#33691e';
        ctx.fillRect(0, 0, 1024, 1024);
        for (let i = 0; i < 200000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#4caf50' : '#1b5e20';
            ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, Math.random() * 6 + 2);
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(12, 12);
        return tex;
    },
    generateRockWithGrain() {
        const { canvas, ctx } = this.createContext(1024, 1024);
        ctx.fillStyle = '#455a64';
        ctx.fillRect(0, 0, 1024, 1024);
        // Add heavy stone noise grain details
        for (let i = 0; i < 300000; i++) {
            const grain = Math.floor(60 + Math.random() * 40);
            ctx.fillStyle = `rgba(${grain},${grain},${grain + 5}, 0.15)`;
            ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2);
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(8, 8);
        return tex;
    }
};

const MATERIALS = {
    GRASS: new THREE.MeshStandardMaterial({ map: TextureFactory.generateGrass(), roughness: 0.9, metalness: 0.05 }),
    ROCK: new THREE.MeshStandardMaterial({ map: TextureFactory.generateRockWithGrain(), roughness: 0.8, metalness: 0.15 }),
    RUIN_BRICK: new THREE.MeshStandardMaterial({ map: TextureFactory.generateRockWithGrain(), roughness: 0.75, color: 0x90a4ae }),
    WATER: new THREE.MeshStandardMaterial({ color: 0x00695c, transparent: true, opacity: 0.75, roughness: 0.05, metalness: 0.6 }),
    LEAF: new THREE.MeshStandardMaterial({ color: 0xffa726, roughness: 0.6, side: THREE.DoubleSide }), // Autumn colored wind leaves
    RUBBLE: new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.85 })
};

// ============================================================================
// 5. CELESTIAL DAY-TO-NIGHT SYSTEM (5 MINUTE CONTINUOUS REVOLUTION)
// ============================================================================
const CelestialEngine = {
    sunLight: new THREE.DirectionalLight(0xfffde7, 1.5),
    moonLight: new THREE.DirectionalLight(0x9fa8da, 0.4),
    skyMesh: null,

    init() {
        // Setup direct shadow casting parameters for sun
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        const d = 250;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        this.sunLight.shadow.bias = -0.0004;
        scene.add(this.sunLight);

        // Setup moonlight shadow properties
        this.moonLight.castShadow = true;
        this.moonLight.shadow.mapSize.width = 1024;
        this.moonLight.shadow.mapSize.height = 1024;
        this.moonLight.shadow.camera.left = -d;
        this.moonLight.shadow.camera.right = d;
        this.moonLight.shadow.camera.top = d;
        this.moonLight.shadow.camera.bottom = -d;
        scene.add(this.moonLight);

        // Build procedural visual Sky Dome Box
        const skyGeo = new THREE.SphereGeometry(700, 32, 15);
        const skyMat = new THREE.MeshBasicMaterial({ color: 0x81d4fa, side: THREE.BackSide });
        this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
        scene.add(this.skyMesh);
    },

    update(time, pX, pZ) {
        // Calculate orbital progress angle based on our configured length constant
        const angle = (time / CONFIG.WORLD.DAY_CYCLE_DURATION) * Math.PI * 2;
        
        // Compute current celestial vectors centered over player tracking positions
        const sunX = pX + Math.sin(angle) * 300;
        const sunY = Math.cos(angle) * 300;
        const sunZ = pZ + Math.sin(angle * 0.5) * 100;
        this.sunLight.position.set(sunX, sunY, sunZ);

        const moonX = pX - Math.sin(angle) * 300;
        const moonY = -Math.cos(angle) * 300;
        const moonZ = pZ - Math.sin(angle * 0.5) * 100;
        this.moonLight.position.set(moonX, moonY, moonZ);

        // Interpolate colors/intensities based on astronomical height checks
        const dayFactor = Math.max(0, Math.min(1, sunY / 150)); // $0.0 = \text{Midnight}$, $1.0 = \text{Noon}$
        
        // Transition Sky Colors and fog variables
        const skyColor = new THREE.Color(0x0a1128).lerp(new THREE.Color(0x81d4fa), dayFactor);
        this.skyMesh.material.color.copy(skyColor);
        scene.background.copy(skyColor);
        scene.fog = new THREE.FogExp2(skyColor.getHex(), 0.01 + (1.0 - dayFactor) * 0.008);

        // Adjust illumination strength to keep night exploreable but realistically dim
        this.sunLight.intensity = dayFactor * 1.6;
        this.moonLight.intensity = (1.0 - dayFactor) * 0.5;
    }
};
CelestialEngine.init();

// ============================================================================
// 6. PROCEDURAL SMOOTH TERRAIN & ANCIENT RUINS ARCHITECTURES
// ============================================================================
function getTerrainHeight(x, z) {
    let y = Math.sin(x * 0.008) * Math.cos(z * 0.008) * 22; // Mountains
    y += Math.sin(x * 0.04) * Math.sin(z * 0.03) * 5;      // Slopes
    
    // Smooth valley river channel carve
    const riverX = Math.sin(z * 0.02) * 35;
    const distToRiver = Math.abs(x - riverX);
    if (distToRiver < 30) {
        const factor = (30 - distToRiver) / 30;
        y -= factor * factor * 16;
    }
    return y;
}

const terrainGeo = new THREE.PlaneGeometry(CONFIG.WORLD.DIMENSION, CONFIG.WORLD.DIMENSION, CONFIG.WORLD.RESOLUTION, CONFIG.WORLD.RESOLUTION);
terrainGeo.rotateX(-Math.PI / 2);

const posAttr = terrainGeo.attributes.position;
for (let i = 0; i < posAttr.count; i++) {
    const tx = posAttr.getX(i);
    const tz = posAttr.getZ(i);
    posAttr.setY(i, getTerrainHeight(tx, tz));
}
terrainGeo.computeVertexNormals();

const terrainMesh = new THREE.Mesh(terrainGeo, MATERIALS.GRASS);
terrainMesh.receiveShadow = true;
terrainMesh.castShadow = true;
scene.add(terrainMesh);

// Dynamic Animated Waves Water Plane
const waterGeo = new THREE.PlaneGeometry(CONFIG.WORLD.DIMENSION, CONFIG.WORLD.DIMENSION, 60, 60);
waterGeo.rotateX(-Math.PI / 2);
const waterMesh = new THREE.Mesh(waterGeo, MATERIALS.WATER);
waterMesh.position.y = CONFIG.WORLD.SEA_LEVEL;
scene.add(waterMesh);

// Realtime Architectural Ruins Spawning System
const ruinsGroup = new THREE.Group();
scene.add(ruinsGroup);

function createDetailedRuinTemple(rx, rz) {
    const ry = getTerrainHeight(rx, rz);
    if (ry < CONFIG.WORLD.SAND_LINE + 2) return;

    const templeContainer = new THREE.Group();
    templeContainer.position.set(rx, ry, rz);

    const blockGeo = new THREE.BoxGeometry(4, 2, 4);
    // Build a segmented ruined wall frame
    for (let floor = 0; floor < 4; floor++) {
        const isBroken = Math.random() > 0.75;
        if (!isBroken) {
            const brickWall = new THREE.Mesh(blockGeo, MATERIALS.RUIN_BRICK);
            brickWall.position.set(Math.sin(floor) * 2, floor * 2, 0);
            brickWall.rotation.y = Math.random() * 0.2;
            brickWall.castShadow = true;
            brickWall.receiveShadow = true;
            templeContainer.add(brickWall);
        }
    }
    
    // Spawn physical structural crumbling rubble piles beneath walls
    for (let r = 0; r < 5; r++) {
        const shard = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 + Math.random() * 0.6), MATERIALS.RUBBLE);
        shard.position.set((Math.random() - 0.5) * 8, 0.2, (Math.random() - 0.5) * 8);
        shard.rotation.set(Math.random() * 3, Math.random() * 3, 0);
        shard.castShadow = true;
        templeContainer.add(shard);
    }

    ruinsGroup.add(templeContainer);
}

// Distribute ruins arrays systematically across landscape quadratures
for (let i = 0; i < 20; i++) {
    const rx = (Math.random() - 0.5) * 450;
    const rz = (Math.random() - 0.5) * 450;
    createDetailedRuinTemple(rx, rz);
}

// ============================================================================
// 7. REAL-TIME WIND PARTICLES & LEAVES INSTANCE EMITTERS
// ============================================================================
const ParticleEngine = {
    leafMesh: null,
    leafData: [],

    init() {
        const leafGeo = new THREE.BoxGeometry(0.4, 0.05, 0.6);
        this.leafMesh = new THREE.InstancedMesh(leafGeo, MATERIALS.LEAF, CONFIG.PARTICLES.LEAF_COUNT);
        this.leafMesh.castShadow = true;
        scene.add(this.leafMesh);

        const dummy = new THREE.Object3D();
        for (let i = 0; i < CONFIG.PARTICLES.LEAF_COUNT; i++) {
            const px = (Math.random() - 0.5) * CONFIG.WORLD.DIMENSION;
            const pz = (Math.random() - 0.5) * CONFIG.WORLD.DIMENSION;
            const py = getTerrainHeight(px, pz) + 10 + Math.random() * 30;

            this.leafData.push({
                pos: new THREE.Vector3(px, py, pz),
                vel: new THREE.Vector3(-0.05 - Math.random() * 0.1, -0.02 - Math.random() * 0.04, (Math.random() - 0.5) * 0.05),
                rot: new THREE.Vector3(Math.random() * Math.PI, Math.random() * Math.PI, 0),
                rotSpeed: 0.02 + Math.random() * 0.03
            });

            dummy.position.copy(this.leafData[i].pos);
            dummy.updateMatrix();
            this.leafMesh.setMatrixAt(i, dummy.matrix);
        }
    },

    update(pX, pZ) {
        const dummy = new THREE.Object3D();
        for (let i = 0; i < CONFIG.PARTICLES.LEAF_COUNT; i++) {
            const data = this.leafData[i];
            data.pos.add(data.vel);
            data.rot.x += data.rotSpeed;
            data.rot.y += data.rotSpeed * 0.5;

            // Recycler pipeline resets dead leaves back in front of player perspective bounds
            if (data.pos.y < getTerrainHeight(data.pos.x, data.pos.z) || data.pos.distanceTo(new THREE.Vector3(pX, data.pos.y, pZ)) > 150) {
                data.pos.set(pX + (Math.random() - 0.5) * 100 + 40, getTerrainHeight(pX, pZ) + 20 + Math.random() * 20, pZ + (Math.random() - 0.5) * 100);
            }

            dummy.position.copy(data.pos);
            dummy.rotation.set(data.rot.x, data.rot.y, data.rot.z);
            dummy.updateMatrix();
            this.leafMesh.setMatrixAt(i, dummy.matrix);
        }
        this.leafMesh.instanceMatrix.needsUpdate = true;
    }
};
ParticleEngine.init();

// ============================================================================
// 8. OBJECT MANAGER (PLAYABLE CHARACTER SETUP FRAMEWORKS)
// ============================================================================
let playableHeroGroup;
const physicsState = {
    pos: new THREE.Vector3(0, 20, 0),
    vel: new THREE.Vector3(0, 0, 0),
    isGrounded: false
};

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

gltfLoader.load('dennis.glb', (gltf) => {
    const dennisModel = gltf.scene;
    playableHeroGroup = new THREE.Group();
    playableHeroGroup.name = "playerGroup";
    playableHeroGroup.position.copy(physicsState.pos);
    playableHeroGroup.scale.set(0.65, 0.65, 0.65);
    
    playableHeroGroup.add(dennisModel);
    playableHeroGroup.add(cameraOffsetGroup); // Mounts pointer-lock camera onto player center node
    scene.add(playableHeroGroup);

    dennisModel.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
});

// ============================================================================
// 9. INPUT SYSTEM MATRIX REGISTRATION
// ============================================================================
const keys = { w: false, a: false, s: false, d: false, Shift: false, ' ': false };
let activePOV = 0; // 0 = Third Person Rear Close, 1 = Third Person Rear Far

window.addEventListener('keydown', (e) => {
    if (e.key in keys) keys[e.key] = true;
    if (e.key === ' ') keys[' '] = true;
    if (e.key === 'F5') {
        e.preventDefault(); // FIX: Stops browser reloading page frame cycles
        activePOV = (activePOV + 1) % 2;
    }
});
window.addEventListener('keyup', (e) => {
    if (e.key in keys) keys[e.key] = false;
    if (e.key === ' ') keys[' '] = false;
});

// ============================================================================
// 10. REALTIME RECURSIVE SYSTEM GAME PLAY ENGINE LOOP
// ============================================================================
function gameLoop() {
    requestAnimationFrame(gameLoop);
    const systemSecondsTime = performance.now() / 1000;

    // Realtime Water Fluid Mesh Wave Animation Loop Calculations
    const waterPos = waterMesh.geometry.attributes.position;
    for (let i = 0; i < waterPos.count; i++) {
        const wx = waterPos.getX(i);
        const wz = waterPos.getZ(i);
        // Generates rolling liquid waves using mixed sine frequencies
        const waveY = Math.sin(wx * 0.1 + systemSecondsTime * 1.5) * 0.25 + Math.cos(wz * 0.08 + systemSecondsTime * 1.2) * 0.2;
        waterPos.setY(i, waveY);
    }
    waterMesh.geometry.computeVertexNormals();
    waterMesh.geometry.attributes.position.needsUpdate = true;

    const pGroup = scene.getObjectByName("playerGroup");
    if (pGroup) {
        let currentSpeed = CONFIG.PLAYER.WALK_SPEED;
        if (keys.Shift) currentSpeed *= CONFIG.PLAYER.RUN_BOOST;

        // Drive velocity directions matching camera perspective alignment vectors
        const moveX = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
        const moveZ = (keys.w ? 1 : 0) - (keys.s ? 1 : 0);

        const localMovement = new THREE.Vector3(moveX, 0, moveZ).normalize().applyQuaternion(pGroup.quaternion);
        physicsState.pos.x += localMovement.x * currentSpeed;
        physicsState.pos.z += localMovement.z * currentSpeed;

        // Apply gravitational physics equations constants down every frame step loop
        physicsState.vel.y += CONFIG.PLAYER.GRAVITY;
        physicsState.pos.y += physicsState.vel.y;

        const currentGroundY = getTerrainHeight(physicsState.pos.x, physicsState.pos.z);
        if (physicsState.pos.y <= currentGroundY) {
            physicsState.pos.y = currentGroundY;
            physicsState.vel.y = 0;
            physicsState.isGrounded = true;
        } else {
            physicsState.isGrounded = false;
        }

        if (keys[' '] && physicsState.isGrounded) {
            physicsState.vel.y = CONFIG.PLAYER.JUMP_FORCE;
            physicsState.isGrounded = false;
        }

        pGroup.position.copy(physicsState.pos);

        // Limb mesh bobs
        const innerMesh = pGroup.children[0];
        const isMoving = moveX !== 0 || moveZ !== 0;

        if (isMoving && physicsState.isGrounded) {
            const cadence = keys.Shift ? 6.5 : 4.5;
            innerMesh.position.y = Math.abs(Math.sin(systemSecondsTime * cadence)) * 0.4;
            innerMesh.rotation.x = Math.sin(systemSecondsTime * cadence) * 0.12;
        } else if (!physicsState.isGrounded) {
            innerMesh.position.y = 0.2;
            innerMesh.rotation.x = -0.1;
        } else {
            innerMesh.position.y = Math.sin(systemSecondsTime * 2.0) * 0.03;
            innerMesh.rotation.x = 0;
        }

        // Run updates on our modular subsystems
        CelestialEngine.update(systemSecondsTime, physicsState.pos.x, physicsState.pos.z);
        ParticleEngine.update(physicsState.pos.x, physicsState.pos.z);

        // Dynamic Camera distance view toggling tracking logic based on F5 indexes
        if (activePOV === 0) {
            camera.position.set(0, 2.5, -6.5); // Close Chase perspective view
            camera.lookAt(pGroup.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
        } else {
            camera.position.set(0, 4.5, -11.0); // Distant battlefield overview perspective view
            camera.lookAt(pGroup.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
        }
    }

    renderer.render(scene, camera);
}
gameLoop();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
