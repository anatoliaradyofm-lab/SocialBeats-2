import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, StatusBar,
  Dimensions, Alert, Animated, SafeAreaView, ScrollView, Modal,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, BRAND } from '../contexts/ThemeContext';
import { usePlayer } from '../contexts/PlayerContext';
import { useAuth } from '../contexts/AuthContext';

const { width: SW, height: SH } = Dimensions.get('window');

const AR_THEMES = [
  { id: 'party', label: 'Parti', icon: 'flash', colors: ['#FF006E', '#8338EC', '#3A86FF'], desc: 'Neon ışıklar, konfeti' },
  { id: 'chill', label: 'Chill', icon: 'cloud', colors: ['#06D6A0', '#118AB2', '#073B4C'], desc: 'Yumuşak bulutlar, pastel' },
  { id: 'nature', label: 'Doğa', icon: 'leaf', colors: ['#2D6A4F', '#40916C', '#74C69D'], desc: 'Yapraklar, su dalgaları' },
  { id: 'space', label: 'Uzay', icon: 'planet', colors: ['#240046', '#7B2CBF', '#E0AAFF'], desc: 'Gezegenler, yıldızlar' },
  { id: 'retro', label: 'Retro', icon: 'game-controller', colors: ['#FF006E', '#FB5607', '#FFBE0B'], desc: '80ler neon, piksel' },
  { id: 'festival', label: 'Festival', icon: 'bonfire', colors: ['#F72585', '#7209B7', '#4361EE'], desc: 'Lazerler, ışık sütunları' },
];

const VISUALIZER_TYPES = [
  { id: 'bars', label: 'Ekolayzır', icon: 'bar-chart' },
  { id: 'circles', label: 'Daire', icon: 'ellipse' },
  { id: 'particles', label: 'Parçacık', icon: 'sparkles' },
  { id: 'wave', label: 'Dalga', icon: 'water' },
  { id: 'tunnel', label: 'Tünel', icon: 'navigate' },
  { id: 'fractal', label: 'Fraktal', icon: 'snow' },
];

const FACE_EFFECTS = [
  { id: 'none', label: 'Yok', icon: 'close-circle' },
  { id: 'mask', label: 'Maske', icon: 'happy' },
  { id: 'glasses', label: 'Gözlük', icon: 'glasses' },
  { id: 'crown', label: 'Taç', icon: 'diamond' },
  { id: 'aura', label: 'Aura', icon: 'sunny' },
];

