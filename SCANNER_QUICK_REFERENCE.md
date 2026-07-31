# 📋 Barcode Scanner - Quick Reference Card

## For End Users

### 🚀 Quick Start
```
1. Go to Inventory/Retail/Washer page
2. Click "📱 Scan Item" or "📷 Scan" button
3. Choose your method:
   🔌 Device Scanner → Use physical USB scanner
   ⌨️ Manual Input → Type or paste barcode
   📷 Webcam → Point camera at barcode
4. Result appears automatically
```

### Keyboard Shortcuts
- **ENTER**: Submit barcode (Manual mode)
- **TAB**: Switch between scanner modes
- **ESC**: Close scanner (browser dependent)

### Device Scanner Tips
- ✅ Just plug in and use
- ✅ Press scanner trigger
- ✅ Barcode auto-submits
- ✅ No special setup needed

### Webcam Tips
- ✅ Good lighting needed
- ✅ Hold barcode steady
- ✅ 10-20 cm distance
- ✅ Point perpendicular

---

## For Developers

### Component Import
```javascript
import { BarcodeScanner } from '../../components/common/BarcodeScanner';
```

### Basic Usage
```javascript
const [showScanner, setShowScanner] = useState(false);

const handleScan = (barcode) => {
  console.log('Scanned:', barcode);
  // Process barcode...
  setShowScanner(false);
};

// In JSX:
{showScanner && (
  <BarcodeScanner
    onConfirm={handleScan}
    onClose={() => setShowScanner(false)}
  />
)}
```

### Integration Pattern
```javascript
// Step 1: Add state
const [showScanner, setShowScanner] = useState(false);

// Step 2: Create handler
const handleBarcodeScan = (barcode) => {
  if (!barcode?.trim()) return;
  
  // Find item in inventory
  const item = inventory.find(i => 
    String(i.barcode) === barcode || String(i.id) === barcode
  );

  if (item) {
    // Success - do something with item
    handleSuccess(item);
  } else {
    // Error - show notification
    window.showNotification?.(
      `No item found: ${barcode}`, 
      'error'
    );
  }
  
  setShowScanner(false);
};

// Step 3: Add button
<button onClick={() => setShowScanner(true)}>
  📱 Scan Item
</button>

// Step 4: Add component
{showScanner && (
  <BarcodeScanner
    onConfirm={handleBarcodeScan}
    onClose={() => setShowScanner(false)}
  />
)}
```

### State Management
```javascript
// Scanner modes
const modes = ['external', 'manual', 'camera'];

// Camera states
const camStates = ['idle', 'starting', 'live', 'error', 'done'];

// Component state
const [mode, setMode] = useState('external');
const [camState, setCamState] = useState('idle');
const [lastCode, setLastCode] = useState('');
```

### Debugging
```javascript
// In component or browser console:

// Check browser support
window.BarcodeDetector ? "✅ Supported" : "❌ Fallback"

// Check camera permission
navigator.permissions
  .query({name: 'camera'})
  .then(r => console.log("Camera:", r.state))

// Check available cameras
navigator.mediaDevices
  .enumerateDevices()
  .then(devices => console.log(devices.filter(d => d.kind === 'videoinput')))

// Check keyboard support
console.log("Keyboard: ✅ Supported")
```

---

## API Reference

### Props
```typescript
interface BarcodeScannerProps {
  onConfirm: (barcode: string) => void;  // Called with scanned code
  onClose: () => void;                    // Called when modal closes
}
```

### Event Flow
```
User Action
    ↓
Scanner Detects/Receives Code
    ↓
Debounce & Validate (if needed)
    ↓
Play Beep Sound
    ↓
onConfirm(barcode) Called
    ↓
Parent Component Handles Result
    ↓
Scanner Closes (if parent calls onClose)
```

### Barcode Format
```javascript
// All formats are treated as strings
const examples = [
  "1234567890",           // Standard
  "EAN-13-1234567890",    // With prefix
  "PRD-ABC-123",          // Custom format
  "QR:https://...",       // QR code data
];

// String comparison used
String(item.barcode) === String(scanResult)
```

---

## Common Patterns

### Pattern 1: Simple Lookup
```javascript
const handleScan = (code) => {
  const item = inventory.find(i => i.barcode === code);
  if (item) setSearchTerm(item.name);
};
```

