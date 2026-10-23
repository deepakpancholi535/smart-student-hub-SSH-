import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

const CROP_SIZE = 320;
const OUTPUT_SIZE = 512;

function getImagePlacement(image, zoom, offset) {
  const scale = Math.max(CROP_SIZE / image.naturalWidth, CROP_SIZE / image.naturalHeight) * zoom;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const maxX = Math.max(0, (width - CROP_SIZE) / 2);
  const maxY = Math.max(0, (height - CROP_SIZE) / 2);
  const x = Math.max(-maxX, Math.min(maxX, offset.x));
  const y = Math.max(-maxY, Math.min(maxY, offset.y));
  return {
    scale,
    width,
    height,
    left: (CROP_SIZE - width) / 2 + x,
    top: (CROP_SIZE - height) / 2 + y,
  };
}

export function ProfileImageCropper({ file, onCancel, onComplete }) {
  const canvasRef = useRef(null);
  const pointerRef = useRef(null);
  const [image, setImage] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    const source = new Image();
    source.onload = () => setImage(source);
    source.onerror = () => setError('This image could not be opened. Choose another picture.');
    source.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    function closeOnEscape(event) {
      if (event.key === 'Escape' && !saving) onCancel();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onCancel, saving]);

  useEffect(() => {
    if (!image || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
    context.fillStyle = '#101722';
    context.fillRect(0, 0, CROP_SIZE, CROP_SIZE);
    const placement = getImagePlacement(image, zoom, offset);
    context.drawImage(image, placement.left, placement.top, placement.width, placement.height);
  }, [image, zoom, offset]);

  function startDrag(event) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
  }

  function drag(event) {
    if (pointerRef.current?.id !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = CROP_SIZE / bounds.width;
    const deltaX = (event.clientX - pointerRef.current.x) * ratio;
    const deltaY = (event.clientY - pointerRef.current.y) * ratio;
    pointerRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    setOffset((current) => ({ x: current.x + deltaX, y: current.y + deltaY }));
  }

  function stopDrag(event) {
    if (pointerRef.current?.id === event.pointerId) pointerRef.current = null;
  }

  function confirmCrop() {
    if (!image || saving) return;
    setSaving(true);
    setError('');
    const placement = getImagePlacement(image, zoom, offset);
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = OUTPUT_SIZE;
    cropCanvas.height = OUTPUT_SIZE;
    const context = cropCanvas.getContext('2d');
    const sourceX = Math.max(0, -placement.left / placement.scale);
    const sourceY = Math.max(0, -placement.top / placement.scale);
    const sourceSize = CROP_SIZE / placement.scale;
    context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
    cropCanvas.toBlob((blob) => {
      if (!blob) {
        setSaving(false);
        setError('The cropped image could not be created. Please try another picture.');
        return;
      }
      const name = file.name.replace(/\.[^.]+$/, '') || 'profile-picture';
      onComplete(new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
    }, 'image/jpeg', 0.92);
  }

  return (
    <div className="photo-crop-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onCancel();
    }}>
      <section className="photo-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="photo-crop-title" aria-describedby="photo-crop-help">
        <header className="photo-crop-header">
          <div><span className="eyebrow">PROFILE PHOTO</span><h2 id="photo-crop-title">Adjust your picture</h2></div>
          <button type="button" className="icon-button" aria-label="Close crop editor" disabled={saving} onClick={onCancel}><X size={19} /></button>
        </header>
        <p id="photo-crop-help" className="photo-crop-help">Drag to position, zoom as needed, and use the grid to frame your square profile picture.</p>
        <div
          className="photo-crop-stage"
          onPointerDown={startDrag}
          onPointerMove={drag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        >
          <canvas ref={canvasRef} width={CROP_SIZE} height={CROP_SIZE} aria-label="Profile picture crop preview" />
          <div className="photo-crop-grid" aria-hidden="true"><i /><i /><i /><i /></div>
        </div>
        <label className="photo-crop-zoom">Zoom
          <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} aria-label="Zoom profile picture" />
          <span>{zoom.toFixed(1)}×</span>
        </label>
        {error && <p className="photo-crop-error" role="alert">{error}</p>}
        <footer className="photo-crop-actions">
          <button type="button" className="button button-secondary" disabled={saving} onClick={onCancel}>Cancel</button>
          <button type="button" className="button button-primary" disabled={!image || saving} onClick={confirmCrop}><Check size={15} /> {saving ? 'Preparing…' : 'Use this crop'}</button>
        </footer>
      </section>
    </div>
  );
}
