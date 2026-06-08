import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'; // 1. Import Spectator Controls

// Scene & Renderer Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xa5d6a7); 

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 3, 5); // Positioned slightly higher for a spectator viewpoint

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 

renderer.localClippingEnabled = true;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
document.body.appendChild(renderer.domElement);

// 2. Initialize Ghost/Spectator Camera Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Gives a smooth, drifting feel when you look around
controls.dampingFactor = 0.05;
controls.target.set(0, 0.5, 0); // Focuses the camera look-at target onto Dennis

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(5, 8, 5);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 1024;
sunLight.shadow.mapSize.height = 1024;
sunLight.shadow.bias = -0.0005; 
scene.add(sunLight);

// Ground Plane
const floorGeo = new THREE.PlaneGeometry(20, 20);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x81c784, roughness: 0.8 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2; 
floor.position.y = 0;
floor.receiveShadow = true; 
scene.add(floor);

// Group Containers for the Slices
const ELEVATION_OFFSET = 0.5; 
const isWalking = true;

const frontHalfGroup = new THREE.Group();
const backHalfGroup = new THREE.Group();
frontHalfGroup.position.y = ELEVATION_OFFSET;
backHalfGroup.position.y = ELEVATION_OFFSET;
scene.add(frontHalfGroup);
scene.add(backHalfGroup);

// Slice Planes Configuration
const sliceZLocation = 0.1; 
const clipFront = new THREE.Plane(new THREE.Vector3(0, 0, -1), sliceZLocation);
const clipBack = new THREE.Plane(new THREE.Vector3(0, 0, 1), -sliceZLocation);

// Loading Dennis
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
            if (child.material) {
                child.material.roughness = 0.7;
                child.material.metalness = 0.1;
            }
        }
    });

    // Clone 1: The Front Half
    const frontClone = originalModel.clone();
    frontClone.traverse((child) => {
        if (child.isMesh && child.material) {
            child.material = child.material.clone(); 
            child.material.clippingPlanes = [clipFront];
        }
    });
    frontClone.position.set(0, 0, 0); 
    frontHalfGroup.add(frontClone);

    // Clone 2: The Back Half
    const backClone = originalModel.clone();
    backClone.traverse((child) => {
        if (child.isMesh && child.material) {
            child.material = child.material.clone();
            child.material.clippingPlanes = [clipBack];
        }
    });
    backClone.position.set(0, 0, 0); 
    backHalfGroup.add(backClone);

}, undefined, (error) => {
    console.error('Error loading Dennis:', error);
});

// The Animation Loop
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now() * 0.005; 

    // Update spectator controls every frame to handle drifting/panning physics
    controls.update();

    if (frontHalfGroup.children.length > 0 && backHalfGroup.children.length > 0) {
        if (isWalking) {
            frontHalfGroup.rotation.x = Math.sin(time) * 0.25;
            backHalfGroup.rotation.x = -Math.sin(time) * 0.25;

            const bobbing = Math.abs(Math.sin(time * 2)) * 0.05;
            frontHalfGroup.position.y = ELEVATION_OFFSET + bobbing;
            backHalfGroup.position.y = ELEVATION_OFFSET + bobbing;
        } else {
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
