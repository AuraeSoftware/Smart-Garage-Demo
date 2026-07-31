import React, { useState, useRef, useEffect } from "react";
import { BrowserMultiFormatReader } from '@zxing/library';
import Barcode from "react-barcode";
import "./AddProductModal.css";
import editIcon from "../../assets/icons/edit-icon.png";
import barcodeScannerIcon from "../../assets/icons/barcode-scanner-icon.png";

function AddProductModal({ onSelectMode, onClose, userRole, branchSubscription }) {
  const [scannerActive, setScannerActive] = useState(false);
  const [generatorActive, setGeneratorActive] = useState(false);
  const [genBarcode, setGenBarcode] = useState("");
  const [genProductName, setGenProductName] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const barcodeInputRef = useRef(null);

  // Focus the barcode input when scanner mode is active
  useEffect(() => {
    if (scannerActive && !isScanning && barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, [scannerActive, isScanning]);

  // Initialize webcam scanner
  useEffect(() => {
    let codeReader;
    if (scannerActive && isScanning) {
      setScanError("");
      codeReader = new BrowserMultiFormatReader();
      
      codeReader.listVideoInputDevices()
        .then((videoInputDevices) => {
          if (videoInputDevices.length === 0) {
            setScanError("No camera devices found.");
            return;
          }
          let selectedDeviceId = videoInputDevices[0].deviceId;
          const backCamera = videoInputDevices.find(device => 
            device.label.toLowerCase().includes('back') || 
            device.label.toLowerCase().includes('environment')
          );
          if (backCamera) {
            selectedDeviceId = backCamera.deviceId;
          }

          codeReader.decodeFromVideoDevice(selectedDeviceId, 'qr-reader', (result, err) => {
            if (result) {
              const decodedText = result.getText();
              setBarcodeInput(decodedText);
              setScanError("");
              setIsScanning(false);
            }
          });
        })
        .catch((err) => {
          setScanError(err?.message || "Unable to access webcam. Please check permissions.");
        });
    }

    // Cleanup
    return () => {
      if (codeReader) {
        codeReader.reset();
      }
    };
  }, [scannerActive, isScanning]);

  const handleManualClick = () => {
    onSelectMode("manual", null);
    onClose();
  };

  const handleScannerClick = () => {
    setScannerActive(true);
  };

  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      onSelectMode("scanner", barcodeInput.trim());
      setBarcodeInput("");
      setScannerActive(false);
      onClose();
    }
  };

  const handleBackToOptions = () => {
    setScannerActive(false);
    setBarcodeInput("");
  };

  const handleGeneratorClick = () => {
    setGeneratorActive(true);
  };

  const handleBackToOptionsFromGen = () => {
    setGeneratorActive(false);
    setGenBarcode("");
    setGenProductName("");
  };

  const generateRandomBarcode = () => {
    // Generates a 12 digit string
    const randomNum = Math.floor(100000000000 + Math.random() * 900000000000);
    setGenBarcode(randomNum.toString());
  };

  const handlePrintBarcodes = () => {
    window.print();
  };

  if (generatorActive) {
    // Create an array of 40 items for a 4x10 grid
    const stickers = Array.from({ length: 40 });

    return (
      <div className="modal-overlay" onClick={onClose}>
        {/* Printable Section (only visible during print via CSS) */}
        <div className="print-only-barcodes">
          {stickers.map((_, i) => (
            <div key={i} className="barcode-sticker">
              {genProductName && <div className="sticker-name">{genProductName}</div>}
              {genBarcode && <Barcode value={genBarcode} width={1.5} height={40} fontSize={12} displayValue={true} margin={5} />}
            </div>
          ))}
        </div>

        {/* Regular UI */}
        <div className="modal-content generator-modal no-print" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Barcode Generator</h2>
            <button className="close-btn" onClick={onClose}>&times;</button>
          </div>

          <div className="generator-body">
            <div className="generator-inputs">
              <div className="input-group">
                <label htmlFor="gen-product-name">Product Name (Optional)</label>
                <input 
                  id="gen-product-name"
                  name="genProductName"
                  type="text" 
                  value={genProductName} 
                  onChange={(e) => setGenProductName(e.target.value)} 
                  placeholder="e.g. Car Shampoo"
                />
              </div>
              <div className="input-group">
                <label htmlFor="gen-barcode">Barcode Number</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    id="gen-barcode"
                    name="genBarcode"
                    type="text" 
                    value={genBarcode} 
                    onChange={(e) => setGenBarcode(e.target.value)} 
                    placeholder="Enter or generate"
                  />
                  <button type="button" className="generate-btn" onClick={generateRandomBarcode}>
                    Generate
                  </button>
                </div>
              </div>
            </div>

            <div className="preview-section">
              <h3>Preview</h3>
              <div className="barcode-preview-box">
                {genBarcode ? (
                  <Barcode value={genBarcode} width={2} height={60} />
                ) : (
                  <p className="placeholder-text">Enter a number or generate one</p>
                )}
              </div>
            </div>

            <button 
              className="print-barcodes-btn" 
              onClick={handlePrintBarcodes}
              disabled={!genBarcode}
            >
              Print 40 Stickers (4x10 Grid)
            </button>

            <button
              className="back-to-options-btn"
              onClick={handleBackToOptionsFromGen}
            >
              ← Back to Options
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (scannerActive) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content scanner-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>Barcode Scanner</h2>
            <button className="close-btn" onClick={onClose}>&times;</button>
          </div>

          <div className="scanner-body">
            {isScanning ? (
              <>
                <div style={{ position: 'relative', width: '100%', maxWidth: '350px', margin: '0 auto', borderRadius: '16px', overflow: 'hidden', background: '#000', minHeight: '250px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <video id="qr-reader" style={{ width: '100%', height: '100%', objectFit: 'cover' }}></video>
                  
                  {/* Scanning Animation Overlay */}
                  {!scanError && (
                    <div style={{ 
                      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, 
                      pointerEvents: 'none', zIndex: 10
                    }}>
                      <div style={{ 
                        position: 'absolute', top: '15%', left: '15%', right: '15%', bottom: '15%', 
                        border: '2px solid rgba(255, 255, 255, 0.4)', borderRadius: '12px', 
                        boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.6)'
                      }}>
                        {/* Corner Markers */}
                        <div style={{ position: 'absolute', top: -2, left: -2, width: 24, height: 24, borderTop: '4px solid #fff', borderLeft: '4px solid #fff', borderTopLeftRadius: 12 }}></div>
                        <div style={{ position: 'absolute', top: -2, right: -2, width: 24, height: 24, borderTop: '4px solid #fff', borderRight: '4px solid #fff', borderTopRightRadius: 12 }}></div>
                        <div style={{ position: 'absolute', bottom: -2, left: -2, width: 24, height: 24, borderBottom: '4px solid #fff', borderLeft: '4px solid #fff', borderBottomLeftRadius: 12 }}></div>
                        <div style={{ position: 'absolute', bottom: -2, right: -2, width: 24, height: 24, borderBottom: '4px solid #fff', borderRight: '4px solid #fff', borderBottomRightRadius: 12 }}></div>
                        
                        {/* Laser Line */}
                        <div style={{
                          position: 'absolute', left: 0, right: 0, height: '2px', background: '#22c55e', 
                          boxShadow: '0 0 10px #22c55e, 0 0 20px #22c55e',
                          animation: 'scan-laser 2s infinite linear'
                        }}></div>
                      </div>
                    </div>
                  )}

                  {scanError && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: '#fef2f2', zIndex: 20 }}>
                      <div style={{ textAlign: 'center', color: '#ef4444' }}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 48, height: 48, margin: '0 auto 12px' }}>
                          <circle cx="12" cy="12" r="10"></circle>
                          <line x1="12" y1="8" x2="12" y2="12"></line>
                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        <p style={{ fontWeight: 600 }}>{scanError}</p>
                      </div>
                    </div>
                  )}
                </div>
                
                <style>{`
                  @keyframes scan-laser {
                    0% { top: 5%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 95%; opacity: 0; }
                  }
                  #qr-reader {
                    object-fit: cover !important;
                    border-radius: 16px;
                  }
                `}</style>
                <p className="scanner-instruction" style={{ marginTop: '16px', fontWeight: '500' }}>
                  {scanError ? 'Please allow camera access and try again' : 'Point camera at barcode/QR code'}
                </p>
                <button
                  className="stop-scanning-btn"
                  onClick={() => setIsScanning(false)}
                  style={{ background: 'var(--red)', color: '#fff', padding: '14px', width: '100%', borderRadius: '10px', border: 'none', fontWeight: 'bold', marginTop: '12px', fontSize: '15px' }}
                >
                  Stop Camera
                </button>
              </>
            ) : (
              <>
                <div className="scanner-icon">
                  <img src={barcodeScannerIcon} alt="Scanner" style={{ width: 48, height: 48, opacity: 0.8 }} />
                </div>

                <p className="scanner-instruction">
                  Scan barcode or QR code with your webcam
                </p>

                <button
                  className="start-scanning-btn"
                  onClick={() => setIsScanning(true)}
                >
                  Start Webcam Scanner
                </button>

                <div style={{ marginTop: '24px', borderTop: '1px solid #eee', paddingTop: '24px' }}>
                  <p className="scanner-instruction" style={{ marginBottom: '12px', fontWeight: 600 }}>
                    Or use external barcode scanner:
                  </p>
                  <input
                    id="scanner-barcode-input"
                    name="scannerBarcodeInput"
                    ref={barcodeInputRef}
                    type="text"
                    className="barcode-input"
                    placeholder="Click here & scan with external device..."
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.target.value.trim()) {
                        const scannedValue = e.target.value.trim();
                        onSelectMode("scanner", scannedValue);
                        e.target.value = '';
                        setScannerActive(false);
                        onClose();
                      }
                    }}
                  />
                </div>
              </>
            )}


            {barcodeInput && (
              <form onSubmit={handleBarcodeSubmit} className="barcode-form">
                <div className="scanned-result">
                  <label htmlFor="scanned-barcode-result">Scanned Barcode:</label>
                  <input
                    id="scanned-barcode-result"
                    name="scannedBarcodeResult"
                    type="text"
                    className="barcode-input"
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    disabled
                  />
                </div>
                <button type="submit" className="submit-barcode-btn">
                  Continue with Barcode
                </button>
                <button
                  type="button"
                  className="rescan-btn"
                  onClick={() => {
                    setBarcodeInput("");
                    setIsScanning(true);
                  }}
                >
                  Scan Again
                </button>
              </form>
            )}

            <button
              className="back-to-options-btn"
              onClick={handleBackToOptions}
            >
              ← Back to Options
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-product-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Product</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>

        <div className="modal-options">
          {/* Manual Input Option */}
          <button className="option-card manual-card" onClick={handleManualClick}>
            <div className="option-icon">
              <img src={editIcon} alt="Manual" style={{ width: 32, height: 32 }} />
            </div>
            <h3>Manual Entry</h3>
            <p>Type product details manually</p>
          </button>

          {/* Scanner Option */}
          {['SuperAdmin', 'Admin'].includes(userRole) && branchSubscription?.has_ai_scanning !== false && (
            <button className="option-card scanner-card" onClick={handleScannerClick}>
              <div className="option-icon">
                <img src={barcodeScannerIcon} alt="Scanner" style={{ width: 32, height: 32 }} />
              </div>
              <h3>Barcode Scanner</h3>
              <p>Scan barcode or QR code</p>
            </button>
          )}

          {/* Barcode Generator Option */}
          <button className="option-card generator-card" onClick={handleGeneratorClick}>
            <div className="option-icon">
              <img src={barcodeScannerIcon} alt="Generator" style={{ width: 32, height: 32 }} />
            </div>
            <h3>Barcode Generator</h3>
            <p>Create & print 4x10 sticker grid</p>
          </button>
        </div>

        <div className="modal-info">
          <p>Choose how you'd like to add the new product to your inventory</p>
        </div>
      </div>
    </div>
  );
}

export default AddProductModal;
