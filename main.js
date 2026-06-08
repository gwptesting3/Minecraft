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
renderer.localClippingEnabled = true; // Crucial for Option 1 slicing
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

// 5. Group Containers for Slices
const ELEVATION_OFFSET = 0.5; 
const frontHalfGroup = new THREE.Group();
const backHalfGroup = new THREE.Group();
frontHalfGroup.position.y = ELEVATION_OFFSET;
backHalfGroup.position.y = ELEVATION_OFFSET;
scene.add(frontHalfGroup);
scene.add(backHalfGroup);

// Slicing Planes (Facing opposite directions)
const clipFront = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
const clipBack = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

// 6. Loading Dennis
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

loader.load('dennis.glb', (gltf) => {
    const originalModel = gltf.scene;

    originalModel.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    // Setup Front Half Mesh
    const frontClone = originalModel.clone();
    frontClone.traverse((child) => {
        if (child.isMesh && child.material) {
            child.material = child.material.clone(); 
            child.material.clippingPlanes = [clipFront];
        }
    });
    frontHalfGroup.add(frontClone);

    // Setup Back Half Mesh
    const backClone = originalModel.clone();
    backClone.traverse((child) => {
        if (child.isMesh && child.material) {
            child.material = child.material.clone();
            child.material.clippingPlanes = [clipBack];
        }
    });
    backHalfGroup.add(backClone);

}, undefined, (error) => {
    console.error('Error loading Dennis:', error);
});

// 7. Animation Loop
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now() * 0.004; 
    controls.update();

    if (frontHalfGroup.children.length > 0 && backHalfGroup.children.length > 0) {
        // Slide them back and forth like sliding blocks
        const slideOffset = Math.sin(time) * 0.15;
        
        frontHalfGroup.position.z = slideOffset;
        backHalfGroup.position.z = -slideOffset;

        // FIX: Update clipping plane constants dynamically so the cut stays perfectly 
        // pinned to the world center (0), preventing the overlaps seen in your screenshot!
        clipFront.constant = slideOffset;
        clipBack.constant = -slideOffset;

        // Classic bouncy step bobbing
        const bobbing = Math.abs(Math.sin(time * 2)) * 0.05;
        frontHalfGroup.position.y = ELEVATION_OFFSET + bobbing;
        backHalfGroup.position.y = ELEVATION_OFFSET + bobbing;
    }

    renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
