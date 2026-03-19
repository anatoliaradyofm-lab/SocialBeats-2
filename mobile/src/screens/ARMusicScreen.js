/**
 * ARMusicScreen — Professional AR Music Experience
 * Stack: MindAR (face tracking) · Three.js (3D) · MediaPipe (landmarks) · WebView bridge
 * All open-source & free.
 */
import React, { useRef, useCallback, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, StatusBar, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlayer } from '../contexts/PlayerContext';

// ─── Inline AR HTML (Three.js + MindAR + MediaPipe) ──────────────────────────
const AR_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <title>SocialBeats AR</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden;background:#000;font-family:-apple-system,sans-serif}

    /* Loading */
    #loading{
      position:fixed;inset:0;display:flex;flex-direction:column;
      align-items:center;justify-content:center;
      background:linear-gradient(160deg,#0a0015 0%,#1a0a3c 50%,#0a0015 100%);
      z-index:9999;transition:opacity .6s ease;
    }
    .spin{
      width:72px;height:72px;border-radius:50%;
      border:3px solid rgba(167,139,250,.2);
      border-top-color:#A78BFA;
      animation:spin 1s linear infinite;
      margin-bottom:24px;
      box-shadow:0 0 40px rgba(167,139,250,.4);
    }
    @keyframes spin{to{transform:rotate(360deg)}}
    .ld-title{color:#A78BFA;font-size:15px;font-weight:800;letter-spacing:3px}
    .ld-sub{color:rgba(255,255,255,.35);font-size:11px;margin-top:8px;letter-spacing:2px}
    .ld-libs{
      margin-top:20px;display:flex;gap:8px;flex-wrap:wrap;justify-content:center;
    }
    .ld-badge{
      background:rgba(167,139,250,.15);border:1px solid rgba(167,139,250,.3);
      border-radius:12px;padding:4px 10px;color:#C4B5FD;font-size:10px;letter-spacing:1px;
    }

    /* AR badge */
    #ar-badge{
      position:fixed;top:16px;left:50%;transform:translateX(-50%);
      background:rgba(124,58,237,.55);backdrop-filter:blur(10px);
      border:1px solid rgba(167,139,250,.45);border-radius:24px;
      padding:7px 18px;display:flex;align-items:center;gap:8px;
      z-index:100;pointer-events:none;
    }
    .ar-dot{width:8px;height:8px;border-radius:50%;background:#34D399;animation:blink 1.4s infinite}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:.2}}
    .ar-txt{color:#fff;font-size:11px;font-weight:800;letter-spacing:2.5px}

    /* Face mesh canvas (MediaPipe) */
    #mp-canvas{position:fixed;inset:0;pointer-events:none;z-index:10}

    /* HUD bottom */
    #hud{
      position:fixed;bottom:0;left:0;right:0;
      background:linear-gradient(transparent,rgba(0,0,0,.82));
      padding:12px 20px 40px;z-index:100;
    }
    .track-wrap{text-align:center;margin-bottom:14px}
    .tr-title{
      color:#fff;font-size:17px;font-weight:800;
      text-shadow:0 0 24px rgba(167,139,250,.9);
      white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
    }
    .tr-artist{color:rgba(255,255,255,.6);font-size:13px;margin-top:3px}

    .controls{display:flex;align-items:center;justify-content:center;gap:28px}
    .c-btn{
      width:54px;height:54px;border-radius:27px;
      background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.18);
      color:#fff;font-size:20px;display:flex;align-items:center;justify-content:center;
      cursor:pointer;-webkit-tap-highlight-color:transparent;
      backdrop-filter:blur(6px);
    }
    .c-btn:active{transform:scale(.92)}
    .c-play{
      width:70px;height:70px;border-radius:35px;
      background:linear-gradient(135deg,#6D28D9,#A78BFA);border:none;
      font-size:28px;
      box-shadow:0 0 40px rgba(124,58,237,.8),0 6px 20px rgba(0,0,0,.5);
    }

    /* Error state */
    #error{
      display:none;position:fixed;inset:0;flex-direction:column;
      align-items:center;justify-content:center;background:#0a0015;z-index:9998;
    }
    .err-icon{font-size:56px;margin-bottom:16px}
    .err-title{color:#fff;font-size:18px;font-weight:700;text-align:center}
    .err-sub{color:rgba(255,255,255,.45);font-size:13px;margin-top:8px;text-align:center;padding:0 32px;line-height:1.6}
    .err-btn{
      margin-top:24px;background:#7C3AED;color:#fff;border:none;
      padding:14px 32px;border-radius:28px;font-size:15px;font-weight:700;cursor:pointer;
    }
  </style>
</head>
<body>

<!-- Loading -->
<div id="loading">
  <div class="spin"></div>
  <div class="ld-title">AR INITIALIZING</div>
  <div class="ld-sub">LOADING MODULES</div>
  <div class="ld-libs">
    <span class="ld-badge">Three.js</span>
    <span class="ld-badge">MindAR</span>
    <span class="ld-badge">MediaPipe</span>
  </div>
</div>

<!-- Error fallback -->
<div id="error">
  <div class="err-icon">📷</div>
  <div class="err-title">Kamera Erişimi Gerekli</div>
  <div class="err-sub">AR deneyimi için kameraya erişim izni verin.</div>
  <button class="err-btn" onclick="retryAR()">Tekrar Dene</button>
</div>

<!-- AR badge -->
<div id="ar-badge">
  <div class="ar-dot"></div>
  <span class="ar-txt">AR LIVE</span>
</div>

<!-- MediaPipe face mesh canvas -->
<canvas id="mp-canvas"></canvas>

<!-- HUD controls -->
<div id="hud">
  <div class="track-wrap">
    <div class="tr-title" id="tr-title">SocialBeats AR</div>
    <div class="tr-artist" id="tr-artist">Müzik Çalınmıyor</div>
  </div>
  <div class="controls">
    <div class="c-btn" id="btn-prev">⏮</div>
    <div class="c-btn c-play" id="btn-play">▶</div>
    <div class="c-btn" id="btn-next">⏭</div>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     Three.js · MindAR · MediaPipe (all open-source, free, via CDN)
     ═══════════════════════════════════════════════════════════════════════════ -->
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-face-three.prod.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/face_mesh.js" crossorigin="anonymous"></script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils@0.3.1632090571/camera_utils.js" crossorigin="anonymous"></script>

<script>
// ── State ────────────────────────────────────────────────────────────────────
let isPlaying = false;
let currentCover = '';
let mindarThree = null;
let threeReady = false;

// AR 3D objects
let haloMesh, eqGroup, eqBars = [], pulseRings = [], particles, albumDisc, albumTex;
let threeRenderer, threeScene, threeCamera;
const clock = new THREE.Clock();

// MediaPipe face mesh canvas
const mpCanvas  = document.getElementById('mp-canvas');
const mpCtx     = mpCanvas.getContext('2d');
let mpReady     = false;
let lastFaceLandmarks = null;

// ── RN Bridge ────────────────────────────────────────────────────────────────
function sendRN(type, action) {
  try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type, action })); }
  catch(e) {}
}

