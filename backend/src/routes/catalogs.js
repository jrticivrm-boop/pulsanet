import { Router } from 'express';
import {
  listGrades,
  listEmpleos,
  listServicios,
  listJerarquias,
  createGrade,
  renameGrade,
  deleteGrade,
  createEmpleo,
  renameEmpleo,
  deleteEmpleo,
  createServicio,
  renameServicio,
  deleteServicio,
  createJerarquia,
  renameJerarquia,
  deleteJerarquia,
  reorderJerarquias,
  reorderGrades,
} from '../services/catalogs.js';
import { authMiddleware } from '../middleware/auth.js';
import { requireModuleAction } from '../services/moduleAccess.js';
import { listTerritoryCoverage, replaceCoverageForEstado } from '../services/territoryCoverage.js';
import { logActivity } from '../services/activity.js';

export const catalogsRouter = Router();
catalogsRouter.use(authMiddleware);

const requireView = requireModuleAction('catalogos', 'ver');
const requireAdd = requireModuleAction('catalogos', 'agregar');
const requireEdit = requireModuleAction('catalogos', 'editar');
const requireDelete = requireModuleAction('catalogos', 'eliminar');

function sendErr(res, err) {
  const status = err.status || 500;
  res.status(status).json({ ok: false, error: err.message || 'Error' });
}

catalogsRouter.get('/grades-empleos', requireView, async (req, res) => {
  try {
    const [grades, empleos, servicios, jerarquias] = await Promise.all([
      listGrades(req.user.orgId),
      listEmpleos(req.user.orgId),
      listServicios(req.user.orgId),
      listJerarquias(req.user.orgId),
    ]);
    res.json({ ok: true, grades, empleos, servicios, jerarquias });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.get('/servicios', requireView, async (req, res) => {
  try {
    const servicios = await listServicios(req.user.orgId);
    res.json({ ok: true, servicios });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.post('/servicios', requireAdd, async (req, res) => {
  try {
    const row = await createServicio(req.user.orgId, req.body || {});
    res.status(201).json({ ok: true, servicio: row });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.patch('/servicios/:id', requireEdit, async (req, res) => {
  try {
    const row = await renameServicio(req.user.orgId, req.params.id, req.body || {});
    res.json({ ok: true, servicio: row });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.delete('/servicios/:id', requireDelete, async (req, res) => {
  try {
    await deleteServicio(req.user.orgId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.get('/jerarquias', requireView, async (req, res) => {
  try {
    const jerarquias = await listJerarquias(req.user.orgId);
    res.json({ ok: true, jerarquias });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.post('/jerarquias', requireAdd, async (req, res) => {
  try {
    const row = await createJerarquia(req.user.orgId, req.body || {});
    res.status(201).json({ ok: true, jerarquia: row });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.put('/jerarquias/reorder', requireEdit, async (req, res) => {
  try {
    const jerarquias = await reorderJerarquias(req.user.orgId, req.body?.ids);
    res.json({ ok: true, jerarquias });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.patch('/jerarquias/:id', requireEdit, async (req, res) => {
  try {
    const row = await renameJerarquia(req.user.orgId, req.params.id, req.body || {});
    res.json({ ok: true, jerarquia: row });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.delete('/jerarquias/:id', requireDelete, async (req, res) => {
  try {
    await deleteJerarquia(req.user.orgId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.post('/grades', requireAdd, async (req, res) => {
  try {
    const row = await createGrade(req.user.orgId, req.body || {});
    res.status(201).json({ ok: true, grade: row });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.post('/grades/reorder', requireEdit, async (req, res) => {
  try {
    const grades = await reorderGrades(req.user.orgId, req.body?.ids);
    res.json({ ok: true, grades });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.patch('/grades/:id', requireEdit, async (req, res) => {
  try {
    const row = await renameGrade(req.user.orgId, req.params.id, req.body || {});
    res.json({ ok: true, grade: row });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.delete('/grades/:id', requireDelete, async (req, res) => {
  try {
    await deleteGrade(req.user.orgId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.post('/empleos', requireAdd, async (req, res) => {
  try {
    const row = await createEmpleo(req.user.orgId, req.body || {});
    res.status(201).json({ ok: true, empleo: row });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.patch('/empleos/:id', requireEdit, async (req, res) => {
  try {
    const row = await renameEmpleo(req.user.orgId, req.params.id, req.body || {});
    res.json({ ok: true, empleo: row });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.delete('/empleos/:id', requireDelete, async (req, res) => {
  try {
    await deleteEmpleo(req.user.orgId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.get('/territorio', requireView, async (req, res) => {
  try {
    const data = await listTerritoryCoverage(req.user.orgId);
    res.json({ ok: true, ...data });
  } catch (err) {
    sendErr(res, err);
  }
});

catalogsRouter.put('/territorio', requireEdit, async (req, res) => {
  try {
    const data = await replaceCoverageForEstado(req.user.orgId, req.body || {});
    await logActivity({
      organizationId: req.user.orgId,
      actorId: req.user.id,
      action: 'territory_coverage_replace',
      entityType: 'cat_territory_coverage',
      meta: {
        unidadName: req.body?.unidadName,
        estado: req.body?.estado,
        municipios: Array.isArray(req.body?.municipios) ? req.body.municipios.length : 0,
      },
    });
    res.json({ ok: true, ...data });
  } catch (err) {
    sendErr(res, err);
  }
});
