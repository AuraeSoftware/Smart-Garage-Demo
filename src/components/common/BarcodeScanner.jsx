import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Dropdown } from './UI';
import barcodeScannerIcon from '../../assets/icons/barcode-scanner-icon.png';
import editIcon from '../../assets/icons/edit-icon.png';
import circleIcon from '../../assets/icons/circle-icon.png';
import notificationIcon from '../../assets/icons/notification-icon.png';

// ─── Audio Beep Feedback ─────────────────────────────────────────────────────
const beep = (frequency = 880, duration = 300) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); 
    g.connect(ctx.destination);
    osc.frequency.value = frequency;
    g.gain.setValueAtTime(0, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + (duration / 1000));
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + (duration / 1000));
  } catch (_) { }
};

// ─── Scanner Engine: Webcam Barcode Detection ────────────────────────────────
async function startBarcodeDetection(videoEl, onDetect, cancelRef) {
  // Use native BarcodeDetector API if available (Chrome 83+, Edge, Android)
  const detector = window.BarcodeDetector
    ? new window.BarcodeDetector({ 
        formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39', 'itf', 'codabar', 'data_matrix', 'aztec', 'pdf417'] 
      })
    : null;

  const canvas = document.createElement('canvas');
  const ctx2d = canvas.getContext('2d', { willReadFrequently: true });
  let lastDetectedCode = null;
  let lastDetectTime = 0;

  const tick = async () => {
    if (cancelRef.current) return;
    if (videoEl.readyState < 2) { requestAnimationFrame(tick); return; }

    try {
      if (detector) {
        const results = await detector.detect(videoEl);
        if (results?.length) { 
          const rawValue = results[0].rawValue;
          // Debounce: ignore if same code detected within 500ms
          if (rawValue && rawValue !== lastDetectedCode) {
            lastDetectedCode = rawValue;
            lastDetectTime = Date.now();
            onDetect(rawValue);
            return; // Exit to let handler cleanup
          } else if (rawValue === lastDetectedCode && Date.now() - lastDetectTime > 500) {
            lastDetectedCode = null; // Reset for next detection
          }
        }
      } else {
        // Canvas fallback (no barcode detection, just keeps looping)
        canvas.width = videoEl.videoWidth;
        canvas.height = videoEl.videoHeight;
        ctx2d.drawImage(videoEl, 0, 0);
      }
    } catch (_) { }

    // Schedule next frame (throttled to ~15fps)
    if (!cancelRef.current) {
      setTimeout(() => { if (!cancelRef.current) requestAnimationFrame(tick); }, 67);
    }
  };

  requestAnimationFrame(tick);
}