// Receive from React Native
document.addEventListener('message', handleRNMessage);
window.addEventListener('message', handleRNMessage);

function handleRNMessage(e) {
  try {
    const data = JSON.parse(e.data);
    if (data.type === 'TRACK_UPDATE') updateTrack(data.track);
  } catch(e) {}
}

function updateTrack(track) {
  document.getElementById('tr-title').textContent  = track.title  || 'SocialBeats AR';
  document.getElementById('tr-artist').textContent = track.artist || '';
  isPlaying = track.isPlaying;
  document.getElementById('btn-play').textContent = isPlaying ? '⏸' : '▶';
  if (track.cover && track.cover !== currentCover) {
    currentCover = track.cover;
    loadAlbumTexture(currentCover);
  }
  syncPlayState();
}

// ── Controls ─────────────────────────────────────────────────────────────────
document.getElementById('btn-play').addEventListener('click', () => sendRN('CONTROL', 'play'));
document.getElementById('btn-prev').addEventListener('click', () => sendRN('CONTROL', 'prev'));
document.getElementById('btn-next').addEventListener('click', () => sendRN('CONTROL', 'next'));

// ── Three.js: helper factories ────────────────────────────────────────────────
function makeHalo() {
  const geom = new THREE.TorusGeometry(0.23, 0.014, 8, 96);
  const mat  = new THREE.MeshBasicMaterial({ color: 0xA78BFA, transparent: true, opacity: 0.95 });
  haloMesh   = new THREE.Mesh(geom, mat);
  haloMesh.rotation.x = Math.PI / 2;
  return haloMesh;
}

