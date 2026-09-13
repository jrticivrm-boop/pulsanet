import { useEffect, useMemo, useState } from 'react';
import {
  createAdminUser,
  deleteAdminUser,
  fetchAdminGroups,
  fetchAdminUsers,
  canManageUsers,
  unlockAdminUserLogin,
  isRootUser,
  patchAdminUser,
  previewAdminUsername,
  usersCsvUrl,
  fetchOrgUnits,
  fetchGradesEmpleos,
} from '../api';
import { EJERCITO_MEXICANO_GRADE_GROUPS } from './armyGrades.js';
import { formatMatriculaInput, isValidMatricula, matriculaDigitMax, splitMatricula } from '../matricula.js';
import { openPeerSheet } from '../peerActions';

const ROLE_OPTIONS = [
  { value: 'operator', label: 'Operador' },
  { value: 'dispatcher', label: 'Despacho' },
  { value: 'unit_admin', label: 'Admin de unidad' },
  { value: 'zone_admin', label: 'Admin de zona' },
  { value: 'admin', label: 'Administrador (Región)' },
  { value: 'root', label: 'Superadministrador' },
];

const EMPTY_FORM = {
  grade: '',
  specialty: '',
  cargo: '',
  givenNames: '',
  paternalSurname: '',
  maternalSurname: '',
  matricula: '',
  role: 'operator',
  regionId: '',
  zoneId: '',
  unitId: '',
  adminScopeUnitId: '',
  canSeeRegion: false,
  canSeeZones: false,
  canSeeUnits: false,
};

function fieldFilled(value) {
  return String(value || '').trim().length > 0;
}

