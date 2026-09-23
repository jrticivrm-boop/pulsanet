import { useEffect, useMemo, useState } from 'react';
import {
  addGroupMember,
  canManageUsers,
  createGroup,
  deleteAdminGroup,
  deleteGroupAvatar,
  fetchAdminGroupMembers,
  fetchAdminGroups,
  fetchAdminUsers,
  fetchOrgUnits,
  isAdminUser,
  isRootUser,
  patchAdminGroup,
  purgeGroupMessages,
  removeGroupMember,
  uploadGroupAvatar,
} from '../api';
import AppDialog from '../AppDialog';
import PersonAvatar from '../PersonAvatar';
import { invalidateGroupAvatarBlob } from '../avatarBlobCache.js';

const MEMBER_ROLES = [
  { value: 'member', label: 'Miembro' },
  { value: 'leader', label: 'Líder' },
  { value: 'listen_only', label: 'Solo escucha' },
];

const ALC_ALL_ZONES = '__all__';
const ALC_ALL_UNITS = '__all__';

const ROLE_ALIAS = {
  admin: 'region_admin',
  dispatcher: 'region_user',
  operator: 'unit_user',
};

function normalizeClientRole(role) {
  const raw = String(role || '').trim();
  return ROLE_ALIAS[raw] || raw;
}

function findOrgPath(tree, unitId, adminScopeUnitId) {
  const targets = [unitId, adminScopeUnitId].filter(Boolean);
  if (!targets.length) return { regionId: '', zoneId: '', unitId: '' };
  for (const region of tree || []) {
    for (const zone of region.children || []) {
      if (targets.includes(zone.id)) {
        return {
          regionId: region.id,
          zoneId: zone.id,
          unitId: unitId && unitId !== zone.id ? unitId : '',
        };
      }
      for (const unit of zone.children || []) {
        if (targets.includes(unit.id)) {
          return { regionId: region.id, zoneId: zone.id, unitId: unit.id };
        }
      }
    }
  }
  return { regionId: '', zoneId: '', unitId: unitId || '' };
}

/**
 * Cascada estilo Usuarios / PV → scope_level + ancla unit_id del canal.
 * - root / region_admin: región → todas zonas (canal región) | zona → todos org (canal zona) | unidad
 * - zone_admin: solo canal de una unidad de su zona (no región)
 * - unit_admin: canal fijo a su unidad
 * `hint` = guía del siguiente paso (no es error); `error` = bloqueo real.
 */
function resolveGroupScope({
  role,
  regionId,
  zoneChoice,
  unitChoice,
  lockedUnitId,
}) {
  const r = normalizeClientRole(role);
  if (r === 'unit_admin') {
    const uid = lockedUnitId || (unitChoice && unitChoice !== ALC_ALL_UNITS ? unitChoice : null);
    return {
      scopeLevel: 'unit',
      unitId: uid,
      hint: null,
      error: uid ? null : 'Tu cuenta no tiene unidad asignada.',
    };
  }

  if (r === 'zone_admin') {
    const zoneId = zoneChoice && zoneChoice !== ALC_ALL_ZONES ? zoneChoice : null;
    if (!zoneId) {
      return {
        scopeLevel: 'zone',
        unitId: null,
        hint: 'Falta la zona de tu alcance.',
        error: null,
      };
    }
    if (!unitChoice) {
      return {
        scopeLevel: 'zone',
        unitId: null,
        hint: 'Siguiente paso: todos los organismos de la zona, o una unidad concreta.',
        error: null,
      };
    }
    if (unitChoice === ALC_ALL_UNITS) {
      return { scopeLevel: 'zone', unitId: zoneId, hint: null, error: null };
    }
    return { scopeLevel: 'unit', unitId: unitChoice, hint: null, error: null };
  }

  // region_admin / root
  if (!regionId && r !== 'root') {
    return {
      scopeLevel: 'region',
      unitId: null,
      hint: 'Siguiente paso: selecciona la región del canal.',
      error: null,
    };
  }
  if (!zoneChoice) {
    if (r === 'root' && !regionId) {
      return { scopeLevel: 'region', unitId: null, hint: null, error: null };
    }
    return {
      scopeLevel: 'region',
      unitId: null,
      hint: 'Siguiente paso: elige todas las zonas de la región, o una zona concreta.',
      error: null,
    };
  }
  if (zoneChoice === ALC_ALL_ZONES) {
    return {
      scopeLevel: 'region',
      unitId: regionId || null,
      hint: null,
      error: regionId || r === 'root' ? null : 'Selecciona la región del canal.',
    };
  }
  if (!unitChoice) {
    return {
      scopeLevel: 'zone',
      unitId: null,
      hint: 'Siguiente paso: elige todos los organismos de la zona, o una unidad concreta.',
      error: null,
    };
  }
  if (unitChoice === ALC_ALL_UNITS) {
    return { scopeLevel: 'zone', unitId: zoneChoice, hint: null, error: null };
  }
  return { scopeLevel: 'unit', unitId: unitChoice, hint: null, error: null };
}

