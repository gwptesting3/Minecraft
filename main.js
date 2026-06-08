import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Scene & Renderer Setup
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

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.5, 0);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6); 
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(5, 8, 5);
sunLight.castShadow = true;
scene.add(sunLight);

// Floor
const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x81c784, roughness: 0.8 })
);
floor.rotation.x = -Math.PI / 2; 
floor.receiveShadow = true; 
scene.add(floor);

// 1. Custom Material Configuration (The Secret Sauce)
let customUniforms = {
    uTime: { value: 0 }
};

let dennis;
const ELEVATION_OFFSET = 0.5; // Change this value to raise or lower him on the grass!

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

loader.load('dennis.glb', (gltf) => {
    dennis = gltf.scene;
    dennis.position.set(0, ELEVATION_OFFSET, 0);

    dennis.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            // Intercept his material and inject a custom shader modifier
            child.material.onBeforeCompile = (shader) => {
                shader.uniforms.uTime = customUniforms.uTime;

                // Inject math code directly into the GPU pipeline to bend his body smoothly
                shader.vertexShader = `
                    uniform float uTime;
                ` + shader.vertexShader;

                shader.vertexShader = shader.vertexShader.replace(
                    '#include <begin_vertex>',
                    `
                    #include <begin_vertex>
                    
                    // Wave calculation based on how far forward or back the vertex is (position.z)
                    float wave = sin(uTime * 8.0 + transformed.z * 5.0) * 0.12;
                    
                    // Smoothly apply the lateral bend to the x-coordinates of his mesh
                    transformed.x += wave * smoothstep(0.0, 0.5, abs(transformed.z));
                    `
                );
            };
        }
    });

    scene.add(dennis);
}, undefined, (error) => {
    console.error(error);
});

// Animation Loop
function animate() {
    requestAnimationFrame(animate);
    
    const time = performance.now() * 0.001;
    controls.update();

    // Update the shader time uniform to drive the running fluid motion
    customUniforms.uTime.value = time;

    if (dennis) {
        // Subtle overall body bobbing to accent the runtime stride
        dennis.position.y = ELEVATION_OFFSET + Math.abs(sin(time * 8.0)) * 0.04;
    }

    renderer.render(scene, camera);
}

// Global math helper function missing in vanilla JS loop scope
function sin(x) { return Math.sin(x); }

animate();

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
