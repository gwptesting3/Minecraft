import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js'; // 1. Import Draco

// Basic Setup
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

// Variables for Dennis and his Limbs
let dennis, head, legFL, legFR, legBL, legBR;
let isWalking = true; 

// 2. Set up the DRACOLoader
const dracoLoader = new DRACOLoader();
// This points to Google's official hosted decoder libraries
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

// 3. Set up the GLTFLoader and link the DRACOLoader to it
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

// 4. Load the Model
loader.load('dennis.glb', (gltf) => {
    dennis = gltf.scene;
    scene.add(dennis);
    dennis.position.set(0, 0, 0);

    console.log("--- START OF MODEL PIECES ---");
    dennis.traverse((child) => {
        if (child.name) {
            // This prints every part name to your browser console
            console.log("Part Name Found:", child.name); 
            
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
    console.log("--- END OF MODEL PIECES ---");

    console.log("Assigned parts:", { head, legFL, legFR, legBL, legBR });
}, undefined, (error) => {
    console.error('Error loading Dennis:', error);
});

// The Animation Loop
function animate() {
    requestAnimationFrame(animate);

    const time = performance.now() * 0.006; 

    if (dennis) {
        if (isWalking) {
            // Swing legs back and forth
            if (legFL) legFL.rotation.x = Math.sin(time) * 0.4;
            if (legBR) legBR.rotation.x = Math.sin(time) * 0.4;

            if (legFR) legFR.rotation.x = -Math.sin(time) * 0.4;
            if (legBL) legBL.rotation.x = -Math.sin(time) * 0.4;

            // Whole body bobbing
            dennis.position.y = Math.abs(Math.sin(time * 2)) * 0.1;
        } else {
            // Idle
            if (head) head.rotation.y = Math.sin(time * 0.3) * 0.1;
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