function groupScopeHelp(actorRole) {
  const r = normalizeClientRole(actorRole);
  if (r === 'unit_admin') {
    return 'Creas un canal solo para tu unidad. Al asignar miembros solo verás gente de esa unidad.';
  }
  if (r === 'zone_admin') {
    return 'Puedes crear un canal de toda tu zona (todas las unidades) o de una sola unidad. No puedes agregar usuarios ni administradores de región.';
  }
  if (r === 'region_admin' || r === 'root') {
    return 'Elige hasta dónde llega el canal: toda la región, toda una zona, o una unidad. Al asignar verás a la gente de ese alcance (tú puedes meter también perfiles de región).';
  }
  return 'El alcance del canal define quién puede entrar.';
}

function groupScopeLevelExplain(scopeLevel) {
  if (scopeLevel === 'region') {
    return 'Canal de región: puedes agregar personas de todas las zonas y unidades de esa región (y perfiles de región).';
  }
  if (scopeLevel === 'zone') {
    return 'Canal de zona: personas de esa zona y sus unidades. Un administrador de región también puede entrar o agregarse.';
  }
  if (scopeLevel === 'unit') {
    return 'Canal de unidad: personas de esa unidad. Admins de zona/región pueden entrar si quien asigna lo permite.';
  }
  return '';
}

/** Quién puede aparecer en «Asignar miembro» según el rol del que gestiona. */
function actorCanPickMember(actorRole, memberRole) {
  const actor = normalizeClientRole(actorRole);
  const member = normalizeClientRole(memberRole);
  if (actor === 'root' || actor === 'region_admin') return true;
  if (actor === 'zone_admin') {
    return ['zone_admin', 'zone_user', 'unit_admin', 'unit_user'].includes(member);
  }
  if (actor === 'unit_admin') {
    return member === 'unit_admin' || member === 'unit_user';
  }
  return false;
}

function collectDescendantIds(node) {
  const ids = new Set();
  if (!node?.id) return ids;
  ids.add(node.id);
  for (const child of node.children || []) {
    for (const id of collectDescendantIds(child)) ids.add(id);
  }
  return ids;
}

/** Busca cualquier nodo (región / zona / unidad / vínculo) en el árbol. */
function findNodeInTree(tree, id) {
  if (!id) return null;
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.id === id) return n;
      const hit = walk(n.children);
      if (hit) return hit;
    }
    return null;
  }
  return walk(tree);
}

/**
 * Membresía geográfica (cliente), alineada con groupPolicy.memberFitsGroupGeo:
 * - region_* / root: siempre
 * - zone_admin / zone_user: canal cuyo ancla cae bajo su zona (incluye vínculos Coord.)
 * - unit_*: su unidad (o ancla = su unidad)
 */
