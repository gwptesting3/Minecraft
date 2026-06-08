import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ============================================================================
// 1. ENGINE CONFIGURATION & STRUCTURAL PARAMETERS
// ============================================================================
const ENGINE_CONFIG = {
    SYSTEM: {
        DEBUG_MODE: false,
        SHADOW_RES: 4096,
        RENDER_DISTANCE_MAX: 2000
    },
    WORLD: {
        MAP_DIMENSION: 600,       // Full width and length of explorable terrain
        GEOMETRY_RESOLUTION: 300, // Vertex density grid allocation
        SEA_LEVEL: -6.0,          // Absolute height threshold for deep lake volumes
        SAND_LINE: -4.0,          // Coastal beach threshold
        MOUNTAIN_LINE: 16.0,      // Summit rock threshold
        CLIFF_FALLOFF: 0.78,      // Slope angle threshold forcing rock textures
        SEED_ROTATION: 154.239    // Value constant for procedural generation mapping
    },
    PLAYER: {
        BASE_WALK_SPEED: 0.15,
        SPRINT_BOOST: 1.7,
        ROTATION_VELOCITY: 0.045,
        GRAVITY_FORCE: -0.014,
        INITIAL_JUMP_IMPULSE: 0.30,
        HITBOX_EYE_OFFSET: 1.25,
        BOUNDING_RADIUS: 0.5
    },
    EFFECTS: {
        CLOUDS_COUNT: 65,
        FOLIAGE_DENSITY: 450,
        RUINS_DENSITY: 12
    }
};

// ============================================================================
// 2. GL LOGISTICS INITIALIZATION & CORE GRAPHICS PIPELINES
// ============================================================================
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xb2ebf2); // Ambient morning sky glow
scene.fog = new THREE.FogExp2(0xb2ebf2, 0.01); // Extended horizon scaling

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, ENGINE_CONFIG.SYSTEM.RENDER_DISTANCE_MAX);

