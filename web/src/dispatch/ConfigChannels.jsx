import { Link, useOutletContext } from 'react-router-dom';
import ChannelMultiSelect from '../ChannelMultiSelect';

/**
 * Configuración → Canales: elegir en cuáles oír y en cuál hablar (PTT).
 * El estado vive en DispatchLayout (localStorage) y aplica a toda la consola.
 */
export default function ConfigChannels() {
  const ctx = useOutletContext() || {};
  const {
    groups = [],
    group,
    listenIds = [],
    onGroupChange,
    onListenChange,
  } = ctx;

  const listenCount = listenIds.length;
  const talkName = group?.name || '—';

  return (
    <div className="cc-channels-cfg">
      <header className="cc-units-head cc-cat-compact-head">
        <div>
          <h2>Canales a escuchar</h2>
          <p className="cc-hint">
            Marca los grupos/canales que quieres oír en la consola. El PTT solo
            transmite en el canal «Hablar en». La selección se guarda en este
            navegador.
          </p>
        </div>
        <p className="cc-units-summary">
          Oyendo <strong>{listenCount}</strong>
          {groups.length ? ` de ${groups.length}` : ''} · Hablar en:{' '}
          <strong>{talkName}</strong>
        </p>
      </header>

      <section className="cc-card cc-channels-cfg-card">
        {groups.length === 0 ? (
          <p className="cc-hint">
            No hay canales en tu alcance. Revisa membresías en{' '}
            <Link to="/despacho/catalogos/grupos">Catálogos → Grupos</Link>.
          </p>
        ) : (
          <ChannelMultiSelect
            groups={groups}
            talkGroupId={group?.id}
            listenIds={listenIds}
            onTalkChange={onGroupChange}
            onListenChange={onListenChange}
            label="Grupos / canales"
          />
        )}
      </section>
    </div>
  );
}
