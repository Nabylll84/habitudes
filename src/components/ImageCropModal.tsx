import { useCallback, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Modal } from './Modal';

type Area = { width: number; height: number; x: number; y: number };

export type CropMime = 'image/jpeg' | 'image/png';

const OUTPUT = 512;

async function blobFromCrop(src: string, area: Area, mime: CropMime, quality = 0.92): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('Image illisible'));
    im.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT;
  canvas.height = OUTPUT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponible');
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, OUTPUT, OUTPUT);
  }
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, OUTPUT, OUTPUT);
  return new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('Échec du recadrage'))), mime, quality)
  );
}

export function ImageCropModal({
  src,
  name,
  mime,
  onCancel,
  onComplete,
}: {
  src: string;
  name: string;
  mime: CropMime;
  onCancel: () => void;
  onComplete: (file: File) => Promise<void>;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropDone = useCallback((_: Area, computed: Area) => {
    setArea(computed);
  }, []);

  const apply = async () => {
    if (!area || busy) return;
    setBusy(true);
    try {
      const blob = await blobFromCrop(src, area, mime);
      const ext = mime === 'image/png' ? '.png' : '.jpg';
      const file = new File([blob], name.replace(/\.(jpe?g|png|webp|gif)$/i, ext), { type: mime });
      await onComplete(file);
    } catch {
      setBusy(false);
    }
  };

  return (
    <Modal title="Recadrer ma photo" onClose={onCancel} width={420}>
      <div className="crop-stage">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropDone}
          minZoom={1}
          maxZoom={4}
        />
      </div>

      <div className="crop-controls">
        <label className="crop-slider">
          <span>Zoom</span>
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
      </div>

      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          Annuler
        </button>
        <button className="btn btn-primary" onClick={apply} disabled={!area || busy}>
          {busy ? '…' : 'Utiliser cette photo'}
        </button>
      </div>
    </Modal>
  );
}