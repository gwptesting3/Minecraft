import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 1. Scene & Renderer Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa5d6a7); // Nice green background

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3, 5); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
document.body.appendChild(renderer.domElement);

// 2. Spectator Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.5, 0);

// 3. Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(5, 8, 5);
sunLight.castShadow = true;
scene.add(sunLight);

// 4. Floor
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x81c784, roughness: 0.8 })
);
floor.rotation.x = -Math.PI / 2; 
floor.receiveShadow = true; 
scene.add(floor);

// 5. Variables for Dennis and Split Parts
let dennis;
let bodyParts = [];
const ELEVATION_OFFSET = 0.6; // Ground height benchmark

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

// Load your freshly partitioned file
// The "?v=1" at the end forces Cloudflare to treat this as a brand-new request
loader.load('dennis_split.glb?v=1', (gltf) => {
    dennis = gltf.scene;
    dennis.position.set(0, ELEVATION_OFFSET, 0);

    dennis.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            // Gather the isolated child meshes into our array
            bodyParts.push(child);
        }
    });

    scene.add(dennis);
}, undefined, (error) => {
    console.error("Error loading model:", error);
});

// 6. Animation Loop
function animate() {
    requestAnimationFrame(animate);
    
    const time = performance.now() * 0.005;
    controls.update();

    // Ensure we actually have parts split up to manipulate
    if (bodyParts.length >= 2) {
        bodyParts.forEach((part, index) => {
            // Index 0 is typically the main base/torso mesh. 
            // We leave that unrotated so his body stays perfectly straight!
            if (index > 0) {
                // Alternating meshes swing in opposite directions to simulate limbs moving past each other
                if (index % 2 === 0) {
                    part.rotation.x = Math.sin(time) * 0.35;
                } else {
                    part.rotation.x = -Math.sin(time) * 0.35;
                }
            }
        });
    }

    renderer.render(scene, camera);
}

animate();

// Handle Resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
