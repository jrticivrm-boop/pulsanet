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
    group,
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

  const listenCount = listenIds.length;
  const talkLabel =
    talkIds.length > 1
      ? `${talkIds.length} canales (PTT: ${group?.name || '—'})`
      : group?.name || 'Ninguno';
  const videoLabel =
    videoIds.length > 1
      ? `${videoIds.length} canales`
      : videoIds.length === 1
        ? groups.find((g) => g.id === videoIds[0])?.name || '1 canal'
        : 'Ninguno';
  const alertLabel =
    alertIds.length > 1
      ? `${alertIds.length} canales`
      : alertIds.length === 1
        ? groups.find((g) => g.id === alertIds[0])?.name || '1 canal'
        : 'Ninguno';

  return (
    <div className="cc-channels-cfg">
      <header className="cc-units-head cc-cat-compact-head">
        <div>
          <h2>Canales de radio</h2>
          <p className="cc-hint">
            Escuchar, Hablar, Video y Alerta. Vista: Columnas, Pestañas o Select en encabezado
            (el panel se elige en la misma barra que Individual/Múltiple y se recuerda).
            Individual = un canal (o Ninguno); Múltiple = varios. Video une miembros en una sala;
            Alerta avisa 1 vez por persona. Arrastra para ordenar. Se guarda en este navegador.
          </p>
        </div>
        <p className="cc-units-summary">
          Oye <strong>{listenCount}</strong>
          {groups.length ? ` / ${groups.length}` : ''} · Habla:{' '}
          <strong>{talkLabel}</strong> · Video: <strong>{videoLabel}</strong> · Alerta:{' '}
          <strong>{alertLabel}</strong>
        </p>
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
