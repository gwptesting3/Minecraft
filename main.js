import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ============================================================================
// 1. ENGINE CONFIGURATION & GLOBAL SETTINGS
// ============================================================================
const CONFIG = {
    TERRAIN: {
        SIZE: 500,               // Map size
        SEGMENTS: 200,           // Grid detail
        WATER_HEIGHT: -4.0,      // Sea level
    },
    PLAYER: {
        SPEED: 0.16,
        RUN_MULTIPLIER: 1.65,
        ROTATION_SPEED: 0.045,
        GRAVITY: -0.015,
        JUMP_FORCE: 0.32,
        EYE_HEIGHT: 1.2
    }
};

// ============================================================================
// 2. SYSTEM SETUP (SCENE, OPTIMIZED RENDERER, EFFECTS)
// ============================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x81d4fa); // Beautiful sunny sky
scene.fog = new THREE.FogExp2(0x81d4fa, 0.012); // Smooth horizon fading

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.appendChild(renderer.domElement);

// ============================================================================
// 3. ENVIRONMENTAL LIGHTING & SUN SYSTEMS
// ============================================================================
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfffde7, 1.4);
sunLight.position.set(100, 250, 100);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
const d = 200;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

// Beautiful floating volumetric realistic clouds
const cloudGroup = new THREE.Group();
const cloudGeo = new THREE.BoxGeometry(20, 4, 30);
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });

for (let i = 0; i < 50; i++) {
    const cloud = new THREE.Mesh(cloudGeo, cloudMat);
    cloud.position.set(
        (Math.random() - 0.5) * CONFIG.TERRAIN.SIZE,
        60 + Math.random() * 20,
        (Math.random() - 0.5) * CONFIG.TERRAIN.SIZE
    );
    cloudGroup.add(cloud);
}
scene.add(cloudGroup);

// ============================================================================
// 4. THE MATHEMATICAL GEOGRAPHY ENGINE (SMOOTH REAL-LIFE ZELDA HILLS)
// ============================================================================
// Generates continuous slopes, mountains, beaches, and winding valley rivers
function getTerrainHeight(x, z) {
    // Large structural Zelda mountain ranges
    let y = Math.sin(x * 0.01) * Math.cos(z * 0.01) * 18;
    
    // Medium rolling green fields and cliffs
    y += Math.sin(x * 0.04) * Math.sin(z * 0.03) * 6;
    
    // Tiny organic ground noise bumps
    y += Math.cos(x * 0.15) * Math.sin(z * 0.15) * 0.4;
    
    // Winding River Valley carving math
    const riverX = Math.sin(z * 0.015) * 40;
    const distanceToRiver = Math.abs(x - riverX);
    if (distanceToRiver < 25) {
        // Smoothly carve downward to form beautiful riverbanks
        const depthFactor = (25 - distanceToRiver) / 25;
        y -= depthFactor * depthFactor * 14;
    }
    
    return y;
}

// ============================================================================
// 5. TERRAIN GENERATOR & PROCEDURAL ASSET POPULATION
// ============================================================================
const terrainGeo = new THREE.PlaneGeometry(CONFIG.TERRAIN.SIZE, CONFIG.TERRAIN.SIZE, CONFIG.TERRAIN.SEGMENTS, CONFIG.TERRAIN.SEGMENTS);
terrainGeo.rotateX(-Math.PI / 2);

const positions = terrainGeo.attributes.position;
const colors = [];

for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = getTerrainHeight(x, z);
    positions.setY(i, y);

    // Dynamic slope-based color blending
    const color = new THREE.Color();
    if (y < CONFIG.TERRAIN.WATER_HEIGHT + 1.5) {
        color.setHex(0xd7ccc8); // Sandy soft riverbeds and ocean beaches
    } else if (y > 12) {
        color.setHex(0x90a4ae); // Cool rocky mountain crags
    } else {
        // Lush deep green adventure pastures
        const variance = 0.4 + (Math.sin(x * 0.5) * 0.1);
        color.setRGB(variance * 0.5, variance, variance * 0.3);
    }
    colors.push(color.r, color.g, color.b);
}

terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
terrainGeo.computeVertexNormals();

const terrainMat = new THREE.MeshStandardMaterial({ 
    vertexColors: true, 
    roughness: 0.9, 
    metalness: 0.05 
});
const terrain = new THREE.Mesh(terrainGeo, terrainMat);
terrain.receiveShadow = true;
terrain.castShadow = true;
scene.add(terrain);

