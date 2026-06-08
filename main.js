import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// 1. Basic Setup & Renderer Optimization
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa5d6a7); // Light green background (Minecraft grass vibe)

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2.5, 4.5);
camera.lookAt(0, 0.5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Laptop friendly but sharp

// CRITICAL FOR SHADOWS: Turn on the shadow map engine
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Beautiful, smooth shadows
document.body.appendChild(renderer.domElement);

// 2. Realistic Lighting Setup
// Ambient light acts as sky reflection so shadows aren't pitch black
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
scene.add(ambientLight);

// Directional light acts as the sun and casts shadows
const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(5, 8, 5);
sunLight.castShadow = true;

// Optimize shadow performance so your laptop stays smooth
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 25;
sunLight.shadow.bias = -0.0005; // Fixes weird artifact lines on the mesh
scene.add(sunLight);

// 3. Add a Ground Plane for Shadows
const floorGeo = new THREE.PlaneGeometry(20, 20);
const floorMat = new THREE.MeshStandardMaterial({ 
    color: 0x81c784, // Slightly darker grass color
    roughness: 0.8  // Not shiny
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2; // Lay it flat
floor.position.y = 0;
floor.receiveShadow = true; // Tell the floor to catch shadows
scene.add(floor);

// 4. Variables & Loading Dennis
let dennis;
let isWalking = true; 

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

loader.load('dennis.glb', (gltf) => {
    dennis = gltf.scene;
    
    // Position Dennis slightly above the floor so his feet touch it
    dennis.position.set(0, 0, 0);

    // Make sure the model casts and receives shadows properly
    dennis.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            // Boost material realism slightly
            if (child.material) {
                child.material.roughness = 0.7;
                child.material.metalness = 0.1;
            }
        }
    });

    scene.add(dennis);
}, undefined, (error) => {
    console.error('Error loading Dennis:', error);
});

// 5. The Animation Loop (Option 1: The Waddle Cycle)
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now() * 0.006; 

    if (dennis) {
        if (isWalking) {
            // 1. Rock left and right like a walking puppy
            dennis.rotation.z = Math.sin(time) * 0.12;

            // 2. Twist slightly side-to-side horizontally as he steps
            dennis.rotation.y = Math.cos(time * 0.5) * 0.1;

            // 3. Make him slightly bob up and down to match the steps
            dennis.position.y = Math.abs(Math.sin(time * 2)) * 0.06;
        } else {
            // Idle: Stop moving and do a gentle breathing tilt
            dennis.rotation.z = 0;
            dennis.rotation.y = 0;
            dennis.position.y = Math.sin(time * 0.3) * 0.01;
        }
    }

    renderer.render(scene, camera);
}

animate();

// Handle Window Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
