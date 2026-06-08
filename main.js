import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// 1. Scene & Renderer Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa5d6a7); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2.5, 4.5);
camera.lookAt(0, 0.5, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 

// CRITICAL FOR OPTION 2: Tell the renderer to respect clipping planes
renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
document.body.appendChild(renderer.domElement);

// 2. Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(5, 8, 5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
sunLight.shadow.bias = -0.0005; 
scene.add(sunLight);

// 3. Ground Plane
const floorGeo = new THREE.PlaneGeometry(20, 20);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x81c784, roughness: 0.8 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2; 
floor.position.y = 0;
floor.receiveShadow = true; 
scene.add(floor);

// 4. Group Containers for the Slices
// Adjusting ELEVATION_OFFSET lifts Dennis's base mesh out of the grass floor completely!
const ELEVATION_OFFSET = 0.5; 
const isWalking = true;

const frontHalfGroup = new THREE.Group();
const backHalfGroup = new THREE.Group();
frontHalfGroup.position.y = ELEVATION_OFFSET;
backHalfGroup.position.y = ELEVATION_OFFSET;
scene.add(frontHalfGroup);
scene.add(backHalfGroup);

// Define Slice Planes along the Z-axis (front-to-back slicing)
const sliceZLocation = 0.1; // Adjust this if the slice cut isn't perfectly between his front and back legs
const clipFront = new THREE.Plane(new THREE.Vector3(0, 0, -1), sliceZLocation);
const clipBack = new THREE.Plane(new THREE.Vector3(0, 0, 1), -sliceZLocation);

// 5. Loading Dennis & Creating Clones
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

loader.load('dennis.glb', (gltf) => {
    const originalModel = gltf.scene;

    // Fix shadows and materials on the original hierarchy before cloning
    originalModel.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) {
                child.material.roughness = 0.7;
                child.material.metalness = 0.1;
            }
        }
    });

    // Clone 1: The Front Half (Head, Chest, Front Legs)
    const frontClone = originalModel.clone();
    frontClone.traverse((child) => {
        if (child.isMesh && child.material) {
            child.material = child.material.clone(); // Clone material so clipping only affects this half
            child.material.clippingPlanes = [clipFront];
        }
    });
    // Set the pivot center point for the front leg swing
    frontClone.position.set(0, 0, 0); 
    frontHalfGroup.add(frontClone);

    // Clone 2: The Back Half (Hips, Back Legs, Tail)
    const backClone = originalModel.clone();
    backClone.traverse((child) => {
        if (child.isMesh && child.material) {
            child.material = child.material.clone();
            child.material.clippingPlanes = [clipBack];
        }
    });
    // Set the pivot center point for the back leg swing
    backClone.position.set(0, 0, 0); 
    backHalfGroup.add(backClone);

}, undefined, (error) => {
    console.error('Error loading Dennis:', error);
});

// 6. The Animation Loop (Option 2: True Limb Swing via Code Splitting)
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now() * 0.005; 

    if (frontHalfGroup.children.length > 0 && backHalfGroup.children.length > 0) {
        if (isWalking) {
            // Front segments rotate opposite to back segments to simulate alternating legs walking!
            frontHalfGroup.rotation.x = Math.sin(time) * 0.25;
            backHalfGroup.rotation.x = -Math.sin(time) * 0.25;

            // Smooth body bobbing up and down together safely above the ground
            const bobbing = Math.abs(Math.sin(time * 2)) * 0.05;
            frontHalfGroup.position.y = ELEVATION_OFFSET + bobbing;
            backHalfGroup.position.y = ELEVATION_OFFSET + bobbing;
        } else {
            // Idle position
            frontHalfGroup.rotation.x = 0;
            backHalfGroup.rotation.x = 0;
            frontHalfGroup.position.y = ELEVATION_OFFSET;
            backHalfGroup.position.y = ELEVATION_OFFSET;
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