// Ultra-realistic smooth water plane reflecting sunlight in the valleys
const waterGeo = new THREE.PlaneGeometry(CONFIG.TERRAIN.SIZE, CONFIG.TERRAIN.SIZE);
const waterMat = new THREE.MeshStandardMaterial({
    color: 0x00bcd4,
    transparent: true,
    opacity: 0.65,
    roughness: 0.1,
    metalness: 0.5
});
const water = new THREE.Mesh(waterGeo, waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = CONFIG.TERRAIN.WATER_HEIGHT;
scene.add(water);

// Procedural Asset Placement Loop (Trees and Ancient Temples)
const assetGroup = new THREE.Group();
scene.add(assetGroup);

function buildTreeMesh(x, y, z) {
    const tree = new THREE.Group();
    tree.position.set(x, y, z);
    
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 4, 6), new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 }));
    trunk.position.y = 2;
    trunk.castShadow = true;
    
    const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.8, 4, 6), new THREE.MeshStandardMaterial({ color: 0x1b5e20, roughness: 0.85 }));
    leaves.position.y = 4.5;
    leaves.castShadow = true;
    
    tree.add(trunk, leaves);
    assetGroup.add(tree);
}

function buildTempleMesh(x, y, z) {
    const temple = new THREE.Group();
    temple.position.set(x, y, z);
    
    const base = new THREE.Mesh(new THREE.BoxGeometry(10, 2, 10), new THREE.MeshStandardMaterial({ color: 0xb0bec5, roughness: 0.8 }));
    base.position.y = 1;
    base.castShadow = true;
    base.receiveShadow = true;
    temple.add(base);

    const pillars = new THREE.CylinderGeometry(0.3, 0.3, 5, 6);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x90a4ae, roughness: 0.8 });
    for (let px of [-4, 4]) {
        for (let pz of [-4, 4]) {
            const p = new THREE.Mesh(pillars, stoneMat);
            p.position.set(px, 4, pz);
            p.castShadow = true;
            temple.add(p);
        }
    }
    
    const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 4, 4), stoneMat);
    roof.position.y = 8;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    temple.add(roof);
    assetGroup.add(temple);
}

// Populate the landscape avoiding the water layer
for (let i = 0; i < 200; i++) {
    const rx = (Math.random() - 0.5) * (CONFIG.TERRAIN.SIZE - 40);
    const rz = (Math.random() - 0.5) * (CONFIG.TERRAIN.SIZE - 40);
    const ry = getTerrainHeight(rx, rz);
    
    if (ry > CONFIG.TERRAIN.WATER_HEIGHT + 2) {
        if (Math.random() > 0.96) {
            buildTempleMesh(rx, ry, rz);
        } else {
            buildTreeMesh(rx, ry, rz);
        }
    }
}

// ============================================================================
// 6. LOADING THE HERO (PLAYABLE OBJECT STRUCTS)
// ============================================================================
let dennis;
const playerPhysics = {
    position: new THREE.Vector3(0, 10, 0),
    velocity: new THREE.Vector3(0, 0, 0),
    isGrounded: false,
    jumpAnimTimer: 0
};

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

loader.load('dennis.glb', (gltf) => {
    dennis = gltf.scene;
    const wrapper = new THREE.Group();
    wrapper.name = "playerGroup";
    wrapper.position.copy(playerPhysics.position);
    wrapper.scale.set(0.7, 0.7, 0.7);
    wrapper.add(dennis);
    scene.add(wrapper);

    dennis.traverse(child => { if (child.isMesh) child.castShadow = true; child.receiveShadow = true; });
}, undefined, err => console.error(err));

