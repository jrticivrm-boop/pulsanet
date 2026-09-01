import { Router } from 'express';
import {
  listGrades,
  listEmpleos,
  createGrade,
  renameGrade,
  deleteGrade,
  createEmpleo,
  renameEmpleo,
  deleteEmpleo,
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
    const [grades, empleos] = await Promise.all([
      listGrades(req.user.orgId),
      listEmpleos(req.user.orgId),
    ]);
    res.json({ ok: true, grades, empleos });
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