export default function ARExperienceScreen({ navigation }) {
  const { colors } = useTheme();
  const { currentTrack, isPlaying } = usePlayer();
  const webViewRef = useRef(null);
  const [selectedTheme, setSelectedTheme] = useState('party');
  const [selectedVis, setSelectedVis] = useState('bars');
  const [selectedFace, setSelectedFace] = useState('none');
  const [showControls, setShowControls] = useState(true);
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [cameraFacing, setCameraFacing] = useState('environment');
  const [isRecording, setIsRecording] = useState(false);
  const [arReady, setArReady] = useState(false);
  const controlsOpacity = useRef(new Animated.Value(1)).current;

  const toggleControls = useCallback(() => {
    const next = !showControls;
    setShowControls(next);
    Animated.timing(controlsOpacity, { toValue: next ? 1 : 0, duration: 250, useNativeDriver: true }).start();
  }, [showControls]);

  const sendToWebView = useCallback((action, data = {}) => {
    webViewRef.current?.injectJavaScript(`
      window.dispatchEvent(new CustomEvent('arAction', { detail: ${JSON.stringify({ action, ...data })} }));
      true;
    `);
  }, []);

  const handleThemeChange = (themeId) => {
    setSelectedTheme(themeId);
    sendToWebView('changeTheme', { theme: themeId });
  };

  const handleVisChange = (visId) => {
    setSelectedVis(visId);
    sendToWebView('changeVisualizer', { type: visId });
  };

  const handleFaceChange = (faceId) => {
    setSelectedFace(faceId);
    sendToWebView('changeFaceEffect', { effect: faceId });
  };

  const flipCamera = () => {
    const next = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(next);
    sendToWebView('flipCamera', { facing: next });
  };

  const capturePhoto = () => {
    sendToWebView('capturePhoto');
    Alert.alert('AR Fotoğraf', 'AR anınız kaydedildi!');
  };

  const toggleRecording = () => {
    if (isRecording) {
      sendToWebView('stopRecording');
      setIsRecording(false);
      Alert.alert('AR Video', 'Video kaydedildi!');
    } else {
      sendToWebView('startRecording');
      setIsRecording(true);
    }
  };

  const onWebViewMessage = (event) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'arReady') setArReady(true);
      if (msg.type === 'error') console.warn('AR Error:', msg.message);
    } catch {}
  };

  const arHTML = getARHTML(selectedTheme, selectedVis, selectedFace);

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <WebView
        ref={webViewRef}
        source={{ html: arHTML }}
        style={StyleSheet.absoluteFill}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        javaScriptEnabled
        domStorageEnabled
        startInLoadingState
        onMessage={onWebViewMessage}
        allowsFullscreenVideo
        mediaCapturePermissionGrantType="grant"
        originWhitelist={['*']}
      />

      <Animated.View style={[styles.overlay, { opacity: controlsOpacity }]} pointerEvents={showControls ? 'auto' : 'none'}>
        {/* Top bar */}
        <SafeAreaView style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.topBtn}>
            <Ionicons name="arrow-back" size={22} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.topCenter}>
            <View style={styles.arBadge}>
              <Text style={styles.arBadgeText}>AR</Text>
            </View>
            <Text style={styles.topTitle}>Müzik Deneyimi</Text>
          </View>
          <TouchableOpacity onPress={flipCamera} style={styles.topBtn}>
            <Ionicons name="camera-reverse" size={22} color="#FFF" />
          </TouchableOpacity>
        </SafeAreaView>

        {/* Track info */}
        {currentTrack && (
          <View style={styles.trackBanner}>
            <Ionicons name={isPlaying ? 'musical-notes' : 'pause'} size={16} color={BRAND.accent} />
            <Text style={styles.trackText} numberOfLines={1}>
              {currentTrack.title} — {currentTrack.artist}
            </Text>
          </View>
        )}

        {/* Right side controls */}
        <View style={styles.rightControls}>
          <TouchableOpacity style={styles.sideBtn} onPress={capturePhoto}>
            <Ionicons name="camera" size={24} color="#FFF" />
            <Text style={styles.sideBtnLabel}>Fotoğraf</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.sideBtn, isRecording && styles.recordingBtn]} onPress={toggleRecording}>
            <Ionicons name={isRecording ? 'stop-circle' : 'videocam'} size={24} color={isRecording ? '#FF3B30' : '#FFF'} />
            <Text style={styles.sideBtnLabel}>{isRecording ? 'Durdur' : 'Video'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.sideBtn} onPress={() => setShowThemePanel(true)}>
            <Ionicons name="color-palette" size={24} color="#FFF" />
            <Text style={styles.sideBtnLabel}>Tema</Text>
          </TouchableOpacity>
        </View>

        {/* Bottom visualizer selector */}
        <View style={styles.bottomBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.visScroll}>
            {VISUALIZER_TYPES.map(v => (
              <TouchableOpacity
                key={v.id}
                style={[styles.visBtn, selectedVis === v.id && styles.visBtnActive]}
                onPress={() => handleVisChange(v.id)}
              >
                <Ionicons name={v.icon} size={20} color={selectedVis === v.id ? BRAND.primary : '#FFF'} />
                <Text style={[styles.visBtnText, selectedVis === v.id && { color: BRAND.primary }]}>{v.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.faceScroll}>
            {FACE_EFFECTS.map(f => (
              <TouchableOpacity
                key={f.id}
                style={[styles.faceBtn, selectedFace === f.id && styles.faceBtnActive]}
                onPress={() => handleFaceChange(f.id)}
              >
                <Ionicons name={f.icon} size={16} color={selectedFace === f.id ? BRAND.accent : 'rgba(255,255,255,0.7)'} />
                <Text style={[styles.faceBtnText, selectedFace === f.id && { color: BRAND.accent }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Animated.View>

      <TouchableOpacity style={styles.toggleBtn} onPress={toggleControls} activeOpacity={0.7}>
        <Ionicons name={showControls ? 'eye-off' : 'eye'} size={18} color="#FFF" />
      </TouchableOpacity>

      {/* Theme selection modal */}
      <Modal visible={showThemePanel} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.themePanel, { backgroundColor: colors.background }]}>
            <View style={styles.themePanelHeader}>
              <Text style={[styles.themePanelTitle, { color: colors.text }]}>AR Temaları</Text>
              <TouchableOpacity onPress={() => setShowThemePanel(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.themeGrid}>
              {AR_THEMES.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.themeCard,
                    { backgroundColor: colors.surfaceElevated },
                    selectedTheme === t.id && { borderColor: BRAND.primary, borderWidth: 2 },
                  ]}
                  onPress={() => { handleThemeChange(t.id); setShowThemePanel(false); }}
                >
                  <View style={[styles.themePreview, { backgroundColor: t.colors[0] }]}>
                    <View style={[styles.themeGrad1, { backgroundColor: t.colors[1] }]} />
                    <View style={[styles.themeGrad2, { backgroundColor: t.colors[2] }]} />
                    <Ionicons name={t.icon} size={24} color="#FFF" />
                  </View>
                  <Text style={[styles.themeLabel, { color: colors.text }]}>{t.label}</Text>
                  <Text style={[styles.themeDesc, { color: colors.textMuted }]}>{t.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getARHTML(theme, visualizer, faceEffect) {
  const themeColors = {
    party: { primary: '#FF006E', secondary: '#8338EC', tertiary: '#3A86FF', bg: '#0a0015' },
    chill: { primary: '#06D6A0', secondary: '#118AB2', tertiary: '#073B4C', bg: '#021c2e' },
    nature: { primary: '#2D6A4F', secondary: '#40916C', tertiary: '#74C69D', bg: '#081c15' },
    space: { primary: '#7B2CBF', secondary: '#E0AAFF', tertiary: '#240046', bg: '#10002b' },
    retro: { primary: '#FF006E', secondary: '#FB5607', tertiary: '#FFBE0B', bg: '#1a0a00' },
    festival: { primary: '#F72585', secondary: '#7209B7', tertiary: '#4361EE', bg: '#0d0221' },
  };
  const tc = themeColors[theme] || themeColors.party;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{overflow:hidden;background:#000;font-family:system-ui}
#video{position:fixed;top:0;left:0;width:100%;height:100%;object-fit:cover;z-index:0;transform:scaleX(-1)}
#canvas3d{position:fixed;top:0;left:0;width:100%;height:100%;z-index:1;pointer-events:none}
#faceCanvas{position:fixed;top:0;left:0;width:100%;height:100%;z-index:2;pointer-events:none}
#loading{position:fixed;top:0;left:0;width:100%;height:100%;z-index:10;background:rgba(0,0,0,0.9);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-size:16px;gap:16px}
.spinner{width:48px;height:48px;border:3px solid rgba(255,255,255,0.2);border-top-color:${tc.primary};border-radius:50%;animation:spin 0.8s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
#loading.hidden{display:none}
</style>
</head>
<body>
<div id="loading"><div class="spinner"></div><div>AR Deneyimi Başlatılıyor...</div><div style="font-size:12px;opacity:0.6">Kamera izni gerekli</div></div>
<video id="video" autoplay playsinline muted></video>
<canvas id="canvas3d"></canvas>
<canvas id="faceCanvas"></canvas>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/mind-ar@1.2.2/dist/mindar-face.prod.js"></script>
<script src="https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js"></script>
<script>
(function(){
  const THEME = ${JSON.stringify(tc)};
  let currentVis = '${visualizer}';
  let currentFace = '${faceEffect}';
  let W = window.innerWidth, H = window.innerHeight;
  let stream = null, audioCtx = null, analyser = null, dataArray = null, freqArray = null;
  let scene, camera, renderer, clock;
  let particles = [], bars = [], rings = [], tunnelMesh = null;
  let facingMode = 'environment';
  let frameId = null;
  let bassLevel = 0, midLevel = 0, trebleLevel = 0, volume = 0, beatDetected = false;
  let lastBeatTime = 0, bpm = 120;
  let faceCtx = null;
  window.faceDetectionResult = null;
  let faceApiReady = false;

  async function initFaceApi() {
    if (typeof faceapi === 'undefined') return;
    try {
      const base = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights/';
      await faceapi.nets.tinyFaceDetector.loadFromUri(base);
      await faceapi.nets.faceLandmark68Net.loadFromUri(base);
      faceApiReady = true;
    } catch (e) { console.warn('face-api init:', e); }
  }

  async function runFaceDetection() {
    if (!faceApiReady || !document.getElementById('video').srcObject) return;
    try {
      const det = await faceapi.detectSingleFace(document.getElementById('video'), new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks();
      window.faceDetectionResult = det;
    } catch { window.faceDetectionResult = null; }
  }

  // ========== CAMERA ==========
  async function startCamera() {
    try {
      if (stream) stream.getTracks().forEach(t => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      document.getElementById('video').srcObject = stream;

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack && !audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.82;
        source.connect(analyser);
        dataArray = new Uint8Array(analyser.frequencyBinCount);
        freqArray = new Uint8Array(analyser.frequencyBinCount);
      }

      document.getElementById('loading').classList.add('hidden');
      initFaceApi();
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'arReady' }));
    } catch (e) {
      document.getElementById('loading').innerHTML = '<div style="color:#FF6B6B;text-align:center;padding:20px">Kamera erişimi reddedildi.<br><br><span style="font-size:13px;opacity:0.7">Lütfen ayarlardan kamera iznini verin.</span></div>';
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'error', message: e.message }));
    }
  }

  // ========== AUDIO ANALYSIS ==========
  function analyzeAudio() {
    if (!analyser) {
      bassLevel = 0.3 + Math.sin(Date.now() * 0.003) * 0.3;
      midLevel = 0.3 + Math.sin(Date.now() * 0.005) * 0.3;
      trebleLevel = 0.3 + Math.sin(Date.now() * 0.007) * 0.3;
      volume = (bassLevel + midLevel + trebleLevel) / 3;
      return;
    }
    analyser.getByteFrequencyData(freqArray);
    analyser.getByteTimeDomainData(dataArray);

    let bassSum = 0, midSum = 0, trebleSum = 0;
    const len = freqArray.length;
    const bassEnd = Math.floor(len * 0.15);
    const midEnd = Math.floor(len * 0.5);

    for (let i = 0; i < len; i++) {
      const val = freqArray[i] / 255;
      if (i < bassEnd) bassSum += val;
      else if (i < midEnd) midSum += val;
      else trebleSum += val;
    }
    bassLevel = bassSum / bassEnd;
    midLevel = midSum / (midEnd - bassEnd);
    trebleLevel = trebleSum / (len - midEnd);
    volume = (bassLevel + midLevel + trebleLevel) / 3;

    const now = Date.now();
    if (bassLevel > 0.65 && now - lastBeatTime > 200) {
      beatDetected = true;
      const interval = now - lastBeatTime;
      if (interval > 200 && interval < 2000) bpm = 60000 / interval;
      lastBeatTime = now;
    } else {
      beatDetected = false;
    }
  }

  // ========== THREE.JS SETUP ==========
  function initThree() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    camera.position.z = 5;
    clock = new THREE.Clock();

    renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('canvas3d'), alpha: true, antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    const pointLight = new THREE.PointLight(new THREE.Color(THEME.primary), 2, 50);
    pointLight.position.set(0, 3, 3);
    scene.add(pointLight);

    faceCtx = document.getElementById('faceCanvas').getContext('2d');
    document.getElementById('faceCanvas').width = W;
    document.getElementById('faceCanvas').height = H;

    buildVisualizer(currentVis);
  }

  // ========== VISUALIZERS ==========
  function clearScene() {
    for (let i = scene.children.length - 1; i >= 0; i--) {
      const obj = scene.children[i];
      if (obj.type !== 'AmbientLight' && obj.type !== 'PointLight') {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) { if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose()); else obj.material.dispose(); }
        scene.remove(obj);
      }
    }
    particles = []; bars = []; rings = []; tunnelMesh = null;
  }

  function buildVisualizer(type) {
    clearScene();
    switch(type) {
      case 'bars': buildBars(); break;
      case 'circles': buildCircles(); break;
      case 'particles': buildParticles(); break;
      case 'wave': buildWave(); break;
      case 'tunnel': buildTunnel(); break;
      case 'fractal': buildFractal(); break;
      default: buildBars();
    }
  }

  function buildBars() {
    const count = 64;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.BoxGeometry(0.08, 1, 0.08);
      const mat = new THREE.MeshPhongMaterial({
        color: new THREE.Color().setHSL(i / count, 0.9, 0.6),
        transparent: true, opacity: 0.85, emissive: new THREE.Color(THEME.primary), emissiveIntensity: 0.2
      });
      const bar = new THREE.Mesh(geo, mat);
      const angle = (i / count) * Math.PI * 2;
      const radius = 2.5;
      bar.position.set(Math.cos(angle) * radius, -1.5, Math.sin(angle) * radius - 3);
      bar.lookAt(0, -1.5, -3);
      scene.add(bar);
      bars.push(bar);
    }
  }

  function buildCircles() {
    for (let r = 0; r < 5; r++) {
      const geo = new THREE.TorusGeometry(1 + r * 0.6, 0.03, 8, 64);
      const mat = new THREE.MeshPhongMaterial({
        color: new THREE.Color().setHSL(r * 0.15, 0.9, 0.6),
        transparent: true, opacity: 0.7, emissive: new THREE.Color(THEME.secondary), emissiveIntensity: 0.3
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.position.z = -4;
      scene.add(ring);
      rings.push(ring);
    }
    buildParticleField(200);
  }

  function buildParticles() {
    buildParticleField(600);
  }

  function buildParticleField(count) {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const col1 = new THREE.Color(THEME.primary);
    const col2 = new THREE.Color(THEME.secondary);
    const col3 = new THREE.Color(THEME.tertiary);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 3;
      const c = [col1, col2, col3][i % 3];
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      sizes[i] = 0.03 + Math.random() * 0.06;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.08, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    particles.push(pts);
  }

  function buildWave() {
    const count = 128;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (i / count - 0.5) * 8;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = -3;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(THEME.primary), linewidth: 2 });
    const line = new THREE.Line(geo, mat);
    scene.add(line);
    bars.push(line);

    const geo2 = new THREE.BufferGeometry();
    const pos2 = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos2[i * 3] = (i / count - 0.5) * 8;
      pos2[i * 3 + 1] = 0;
      pos2[i * 3 + 2] = -3;
    }
    geo2.setAttribute('position', new THREE.BufferAttribute(pos2, 3));
    const mat2 = new THREE.LineBasicMaterial({ color: new THREE.Color(THEME.secondary), linewidth: 2 });
    const line2 = new THREE.Line(geo2, mat2);
    scene.add(line2);
    bars.push(line2);

    buildParticleField(150);
  }

  function buildTunnel() {
    const geo = new THREE.CylinderGeometry(2, 2, 20, 32, 20, true);
    const mat = new THREE.MeshPhongMaterial({
      color: new THREE.Color(THEME.primary), wireframe: true,
      transparent: true, opacity: 0.4, emissive: new THREE.Color(THEME.secondary), emissiveIntensity: 0.3, side: THREE.DoubleSide
    });
    tunnelMesh = new THREE.Mesh(geo, mat);
    tunnelMesh.rotation.x = Math.PI / 2;
    tunnelMesh.position.z = -10;
    scene.add(tunnelMesh);
    buildParticleField(300);
  }

  function buildFractal() {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.IcosahedronGeometry(0.5 + i * 0.2, 1);
      const mat = new THREE.MeshPhongMaterial({
        color: new THREE.Color().setHSL(i / count, 0.8, 0.5),
        wireframe: true, transparent: true, opacity: 0.6, emissive: new THREE.Color(THEME.primary), emissiveIntensity: 0.2
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.z = -4;
      scene.add(mesh);
      rings.push(mesh);
    }
    buildParticleField(250);
  }

  // ========== ANIMATION ==========
  function animate() {
    frameId = requestAnimationFrame(animate);
    analyzeAudio();
    const t = clock.getElapsedTime();
    const dt = clock.getDelta();

    switch(currentVis) {
      case 'bars': animateBars(t); break;
      case 'circles': animateCircles(t); break;
      case 'particles': animateParticles(t); break;
      case 'wave': animateWave(t); break;
      case 'tunnel': animateTunnel(t); break;
      case 'fractal': animateFractal(t); break;
    }

    animateParticleField(t);
    if (faceApiReady && frameId % 3 === 0) runFaceDetection();
    drawFaceEffects(t);

    renderer.render(scene, camera);
  }

  function animateBars(t) {
    if (!freqArray) return;
    bars.forEach((bar, i) => {
      const idx = Math.floor((i / bars.length) * (freqArray ? freqArray.length * 0.7 : 64));
      const val = freqArray ? freqArray[idx] / 255 : 0.3;
      const targetH = val * 4 + 0.1;
      bar.scale.y += (targetH - bar.scale.y) * 0.15;
      bar.material.emissiveIntensity = val * 0.8;
      bar.material.color.setHSL((i / bars.length + t * 0.05) % 1, 0.9, 0.3 + val * 0.4);
      if (beatDetected) bar.scale.x = bar.scale.z = 1.3;
      else { bar.scale.x += (1 - bar.scale.x) * 0.1; bar.scale.z = bar.scale.x; }
    });
  }

  function animateCircles(t) {
    rings.forEach((ring, i) => {
      const level = i < 2 ? bassLevel : i < 4 ? midLevel : trebleLevel;
      ring.rotation.x = t * (0.2 + i * 0.1) + level * 2;
      ring.rotation.y = t * (0.15 + i * 0.08);
      ring.scale.setScalar(1 + level * 0.8);
      ring.material.emissiveIntensity = level * 0.6;
      ring.material.opacity = 0.4 + level * 0.5;
    });
  }

  function animateParticles(t) {}

  function animateWave(t) {
    bars.forEach((line, li) => {
      const pos = line.geometry.attributes.position;
      const count = pos.count;
      for (let i = 0; i < count; i++) {
        const x = pos.getX(i);
        const freq = freqArray ? freqArray[Math.floor((i / count) * freqArray.length * 0.8)] / 255 : 0.3;
        pos.setY(i, Math.sin(x * 2 + t * 3 + li * Math.PI) * freq * 2);
      }
      pos.needsUpdate = true;
    });
  }

  function animateTunnel(t) {
    if (!tunnelMesh) return;
    tunnelMesh.rotation.z = t * 0.3;
    const speed = 0.5 + volume * 2;
    const geo = tunnelMesh.geometry;
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const r = 2 + Math.sin(y * 0.5 + t * speed) * bassLevel * 1.5;
      const angle = Math.atan2(pos.getZ(i), pos.getX(i));
      pos.setX(i, Math.cos(angle) * r);
      pos.setZ(i, Math.sin(angle) * r);
    }
    pos.needsUpdate = true;
    tunnelMesh.material.emissiveIntensity = volume * 0.8;
  }

  function animateFractal(t) {
    rings.forEach((mesh, i) => {
      mesh.rotation.x = t * (0.3 + i * 0.1) * (1 + bassLevel);
      mesh.rotation.y = t * (0.2 + i * 0.15) * (1 + midLevel);
      mesh.rotation.z = t * (0.1 + i * 0.05);
      const s = 1 + volume * 0.5 + (beatDetected ? 0.5 : 0);
      mesh.scale.setScalar(s);
      mesh.material.emissiveIntensity = volume * 0.5;
    });
  }

  function animateParticleField(t) {
    particles.forEach(pts => {
      const pos = pts.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i);
        y += (0.005 + volume * 0.03) * (1 + Math.sin(i));
        if (y > 4) y = -4;
        pos.setY(i, y);
        const x = pos.getX(i);
        pos.setX(i, x + Math.sin(t + i * 0.1) * 0.002 * (1 + bassLevel));
      }
      pos.needsUpdate = true;
      pts.rotation.y = t * 0.05;
      pts.material.opacity = 0.5 + volume * 0.5;
    });
  }

  // ========== FACE EFFECTS ==========
  function drawFaceEffects(t) {
    if (!faceCtx || currentFace === 'none') {
      if (faceCtx) faceCtx.clearRect(0, 0, W, H);
      return;
    }
    faceCtx.clearRect(0, 0, W, H);

    let cx = W / 2, cy = H * 0.35;
    const fd = window.faceDetectionResult;
    if (fd && fd.landmarks) {
      const nose = fd.landmarks.positions[30] || (fd.detection?.box ? { x: fd.detection.box.x + fd.detection.box.width/2, y: fd.detection.box.y + fd.detection.box.height/2 } : null);
      const v = document.getElementById('video');
      if (nose && v && v.videoWidth) {
        cx = (nose.x / v.videoWidth) * W;
        cy = (nose.y / v.videoHeight) * H;
      }
    }

    if (currentFace === 'aura') {
      const r = 80 + volume * 60;
      const grad = faceCtx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r);
      const hue = (t * 30) % 360;
      grad.addColorStop(0, 'hsla(' + hue + ',90%,60%,0.3)');
      grad.addColorStop(0.5, 'hsla(' + ((hue + 60) % 360) + ',80%,50%,0.15)');
      grad.addColorStop(1, 'transparent');
      faceCtx.fillStyle = grad;
      faceCtx.fillRect(0, 0, W, H);
      for (let i = 0; i < 3; i++) {
        faceCtx.beginPath();
        const rr = r * (0.8 + i * 0.3) + Math.sin(t * 2 + i) * 10;
        faceCtx.arc(cx, cy, rr, 0, Math.PI * 2);
        faceCtx.strokeStyle = 'hsla(' + ((hue + i * 40) % 360) + ',80%,60%,' + (0.3 - i * 0.08) + ')';
        faceCtx.lineWidth = 2;
        faceCtx.stroke();
      }
    }
    else if (currentFace === 'mask') {
      const hue = (t * 40 + bassLevel * 100) % 360;
      faceCtx.save();
      faceCtx.globalAlpha = 0.5 + volume * 0.3;
      const grad = faceCtx.createLinearGradient(cx - 60, cy - 50, cx + 60, cy + 50);
      grad.addColorStop(0, 'hsla(' + hue + ',90%,50%,0.4)');
      grad.addColorStop(1, 'hsla(' + ((hue + 120) % 360) + ',90%,50%,0.4)');
      faceCtx.fillStyle = grad;
      faceCtx.beginPath();
      faceCtx.ellipse(cx, cy, 70 + bassLevel * 20, 85 + bassLevel * 20, 0, 0, Math.PI * 2);
      faceCtx.fill();
      faceCtx.restore();
    }
    else if (currentFace === 'glasses') {
      const y = cy - 5;
      faceCtx.strokeStyle = THEME.primary;
      faceCtx.lineWidth = 3;
      faceCtx.shadowColor = THEME.primary;
      faceCtx.shadowBlur = 10 + volume * 20;
      faceCtx.beginPath();
      faceCtx.ellipse(cx - 30, y, 22, 18, 0, 0, Math.PI * 2);
      faceCtx.stroke();
      faceCtx.beginPath();
      faceCtx.ellipse(cx + 30, y, 22, 18, 0, 0, Math.PI * 2);
      faceCtx.stroke();
      faceCtx.beginPath();
      faceCtx.moveTo(cx - 8, y);
      faceCtx.lineTo(cx + 8, y);
      faceCtx.stroke();
      faceCtx.shadowBlur = 0;
    }
    else if (currentFace === 'crown') {
      const y = cy - 75;
      const hue = (t * 20) % 360;
      faceCtx.save();
      faceCtx.translate(cx, y);
      faceCtx.rotate(Math.sin(t * (bpm / 60)) * 0.05);
      faceCtx.fillStyle = 'hsla(' + hue + ',80%,55%,0.8)';
      faceCtx.beginPath();
      faceCtx.moveTo(-40, 20); faceCtx.lineTo(-40, -5); faceCtx.lineTo(-25, 5);
      faceCtx.lineTo(-10, -15); faceCtx.lineTo(0, 0); faceCtx.lineTo(10, -15);
      faceCtx.lineTo(25, 5); faceCtx.lineTo(40, -5); faceCtx.lineTo(40, 20);
      faceCtx.closePath();
      faceCtx.fill();
      faceCtx.strokeStyle = 'rgba(255,255,255,0.6)';
      faceCtx.lineWidth = 1.5;
      faceCtx.stroke();
      for (let i = -1; i <= 1; i++) {
        faceCtx.fillStyle = i === 0 ? '#FFD700' : THEME.secondary;
        faceCtx.beginPath();
        faceCtx.arc(i * 20, -5 + Math.abs(i) * 10, 4, 0, Math.PI * 2);
        faceCtx.fill();
      }
      faceCtx.restore();
    }
  }

  // ========== EVENT HANDLERS ==========
  window.addEventListener('arAction', function(e) {
    const d = e.detail;
    switch(d.action) {
      case 'changeTheme':
        location.reload();
        break;
      case 'changeVisualizer':
        currentVis = d.type;
        buildVisualizer(d.type);
        break;
      case 'changeFaceEffect':
        currentFace = d.effect;
        break;
      case 'flipCamera':
        facingMode = d.facing;
        startCamera();
        break;
      case 'capturePhoto':
        captureFrame();
        break;
    }
  });

  function captureFrame() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const video = document.getElementById('video');
    ctx.drawImage(video, 0, 0, W, H);
    ctx.drawImage(document.getElementById('canvas3d'), 0, 0, W, H);
    ctx.drawImage(document.getElementById('faceCanvas'), 0, 0, W, H);
  }

  window.addEventListener('resize', function() {
    W = window.innerWidth; H = window.innerHeight;
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    renderer.setSize(W, H);
    document.getElementById('faceCanvas').width = W;
    document.getElementById('faceCanvas').height = H;
  });

  // ========== INIT ==========
  initThree();
  startCamera();
  animate();
})();
</script>
</body>
</html>`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 50, paddingBottom: 8,
  },
  topBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  topCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  arBadge: {
    backgroundColor: BRAND.primary, paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  arBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  topTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  trackBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 8, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    alignSelf: 'flex-start',
  },
  trackText: { color: '#FFF', fontSize: 12, fontWeight: '500', maxWidth: SW * 0.6 },
  rightControls: {
    position: 'absolute', right: 16, top: SH * 0.35,
    gap: 20, alignItems: 'center',
  },
  sideBtn: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },
  recordingBtn: { backgroundColor: 'rgba(255,59,48,0.3)' },
  sideBtnLabel: { color: '#FFF', fontSize: 9, fontWeight: '600', marginTop: 2 },
  bottomBar: {
    position: 'absolute', bottom: 30, left: 0, right: 0,
    paddingBottom: 10,
  },
  visScroll: { paddingHorizontal: 16, gap: 10 },
  visBtn: {
    alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  visBtnActive: { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: BRAND.primary },
  visBtnText: { color: '#FFF', fontSize: 10, fontWeight: '600', marginTop: 3 },
  faceScroll: { paddingHorizontal: 16, gap: 8, marginTop: 10 },
  faceBtn: {
    alignItems: 'center', paddingVertical: 5, paddingHorizontal: 10,
    borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.4)',
  },
  faceBtnActive: { borderWidth: 1, borderColor: BRAND.accent },
  faceBtnText: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '500', marginTop: 2 },
  toggleBtn: {
    position: 'absolute', top: SH * 0.5, left: 10, zIndex: 20,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
  },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  themePanel: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40,
    maxHeight: SH * 0.7,
  },
  themePanelHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  themePanelTitle: { fontSize: 20, fontWeight: '700' },
  themeGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    gap: 12, justifyContent: 'space-between',
  },
  themeCard: {
    width: (SW - 64) / 2, borderRadius: 16, overflow: 'hidden',
    paddingBottom: 12,
  },
  themePreview: {
    height: 80, justifyContent: 'center', alignItems: 'center',
    position: 'relative', overflow: 'hidden',
  },
  themeGrad1: {
    position: 'absolute', width: 60, height: 60, borderRadius: 30,
    top: -10, right: -10, opacity: 0.6,
  },
  themeGrad2: {
    position: 'absolute', width: 40, height: 40, borderRadius: 20,
    bottom: -5, left: 10, opacity: 0.5,
  },
  themeLabel: { fontSize: 14, fontWeight: '600', marginTop: 8, paddingHorizontal: 10 },
  themeDesc: { fontSize: 11, marginTop: 2, paddingHorizontal: 10 },
});
