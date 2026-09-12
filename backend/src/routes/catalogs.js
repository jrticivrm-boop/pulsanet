import { Router } from 'express';
import {
  listGrades,
  listEmpleos,
  listJerarquias,
  createGrade,
  renameGrade,
  deleteGrade,
  createEmpleo,
  renameEmpleo,
  deleteEmpleo,
  createJerarquia,
  renameJerarquia,
  deleteJerarquia,
  reorderJerarquias,
  reorderGrades,
} from '../services/catalogs.js';
import { isAdmin, canManageUsers } from '../services/roles.js';
import { authMiddleware } from '../middleware/auth.js';

export const catalogsRouter = Router();
catalogsRouter.use(authMiddleware);

function requireCatalogView(req, res, next) {
  if (!canManageUsers(req.user.role) && req.user.role !== 'dispatcher') {
    return res.status(403).json({ ok: false, error: 'Sin permiso' });
  }
  next();
}

function requireCatalogEdit(req, res, next) {
  if (!isAdmin(req.user.role)) {
    return res.status(403).json({ ok: false, error: 'Solo root o admin pueden editar catálogos' });
  }
  next();
}

function sendErr(res, err) {
  const status = err.status || 500;
  res.status(status).json({ ok: false, error: err.message || 'Error' });
}

catalogsRouter.get('/grades-empleos', requireCatalogView, async (req, res) => {
  try {
    const [grades, empleos, jerarquias] = await Promise.all([
      listGrades(req.user.orgId),
      listEmpleos(req.user.orgId),
      listJerarquias(req.user.orgId),
    ]);
    res.json({ ok: true, grades, empleos, jerarquias });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.get('/jerarquias', requireCatalogView, async (req, res) => {
  try {
    const jerarquias = await listJerarquias(req.user.orgId);
    res.json({ ok: true, jerarquias });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.post('/jerarquias', requireCatalogEdit, async (req, res) => {
  try {
    const row = await createJerarquia(req.user.orgId, req.body || {});
    res.status(201).json({ ok: true, jerarquia: row });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.put('/jerarquias/reorder', requireCatalogEdit, async (req, res) => {
  try {
    const jerarquias = await reorderJerarquias(req.user.orgId, req.body?.ids);
    res.json({ ok: true, jerarquias });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.post('/jerarquias/reorder', requireCatalogEdit, async (req, res) => {
  try {
    const jerarquias = await reorderJerarquias(req.user.orgId, req.body?.ids);
    res.json({ ok: true, jerarquias });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.patch('/jerarquias/:id', requireCatalogEdit, async (req, res) => {
  try {
    const row = await renameJerarquia(req.user.orgId, req.params.id, req.body || {});
    res.json({ ok: true, jerarquia: row });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.delete('/jerarquias/:id', requireCatalogEdit, async (req, res) => {
  try {
    await deleteJerarquia(req.user.orgId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.post('/grades', requireCatalogEdit, async (req, res) => {
  try {
    const row = await createGrade(req.user.orgId, req.body || {});
    res.status(201).json({ ok: true, grade: row });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.post('/grades/reorder', requireCatalogEdit, async (req, res) => {
  try {
    const grades = await reorderGrades(req.user.orgId, req.body?.ids);
    res.json({ ok: true, grades });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.patch('/grades/:id', requireCatalogEdit, async (req, res) => {
  try {
    const row = await renameGrade(req.user.orgId, req.params.id, req.body || {});
    res.json({ ok: true, grade: row });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.delete('/grades/:id', requireCatalogEdit, async (req, res) => {
  try {
    await deleteGrade(req.user.orgId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.post('/empleos', requireCatalogEdit, async (req, res) => {
  try {
    const row = await createEmpleo(req.user.orgId, req.body || {});
    res.status(201).json({ ok: true, empleo: row });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.patch('/empleos/:id', requireCatalogEdit, async (req, res) => {
  try {
    const row = await renameEmpleo(req.user.orgId, req.params.id, req.body || {});
    res.json({ ok: true, empleo: row });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.delete('/empleos/:id', requireCatalogEdit, async (req, res) => {
  try {
    await deleteEmpleo(req.user.orgId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    sendErr(res, err);
  }
});
