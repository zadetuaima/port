import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
/* ===================== 3D "Stuff I've Built" ===================== */
let zCounter = 1000; // for stacking terminals + popups

// Coarse-pointer / small-screen detection. Used to switch from the
// floating-window desktop metaphor to a stacked, touch-friendly layout.
const IS_MOBILE =
  window.matchMedia("(max-width: 768px)").matches ||
  window.matchMedia("(hover: none) and (pointer: coarse)").matches;

// Videos are marked autoplay for desktop hover previews; on mobile that
// means every popup blasts sound/motion the moment it opens, so strip it.
// Only touch videos that have their own controls — a few decorative clips
// (e.g. bibigo Media2, action-audio media1) have no controls at all and
// are meant to loop as a background element, so leave those alone.
function disableAutoplayOnMobile(container) {
  if (!IS_MOBILE) return;
  container.querySelectorAll("video[autoplay][controls]").forEach((v) => {
    v.removeAttribute("autoplay");
    v.pause();
    v.currentTime = 0;
  });
}

/* =========================================================
   Terminal + Popup Logic
   ========================================================= */

const Z_BASE_TERMINAL = 1000;   // all terminal-style windows
const Z_BASE_CONTENT = 5000;    // all txt/mp4/md windows (always above)
let topTerminalZ = Z_BASE_TERMINAL;
let topContentZ = Z_BASE_CONTENT;

function isContentWindow(win) {
  return (
    win.classList.contains("window-textedit") ||
    win.classList.contains("window-mp4") ||
    win.classList.contains("window-md")
  );
}

// "Terminal popup" = .window that is NOT txt/mp4/md (e.g. stuff_ive_built.js)
function isTerminalPopup(win) {
  return win.classList.contains("window") && !isContentWindow(win);
}

function bringToFront(win) {
  if (isContentWindow(win)) {
    topContentZ += 1;
    win.style.zIndex = topContentZ;
  } else {
    topTerminalZ += 1;
    win.style.zIndex = topTerminalZ;
  }
}

function ensureFixedPosition(win) {
  if (win.dataset.dragInit) return;

  const rect = win.getBoundingClientRect();
  win.style.position = "fixed";
  win.style.left = rect.left + "px";
  win.style.top = rect.top + "px";
  win.style.width = rect.width + "px";
  win.style.height = rect.height + "px";
  win.style.margin = "0";
  win.style.transform = "none";
  win.dataset.dragInit = "1";
}

function snapTerminalPopupToTop(win) {
  if (!isTerminalPopup(win)) return;
  // On mobile, popups are full-screen modals — no docking/snapping.
  if (IS_MOBILE) return;

  ensureFixedPosition(win);

  // dock just under the macOS bar
  const paddingTop = 32; // bar ~26px; gives a little breathing room
  win.style.top = paddingTop + "px";

  // keep current left if defined, else center it
  if (!win.style.left) {
    const rect = win.getBoundingClientRect();
    const centeredLeft = Math.max(
      10,
      (window.innerWidth - rect.width) / 2
    );
    win.style.left = centeredLeft + "px";
    win.style.transform = "none";
  }

  bringToFront(win); // stays below txt/mp4/md because of separate ranges
}


