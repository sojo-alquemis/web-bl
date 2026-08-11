/* ============================================================
   excel-catalogo.js — Import / Export de productos vía Excel
   ┌───────────────────────────────────────────────────────────┐
   │  REGLAS DE IMPORTACIÓN (una por celda, no por fila):      │
   │    • Celda VACÍA        → no se toca ese campo en la DB   │
   │    • Celda "delete" o   → el campo se vacía (NULL)        │
   │      "borrar"                                              │
   │    • Cualquier otro valor → el campo se actualiza con ese  │
   │      valor                                                  │
   │                                                             │
   │  El "codigo" identifica el producto. Si no existe en la    │
   │  DB, se crea uno nuevo (requiere codigo, slug y nombre_es   │
   │  no vacíos). Para dar de baja un producto del sitio se usa  │
   │  la columna "activo" (FALSE) — no hay borrado de fila       │
   │  completa vía Excel.                                        │
   │                                                             │
   │  Reconoce tanto "Plantilla-Productos-ACS-BioLand.xlsx"      │
   │  (encabezados decorados, con *, saltos de línea, emojis)    │
   │  como el archivo generado por "Exportar" de este mismo      │
   │  admin — busca la fila cuya primera celda normalice a       │
   │  "codigo" y usa esa como fila de encabezados.               │
   └───────────────────────────────────────────────────────────┘
   Requiere SheetJS (window.XLSX) cargado en la página vía CDN.
   ============================================================ */

const DELETE_SENTINELS = new Set(['delete', 'borrar']);
const CATEGORIAS_VALIDAS = new Set(['capilar', 'facial', 'corporal']);

// Encabezado normalizado (primera línea, sin *, minúsculas, trim) → campo interno.
// '__ignore' = columna reconocida pero que no se guarda en esta DB.
const HEADER_ALIASES = {
  'codigo':            'codigo',
  'slug':               'slug',
  'ean_upc':            'ean_upc',
  'ean13 / upc':        'ean_upc',
  'dun_14':             'dun14',
  'dun14':              'dun14',
  'nombre_interno':     'nombre_interno',
  'nombre_es':          'nombre_es',
  'nombre_en':          'nombre_en',
  'tipo_es':            'tipo_es',
  'tipo_en':            'tipo_en',
  'subcategoria_slug':  'categoria_slug',        // capilar | facial | corporal
  'categoria_slug':     '__ignore',              // "Cuidado Personal" vs "Alimentos" — fuera de alcance (solo BioLand)
  'familia_slug':       'familia_slug',
  'ingrediente_slug':   'ingrediente_slug',
  'tamano_ml':          'tamano_ml',
  'unidad':             'unidad',
  'descripcion_es':     'descripcion_es',
  'descripcion_en':     'descripcion_en',
  'modo_empleo_es':     'modo_empleo_es',
  'modo_empleo_en':     'modo_empleo_en',
  'no_contiene_es':     'no_contiene_es',
  'no_contiene_en':     'no_contiene_en',
  'ingredientes_es':    'ingredientes_es',
  'alergenos_es':       'alergenos_es',
  'imagen_url':         'imagen_url',
  'destacado':          'destacado',
  'activo':             'activo',
  'orden':              'orden',
  'notas':              'notas',
};

const NUMBER_FIELDS = new Set(['tamano_ml', 'orden']);
const BOOL_FIELDS   = new Set(['destacado', 'activo']);

function normalizeHeader(raw) {
  if (raw == null) return '';
  return String(raw).split('\n')[0].replace(/\*/g, '').trim().toLowerCase();
}