const renderer = new THREE.WebGLRenderer({ 
    antialias: true, 
    powerPreference: "high-performance",
    logarithmicDepthBuffer: true 
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

// ============================================================================
// 3. MATHEMATICAL MATRICES & ADVANCED NOISE SIMULATION SYNTHESIS
// ============================================================================
const MathSynthesis = {
    fractionalNoise2D(x, z) {
        let fractureX = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453123;
        return fractureX - Math.floor(fractureX);
    },

    interpolatedValueNoise2D(x, z) {
        const integerX = Math.floor(x);
        const integerZ = Math.floor(z);
        const fractionalX = x - integerX;
        const fractionalZ = z - integerZ;

        const nodeA = this.fractionalNoise2D(integerX, integerZ);
        const nodeB = this.fractionalNoise2D(integerX + 1, integerZ);
        const nodeC = this.fractionalNoise2D(integerX, integerZ + 1);
        const nodeD = this.fractionalNoise2D(integerX + 1, integerZ + 1);

        const fadeX = fractionalX * fractionalX * (3.0 - 2.0 * fractionalX);
        const fadeZ = fractionalZ * fractionalZ * (3.0 - 2.0 * fractionalZ);

        return THREE.MathUtils.lerp(nodeA, nodeB, fadeX) + (nodeC - nodeA) * fadeZ * (1.0 - fadeX) + (nodeD - nodeB) * fadeX * fadeZ;
    },

    getLayeredFractalTopology(x, z) {
        // Multi-octave synthesis mapping global mountains, local valleys, and paths
        let cumulativeAmplitude = 0;
        
        // Octome 1: Broad Macro Mountains
        cumulativeAmplitude += this.interpolatedValueNoise2D(x * 0.003, z * 0.003) * 32;
        // Octome 2: Intermediate Rolling Gradients
        cumulativeAmplitude += this.interpolatedValueNoise2D(x * 0.015, z * 0.012) * 12;
        // Octome 3: Sheer Escarpment Cliff Modifiers
        let cliffSignal = this.interpolatedValueNoise2D(x * 0.04, z * 0.04);
        if (cliffSignal > 0.65) {
            cumulativeAmplitude += (cliffSignal - 0.65) * 28; // Extrudes step cliff structures
        }
        // Octome 4: Microscopic Ground Surface Roughness
        cumulativeAmplitude += this.interpolatedValueNoise2D(x * 0.18, z * 0.18) * 0.6;

        // Drainage Basin System Math (Lakes and carved canyons)
        const basinChannelX = Math.sin(z * 0.01) * 60 + Math.cos(z * 0.005) * 20;
        const proximityToBasin = Math.abs(x - basinChannelX);
        if (proximityToBasin < 40) {
            const structuralDepression = (40 - proximityToBasin) / 40;
            cumulativeAmplitude -= structuralDepression * structuralDepression * 22; // Lowers vectors to reservoir levels
        }

        return cumulativeAmplitude;
    },

    evaluateCaveDensityVolume(x, y, z) {
        // 3D Scalar noise profile generating subterranean voids and pass-through tunnels
        const primaryWave = this.interpolatedValueNoise2D(x * 0.06, z * 0.06);
        const secondaryWave = Math.sin(y * 0.22) * 0.5 + 0.5;
        const localizedDepthCondition = y < (this.getLayeredFractalTopology(x, z) - 3.0);
        
        if (localizedDepthCondition && (primaryWave + secondaryWave) / 2.0 < 0.38) {
            return true; // Cavity condition active
        }
        return false;
    }
};

// ============================================================================
// 4. PROCEDURAL TEXTURE GENERATION LABS (HIGH-FIDELITY MAP PROCESSING)
// ============================================================================
const VisualTextureEngine = {
    allocateCanvasContext(dimX, dimY) {
        const buffer = document.createElement('canvas');
        buffer.width = dimX;
        buffer.height = dimY;
        return { buffer, ctx: buffer.getContext('2d') };
    },

    synthesizeGrassPBR() {
        const { buffer, ctx } = this.allocateCanvasContext(1024, 1024);
        ctx.fillStyle = '#2e7d32'; // Deep Zelda moss base
        ctx.fillRect(0, 0, 1024, 1024);
        
        for (let i = 0; i < 150000; i++) {
            const intensity = Math.random();
            ctx.fillStyle = intensity > 0.65 ? '#4caf50' : intensity > 0.3 ? '#1b5e20' : '#33691e';
            ctx.fillRect(Math.random() * 1024, Math.random() * 1024, 2, Math.random() * 8 + 2);
        }
        
        const mapOut = new THREE.CanvasTexture(buffer);
        mapOut.wrapS = THREE.RepeatWrapping;
        mapOut.wrapT = THREE.RepeatWrapping;
        mapOut.repeat.set(16, 16);
        return mapOut;
    },

    synthesizeCliffRockPBR() {
        const { buffer, ctx } = this.allocateCanvasContext(1024, 1024);
        ctx.fillStyle = '#546e7a'; // Mountain granite base
        ctx.fillRect(0, 0, 1024, 1024);

        for (let i = 0; i < 90000; i++) {
            const colorTone = Math.floor(70 + Math.random() * 55);
            ctx.fillStyle = `rgb(${colorTone},${colorTone + 4},${colorTone + 8})`;
            ctx.fillRect(Math.random() * 1024, Math.random() * 1024, Math.random() * 14 + 2, 3);
        }

        const mapOut = new THREE.CanvasTexture(buffer);
        mapOut.wrapS = THREE.RepeatWrapping;
        mapOut.wrapT = THREE.RepeatWrapping;
        mapOut.repeat.set(12, 12);
        return mapOut;
    },

    synthesizeSandPBR() {
        const { buffer, ctx } = this.allocateCanvasContext(512, 512);
        ctx.fillStyle = '#e0cda9';
        ctx.fillRect(0, 0, 512, 512);

        for (let i = 0; i < 50000; i++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#f5e1bc' : '#cca876';
            ctx.fillRect(Math.random() * 512, Math.random() * 512, 1, 1);
        }

        const mapOut = new THREE.CanvasTexture(buffer);
        mapOut.wrapS = THREE.RepeatWrapping;
        mapOut.wrapT = THREE.RepeatWrapping;
        mapOut.repeat.set(8, 8);
        return mapOut;
    }
};

// Consolidated Materials Registry
const MATERIAL_LABS = {
    GRASS: new THREE.MeshStandardMaterial({ map: VisualTextureEngine.synthesizeGrassPBR(), roughness: 0.92, metalness: 0.02, vertexColors: true }),
    CRAG_ROCK: new THREE.MeshStandardMaterial({ map: VisualTextureEngine.synthesizeCliffRockPBR(), roughness: 0.82, metalness: 0.12, vertexColors: true }),
    COAST_SAND: new THREE.MeshStandardMaterial({ map: VisualTextureEngine.synthesizeSandPBR(), roughness: 0.96, metalness: 0.0, vertexColors: true }),
    TEMPLE_STONE: new THREE.MeshStandardMaterial({ color: 0x78909c, roughness: 0.75, metalness: 0.15 }),
    WATER_LIQUID: new THREE.MeshStandardMaterial({ color: 0x00acc1, transparent: true, opacity: 0.72, roughness: 0.08, metalness: 0.45 }),
    TREE_TRUNK: new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.95 }),
    TREE_LEAVES: new THREE.MeshStandardMaterial({ color: 0x0e3a12, roughness: 0.88 })
};