// ─── External Scanner Device Detection ────────────────────────────────────
async function getAvailableCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(d => d.kind === 'videoinput').map(d => ({ id: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 5)}` }));
  } catch (_) {
    return [];
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT: Multi-Device Barcode Scanner
// Supports: Physical/External Scanners, Webcam, Manual Input
// ═════════════════════════════════════════════════════════════════════════════
export const BarcodeScanner = ({ onConfirm, onClose }) => {
  const [mode, setMode] = useState('external'); // 'external' | 'manual' | 'camera'
  const [manualInput, setManInput] = useState('');
  const [camState, setCamState] = useState('idle');   // idle | starting | live | error | done
  const [camMsg, setCamMsg] = useState('');
  const [lastCode, setLastCode] = useState('');
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [externalScanBuffer, setExternalScanBuffer] = useState('');

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cancelRef = useRef(false);
  const doneRef = useRef(false);
  const inputRef = useRef(null);
  const externalScanTimeRef = useRef(null);

  // ── Load available cameras ──────────────────────────────────────────────────
  useEffect(() => {
    const loadCameras = async () => {
      const cams = await getAvailableCameras();
      setCameras(cams);
      if (cams.length > 0 && !selectedCamera) {
        setSelectedCamera(cams[0].id);
      }
    };
    loadCameras();
  }, [selectedCamera]);

  // ── Deliver confirmed barcode ───────────────────────────────────────────────
  const deliver = useCallback((code) => {
    if (!code?.trim() || doneRef.current) return;
    doneRef.current = true;
    beep();
    const c = code.trim();
    setLastCode(c);
    onConfirm(c);
    setTimeout(() => { doneRef.current = false; }, 1500);
  }, [onConfirm]);

  // ── Physical/External Scanner Handler ───────────────────────────────────────
  // Physical scanners typically emit keys like a keyboard input,
  // ending with Enter. We buffer rapid key events and deliver on Enter.
  useEffect(() => {
    if (mode !== 'external') return;

    let buffer = '';
    let scanTimer = null;
    const MIN_LENGTH = 3; // Barcode minimum length

    const onKey = (e) => {
      // Only capture when not typing in an input field
      if (e.target.tagName === 'INPUT' && e.target.id !== 'external-scanner-focus') return;

      if (e.key === 'Enter') {
        if (buffer.length >= MIN_LENGTH) {
          deliver(buffer);
          setExternalScanBuffer('');
        }
        buffer = '';
        return;
      }

      if (e.key.length !== 1) return; // Ignore special keys
      if (!/[\d\w\-]/.test(e.key)) return; // Only alphanumeric and dash

      buffer += e.key;
      setExternalScanBuffer(buffer);

      // Reset buffer if no scan for 100ms (likely user typing)
      clearTimeout(scanTimer);
      scanTimer = setTimeout(() => {
        if (buffer.length < MIN_LENGTH) {
          buffer = '';
          setExternalScanBuffer('');
        }
      }, 100);
    };

    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(scanTimer);
    };
  }, [mode, deliver]);

  // ── Stop camera ─────────────────────────────────────────────────────────────
  const stopCam = useCallback(() => {
    cancelRef.current = true;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // ── Start camera with selected device ───────────────────────────────────────
  const startCam = useCallback(async () => {
    stopCam();
    cancelRef.current = false;
    doneRef.current = false;
    setCamState('starting');
    setCamMsg('');
    setLastCode('');

    try {
      const constraints = {
        video: {
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (cancelRef.current) { stream.getTracks().forEach(t => t.stop()); return; }

      streamRef.current = stream;
      const vid = videoRef.current;
      if (!vid) { stream.getTracks().forEach(t => t.stop()); return; }

      vid.srcObject = stream;
      vid.setAttribute('playsinline', true);

      await new Promise((res, rej) => {
        vid.onloadedmetadata = res;
        vid.onerror = rej;
      });
      await vid.play();

      setCamState('live');
      setCamMsg('Point camera at barcode — scanning...');

      startBarcodeDetection(vid, (code) => {
        if (cancelRef.current) return;
        deliver(code);
        stopCam();
        setCamState('done');
      }, cancelRef);

    } catch (err) {
      const msg = err?.message || String(err);
      if (msg.includes('NotAllowed') || msg.includes('Permission')) {
        setCamMsg('Camera permission denied. Allow access in browser settings.');
      } else if (msg.includes('NotFound') || msg.includes('Devices')) {
        setCamMsg('No camera found. Check connection.');
      } else {
        setCamMsg('Camera error: ' + msg.slice(0, 60));
      }
      setCamState('error');
    }
  }, [deliver, stopCam, selectedCamera]);

  // ── Mode switching ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === 'camera') {
      const id = requestAnimationFrame(() => startCam());
      return () => { cancelAnimationFrame(id); stopCam(); };
    } else {
      stopCam();
      setCamState('idle');
    }

    if (mode === 'manual') {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [mode, startCam, stopCam]);

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => () => stopCam(), [stopCam]);

  // ─── RENDER ────────────────────────────────────────────────────────────────
  const card = { background: 'var(--card)', borderRadius: 20, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 25px 60px rgba(0,0,0,0.5)', border: '1px solid var(--border)', position: 'relative' };
  const input = { width: '100%', boxSizing: 'border-box', background: 'var(--bg-3)', border: '2px solid var(--border)', borderRadius: 10, padding: '13px 16px', color: 'var(--text)', fontSize: 15, fontFamily: 'inherit', fontWeight: 600, outline: 'none' };
  const tabBtn = (active) => ({
    flex: 1, padding: '9px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontFamily: 'inherit', fontWeight: 700, fontSize: 12, transition: 'all 0.15s',
    background: active ? 'var(--accent)' : 'transparent',
    color: active ? '#fff' : 'var(--text-3)',
  });
  const pill = (color, bg, border) => ({ fontSize: 12, padding: '8px 12px', borderRadius: 8, background: bg, color, border: `1px solid ${border}`, marginBottom: 10 });

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={card}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'var(--bg-3)', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 16, color: 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >✕</button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ background: 'var(--bg-2)', width: 54, height: 54, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: 'var(--accent)' }}>
            <img src={barcodeScannerIcon} alt="Scanner" style={{ width: 28, height: 28, opacity: 0.8 }} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)' }}>Barcode Scanner</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>Device · Manual · Webcam</div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'var(--bg-3)', borderRadius: 10, padding: 4, marginBottom: 20, gap: 4 }}>
          <button style={tabBtn(mode === 'external')} onClick={() => setMode('external')}>
            <img src={barcodeScannerIcon} alt="" style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 6, opacity: mode === 'external' ? 1 : 0.6, filter: mode === 'external' ? 'brightness(0) invert(1)' : 'none' }} /> Device Scanner
          </button>
          <button style={tabBtn(mode === 'manual')} onClick={() => setMode('manual')}>
            <img src={editIcon} alt="" style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 6, opacity: mode === 'manual' ? 1 : 0.6, filter: mode === 'manual' ? 'brightness(0) invert(1)' : 'none' }} /> Manual
          </button>
          <button style={tabBtn(mode === 'camera')} onClick={() => setMode('camera')}>
            <img src={circleIcon} alt="" style={{ width: 14, height: 14, verticalAlign: 'middle', marginRight: 6, opacity: mode === 'camera' ? 1 : 0.6, filter: mode === 'camera' ? 'brightness(0) invert(1)' : 'none' }} /> Webcam
          </button>
        </div>

        {/* ── EXTERNAL SCANNER MODE ── */}
        {mode === 'external' && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <label htmlFor="external-scanner-focus" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: 6 }}>
                <img src={barcodeScannerIcon} alt="" style={{ width: 14, height: 14, opacity: 0.6 }} /> Connect External Barcode Scanner
              </label>
              <div style={{ background: 'var(--bg-2)', border: '1px dashed var(--border)', borderRadius: 10, padding: 16, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <img src={barcodeScannerIcon} alt="" style={{ width: 16, height: 16, opacity: 0.5 }} /> Connect a USB barcode scanner to your device
                </div>
                <div style={{ fontSize: 11, opacity: 0.8 }}>Scanners work like keyboard input • No setup required</div>
              </div>
            </div>

            <input
              id="external-scanner-focus"
              name="externalScannerFocus"
              ref={inputRef}
              type="text"
              style={{ ...input, marginBottom: 10, border: externalScanBuffer ? '2px solid var(--accent)' : '2px solid var(--border)', opacity: 0.6 }}
              placeholder="Scanner input area (focus here)..."
              value={externalScanBuffer}
              readOnly
              autoFocus
            />

            {lastCode && (
              <div style={pill('var(--green)', 'rgba(16,185,129,0.08)', 'rgba(16,185,129,0.25)')}>
                ✓ Scanned: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{lastCode}</span>
              </div>
            )}

            <div style={{ fontSize: 12, color: 'var(--text-3)', backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: 10, textAlign: 'center', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <img src={notificationIcon} alt="" style={{ width: 14, height: 14, opacity: 0.7 }} />
              Physical scanner devices emit barcodes automatically when you press the trigger
            </div>
          </div>
        )}

        {/* ── MANUAL MODE ── */}
        {mode === 'manual' && (
          <div>
            <input
              id="manual-scanner-input"
              name="manualScannerInput"
              ref={inputRef}
              style={{ ...input, border: manualInput ? '2px solid var(--accent)' : '2px solid var(--border)', marginBottom: 10 }}
              placeholder="Enter or paste barcode..."
              value={manualInput}
              autoComplete="off"
              autoFocus
              onChange={e => setManInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && manualInput.trim()) {
                  deliver(manualInput.trim());
                  setManInput('');
                }
              }}
            />
            {lastCode && (
              <div style={pill('var(--green)', 'rgba(16,185,129,0.08)', 'rgba(16,185,129,0.25)')}>
                ✓ Last Scanned: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{lastCode}</span>
              </div>
            )}
            <button
              disabled={!manualInput.trim()}
              style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: manualInput.trim() ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, background: manualInput.trim() ? 'var(--accent)' : 'var(--bg-3)', color: manualInput.trim() ? '#fff' : 'var(--text-3)', transition: 'all 0.15s' }}
              onClick={() => { if (manualInput.trim()) { deliver(manualInput.trim()); setManInput(''); } }}
            >
              ✓ Submit Barcode
            </button>
          </div>
        )}

        {/* ── CAMERA MODE ── */}
        {mode === 'camera' && (
          <div>
            {cameras.length > 1 && (
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="camera-select" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Select Camera</label>
                <Dropdown
                  id="camera-select"
                  name="cameraSelect"
                  value={selectedCamera}
                  onChange={v => { setSelectedCamera(v); startCam(); }}
                  options={cameras.map(cam => ({ value: cam.id, label: cam.label }))}
                  style={{ width: '100%', marginBottom: 12 }}
                />
              </div>
            )}

            {/* Video element */}
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: '#000', marginBottom: 12, minHeight: 260 }}>
              <video
                ref={videoRef}
                style={{ width: '100%', display: 'block', maxHeight: 320, objectFit: 'cover' }}
                playsInline muted autoPlay
              />
              {/* Scan-line overlay */}
              {camState === 'live' && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ width: '70%', height: 2, background: 'var(--accent)', boxShadow: '0 0 12px var(--accent)', animation: 'scanLine 1.8s ease-in-out infinite' }} />
                </div>
              )}
            </div>

            {/* Status messages */}
            {camState === 'starting' && <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 13, marginBottom: 10 }}>⏳ Starting camera…</div>}
            {camState === 'live' && <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{camMsg}</div>}
            {camState === 'error' && <div style={pill('#f87171', 'rgba(239,68,68,0.1)', 'rgba(239,68,68,0.3)')}>{camMsg}</div>}
            {camState === 'done' && lastCode && (
              <div style={pill('var(--green)', 'rgba(16,185,129,0.08)', 'rgba(16,185,129,0.25)')}>
                ✓ Scanned: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{lastCode}</span>
              </div>
            )}

            {/* Retry button */}
            {(camState === 'error' || camState === 'done') && (
              <button
                style={{ width: '100%', padding: '11px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 14, background: 'var(--accent)', color: '#fff', marginBottom: 8 }}
                onClick={startCam}
              >
                {camState === 'done' ? 'Scan Another' : 'Retry Camera'}
              </button>
            )}
          </div>
        )}

        {/* Close button */}
        <button
          style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, fontSize: 14, background: 'transparent', color: 'var(--text-2)', marginTop: 10 }}
          onClick={onClose}
        >
          ← Close
        </button>

        {/* Scan-line animation */}
        <style>{`
          @keyframes scanLine {
            0%   { transform: translateY(-80px); opacity: 0.4; }
            50%  { transform: translateY(80px);  opacity: 1;   }
            100% { transform: translateY(-80px); opacity: 0.4; }
          }
        `}</style>
      </div>
    </div>
  );
};
