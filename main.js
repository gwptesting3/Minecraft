import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 1. Basic Setup
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

camera.position.set(0, 2, 5);

// 2. Variables for Dennis and his Limbs
let dennis, head, legFL, legFR, legBL, legBR;
let isWalking = true; // Set to false to see the idle look

// 3. Load the Model
const loader = new GLTFLoader();
loader.load('dennis.glb', (gltf) => {
    dennis = gltf.scene;
    scene.add(dennis);

    // AI meshes often have distinct sub-names. 
    // We traverse the model to find parts containing keywords.
    dennis.traverse((child) => {
        if (child.isMesh || child.isGroup) {
            const name = child.name.toLowerCase();
            if (name.includes('head')) head = child;
            if (name.includes('leg') || name.includes('paw')) {
                if (name.includes('front') && name.includes('left')) legFL = child;
                if (name.includes('front') && name.includes('right')) legFR = child;
                if (name.includes('back') && name.includes('left')) legBL = child;
                if (name.includes('back') && name.includes('right')) legBR = child;
            }
        }
    });

    // Fallback: If the AI didn't name them nicely, log all names to your browser console
    console.log("Found body parts:", { head, legFL, legFR, legBL, legBR });
}, undefined, (error) => {
    console.error('Error loading Dennis:', error);
});

// 4. The Animation Loop (Safe on Laptop Hardware!)
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now() * 0.006; // Control speed here

    if (dennis) {
        if (isWalking) {
            // Swing legs back and forth using a simple sine wave
            if (legFL) legFL.rotation.x = Math.sin(time) * 0.4;
            if (legBR) legBR.rotation.x = Math.sin(time) * 0.4;

            if (legFR) legFR.rotation.x = -Math.sin(time) * 0.4;
            if (legBL) legBL.rotation.x = -Math.sin(time) * 0.4;

            // Make Dennis's whole body bob slightly up and down
            dennis.position.y = Math.abs(Math.sin(time * 2)) * 0.1;
        } else {
            // Idle breathing animation
            if (head) head.rotation.y = Math.sin(time * 0.3) * 0.1;
            // Reset legs to straight
            if (legFL) legFL.rotation.x = 0;
            if (legFR) legFR.rotation.x = 0;
            if (legBL) legBL.rotation.x = 0;
            if (legBR) legBR.rotation.x = 0;
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