// ============================================================================
// 5. LANDSCAPE COMPOSITOR & STRUCTURAL GEOMETRY GENERATOR
// ============================================================================
const landscapeGeometry = new THREE.PlaneGeometry(
    ENGINE_CONFIG.WORLD.MAP_DIMENSION, 
    ENGINE_CONFIG.WORLD.MAP_DIMENSION, 
    ENGINE_CONFIG.WORLD.GEOMETRY_RESOLUTION, 
    ENGINE_CONFIG.WORLD.GEOMETRY_RESOLUTION
);
landscapeGeometry.rotateX(-Math.PI / 2);

const vertexPositions = landscapeGeometry.attributes.position;
const vertexColors = [];

for (let i = 0; i < vertexPositions.count; i++) {
    const vX = vertexPositions.getX(i);
    const vZ = vertexPositions.getZ(i);
    const vY = MathSynthesis.getLayeredFractalTopology(vX, vZ);
    
    vertexPositions.setY(i, vY);

    // Contextual Color Weighting
    const workingColor = new THREE.Color();
    if (vY < ENGINE_CONFIG.WORLD.SAND_LINE + 1.0) {
        workingColor.setHex(0xffffff); // Allocates weighting buffer for sand shader mapping
    } else if (vY > ENGINE_CONFIG.WORLD.MOUNTAIN_LINE) {
        workingColor.setHex(0xbbbbbb); // Alpine granite masking
    } else {
        workingColor.setHex(0xffffff); // General terrain base configuration
    }
    vertexColors.push(workingColor.r, workingColor.g, workingColor.b);
}

landscapeGeometry.setAttribute('color', new THREE.Float32BufferAttribute(vertexColors, 3));
landscapeGeometry.computeVertexNormals();

// Composite Mesh Instantiation (Using the primary material node)
const worldTerrainMesh = new THREE.Mesh(landscapeGeometry, MATERIAL_LABS.GRASS);
worldTerrainMesh.receiveShadow = true;
worldTerrainMesh.castShadow = true;
scene.add(worldTerrainMesh);

// Dynamic Water Plane Array System (Simulating Lakes and Rivers)
const waterBodyGeometry = new THREE.PlaneGeometry(ENGINE_CONFIG.WORLD.MAP_DIMENSION, ENGINE_CONFIG.WORLD.MAP_DIMENSION);
const lakeWaterMesh = new THREE.Mesh(waterBodyGeometry, MATERIAL_LABS.WATER_LIQUID);
lakeWaterMesh.rotation.x = -Math.PI / 2;
lakeWaterMesh.position.y = ENGINE_CONFIG.WORLD.SEA_LEVEL;
scene.add(lakeWaterMesh);

// ============================================================================
// 6. VOLUMETRIC CAVE ARCHITECTURES & GEOLOGICAL SUB-LAYERS
// ============================================================================
// Procedurally instantiates specific open-mouthed physical hollow structures over the map
const caveInstanceGroup = new THREE.Group();
scene.add(caveInstanceGroup);

