# 🛠️ Barcode Scanner - Technical Documentation

## Architecture Overview

The barcode scanner system consists of three main components:

```
┌─────────────────────────────────────────────────────────┐
│         BarcodeScanner Component (React)                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────┐  ┌─────────────────┐            │
│  │  External Scanner│  │   Manual Input  │            │
│  │     (Keyboard)   │  │   (User Types)  │            │
│  └──────────────────┘  └─────────────────┘            │
│           │                     │                       │
│           └─────────┬───────────┘                       │
│                     │                                   │
│           ┌─────────▼──────────┐                        │
│           │  Barcode Delivery  │                        │
│           │     Handler        │                        │
│           └─────────┬──────────┘                        │
│                     │                                   │
│           ┌─────────▼──────────┐                        │
│           │  onConfirm Callback│                        │
│           │  (Parent Handler)  │                        │
│           └────────────────────┘                        │
│                                                          │
│  ┌──────────────────────────────────────────┐          │
│  │        Webcam Mode (Optional)            │          │
│  │  ┌──────────────────────────────────┐   │          │
│  │  │  BarcodeDetector API (Native)    │   │          │
│  │  │  OR Canvas-based Fallback        │   │          │
│  │  └──────────────────────────────────┘   │          │
│  │         ↓                                │          │
│  │  ┌──────────────────────────────────┐   │          │
│  │  │  Video Stream → Detection Loop   │   │          │
│  │  │  (15 FPS, debounced)             │   │          │
│  │  └──────────────────────────────────┘   │          │
│  └──────────────────────────────────────────┘          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Component Structure

### File Location
```
src/components/common/BarcodeScanner.jsx
```

### Exported Component
```javascript
export const BarcodeScanner = ({ onConfirm, onClose }) => { ... }
```

### Props
| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `onConfirm` | `(code: string) => void` | Yes | Called when barcode is confirmed |
| `onClose` | `() => void` | Yes | Called when modal is closed |

---

## Implementation Details

### 1. External Scanner Support

#### How It Works
Physical barcode scanners emit keypresses like a keyboard. The component buffers these rapid key events and triggers confirmation on `Enter`.

```javascript
// Physical scanner listener
const onKey = (e) => {
  if (e.target.tagName === 'INPUT' && e.target.id !== 'external-scanner-focus') return;
  
  if (e.key === 'Enter') {
    if (buffer.length >= MIN_LENGTH) deliver(buffer);
    buffer = '';
    return;
  }
  
  if (e.key.length !== 1) return; // Ignore special keys
  if (!/[\d\w\-]/.test(e.key)) return; // Alphanumeric + dash
  
  buffer += e.key;
  
  // Reset buffer after 100ms inactivity
  clearTimeout(scanTimer);
  scanTimer = setTimeout(() => {
    if (buffer.length < MIN_LENGTH) buffer = '';
  }, 100);
};

window.addEventListener('keydown', onKey);
```

#### Key Features
- ✅ Minimum length validation (3 characters)
- ✅ 100ms debounce to catch end of scan
- ✅ Smart focus handling (isolated input field)
- ✅ Support for alphanumeric + dash characters
- ✅ No interference with normal typing

### 2. Webcam Detection

#### BarcodeDetector API (Primary)
Uses native browser API when available (Chrome 83+, Edge, Android):

```javascript
const detector = window.BarcodeDetector
  ? new window.BarcodeDetector({ 
      formats: ['qr_code', 'code_128', 'ean_13', 'ean_8', 
                'upc_a', 'upc_e', 'code_39', 'itf', 'codabar', 
                'data_matrix', 'aztec', 'pdf417'] 
    })
  : null;

