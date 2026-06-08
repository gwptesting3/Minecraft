import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// 1. Scene & Renderer Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x81d4fa); // Sunny Zelda sky
scene.fog = new THREE.FogExp2(0x81d4fa, 0.015); // Fog for realistic distance scale

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
document.body.appendChild(renderer.domElement);

// 2. Realistic Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); 
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfffde7, 1.4); 
sunLight.position.set(40, 80, 40);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
const d = 150;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
scene.add(sunLight);

// 3. Procedural Coded Zelda Terrain (Realistic & Continuous)
const terrainSize = 300; 
const segments = 120; 

// A massive detailed mesh plane
const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
terrainGeo.rotateX(-Math.PI / 2); // Flip flat on the floor

const positions = terrainGeo.attributes.position;
const colors = [];

// Realistic Height Function (Generates hills, valleys, and riverbeds)
function getHeight(x, z) {
    // Large structural mountains
    let y = Math.sin(x * 0.015) * Math.cos(z * 0.015) * 8;
    // Medium rolling hills
    y += Math.sin(x * 0.05) * Math.sin(z * 0.05) * 3;
    // Small micro-detail roughness
    y += Math.cos(x * 0.2) * Math.sin(z * 0.2) * 0.4;
    
    // Create a winding river valley down the center
    const riverBed = Math.sin(x * 0.02 + z * 0.01) * 10;
    if (Math.abs(z - riverBed) < 15) {
        y -= (15 - Math.abs(z - riverBed)) * 0.5; // Carve into the earth
    }
    return y;
}

// Reshape the plane and calculate realistic vertex colors based on slopes/height
for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const y = getHeight(x, z);
    positions.setY(i, y);

    // Color logic
    const color = new THREE.Color();
    if (y < -2) {
        // Sandy Riverbeds
        color.setHex(0xd7ccc8); 
    } else if (y > 6) {
        // Rocky mountain peaks
        color.setHex(0x90a4ae); 
    } else {
        // Lush green valleys (slight random variation for realism)
        const greenTone = 0.4 + Math.random() * 0.15;
        color.setRGB(greenTone * 0.6, greenTone, greenTone * 0.4);
    }
    colors.push(color.r, color.g, color.b);
}

terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
terrainGeo.computeVertexNormals(); // Recompute lighting data for smooth slopes

const terrainMat = new THREE.MeshStandardMaterial({ 
    vertexColors: true,
    roughness: 0.9,
    metalness: 0.05
});

const terrain = new THREE.Mesh(terrainGeo, terrainMat);
terrain.receiveShadow = true;
scene.add(terrain);

// Add a flat, semi-transparent realistic water plane in the valleys
const waterGeo = new THREE.PlaneGeometry(terrainSize, terrainSize);
const waterMat = new THREE.MeshStandardMaterial({
    color: 0x00bcd4,
    transparent: true,
    opacity: 0.6,
    roughness: 0.2
});
const water = new THREE.Mesh(waterGeo, waterMat);
water.rotation.x = -Math.PI / 2;
water.position.y = -3.5; // Sits inside the carved riverbeds
scene.add(water);

// 4. Loading Dennis (The Playable Hero)
let dennis;

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

loader.load('dennis.glb', (gltf) => {
    dennis = gltf.scene;
    
    const dennisWrapper = new THREE.Group();
    dennisWrapper.position.set(0, 0, 0); // Spawns at center
    dennisWrapper.scale.set(0.8, 0.8, 0.8);
    dennisWrapper.name = "dennisRoot";
    scene.add(dennisWrapper);

    dennisWrapper.add(dennis); 
    
    dennis.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
}, undefined, (error) => {
    console.error('Error loading hero Dennis:', error);
});

// 5. Input & Camera POV System
const keys = { w: false, a: false, s: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
const povs = { FIRST_PERSON: 0, THIRD_PERSON_REAR: 1, THIRD_PERSON_FRONT: 2 };
let currentPOV = povs.THIRD_PERSON_REAR; 

window.addEventListener('keydown', (e) => { 
    if (e.key in keys) keys[e.key] = true; 
    if (e.key === 'F5') { currentPOV = (currentPOV + 1) % 3; }
});
window.addEventListener('keyup', (e) => { if (e.key in keys) keys[e.key] = false; });

// 6. Game Animation & Control Loop
const moveSpeed = 0.12;
const rotationSpeed = 0.04;

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now() * 0.005;
    const dennisRoot = scene.getObjectByName("dennisRoot");

    if (dennisRoot) {
        let isMoving = false;

        // Apply movement/rotation
        if (keys.w || keys.ArrowUp) { dennisRoot.translateZ(moveSpeed); isMoving = true; }
        if (keys.s || keys.ArrowDown) { dennisRoot.translateZ(-moveSpeed); isMoving = true; }
        if (keys.a || keys.ArrowLeft) { dennisRoot.rotation.y += rotationSpeed; }
        if (keys.d || keys.ArrowRight) { dennisRoot.rotation.y -= rotationSpeed; }

        // REAL-TIME CLIMBING: Dynamically snap Dennis's height to the hills underneath him
        const currentTerrainHeight = getHeight(dennisRoot.position.x, dennisRoot.position.z);
        dennisRoot.position.y = currentTerrainHeight + 0.4; // Adds a small standing offset

        const dennisMesh = dennisRoot.children[0]; 

        // Visual bounce animation setup
        if (isMoving) {
            const hopHeight = Math.abs(Math.sin(time * 3.5)) * 0.35;
            dennisMesh.position.y = hopHeight; 
            dennisMesh.rotation.x = Math.sin(time * 3.5) * 0.12;
        } else {
            dennisMesh.position.y = Math.sin(time * 0.5) * 0.03; 
            dennisMesh.rotation.x = 0;
        }

        // --- Multi-POV Stabilized Camera Logic ---
        let relativeCameraOffset;
        let lookAtTarget;

        switch (currentPOV) {
            case povs.FIRST_PERSON:
                relativeCameraOffset = new THREE.Vector3(0, 1.2, 0); 
                camera.position.copy(relativeCameraOffset.applyMatrix4(dennisRoot.matrixWorld));
                lookAtTarget = dennisRoot.localToWorld(new THREE.Vector3(0, 1.2, 1));
                camera.lookAt(lookAtTarget);
                dennisRoot.visible = false; 
                break;

            case povs.THIRD_PERSON_REAR:
                relativeCameraOffset = new THREE.Vector3(0, 2.5, -5.5);
                camera.position.copy(relativeCameraOffset.applyMatrix4(dennisRoot.matrixWorld));
                lookAtTarget = dennisRoot.localToWorld(new THREE.Vector3(0, 0.6, 0));
                camera.lookAt(lookAtTarget);
                dennisRoot.visible = true; 
                break;

            case povs.THIRD_PERSON_FRONT:
                relativeCameraOffset = new THREE.Vector3(0, 2.5, 7.5); 
                camera.position.copy(relativeCameraOffset.applyMatrix4(dennisRoot.matrixWorld));
                lookAtTarget = dennisRoot.localToWorld(new THREE.Vector3(0, 0.6, 0));
                camera.lookAt(lookAtTarget);
                dennisRoot.visible = true; 
                break;
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