function memberFitsGroupGeoClient(u, group, orgTree) {
  const role = normalizeClientRole(u?.role);
  if (role === 'root' || role === 'region_admin' || role === 'region_user') return true;
  const level = group?.scopeLevel || group?.scope_level || 'unit';
  const anchor = group?.unitId || group?.unit_id || null;
  if (level === 'region' && !anchor) return true;
  if (!anchor) return false;

  if (u.unitId === anchor || u.adminScopeUnitId === anchor) return true;

  if (role === 'zone_admin' || role === 'zone_user') {
    const zoneRootId = u.adminScopeUnitId || u.unitId;
    if (!zoneRootId) return false;
    const zoneNode = findNodeInTree(orgTree, zoneRootId);
    const ids = collectDescendantIds(zoneNode);
    ids.add(zoneRootId);
    return ids.has(anchor);
  }

  if (role === 'unit_admin' || role === 'unit_user') {
    return u.unitId === anchor || u.adminScopeUnitId === anchor;
  }

  const node = findNodeInTree(orgTree, anchor);
  const ids = collectDescendantIds(node);
  ids.add(anchor);
  return (u.unitId && ids.has(u.unitId)) || (u.adminScopeUnitId && ids.has(u.adminScopeUnitId));
}

function roleTypeLabel(role) {
  const r = normalizeClientRole(role);
  const map = {
    root: 'Administrador',
    region_admin: 'Administrador de región',
    region_user: 'Usuario de región',
    zone_admin: 'Administrador de zona',
    zone_user: 'Usuario de zona',
    unit_admin: 'Administrador de unidad',
    unit_user: 'Usuario de unidad',
  };
  return map[r] || r || 'Usuario';
}

/** Etiqueta clara: rol · adscripción */
function memberAssignLabel(u) {
  const role = roleTypeLabel(u.role);
  const place = u.unitName || u.zoneName || '';
  if (place) return `${u.displayName} — ${role} · ${place}`;
  return `${u.displayName} — ${role}`;
}



