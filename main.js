import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// 1. Basic Setup & Renderer Optimization
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa5d6a7); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2.5, 4.5);
camera.lookAt(0, 0.5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
document.body.appendChild(renderer.domElement);

// 2. Realistic Lighting Setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(5, 8, 5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 25;
sunLight.shadow.bias = -0.0005; 
scene.add(sunLight);

// 3. Add a Ground Plane for Shadows
const floorGeo = new THREE.PlaneGeometry(20, 20);
const floorMat = new THREE.MeshStandardMaterial({ 
    color: 0x81c784, 
    roughness: 0.8  
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2; 
floor.position.y = 0;
floor.receiveShadow = true; 
scene.add(floor);

// 4. Variables & Loading Dennis
let dennis;
let isWalking = true; 

// We establish a safe baseline height. If Dennis still sinks slightly, 
// change this 0.4 value to 0.5 or 0.6 until his paws sit perfectly on top!
const BASELINE_Y = 0.4; 

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

loader.load('dennis.glb', (gltf) => {
    dennis = gltf.scene;
    
    // Set his initial stable position
    dennis.position.set(0, BASELINE_Y, 0);

    dennis.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
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

// 5. The Animation Loop (Fixed Smooth Waddle)
function animate() {
    requestAnimationFrame(animate);

    // Reduced multiplier slightly (from 0.006 to 0.004) to eliminate high-speed vibrations
    const time = performance.now() * 0.004; 

    if (dennis) {
        if (isWalking) {
            // 1. Smooth, wide side-to-side rock
            dennis.rotation.z = Math.sin(time) * 0.12;

            // 2. Gentle horizontal body twist
            dennis.rotation.y = Math.cos(time * 0.5) * 0.1;

            // FIX: We add the bounce ON TOP of the BASELINE_Y so he never clips down into the ground
            dennis.position.y = BASELINE_Y + Math.abs(Math.sin(time * 2)) * 0.08;
        } else {
            // Idle: Ground him smoothly and apply a subtle breathing effect
            dennis.rotation.z = 0;
            dennis.rotation.y = 0;
            dennis.position.y = BASELINE_Y + Math.sin(time * 0.3) * 0.01;
        }
    }

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
