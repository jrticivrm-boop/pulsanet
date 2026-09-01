import { useEffect, useMemo, useState } from 'react';
import { fetchStickerPacks } from './api';
import {
  EMOJI_CATEGORIES,
  loadRecentEmojis,
  pushRecentEmoji,
  searchEmojis,
} from './emojiData';

/**
 * Panel flotante estilo WhatsApp Web: emojis / GIFs / stickers.
 * @param {{
 *   token: string,
 *   open: boolean,
 *   onClose: () => void,
 *   onPickEmoji: (emoji: string) => void,
 *   onPickSticker: (sticker: object) => void,
 *   stickersDisabled?: boolean,
 * }} props
 */
export default function WaEmojiPicker({
  token,
  open,
  onClose,
  onPickEmoji,
  onPickSticker,
  stickersDisabled = false,
}) {
  const [tab, setTab] = useState('emoji'); // emoji | gif | sticker
  const [catId, setCatId] = useState('smileys');
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState(() => loadRecentEmojis());
  const [packs, setPacks] = useState([]);
  const [packIdx, setPackIdx] = useState(0);

  useEffect(() => {
    if (!open || !token) return undefined;
    let cancelled = false;
    fetchStickerPacks(token)
      .then((data) => {
        if (!cancelled) setPacks(data.packs || []);
      })
      .catch(() => {
        if (!cancelled) setPacks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, token]);

  useEffect(() => {
    if (open) setRecents(loadRecentEmojis());
  }, [open]);

  const categories = useMemo(() => {
    return EMOJI_CATEGORIES.map((c) =>
      c.id === 'recents' ? { ...c, emojis: recents.length ? recents : ['😀', '😂', '👍', '❤️', '🙏', '🔥'] } : c
    );
  }, [recents]);

  const activeCat = categories.find((c) => c.id === catId) || categories[1];
  const filtered = query.trim() ? searchEmojis(query) : null;

  if (!open) return null;

  function pickEmoji(e) {
    setRecents(pushRecentEmoji(e));
    onPickEmoji?.(e);
  }

  return (
    <div className="wa-epicker" role="dialog" aria-label="Emojis y stickers">
      <div className="wa-epicker-body">
        {tab === 'emoji' && (
          <>
            <div className="wa-epicker-cats" role="tablist" aria-label="Categorías">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={catId === c.id && !query}
                  className={catId === c.id && !query ? 'active' : ''}
                  title={c.label}
                  onClick={() => {
                    setQuery('');
                    setCatId(c.id);
                  }}
                >
                  <span aria-hidden="true">{c.icon}</span>
                </button>
              ))}
            </div>
            <div className="wa-epicker-search">
              <span className="wa-epicker-search-ico" aria-hidden="true">
                🔍
              </span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar emoji"
                aria-label="Buscar emoji"
              />
            </div>
            <div className="wa-epicker-scroll">
              {filtered ? (
                <>
                  <p className="wa-epicker-section">Resultados</p>
                  <div className="wa-epicker-grid">
                    {filtered.length === 0 ? (
                      <p className="wa-epicker-empty muted">Sin resultados</p>
                    ) : (
                      filtered.map((e) => (
                        <button key={e} type="button" className="wa-epicker-emoji" onClick={() => pickEmoji(e)}>
                          {e}
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="wa-epicker-section">{activeCat.label}</p>
                  <div className="wa-epicker-grid">
                    {activeCat.emojis.map((e) => (
                      <button key={e} type="button" className="wa-epicker-emoji" onClick={() => pickEmoji(e)}>
                        {e}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {tab === 'gif' && (
          <div className="wa-epicker-scroll wa-epicker-gif">
            <p className="wa-epicker-empty muted">Los GIFs animados llegarán pronto. Usa stickers por ahora.</p>
          </div>
        )}

        {tab === 'sticker' && (
          <>
            <div className="wa-epicker-cats wa-epicker-packs" role="tablist">
              {packs.map((pack, idx) => (
                <button
                  key={pack.id}
                  type="button"
                  className={packIdx === idx ? 'active' : ''}
                  title={pack.name}
                  onClick={() => setPackIdx(idx)}
                >
                  {pack.stickers?.[0]?.value || pack.name?.[0] || '📦'}
                </button>
              ))}
            </div>
            <div className="wa-epicker-scroll">
              {stickersDisabled ? (
                <p className="wa-epicker-empty muted">Stickers no disponibles</p>
              ) : packs.length === 0 ? (
                <p className="wa-epicker-empty muted">No hay stickers disponibles</p>
              ) : (
                <>
                  <p className="wa-epicker-section">{packs[packIdx]?.name || 'Stickers'}</p>
                  <div className="wa-epicker-grid wa-epicker-sticker-grid">
                    {(packs[packIdx]?.stickers || []).map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        className="wa-epicker-sticker"
                        title={s.label}
                        onClick={() => onPickSticker?.(s)}
                      >
                        {s.kind === 'emoji' || !s.value?.startsWith?.('http') ? (
                          <span>{s.value}</span>
                        ) : (
                          <img src={s.value} alt={s.label || 'Sticker'} />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div className="wa-epicker-footer">
        <div className="wa-epicker-tabs" role="tablist">
          <button
            type="button"
            className={tab === 'emoji' ? 'active' : ''}
            aria-label="Emojis"
            onClick={() => setTab('emoji')}
          >
            🙂
          </button>
          <button
            type="button"
            className={tab === 'gif' ? 'active' : ''}
            aria-label="GIFs"
            onClick={() => setTab('gif')}
          >
            GIF
          </button>
          <button
            type="button"
            className={tab === 'sticker' ? 'active' : ''}
            aria-label="Stickers"
            disabled={stickersDisabled}
            onClick={() => setTab('sticker')}
          >
            🎭
          </button>
        </div>
        <button type="button" className="wa-epicker-close" onClick={onClose} aria-label="Cerrar">
          ✕
        </button>
      </div>
    </div>
  );
}