function isEmptyCell(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

function isDeleteSentinel(v) {
  return DELETE_SENTINELS.has(String(v).trim().toLowerCase());
}

function toBool(v) {
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toUpperCase();
  return s === 'TRUE' || s === '1' || s === 'SI' || s === 'SÍ' || s === 'X';
}

/**
 * Parsea un workbook de SheetJS (ya leído con XLSX.read) a filas normalizadas.
 * @param {object} workbook           resultado de XLSX.read()
 * @param {Map<string,string>} familiaMap     slug → id (o slug si no hay id, ej. mock)
 * @param {Map<string,string>} ingredienteMap  slug → id (o slug si no hay id, ej. mock)
 * @returns {{ rows: Array, errors: Array<{row:number|null, codigo?:string, message:string}> }}
 */
export function parseProductosWorkbook(workbook, familiaMap, ingredienteMap) {
  const sheetName = workbook.SheetNames.find(n => /producto/i.test(n)) || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { rows: [], errors: [{ row: null, message: 'El archivo no tiene ninguna hoja legible.' }] };

  const grid = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', blankrows: false, raw: true });

  const headerRowIdx = grid.findIndex(row => normalizeHeader(row[0]) === 'codigo');
  if (headerRowIdx === -1) {
    return { rows: [], errors: [{ row: null, message: 'No se encontró la fila de encabezados (se busca una columna "codigo").' }] };
  }
  const headerRow = grid[headerRowIdx];
  const colMap = headerRow.map(h => HEADER_ALIASES[normalizeHeader(h)] || null);

  const rows = [];
  const errors = [];

  for (let i = headerRowIdx + 1; i < grid.length; i++) {
    const raw = grid[i];
    if (!raw || raw.every(isEmptyCell)) continue;
    const rowNumber = i + 1;

    const codigoIdx = colMap.indexOf('codigo');
    const codigo = codigoIdx >= 0 ? String(raw[codigoIdx] ?? '').trim() : '';
    if (!codigo) {
      errors.push({ row: rowNumber, message: 'Fila sin código — se omite.' });
      continue;
    }

    const fields = {};
    const rowErrors = [];

    colMap.forEach((key, idx) => {
      if (!key || key === 'codigo' || key === '__ignore') return;
      const cell = raw[idx];

      if (key === 'slug') {
        // El slug es identidad del producto: nunca se vacía por "delete/borrar",
        // y si viene vacío simplemente no se toca (igual que cualquier otro campo).
        if (!isEmptyCell(cell) && !isDeleteSentinel(cell)) fields.slug = String(cell).trim();
        return;
      }

      if (isEmptyCell(cell)) return;               // no tocar
      if (isDeleteSentinel(cell)) { fields[key] = null; return; }  // vaciar campo

      if (key === 'familia_slug') {
        const slug = String(cell).trim();
        const id = familiaMap.get(slug);
        if (!id) { rowErrors.push(`familia_slug "${slug}" no existe — se ignora ese campo.`); return; }
        fields.familia_id = id;
        return;
      }
      if (key === 'ingrediente_slug') {
        const slug = String(cell).trim();
        const id = ingredienteMap.get(slug);
        if (!id) { rowErrors.push(`ingrediente_slug "${slug}" no existe — se ignora ese campo.`); return; }
        fields.ingrediente_principal_id = id;
        return;
      }
      if (key === 'categoria_slug') {
        const slug = String(cell).trim().toLowerCase();
        if (!CATEGORIAS_VALIDAS.has(slug)) {
          rowErrors.push(`subcategoria_slug "${slug}" inválida (debe ser capilar, facial o corporal) — se ignora.`);
          return;
        }
        fields.categoria_slug = slug;
        return;
      }
      if (NUMBER_FIELDS.has(key)) {
        const n = Number(cell);
        if (Number.isNaN(n)) { rowErrors.push(`"${key}" no es un número válido ("${cell}") — se ignora.`); return; }
        fields[key] = n;
        return;
      }
      if (BOOL_FIELDS.has(key)) {
        fields[key] = toBool(cell);
        return;
      }
      fields[key] = String(cell).trim();
    });

    rows.push({ rowNumber, codigo, fields, errors: rowErrors });
    if (rowErrors.length) errors.push({ row: rowNumber, codigo, message: rowErrors.join(' ') });
  }

  return { rows, errors };
}

// Orden y encabezados del archivo exportado (compatible con el importador).
const EXPORT_COLUMNS = [
  ['codigo',           'codigo'],
  ['slug',              'slug'],
  ['ean_upc',           'ean_upc'],
  ['dun14',             'dun_14'],
  ['nombre_interno',    'nombre_interno'],
  ['nombre_es',         'nombre_es'],
  ['nombre_en',         'nombre_en'],
  ['tipo_es',           'tipo_es'],
  ['tipo_en',           'tipo_en'],
  ['categoria_slug',    'subcategoria_slug'],
  ['familia_slug',      'familia_slug'],
  ['ingrediente_slug',  'ingrediente_slug'],
  ['tamano_ml',         'tamano_ml'],
  ['unidad',            'unidad'],
  ['descripcion_es',    'descripcion_es'],
  ['descripcion_en',    'descripcion_en'],
  ['modo_empleo_es',    'modo_empleo_es'],
  ['modo_empleo_en',    'modo_empleo_en'],
  ['no_contiene_es',    'no_contiene_es'],
  ['no_contiene_en',    'no_contiene_en'],
  ['ingredientes_es',   'ingredientes_es'],
  ['alergenos_es',      'alergenos_es'],
  ['imagen_url',        'imagen_url'],
  ['destacado',         'destacado'],
  ['activo',            'activo'],
  ['orden',             'orden'],
  ['notas',             'notas'],
];

/**
 * Construye un workbook de SheetJS a partir de productos ya normalizados
 * (la forma que devuelve getProductos()/db.js).
 */
export function buildProductosWorkbook(productos) {
  const header = EXPORT_COLUMNS.map(([, label]) => label);
  const rows = productos.map(p => EXPORT_COLUMNS.map(([key]) => {
    switch (key) {
      case 'categoria_slug':   return p.categoria?.slug ?? '';
      case 'familia_slug':     return p.familia?.slug ?? '';
      case 'ingrediente_slug': return p.ingrediente_principal?.slug ?? '';
      case 'destacado':
      case 'activo':           return p[key] ? 'TRUE' : 'FALSE';
      default:                 return p[key] ?? '';
    }
  }));

  const aoa = [header, ...rows];
  const sheet = window.XLSX.utils.aoa_to_sheet(aoa);
  sheet['!cols'] = EXPORT_COLUMNS.map(() => ({ wch: 20 }));

  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, sheet, 'Productos');
  return wb;
}