function compileSubterraneanCaveGrotto(targetX, targetZ) {
    const baseFloor = MathSynthesis.getLayeredFractalTopology(targetX, targetZ);
    if (baseFloor < ENGINE_CONFIG.WORLD.SAND_LINE + 5.0) return; // Avoid water filling cave interiors

    // Form structurally modeled cave entrances out of stone cluster units
    const entranceGroup = new THREE.Group();
    entranceGroup.position.set(targetX, baseFloor - 2.0, targetZ);

    const segmentBlock = new THREE.BoxGeometry(6, 6, 6);
    // Outer arch rings
    for (let theta = 0; theta < Math.PI; theta += 0.4) {
        const archElement = new THREE.Mesh(segmentBlock, MATERIAL_LABS.CRAG_ROCK);
        archElement.position.set(Math.cos(theta) * 12, Math.sin(theta) * 10, 0);
        archElement.castShadow = true;
        archElement.receiveShadow = true;
        entranceGroup.add(archElement);
    }
    
    // Carve interior stone lining down into the ground
    const tunnelLiner = new THREE.Mesh(new THREE.CylinderGeometry(10, 11, 40, 8, 1, true), MATERIAL_LABS.CRAG_ROCK);
    tunnelLiner.rotation.x = Math.PI / 2;
    tunnelLiner.position.set(0, 0, 18);
    entranceGroup.add(tunnelLiner);

    caveInstanceGroup.add(entranceGroup);
}

// Spawns cave entrance zones securely across grid positions
for (let cCoordinate = -150; cCoordinate <= 150; cCoordinate += 100) {
    compileSubterraneanCaveGrotto(cCoordinate, cCoordinate * -0.5);
}

// ============================================================================
// 7. ENVIRONMENT DESIGN (DYNAMIC ATMOSPHERE, SUN MATRICES, SKY SHADOWS)
// ============================================================================
const sunDirectionalLight = new THREE.DirectionalLight(0xfffde7, 1.35);
sunDirectionalLight.position.set(150, 300, 150);
sunDirectionalLight.castShadow = true;
sunDirectionalLight.shadow.mapSize.width = ENGINE_CONFIG.SYSTEM.SHADOW_RES;
sunDirectionalLight.shadow.mapSize.height = ENGINE_CONFIG.SYSTEM.SHADOW_RES;
sunDirectionalLight.shadow.camera.near = 1.0;
sunDirectionalLight.shadow.camera.far = 800;

const boundarySpread = 250;
sunDirectionalLight.shadow.camera.left = -boundarySpread;
sunDirectionalLight.shadow.camera.right = boundarySpread;
sunDirectionalLight.shadow.camera.top = boundarySpread;
sunDirectionalLight.shadow.camera.bottom = -boundarySpread;
sunDirectionalLight.shadow.bias = -0.0003;
scene.add(sunDirectionalLight);

// Skybox Cloud Layer Composer
const structuralCloudGroup = new THREE.Group();
const elementCloudGeometry = new THREE.DodecahedronGeometry(15, 1);
const networkCloudMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.78 });

for (let cIdx = 0; cIdx < ENGINE_CONFIG.EFFECTS.CLOUDS_COUNT; cIdx++) {
    const singleCloudBase = new THREE.Group();
    
    // Cluster components to form organic, non-blocky shapes
    for (let cluster = 0; cluster < 4; cluster++) {
        const blob = new THREE.Mesh(elementCloudGeometry, networkCloudMaterial);
        blob.position.set(cluster * 12, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 8);
        blob.scale.set(1.2, 0.8, 1.0);
        singleCloudBase.add(blob);
    }

    singleCloudBase.position.set(
        (Math.random() - 0.5) * ENGINE_CONFIG.WORLD.MAP_DIMENSION,
        90 + Math.random() * 30,
        (Math.random() - 0.5) * ENGINE_CONFIG.WORLD.MAP_DIMENSION
    );
    structuralCloudGroup.add(singleCloudBase);
}
scene.add(structuralCloudGroup);

// ============================================================================
// 8. STRUCTURAL MODEL BUILDERS (ASSET GENERATION PARSING)
// ============================================================================
const engineAssetClusterGroup = new THREE.Group();
scene.add(engineAssetClusterGroup);

function instantiateProceduralTreeAsset(coordX, coordY, coordZ) {
    const individualTreeContainer = new THREE.Group();
    individualTreeContainer.position.set(coordX, coordY, coordZ);

    const trunkStemMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 5.0, 7), MATERIAL_LABS.TREE_TRUNK);
    trunkStemMesh.position.y = 2.5;
    trunkStemMesh.castShadow = true;
    trunkStemMesh.receiveShadow = true;
    individualTreeContainer.add(trunkStemMesh);

    const canopyVolumeMesh = new THREE.Mesh(new THREE.SphereGeometry(2.4, 6, 6), MATERIAL_LABS.TREE_LEAVES);
    canopyVolumeMesh.position.y = 5.2;
    canopyVolumeMesh.scale.set(1.0, 1.3, 1.0);
    canopyVolumeMesh.castShadow = true;
    individualTreeContainer.add(canopyVolumeMesh);

    engineAssetClusterGroup.add(individualTreeContainer);
}