function makeAlbumDisc() {
  const group = new THREE.Group();
  // Outer ring
  const ringGeom = new THREE.RingGeometry(0.10, 0.14, 64);
  const ringMat  = new THREE.MeshBasicMaterial({ color: 0xC4B5FD, side: THREE.DoubleSide });
  group.add(new THREE.Mesh(ringGeom, ringMat));
  // Disc body
  const discGeom = new THREE.CircleGeometry(0.10, 64);
  albumTex       = null; // filled later
  const discMat  = new THREE.MeshBasicMaterial({ color: 0x4C1D95 });
  albumDisc      = new THREE.Mesh(discGeom, discMat);
  group.add(albumDisc);
  // Center dot
  const dotGeom = new THREE.CircleGeometry(0.016, 32);
  const dotMat  = new THREE.MeshBasicMaterial({ color: 0xffffff });
  group.add(new THREE.Mesh(dotGeom, dotMat));
  return group;
}

function makeEQBars() {
  eqGroup = new THREE.Group();
  const colors = [0xA78BFA, 0x60A5FA, 0x34D399, 0xF472B6, 0xFBBF24];
  const count  = 14;
  for (let i = 0; i < count; i++) {
    const h    = 0.04;
    const geom = new THREE.BoxGeometry(0.028, h, 0.01);
    const mat  = new THREE.MeshBasicMaterial({ color: colors[i % colors.length], transparent: true, opacity: 0.9 });
    const bar  = new THREE.Mesh(geom, mat);
    bar.position.x = (i - count / 2) * 0.038;
    bar.position.y = h / 2;
    eqGroup.add(bar);
    eqBars.push(bar);
  }
  return eqGroup;
}

