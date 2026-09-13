import { Link, useOutletContext } from 'react-router-dom';
import ChannelMultiSelect from '../ChannelMultiSelect';

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