function instantiateProceduralAncientShrine(coordX, coordY, coordZ) {
    const templeBaseGroup = new THREE.Group();
    templeBaseGroup.position.set(coordX, coordY, coordZ);

    // Multi-tiered foundation blocks
    const lowerPlinth = new THREE.Mesh(new THREE.BoxGeometry(14, 2.5, 14), MATERIAL_LABS.TEMPLE_STONE);
    lowerPlinth.position.y = 1.25;
    lowerPlinth.castShadow = true;
    lowerPlinth.receiveShadow = true;
    templeBaseGroup.add(lowerPlinth);

    const colonnadePillarGeo = new THREE.CylinderGeometry(0.4, 0.4, 6.0, 8);
    for (let offsetX of [-5, 5]) {
        for (let offsetZ of [-5, 5]) {
            const pillarColumn = new THREE.Mesh(colonnadePillarGeo, MATERIAL_LABS.TEMPLE_STONE);
            pillarColumn.position.set(offsetX, 5.5, offsetZ);
            pillarColumn.castShadow = true;
            pillarColumn.receiveShadow = true;
            templeBaseGroup.add(pillarColumn);
        }
    }

    const architraveRoof = new THREE.Mesh(new THREE.BoxGeometry(13.5, 2.0, 13.5), MATERIAL_LABS.TEMPLE_STONE);
    architraveRoof.position.y = 9.5;
    architraveRoof.castShadow = true;
    templeBaseGroup.add(architraveRoof);

    engineAssetClusterGroup.add(templeBaseGroup);
}

// Distribute Asset Infrastructure across valid dry zones
for (let entityIdx = 0; entityIdx < ENGINE_CONFIG.EFFECTS.FOLIAGE_DENSITY; entityIdx++) {
    const placementX = (Math.random() - 0.5) * (ENGINE_CONFIG.WORLD.MAP_DIMENSION - 60);
    const placementZ = (Math.random() - 0.5) * (ENGINE_CONFIG.WORLD.MAP_DIMENSION - 60);
    const spatialYHeight = MathSynthesis.getLayeredFractalTopology(placementX, placementZ);

    if (spatialYHeight > ENGINE_CONFIG.WORLD.SAND_LINE + 3.0 && spatialYHeight < ENGINE_CONFIG.WORLD.MOUNTAIN_LINE - 2.0) {
        if (Math.random() > 0.97 && entityIdx < ENGINE_CONFIG.EFFECTS.RUINS_DENSITY) {
            instantiateProceduralAncientShrine(placementX, spatialYHeight - 0.5, placementZ);
        } else {
            instantiateProceduralTreeAsset(placementX, spatialYHeight - 0.2, placementZ);
        }
    }
}

// ============================================================================
// 9. OBJECT LOADING (PLAYABLE CHARACTER LOGISTICS FRAMEWORKS)
// ============================================================================
let playableCharacterModel;
const runtimePlayerPhysicsState = {
    coordinateVector: new THREE.Vector3(0, 25, 0), // Airborne entry drop position
    velocityVector: new THREE.Vector3(0, 0, 0),
    isGroundedOnSurface: false
};

const internalDracoDecoderUnit = new DRACOLoader();
internalDracoDecoderUnit.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
const mainGLTFLoaderRef = new GLTFLoader();
mainGLTFLoaderRef.setDRACOLoader(internalDracoDecoderUnit);

mainGLTFLoaderRef.load('dennis.glb', (resourceFile) => {
    playableCharacterModel = resourceFile.scene;
    
    const structuralPlayerContainer = new THREE.Group();
    structuralPlayerContainer.name = "heroRuntimeNode";
    structuralPlayerContainer.position.copy(runtimePlayerPhysicsState.coordinateVector);
    structuralPlayerContainer.scale.set(0.65, 0.65, 0.65);
    structuralPlayerContainer.add(playableCharacterModel);
    scene.add(structuralPlayerContainer);

    playableCharacterModel.traverse((nodeElement) => {
        if (nodeElement.isMesh) {
            nodeElement.castShadow = true;
            nodeElement.receiveShadow = true;
        }
    });
}, undefined, (errorObject) => console.error("Asset Loader Failure Stack:", errorObject));