function CreateStepIndicator({ step, editMode = false }) {
  const steps = editMode
    ? [
        { id: 'datos', n: 1, label: 'Generales' },
        { id: 'adscripcion', n: 2, label: 'Adscripción' },
      ]
    : [
        { id: 'datos', n: 1, label: 'Generales' },
        { id: 'adscripcion', n: 2, label: 'Adscripción' },
        { id: 'grupos', n: 3, label: 'Grupos' },
      ];
  const order = steps.map((s) => s.id);
  const currentIdx = order.indexOf(step);
  return (
    <nav className="cc-form-stepper" aria-label={editMode ? 'Pasos de edición' : 'Pasos del alta'}>
      {steps.map((s, i) => {
        const done = i < currentIdx;
        const active = s.id === step;
        return (
          <div
            key={s.id}
            className={`cc-form-step${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
          >
            <span className="cc-form-step-num">{done ? '\u2713' : s.n}</span>
            <span className="cc-form-step-label">{s.label}</span>
          </div>
        );
      })}
    </nav>
  );
}

function MissingFieldsList({ items }) {
  const pending = items.filter((x) => !x.ok);
  if (!pending.length) {
    return (
      <p className="cc-form-checklist ok" role="status">
        Listo para continuar — todos los campos obligatorios están completos.
      </p>
    );
  }
  return (
    <div className="cc-form-checklist warn" role="status">
      <strong>Falta completar:</strong>
      <ul>
        {pending.map((x) => (
          <li key={x.label}>{x.label}</li>
        ))}
      </ul>
    </div>
  );
}

/** Sugiere General si existe; si no, el primer grupo activo. */
function suggestedGroupIds(groups) {
  const active = (groups || []).filter((g) => g.is_active !== false);
  if (!active.length) return [];
  const general = active.find((g) => String(g.name).toLowerCase() === 'general');
  return [(general || active[0]).id];
}

function roleLabel(role) {
  return ROLE_OPTIONS.find((r) => r.value === role)?.label || role || '—';
}

function userInitials(u) {
  const name = u.fullName || u.displayName || u.username || '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function userMetaLine(u) {
  const parts = [];
  if (u.grade) parts.push(u.grade);
  if (u.specialty && u.specialty !== u.grade) parts.push(u.specialty);
  const cargo = String(u.cargo || '').trim();
  if (cargo && cargo !== u.specialty && !String(u.displayName || '').includes(cargo)) {
    parts.push(cargo);
  }
  return parts.join(' · ');
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

function UserCard({
  u,
  session,
  canManage,
  isRoot,
  onEdit,
  onChangeRole,
  onToggleVisibility,
  onToggleActive,
  onUnlockLogin,
  onResetPassword,
  onTogglePanicPerm,
  onRemoveUser,
}) {
  const meta = userMetaLine(u);
  const canEdit =
    canManage && u.id !== session.user.id && (isRoot || u.role !== 'root');
  const panicLabel =
    u.role === 'root' || u.role === 'admin' || u.role === 'dispatcher'
      ? 'Por rol'
      : u.canReceivePanic
        ? 'Sí'
        : 'No';

  return (
    <li className="cc-user-card">
      <div className="cc-user-card-main">
        <div className="cc-user-card-id">
          <span className="cc-user-avatar" aria-hidden="true">
            {userInitials(u)}
          </span>
          <div className="cc-user-card-head">
            <strong className="cc-user-callsign">{u.displayName}</strong>
            <span className="cc-user-fullname">{u.fullName || '—'}</span>
            {meta ? <span className="cc-user-meta">{meta}</span> : null}
          </div>
          <span className={`status-pill cc-user-status ${u.isActive ? 'on' : 'off'}`}>
            {u.isActive ? 'Activo' : 'Inactivo'}
          </span>
          {u.loginLocked ? (
            <span className="status-pill cc-user-status off" title={u.loginLockedReason || 'Bloqueo por intentos'}>
              Login bloqueado
            </span>
          ) : null}
        </div>

        <div className="cc-user-card-fields">
          <div className="cc-user-field">
            <span className="cc-user-field-label">Usuario</span>
            <code className="cc-mono cc-user-mono">{u.username}</code>
            {u.mustChangePassword ? (
              <span className="cc-user-tag" title="Debe cambiar contraseña al entrar">
                clave temporal
              </span>
            ) : null}
          </div>
          <div className="cc-user-field">
            <span className="cc-user-field-label">Matrícula</span>
            <code className="cc-mono cc-user-mono">{u.matricula || '—'}</code>
          </div>
          <div className="cc-user-field">
            <span className="cc-user-field-label">Rol</span>
            {canEdit ? (
              <select
                className="cc-user-select"
                value={u.role}
                onChange={(e) => onChangeRole(u, e.target.value)}
                aria-label={`Rol de ${u.displayName}`}
              >
                {ROLE_OPTIONS.filter((r) => r.value !== 'root' || isRoot).map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="cc-user-field-value">{roleLabel(u.role)}</span>
            )}
          </div>
          <div className="cc-user-field">
            <span className="cc-user-field-label">Visibilidad</span>
            <div className="cc-priv-row" title="Región / Zonas / Unidades">
              {[
                ['canSeeRegion', 'R', 'Región'],
                ['canSeeZones', 'Z', 'Zonas'],
                ['canSeeUnits', 'U', 'Unidades'],
              ].map(([key, short, title]) => {
                const on = Boolean(u[key]);
                return (
                  <button
                    key={key}
                    type="button"
                    className={`cc-priv-chip${on ? ' on' : ''}`}
                    title={`${title}${on ? ' (activo)' : ' (inactivo)'}`}
                    disabled={!canEdit}
                    onClick={() => canEdit && onToggleVisibility(u, key)}
                  >
                    {short}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="cc-user-field">
            <span className="cc-user-field-label">Pánico</span>
            <span className="cc-user-field-value">{panicLabel}</span>
          </div>
        </div>
      </div>

      <footer className="cc-user-card-actions">
        <button
          type="button"
          className="cc-btn primary cc-btn-sm"
          onClick={() =>
            openPeerSheet({
              id: u.id,
              displayName: u.displayName || u.fullName || u.username,
            })
          }
        >
          Contactar
        </button>
        {canEdit && (
          <>
          <button type="button" className="cc-btn ghost cc-btn-sm" onClick={() => onEdit(u)}>
            Editar
          </button>
          <button type="button" className="cc-btn ghost cc-btn-sm" onClick={() => onToggleActive(u)}>
            {u.isActive ? 'Desactivar' : 'Activar'}
          </button>
          {u.loginLocked && (
            <button type="button" className="cc-btn primary cc-btn-sm" onClick={() => onUnlockLogin(u)}>
              Desbloquear login
            </button>
          )}
          <button type="button" className="cc-btn ghost cc-btn-sm" onClick={() => onResetPassword(u)}>
            Restablecer clave
          </button>
          {u.role === 'operator' && (
            <button type="button" className="cc-btn ghost cc-btn-sm" onClick={() => onTogglePanicPerm(u)}>
              {u.canReceivePanic ? 'Quitar pánico' : 'Dar pánico'}
            </button>
          )}
          {isRoot && (
            <button type="button" className="cc-btn danger cc-btn-sm" onClick={() => onRemoveUser(u)}>
              Eliminar
            </button>
          )}
          </>
        )}
      </footer>
    </li>
  );
}

export default function DispatchUsers({ session }) {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [orgTree, setOrgTree] = useState([]);
  const [gradeGroups, setGradeGroups] = useState(EJERCITO_MEXICANO_GRADE_GROUPS);
  const [empleos, setEmpleos] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [preview, setPreview] = useState({ username: '', displayName: '', fullName: '' });
  const [step, setStep] = useState('datos'); // 'datos' | 'adscripcion' | 'grupos'
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  /** null = alta; objeto usuario = edición */
  const [editingUser, setEditingUser] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  /** Modal de credenciales temporales (alta / restablecer). */
  const [credModal, setCredModal] = useState(null);
  /** Confirmación in-app (restablecer / eliminar). */
  const [confirmModal, setConfirmModal] = useState(null);
  const [copied, setCopied] = useState(false);
  const canManage = canManageUsers(session.user);
  const isRoot = isRootUser(session.user);

  const composedDisplayName = preview.displayName || '';

  const previewKey = useMemo(
    () =>
      [form.grade, form.givenNames, form.paternalSurname, form.maternalSurname, form.cargo]
        .map((s) => String(s || '').trim())
        .join('|'),
    [form.grade, form.givenNames, form.paternalSurname, form.maternalSurname, form.cargo]
  );

  const orgRegions = useMemo(() => orgTree || [], [orgTree]);

  const orgZones = useMemo(() => {
    if (!form.regionId) return [];
    const region = orgRegions.find((r) => r.id === form.regionId);
    return region?.children || [];
  }, [orgRegions, form.regionId]);

  const orgUnits = useMemo(() => {
    if (!form.zoneId) return [];
    const zone = orgZones.find((z) => z.id === form.zoneId);
    return zone?.children || [];
  }, [orgZones, form.zoneId]);

  const activeGroups = useMemo(
    () => (groups || []).filter((g) => g.is_active !== false),
    [groups]
  );

  const filteredUsers = useMemo(() => {
    let list = users;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          (u.displayName || '').toLowerCase().includes(q) ||
          (u.fullName || '').toLowerCase().includes(q) ||
          (u.username || '').toLowerCase().includes(q) ||
          (u.matricula || '').toLowerCase().includes(q) ||
          (u.cargo || '').toLowerCase().includes(q) ||
          (u.specialty || '').toLowerCase().includes(q)
      );
    }
    if (roleFilter) list = list.filter((u) => u.role === roleFilter);
    if (statusFilter === 'active') list = list.filter((u) => u.isActive);
    if (statusFilter === 'inactive') list = list.filter((u) => !u.isActive);
    return list;
  }, [users, search, roleFilter, statusFilter]);

  const userStats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.isActive).length,
      shown: filteredUsers.length,
    }),
    [users, filteredUsers]
  );

  async function reload(opts = {}) {
    const silent = opts.silent === true;
    if (!silent && users.length === 0) setLoading(true);
    else setRefreshing(true);
    try {
      const [usersData, groupsData, orgData, catData] = await Promise.all([
        fetchAdminUsers(session.token),
        fetchAdminGroups(session.token),
        fetchOrgUnits(session.token).catch(() => ({ tree: [] })),
        fetchGradesEmpleos(session.token).catch(() => null),
      ]);
      setUsers(usersData.users || []);
      setOrgTree(orgData.tree || []);
      setGroups(groupsData.groups || []);
      if (catData?.grades?.length) {
        const map = new Map();
        for (const g of catData.grades) {
          const key = g.category || 'Grados';
          if (!map.has(key)) map.set(key, []);
          map.get(key).push({ value: g.abbreviation, label: g.name });
        }
        const order = new Map((catData.jerarquias || []).map((j, i) => [j.name, i]));
        setGradeGroups(
          [...map.entries()]
            .sort((a, b) => {
              const ia = order.has(a[0]) ? order.get(a[0]) : 999;
              const ib = order.has(b[0]) ? order.get(b[0]) : 999;
              if (ia !== ib) return ia - ib;
              return a[0].localeCompare(b[0], 'es');
            })
            .map(([label, options]) => ({ label, options }))
        );
      }
      setEmpleos(catData?.empleos || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    reload().catch(() => {});
  }, [session.token]);

  function openCreateModal() {
    resetCreateFlow();
    setEditingUser(null);
    setCreateOpen(true);
  }

  function openEditModal(u) {
    if (!canManage) return;
    const path = findOrgPath(orgTree, u.unitId, u.adminScopeUnitId);
    setEditingUser(u);
    setForm({
      grade: u.grade || '',
      specialty: u.specialty || '',
      cargo: u.cargo || '',
      givenNames: u.givenNames || '',
      paternalSurname: u.paternalSurname || '',
      maternalSurname: u.maternalSurname || '',
      matricula: formatMatriculaInput(u.matricula || ''),
      role: u.role || 'operator',
      regionId: path.regionId || '',
      zoneId: path.zoneId || '',
      unitId: path.unitId || u.unitId || '',
      adminScopeUnitId: u.adminScopeUnitId || '',
      canSeeRegion: Boolean(u.canSeeRegion),
      canSeeZones: Boolean(u.canSeeZones),
      canSeeUnits: Boolean(u.canSeeUnits),
    });
    setPreview({
      username: u.username || '',
      displayName: u.displayName || '',
      fullName: u.fullName || '',
    });
    setStep('datos');
    setSelectedGroupIds([]);
    setError('');
    setCreateOpen(true);
  }

  function closeCreateModal() {
    if (busy) return;
    setCreateOpen(false);
    setEditingUser(null);
    resetCreateFlow();
  }

  useEffect(() => {
    if (!canManage || !createOpen) return;
    if (!form.grade.trim() || !form.givenNames.trim() || !form.paternalSurname.trim()) {
      if (!editingUser) {
        setPreview({ username: '', displayName: '', fullName: '' });
      }
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      previewAdminUsername(session.token, {
        grade: form.grade,
        givenNames: form.givenNames,
        paternalSurname: form.paternalSurname,
        maternalSurname: form.maternalSurname,
        cargo: form.cargo,
      })
        .then((data) => {
          if (cancelled) return;
          setPreview({
            username: editingUser?.username || data.username || '',
            displayName: data.displayName || data.callSign || '',
            fullName: data.fullName || '',
          });
        })
        .catch(() => {
          if (!cancelled && !editingUser) {
            setPreview({ username: '', displayName: '', fullName: '' });
          }
        });
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [previewKey, canManage, session.token, createOpen, editingUser]);

  function resetCreateFlow() {
    setForm(EMPTY_FORM);
    setPreview({ username: '', displayName: '', fullName: '' });
    setStep('datos');
    setSelectedGroupIds([]);
  }

  function goToAdscripcionStep(e) {
    e.preventDefault();
    if (!form.grade.trim() || !form.matricula.trim()) {
      setError('Completa grado y matrícula.');
      return;
    }
    if (!isValidMatricula(form.matricula)) {
      const { letter } = splitMatricula(form.matricula);
      const max = matriculaDigitMax(letter || 'B');
      setError(
        `Matrícula inválida: A-/B-/C-/D- y ${max} números (ej. ${letter === 'A' ? 'A-12345678' : 'D-1412643'}).`,
      );
      return;
    }
    if (!preview.username || !composedDisplayName) {
      setError('Completa grado, nombre y apellido paterno.');
      return;
    }
    setError('');
    setStep('adscripcion');
  }

  function goToGroupsStep(e) {
    e.preventDefault();
    if (!form.regionId) {
      setError('Selecciona la región.');
      return;
    }
    if (!form.zoneId) {
      setError('Selecciona la zona.');
      return;
    }
    if (form.role === 'unit_admin' && !form.unitId) {
      setError('Selecciona la unidad de adscripción.');
      return;
    }
    setError('');
    if (editingUser) {
      onSaveEdit();
      return;
    }
    setSelectedGroupIds(suggestedGroupIds(activeGroups));
    setStep('grupos');
  }

  function toggleGroup(id) {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function onSaveEdit() {
    if (!editingUser) return;
    if (!isValidMatricula(form.matricula)) {
      const { letter } = splitMatricula(form.matricula);
      const max = matriculaDigitMax(letter || 'B');
      setError(
        `Matrícula inválida: A-/B-/C-/D- y ${max} números (ej. ${letter === 'A' ? 'A-12345678' : 'D-1412643'}).`,
      );
      return;
    }
    setBusy(true);
    try {
      const adminScopeUnitId =
        form.role === 'zone_admin'
          ? form.zoneId || null
          : form.role === 'unit_admin'
            ? form.unitId || null
            : form.adminScopeUnitId || null;
      await patchAdminUser(session.token, editingUser.id, {
        grade: form.grade,
        specialty: form.specialty || null,
        cargo: form.cargo || null,
        givenNames: form.givenNames,
        paternalSurname: form.paternalSurname,
        maternalSurname: form.maternalSurname || null,
        matricula: formatMatriculaInput(form.matricula),
        role: form.role,
        unitId: form.unitId || null,
        adminScopeUnitId,
        canSeeRegion: form.canSeeRegion,
        canSeeZones: form.canSeeZones,
        canSeeUnits: form.canSeeUnits,
      });
      setEditingUser(null);
      setCreateOpen(false);
      resetCreateFlow();
      await reload({ silent: true });
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const adminScopeUnitId =
        form.role === 'zone_admin'
          ? form.zoneId || undefined
          : form.role === 'unit_admin'
            ? form.unitId || undefined
            : form.adminScopeUnitId || undefined;
      const created = await createAdminUser(session.token, {
        ...form,
        matricula: formatMatriculaInput(form.matricula),
        unitId: form.unitId || undefined,
        adminScopeUnitId,
        canSeeRegion: form.canSeeRegion,
        canSeeZones: form.canSeeZones,
        canSeeUnits: form.canSeeUnits,
        groupIds: selectedGroupIds,
      });
      resetCreateFlow();
      setEditingUser(null);
      setCreateOpen(false);
      await reload({ silent: true });
      setError('');
      const gNames = (created.groups || []).map((g) => g.name).join(', ');
      setCredModal({
        title: 'Usuario creado',
        username: created.user?.username || '',
        temporaryPassword: created.temporaryPassword || '',
        hint: 'Debe cambiarla en el primer ingreso.',
        groups: gNames || 'Sin grupos',
      });
      setCopied(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(u) {
    try {
      await patchAdminUser(session.token, u.id, { isActive: !u.isActive });
      await reload({ silent: true });
    } catch (err) {
      setError(err.message);
    }
  }

  async function unlockLogin(u) {
    try {
      await unlockAdminUserLogin(session.token, u.id);
      await reload({ silent: true });
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  async function togglePanicPerm(u) {
    try {
      await patchAdminUser(session.token, u.id, { canReceivePanic: !u.canReceivePanic });
      await reload({ silent: true });
    } catch (err) {
      setError(err.message);
    }
  }

  async function changeRole(u, role) {
    try {
      const vis =
        role === 'admin' || role === 'root'
          ? { canSeeRegion: true, canSeeZones: true, canSeeUnits: true }
          : role === 'zone_admin'
            ? { canSeeRegion: false, canSeeZones: true, canSeeUnits: true }
            : role === 'unit_admin'
              ? { canSeeRegion: false, canSeeZones: false, canSeeUnits: true }
              : { canSeeRegion: false, canSeeZones: false, canSeeUnits: false };
      await patchAdminUser(session.token, u.id, { role, ...vis });
      await reload({ silent: true });
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleVisibility(u, key) {
    try {
      const next = !u[key];
      const patch = { [key]: next };
      if (key === 'canSeeRegion' && next) {
        patch.canSeeZones = true;
        patch.canSeeUnits = true;
      }
      if (key === 'canSeeZones' && next) {
        patch.canSeeUnits = true;
      }
      await patchAdminUser(session.token, u.id, patch);
      await reload({ silent: true });
    } catch (err) {
      setError(err.message);
    }
  }

  function resetPassword(u) {
    setConfirmModal({
      title: 'Restablecer contraseña',
      message: `¿Generar contraseña temporal para ${u.displayName || u.username}? Deberá cambiarla al entrar.`,
      confirmLabel: 'Generar clave',
      danger: false,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          const data = await patchAdminUser(session.token, u.id, { resetPassword: true });
          setError('');
          setCredModal({
            title: 'Contraseña restablecida',
            username: u.username,
            temporaryPassword: data.temporaryPassword || '',
            hint: 'Debe cambiarla en el próximo ingreso.',
            groups: null,
          });
          setCopied(false);
          await reload({ silent: true });
        } catch (err) {
          setError(err.message);
        }
      },
    });
  }

  function removeUser(u) {
    setConfirmModal({
      title: 'Eliminar usuario',
      message: `¿Eliminar a ${u.displayName || u.username}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await deleteAdminUser(session.token, u.id);
          await reload({ silent: true });
        } catch (err) {
          setError(err.message);
        }
      },
    });
  }

  async function copyCredentials() {
    if (!credModal?.temporaryPassword) return;
    const text = [
      `Usuario: ${credModal.username}`,
      `Contraseña temporal: ${credModal.temporaryPassword}`,
      credModal.hint,
      credModal.groups ? `Grupos: ${credModal.groups}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  function downloadCsv() {
    fetch(usersCsvUrl(), {
      headers: { Authorization: `Bearer ${session.token}` },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error('No se pudo exportar');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'tacticalptx-usuarios.csv';
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((e) => setError(e.message));
  }

  const datosChecklist = useMemo(
    () => [
      { label: 'Grado', ok: fieldFilled(form.grade) },
      { label: 'Nombre(s)', ok: fieldFilled(form.givenNames) },
      { label: 'Apellido paterno', ok: fieldFilled(form.paternalSurname) },
      { label: 'Matrícula', ok: isValidMatricula(form.matricula) },
      { label: 'Usuario generado', ok: fieldFilled(preview.username) },
      { label: 'Indicativo', ok: fieldFilled(composedDisplayName) },
    ],
    [form, preview, composedDisplayName]
  );

  const adscripcionChecklist = useMemo(
    () => [
      { label: 'Región', ok: fieldFilled(form.regionId) },
      { label: 'Zona / C.G.', ok: fieldFilled(form.zoneId) },
      ...(form.role === 'unit_admin'
        ? [{ label: 'Unidad', ok: fieldFilled(form.unitId) }]
        : []),
    ],
    [form]
  );

  return (
    <div className="dispatch-page cc-users-page cc-cat-compact">
      <header className="dispatch-header cc-cat-compact-head">
        <div>
          <h1>Usuarios</h1>
          <p className="cc-page-sub">Alta y administración de operadores.</p>
        </div>
        <div className="cc-users-header-actions">
          {canManage && (
            <button type="button" className="cc-btn primary" onClick={openCreateModal}>
              + Nuevo usuario
            </button>
          )}
          <button type="button" className="cc-btn" onClick={downloadCsv}>
            Exportar CSV
          </button>
          <button
            type="button"
            className="cc-btn ghost"
            onClick={() => reload({ silent: true })}
            disabled={loading || refreshing}
            aria-label="Actualizar lista"
          >
            {refreshing ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="cc-users-toolbar">
        <label className="cc-users-search">
          <span className="visually-hidden">Buscar usuario</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar indicativo, nombre, matrícula…"
            disabled={loading}
          />
        </label>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filtrar por rol"
          disabled={loading}
        >
          <option value="">Todos los roles</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filtrar por estado"
          disabled={loading}
        >
          <option value="">Activos e inactivos</option>
          <option value="active">Solo activos</option>
          <option value="inactive">Solo inactivos</option>
        </select>
        <div className="cc-users-stats" aria-live="polite">
          <span className="cc-users-stat">
            <strong>{userStats.shown}</strong> mostrados
          </span>
          <span className="cc-users-stat">
            <strong>{userStats.active}</strong> activos
          </span>
          <span className="cc-users-stat muted">
            de {userStats.total} total
          </span>
        </div>
      </div>

      <div className={`cc-users-list-wrap${refreshing ? ' is-refreshing' : ''}`}>
        {loading ? (
          <ul className="cc-users-list" aria-busy="true" aria-label="Cargando usuarios">
            {Array.from({ length: 6 }, (_, i) => (
              <li key={i} className="cc-user-card cc-user-card--skeleton">
                <div className="cc-user-card-main">
                  <div className="cc-user-card-id">
                    <span className="cc-user-avatar cc-skeleton-bar" />
                    <div className="cc-user-card-head" style={{ flex: 1 }}>
                      <span className="cc-skeleton-bar" style={{ width: '55%' }} />
                      <span className="cc-skeleton-bar" style={{ width: '75%', marginTop: 6 }} />
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : filteredUsers.length === 0 ? (
          <div className="cc-users-empty">
            <p>
              {users.length === 0
                ? 'Aún no hay usuarios registrados.'
                : 'Ningún usuario coincide con la búsqueda o filtros.'}
            </p>
            {canManage && users.length === 0 && (
              <button type="button" className="cc-btn primary" onClick={openCreateModal}>
                Crear primer usuario
              </button>
            )}
          </div>
        ) : (
          <ul className="cc-users-list">
            {filteredUsers.map((u) => (
              <UserCard
                key={u.id}
                u={u}
                session={session}
                canManage={canManage}
                isRoot={isRoot}
                onEdit={openEditModal}
                onChangeRole={changeRole}
                onToggleVisibility={toggleVisibility}
                onToggleActive={toggleActive}
                onUnlockLogin={unlockLogin}
                onResetPassword={resetPassword}
                onTogglePanicPerm={togglePanicPerm}
                onRemoveUser={removeUser}
              />
            ))}
          </ul>
        )}
      </div>

      {createOpen && canManage && (
        <div
          className="sys-modal-backdrop"
          role="presentation"
        >
          <div
            className="sys-modal sys-modal--lg cc-users-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-user-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sys-modal-head">
              <h2 id="create-user-title">
                {editingUser ? 'Editar usuario' : 'Alta de usuario'}
              </h2>
              <button
                type="button"
                className="sys-modal-x"
                aria-label="Cerrar"
                onClick={closeCreateModal}
              >
                ×
              </button>
            </header>
            <form
              className="admin-form cc-users-create-form"
              onSubmit={
                step === 'datos'
                  ? goToAdscripcionStep
                  : step === 'adscripcion'
                    ? goToGroupsStep
                    : onCreate
              }
            >
              <CreateStepIndicator step={step} editMode={Boolean(editingUser)} />
          {step === 'datos' && (
            <>
              <MissingFieldsList items={datosChecklist} />
              <section className="cc-form-section">
                <h3 className="cc-form-section-title">Identidad militar</h3>
                <div className="cc-form-grid">
                  <label className="field">
                    <span>Grado *</span>
                    <select
                      value={form.grade}
                      onChange={(e) => setForm({ ...form, grade: e.target.value })}
                      required
                    >
                      <option value="" disabled>
                        Selecciona grado
                      </option>
                      {gradeGroups.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.options.map((g) => (
                            <option key={g.value} value={g.value}>
                              {g.value}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Especialidad / Empleo</span>
                    {empleos.length > 0 ? (
                      <select
                        value={form.specialty}
                        onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                      >
                        <option value="">—</option>
                        {empleos.map((e) => (
                          <option key={e.id} value={e.name}>
                            {e.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={form.specialty}
                        onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                        placeholder="TIC, Inf., Com…"
                      />
                    )}
                  </label>
                  <label className="field">
                    <span>
                      Matrícula *{' '}
                      <em className="cc-field-hint-inline">A=8 · B-/C-/D =7</em>
                    </span>
                    <input
                      value={form.matricula}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          matricula: formatMatriculaInput(e.target.value, {
                            prev: form.matricula,
                          }),
                        })
                      }
                      onBlur={(e) =>
                        setForm({
                          ...form,
                          matricula: formatMatriculaInput(e.target.value),
                        })
                      }
                      placeholder="D-"
                      inputMode="text"
                      autoComplete="off"
                      spellCheck={false}
                      title="Primero letra A/B/C/D; el guion se inserta solo. Backspace borra letra+guion. A=8 / BCD=7"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Rol en el sistema</span>
                    <select
                      value={form.role}
                      onChange={(e) => {
                        const role = e.target.value;
                        const next = { ...form, role };
                        if (role === 'admin' || role === 'root') {
                          next.canSeeRegion = true;
                          next.canSeeZones = true;
                          next.canSeeUnits = true;
                        } else if (role === 'zone_admin') {
                          next.canSeeRegion = false;
                          next.canSeeZones = true;
                          next.canSeeUnits = true;
                        } else if (role === 'unit_admin') {
                          next.canSeeRegion = false;
                          next.canSeeZones = false;
                          next.canSeeUnits = true;
                        } else {
                          next.canSeeRegion = false;
                          next.canSeeZones = false;
                          next.canSeeUnits = false;
                        }
                        setForm(next);
                      }}
                    >
                      {ROLE_OPTIONS.filter((r) => r.value !== 'root' || isRoot).map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="cc-form-section">
                <h3 className="cc-form-section-title">Nombre completo</h3>
                <div className="cc-form-grid">
                  <label className="field cc-form-span-2">
                    <span>Nombre(s) *</span>
                    <input
                      value={form.givenNames}
                      onChange={(e) => setForm({ ...form, givenNames: e.target.value })}
                      placeholder="Juan Carlos"
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Apellido paterno *</span>
                    <input
                      value={form.paternalSurname}
                      onChange={(e) => setForm({ ...form, paternalSurname: e.target.value })}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>Apellido materno</span>
                    <input
                      value={form.maternalSurname}
                      onChange={(e) => setForm({ ...form, maternalSurname: e.target.value })}
                      placeholder="De la Cruz"
                    />
                  </label>
                </div>
              </section>

              <section className="cc-form-section">
                <h3 className="cc-form-section-title">Cargo</h3>
                <div className="cc-form-grid">
                  <label className="field cc-form-span-2">
                    <span>Cargo / puesto</span>
                    <input
                      value={form.cargo}
                      onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                      placeholder="desarrollador, Op. Radio…"
                    />
                  </label>
                </div>
              </section>

              <section className="cc-form-section cc-form-preview">
                <h3 className="cc-form-section-title">Identificador</h3>
                <div className="cc-form-grid">
                  <label className="field">
                    <span>Usuario de acceso (login)</span>
                    <input
                      value={preview.username}
                      readOnly
                      placeholder="Automático"
                      className="cc-input-readonly"
                    />
                  </label>
                  <label className="field">
                    <span>Se muestra como</span>
                    <input
                      value={composedDisplayName}
                      readOnly
                      placeholder="Sgto. 1/o. Gomez, desarrollador"
                      className="cc-input-readonly cc-preview-callsign"
                    />
                  </label>
                </div>
              </section>

              <div className="field field-actions cc-form-actions">
                <button
                  type="submit"
                  className="cc-btn primary"
                  disabled={
                    !preview.username ||
                    !composedDisplayName ||
                    !isValidMatricula(form.matricula)
                  }
                >
                  Continuar a adscripción →
                </button>
              </div>
            </>
          )}

          {step === 'adscripcion' && (
            <>
              <div className="cc-create-summary">
                <p>
                  <strong>{composedDisplayName || preview.displayName || 'Nuevo usuario'}</strong>
                  {preview.fullName ? (
                    <span className="muted"> · {preview.fullName}</span>
                  ) : null}
                </p>
                <p className="muted">
                  Matrícula: <code className="cc-mono">{form.matricula}</code> · {roleLabel(form.role)}
                </p>
              </div>
              <MissingFieldsList items={adscripcionChecklist} />
              <section className="cc-form-section">
                <h3 className="cc-form-section-title">Ubicación orgánica</h3>
                <p className="cc-group-pick-hint">
                  Región → Zona / C.G. → Unidad de adscripción (en cascada).
                </p>
                <div className="cc-form-grid cc-form-grid--3">
                  <label className="field">
                    <span>Región *</span>
                    <select
                      value={form.regionId}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          regionId: e.target.value,
                          zoneId: '',
                          unitId: '',
                        })
                      }
                      required
                    >
                      <option value="">— Selecciona —</option>
                      {orgRegions.map((region) => (
                        <option key={region.id} value={region.id}>
                          {region.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Zona / C.G. *</span>
                    <select
                      value={form.zoneId}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          zoneId: e.target.value,
                          unitId: '',
                        })
                      }
                      required
                      disabled={!form.regionId}
                    >
                      <option value="">— Selecciona —</option>
                      {orgZones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Unidad{form.role === 'unit_admin' ? ' *' : ''}</span>
                    <select
                      value={form.unitId}
                      onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                      disabled={!form.zoneId}
                      required={form.role === 'unit_admin'}
                    >
                      <option value="">— Opcional —</option>
                      {orgUnits.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
              <section className="cc-form-section">
                <fieldset className="cc-priv-fieldset">
                  <legend>Privilegios de radio / visibilidad</legend>
                  <p className="cc-group-pick-hint">
                    Región = todos los canales · Zonas = sus unidades · Unidades = operadores
                    desplegados.
                  </p>
                  <div className="cc-priv-check-list">
                    <label className={`cc-priv-check${form.canSeeRegion ? ' on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={form.canSeeRegion}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            canSeeRegion: e.target.checked,
                            canSeeZones: e.target.checked ? true : form.canSeeZones,
                            canSeeUnits: e.target.checked ? true : form.canSeeUnits,
                          })
                        }
                      />
                      <span className="cc-priv-check-body">
                        <span className="cc-priv-check-name">Ver Región</span>
                        <span className="cc-priv-check-desc">
                          (maestro: todos los canales y seguimiento)
                        </span>
                      </span>
                    </label>
                    <label className={`cc-priv-check${form.canSeeZones ? ' on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={form.canSeeZones}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            canSeeZones: e.target.checked,
                            canSeeUnits: e.target.checked ? true : form.canSeeUnits,
                          })
                        }
                      />
                      <span className="cc-priv-check-body">
                        <span className="cc-priv-check-name">Ver Zonas / C.G.</span>
                        <span className="cc-priv-check-desc">
                          (unidades subordinadas + seguimiento)
                        </span>
                      </span>
                    </label>
                    <label className={`cc-priv-check${form.canSeeUnits ? ' on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={form.canSeeUnits}
                        onChange={(e) => setForm({ ...form, canSeeUnits: e.target.checked })}
                      />
                      <span className="cc-priv-check-body">
                        <span className="cc-priv-check-name">Ver Unidades</span>
                        <span className="cc-priv-check-desc">
                          (servicios desplegados / usuarios de la unidad)
                        </span>
                      </span>
                    </label>
                  </div>
                </fieldset>
              </section>
              <div className="field field-actions cc-form-actions">
                <button
                  type="button"
                  className="cc-btn ghost"
                  onClick={() => setStep('datos')}
                >
                  ← Atrás
                </button>
                <button type="submit" className="cc-btn primary" disabled={busy}>
                  {editingUser
                    ? busy
                      ? 'Guardando…'
                      : 'Guardar cambios'
                    : 'Continuar a grupos →'}
                </button>
              </div>
            </>
          )}

          {step === 'grupos' && !editingUser && (
            <>
              <div className="cc-create-summary">
                <p>
                  <strong>{composedDisplayName || preview.displayName || 'Nuevo usuario'}</strong>
                  {preview.fullName ? (
                    <span className="muted"> · {preview.fullName}</span>
                  ) : null}
                </p>
                <p>
                  Usuario: <code className="cc-mono">{preview.username}</code>
                  {' · '}
                  Matrícula: <code className="cc-mono">{form.matricula}</code>
                  {' · '}
                  {roleLabel(form.role)}
                </p>
                <p className="muted">
                  {[form.grade, form.specialty, form.cargo].filter(Boolean).join(' · ')}
                  {form.unitId && orgUnits.find((u) => u.id === form.unitId)
                    ? ` · ${orgUnits.find((u) => u.id === form.unitId)?.name}`
                    : ''}
                </p>
              </div>

              <fieldset className="cc-group-pick">
                <legend>¿A qué grupos ingresa?</legend>
                <p className="cc-group-pick-hint">
                  Se sugiere el canal <strong>General</strong> cuando existe. Puedes marcar
                  varios o ninguno.
                </p>
                {activeGroups.length === 0 ? (
                  <p className="muted">No hay grupos activos. Puedes crear el usuario sin canal.</p>
                ) : (
                  <ul className="cc-group-check-list">
                    {activeGroups.map((g) => {
                      const suggested = suggestedGroupIds(activeGroups).includes(g.id);
                      const checked = selectedGroupIds.includes(g.id);
                      return (
                        <li key={g.id}>
                          <label className={`cc-group-check ${checked ? 'on' : ''}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleGroup(g.id)}
                            />
                            <span className="cc-group-check-body">
                              <span className="cc-group-check-name">{g.name}</span>
                              {suggested && (
                                <span className="cc-group-suggest">sugerido</span>
                              )}
                              {g.description ? (
                                <span className="cc-group-check-desc">{g.description}</span>
                              ) : null}
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </fieldset>

              <div className="field field-actions">
                <button
                  type="button"
                  className="cc-btn ghost"
                  onClick={() => setStep('adscripcion')}
                  disabled={busy}
                >
                  Atrás
                </button>
                <button type="submit" className="cc-btn primary" disabled={busy}>
                  {busy
                    ? 'Creando…'
                    : selectedGroupIds.length
                      ? `Crear e ingresar a ${selectedGroupIds.length} grupo(s)`
                      : 'Crear sin grupos'}
                </button>
              </div>
            </>
          )}
            </form>
          </div>
        </div>
      )}

      {credModal && (
        <div className="sys-modal-backdrop" role="presentation" data-esc-close>
          <div
            className="sys-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cred-modal-title"
          >
            <header className="sys-modal-head">
              <h2 id="cred-modal-title">{credModal.title}</h2>
              <button
                type="button"
                className="sys-modal-x"
                data-esc-close-btn
                aria-label="Cerrar"
                onClick={() => setCredModal(null)}
              >
                ×
              </button>
            </header>
            <div className="sys-modal-body">
              <p className="sys-modal-lead">
                Entrega estas credenciales al operador. No se volverán a mostrar.
              </p>
              <dl className="sys-cred-list">
                <div>
                  <dt>Usuario</dt>
                  <dd>
                    <code>{credModal.username}</code>
                  </dd>
                </div>
                {credModal.temporaryPassword ? (
                  <div>
                    <dt>Contraseña temporal</dt>
                    <dd>
                      <code className="sys-cred-pass">{credModal.temporaryPassword}</code>
                    </dd>
                  </div>
                ) : null}
                {credModal.groups ? (
                  <div>
                    <dt>Grupos</dt>
                    <dd>{credModal.groups}</dd>
                  </div>
                ) : null}
              </dl>
              {credModal.hint ? <p className="sys-modal-hint">{credModal.hint}</p> : null}
            </div>
            <footer className="sys-modal-actions">
              {credModal.temporaryPassword ? (
                <button type="button" className="cc-btn ghost" onClick={copyCredentials}>
                  {copied ? 'Copiado' : 'Copiar'}
                </button>
              ) : null}
              <button type="button" className="cc-btn primary" onClick={() => setCredModal(null)}>
                Entendido
              </button>
            </footer>
          </div>
        </div>
      )}

      {confirmModal && (
        <div className="sys-modal-backdrop" role="presentation" data-esc-close>
          <div
            className="sys-modal sys-modal--sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
          >
            <header className="sys-modal-head">
              <h2 id="confirm-modal-title">{confirmModal.title}</h2>
              <button
                type="button"
                className="sys-modal-x"
                data-esc-close-btn
                aria-label="Cerrar"
                onClick={() => setConfirmModal(null)}
              >
                ×
              </button>
            </header>
            <div className="sys-modal-body">
              <p>{confirmModal.message}</p>
            </div>
            <footer className="sys-modal-actions">
              <button type="button" className="cc-btn ghost" onClick={() => setConfirmModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className={`cc-btn ${confirmModal.danger ? 'danger' : 'primary'}`}
                onClick={() => confirmModal.onConfirm?.()}
              >
                {confirmModal.confirmLabel || 'Confirmar'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