function initStuffIveBuilt(root) {
  if (!root) return;

  // ------------ basic setup ------------

  const getSize = () => ({
    width: root.clientWidth || 1000,
    height: root.clientHeight || 800,
  });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);

  const { width, height } = getSize();
  const camera = new THREE.PerspectiveCamera(35, width / height, 0.1, 100);

  // The gallery spreads objects across roughly this half-width/height (world
  // units) around the origin. On narrow (portrait/mobile) aspect ratios the
  // horizontal FOV is much tighter than the vertical one, so a fixed camera
  // distance either clips the outer objects on phones or sits too far back
  // on desktop. Deriving distance from the live aspect ratio keeps desktop
  // framing tight while pulling back just enough on narrow screens.
  const GALLERY_HALF_WIDTH = 3.3;
  const GALLERY_HALF_HEIGHT = 1.7;
  const CAMERA_MIN_DIST = 9.2;
  const CAMERA_MAX_DIST = 14;

  function computeCameraDistance(aspect) {
    const halfFovRad = THREE.MathUtils.degToRad(camera.fov / 2);
    const distForHeight = GALLERY_HALF_HEIGHT / Math.tan(halfFovRad);
    const distForWidth = GALLERY_HALF_WIDTH / (Math.tan(halfFovRad) * aspect);
    const dist = Math.max(distForHeight, distForWidth);
    return Math.min(CAMERA_MAX_DIST, Math.max(CAMERA_MIN_DIST, dist));
  }

  camera.position.set(0, 1.2, computeCameraDistance(camera.aspect));

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  // Cap DPR: phones often report 3x, which tanks perf on a WebGL scene.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // Let our custom drag-to-rotate own touch gestures instead of the page
  // scrolling/zooming underneath the canvas.
  renderer.domElement.style.touchAction = "none";
  root.appendChild(renderer.domElement);

  // ------------ lights ------------

  scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
  const dirLight = new THREE.DirectionalLight(0xffffff, 2);
  dirLight.position.set(-3, 10, -10);
  scene.add(dirLight);

  // ------------ controls ------------

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enableRotate = true;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.target.copy(scene.position);

  // ------------ tooltip + connectors (scoped) ------------

  const tooltip = document.createElement("div");
  tooltip.id = "siv-tooltip";
  tooltip.classList.add("hidden");
  tooltip.innerHTML = `
    <div class="content">
      <div class="siv-content-box">
        <span id="siv-tip-close">&times;</span>

        <div class="siv-tip-block" data-tip="obj1">
          <div class="tip-h-con">
            <h1>Mixer</h1>
            <label>
              <input type="checkbox" id="keep-texture-chk-1" />
              Keep texture visible
            </label>
          </div>
          <p>Circuit bent 1980's video processor, mixing video and sync signals to provide iridescent and glitchy visuals. Audio signals also injected using a vactrol.</p>
          <div class="videojs1">
            <video autoplay controls muted loop src="/videos/IMG_1525.mp4"></video>
          </div>
          <div class="videojs2">
            <img src="/img/IMG_1538.jpeg">
            <video autoplay controls muted loop src="/videos/ProCameraVideoFile.mp4"></video>
          </div>
          <div class="videojsimg">
            <img src="/img/IMG_0680.jpeg">
          </div>
        </div>

        <div class="siv-tip-block" data-tip="obj2">
          <div class="tip-h-con">
            <h1>CRT TV Oscilloscope</h1>
            <label>
              <input type="checkbox" id="keep-texture-chk-2" />
              Keep texture visible
            </label>
          </div>
          <p>CRT TV reworked as an oscilloscope. External audio injected to produce audio waveforms.</p>
          <div class="boilerroom-img-2">
            <video autoplay controls muted loop src="/videos/CRTTVVid.mp4"></video>
          </div>        
        </div>

        <div class="siv-tip-block" data-tip="obj3">
          <div class="tip-h-con">
            <h1>Typewriter Instrument</h1>
            <label>
              <input type="checkbox" id="keep-texture-chk-3" />
              Keep texture visible
            </label>
          </div>
          <p></p>
          <div class="boilerroom-img-2">
            <video autoplay controls muted loop src="/videos/MicrosoftTeams-video.mp4"></video>
          </div>
        </div>

        <div class="siv-tip-block" data-tip="obj4">
          <div class="tip-h-con">
            <h1>Circuit Bent Camcorder</h1>
            <label>
              <input type="checkbox" id="keep-texture-chk-4" />
              Keep texture visible
            </label>
          </div>
          <p>Circuit bent camcorder. Interal flex cable passed through custom built signal splitter. Switches patched onto bend point giving the user 4 different toggles for crazy colour combination.</p>
          <div class="videojsimg">
            <img src="/img/IMG_2503.jpg">
          </div>
          <div class="videojs2">
            <img src="/img/IMG_2495.jpeg">
            <img src="/img/IMG_2505.jpg">
          </div>
          </div>

        <div class="siv-tip-block" data-tip="obj5">
          <div class="tip-h-con">
            <h1>Smart Pint Glass</h1>
            <label>
              <input type="checkbox" id="keep-texture-chk-5" />
              Keep texture visible
            </label>
          </div>
          <p>Smart pint glass detection fluid level via changing capacitance. Once fluid reaches 125ml, external device is notified and orders another drink to be bought to your table.</p>
        
          <div class="videojsimg">
            <img src="/img/beerglass.png">
          </div>
          <div class="videojs1">
            <video autoplay controls muted loop src="/videos/IMG_1357.mov"></video>
          </div>
        </div>
        <div class="siv-tip-block" data-tip="obj6">
          <div class="tip-h-con">
            <h1>Smart Connect</h1>
            <label>
              <input type="checkbox" id="keep-texture-chk-6" />
              Keep texture visible
            </label>
          </div>
          <p>A wearable Bluetooth wristband accesory, when two user are wearing it and they shake hands, their details are automatically exchanged.</p>
          <div class="videojs1">
            <video autoplay controls muted loop src="/smart-connect/media1.mp4"></video>
          </div>
          <div class="videojs2">
            <img src="/smart-connect/devices.jpg">
            <img src="/smart-connect/wrist.jpg">
          </div>
        </div>
        <div class="siv-tip-block" data-tip="obj7">
          <div class="tip-h-con">
            <h1>chopstickprototype_V1</h1>
            <label>
              <input type="checkbox" id="keep-texture-chk-7" />
              Keep texture visible
            </label>
          </div>
          <p>Rapid prototype for scrollable chopstick, testing feasablity and technical path.</p>
          <div class="videojsimg">
            <img src="/img/IMG_0809.jpeg"
          </div>
          <div class="videojs2">

          </div>
        </div>
      </div>
    </div>
  `;
  root.appendChild(tooltip);
  disableAutoplayOnMobile(tooltip);

  const tipClose = tooltip.querySelector("#siv-tip-close");
  const tipBlocks = tooltip.querySelectorAll(".siv-tip-block");
  const chk1 = tooltip.querySelector("#keep-texture-chk-1");
  const chk2 = tooltip.querySelector("#keep-texture-chk-2");
  const chk3 = tooltip.querySelector("#keep-texture-chk-3");
  const chk4 = tooltip.querySelector("#keep-texture-chk-4");
  const chk5 = tooltip.querySelector("#keep-texture-chk-5");
  const chk6 = tooltip.querySelector("#keep-texture-chk-6");
  const chk7 = tooltip.querySelector("#keep-texture-chk-7");

  // connectors SVG
  const svgNS = "http://www.w3.org/2000/svg";
  const connectorSvg = document.createElementNS(svgNS, "svg");
  connectorSvg.id = "siv-connectors";
  connectorSvg.style.display = "none";
  root.appendChild(connectorSvg);

  const connectors = [];
  for (let i = 0; i < 4; i++) {
    const line = document.createElementNS(svgNS, "line");
    connectorSvg.appendChild(line);
    connectors.push(line);
  }

  // ------------ state ------------

  let keepTextureVisible = false;
  let currentMesh = null;
  let hoverTarget = null;
  let isFocused = false;

  const springStiffness = 0.1;
  const springDamping = 0.8;

  let tooltipPos = { x: 0, y: 0 };
  let tooltipScreenPos = { x: 0, y: 0 };
  let tooltipScreenVel = { x: 0, y: 0 };

  let tooltipOffset = new THREE.Vector3(0, 0, 0);
  let lastRotation = { x: 0, y: 0, z: 0 };

  const rotatables = [];
  const velocities = new Map();
  const hitBoxes = [];
  const boxMap = new Map();
  const objectConfigMap = new Map();

  const friction = 0.98;
  const minVel = 0.0001;
  const sX = 0.004;
  const sY = 0.004;
  let dragVelocities = [];
  const DRAG_VEL_FRAMES = 4;

  const ray = new THREE.Raycaster();
  const mouse2 = new THREE.Vector2();
  let dragT = null;
  let isDown = false;
  let wasDownOnObject = false;
  let px = 0;
  let py = 0;
  let dragDistance = 0;
  const DRAG_THRESHOLD = 4;

  let lastMouseX = 0,
    lastMouseY = 0,
    mouseVelX = 0,
    mouseVelY = 0,
    lastHoverTarget = null;

  const dragCamPos = new THREE.Vector3();
  const dragCamTarget = new THREE.Vector3();

  // screen-space rotation: drag turns the object around the camera's axes
  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const _dragQ = new THREE.Quaternion();

  // post-release spin (inertia), kept in the same screen-space axes as the drag
  let spinObj = null;
  const spinUpAxis = new THREE.Vector3();
  const spinRightAxis = new THREE.Vector3();
  let spinUpVel = 0;
  let spinRightVel = 0;
  const MAX_SPIN = 0.25; // rad/frame cap so a hard flick can't go haywire

  const keysPressed = {};

  // ------------ helper: highlight edges ------------

  function highlightEdges(obj3D, edgeColor = 0x00ff00) {
    obj3D.traverse((node) => {
      if (!node.isMesh) return;
      const orig = node.material;
      const face = orig.clone();
      face.transparent = true;
      face.opacity = 0;
      node.userData.faceMat = face;
      node.material = face;

      const geo = new THREE.EdgesGeometry(node.geometry);
      const mat = new THREE.LineBasicMaterial({
        color: edgeColor,
        transparent: true,
        opacity: 1,
      });
      const wire = new THREE.LineSegments(geo, mat);
      node.add(wire);
      node.userData.edgesMat = mat;
    });
  }

  function addRotatable(obj, cfg) {
    const bb = new THREE.Box3().setFromObject(obj);
    const sz = bb.getSize(new THREE.Vector3());
    obj.userData.maxDim = Math.max(sz.x, sz.y, sz.z);

    highlightEdges(obj);
    scene.add(obj);
    rotatables.push(obj);
    velocities.set(obj, { x: 0, y: 0, z: 0 });
    objectConfigMap.set(obj, cfg);

    const ctr = bb.getCenter(new THREE.Vector3());
    // shrink the invisible grab box toward the object slightly so neighbours
    // don't steal clicks; objects with big hollow gaps (e.g. Smart Connect)
    // override this to a full-size box so the hole is still draggable.
    const hs = cfg.hitScale ?? 0.8;
    const geo = new THREE.BoxGeometry(sz.x * hs, sz.y * hs, sz.z * hs);
    const mat = new THREE.MeshBasicMaterial({ visible: false });
    const hb = new THREE.Mesh(geo, mat);
    hb.position.copy(ctr);
    scene.add(hb);
    hitBoxes.push(hb);
    boxMap.set(hb, obj);

    // let the bob keep the (invisible) hitbox aligned with the visual mesh
    obj.userData.hitBox = hb;
    obj.userData.hbOffsetY = ctr.y - obj.position.y;
  }

  // ------------ objects ------------

  // staggered "floating gallery" layout: each object sits at a different
  // height AND depth so the trio reads as an arrangement, not a flat row.
  // orientation = upright (no roll), with a gentle 3/4 turn toward the centre.
  const objectConfigs = [
    {
      type: "gltf",
      name: "CRT TV Oscilloscope",
      url: "/models/crtfony.glb",
      scale: 1.75,
      position: { x: -2.375, y: 0.8, z: -0.45 },
      orientation: { x: 0.05, y: 0.45, z: 0 },
      tooltipClass: "obj2",
    },
    {
      type: "gltf",
      name: "Circuit Bent Camcorder",
      url: "/models/camcorder.glb",
      scale: 6.5,
      position: { x: -1.425, y: -0.55, z: 0.7 },
      orientation: { x: 0.04, y: 0.55, z: 0 },
      tooltipClass: "obj4",
    },
    {
      type: "gltf",
      name: "Bibigo Chopstick",
      url: "/models/chopstickv1.glb",
      scale: 2,
      position: { x: -0.475, y: 1.55, z: -0.35 },
      orientation: { x: 0.04, y: -0.2, z: 0 },
      tooltipClass: "obj7",
    },
    {
      type: "gltf",
      name: "Mixer",
      url: "/models/Mixer.glb",
      scale: 1.75,
      position: { x: -0.475, y: 0.28, z: -0.55 },
      orientation: { x: 0.04, y: -0.12, z: 0 },
      tooltipClass: "obj1",
    },
    {
      type: "gltf",
      name: "Smart Pint Glass",
      url: "/models/pintglass.glb",
      scale: 7.0,
      position: { x: 0.475, y: -0.7, z: 0.85 },
      orientation: { x: 0.04, y: -0.3, z: 0 },
      tooltipClass: "obj5",
    },
    {
      type: "gltf",
      name: "Typewriter",
      url: "/models/typewriter3.glb",
      scale: 1.75,
      position: { x: 1.825, y: 1.55, z: 0.0 },
      orientation: { x: 0.04, y: -0.45, z: 0 },
      tooltipClass: "obj3",
    },
    {
      type: "gltf",
      name: "Smart Connect",
      url: "/models/smartconnect.glb",
      scale: 11.0,
      position: { x: 2.375, y: -0.35, z: 0.55 },
      orientation: { x: 0.04, y: -0.55, z: 0 },
      tooltipClass: "obj6",
      hitScale: 1.0,   // full-size grab box so the big central hole is draggable
    },
  ];

  const loader = new GLTFLoader();
  objectConfigs.forEach((cfg, i) => {
    if (cfg.type === "gltf") {
      loader.load(
        cfg.url,
        (gltf) => {
          const m = gltf.scene;
          m.name = cfg.name;
          m.scale.set(cfg.scale, cfg.scale, cfg.scale);
          m.position.set(cfg.position.x, cfg.position.y, cfg.position.z);

          // upright, gentle hero angle — no more random tumbling
          const o = cfg.orientation || { x: 0, y: 0, z: 0 };
          m.rotation.set(o.x, o.y, o.z);

          // gentle idle bob; distinct phase/speed per object so they drift
          // independently rather than bobbing in unison
          m.userData.bobBaseY = cfg.position.y;
          m.userData.bobPhase = i * 2.1;
          m.userData.bobSpeed = 0.5 + i * 0.12;
          m.userData.bobAmp = 0.12;

          addRotatable(m, cfg);
        },
        undefined,
        (e) => console.error(e)
      );
    }
  });

  // ------------ tooltip / content logic ------------

  const checkboxesByTooltipKey = {
    obj1: chk1,
    obj2: chk2,
    obj3: chk3,
    obj4: chk4,
    obj5: chk5,
    obj6: chk6,
    obj7: chk7,
  };

  function showTooltipContent(tooltipKey) {
    tipBlocks.forEach((el) => {
      el.style.display = "none";
      el.scrollTop = 0;
    });

    const block = root.querySelector(`.siv-tip-block[data-tip="${tooltipKey}"]`);
    if (block) {
      block.style.display = "block";
    }

    keepTextureVisible = true;
    Object.values(checkboxesByTooltipKey).forEach((chk) => {
      if (chk) {
        chk.checked = true;
        chk.onchange = null;
      }
    });

    const activeChk = checkboxesByTooltipKey[tooltipKey];
    if (activeChk) {
      activeChk.onchange = () => (keepTextureVisible = activeChk.checked);
    }

    tooltip.classList.remove("hidden");
    connectorSvg.style.display = "block";
  }

  function resetView() {
    camera.position.set(0, 1.2, computeCameraDistance(camera.aspect));
    controls.target.copy(scene.position);
    controls.enableRotate = true;
    controls.enableZoom = false;
    controls.enabled = true;
    isFocused = false;
    tooltip.classList.add("hidden");
    connectorSvg.style.display = "none";
    currentMesh = hoverTarget = null;
    tooltipOffset.set(0, 0, 0);
    lastRotation = { x: 0, y: 0, z: 0 };
    keepTextureVisible = false;

    tipBlocks.forEach((el) => {
      el.style.display = "none";
      el.scrollTop = 0;
    });
    Object.values(checkboxesByTooltipKey).forEach((chk) => {
      if (chk) chk.checked = false;
    });
  }

  if (tipClose) {
    tipClose.addEventListener("click", resetView);
  }

  // ------------ tooltip position & offset (as in original) ------------

  function positionTooltipAt(worldPos) {
    const rect = root.getBoundingClientRect();
    const offsetWorldPos = worldPos.clone().add(tooltipOffset);
    const ndc = offsetWorldPos.project(camera);
    tooltipPos.x = (ndc.x * 0.5 + 0.5) * rect.width;
    tooltipPos.y = (-ndc.y * 0.5 + 0.5) * rect.height;
  }

  function updateTooltipOffset() {
    if (!currentMesh || !isFocused) return;

    const currentRotX = currentMesh.rotation.x;
    const currentRotY = currentMesh.rotation.y;
    const currentRotZ = currentMesh.rotation.z;

    const deltaX = currentRotX - lastRotation.x;
    const deltaY = currentRotY - lastRotation.y;
    const deltaZ = currentRotZ - lastRotation.z;

    const influence = 0.3;
    const maxDim = currentMesh.userData.maxDim || 1;

    tooltipOffset.x += deltaY * influence * maxDim * 0.5;
    tooltipOffset.y += deltaX * influence * maxDim * 0.3;
    tooltipOffset.z += deltaZ * influence * maxDim * 0.2;

    tooltipOffset.multiplyScalar(0.95);

    const maxOffset = maxDim * 0.8;
    tooltipOffset.x = Math.max(-maxOffset, Math.min(maxOffset, tooltipOffset.x));
    tooltipOffset.y = Math.max(-maxOffset, Math.min(maxOffset, tooltipOffset.y));
    tooltipOffset.z = Math.max(-maxOffset, Math.min(maxOffset, tooltipOffset.z));

    lastRotation.x = currentRotX;
    lastRotation.y = currentRotY;
    lastRotation.z = currentRotZ;
  }

  function updateConnectorLines(tx, ty, worldPos) {
    const rect = root.getBoundingClientRect();
    const offsets = [
      new THREE.Vector3(1, 1, 0),
      new THREE.Vector3(-1, 1, 0),
      new THREE.Vector3(-1, -1, 0),
      new THREE.Vector3(1, -1, 0),
    ];

    const maxDim = currentMesh?.userData.maxDim || 1;

    offsets.forEach((off, i) => {
      const corner = worldPos.clone().add(off.multiplyScalar(maxDim * 0.5));
      const ndc = corner.project(camera);
      const cx = (ndc.x * 0.5 + 0.5) * rect.width;
      const cy = (-ndc.y * 0.5 + 0.5) * rect.height;
      const ln = connectors[i];
      ln.setAttribute("x1", cx);
      ln.setAttribute("y1", cy);
      ln.setAttribute("x2", tx);
      ln.setAttribute("y2", ty);
    });
  }

  // ------------ fades (wireframe vs texture) ------------

  function updateFades() {
    rotatables.forEach((o) => {
      const show =
        o === hoverTarget || (isFocused && o === currentMesh && keepTextureVisible);
      o.traverse((n) => {
        if (!n.isMesh || !n.userData.faceMat) return;
        n.userData.faceMat.opacity += ((show ? 1 : 0) - n.userData.faceMat.opacity) * 0.1;
        n.userData.edgesMat.opacity = 1 - n.userData.faceMat.opacity;
      });
    });
  }

  // ------------ interactions ------------

  renderer.domElement.addEventListener("contextmenu", (e) => e.preventDefault());

  renderer.domElement.addEventListener("pointermove", (e) => {
    const rect = renderer.domElement.getBoundingClientRect();

    mouseVelX = e.clientX - lastMouseX;
    mouseVelY = e.clientY - lastMouseY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;

    mouse2.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse2.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(mouse2, camera);

    const hits = ray.intersectObjects(hitBoxes, false);
    hoverTarget = hits.length ? boxMap.get(hits[0].object) : null;

    if (!isFocused && !dragT && hoverTarget && hoverTarget !== lastHoverTarget) {
      const vel = velocities.get(hoverTarget);
      vel.x += mouseVelY * 0.0005;
      vel.y += mouseVelX * 0.0005;
      vel.z += (mouseVelX * 0.3 + mouseVelY * 0.3) * 0.0005;
    }

    lastHoverTarget = hoverTarget;

    if (dragT) {
      const dx = e.clientX - px;
      const dy = e.clientY - py;
      dragDistance += Math.abs(dx) + Math.abs(dy);

      // rotate around the CAMERA's right/up axes (screen space) so the object
      // always follows the cursor, no matter how it's already oriented.
      // premultiply applies the spin in world space, not the object's local frame.
      camRight.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
      camUp.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
      _dragQ.setFromAxisAngle(camUp, dx * sY);
      dragT.quaternion.premultiply(_dragQ);
      _dragQ.setFromAxisAngle(camRight, dy * sX);
      dragT.quaternion.premultiply(_dragQ);

      dragVelocities.push({ dx, dy, time: performance.now() });
      if (dragVelocities.length > DRAG_VEL_FRAMES) dragVelocities.shift();
      px = e.clientX;
      py = e.clientY;
      const v = velocities.get(dragT);
      v.x = v.y = v.z = 0;
      camera.position.copy(dragCamPos);
      controls.target.copy(dragCamTarget);
    }
  });

  renderer.domElement.addEventListener("pointerdown", (e) => {
    if (e.button === 2) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse2.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse2.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(mouse2, camera);
    const hits = ray.intersectObjects(hitBoxes, false);
    if (hits.length) {
      dragT = boxMap.get(hits[0].object);
      // stop any inertial spin so you grab the object cleanly
      spinObj = null;
      spinUpVel = 0;
      spinRightVel = 0;
      px = e.clientX;
      py = e.clientY;
      dragDistance = 0;
      isDown = true;
      controls.enabled = false;
      dragCamPos.copy(camera.position);
      dragCamTarget.copy(controls.target);
      renderer.domElement.classList.add("dragging");
    } else {
      controls.enabled = true;
    }
  });

  const onPointerUp = () => {
    if (dragT && dragDistance > DRAG_THRESHOLD) {
      wasDownOnObject = true;
      if (dragVelocities.length > 1) {
        // average the recent drag speed and let the object keep spinning that
        // way, around the same screen-space axes the drag used.
        let sumdx = 0, sumdy = 0;
        for (const d of dragVelocities) { sumdx += d.dx; sumdy += d.dy; }
        const first = dragVelocities[0];
        const last = dragVelocities[dragVelocities.length - 1];
        const dt = (last.time - first.time) || 16;

        spinObj = dragT;
        spinUpAxis.copy(camUp);
        spinRightAxis.copy(camRight);
        spinUpVel = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, (sumdx / dt) * sY * 16));
        spinRightVel = Math.max(-MAX_SPIN, Math.min(MAX_SPIN, (sumdy / dt) * sX * 16));

        // make sure the ambient Euler spin doesn't fight the inertia
        const objVel = velocities.get(dragT);
        if (objVel) objVel.x = objVel.y = objVel.z = 0;
      }
    }
    isDown = false;
    dragT = null;
    dragVelocities = [];
    controls.enabled = true;
    renderer.domElement.classList.remove("dragging");
  };
  document.addEventListener("pointerup", onPointerUp);

  renderer.domElement.addEventListener("click", (e) => {
    if (wasDownOnObject) {
      wasDownOnObject = false;
      return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    mouse2.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse2.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(mouse2, camera);
    const hits = ray.intersectObjects(hitBoxes, false);
    if (!hits.length) {
      if (isFocused) resetView();
      return;
    }

    currentMesh = boxMap.get(hits[0].object);
    const cfg = objectConfigMap.get(currentMesh);
    if (!cfg) return;

    // set current rotation baseline
    lastRotation.x = currentMesh.rotation.x;
    lastRotation.y = currentMesh.rotation.y;
    lastRotation.z = currentMesh.rotation.z;
    tooltipOffset.set(0, 0, 0);

    // focus camera
    isFocused = true;
    const wp = new THREE.Vector3();
    currentMesh.getWorldPosition(wp);
    const md = currentMesh.userData.maxDim || 1;
    const dist = md * 2;

    const up = new THREE.Vector3(0, 1.1, 0);
    const forward = camera.getWorldDirection(new THREE.Vector3());
    const dir = forward.clone().negate();

    let finalPos, finalTarget;
    if (IS_MOBILE) {
      // Portrait canvas: the horizontal fov is much narrower than desktop's,
      // so back off far enough for the object to fit across the width
      // (tan(35°/2) ≈ 0.315 → half-width visible at d is 0.315*d*aspect).
      const fitDist = md / (0.63 * Math.max(camera.aspect, 0.1)) * 1.6;
      const mDist = Math.max(dist * 1.4, fitDist);
      // Bottom-docked popup covers the lower 46vh, so aim the camera dead-on
      // horizontally and slightly below the object — it then renders centred
      // in the visible band above the popup. 0.145*d ≈ 23% of the view
      // height at the camera's 35° fov (50% centre → 27% band centre).
      finalTarget = wp.clone().sub(up.clone().multiplyScalar(mDist * 0.145));
      finalPos = finalTarget.clone().add(dir.clone().multiplyScalar(mDist));
    } else {
      const FIXED_LEFT = 0.5;
      const right = new THREE.Vector3().crossVectors(forward, up).normalize();
      const off = wp.clone().add(right.clone().multiplyScalar(-FIXED_LEFT));
      const base = off.clone().add(dir.multiplyScalar(dist));
      const pR = right.clone().multiplyScalar(1);
      const pU = up.clone().multiplyScalar(0);

      finalPos = base.clone().add(pR).add(pU);
      finalTarget = off.clone().add(pR).add(pU);
    }

    camera.position.copy(finalPos);
    controls.target.copy(finalTarget);
    controls.enableRotate = false;
    controls.enableZoom = false;
    controls.enabled = false;

    showTooltipContent(cfg.tooltipClass);

    positionTooltipAt(wp);
  });

  // scroll inside popup: prevent page scroll
  // scroll inside popup: zoom instead of vertical pan
  renderer.domElement.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();

      // if you've locked onto an object, ignore scroll (keeps the "focus" view stable)
      if (isFocused) return;

      const zoomSpeed = 0.002;
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);

      // scroll up (negative deltaY) → move camera forward (zoom in)
      // scroll down (positive deltaY) → move camera backward (zoom out)
      const delta = e.deltaY * zoomSpeed;

      camera.position.addScaledVector(dir, delta);

      // keep target where it is so it's a proper zoom, not a push
      // (if you prefer dolly-style, also move controls.target by the same vector)
      // controls.target.addScaledVector(dir, delta);
    },
    { passive: false }
  );


  // keyboard panning (WASD, QE) inside popup
  const onKeyDown = (e) => {
    keysPressed[e.key.toLowerCase()] = true;
  };
  const onKeyUp = (e) => {
    keysPressed[e.key.toLowerCase()] = false;
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  // ------------ resize ------------

  let ro = null;
  const onWindowResize = () => {
    const { width, height } = getSize();
    camera.aspect = width / height;
    if (!isFocused) {
      camera.position.z = computeCameraDistance(camera.aspect);
    }
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };
  if (window.ResizeObserver) {
    ro = new ResizeObserver(onWindowResize);
    ro.observe(root);
  } else {
    window.addEventListener("resize", onWindowResize);
  }

  // ------------ animate ------------

  let disposed = false;
  let rafId = 0;

  (function animate() {
    if (disposed) return;
    rafId = requestAnimationFrame(animate);

    updateTooltipOffset();
    updateFades();

    // gentle floating bob — paused while focused so the framed object holds still
    if (!isFocused) {
      const tb = performance.now() * 0.001;
      rotatables.forEach((o) => {
        const baseY = o.userData.bobBaseY;
        if (baseY === undefined) return;
        o.position.y =
          baseY + Math.sin(tb * o.userData.bobSpeed + o.userData.bobPhase) * o.userData.bobAmp;
        const hb = o.userData.hitBox;
        if (hb) hb.position.y = o.position.y + o.userData.hbOffsetY;
      });
    }

    rotatables.forEach((o) => {
      const v = velocities.get(o);
      if (!v) return;
      if (Math.abs(v.x) > minVel) {
        o.rotation.x += v.x;
        v.x *= friction;
      }
      if (Math.abs(v.y) > minVel) {
        o.rotation.y += v.y;
        v.y *= friction;
      }
      if (Math.abs(v.z) > minVel) {
        o.rotation.z += v.z;
        v.z *= friction;
      }
    });

    // post-release spin inertia (screen-space, matches the drag direction)
    if (spinObj && (Math.abs(spinUpVel) > minVel || Math.abs(spinRightVel) > minVel)) {
      if (Math.abs(spinUpVel) > minVel) {
        _dragQ.setFromAxisAngle(spinUpAxis, spinUpVel);
        spinObj.quaternion.premultiply(_dragQ);
        spinUpVel *= friction;
      }
      if (Math.abs(spinRightVel) > minVel) {
        _dragQ.setFromAxisAngle(spinRightAxis, spinRightVel);
        spinObj.quaternion.premultiply(_dragQ);
        spinRightVel *= friction;
      }
    }

    const moveSpeed = 0.1;
    if (keysPressed["w"] || keysPressed["arrowup"]) {
      const fwd = camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(moveSpeed);
      camera.position.add(fwd);
      controls.target.add(fwd);
    }
    if (keysPressed["s"] || keysPressed["arrowdown"]) {
      const back = camera
        .getWorldDirection(new THREE.Vector3())
        .multiplyScalar(-moveSpeed);
      camera.position.add(back);
      controls.target.add(back);
    }
    const rightVec = new THREE.Vector3().crossVectors(
      camera.getWorldDirection(new THREE.Vector3()),
      new THREE.Vector3(0, 1, 0)
    ).normalize();
    if (keysPressed["d"] || keysPressed["arrowright"]) {
      const rv = rightVec.clone().multiplyScalar(moveSpeed);
      camera.position.add(rv);
      controls.target.add(rv);
    }
    if (keysPressed["a"] || keysPressed["arrowleft"]) {
      const lv = rightVec.clone().multiplyScalar(-moveSpeed);
      camera.position.add(lv);
      controls.target.add(lv);
    }
    if (keysPressed["q"]) {
      camera.position.y += moveSpeed;
      controls.target.y += moveSpeed;
    }
    if (keysPressed["e"]) {
      camera.position.y -= moveSpeed;
      controls.target.y -= moveSpeed;
    }

    if (isFocused && currentMesh) {
      const wp2 = new THREE.Vector3();
      currentMesh.getWorldPosition(wp2);
      positionTooltipAt(wp2);

      const fx = (tooltipPos.x - tooltipScreenPos.x) * springStiffness;
      tooltipScreenVel.x = (tooltipScreenVel.x + fx) * springDamping;
      tooltipScreenPos.x += tooltipScreenVel.x;

      const fy = (tooltipPos.y - tooltipScreenPos.y) * springStiffness;
      tooltipScreenVel.y = (tooltipScreenVel.y + fy) * springDamping;
      tooltipScreenPos.y += tooltipScreenVel.y;

      tooltip.style.transform = `translate3d(${tooltipScreenPos.x}px, ${tooltipScreenPos.y}px, 0)`;

      updateConnectorLines(
        tooltipScreenPos.x,
        tooltipScreenPos.y,
        wp2.clone().add(tooltipOffset)
      );
    }

    controls.update();
    renderer.render(scene, camera);
  })();

  // teardown: stop the render loop, free the WebGL context, detach the
  // global listeners so reopening the popup doesn't stack loops/contexts
  return function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(rafId);
    if (ro) ro.disconnect();
    window.removeEventListener("resize", onWindowResize);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    document.removeEventListener("pointerup", onPointerUp);
    controls.dispose();
    renderer.dispose();
  };
}