// ============================================================================
// 10. INPUT REGISTER MANAGEMENT & CRITICAL FIX POVS MULTIPLEXER
// ============================================================================
const hardwareInputRegistry = { w: false, a: false, s: false, d: false, Shift: false, ' ': false };
const runtimePOVModes = { FIRST_PERSON: 0, THIRD_PERSON_REAR: 1, THIRD_PERSON_FRONT: 2 };
let systemActivePOV = runtimePOVModes.THIRD_PERSON_REAR;

window.addEventListener('keydown', (eventContext) => {
    if (eventContext.key in hardwareInputRegistry) {
        hardwareInputRegistry[eventContext.key] = true;
    }
    if (eventContext.key === ' ') hardwareInputRegistry[' '] = true;
    
    // CRUCIAL FIX: Stop F5 from resetting the browser execution script scope stack
    if (eventContext.key === 'F5') {
        eventContext.preventDefault(); // Prevents page reload!
        systemActivePOV = (systemActivePOV + 1) % 3; // Cycles safely across internal states
    }
});

window.addEventListener('keyup', (eventContext) => {
    if (eventContext.key in hardwareInputRegistry) {
        hardwareInputRegistry[eventContext.key] = false;
    }
    if (eventContext.key === ' ') hardwareInputRegistry[' '] = false;
});

