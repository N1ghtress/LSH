import './style.css'
import * as Three from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

const ENTIRE_SCENE = 0, BLOOM_SCENE = 1;

const bloomLayer = new Three.Layers();
bloomLayer.set(BLOOM_SCENE);

const params = {
	bloomStrength: 3,
	bloomThreshold: 0,
	bloomRadius: 1
};

const darkMaterial = new Three.MeshBasicMaterial({ color: "black" });
const materials = {};

const scene = new Three.Scene();
scene.add(new Three.AmbientLight(0x555555));

const camera = new Three.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 250);
camera.position.set(0, 10, 100);

const renderer = new Three.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
const canvas = renderer.domElement;
document.body.appendChild(canvas);

const renderScene = new RenderPass(scene, camera)

const bloomPass = new UnrealBloomPass(new Three.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.threshold = params.bloomThreshold;
bloomPass.strength = params.bloomStrength;
bloomPass.radius = params.bloomRadius;

const bloomComposer = new EffectComposer(renderer);
bloomComposer.renderToScreen = false;
bloomComposer.addPass(renderScene);
bloomComposer.addPass(bloomPass);

const finalPass = new ShaderPass(
	new Three.ShaderMaterial({
		uniforms: {
			baseTexture: { value: null },
			bloomTexture: { value: bloomComposer.renderTarget2.texture }
		},
		vertexShader: `
			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
			}
		`,
		fragmentShader: `
			uniform sampler2D baseTexture;
			uniform sampler2D bloomTexture;

			varying vec2 vUv;

			void main() {
				gl_FragColor = ( texture2D( baseTexture, vUv ) + vec4( 1.0 ) * texture2D( bloomTexture, vUv ) );
			}
		`,
		defines: {}
	}), "baseTexture"
);
finalPass.needsSwap = true;

const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(renderScene);
finalComposer.addPass(finalPass);

window.onresize = function () {
	const width = window.innerWidth;
	const height = window.innerHeight;

	camera.aspect = width / height;
	camera.updateProjectionMatrix();

	renderer.setSize(width, height);

	bloomComposer.setSize(width, height);
	finalComposer.setSize(width, height);

	render();
};

sceneSetup();

var sunRadius;
var sunCenterY;

var rectYVel;
var initialHeight;
var heightDelta;

var blackRectTab;
var rectHeightTab;

function sceneSetup() {
	// Sun
	sunRadius = 60;
	sunCenterY = 60;
	const sunMat = new Three.ShaderMaterial({
		uniforms: {
			color1: { value: new Three.Color(0xFF00AA) },
			color2: { value: new Three.Color(0xFFFF00) }
		},
		vertexShader: `
			varying vec2 vUv;

			void main() {
				vUv = uv;
				gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			}`,
		fragmentShader: `
			uniform vec3 color1;
			uniform vec3 color2;

			varying vec2 vUv;

			void main() {
				gl_FragColor = vec4(mix(color1, color2, 0.75 * vUv.y + 0.25 * vUv.x), 1.0);
			}`
	});

	const sunCircle = new Three.CircleGeometry(sunRadius, 100, 0, 2 * Math.PI);

	const sun = new Three.Mesh(sunCircle, sunMat);

	sun.position.set(0, sunCenterY, -100.1);
	scene.add(sun);

	// Sun animation
	rectYVel = 0.2;
	initialHeight = 0;
	heightDelta = rectYVel / 10;
	rectHeightTab = [0, 1.2, 2.4, 3.6, 4.8];

	const blackMat = new Three.MeshBasicMaterial({
		color: 0x000000,
		side: Three.DoubleSide,
	});

	const rect = new Three.PlaneGeometry(120, 1);

	blackRectTab = [new Three.Mesh(rect, blackMat), new Three.Mesh(rect, blackMat), new Three.Mesh(rect, blackMat), new Three.Mesh(rect, blackMat), new Three.Mesh(rect, blackMat)]
	for (let i = 0; i < blackRectTab.length; i++) {
		const rect = blackRectTab[i];
		rect.position.set(0, sunCenterY - ((sunRadius / blackRectTab.length + 1) * i), -100);
		scene.add(rect);
	}

	// Neon pink grid
	const pinkLineMat = new Three.LineBasicMaterial({
		color: 0xFF00AA,
	});

	for (let z = 100; z >= -100; z -= 10) {
		const points = [];
		points.push(new Three.Vector3(-500, 0, z));
		points.push(new Three.Vector3(500, 0, z));

		const gridLine = new Three.BufferGeometry().setFromPoints(points);

		const neonLine = new Three.Line(gridLine, pinkLineMat);
		neonLine.layers.enable(BLOOM_SCENE);
		scene.add(neonLine);
	}
	for (let x = -500; x <= 500; x += 10) {
		const points = [];
		points.push(new Three.Vector3(x, 0, -100));
		points.push(new Three.Vector3(x, 0, 100));

		const gridLine = new Three.BufferGeometry().setFromPoints(points);

		const neonLine = new Three.Line(gridLine, pinkLineMat);
		neonLine.layers.enable(BLOOM_SCENE);
		scene.add(neonLine);
	}

	render();
}

function render() {
	for (let i = 0; i < blackRectTab.length; i++) {
		const rect = blackRectTab[i];
		rectHeightTab[i] += heightDelta;
		rect.scale.y = rectHeightTab[i];
		if (rect.position.y <= sunCenterY - sunRadius - rectHeightTab[i] / 2) {
			rectHeightTab[i] = initialHeight;
			rect.scale.y = rectHeightTab[i];
			rect.position.y = sunCenterY;
		}
		rect.position.y -= rectYVel;
	}
	renderBloom();
	finalComposer.render();
	requestAnimationFrame(render);
}

function renderBloom() {
	scene.traverse(darkenNonBloomed);
	bloomComposer.render();
	scene.traverse(restoreMaterial);

}

function darkenNonBloomed(obj) {
	if (obj.isMesh && bloomLayer.test(obj.layers) === false) {
		materials[obj.uuid] = obj.material;
		obj.material = darkMaterial;
	}
}

function restoreMaterial(obj) {
	if (materials[obj.uuid]) {
		obj.material = materials[obj.uuid];
		delete materials[obj.uuid];
	}
}