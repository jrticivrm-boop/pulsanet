import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import ChannelMultiSelect from '../ChannelMultiSelect';
import {
  MAP_PTT_MENU_LAYOUT_EVENT,
  readMapPttMenuLayout,
  writeMapPttMenuLayout,
} from './MapPttFloat.jsx';

/**
 * Configuración → Canales: Escuchar | Hablar | Video | Alerta.
 * Estado en DispatchLayout (localStorage). Más adelante puede quedar solo en Radio.
 */
export default function ConfigChannels() {
  const ctx = useOutletContext() || {};
  const {
    groups = [],
    listenIds = [],
    talkIds = [],
    videoIds = [],
    alertIds = [],
    listenMode = 'multiple',
    talkMode = 'individual',
    videoMode = 'individual',
    alertMode = 'individual',
    groupOrder = [],
    onListenChange,
    onTalkIdsChange,
    onVideoIdsChange,
    onAlertIdsChange,
    onListenModeChange,
    onTalkModeChange,
    onVideoModeChange,
    onAlertModeChange,
    onGroupOrderChange,
  } = ctx;

  const [mapPttMenuLayout, setMapPttMenuLayout] = useState(() => readMapPttMenuLayout());

  useEffect(() => {
    const sync = (e) => {
      const mode = e?.detail?.mode || readMapPttMenuLayout();
      setMapPttMenuLayout(mode === 'select' ? 'select' : 'tabs');
    };
    window.addEventListener(MAP_PTT_MENU_LAYOUT_EVENT, sync);
    return () => window.removeEventListener(MAP_PTT_MENU_LAYOUT_EVENT, sync);
  }, []);

  return (
    <div className="cc-channels-cfg">
      <header className="cc-units-head cc-cat-compact-head">
        <div>
          <h2>Canales de radio</h2>
          <p className="cc-hint">
            Aquí se define cómo se verá y operará la Radio: canales a Escuchar, Hablar, Video y
            Alerta, además del modo de visualización (Columnas, Pestañas o Encabezado). La
            selección se guarda en este navegador y se aplica de inmediato en el módulo RADIO PTT.
          </p>
        </div>
      </header>

      <section className="cc-card cc-channels-cfg-card cc-channels-cfg-map-ptt">
        <label className="cc-channels-cfg-map-ptt-field">
          <span className="cc-channels-cfg-map-ptt-title">Menú PTT en mapa maximizado</span>
          <select
            value={mapPttMenuLayout}
            aria-label="Vista del menú PTT en mapa maximizado"
            onChange={(e) => {
              const next = writeMapPttMenuLayout(e.target.value);
              setMapPttMenuLayout(next);
            }}
          >
            <option value="tabs">Pestañas</option>
            <option value="select">Encabezado</option>
          </select>
          <span className="cc-hint">
            Click derecho sobre el PTT flotante del mapa: Escuchar / Hablar / Video / Alerta.
          </span>
        </label>
      </section>

      <section className="cc-card cc-channels-cfg-card">
        {groups.length === 0 ? (
          <p className="cc-hint">
            No hay canales en tu alcance. Revisa membresías en{' '}
            <Link to="/despacho/administracion/grupos">Administración → Grupos</Link>.
          </p>
        ) : (
          <ChannelMultiSelect
            showVideo
            showAlert
            showLayoutSwitcher
            groups={groups}
            orderIds={groupOrder}
            onOrderChange={onGroupOrderChange}
            listenMode={listenMode}
            talkMode={talkMode}
            videoMode={videoMode}
            alertMode={alertMode}
            onListenModeChange={onListenModeChange}
            onTalkModeChange={onTalkModeChange}
            onVideoModeChange={onVideoModeChange}
            onAlertModeChange={onAlertModeChange}
            listenIds={listenIds}
            talkIds={talkIds}
            videoIds={videoIds}
            alertIds={alertIds}
            onListenChange={onListenChange}
            onTalkChange={onTalkIdsChange}
            onVideoChange={onVideoIdsChange}
            onAlertChange={onAlertIdsChange}
          />
        )}
      </section>
    </div>
  );
}