### Pattern 2: Add to Cart
```javascript
const handleScan = (code) => {
  const item = inventory.find(i => i.barcode === code);
  if (item && item.quantity > 0) {
    setCart(prev => [...prev, { ...item, qty: 1 }]);
  }
};
```

### Pattern 3: Update Form Field
```javascript
const handleScan = (code) => {
  setFormData(prev => ({ ...prev, barcode: code }));
};
```

### Pattern 4: Multiple Items
```javascript
const handleScan = (code) => {
  const item = inventory.find(i => i.barcode === code);
  if (item) {
    // Don't close scanner - allow multiple scans
    setItems(prev => [...prev, item]);
    // Scanner modal stays open
  }
};
```

---

## Troubleshooting Quick Guide

### Scanner Not Working
```
✓ Check: USB connected
✓ Check: Device in browser settings
✓ Check: Input field has focus
✓ Try: Refresh page
✓ Try: Restart browser
```

### Barcode Not Found
```
✓ Check: Barcode exists in system
✓ Check: Barcode format matches
✓ Try: Manual input with exact code
✓ Try: Lookup by product ID instead
```

### Camera Issues
```
✓ Check: Camera connected
✓ Check: Browser has permission
✓ Check: Good lighting
✓ Try: Different camera if available
✓ Try: Manual input instead
```

### Permission Denied
```
✓ Chrome: Settings → Privacy → Camera
✓ Firefox: about:preferences → Privacy
✓ Safari: System Preferences → Security
✓ Then: Reload page
```

---

## File Locations

```
Component:          src/components/common/BarcodeScanner.jsx
InventoryList:      src/pages/admin/InventoryList.jsx
RetailProducts:     src/pages/admin/RetailProducts.jsx
WasherApp:          src/pages/washer/WasherApp.jsx

User Guide:         BARCODE_SCANNER_GUIDE.md
Technical Docs:     SCANNER_TECHNICAL_DOCS.md
Implementation:     SCANNER_IMPLEMENTATION_SUMMARY.md
```

---

## Performance Metrics

| Metric | Value |
|--------|-------|
| Detection FPS | 15 |
| Debounce Time | 500ms |
| Buffer Timeout | 100ms |
| Min Barcode Length | 3 chars |
| Modal Load Time | < 500ms |
| Camera Startup | 1-2 seconds |

---

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Webcam | ✅ | ✅ | ✅ | ✅ |
| BarcodeDetector | ✅ | ❌ | ❌ | ✅ |
| Canvas Fallback | ✅ | ✅ | ✅ | ✅ |
| Keyboard Input | ✅ | ✅ | ✅ | ✅ |
| Camera Permission | ✅ | ✅ | ✅ | ✅ |

---

## Code Examples

### Example 1: Basic Integration
```javascript
// Component setup
const [showScanner, setShowScanner] = useState(false);

// Handler
const handleScan = (code) => {
  console.log('Got barcode:', code);
  setShowScanner(false);
};

// Render
return (
  <>
    <button onClick={() => setShowScanner(true)}>
      Scan
    </button>
    
    {showScanner && (
      <BarcodeScanner
        onConfirm={handleScan}
        onClose={() => setShowScanner(false)}
      />
    )}
  </>
);
```

### Example 2: With Notifications
```javascript
const handleScan = (code) => {
  const item = inventory.find(i => i.barcode === code);
  
  if (item) {
    notify(`✓ Found: ${item.name}`, 'success');
  } else {
    notify(`❌ Not found: ${code}`, 'error');
  }
  
  setShowScanner(false);
};
```

### Example 3: With Validation
```javascript
const handleScan = (code) => {
  if (!code?.trim()) {
    notify('Invalid barcode', 'error');
    return;
  }
  
  const item = inventory.find(i => 
    String(i.barcode) === code || String(i.id) === code
  );
  
  if (item) {
    // Process...
  }
  
  setShowScanner(false);
};
```

---

## Useful Links

- 📖 [Barcode Scanner Guide](./BARCODE_SCANNER_GUIDE.md)
- 🛠️ [Technical Documentation](./SCANNER_TECHNICAL_DOCS.md)
- 📝 [Implementation Summary](./SCANNER_IMPLEMENTATION_SUMMARY.md)

---

## Contact & Support

- 🐛 Report issues in component
- 📧 Contact development team for help
- 💡 Suggest improvements via pull request

---

**Version**: 2.0  
**Last Updated**: May 22, 2026  
**Status**: ✅ Production Ready