export default function DispatchGroups({ session }) {
  const [groups, setGroups] = useState([]);
  const [users, setUsers] = useState([]);
  const [orgTree, setOrgTree] = useState([]);
  const [members, setMembers] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [regionId, setRegionId] = useState('');
  const [zoneChoice, setZoneChoice] = useState('');
  const [unitChoice, setUnitChoice] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [assign, setAssign] = useState({ groupId: '', userId: '', role: 'member' });
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState(null);
  const [dialogBusy, setDialogBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const canManage = canManageUsers(session.user);
  const canPurge = isAdminUser(session.user);
  const isRoot = isRootUser(session.user);
  const isUnitAdmin = session.user?.role === 'unit_admin';
  const isZoneAdmin = session.user?.role === 'zone_admin';
  const isRegionScopeActor =
    session.user?.role === 'region_admin' || session.user?.role === 'root';
  const lockedUnitId =
    session.user?.adminScopeUnitId || session.user?.unitId || '';
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const orgRegions = useMemo(() => orgTree || [], [orgTree]);
  const orgZones = useMemo(() => {
    if (!regionId) return [];
    const region = orgRegions.find((r) => r.id === regionId);
    return region?.children || [];
  }, [orgRegions, regionId]);
  const selectedZoneId =
    zoneChoice && zoneChoice !== ALC_ALL_ZONES ? zoneChoice : '';
  const orgUnits = useMemo(() => {
    if (!selectedZoneId) return [];
    const zone = orgZones.find((z) => z.id === selectedZoneId);
    return zone?.children || [];
  }, [orgZones, selectedZoneId]);

  const regionName = orgRegions.find((r) => r.id === regionId)?.name || 'la región';
  const zoneName = orgZones.find((z) => z.id === selectedZoneId)?.name || 'la zona';
  const allowAllZones = isRegionScopeActor;
  const showZoneStep = Boolean(regionId) || isUnitAdmin || isZoneAdmin;
  const showUnitStep =
    isUnitAdmin ||
    isZoneAdmin ||
    (Boolean(zoneChoice) && zoneChoice !== ALC_ALL_ZONES);
  /** Zona admin y región pueden elegir «todos los organismos» de la zona. */
  const allowAllUnits = isRegionScopeActor || isZoneAdmin;

  const previewScope = useMemo(
    () =>
      resolveGroupScope({
        role: session.user?.role,
        regionId,
        zoneChoice,
        unitChoice,
        lockedUnitId,
      }),
    [session.user?.role, regionId, zoneChoice, unitChoice, lockedUnitId]
  );

  const assignableUsers = useMemo(() => {
    const actorRole = session.user?.role;
    const g = groups.find((x) => x.id === assign.groupId);
    return (users || []).filter((u) => {
      if (!actorCanPickMember(actorRole, u.role)) return false;
      if (assign.groupId && !memberFitsGroupGeoClient(u, g, orgTree)) return false;
      return true;
    });
  }, [users, session.user?.role, assign.groupId, groups, orgTree]);

  function applyOrgLocks(tree) {
    if (isUnitAdmin && lockedUnitId) {
      const path = findOrgPath(tree, lockedUnitId, lockedUnitId);
      setRegionId(path.regionId || '');
      setZoneChoice(path.zoneId || '');
      setUnitChoice(path.unitId || lockedUnitId);
      return;
    }
    if (isZoneAdmin && lockedUnitId) {
      const path = findOrgPath(tree, lockedUnitId, lockedUnitId);
      setRegionId(path.regionId || '');
      setZoneChoice(path.zoneId || '');
      setUnitChoice('');
    }
  }

  async function reload() {
    const [g, u, org] = await Promise.all([
      fetchAdminGroups(session.token),
      fetchAdminUsers(session.token),
      fetchOrgUnits(session.token).catch(() => ({ tree: [] })),
    ]);
    const tree = org.tree || org.units || [];
    setGroups(g.groups || []);
    setUsers(u.users || []);
    setOrgTree(tree);
    applyOrgLocks(tree);
  }

  async function loadMembers(groupId) {
    if (!groupId) {
      setMembers([]);
      return;
    }
    const data = await fetchAdminGroupMembers(session.token, groupId);
    setMembers(data.members || []);
  }

  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, [session.token]);

  useEffect(() => {
    loadMembers(selectedGroupId).catch((e) => setError(e.message));
  }, [selectedGroupId, session.token]);

  function resetCreateCascade() {
    if (isUnitAdmin) {
      applyOrgLocks(orgTree);
      return;
    }
    if (isZoneAdmin) {
      applyOrgLocks(orgTree);
      return;
    }
    setRegionId('');
    setZoneChoice('');
    setUnitChoice('');
  }

  async function onCreate(e) {
    e.preventDefault();
    try {
      const resolved = resolveGroupScope({
        role: session.user?.role,
        regionId,
        zoneChoice,
        unitChoice,
        lockedUnitId,
      });
      if (resolved.error) {
        setError(resolved.error);
        return;
      }
      if (resolved.hint) {
        setError(resolved.hint);
        return;
      }
      await createGroup(session.token, {
        name,
        description,
        unitId: resolved.unitId,
        scopeLevel: resolved.scopeLevel,
      });
      setName('');
      setDescription('');
      resetCreateCascade();
      await reload();
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function onAssign(e) {
    e.preventDefault();
    try {
      await addGroupMember(session.token, assign.groupId, assign.userId, assign.role);
      const gid = assign.groupId;
      setAssign({ groupId: '', userId: '', role: 'member' });
      await reload();
      if (selectedGroupId === gid || selectedGroupId) {
        await loadMembers(selectedGroupId || gid);
      }
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function onAvatarFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !selectedGroupId) return;
    setAvatarBusy(true);
    try {
      await uploadGroupAvatar(session.token, selectedGroupId, file);
      invalidateGroupAvatarBlob(selectedGroupId, selectedGroup?.avatarUrl || '');
      await reload();
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  async function onRemoveAvatar() {
    if (!selectedGroupId) return;
    setAvatarBusy(true);
    try {
      await deleteGroupAvatar(session.token, selectedGroupId);
      invalidateGroupAvatarBlob(selectedGroupId, selectedGroup?.avatarUrl || '');
      await reload();
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAvatarBusy(false);
    }
  }

  function closeDialog() {
    if (dialogBusy) return;
    setDialog(null);
  }

  function askConfirm({ title, message, confirmLabel, danger, run }) {
    setDialog({
      title,
      message,
      confirmLabel,
      danger: Boolean(danger),
      alertOnly: false,
      run,
    });
  }

  async function runDialogAction() {
    if (!dialog?.run) {
      setDialog(null);
      return;
    }
    setDialogBusy(true);
    try {
      const next = await dialog.run();
      if (next?.alert) {
        setDialog({
          title: next.alert.title || 'Aviso',
          message: next.alert.message,
          confirmLabel: next.alert.confirmLabel || 'Entendido',
          danger: false,
          alertOnly: true,
          run: async () => {},
        });
      } else {
        setDialog(null);
      }
      setError('');
    } catch (err) {
      setDialog(null);
      setError(err.message);
    } finally {
      setDialogBusy(false);
    }
  }

  function deactivateGroup(g) {
    askConfirm({
      title: 'Desactivar grupo',
      message: `¿Desactivar el grupo «${g.name}»?`,
      confirmLabel: 'Desactivar',
      danger: true,
      run: async () => {
        await deleteAdminGroup(session.token, g.id, { hard: false });
        await reload();
      },
    });
  }

  function hardDeleteGroup(g) {
    askConfirm({
      title: 'Eliminar permanentemente',
      message: `¿Eliminar permanentemente «${g.name}» y todo su historial de chat?`,
      confirmLabel: 'Eliminar',
      danger: true,
      run: async () => {
        await deleteAdminGroup(session.token, g.id, { hard: true });
        if (selectedGroupId === g.id) setSelectedGroupId('');
        await reload();
      },
    });
  }

  async function reactivateGroup(g) {
    try {
      await patchAdminGroup(session.token, g.id, { isActive: true });
      await reload();
    } catch (err) {
      setError(err.message);
    }
  }

  function purgeChat(g) {
    askConfirm({
      title: 'Vaciar chat',
      message: `¿Vaciar todos los mensajes del chat «${g.name}»?`,
      confirmLabel: 'Vaciar',
      danger: true,
      run: async () => {
        const r = await purgeGroupMessages(session.token, g.id);
        return {
          alert: {
            title: 'Chat vaciado',
            message: `Mensajes eliminados: ${r.deleted ?? 0}`,
          },
        };
      },
    });
  }

  function kickMember(userId) {
    if (!selectedGroupId) return;
    askConfirm({
      title: 'Quitar miembro',
      message: '¿Quitar a este miembro del grupo?',
      confirmLabel: 'Quitar',
      danger: true,
      run: async () => {
        await removeGroupMember(session.token, selectedGroupId, userId);
        await loadMembers(selectedGroupId);
        await reload();
      },
    });
  }

  return (
    <div className="dispatch-page cc-groups-page cc-cat-compact">
      <header className="dispatch-header cc-cat-compact-head">
        <div>
          <h1>Grupos y canales</h1>
          <p className="cc-page-sub">
            {isUnitAdmin
              ? 'Canales de tu unidad. Solo agregas operadores de esa unidad.'
              : isZoneAdmin
                ? 'Canales de toda tu zona o de una unidad. No agregas perfiles de región.'
                : 'Canales por región, zona o unidad. Al asignar ves a la gente de ese alcance.'}
          </p>
        </div>
        <p className="cc-units-summary">{groups.length} grupo(s)</p>
      </header>
      {error && <p className="error">{error}</p>}

      {canManage && (
      <div className="cc-groups-forms">
        <form className="cc-groups-form" onSubmit={onCreate}>
          <h2>Nuevo grupo</h2>
          <label className="cc-groups-field">
            <span>Nombre</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label className="cc-groups-field">
            <span>Descripción</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="cc-groups-field cc-groups-scope">
            <span className="cc-groups-scope-title">Alcance del canal</span>
            <p className="cc-hint cc-groups-scope-hint">{groupScopeHelp(session.user?.role)}</p>
            <div className="cc-form-grid cc-form-grid--3">
              <label className="field">
                <span>Región{isRegionScopeActor || isZoneAdmin || isUnitAdmin ? ' *' : ''}</span>
                <select
                  value={regionId}
                  disabled={isUnitAdmin || isZoneAdmin}
                  required={isRegionScopeActor || isZoneAdmin || isUnitAdmin}
                  onChange={(e) => {
                    setRegionId(e.target.value);
                    setZoneChoice('');
                    setUnitChoice('');
                  }}
                >
                  <option value="">— Selecciona —</option>
                  {orgRegions.map((region) => (
                    <option key={region.id} value={region.id}>
                      {region.name}
                    </option>
                  ))}
                </select>
              </label>
              {showZoneStep && (
                <label className="field">
                  <span>Zona / C.G. *</span>
                  <select
                    value={zoneChoice}
                    disabled={isUnitAdmin || isZoneAdmin || !regionId}
                    required
                    onChange={(e) => {
                      setZoneChoice(e.target.value);
                      setUnitChoice('');
                    }}
                  >
                    <option value="">— Selecciona —</option>
                    {allowAllZones ? (
                      <option value={ALC_ALL_ZONES}>
                        Todas las zonas de {regionName} (canal de región)
                      </option>
                    ) : null}
                    {orgZones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {showUnitStep && (
                <label className="field">
                  <span>
                    Unidad
                    {isUnitAdmin || isZoneAdmin ? ' *' : ''}
                  </span>
                  <select
                    value={unitChoice}
                    disabled={isUnitAdmin || !selectedZoneId}
                    required={isUnitAdmin || isZoneAdmin || Boolean(zoneChoice)}
                    onChange={(e) => setUnitChoice(e.target.value)}
                  >
                    <option value="">— Selecciona —</option>
                    {allowAllUnits && !isUnitAdmin ? (
                      <option value={ALC_ALL_UNITS}>
                        Todos los organismos de {zoneName} (canal de zona)
                      </option>
                    ) : null}
                    {orgUnits.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <p className="cc-hint cc-groups-scope-preview">
              {previewScope.error ? (
                <span className="error">{previewScope.error}</span>
              ) : previewScope.hint ? (
                <span>{previewScope.hint}</span>
              ) : (
                <>
                  Se creará como canal de{' '}
                  <strong>
                    {previewScope.scopeLevel === 'region'
                      ? 'región'
                      : previewScope.scopeLevel === 'zone'
                        ? 'zona'
                        : 'unidad'}
                  </strong>
                  . {groupScopeLevelExplain(previewScope.scopeLevel)}
                </>
              )}
            </p>
          </div>
          <div className="cc-groups-form-actions">
            <button type="submit" className="cc-btn primary">
              Crear grupo
            </button>
          </div>
        </form>

        <form className="cc-groups-form" onSubmit={onAssign}>
          <h2>Asignar miembro</h2>
          <p className="cc-hint">Primero el grupo, luego la persona y al final el rol en el canal.</p>
          <label className="cc-groups-field">
            <span>Grupo</span>
            <select
              value={assign.groupId}
              onChange={(e) =>
                setAssign({
                  groupId: e.target.value,
                  userId: '',
                  role: 'member',
                })
              }
              required
            >
              <option value="">Seleccionar…</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {g.unitName ? ` · ${g.unitName}` : ''}
                </option>
              ))}
            </select>
          </label>
          {assign.groupId ? (
            <label className="cc-groups-field">
              <span>Usuario</span>
              <select
                value={assign.userId}
                onChange={(e) =>
                  setAssign({
                    ...assign,
                    userId: e.target.value,
                    role: 'member',
                  })
                }
                required
              >
                <option value="">Seleccionar…</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {memberAssignLabel(u)}
                  </option>
                ))}
              </select>
              {isZoneAdmin ? (
                <span className="cc-hint">
                  No aparecen usuarios ni administradores de región: no puedes agregarlos a tus
                  canales.
                </span>
              ) : isUnitAdmin ? (
                <span className="cc-hint">
                  Solo personas de tu unidad (operadores / admin de unidad).
                </span>
              ) : (
                <span className="cc-hint">
                  La lista se filtra según el nivel del canal (región / zona / unidad).
                </span>
              )}
            </label>
          ) : null}
          {assign.groupId && assign.userId ? (
            <label className="cc-groups-field">
              <span>Rol en canal</span>
              <select
                value={assign.role}
                onChange={(e) => setAssign({ ...assign, role: e.target.value })}
              >
                {MEMBER_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {assign.groupId && assign.userId ? (
            <div className="cc-groups-form-actions">
              <button type="submit" className="cc-btn primary">
                Asignar
              </button>
            </div>
          ) : null}
        </form>
      </div>
      )}

      <div className="cc-groups-list-wrap">
        <ul className="cc-groups-list">
          {groups.map((g) => {
            const isOpen = selectedGroupId === g.id;
            return (
              <li key={g.id} className={`cc-group-card${isOpen ? ' is-selected' : ''}`}>
                <div className="cc-group-card-main">
                  <div className="cc-group-card-head">
                    <PersonAvatar
                      groupId={g.id}
                      avatarUrl={g.avatarUrl}
                      name={g.name}
                      token={session.token}
                      group
                      className="cc-group-avatar"
                    />
                    <strong>{g.name}</strong>
                    <span className={`status-pill ${g.is_active ? 'on' : 'off'}`}>
                      {g.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <code className="cc-group-room">{g.livekit_room}</code>
                  <span className="cc-group-meta">
                    {g.member_count} miembro(s)
                    {g.scopeLabel
                      ? ` · ${g.scopeLabel}`
                      : g.unitName
                        ? ` · ${g.unitName}`
                        : g.unitId
                          ? ''
                          : ' · Región'}
                  </span>
                </div>
                <div className="cc-group-card-actions">
                  <button
                    type="button"
                    className={`cc-btn ghost cc-btn-sm${isOpen ? ' is-active' : ''}`}
                    aria-expanded={isOpen}
                    onClick={() => setSelectedGroupId(isOpen ? '' : g.id)}
                  >
                    Miembros
                  </button>
                  {canPurge && g.is_active && (
                    <button type="button" className="cc-btn ghost cc-btn-sm" onClick={() => purgeChat(g)}>
                      Vaciar
                    </button>
                  )}
                  {canManage && g.is_active && (
                    <button
                      type="button"
                      className="cc-btn ghost cc-btn-sm"
                      onClick={() => deactivateGroup(g)}
                    >
                      Desactivar
                    </button>
                  )}
                  {canManage && !g.is_active && (
                    <button type="button" className="cc-btn ghost cc-btn-sm" onClick={() => reactivateGroup(g)}>
                      Reactivar
                    </button>
                  )}
                  {isRoot && (
                    <button type="button" className="cc-btn danger cc-btn-sm" onClick={() => hardDeleteGroup(g)}>
                      Eliminar
                    </button>
                  )}
                </div>
                {isOpen && (
                  <section className="members-panel cc-groups-members cc-groups-members--inline">
                    <h2>Miembros — {g.name || g.id}</h2>

                    {canManage && (
                      <div className="cc-group-avatar-edit">
                        <PersonAvatar
                          groupId={g.id}
                          avatarUrl={g.avatarUrl}
                          name={g.name}
                          token={session.token}
                          group
                          className="cc-group-avatar cc-group-avatar-lg"
                        />
                        <div className="cc-group-avatar-actions">
                          <p className="cc-hint">Imagen del canal (JPG, PNG o WebP, máx. 3 MB)</p>
                          <label className="cc-btn ghost cc-btn-sm">
                            {avatarBusy ? 'Subiendo…' : 'Cambiar imagen'}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                              hidden
                              disabled={avatarBusy}
                              onChange={onAvatarFile}
                            />
                          </label>
                          {g.avatarUrl && (
                            <button
                              type="button"
                              className="cc-btn ghost cc-btn-sm"
                              disabled={avatarBusy}
                              onClick={onRemoveAvatar}
                            >
                              Quitar imagen
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {members.length === 0 ? (
                      <p className="cc-hint">Sin miembros en este canal.</p>
                    ) : (
                      <div className="cc-cat-chips">
                        {members.map((m) => (
                          <div key={m.id} className="cc-dep-org-chip cc-group-member-chip">
                            <span className="cc-cat-item-name">{m.displayName}</span>
                            <span className="cc-group-member-role">
                              {MEMBER_ROLES.find((r) => r.value === m.role)?.label || m.role}
                            </span>
                            {canManage && (
                              <button
                                type="button"
                                className="cc-cat-rm"
                                title="Quitar"
                                onClick={() => kickMember(m.id)}
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <AppDialog
        open={Boolean(dialog)}
        title={dialog?.title}
        message={dialog?.message}
        confirmLabel={dialog?.confirmLabel}
        danger={dialog?.danger}
        alertOnly={dialog?.alertOnly}
        busy={dialogBusy}
        onCancel={closeDialog}
        onConfirm={runDialogAction}
      />
    </div>
  );
}