function makePulseRings(parent) {
  const ringColors = [0xA78BFA, 0x60A5FA, 0xF472B6];
  for (let i = 0; i < 3; i++) {
    const r    = 0.22 + i * 0.09;
    const geom = new THREE.RingGeometry(r, r + 0.012, 72);
    const mat  = new THREE.MeshBasicMaterial({ color: ringColors[i], transparent: true, opacity: 0, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(geom, mat);
    parent.add(ring);
    pulseRings.push({ mesh: ring, offset: i / 3 });
  }
}

function makeParticles(scene) {
  const count = 500;
  const pos   = new Float32Array(count * 3);
  const col   = new Float32Array(count * 3);
  const palette = [[0.655,0.545,0.98],[0.376,0.647,0.98],[0.204,0.827,0.624],[0.957,0.447,0.71],[0.98,0.753,0.153]];
  for (let i = 0; i < count; i++) {
    pos[i*3]   = (Math.random()-0.5)*2.4;
    pos[i*3+1] = (Math.random()-0.5)*3.5;
    pos[i*3+2] = (Math.random()-0.5)*1.2;
    const c    = palette[i % palette.length];
    col[i*3]=c[0]; col[i*3+1]=c[1]; col[i*3+2]=c[2];
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  particles = new THREE.Points(geom, new THREE.PointsMaterial({
    size: 0.014, vertexColors: true, transparent: true, opacity: 0.7, sizeAttenuation: true,
  }));
  scene.add(particles);
}

// ── Texture loader for album art ──────────────────────────────────────────────
function loadAlbumTexture(url) {
  if (!url || !albumDisc) return;
  new THREE.TextureLoader().load(url, (tex) => {
    tex.minFilter = THREE.LinearFilter;
    albumDisc.material.map  = tex;
    albumDisc.material.color.set(0xffffff);
    albumDisc.material.needsUpdate = true;
  });
}

// ── Sync 3D state with play state ─────────────────────────────────────────────
function syncPlayState() {
  if (!threeReady) return;
  if (haloMesh)     haloMesh.material.color.setHex(isPlaying ? 0xA78BFA : 0x4B5563);
  if (particles)    particles.material.opacity = isPlaying ? 0.7 : 0.2;
  eqBars.forEach(b => { b.material.opacity = isPlaying ? 0.9 : 0.3; });
}

// ── Three.js animation loop ───────────────────────────────────────────────────
function animateFrame() {
  const t = clock.getElapsedTime();

  // Halo glow pulse
  if (haloMesh) {
    haloMesh.rotation.z += 0.012;
    const s = 1 + Math.sin(t * 2.2) * (isPlaying ? 0.06 : 0.01);
    haloMesh.scale.setScalar(s);
  }

  // EQ bars beat simulation
  eqBars.forEach((bar, i) => {
    if (isPlaying) {
      const scaleY = 1 + Math.abs(Math.sin(t * (2.5 + i * 0.6) + i * 0.8)) * 5;
      bar.scale.y  = scaleY;
    } else {
      bar.scale.y += (1 - bar.scale.y) * 0.1;
    }
  });

  // Pulse rings expand
  pulseRings.forEach(({ mesh, offset }) => {
    if (isPlaying) {
      const phase = (t * 0.7 + offset) % 1;
      mesh.scale.setScalar(1 + phase * 2.8);
      mesh.material.opacity = 0.55 * (1 - phase);
    } else {
      mesh.material.opacity += (0 - mesh.material.opacity) * 0.1;
    }
  });

  // Particles drift
  if (particles) {
    particles.rotation.y += 0.0025;
    particles.rotation.x += isPlaying ? 0.001 : 0.0003;
  }

  // Album disc spin
  if (albumDisc && isPlaying) albumDisc.parent.rotation.z += 0.009;

  threeRenderer.render(threeScene, threeCamera);
}

// ── MediaPipe Face Mesh ───────────────────────────────────────────────────────
function initMediaPipe(videoElement) {
  try {
    const faceMesh = new FaceMesh({ locateFile: (f) =>
      'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/' + f
    });
    faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: true, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
    faceMesh.onResults(onMPResults);

    const cam = new Camera(videoElement, {
      onFrame: async () => { await faceMesh.send({ image: videoElement }); },
      width: 640, height: 480,
    });
    cam.start();
    mpReady = true;
  } catch(e) { /* MediaPipe optional */ }
}

function onMPResults(results) {
  mpCanvas.width  = mpCanvas.clientWidth  * window.devicePixelRatio;
  mpCanvas.height = mpCanvas.clientHeight * window.devicePixelRatio;
  mpCtx.clearRect(0, 0, mpCanvas.width, mpCanvas.height);
  if (!results.multiFaceLandmarks?.length) return;

  const lm  = results.multiFaceLandmarks[0];
  const W   = mpCanvas.width;
  const H   = mpCanvas.height;

  // Draw face contour lines (outer silhouette)
  const CONTOUR_INDICES = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10];
  mpCtx.beginPath();
  CONTOUR_INDICES.forEach((idx, i) => {
    const p = lm[idx];
    const x = (1 - p.x) * W;  // flip horizontal
    const y = p.y * H;
    if (i === 0) mpCtx.moveTo(x, y);
    else mpCtx.lineTo(x, y);
  });
  mpCtx.closePath();
  mpCtx.strokeStyle = 'rgba(167,139,250,0.55)';
  mpCtx.lineWidth   = 1.5;
  mpCtx.stroke();

  // Draw eye contours
  [[33,7,163,144,145,153,154,155,133,33],[362,382,381,380,374,373,390,249,263,362]].forEach(ring => {
    mpCtx.beginPath();
    ring.forEach((idx, i) => {
      const p = lm[idx]; const x=(1-p.x)*W; const y=p.y*H;
      if (i===0) mpCtx.moveTo(x,y); else mpCtx.lineTo(x,y);
    });
    mpCtx.closePath();
    mpCtx.strokeStyle = 'rgba(96,165,250,0.7)';
    mpCtx.lineWidth   = 1.2;
    mpCtx.stroke();
  });

  // Draw lips outline
  const LIPS = [61,185,40,39,37,0,267,269,270,409,308,324,318,402,317,14,87,178,88,95,61];
  mpCtx.beginPath();
  LIPS.forEach((idx, i) => {
    const p = lm[idx]; const x=(1-p.x)*W; const y=p.y*H;
    if (i===0) mpCtx.moveTo(x,y); else mpCtx.lineTo(x,y);
  });
  mpCtx.closePath();
  mpCtx.strokeStyle = isPlaying ? 'rgba(244,114,182,0.75)' : 'rgba(167,139,250,0.5)';
  mpCtx.lineWidth   = 1.5;
  mpCtx.stroke();

  // Glowing key landmark dots
  const KEY_DOTS = [1, 33, 263, 61, 291, 199, 10, 152];
  KEY_DOTS.forEach(idx => {
    const p = lm[idx];
    const x = (1-p.x)*W; const y = p.y*H;
    const grad = mpCtx.createRadialGradient(x,y,0, x,y,5);
    grad.addColorStop(0, 'rgba(167,139,250,0.9)');
    grad.addColorStop(1, 'rgba(167,139,250,0)');
    mpCtx.beginPath();
    mpCtx.arc(x, y, 5, 0, Math.PI*2);
    mpCtx.fillStyle = grad;
    mpCtx.fill();
  });

  // Beat-glow all landmarks when playing
  if (isPlaying) {
    const t = clock.getElapsedTime();
    const glowAlpha = 0.12 + Math.abs(Math.sin(t*3)) * 0.18;
    lm.forEach(p => {
      mpCtx.beginPath();
      mpCtx.arc((1-p.x)*W, p.y*H, 1.2, 0, Math.PI*2);
      mpCtx.fillStyle = 'rgba(167,139,250,' + glowAlpha + ')';
      mpCtx.fill();
    });
  }
}

// ── Main AR Init ──────────────────────────────────────────────────────────────
async function initAR() {
  try {
    mindarThree = new window.MINDAR.FACE.MindARThree({ container: document.body });
    const { renderer, scene, camera } = mindarThree;
    threeRenderer = renderer; threeScene = scene; threeCamera = camera;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // ── Anchor 10: Forehead → Halo + Pulse rings ──
    const forehead = mindarThree.addAnchor(10);
    forehead.group.add(makeHalo());
    makePulseRings(forehead.group);

    // ── Anchor 1: Nose → Album disc ──
    const nose     = mindarThree.addAnchor(1);
    const disc     = makeAlbumDisc();
    disc.position.set(0, 0.12, 0.06);
    nose.group.add(disc);

    // ── Anchor 152: Chin → EQ bars ──
    const chin     = mindarThree.addAnchor(152);
    const eq       = makeEQBars();
    eq.position.set(0, -0.07, 0.03);
    chin.group.add(eq);

    // ── Scene: particle field ──
    makeParticles(scene);

    // ── Ambient light ──
    scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    // ── Start MindAR ──
    await mindarThree.start();
    threeReady = true;

    // ── Init MediaPipe on same video feed ──
    const videoEl = document.querySelector('video');
    if (videoEl && typeof FaceMesh !== 'undefined') initMediaPipe(videoEl);

    // ── Hide loading ──
    const ld = document.getElementById('loading');
    ld.style.opacity = '0';
    setTimeout(() => { ld.style.display = 'none'; }, 600);

    // ── Resize MediaPipe canvas ──
    function resize() {
      mpCanvas.style.width  = window.innerWidth  + 'px';
      mpCanvas.style.height = window.innerHeight + 'px';
    }
    resize();
    window.addEventListener('resize', resize);

    // ── Animation loop ──
    renderer.setAnimationLoop(animateFrame);

  } catch(err) {
    console.error('AR init failed:', err);
    document.getElementById('loading').style.display = 'none';
    const errEl = document.getElementById('error');
    errEl.style.display = 'flex';
  }
}

function retryAR() {
  document.getElementById('error').style.display = 'none';
  document.getElementById('loading').style.display = 'flex';
  initAR();
}

window.addEventListener('load', initAR);
</script>
</body>
</html>
`;

// ─── React Native Shell ───────────────────────────────────────────────────────
export default function ARMusicScreen({ navigation }) {
  const webviewRef = useRef(null);
  const insets     = useSafeAreaInsets();
  const { currentTrack, isPlaying, togglePlay, playNext, playPrevious } = usePlayer();

  // Push track state into WebView whenever it changes
  useEffect(() => {
    if (!webviewRef.current) return;
    const msg = JSON.stringify({
      type: 'TRACK_UPDATE',
      track: {
        title:     currentTrack?.title  || '',
        artist:    currentTrack?.artist || '',
        cover:     currentTrack?.thumbnail || currentTrack?.cover_url || currentTrack?.cover || '',
        isPlaying,
      },
    });
    webviewRef.current.postMessage(msg);
  }, [currentTrack, isPlaying]);

  // Handle control events from WebView
  const handleMessage = useCallback((e) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data.type === 'CONTROL') {
        if (data.action === 'play') togglePlay();
        else if (data.action === 'next') playNext();
        else if (data.action === 'prev') playPrevious();
      }
    } catch (_) {}
  }, [togglePlay, playNext, playPrevious]);

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      <WebView
        ref={webviewRef}
        source={{ html: AR_HTML, baseUrl: 'https://localhost' }}
        style={styles.webview}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsAirPlayForMediaPlayback
        // iOS: auto-grant camera permission
        mediaCapturePermissionGrantType="grant"
        // Android: grant camera/mic permissions
        onPermissionRequest={(req) => req.grant(req.resources)}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={() => true}
        scrollEnabled={false}
        bounces={false}
        // Allow mixed content (CDN scripts)
        mixedContentMode="always"
        // Better perf
        renderToHardwareTextureAndroid
        setSupportMultipleWindows={false}
      />

      {/* Back button — always visible on top */}
      <TouchableOpacity
        style={[styles.backBtn, { top: insets.top + 12 }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <Ionicons name="chevron-down" size={22} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root:    { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.2)',
    zIndex: 999,
  },
});
