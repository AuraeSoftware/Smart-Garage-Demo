# 📱 Barcode Scanner - Complete Guide

## Overview

The improved Barcode Scanner system now supports **three input methods** for maximum flexibility:

1. **🔌 External/Physical Barcode Scanner** (USB/Wireless devices)
2. **⌨️ Manual Input** (Type or paste barcodes)
3. **📷 Webcam Detection** (Real-time barcode/QR code detection)

---

## 🔌 External Barcode Scanner (Recommended)

### What It Is
A USB or wireless barcode scanner device that connects to your computer. These are the physical handheld devices that beep when you scan items.

### How It Works
- Connect the scanner via USB to your computer
- Focus on the scanner input area in the app
- Press the trigger on the scanner to emit the barcode
- The app automatically captures the barcode
- **No special setup required** - works like a keyboard

### Where to Use
- **InventoryList**: Click "🔌 Device Scanner" tab → Scanner will auto-detect barcodes
- **RetailProducts**: Click "Scan / Generate" button → Select "🔌 Device Scanner"
- **WasherApp**: Click "📷 Scan" button → Select "🔌 Device Scanner"

### Advantages
✅ Fast and reliable  
✅ No internet needed  
✅ Works offline  
✅ Professional-grade accuracy  

### Troubleshooting
| Issue | Solution |
|-------|----------|
| Scanner not working | Ensure USB cable is connected; focus the input field in the app |
| Multiple scans at once | Use longer than 3-character codes; short codes may be ignored |
| Interference with typing | Scanner input is isolated - normal text input not affected |

---

## ⌨️ Manual Input

### How It Works
- Click "⌨️ Manual" tab in the scanner modal
- Type or paste the barcode/product code
- Press **Enter** or click "✓ Submit Barcode"
- App looks up the product and displays details

### Where to Use
- **InventoryList**: "📱 Scan Item" → "⌨️ Manual" tab
- **RetailProducts**: "Scan / Generate" → "⌨️ Manual" tab
- **WasherApp**: "📷 Scan" → "⌨️ Manual" tab

### Advantages
✅ Works anywhere (no special hardware)  
✅ Easy for testing  
✅ Can paste multi-item codes  

### Example Inputs
```
1234567890           # Standard barcode
EAN-13-CODE          # Format with dashes
QR-SCAN-123          # QR code output
```

---

## 📷 Webcam Detection

### How It Works
1. Click "📷 Webcam" tab in the scanner modal
2. Allow camera permission when prompted
3. Point camera at barcode/QR code
4. App auto-detects and captures the code
5. Real-time scanning with visual feedback

### Supported Formats
- ✅ QR Codes
- ✅ Code 128
- ✅ EAN-13, EAN-8
- ✅ UPC-A, UPC-E
- ✅ Code 39
- ✅ ITF (Interleaved 2 of 5)
- ✅ Codabar
- ✅ Data Matrix
- ✅ Aztec
- ✅ PDF417

### Where to Use
- **InventoryList**: "📱 Scan Item" → "📷 Webcam" tab
- **RetailProducts**: "Scan / Generate" → "📷 Webcam" tab
- **WasherApp**: "📷 Scan" → "📷 Webcam" tab

### Multiple Camera Support
If your device has multiple cameras (front/back):
1. Open webcam mode
2. Select camera from dropdown
3. Scanner automatically switches

### Advantages
✅ No hardware scanner needed  
✅ Works with QR codes  
✅ Real-time detection  
✅ Mobile-friendly  

### Disadvantages
⚠️ Requires camera permission  
⚠️ Requires good lighting  
⚠️ Slower than physical scanner  

### Tips for Best Results
1. **Good Lighting**: Use natural light or bright overhead lighting
2. **Steady Hand**: Keep camera stable and centered on barcode
3. **Distance**: Position barcode 10-20 cm from camera
4. **Angle**: Point camera perpendicular to barcode
5. **Clean Lens**: Ensure camera lens is clean

---

## 🎯 Using the Scanner in Each Module

### Inventory List Page
```
Flow: Click "📱 Scan Item" 
      → Select method (Device/Manual/Webcam)
      → Scan barcode
      → Auto-filters to show that item
      → Click to view/edit details
```

**What Happens**:
- Scanned item is highlighted in the list
- Product details show quantity, price, category
- Can edit or restock directly from filtered view

### Retail Products Page
```
Flow: Click "Scan / Generate" button in Add/Edit form
      → Select method
      → Scan product barcode
      → Barcode auto-fills in form
      → Complete other fields & save
```

**What Happens**:
- Barcode field auto-populates
- Visual barcode preview shown
- Can generate barcode if needed

