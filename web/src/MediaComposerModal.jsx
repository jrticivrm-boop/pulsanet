import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  QUICK_EMOJIS,
  canvasToBlob,
  enhanceCanvas,
  loadImageFromFile,
  mosaicAt,
  uid,
} from './mediaComposerUtils';

const TOOLS = [
  { id: 'crop', title: 'Recortar / rotar', icon: 'crop' },
  { id: 'enhance', title: 'Mejorar', icon: '✨' },
  { id: 'draw', title: 'Dibujar', icon: '✏️' },
  { id: 'text', title: 'Texto', icon: 'Aa' },
  { id: 'shape', title: 'Formas', icon: '▭' },
  { id: 'blur', title: 'Mosaico', icon: '▦' },
  { id: 'emoji', title: 'Emoji', icon: '🙂' },
];

/**
 * Vista previa / edición de imágenes antes de enviar (estilo WhatsApp Web).
 * onSend(files: File[], caption: string)
 */
export default function MediaComposerModal({
  files: initialFiles = [],
  initialCaption = '',
  open,
  onClose,
  onSend,
}) {
  const [items, setItems] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [caption, setCaption] = useState(initialCaption || '');
  const [tool, setTool] = useState(null);
  const [hd, setHd] = useState(true);
  const [sending, setSending] = useState(false);
  const [shapeKind, setShapeKind] = useState('rect');
  const [drawColor, setDrawColor] = useState('#25d366');
  const [textDraft, setTextDraft] = useState('');
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const [pendingEmoji, setPendingEmoji] = useState(null);

  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const historyRef = useRef([]);
  const redoRef = useRef([]);
  const drawingRef = useRef(false);
  const lastPtRef = useRef(null);
  const shapeStartRef = useRef(null);
  const cropRef = useRef(null);
  const addInputRef = useRef(null);
  const baseImgRef = useRef(null);

  const active = items.find((x) => x.id === activeId) || items[0];

  const pushHistory = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    historyRef.current.push(c.toDataURL('image/png'));
    if (historyRef.current.length > 40) historyRef.current.shift();
    redoRef.current = [];
  }, []);

  const restoreDataUrl = useCallback((dataUrl) => {
    const c = canvasRef.current;
    if (!c || !dataUrl) return;
    const img = new Image();
    img.onload = () => {
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
  }, []);

  const undo = useCallback(() => {
    const c = canvasRef.current;
    if (!c || historyRef.current.length < 2) return;
    const current = historyRef.current.pop();
    redoRef.current.push(current);
    restoreDataUrl(historyRef.current[historyRef.current.length - 1]);
  }, [restoreDataUrl]);

  const redo = useCallback(() => {
    if (!redoRef.current.length) return;
    const next = redoRef.current.pop();
    historyRef.current.push(next);
    restoreDataUrl(next);
  }, [restoreDataUrl]);

  async function paintSource(source) {
    const img =
      source instanceof HTMLImageElement
        ? source
        : source instanceof Blob || source instanceof File
          ? await loadImageFromFile(source)
          : null;
    if (!img) return;
    baseImgRef.current = img;
    const c = canvasRef.current;
    if (!c) return;
    const max = 1920;
    let w = img.naturalWidth;
    let h = img.naturalHeight;
    if (w > max || h > max) {
      const s = Math.min(max / w, max / h);
      w = Math.round(w * s);
      h = Math.round(h * s);
    }
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);
    historyRef.current = [c.toDataURL('image/png')];
    redoRef.current = [];
    cropRef.current = null;
  }

  async function flushActiveEdit() {
    if (!activeId || !canvasRef.current) return;
    try {
      const blob = await canvasToBlob(canvasRef.current, { hd: true, type: 'image/jpeg' });
      const file = new File([blob], `edit-${activeId}.jpg`, { type: 'image/jpeg' });
      const preview = URL.createObjectURL(blob);
      setItems((prev) =>
        prev.map((it) => {
          if (it.id !== activeId) return it;
          if (it.preview?.startsWith('blob:') && it.edited) URL.revokeObjectURL(it.preview);
          return { ...it, file, preview, edited: true };
        })
      );
    } catch {
      /* ignore */
    }
  }

  async function paintFile(file) {
    await paintSource(file);
  }

  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    if (!open) return undefined;
    const list = (initialFiles || [])
      .filter((f) => f?.type?.startsWith('image/'))
      .map((file) => ({
        id: uid(),
        file,
        preview: URL.createObjectURL(file),
      }));
    setItems(list);
    setActiveId(list[0]?.id || null);
    setCaption(initialCaption || '');
    setTool(null);
    setSending(false);
    setShowEmojiBar(false);
    setPendingEmoji(null);
    return () => {
      list.forEach((it) => {
        if (it.preview) URL.revokeObjectURL(it.preview);
      });
    };
  }, [open, initialFiles, initialCaption]);

  useEffect(() => {
    if (!open || !activeId) return;
    const it = itemsRef.current.find((x) => x.id === activeId);
    if (!it?.file) return;
    let cancelled = false;
    (async () => {
      try {
        if (!cancelled) await paintFile(it.file);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, activeId]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, undo, redo]);

  function canvasPoint(e) {
    const c = canvasRef.current;
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    const scaleX = c.width / rect.width;
    const scaleY = c.height / rect.height;
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    if (clientX == null) return null;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function onPointerDown(e) {
    if (!tool) return;
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    const pt = canvasPoint(e);
    if (!ctx || !pt) return;
    e.preventDefault();
    c.setPointerCapture?.(e.pointerId);

    if (tool === 'emoji' && pendingEmoji) {
      pushHistory();
      ctx.font = `${Math.max(28, Math.round(c.width * 0.06))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pendingEmoji, pt.x, pt.y);
      pushHistory();
      return;
    }

    if (tool === 'text') {
      const value = (textDraft || '').trim() || window.prompt('Texto en la imagen', 'Texto');
      if (!value) return;
      pushHistory();
      ctx.fillStyle = drawColor;
      ctx.font = `bold ${Math.max(22, Math.round(c.width * 0.045))}px system-ui, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 3;
      ctx.strokeText(value, pt.x, pt.y);
      ctx.fillText(value, pt.x, pt.y);
      pushHistory();
      setTextDraft('');
      return;
    }

    if (tool === 'draw' || tool === 'blur') {
      pushHistory();
      drawingRef.current = true;
      lastPtRef.current = pt;
      if (tool === 'blur') mosaicAt(ctx, pt.x, pt.y);
      return;
    }

    if (tool === 'shape' || tool === 'crop') {
      pushHistory();
      drawingRef.current = true;
      shapeStartRef.current = pt;
      lastPtRef.current = pt;
    }
  }

  function onPointerMove(e) {
    if (!drawingRef.current) return;
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    const pt = canvasPoint(e);
    if (!ctx || !pt) return;
    e.preventDefault();

    if (tool === 'draw') {
      ctx.strokeStyle = drawColor;
      ctx.lineWidth = Math.max(3, Math.round(c.width * 0.004));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(lastPtRef.current.x, lastPtRef.current.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      lastPtRef.current = pt;
      return;
    }

    if (tool === 'blur') {
      mosaicAt(ctx, pt.x, pt.y);
      lastPtRef.current = pt;
      return;
    }

    if (tool === 'shape' || tool === 'crop') {
      lastPtRef.current = pt;
      // Redibuja preview desde último snapshot
      const snap = historyRef.current[historyRef.current.length - 1];
      if (!snap) return;
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
        const s = shapeStartRef.current;
        if (!s) return;
        const x = Math.min(s.x, pt.x);
        const y = Math.min(s.y, pt.y);
        const w = Math.abs(pt.x - s.x);
        const h = Math.abs(pt.y - s.y);
        if (tool === 'crop') {
          ctx.fillStyle = 'rgba(0,0,0,0.45)';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.clearRect(x, y, w, h);
          ctx.drawImage(img, x, y, w, h, x, y, w, h);
          ctx.strokeStyle = '#25d366';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);
          cropRef.current = { x, y, w, h };
        } else {
          ctx.strokeStyle = drawColor;
          ctx.lineWidth = Math.max(2, Math.round(c.width * 0.003));
          if (shapeKind === 'circle') {
            ctx.beginPath();
            ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
            ctx.stroke();
          } else if (shapeKind === 'line') {
            ctx.beginPath();
            ctx.moveTo(s.x, s.y);
            ctx.lineTo(pt.x, pt.y);
            ctx.stroke();
          } else {
            ctx.strokeRect(x, y, w, h);
          }
        }
      };
      img.src = snap;
    }
  }

  function onPointerUp() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const c = canvasRef.current;
    if (!c) return;

    if (tool === 'crop' && cropRef.current && cropRef.current.w > 8 && cropRef.current.h > 8) {
      const { x, y, w, h } = cropRef.current;
      const snap = historyRef.current[historyRef.current.length - 1];
      const img = new Image();
      img.onload = () => {
        const tmp = document.createElement('canvas');
        tmp.width = Math.round(w);
        tmp.height = Math.round(h);
        const tctx = tmp.getContext('2d');
        tctx.drawImage(img, x, y, w, h, 0, 0, w, h);
        c.width = tmp.width;
        c.height = tmp.height;
        c.getContext('2d').drawImage(tmp, 0, 0);
        historyRef.current.push(c.toDataURL('image/png'));
        cropRef.current = null;
      };
      img.src = snap;
    } else if (tool === 'draw' || tool === 'blur' || tool === 'shape') {
      historyRef.current.push(c.toDataURL('image/png'));
    }
    lastPtRef.current = null;
    shapeStartRef.current = null;
  }

  function rotate90() {
    const c = canvasRef.current;
    if (!c) return;
    pushHistory();
    const src = document.createElement('canvas');
    src.width = c.width;
    src.height = c.height;
    src.getContext('2d').drawImage(c, 0, 0);
    c.width = src.height;
    c.height = src.width;
    const ctx = c.getContext('2d');
    ctx.translate(c.width, 0);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(src, 0, 0);
    pushHistory();
  }

  function runEnhance() {
    const c = canvasRef.current;
    if (!c) return;
    pushHistory();
    enhanceCanvas(c.getContext('2d'), c.width, c.height);
    pushHistory();
  }

  function selectTool(id) {
    if (id === 'enhance') {
      runEnhance();
      setTool(null);
      return;
    }
    setTool((t) => (t === id ? null : id));
    setShowEmojiBar(id === 'emoji');
    if (id !== 'emoji') setPendingEmoji(null);
  }

  async function addMoreFiles(fileList) {
    const next = [];
    for (const file of Array.from(fileList || [])) {
      if (!file.type?.startsWith('image/')) continue;
      next.push({ id: uid(), file, preview: URL.createObjectURL(file) });
    }
    if (!next.length) return;
    setItems((prev) => [...prev, ...next]);
    if (!activeId) setActiveId(next[0].id);
  }

  async function downloadCurrent() {
    const c = canvasRef.current;
    if (!c) return;
    const blob = await canvasToBlob(c, { hd, type: 'image/jpeg' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tacticalptx-${Date.now()}.jpg`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function exportActiveAsFile(nameHint) {
    const c = canvasRef.current;
    if (!c) return null;
    const blob = await canvasToBlob(c, { hd, type: 'image/jpeg' });
    return new File([blob], nameHint || `image-${Date.now()}.jpg`, { type: 'image/jpeg' });
  }

  async function handleSend() {
    if (!items.length || sending) return;
    setSending(true);
    try {
      const editedActive = await exportActiveAsFile(
        (active?.file?.name || 'image').replace(/\.\w+$/, '') + '.jpg'
      );
      const out = items.map((it) => {
        if (it.id === activeId && editedActive) return editedActive;
        return it.file;
      });
      await onSend?.(out, caption.trim());
      onClose?.();
    } catch {
      setSending(false);
    }
  }

  if (!open) return null;

  return createPortal(
    <div className="media-composer" role="dialog" aria-modal="true" aria-label="Enviar imagen">
      <div className="media-composer-top">
        <button type="button" className="media-composer-icon-btn" onClick={onClose} title="Cerrar" aria-label="Cerrar">
          ✕
        </button>
        <div className="media-composer-tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`media-composer-icon-btn${tool === t.id ? ' is-active' : ''}`}
              title={t.title}
              onClick={() => selectTool(t.id)}
            >
              {t.icon === 'crop' ? <span className="media-composer-crop-ico" aria-hidden="true" /> : t.icon}
            </button>
          ))}
          <button
            type="button"
            className={`media-composer-hd${hd ? ' is-on' : ''}`}
            title={hd ? 'Calidad HD' : 'Calidad estándar'}
            onClick={() => setHd((v) => !v)}
          >
            HD
          </button>
          <button type="button" className="media-composer-icon-btn" title="Deshacer" onClick={undo}>
            ↶
          </button>
          <button type="button" className="media-composer-icon-btn" title="Rehacer" onClick={redo}>
            ↷
          </button>
          <button type="button" className="media-composer-icon-btn" title="Descargar" onClick={downloadCurrent}>
            ⬇
          </button>
        </div>
      </div>

      {(tool === 'crop' || tool === 'shape' || tool === 'draw' || tool === 'text') && (
        <div className="media-composer-subtools">
          {tool === 'crop' && (
            <button type="button" onClick={rotate90}>
              Rotar 90°
            </button>
          )}
          {tool === 'shape' && (
            <>
              <button type="button" className={shapeKind === 'rect' ? 'is-active' : ''} onClick={() => setShapeKind('rect')}>
                Rectángulo
              </button>
              <button type="button" className={shapeKind === 'circle' ? 'is-active' : ''} onClick={() => setShapeKind('circle')}>
                Círculo
              </button>
              <button type="button" className={shapeKind === 'line' ? 'is-active' : ''} onClick={() => setShapeKind('line')}>
                Línea
              </button>
            </>
          )}
          {(tool === 'draw' || tool === 'text' || tool === 'shape') && (
            <label className="media-composer-color">
              Color
              <input type="color" value={drawColor} onChange={(e) => setDrawColor(e.target.value)} />
            </label>
          )}
          {tool === 'text' && (
            <input
              className="media-composer-text-input"
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              placeholder="Escribe el texto y toca la imagen"
              maxLength={120}
            />
          )}
        </div>
      )}

      {showEmojiBar && (
        <div className="media-composer-emojis">
          {QUICK_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              className={pendingEmoji === em ? 'is-active' : ''}
              onClick={() => setPendingEmoji(em)}
            >
              {em}
            </button>
          ))}
          <span className="media-composer-emojis-hint">Elige emoji y toca la foto</span>
        </div>
      )}

      <div className="media-composer-stage" ref={wrapRef}>
        <canvas
          ref={canvasRef}
          className="media-composer-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      <div className="media-composer-bottom">
        <div className="media-composer-caption-row">
          <input
            className="media-composer-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Escribe un mensaje"
            maxLength={2000}
            autoFocus
          />
        </div>
        <div className="media-composer-thumbs">
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              className={`media-composer-thumb${it.id === active?.id ? ' is-active' : ''}`}
              onClick={async () => {
                if (it.id === activeId) return;
                await flushActiveEdit();
                setActiveId(it.id);
              }}
            >
              <img src={it.preview} alt="" />
            </button>
          ))}
          <button
            type="button"
            className="media-composer-thumb media-composer-thumb-add"
            title="Agregar imagen"
            onClick={() => addInputRef.current?.click()}
          >
            +
          </button>
          <input
            ref={addInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              addMoreFiles(e.target.files);
              e.target.value = '';
            }}
          />
        </div>
        <button
          type="button"
          className="media-composer-send"
          disabled={!items.length || sending}
          onClick={handleSend}
          title="Enviar"
          aria-label="Enviar"
        >
          {sending ? '…' : '➤'}
        </button>
      </div>
    </div>,
    document.body
  );
}