// ============================================================================
// 7. INPUT HANDLING SYSTEMS & VIEW ROTATION STORAGE
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
// 8. HIGH-PERFORMANCE GAME LOOP & PHYSICS ENGINE
// ============================================================================
function animate() {
    requestAnimationFrame(animate);
    const time = performance.now() * 0.005;

    // Drifting clouds realism
    cloudGroup.children.forEach(c => {
        c.position.x += 0.05;
        if (c.position.x > CONFIG.TERRAIN.SIZE / 2) c.position.x = -CONFIG.TERRAIN.SIZE / 2;
    });

    const playerGroup = scene.getObjectByName("playerGroup");

    if (playerGroup) {
        // Movement Calculations
        let currentSpeed = CONFIG.PLAYER.SPEED;
        if (input.Shift) currentSpeed *= CONFIG.PLAYER.RUN_MULTIPLIER;

        const moveForward = (input.w ? 1 : 0) - (input.s ? 1 : 0);
        const steerTurn = (input.a ? 1 : 0) - (input.d ? 1 : 0);

        // Steer left and right
        if (steerTurn !== 0) playerGroup.rotation.y += steerTurn * CONFIG.PLAYER.ROTATION_SPEED;

        // Drive coordinates along forward angles
        const moveVector = new THREE.Vector3(0, 0, moveForward).applyQuaternion(playerGroup.quaternion);
        playerPhysics.position.x += moveVector.x * currentSpeed;
        playerPhysics.position.z += moveVector.z * currentSpeed;

        // Fetch exact mathematical slope height right under Dennis's feet
        const groundSurfaceY = getTerrainHeight(playerPhysics.position.x, playerPhysics.position.z);

        // Gravity physics calculations
        playerPhysics.velocity.y += CONFIG.PLAYER.GRAVITY;
        playerPhysics.position.y += playerPhysics.velocity.y;

        // COLLISION: Stop falling and lock cleanly to the rolling hill slopes
        if (playerPhysics.position.y <= groundSurfaceY) {
            playerPhysics.position.y = groundSurfaceY;
            playerPhysics.velocity.y = 0;
            playerPhysics.isGrounded = true;
        } else {
            playerPhysics.isGrounded = false;
        }

        // JUMP PHYSICS TRIGGER
        if (input[' '] && playerPhysics.isGrounded) {
            playerPhysics.velocity.y = CONFIG.PLAYER.JUMP_FORCE;
            playerPhysics.isGrounded = false;
        }

        // Lock actual graphic visual to the calculated physics tracker vector
        playerGroup.position.copy(playerPhysics.position);

        // Limb mesh hopping mechanics matching velocity states
        const innerMesh = playerGroup.children[0];
        const isMoving = moveForward !== 0;

        if (!playerPhysics.isGrounded) {
            // Smoothly extend legs for jump air-time stance
            innerMesh.position.y = 0.2;
            innerMesh.rotation.x = -0.1;
        } else if (isMoving) {
            const frequency = input.Shift ? 5.5 : 4.0;
            innerMesh.position.y = Math.abs(Math.sin(time * frequency)) * 0.4;
            innerMesh.rotation.x = Math.sin(time * frequency) * 0.14;
        } else {
            innerMesh.position.y = Math.sin(time * 0.5) * 0.03; // Calm breathing idle
            innerMesh.rotation.x = 0;
        }

        // Sun tracker tracks shadows dynamically right above Dennis
        sunLight.position.set(playerPhysics.position.x + 60, 200, playerPhysics.position.z + 50);
        sunLight.target = playerGroup;

        // ====================================================================
        // 9. ANTI-JITTER CAMERA LOGIC FOR ALL 3 POVS (F5 KEY)
// ====================================================================
        let relativeCameraOffset;
        let lookAtTarget;

        switch (currentPOV) {
            case povs.FIRST_PERSON:
                // Sits inside Dennis's eye level looking forward
                relativeCameraOffset = new THREE.Vector3(0, CONFIG.PLAYER.EYE_HEIGHT, 0.2);
                camera.position.copy(relativeCameraOffset.applyMatrix4(playerGroup.matrixWorld));
                lookAtTarget = playerGroup.localToWorld(new THREE.Vector3(0, CONFIG.PLAYER.EYE_HEIGHT, 2));
                camera.lookAt(lookAtTarget);
                playerGroup.visible = false; // Hide body in FP
                break;
                
            case povs.THIRD_PERSON_REAR:
                // Locked perfectly behind Dennis's spine
                relativeCameraOffset = new THREE.Vector3(0, 2.6, -6.0);
                camera.position.copy(relativeCameraOffset.applyMatrix4(playerGroup.matrixWorld));
                lookAtTarget = playerGroup.localToWorld(new THREE.Vector3(0, 0.6, 0));
                camera.lookAt(lookAtTarget);
                playerGroup.visible = true;
                break;

            case povs.THIRD_PERSON_FRONT:
                // Cinematic front camera looking directly back at Dennis
                relativeCameraOffset = new THREE.Vector3(0, 2.6, 7.0);
                camera.position.copy(relativeCameraOffset.applyMatrix4(playerGroup.matrixWorld));
                lookAtTarget = playerGroup.localToWorld(new THREE.Vector3(0, 0.6, 0));
                camera.lookAt(lookAtTarget);
                playerGroup.visible = true;
                break;
        }
    }

    renderer.render(scene, camera);
}

animate();

// Resize window handler
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