/* =========================================================
   Terminal + Popup Logic
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  const typingSpeed = 18;
  const lineDelay = 1000;
  const lineDelayAbout = 0;

  
  const ROOT_PATH = "~/welcome";
  const PROJECTS_PATH = "~/welcome/projects";

  let projectsOpened = false;
  let currentPath = ROOT_PATH;
  let launchInitiated = false;
  let typeAboutBlock = null;   
  let openTerminalAppMobile = null;   


  function cdToProjects(onDone) {
    if (currentPath === PROJECTS_PATH) {
      if (onDone) onDone();
      return;
    }

    logCommand("$ cd projects", currentPath, () => {
      currentPath = PROJECTS_PATH;
      printLogPrompt(currentPath);   // 👈 new prompt after cd
      if (onDone) onDone();
    });
  }

  function cdToRoot(onDone) {
    if (currentPath === ROOT_PATH) {
      if (onDone) onDone();
      return;
    }

    logCommand("$ cd ..", currentPath, () => {
      currentPath = ROOT_PATH;
      printLogPrompt(currentPath);   
      if (onDone) onDone();
    });
  }

function showTrashError() {
  // Prevent multiple stacking
  if (document.querySelector('.win98-overlay')) return;

  const overlay = document.createElement('div');
  overlay.className = 'win98-overlay';

  overlay.innerHTML = `
    <div class="win98-window" role="dialog" aria-modal="true">
      <div class="win98-titlebar">
        <div class="win98-title">Error</div>
        <button class="win98-close" aria-label="Close">x</button>
      </div>

      <div class="win98-body">
        <div class="win98-content">
          


          </div>
        </div>

        <div class="win98-clippy">
        <div class="win98-bubble">
            Hi, I've been resurrected from Windows 98!<br>
            It looks like you're trying to delete Zade's portfolio.<br>
            Maybe like don't do that?
          </div>
            <img class="win98-clippy-img" src="/img/clippy.png" alt="Clippy">
          </div>
            <div class="win98-actions">
              <button class="win98-btn win98-ok">OK</button>
            </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    document.removeEventListener("keydown", onKey);
    overlay.remove();
  };

  // ESC closes — listener stays until the dialog actually closes,
  // then is removed no matter how it was dismissed
  const onKey = (e) => {
    if (e.key === "Escape") close();
  };
  document.addEventListener("keydown", onKey);

  overlay.querySelector('.win98-ok')?.addEventListener('click', close);
  overlay.querySelector('.win98-close')?.addEventListener('click', close);

  // Click outside closes (optional)
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) close();
  });
}



  // MAIN LEFT TERMINAL
  const container = document.querySelector(".intro_con");
  if (!container) return;


  const blocks = Array.from(container.children).filter(
    (el) => el.tagName === "P" || el.tagName === "DIV"
  );
  const originalHTML = blocks.map((el) => el.innerHTML);
  blocks.forEach((el) => (el.innerHTML = ""));

  const lsLine = document.getElementById("ls-line");

  const rootEntries = [
    "/projects",
    "stuff_ive_built.js",
    "skills.txt",
    "contact_me.txt",
    "cv.pdf"
  ];

  const fileToSectionId = {
    "skills.txt": "skills-content",
    "contact_me.txt": "contact-content",
    "cv.pdf":"pdf-content",
  };

  const projectsFiles = [
    { name: "HEX Bibigo_Scroll.md", sectionId: "bibigo" },
    { name: "HEX Action_Audio.md", sectionId: "hex-action-audio" },
    { name: "HEX Smart_Connect.md", sectionId: "hex-smart-connect" },
    { name: "HEX EDA_A-Land-Unfinished.md", sectionId: "project-wearable-xyz" },
    { name: "HEX interactive_music_video_umg.md", sectionId: "project-installation-sensors" },
    { name: "Wax Palace boilerroom_takeover.md", sectionId: "boilerroom" },
    { name: "The_Kaleidocsope_Festival_2022.html", sectionId: "k23" },
    { name: "The_Kaleidocsope_Festival_2021.html", sectionId: "k22" },
    { name: "printers.mp4", sectionId: "printers" },
    { name: "musicai.mp4", sectionId: "musicai" },

  ];

  function rectsOverlap(a, b) {
    return !(
      a.right < b.left ||
      a.left > b.right ||
      a.bottom < b.top ||
      a.top > b.bottom
    );
  }

  function animateIconBack(icon, toLeft, toTop) {
  icon.style.transition = "left 220ms ease-out, top 220ms ease-out";
  icon.style.left = toLeft + "px";
  icon.style.top = toTop + "px";

  // clean up transition after animation
  setTimeout(() => {
    icon.style.transition = "";
  }, 260);
}


  function typeBlock(index) {
    if (index >= blocks.length) return;

    const el = blocks[index];
    const html = originalHTML[index];

    if (el.classList.contains("no-type")) {
      el.innerHTML = html;
      return typeBlock(index + 1);
    }

    let i = 0;
    el.classList.add("typing");

    (function step() {
      if (i <= html.length) {
        el.textContent = html.slice(0, i);
        i++;
        setTimeout(step, typingSpeed);
      } else {
        el.classList.remove("typing");

        if (el === lsLine) {
          renderRootListing();
        }

        const next = blocks[index + 1];
        const nextIsInstant = next && next.classList.contains("no-type");

        if (nextIsInstant) typeBlock(index + 1);
        else setTimeout(() => typeBlock(index + 1), lineDelay);
      }
    })();
  }

  


  function printPromptLeft(path) {
    const prompt = document.createElement("p");
    prompt.classList.add("prompt");
    prompt.innerHTML =
      `<span style="color:#33FF33;">zade@tuaima </span>` +
      `<span style="color:#f0f;"> ${path}</span>`;
    container.appendChild(prompt);
  }

  // LOG TERMINAL
  const logContainer = document.querySelector(".log_con");

  function scrollLogToBottom() {
    if (!logContainer) return;
      logContainer.scrollTop = logContainer.scrollHeight;
  }
  
  function printLogPrompt(path) {
    if (!logContainer) return;

    const prompt = document.createElement("p");
    prompt.classList.add("prompt");
    prompt.innerHTML =
      `<span style="color:#33FF33;">zade@tuaima </span>` +
      `<span style="color:#f0f;"> ${path}</span>`;

    logContainer.appendChild(prompt);
    scrollLogToBottom();
  }   

  function logCommand(command, path, onComplete) {
    if (!logContainer) {
      if (onComplete) onComplete();
      return;
    }

    const line = document.createElement("p");
    line.classList.add("typing");
    logContainer.appendChild(line);
    scrollLogToBottom();

    let i = 0;
    (function step() {
      if (i <= command.length) {
        line.textContent = command.slice(0, i);
        i++;
        scrollLogToBottom();
        setTimeout(step, typingSpeed);
      } else {
        line.classList.remove("typing");
        scrollLogToBottom();
        if (onComplete) onComplete();
      }
    })();
  }


  // ROOT LISTING

  function renderRootListing() {
    if (!lsLine) return;

    lsLine.innerHTML = "";

    rootEntries.forEach((name, index) => {
      const span = document.createElement("span");
      span.textContent = name;
      span.classList.add("file-link");
      span.dataset.entry = name;
      lsLine.appendChild(span);
      if (index < rootEntries.length - 1) {
        lsLine.appendChild(document.createTextNode("     "));
      }
    });

    lsLine.querySelectorAll(".file-link").forEach((span) => {
      span.addEventListener("click", () => {
        handleRootEntryClick(span.dataset.entry);
      });
    });
  }

function handleRootEntryClick(name) {
  if (name === "/projects") {
    if (projectsOpened) return; // still ignore extra clicks

    cdToProjects(() => {
      projectsOpened = true;
      openDirectoryOnLeft("/projects", projectsFiles);
    });
  } else {
    openTopLevelFileInLog(name);
  }
}

function renderDirectoryListingLeft(files) {
  const line = document.createElement("p");
  line.classList.add("dir-listing");
  container.appendChild(line);

  files.forEach((file, index) => {
    const span = document.createElement("span");
    span.textContent = file.name;
    span.classList.add("file-link");
    span.dataset.filename = file.name;
    span.dataset.sectionId = file.sectionId;
    line.appendChild(span);
    if (index < files.length - 1) {
      line.appendChild(document.createTextNode("     "));
    }
  });

  line.querySelectorAll(".file-link").forEach((span) => {
    span.addEventListener("click", () => {
      const filename = span.dataset.filename;
      const sectionId = span.dataset.sectionId;

      const openAfterCd = () => {
        openDirectoryFileInLog(filename, sectionId);
      };

      // 🔑 If we're not in ~/welcome/projects yet, cd first
      if (currentPath !== PROJECTS_PATH) {
        cdToProjects(openAfterCd);
      } else {
        openAfterCd();
      }
    });
  });
}


  // /projects only on LEFT

  function openDirectoryOnLeft(dirName, files) {
    closeExistingWindow();
    printPromptLeft(currentPath);

    const cdLine = document.createElement("p");
    cdLine.classList.add("typing");
    container.appendChild(cdLine);

    let i = 0;
    const cmd = `$ cd ${dirName}`;
    (function step() {
      if (i <= cmd.length) {
        cdLine.textContent = cmd.slice(0, i);
        i++;
        setTimeout(step, typingSpeed);
      } else {
        cdLine.classList.remove("typing");

        printPromptLeft(currentPath);

        const lsInner = document.createElement("p");
        lsInner.classList.add("typing");
        container.appendChild(lsInner);

        let j = 0;
        const lsCmd = "$ ls";
        (function step2() {
          if (j <= lsCmd.length) {
            lsInner.textContent = lsCmd.slice(0, j);
            j++;
            setTimeout(step2, typingSpeed);
          } else {
            lsInner.classList.remove("typing");
            renderDirectoryListingLeft(files);
          }
        })();
      }
    })();
  }



  // ACTIONS -> LOG + POPUPS

  function openTopLevelFileInLog(filename) {
    closeExistingWindow();

    const openAfterCd = () => {
      logCommand(`$ open ${filename}`, currentPath, () => {
        if (filename === "stuff_ive_built.js") {
          openStuffIveBuiltPopup();
        } else {
          const sectionId = fileToSectionId[filename];
          const section = sectionId ? document.getElementById(sectionId) : null;
          openPopup(filename, section);
        }

        // 👇 after the open command finishes + window opens
        printLogPrompt(currentPath);
      });
    };

    if (currentPath === PROJECTS_PATH) {
      cdToRoot(openAfterCd);
    } else {
      openAfterCd();
    }
  }



  function openDirectoryFileInLog(filename, sectionId) {
    closeExistingWindow();

    logCommand(`$ open ${filename}`, currentPath, () => {
      const section = sectionId ? document.getElementById(sectionId) : null;
      openPopup(filename, section);

      // 👇 ready for the next command
      printLogPrompt(currentPath);
    });
  }



  // POPUPS

  function attachCloseHandlers(win) {
  const closeIcon = win.querySelector(".window-close"); // the ×
  const redDot = win.querySelector(".dot.red");         // the red circle

  [closeIcon, redDot].forEach((btn) => {
    if (!btn) return;
    btn.addEventListener("click", (e) => {
      e.stopPropagation();              // so it doesn't trigger drag/snap
      closeWindowWithAnimation(win);
    });
  });
}


  function openPopup(title, section) {
  const isTextFile = /\.txt$/i.test(title);
  const isMP4File = /\.mp4$/i.test(title);
  const isMDFile = /\.(md|html)$/i.test(title);
  const isjsFile = /\.js$/i.test(title);
  const ispdfFile = /\.pdf$/i.test(title);

  const win = document.createElement("div");
  win.className = "window";

  if (isTextFile) win.classList.add("window-textedit");
  if (isMP4File) win.classList.add("window-mp4");
  if (isMDFile) win.classList.add("window-md");
  if (isjsFile) win.classList.add("window-js");
  if (ispdfFile) win.classList.add("window-pdf");
  if (section && section.id) win.classList.add("win-" + section.id);

  win.innerHTML = `
    <div class="window-header">
      <span class="dot red"></span>
      <span class="dot yellow"></span>
      <span class="dot green"></span>
      <span class="window-title">${title}</span>
      <span class="window-close">&#10005;</span>
    </div>
    <div class="window-body">
      ${section ? section.innerHTML : "Coming soon..."}
    </div>
  `;

  document.body.appendChild(win);
  disableAutoplayOnMobile(win);

  // Mobile browsers (esp. iOS Safari) won't render a PDF inside <embed>, so
  // the CV shows up blank. Swap it for a tap-to-open link that hands the file
  // to the browser's native full-screen PDF viewer instead.
  if (ispdfFile && IS_MOBILE) {
    const embed = win.querySelector("embed");
    const pdfSrc = embed ? embed.getAttribute("src") : "/creativecvfinalfinal.pdf";
    const body = win.querySelector(".window-body");
    if (body) {
      body.innerHTML = `
        <div class="pdf-mobile-fallback">
          <p>PDFs can't preview inline on mobile.</p>
          <a class="pdf-open-btn" href="${pdfSrc}" target="_blank" rel="noopener">Open CV (PDF)</a>
        </div>
      `;
    }
  }

  document.body.classList.add("modal-open");
  makeDraggable(win);      // handles initial z-index + drag rules

  // trigger opening animation
  void win.offsetWidth;
  win.classList.add("show");

  attachCloseHandlers(win)
}


  function openStuffIveBuiltPopup() {
  const win = document.createElement("div");
  win.className = "window"; // treated as terminal popup (non txt/mp4/md)

  win.innerHTML = `
    <div class="window-header">
      <span class="dot red"></span>
      <span class="dot yellow"></span>
      <span class="dot green"></span>
      <span class="window-title">stuff_ive_built.js</span>
      <span class="window-close">x</span>
    </div>
    <div class="window-body">
      <div id="stuff-ive-buit-root"></div>
    </div>
  `;

  document.body.appendChild(win);
  document.body.classList.add("modal-open");
  makeDraggable(win);    // will mark as terminal popup & apply rules

  void win.offsetWidth;
  win.classList.add("show");

  attachCloseHandlers(win)

  const root = win.querySelector("#stuff-ive-buit-root");
  win.cleanup3D = initStuffIveBuilt(root);
}


  function closeWindowWithAnimation(win) {
    if (typeof win.cleanup3D === "function") {
      win.cleanup3D(); // stop 3D render loop + free WebGL context
      win.cleanup3D = null;
    }
    win.classList.remove("show");
    document.body.classList.remove("modal-open");
    setTimeout(() => {
      if (win && win.parentNode) win.parentNode.removeChild(win);
    }, 200);
  }

  function closeExistingWindow() {
    const existing = document.querySelector(".window");
    if (existing) closeWindowWithAnimation(existing);
  }

const MACOS_BAR_HEIGHT = 32; 

function makeDraggable(win) {
  const contentWindow = isContentWindow(win);
  const terminalPopup = isTerminalPopup(win);

  const DRAG_START_THRESHOLD = 3;

  let isPointerDown = false;
  let hasDragged = false;
  let startX = 0;
  let startY = 0;
  let baseLeft = 0;
  let baseTop = 0;

  const header =
    win.querySelector(".window-header") ||
    win.querySelector(".terminal-header");

  // Always bring to front on primary mousedown (within its group)
  win.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".window-close")) return;
    bringToFront(win);
  });

  // Dragging ONLY from header
  if (header) {
    header.addEventListener("mousedown", (e) => {
      if (
        e.button !== 0 ||
        e.target.closest(".window-close") ||
        e.target.tagName === "INPUT" ||
        e.target.tagName === "TEXTAREA" ||
        e.target.isContentEditable
      ) {
        return;
      }

      e.preventDefault();

      isPointerDown = true;
      hasDragged = false;

      bringToFront(win);

      const rect = win.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      baseLeft = rect.left;
      baseTop = rect.top;

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  function onMove(e) {
    if (!isPointerDown) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const distSq = dx * dx + dy * dy;

    if (!hasDragged && distSq < DRAG_START_THRESHOLD * DRAG_START_THRESHOLD) {
      return;
    }

    if (!hasDragged) {
      hasDragged = true;
      ensureFixedPosition(win);
      const rect = win.getBoundingClientRect();
      baseLeft = rect.left;
      baseTop = rect.top;
    }

    let newLeft = baseLeft + dx;
    let newTop = baseTop + dy;

    const padding = 10;
    const maxLeft = window.innerWidth - padding;
    const maxTop = window.innerHeight - padding;

    // allow dragging "into" the macOS bar by up to its height
    const minTop = MACOS_BAR_HEIGHT +2; // tweak the +4 if you want

    if (newLeft < -win.offsetWidth + padding) newLeft = -win.offsetWidth + padding;
    if (newLeft > maxLeft) newLeft = maxLeft;
    if (newTop < minTop) newTop = minTop;  // 👈 changed from 0
    if (newTop > maxTop) newTop = maxTop;

    win.style.left = newLeft + "px";
    win.style.top = newTop + "px";
  }

function onUp() {
  isPointerDown = false;
  document.removeEventListener("mousemove", onMove);
  document.removeEventListener("mouseup", onUp);
}




  // Terminal popup special: click ANYWHERE (simple click, no drag) → snap to top
  if (terminalPopup) {
    win.addEventListener("click", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest(".window-close")) return;
      // if it was a drag, the click at mouseup shouldn't re-snap; rely on hasDragged:
      if (hasDragged) return;
      snapTerminalPopupToTop(win);
    });
  }

  // Initial z-order
  bringToFront(win);
}


    // ===================== ABOUT TERMINAL (TOP-RIGHT) =====================
  const aboutContainer = document.querySelector(".about_con");
  if (aboutContainer) {
    const aboutBlocks = Array.from(aboutContainer.children).filter(
      (el) => el.tagName === "P" || el.tagName === "DIV"
    );

    // Capture original content + whether it should be instant
    const aboutData = aboutBlocks.map((el) => ({
      isInstant: el.classList.contains("about-no-type"),
      html: el.innerHTML,
      text: (el.textContent || ""),
    }));

    // Clear out so we can animate in
    aboutBlocks.forEach((el) => {
      el.innerHTML = "";
    });

    typeAboutBlock = function typeAboutBlockFn(index) {
      if (index >= aboutBlocks.length) return;

      const el = aboutBlocks[index];
      const { isInstant, html, text } = aboutData[index];

      // Instant lines (prompt line)
      if (isInstant) {
        el.innerHTML = html;
        return typeAboutBlockFn(index + 1);
      }

      // Typed lines ($ cat about_me.txt and the paragraph)
      let i = 0;
      el.classList.add("typing");

      (function step() {
        if (i <= text.length) {
          el.textContent = text.slice(0, i);
          i++;
          setTimeout(step, typingSpeed);
        } else {
          el.classList.remove("typing");
          setTimeout(() => typeAboutBlockFn(index + 1), lineDelayAbout);
        }
      })();
    };
  }



  // ===================== DESKTOP ICON LAUNCH =====================

  const appIcon = document.getElementById("portfolio-app-icon");
  const trashBin = document.getElementById("trash-bin");

  function showWindow(win, delay) {
    if (!win) return;
    setTimeout(() => {
      win.style.display = "flex";  // show it
      win.classList.remove("mac-open"); // reset in case it's reused

      // force a reflow so the animation restarts cleanly
      // (otherwise adding the class immediately after display change can be ignored)
      void win.offsetWidth;

      win.classList.add("mac-open");  
      makeDraggable(win);
      bringToFront(win);

    }, delay);
  }


  function launchApp() {
    if (launchInitiated) return;
    launchInitiated = true;

    const leftTerm  = document.querySelector(".terminal-window-left");
    const aboutTerm = document.querySelector(".side-terminal-top");
    const logTerm   = document.querySelector(".side-terminal-bottom");

    if (IS_MOBILE) {
      // Phones: the two panes already live inside #ios-terminal-app (built by
      // setupMobileHomeScreen). Just drop the activity log and zoom the app open.
      if (logTerm) logTerm.style.display = "none";
      if (typeof openTerminalAppMobile === "function") openTerminalAppMobile();
    } else {
      showWindow(leftTerm, 60);
      showWindow(aboutTerm, 1000);
      showWindow(logTerm, 350);

      // 👇 initial log prompt at ~/welcome
      setTimeout(() => {
        printLogPrompt(currentPath);  // currentPath starts as ROOT_PATH
      }, 550);
    }

    setTimeout(() => {
      typeBlock(0);
      if (typeof typeAboutBlock === "function") {
        setTimeout(() => typeAboutBlock(0), 300);
      }
    }, 50);

    if (appIcon && !IS_MOBILE) {
      appIcon.style.zIndex = "1";
    }
  }


    function makeIconDraggable(icon) {
  if (!icon) return;

  let isDown = false;
  let hasDragged = false;
  let startX = 0;
  let startY = 0;
  let baseLeft = 0;
  let baseTop = 0;
  const DRAG_THRESHOLD = 3;


  

  function animateTo(x, y, ms = 260) {
    icon.style.transition = `left ${ms}ms cubic-bezier(0.22,0.61,0.36,1), top ${ms}ms cubic-bezier(0.22,0.61,0.36,1)`;
    requestAnimationFrame(() => {
      icon.style.left = x + "px";
      icon.style.top = y + "px";
    });
    const cleanup = () => {
      icon.style.transition = "";
      icon.removeEventListener("transitionend", cleanup);
    };
    icon.addEventListener("transitionend", cleanup);
  }

  icon.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();

    isDown = true;
    hasDragged = false;

    const rect = icon.getBoundingClientRect();
    icon.style.position = "fixed";
    icon.style.left = rect.left + "px";
    icon.style.top = rect.top + "px";

    baseLeft = rect.left;
    baseTop = rect.top;
    startX = e.clientX;
    startY = e.clientY;

    icon.classList.add("is-dragging");

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  });

  function onMove(e) {
    if (!isDown) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const distSq = dx * dx + dy * dy;

    if (!hasDragged && distSq < DRAG_THRESHOLD * DRAG_THRESHOLD) return;
    hasDragged = true;

    let newLeft = baseLeft + dx;
    let newTop = baseTop + dy;

    const padding = 10;
    const maxLeft = window.innerWidth - icon.offsetWidth - padding;
    const maxTop = window.innerHeight - icon.offsetHeight - padding;

    if (newLeft < padding) newLeft = padding;
    if (newLeft > maxLeft) newLeft = maxLeft;
    if (newTop < padding) newTop = padding;
    if (newTop > maxTop) newTop = maxTop;

    icon.style.left = newLeft + "px";
    icon.style.top = newTop + "px";

    // hover state for bin
    if (trashBin) {
      const iconRect = icon.getBoundingClientRect();
      const trashRect = trashBin.getBoundingClientRect();
      trashBin.classList.toggle("trash-hover", rectsOverlap(iconRect, trashRect));
    }
  }

  function onUp() {
    isDown = false;
    document.removeEventListener("mousemove", onMove);
    document.removeEventListener("mouseup", onUp);

    // clear hover highlight
    if (trashBin) trashBin.classList.remove("trash-hover");

    // Only treat as a "drop" if it was actually dragged
    if (!hasDragged) return;
    if (!trashBin) return;

    const iconRect = icon.getBoundingClientRect();
    const trashRect = trashBin.getBoundingClientRect();

    if (rectsOverlap(iconRect, trashRect)) {
      // 1) pop Win98-style error
      showTrashError();

      // 2) smoothly move it back to where it started
      animateIconBack(icon, baseLeft, baseTop);
    }
  }

}



  /* ===================== iOS HOME SCREEN (mobile) =====================
     Turns the desktop into an iOS-style springboard: one Portfolio app icon
     on the wallpaper. Tap → zoom-opens a full-screen terminal "app" that is
     a top/bottom split (top = ~/welcome + files, bottom = about). Long-press
     → jiggle/edit mode: drag to reposition, ✕ badge fires the Clippy gag. */
  function setupMobileHomeScreen() {
    const leftTerm  = document.querySelector(".terminal-window-left");
    const aboutTerm = document.querySelector(".side-terminal-top");
    const logTerm   = document.querySelector(".side-terminal-bottom");

    const barH = (document.querySelector(".macos-bar")?.offsetHeight) || 30;

    // Build the full-screen terminal app surface with two stacked panes.
    const app = document.createElement("div");
    app.id = "ios-terminal-app";
    app.style.top = barH + "px";
    app.innerHTML = `
      <div class="ios-app-bar">
        <button class="ios-app-home" type="button">&#8249; Home</button>
        <span class="ios-app-title">portfolio — zade@tuaima</span>
      </div>
      <div class="ios-pane-wrap"></div>
    `;
    document.body.appendChild(app);

    const paneWrap = app.querySelector(".ios-pane-wrap");
    if (leftTerm)  paneWrap.appendChild(leftTerm);   // top pane: ~/welcome + files
    if (aboutTerm) paneWrap.appendChild(aboutTerm);  // bottom pane: about-me
    if (logTerm)   logTerm.style.display = "none";   // drop the activity log

    // ---- open / close with the iOS "grow out of the icon" zoom ----
    function setZoomOrigin() {
      const r = appIcon.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      app.style.transformOrigin = `${cx}px ${cy - barH}px`;
    }
    function openTerminalApp() {
      setZoomOrigin();
      document.body.classList.add("app-open");
      requestAnimationFrame(() => app.classList.add("open"));
    }
    function closeTerminalApp() {
      app.classList.remove("open");
      setTimeout(() => document.body.classList.remove("app-open"), 380);
    }
    openTerminalAppMobile = openTerminalApp;  // let launchApp trigger the zoom
    app.querySelector(".ios-app-home").addEventListener("click", closeTerminalApp);

    function handleAppTap() {
      if (!launchInitiated) launchApp();   // first open: types content + zooms in
      else openTerminalApp();              // re-open without retyping
    }

    // ---- jiggle / edit mode ----
    let jiggle = false;
    const doneBtn = document.createElement("button");
    doneBtn.className = "ios-done";
    doneBtn.type = "button";
    doneBtn.textContent = "Done";
    document.querySelector(".main").appendChild(doneBtn);

    function enterJiggle() {
      if (jiggle) return;
      jiggle = true;
      document.body.classList.add("jiggle-mode");
    }
    function exitJiggle() {
      if (!jiggle) return;
      jiggle = false;
      document.body.classList.remove("jiggle-mode");
    }
    doneBtn.addEventListener("click", exitJiggle);
    const wallpaper = document.querySelector(".main_img");
    if (wallpaper) wallpaper.addEventListener("click", exitJiggle);

    // ✕ delete badge → Clippy "you can't delete my portfolio" gag
    const badge = document.createElement("span");
    badge.className = "ios-badge";
    badge.textContent = "×";
    appIcon.appendChild(badge);
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      showTrashError();
    });

    // ---- tap to open · long-press to jiggle · drag to rearrange ----
    appIcon.style.touchAction = "none";
    let startX = 0, startY = 0, baseLeft = 0, baseTop = 0;
    let moved = false, pid = null, pressTimer = null;

    appIcon.addEventListener("pointerdown", (e) => {
      if (e.target.closest(".ios-badge")) return;   // badge handles its own tap
      if (typeof e.button === "number" && e.button > 0) return;
      pid = e.pointerId;
      moved = false;
      const r = appIcon.getBoundingClientRect();
      baseLeft = r.left; baseTop = r.top;
      startX = e.clientX; startY = e.clientY;
      try { appIcon.setPointerCapture(pid); } catch (_) {}
      pressTimer = setTimeout(enterJiggle, 500);    // hold → edit mode
    });

    appIcon.addEventListener("pointermove", (e) => {
      if (pid === null) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (!moved && dx * dx + dy * dy < 16) return; // ignore micro-jitter
      moved = true;
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      if (!jiggle) return;                          // only drag while jiggling
      const pad = 8;
      let nl = baseLeft + dx;
      let nt = baseTop + dy;
      nl = Math.max(pad, Math.min(nl, window.innerWidth - appIcon.offsetWidth - pad));
      nt = Math.max(barH + 6, Math.min(nt, window.innerHeight - appIcon.offsetHeight - pad));
      appIcon.style.position = "fixed";
      appIcon.style.right = "auto";
      appIcon.style.bottom = "auto";
      appIcon.style.left = nl + "px";
      appIcon.style.top = nt + "px";
    });

    function endPress() {
      if (pid === null) return;
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
      try { appIcon.releasePointerCapture(pid); } catch (_) {}
      const wasTap = !moved;
      pid = null;
      if (wasTap && !jiggle) handleAppTap();        // clean tap opens the app
    }
    appIcon.addEventListener("pointerup", endPress);
    appIcon.addEventListener("pointercancel", endPress);
  }

  /* One-time nudge on first load: this site is a floating-window desktop
     metaphor that doesn't really work on a phone screen, so tell mobile
     visitors up front. Tap anywhere to dismiss. */
  function showMobileDesktopNotice() {
    if (document.querySelector(".ios-desktop-notice")) return;

    const notice = document.createElement("div");
    notice.className = "ios-desktop-notice";
    notice.innerHTML = `
      <div class="ios-desktop-notice-card">
        <p class="ios-desktop-notice-title">For the best experience, please use on desktop</p>
        <p class="ios-desktop-notice-sub">Tap anywhere to continue</p>
      </div>
    `;
    document.body.appendChild(notice);
    requestAnimationFrame(() => notice.classList.add("show"));

    notice.addEventListener(
      "click",
      () => {
        notice.classList.remove("show");
        setTimeout(() => notice.remove(), 240);
      },
      { once: true }
    );
  }

let iconWasDragged = false;

if (appIcon) {
  if (IS_MOBILE) {
    setupMobileHomeScreen();
    showMobileDesktopNotice();
  } else {
    makeIconDraggable(appIcon);

    appIcon.addEventListener("click", (e) => {
      if (iconWasDragged) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      launchApp();
    });
  }
} else {
  typeBlock(0);
  if (typeof typeAboutBlock === "function") {
    setTimeout(() => typeAboutBlock(0), 300);
  }
  document.querySelectorAll(".terminal-window").forEach((win) => {
    makeDraggable(win);
  });
}

});
