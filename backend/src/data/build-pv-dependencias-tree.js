import fs from 'fs';

const tree = JSON.parse(
  fs.readFileSync(new URL('./pvDependencias.snapshot.json', import.meta.url), 'utf8')
);

function zoneType(n) {
  if (/C\.G\./i.test(n)) return 'cg';
  if (/Z\.A\.M\.|Z\.M\./i.test(n)) return 'zm';
  return 'support';
}

function code(prefix, id) {
  return `PV-${prefix}-${id}`;
}

const out = {
  source: 'ParqueVehicular cat_regiones/cat_zonas/cat_organismos',
  exportedAt: new Date().toISOString(),
  regions: tree.map((r, ri) => ({
    externalId: r.id,
    name: r.nombre,
    code: code('R', r.id),
    sortOrder: (ri + 1) * 10,
    zones: (r.zonas || []).map((z, zi) => ({
      externalId: 100000 + z.id,
      name: z.nombre,
      code: code('Z', z.id),
      zoneType: zoneType(z.nombre),
      sortOrder: (zi + 1) * 10,
      organisms: (z.organismos || []).map((o, oi) => ({
        externalId: 200000 + o.id,
        name: o.nombre,
        code: code('O', o.id),
        sortOrder: (oi + 1) * 10,
      })),
    })),
  })),
};

const header = '/** Árbol Dependencias idéntico a ParqueVehicular (live DB). */\nexport const PV_DEPENDENCIAS = ';
fs.writeFileSync(new URL('./pvDependenciasTree.js', import.meta.url), `${header}${JSON.stringify(out, null, 2)};\n`);
console.log(out.regions[0].zones.slice(0, 4).map((z) => `${z.name}=${z.zoneType}`).join(' | '));
