/**
 * Pack de stickers integrado (ids estables en messages.body).
 * kind: emoji | svg
 */
export const STICKER_PACKS = [
  {
    id: 'tacticalptx',
    name: 'TacticalPtx',
    stickers: [
      { id: 'pn-radio', kind: 'emoji', value: '📻', label: 'Radio' },
      { id: 'pn-mic', kind: 'emoji', value: '🎤', label: 'Micrófono' },
      { id: 'pn-ok', kind: 'emoji', value: '✅', label: 'OK' },
      { id: 'pn-alert', kind: 'emoji', value: '⚠️', label: 'Alerta' },
      { id: 'pn-loc', kind: 'emoji', value: '📍', label: 'Ubicación' },
      { id: 'pn-fire', kind: 'emoji', value: '🔥', label: 'Urgente' },
      { id: 'pn-pray', kind: 'emoji', value: '🙏', label: 'Gracias' },
      { id: 'pn-wave', kind: 'emoji', value: '👋', label: 'Saludo' },
      { id: 'pn-strong', kind: 'emoji', value: '💪', label: 'Fuerza' },
      { id: 'pn-eyes', kind: 'emoji', value: '👀', label: 'Atento' },
      { id: 'pn-check', kind: 'emoji', value: '✔️', label: 'Recibido' },
      { id: 'pn-stop', kind: 'emoji', value: '🛑', label: 'Alto' },
    ],
  },
  {
    id: 'gestos',
    name: 'Gestos',
    stickers: [
      { id: 'gs-thumb', kind: 'emoji', value: '👍', label: 'Bien' },
      { id: 'gs-down', kind: 'emoji', value: '👎', label: 'Mal' },
      { id: 'gs-clap', kind: 'emoji', value: '👏', label: 'Aplauso' },
      { id: 'gs-okhand', kind: 'emoji', value: '👌', label: 'Ok' },
      { id: 'gs-point', kind: 'emoji', value: '👉', label: 'Allá' },
      { id: 'gs-think', kind: 'emoji', value: '🤔', label: 'Pensar' },
      { id: 'gs-laugh', kind: 'emoji', value: '😂', label: 'Risa' },
      { id: 'gs-wow', kind: 'emoji', value: '😮', label: 'Wow' },
    ],
  },
];

const byId = new Map();
for (const pack of STICKER_PACKS) {
  for (const s of pack.stickers) {
    byId.set(s.id, { ...s, packId: pack.id, packName: pack.name });
  }
}

export function getStickerById(id) {
  return byId.get(String(id || '')) || null;
}

export function listStickerPacks() {
  return STICKER_PACKS;
}