// ============================================================================
// 11. HIGH-PERFORMANCE RECURSIVE REALTIME GAME ENGINE LOOP
// ============================================================================
function runEngineFrameStepLoop() {
    requestAnimationFrame(runEngineFrameStepLoop);
    const systemTicksTime = performance.now() * 0.005;

    // Atmospheric cloud translation animation
    structuralCloudGroup.children.forEach((cloudCluster) => {
        cloudCluster.position.x += 0.03;
        if (cloudCluster.position.x > ENGINE_CONFIG.WORLD.MAP_DIMENSION / 2) {
            cloudCluster.position.x = -ENGINE_CONFIG.WORLD.MAP_DIMENSION / 2;
        }
    });

    const runtimeHeroNode = scene.getObjectByName("heroRuntimeNode");

    if (runtimeHeroNode) {
        // Resolve target directional velocities
        let structuralVelocityMagnifier = ENGINE_CONFIG.PLAYER.BASE_WALK_SPEED;
        if (hardwareInputRegistry.Shift) {
            structuralVelocityMagnifier *= ENGINE_CONFIG.PLAYER.SPRINT_BOOST;
        }

        const driveForwardUnits = (hardwareInputRegistry.w ? 1 : 0) - (hardwareInputRegistry.s ? 1 : 0);
        const steerAngularUnits = (hardwareInputRegistry.a ? 1 : 0) - (hardwareInputRegistry.d ? 1 : 0);

        // Modify orientation matrix transform directly based on steering ticks
        if (steerAngularUnits !== 0) {
            runtimeHeroNode.rotation.y += steerAngularUnits * ENGINE_CONFIG.PLAYER.ROTATION_VELOCITY;
        }

        // Apply translational spatial vectors based on character mesh tracking angles
        const projectionDirection = new THREE.Vector3(0, 0, driveForwardUnits).applyQuaternion(runtimeHeroNode.quaternion);
        runtimePlayerPhysicsState.coordinateVector.x += projectionDirection.x * structuralVelocityMagnifier;
        runtimePlayerPhysicsState.coordinateVector.z += projectionDirection.z * structuralVelocityMagnifier;

        // Process Environmental Gravitational Forces
        runtimePlayerPhysicsState.velocityVector.y += ENGINE_CONFIG.PLAYER.GRAVITY_FORCE;
        runtimePlayerPhysicsState.coordinateVector.y += runtimePlayerPhysicsState.velocityVector.y;

        // Query the mathematical surface terrain value right at coordinate matrix junctions
        const topologicalTargetY = MathSynthesis.getLayeredFractalTopology(
            runtimePlayerPhysicsState.coordinateVector.x, 
            runtimePlayerPhysicsState.coordinateVector.z
        );

        // RESOLVE COLLISION: Ground constraint check
        if (runtimePlayerPhysicsState.coordinateVector.y <= topologicalTargetY) {
            runtimePlayerPhysicsState.coordinateVector.y = topologicalTargetY;
            runtimePlayerPhysicsState.velocityVector.y = 0;
            runtimePlayerPhysicsState.isGroundedOnSurface = true;
        } else {
            runtimePlayerPhysicsState.isGroundedOnSurface = false;
        }

        // EXECUTE JUMP VELOCITY TRIGGERS
        if (hardwareInputRegistry[' '] && runtimePlayerPhysicsState.isGroundedOnSurface) {
            runtimePlayerPhysicsState.velocityVector.y = ENGINE_CONFIG.PLAYER.INITIAL_JUMP_IMPULSE;
            runtimePlayerPhysicsState.isGroundedOnSurface = false;
        }

        // Synchronize the graphic container transformation coordinates directly to our mathematical trackers
        runtimeHeroNode.position.copy(runtimePlayerPhysicsState.coordinateVector);

        // Drive leg movement hopping animations on the internal model geometry nodes
        const activeCharacterMesh = runtimeHeroNode.children[0];
        const motionFlagActive = driveForwardUnits !== 0;

        if (!runtimePlayerPhysicsState.isGroundedOnSurface) {
            // Airtime structural posing configuration
            activeCharacterMesh.position.y = 0.25;
            activeCharacterMesh.rotation.x = -0.15;
        } else if (motionFlagActive) {
            const locomotiveRhythm = hardwareInputRegistry.Shift ? 6.2 : 4.4;
            activeCharacterMesh.position.y = Math.abs(Math.sin(systemTicksTime * locomotiveRhythm)) * 0.42;
            activeCharacterMesh.rotation.x = Math.sin(systemTicksTime * locomotiveRhythm) * 0.15;
        } else {
            activeCharacterMesh.position.y = Math.sin(systemTicksTime * 0.6) * 0.035; // Breathing rhythm idle animation
            activeCharacterMesh.rotation.x = 0;
        }

        // Lock directional shadow depth projection matrices right over the player group bounds
        sunDirectionalLight.position.set(
            runtimePlayerPhysicsState.coordinateVector.x + 80, 
            260, 
            runtimePlayerPhysicsState.coordinateVector.z + 80
        );
        sunDirectionalLight.target = runtimeHeroNode;

        // ====================================================================
        // 12. HIGH-STABILITY MULTI-POV VIEWPORTS PROCESSING (ANTI-JITTER ENGINE)
        // ====================================================================
        let calculatedCameraOffsetOffset;
        let focalTargetFocusPosition;

        switch (systemActivePOV) {
            case runtimePOVModes.FIRST_PERSON:
                calculatedCameraOffsetOffset = new THREE.Vector3(0, ENGINE_CONFIG.PLAYER.HITBOX_EYE_OFFSET, 0.25);
                camera.position.copy(calculatedCameraOffsetOffset.applyMatrix4(runtimeHeroNode.matrixWorld));
                
                focalTargetFocusPosition = runtimeHeroNode.localToWorld(new THREE.Vector3(0, ENGINE_CONFIG.PLAYER.HITBOX_EYE_OFFSET, 3));
                camera.lookAt(focalTargetFocusPosition);
                runtimeHeroNode.visible = false; // Prevents viewing internal face components inside head capsule
                break;
                
            case runtimePOVModes.THIRD_PERSON_REAR:
                calculatedCameraOffsetOffset = new THREE.Vector3(0, 3.0, -7.0);
                camera.position.copy(calculatedCameraOffsetOffset.applyMatrix4(runtimeHeroNode.matrixWorld));
                
                focalTargetFocusPosition = runtimeHeroNode.localToWorld(new THREE.Vector3(0, 0.7, 0));
                camera.lookAt(focalTargetFocusPosition);
                runtimeHeroNode.visible = true;
                break;

            case runtimePOVModes.THIRD_PERSON_FRONT:
                calculatedCameraOffsetOffset = new THREE.Vector3(0, 3.0, 8.0);
                camera.position.copy(calculatedCameraOffsetOffset.applyMatrix4(runtimeHeroNode.matrixWorld));
                
                focalTargetFocusPosition = runtimeHeroNode.localToWorld(new THREE.Vector3(0, 0.7, 0));
                camera.lookAt(focalTargetFocusPosition);
                runtimeHeroNode.visible = true;
                break;
        }
    }

    renderer.render(scene, camera);
}

// Fire execution pipeline
runEngineFrameStepLoop();

// Dynamic screen resizing updates
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