### Washer App (Invoice)
```
Flow: During invoice, click "📷 Scan" button
      → Select method
      → Scan product barcode
      → Item auto-adds to cart
      → Can scan multiple items
      → Continues to next item (modal stays open)
```

**What Happens**:
- Product auto-adds with quantity +1
- Out-of-stock items rejected
- Cart total updates automatically
- Can scan multiple items in sequence

---

## ⚙️ Advanced Configuration

### Keyboard Behavior
The scanner input works intelligently:
- **Physical Scanner Mode**: Captures all keyboard input (doesn't interfere with regular typing)
- **Buffer System**: Waits 100ms to confirm end of scan
- **Minimum Length**: Ignores codes shorter than 3 characters
- **Auto-clear**: Buffers reset after 100ms of inactivity

### Supported Barcode Types
```javascript
// Current supported formats:
- QR Code
- Code 128
- EAN-13
- EAN-8
- UPC-A
- UPC-E
- Code 39
- ITF
- Codabar
- Data Matrix
- Aztec
- PDF417
```

### Device Auto-Detection
The app automatically:
1. ✅ Detects connected USB scanners
2. ✅ Enumerates available cameras
3. ✅ Tests browser BarcodeDetector API support
4. ✅ Falls back to canvas-based detection if needed

---

## 🐛 Troubleshooting

### Scanner Not Detected
**Problem**: "No camera found" message  
**Solutions**:
- Check USB cable connection (for external scanner)
- Ensure camera has permission (for webcam)
- Try browser refresh
- Check browser console for errors

### Barcode Not Reading
**Problem**: Barcode scanned but item not found  
**Solutions**:
1. Verify barcode exists in inventory system
2. Check for typos or formatting differences
3. Try manual entry if barcode is unclear
4. Contact system admin if barcode is missing

### Multiple Same Scans
**Problem**: Barcode detected multiple times  
**Solutions**:
- Wait 500ms between consecutive scans of same code
- Move barcode away and rescan
- Use different barcode if possible

### Camera Permission Denied
**Problem**: "Camera permission denied" message  
**Solutions**:
1. **Chrome**: Settings → Privacy → Camera → Allow site
2. **Firefox**: About:preferences → Privacy → Camera → Allow
3. **Safari**: System Preferences → Security & Privacy → Camera
4. Reload page after allowing permission

### Low Light Conditions
**Problem**: Barcode not detected in dim lighting  
**Solutions**:
- Increase ambient lighting
- Use device flashlight (if available)
- Clean camera lens
- Switch to manual input mode

---

## 📊 Performance Tips

### For Optimal Speed
1. Use **Physical Scanner** (fastest - no processing)
2. Keep barcode clean and visible
3. Use **Manual Input** for troubleshooting
4. Webcam mode is slowest but most flexible

### Scanning Speed Comparison
| Method | Speed | Reliability | Setup |
|--------|-------|-------------|-------|
| Physical Scanner | ⚡⚡⚡ | ★★★★★ | USB plug |
| Manual Input | ⚡⚡ | ★★★★★ | Type only |
| Webcam | ⚡ | ★★★★☆ | Camera needed |

---

## 🔐 Privacy & Security

### Data Handling
- ✅ All scans processed locally (no cloud upload)
- ✅ Barcode codes compared against local inventory
- ✅ No external barcode database required
- ✅ Camera access only when in webcam mode
- ✅ No scanning history logged

### Permissions
- Camera: Only accessed in webcam scanning mode
- Microphone: Never requested
- Location: Never accessed
- Storage: Only local browser cache

---

## 📝 Barcode Best Practices

### Formatting
```
✅ Good: 1234567890
✅ Good: EAN-13-1234567890
❌ Bad: 1234 5678 90 (spaces)
❌ Bad: 12-34 (too short)
```

### Storage
- Store physical barcodes in **cool, dry place**
- Avoid moisture and heat
- Keep clean from dust/dirt
- Replace faded/damaged labels

### Scanning
- Position barcode perpendicular to scanner
- Use consistent scan angle
- Ensure barcode is fully visible
- No glare or reflection

---

## 🚀 Future Enhancements

Planned features for next releases:
- [ ] Batch barcode generation
- [ ] Custom barcode formats
- [ ] Barcode label printing
- [ ] Bulk scan import (CSV)
- [ ] Advanced barcode validation
- [ ] Mobile app barcode scanning

---

## 📞 Support

For issues or questions:
1. Check this guide first
2. Review troubleshooting section
3. Check browser console for errors
4. Contact technical support with error details

---

**Last Updated**: May 22, 2026  
**Version**: 2.0 (Multi-Device Support)