// In detection loop:
if (detector) {
  const results = await detector.detect(videoEl);
  if (results?.length) {
    const rawValue = results[0].rawValue;
    if (rawValue && rawValue !== lastDetectedCode) {
      onDetect(rawValue);
    }
  }
}
```

#### Canvas Fallback (Fallback)
For browsers without native BarcodeDetector:

```javascript
// Creates canvas snapshot of video frame
canvas.width = videoEl.videoWidth;
canvas.height = videoEl.videoHeight;
ctx2d.drawImage(videoEl, 0, 0);
// (No barcode detection - just keeps loop running)
```

#### Detection Loop
- Throttled to 15 FPS (67ms intervals)
- Debounced to prevent duplicate detections (500ms)
- Runs continuously until cancelled
- Checks video readyState before processing

### 3. Device Camera Management

#### Device Enumeration
```javascript
async function getAvailableCameras() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter(d => d.kind === 'videoinput')
    .map(d => ({ id: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 5)}` }));
}
```

#### Stream Initialization
```javascript
const stream = await navigator.mediaDevices.getUserMedia({
  video: {
    deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 }
  },
  audio: false,
});

// Attach to video element
vid.srcObject = stream;
vid.setAttribute('playsinline', true); // Mobile support
await vid.play();
```

---

## State Management

### Mode States
```typescript
mode: 'external' | 'manual' | 'camera'
```

### Camera States
```typescript
camState: 'idle' | 'starting' | 'live' | 'error' | 'done'
```

### State Flow Diagram
```
┌─────┐
│idle │ ──(mode='camera')──→ ┌─────────┐ ──(stream started)──→ ┌──────┐
└─────┘                       │starting │                       │live  │
  ▲                           └─────────┘                       └──┬───┘
  │                                                               │
  └────(onClose)────────────────────────────────────────────────┘
                           │
                           ├──(barcode detected)──→ ┌──────┐
                           │                        │done  │
                           │                        └──┬───┘
                           │                          │
                           └──(error)─────────────→ ┌──────┐
                                                    │error │
                                                    └──┬───┘
                                                      │
                                                      ├──(retry)──→ back to live
                                                      └──(close)──→ idle
```

---

## Error Handling

### Permission Errors
```javascript
if (msg.includes('NotAllowed') || msg.includes('Permission')) {
  setCamMsg('🔒 Camera permission denied. Allow access in browser settings.');
}
```

### Device Errors
```javascript
else if (msg.includes('NotFound') || msg.includes('Devices')) {
  setCamMsg('❌ No camera found. Check connection.');
}
```

### Generic Errors
```javascript
else {
  setCamMsg('⚠️ Camera error: ' + msg.slice(0, 60));
}
```

---

## Integration Examples

### InventoryList Integration
```javascript
// src/pages/admin/InventoryList.jsx
const handleBarcodeScan = (barcode) => {
  if (!barcode?.trim()) return;

  const item = (inventory || []).find(i => 
    String(i.barcode) === barcode || String(i.id) === barcode
  );

  if (item) {
    setScannedItem(item);
    setSearch(item.barcode ? String(item.barcode) : item.name);
    setShowScanner(false);
    window.showNotification?.(`✓ Found: ${item.name}`, 'success');
  } else {
    setShowScanner(false);
    window.showNotification?.(`❌ No item found: ${barcode}`, 'error');
  }
};

// In JSX:
{showScanner && (
  <BarcodeScanner
    onConfirm={handleBarcodeScan}
    onClose={() => setShowScanner(false)}
  />
)}
```

### RetailProducts Integration
```javascript
// For adding barcode to new item
const handleScanConfirm = useCallback((code) => {
  const trimmedCode = code.trim();
  if (scanTarget === 'add')  setN('barcode', trimmedCode);
  if (scanTarget === 'edit') setEditing(p => ({ ...p, barcode: trimmedCode }));
  setScanTarget(null);
}, [scanTarget]);
```

### WasherApp Integration
```javascript
// For adding products to cart
const handleScanProduct = useCallback((code) => {
  const searchCode = code.trim();
  const item = (inventory || []).find(i => 
    (i.barcode && String(i.barcode) === searchCode) || 
    String(i.id) === searchCode
  );

  if (!item) { 
    notify(`❌ Product not found: ${searchCode}`, 'error'); 
    return; 
  }

  // Add to cart...
  setCart(prev => [...prev, { 
    id: item.id, 
    name: item.name, 
    price: item.price || item.cost || 0, 
    quantity: 1, 
    maxQty: item.quantity 
  }]);
  notify(`✓ Added ${item.name} to cart`, 'success');
}, [inventory, notify]);

// Keep scanner open for multiple scans
{scanTarget && (
  <BarcodeScanner
    onConfirm={(code) => { 
      handleScanProduct(code); 
      // Modal stays open
    }}
    onClose={() => setScanTarget(false)}
  />
)}
```

---

## Keyboard Support

### Physical Scanner Detection
The scanner listens globally for keyboard input:

```
Physical Scanner Flow:
  [User presses trigger on scanner]
    ↓
  [Scanner emits key codes]
    ↓
  [Component buffers keys]
    ↓
  [Component detects ENTER]
    ↓
  [Barcode delivered to handler]
    ↓
  [Handler processes result]
```

### Key Requirements
- Minimum 3 characters (configurable via MIN_LENGTH)
- Alphanumeric + dash characters only
- Must end with ENTER key
- 100ms timeout resets buffer

---

## Browser Compatibility

### Webcam Support
| Browser | Support | BarcodeDetector | Notes |
|---------|---------|-----------------|-------|
| Chrome | ✅ Full | ✅ Chrome 83+ | Best support |
| Firefox | ✅ Full | ❌ No | Uses canvas fallback |
| Safari | ✅ Full | ❌ No | iOS requires HTTPS |
| Edge | ✅ Full | ✅ Yes | Chromium-based |
| Mobile Safari | ✅ Limited | ❌ No | Requires HTTPS |

### External Scanner Support
| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ Full | Works as HID keyboard |
| Firefox | ✅ Full | Works as HID keyboard |
| Safari | ✅ Full | Works as HID keyboard |
| Edge | ✅ Full | Works as HID keyboard |

---

## Performance Considerations

### Detection Loop Optimization
```javascript
// Throttled to 67ms (15 FPS) for performance
setTimeout(() => { 
  if (!cancelRef.current) requestAnimationFrame(tick); 
}, 67);
```

### Debouncing
```javascript
// Prevents duplicate detections of same barcode within 500ms
if (rawValue !== lastDetectedCode) {
  lastDetectedCode = rawValue;
  onDetect(rawValue);
}
```

### Memory Management
```javascript
// Cleanup on unmount
useEffect(() => () => stopCam(), [stopCam]);

// Stop camera on mode change
if (mode !== 'camera') {
  stopCam();
}
```

---

## Debugging

### Enable Console Logging
Add to BarcodeScanner component:

```javascript
console.log('Scanner mode:', mode);
console.log('Camera state:', camState);
console.log('Detected barcode:', code);
console.log('Available cameras:', cameras);
```

### Check Browser Support
```javascript
// In browser console
window.BarcodeDetector ? "BarcodeDetector supported" : "Not supported"
navigator.mediaDevices ? "mediaDevices supported" : "Not supported"
```

### Camera Permission Status
```javascript
// In browser console
navigator.permissions.query({name: 'camera'}).then(result => console.log(result.state))
```

---

## Future Improvements

### Planned Enhancements
1. **LibBarcodeScanner**: Add barcode/QR detection library for broader browser support
2. **Batch Scanning**: Support scanning multiple items with mode toggle
3. **Custom Barcode Formats**: Add support for custom/proprietary barcode formats
4. **Offline Mode**: Add service worker for offline camera access
5. **Performance**: Optimize detection loop for slower devices
6. **Accessibility**: Add keyboard navigation for full accessibility

### Code Refactoring
```javascript
// Consider extracting detection logic into custom hook
export const useBarcodeDetection = (videoRef, onDetect) => {
  // Detection logic
};

// Scanner component becomes simpler
export const BarcodeScanner = ({ onConfirm, onClose }) => {
  useBarcodeDetection(videoRef, handleDetection);
  // ...
};
```

---

## Testing

### Unit Tests to Add
```javascript
// Test external scanner buffering
describe('External Scanner', () => {
  it('should buffer key inputs correctly', () => { ... });
  it('should reset buffer after timeout', () => { ... });
  it('should deliver barcode on Enter', () => { ... });
});

// Test webcam detection
describe('Webcam Detection', () => {
  it('should initialize video stream', () => { ... });
  it('should handle permission denial', () => { ... });
  it('should debounce duplicate detections', () => { ... });
});
```

### Integration Tests
```javascript
// Test InventoryList integration
describe('InventoryList Scanner Integration', () => {
  it('should find item by barcode', () => { ... });
  it('should show notification on success', () => { ... });
  it('should handle not found case', () => { ... });
});
```

---

## References

- [Barcode Detection API](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector)
- [MediaStream API](https://developer.mozilla.org/en-US/docs/Web/API/MediaStream)
- [getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)
- [Web Audio API (for beep sound)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)

---

**Last Updated**: May 22, 2026  
**Version**: 2.0 (Multi-Device Implementation)
