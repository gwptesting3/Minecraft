import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// 1. Scene & Renderer Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x81d4fa); // Beautiful adventure sky blue
scene.fog = new THREE.FogExp2(0x81d4fa, 0.05); // Atmospheric fog for realism

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
document.body.appendChild(renderer.domElement);

// 2. Realistic Environmental Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfffde7, 1.4); // Warm sunlight
sunLight.position.set(20, 40, 20);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 150;
const d = 40;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
scene.add(sunLight);

// 3. Blocky Minecraft-Style Procedural Terrain
const blockSize = 1;
const worldSize = 30; // Grid size of our starter map

// Create a realistic blocky material
const blockGeometry = new THREE.BoxGeometry(blockSize, blockSize, blockSize);
const blockMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x558b2f, // Deep rich Minecraft grass green
    roughness: 0.9,
    metalness: 0.1
});

// Build a grid of individual 3D voxel blocks
for (let x = -worldSize/2; x < worldSize/2; x++) {
    for (let z = -worldSize/2; z < worldSize/2; z++) {
        // Generate varied heights using mathematical waves to create Zelda-like rolling hills
        const height = Math.round((Math.sin(x * 0.2) + Math.cos(z * 0.2)) * 1);
        
        for (let y = -3; y <= height; y++) {
            const block = new THREE.Mesh(blockGeometry, blockMaterial);
            block.position.set(x * blockSize, y * blockSize, z * blockSize);
            block.matrixAutoUpdate = false; // Optimizes engine performance for block grids
            block.updateMatrix();
            
            if (y === height) {
                block.castShadow = true;
                block.receiveShadow = true;
            } else {
                // Adjust dirt layers to look darker underneath
                block.material = new THREE.MeshStandardMaterial({ color: 0x4e342e, roughness: 0.9 });
            }
            scene.add(block);
        }
    }
}

// 4. Loading Dennis as the Playable Hero
let dennis;
const BASE_Y = 1.0; // Anchors him perfectly on top of the blocks

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

loader.load('dennis.glb', (gltf) => {
    dennis = gltf.scene;
    dennis.position.set(0, BASE_Y, 0);
    dennis.scale.set(0.8, 0.8, 0.8); // Scale down slightly to fit the block sizes

    dennis.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    scene.add(dennis);
}, undefined, (error) => {
    console.error('Error loading hero Dennis:', error);
});

// 5. Input System (Tracking Keypresses)
const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };

window.addEventListener('keydown', (e) => { if (e.key in keys) keys[e.key] = true; });
window.addEventListener('keyup', (e) => { if (e.key in keys) keys[e.key] = false; });

// 6. Game Animation & Control Loop
const moveSpeed = 0.07;
const rotationSpeed = 0.05;

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now() * 0.005;

    if (dennis) {
        let isMoving = false;

        // Forward / Backward movement
        if (keys.w || keys.ArrowUp) {
            dennis.translateZ(moveSpeed);
            isMoving = true;
        }
        if (keys.s || keys.ArrowDown) {
            dennis.translateZ(-moveSpeed);
            isMoving = true;
        }

        // Steer Left / Right
        if (keys.a || keys.ArrowLeft) {
            dennis.rotation.y += rotationSpeed;
        }
        if (keys.d || keys.ArrowRight) {
            dennis.rotation.y -= rotationSpeed;
        }

        // Minecraft Bouncy Hopping Logic
        if (isMoving) {
            // High-intensity jumping animation when running around
            const hopHeight = Math.abs(Math.sin(time * 3)) * 0.35;
            dennis.position.y = BASE_Y + hopHeight;
            dennis.rotation.x = Math.sin(time * 3) * 0.12; // Forward tilt
        } else {
            // Calm, idle breathing bob when standing still
            dennis.position.y = BASE_Y + Math.sin(time * 0.5) * 0.03;
            dennis.rotation.x = 0;
        }

        // Dynamic RPG Style Camera (Locks behind Dennis's back and follows him smoothly)
        const relativeCameraOffset = new THREE.Vector3(0, 2.5, -4.5);
        const cameraOffset = relativeCameraOffset.applyMatrix4(dennis.matrixWorld);
        
        camera.position.x += (cameraOffset.x - camera.position.x) * 0.1;
        camera.position.y += (cameraOffset.y - camera.position.y) * 0.1;
        camera.position.z += (cameraOffset.z - camera.position.z) * 0.1;
        
        camera.lookAt(dennis.position.x, dennis.position.y + 0.5, dennis.position.z);
    }

    renderer.render(scene, camera);
}

animate();

// Resize Window handling
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
