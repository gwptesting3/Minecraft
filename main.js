import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 1. Scene & Renderer Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa5d6a7); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3, 5); 

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
document.body.appendChild(renderer.domElement);

// 2. Spectator Camera Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.target.set(0, 0.5, 0);

// 3. Lighting Setup
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); 
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(5, 8, 5);
sunLight.castShadow = true;
scene.add(sunLight);

// 4. Ground Floor Setup
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x81c784, roughness: 0.8 })
);
floor.rotation.x = -Math.PI / 2; 
floor.receiveShadow = true; 
scene.add(floor);

// 5. Loading Dennis & Gathering Parts
let dennis;
let bodyParts = [];
const ELEVATION_OFFSET = 0.6; 

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

// Standard load path with absolutely zero URL modifications
loader.load('dennis_walk.glb', (gltf) => {
    dennis = gltf.scene;
    dennis.position.set(0, ELEVATION_OFFSET, 0);

    dennis.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
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

    if (bodyParts.length > 0) {
        bodyParts.forEach((part) => {
            // Identify and skip core torso mesh
            if (part.geometry && part.geometry.attributes.position.count > 2000) {
                return; 
            }

            // Move front pieces versus back pieces based on local center positions
            const isFrontPiece = part.position.z > 0.01;
            const isBackPiece = part.position.z < -0.01;

            if (isFrontPiece) {
                part.rotation.x = Math.sin(time) * 0.35;
            } else if (isBackPiece) {
                part.rotation.x = -Math.sin(time) * 0.35;
            }
        });
    }

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
