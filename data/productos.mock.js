/* ============================================================
   productos.mock.js — Mock data realista para desarrollo
   Solo para Fase 4 antes de conectar Supabase.
   Se retira al conectar la DB.

   CONVENCIONES (deben coincidir con el schema SQL):
   - tamano_ml  (no "ml")
   - imagen_url (no "imagen")
   - ingrediente_principal.color_texto = color de texto del badge (contraste)
     ↳ viene de familias_ingrediente.color_texto en la DB real

   NOTA: el color de Coco en el badge (#FBB500) difiere del color
   canónico de su familia 'fruta' (#EF9F27). Verificar en el sitio
   real cuál es el correcto antes de hacer el seed.
   ============================================================ */

export const MOCK_PRODUCTOS = [
  {
    codigo: 'PP088936',
    slug: 'gel-aloe-vera',
    nombre_es: 'Gel Aloe Vera',
    tipo_es: 'Gel',
    tamano_ml: 250,
    categoria: 'capilar',
    familia_slug: 'aloe-vera',
    familia_nombre_es: 'Aloe Vera',
    ingrediente_principal: { abreviatura: 'Av', nombre_es: 'Aloe Vera', color: '#4FAC27', color_texto: '#173404' },
    descripcion_es: 'Nuestro Gel de Aloe Vera está formulado con la esencia pura de la planta, brindando hidratación profunda y nutrición para tu cabello.',
    no_contiene_es: 'Parabenos\nSulfatos\nSiliconas\nColorantes artificiales',
    ingredientes_es: 'Aloe Barbadensis Leaf Juice, Aqua, Glycerin, Carbomer, Triethanolamine, Panthenol, Allantoin.',
    ean_upc: '7501234567890',
    imagen_url: 'PP088936.webp',
    destacado: true,
    activo: true,
    orden: 1,
  },
  {
    codigo: 'PP088941',
    slug: 'agua-micelar-vitamin-c',
    nombre_es: 'Agua Micelar Vitamin C',
    tipo_es: 'Limpieza Facial',
    tamano_ml: 310,
    categoria: 'facial',
    familia_slug: 'vitamin-c',
    familia_nombre_es: 'Vitamin C',
    ingrediente_principal: { abreviatura: 'Vc', nombre_es: 'Vitamin C', color: '#EF9F27', color_texto: '#412402' },
    descripcion_es: 'Agua micelar con Vitamina C para limpiar, tonificar e iluminar la piel en un solo paso.',
    no_contiene_es: 'Parabenos\nAlcohol\nColorantes artificiales',
    ingredientes_es: 'Aqua, Glycerin, Ascorbyl Glucoside (Vitamin C), Niacinamide, Phenoxyethanol.',
    ean_upc: '7501234567891',
    imagen_url: 'PP088941.webp',
    destacado: true,
    activo: true,
    orden: 2,
  },
  {
    codigo: 'PT088012',
    slug: 'infusion-de-romero-shampoo',
    nombre_es: 'Infusión de Romero Largo Extremo',
    tipo_es: 'Shampoo',
    tamano_ml: 400,
    categoria: 'capilar',
    familia_slug: 'infusion-de-romero',
    familia_nombre_es: 'Infusión de Romero',
    ingrediente_principal: { abreviatura: 'Ro', nombre_es: 'Romero', color: '#4FAC27', color_texto: '#173404' },
    descripcion_es: 'Shampoo enriquecido con infusión de romero para fortalecer y estimular el crecimiento capilar.',
    no_contiene_es: 'Sal\nSulfatos\nParabenos\nColorantes artificiales',
    ingredientes_es: 'Aqua, Sodium Laureth Sulfate, Cocamidopropyl Betaine, Rosmarinus Officinalis Leaf Extract.',
    ean_upc: '7501234567892',
    imagen_url: 'PT088012.webp',
    destacado: false,
    activo: true,
    orden: 3,
  },
  {
    codigo: 'PP088950',
    slug: 'aceite-de-coco-brillo-intenso',
    nombre_es: 'Aceite de Coco Brillo Intenso',
    tipo_es: 'Acondicionador',
    tamano_ml: 180,
    categoria: 'capilar',
    familia_slug: 'aceite-de-coco',
    familia_nombre_es: 'Aceite de Coco',
    ingrediente_principal: { abreviatura: 'Co', nombre_es: 'Coco', color: '#FBB500', color_texto: '#fff' },
    descripcion_es: 'Aporta brillo intenso desde el primer uso, aumentando el nivel de hidratación del cabello.',
    no_contiene_es: 'Sal\nSulfatos\nParabenos\nColorantes artificiales\nDerivados de origen animal\nAceite Mineral',
    ingredientes_es: 'Aqua, Cetearyl Alcohol, Cocos Nucifera (Coconut) Oil, Behentrimonium Chloride, Glycerin, Panthenol.',
    ean_upc: '7501234567893',
    imagen_url: 'PP088950.webp',
    destacado: true,
    activo: true,
    orden: 4,
  },
];

export const MOCK_FAMILIAS = [
  { slug: 'aceite-de-coco',        nombre_es: 'Aceite de Coco',        categoria: 'capilar', orden: 1, activo: true },
  { slug: 'aceite-de-keratina',    nombre_es: 'Aceite de Keratina',    categoria: 'capilar', orden: 2, activo: true },
  { slug: 'aloe-vera',             nombre_es: 'Aloe Vera',             categoria: 'capilar', orden: 3, activo: true },
  { slug: 'argan',                 nombre_es: 'Argán',                 categoria: 'capilar', orden: 4, activo: true },
  { slug: 'bio-colageno',          nombre_es: 'Bio Colágeno',          categoria: 'capilar', orden: 5, activo: true },
  { slug: 'coco',                  nombre_es: 'Coco',                  categoria: 'capilar', orden: 6, activo: true },
  { slug: 'infusion-de-romero',    nombre_es: 'Infusión de Romero',    categoria: 'capilar', orden: 7, activo: true },
  { slug: 'leche-de-coco',         nombre_es: 'Leche de Coco',         categoria: 'capilar', orden: 8, activo: true },
  { slug: 'linaza',                nombre_es: 'Linaza',                categoria: 'capilar', orden: 9, activo: true },
  { slug: 'manzanilla',            nombre_es: 'Manzanilla',            categoria: 'capilar', orden: 10, activo: true },
  { slug: 'ortiga',                nombre_es: 'Ortiga',                categoria: 'capilar', orden: 11, activo: true },
  { slug: 'pro-keratina',          nombre_es: 'Pro Keratina',          categoria: 'capilar', orden: 12, activo: true },
  { slug: 'romero',                nombre_es: 'Romero',                categoria: 'capilar', orden: 13, activo: true },
  { slug: 'vitamin-c',             nombre_es: 'Vitamin C',             categoria: 'facial',  orden: 1,  activo: true },
];

export const MOCK_INGREDIENTES = [
  { abreviatura: 'Av', nombre_es: 'Aloe Vera',   familia: 'hoja',    color: '#4FAC27', orden: 1, activo: true },
  { abreviatura: 'Ro', nombre_es: 'Romero',       familia: 'hoja',    color: '#4FAC27', orden: 2, activo: true },
  { abreviatura: 'Or', nombre_es: 'Ortiga',       familia: 'hoja',    color: '#4FAC27', orden: 3, activo: true },
  { abreviatura: 'Vc', nombre_es: 'Vitamin C',    familia: 'fruta',   color: '#EF9F27', orden: 1, activo: true },
  { abreviatura: 'Co', nombre_es: 'Coco',         familia: 'fruta',   color: '#EF9F27', orden: 2, activo: true },
  { abreviatura: 'Sp', nombre_es: 'Spirulina',    familia: 'alga',    color: '#00AFCC', orden: 1, activo: true },
  { abreviatura: 'Ag', nombre_es: 'Argán',        familia: 'semilla', color: '#C47A2B', orden: 1, activo: true },
  { abreviatura: 'Jj', nombre_es: 'Jojoba',       familia: 'semilla', color: '#C47A2B', orden: 2, activo: true },
  { abreviatura: 'Ar', nombre_es: 'Arcilla',      familia: 'mineral', color: '#7D83A2', orden: 1, activo: true },
  { abreviatura: 'Mz', nombre_es: 'Manzanilla',   familia: 'flor',    color: '#E07898', orden: 1, activo: true },
  { abreviatura: 'Lv', nombre_es: 'Lavanda',      familia: 'flor',    color: '#E07898', orden: 2, activo: true },
  { abreviatura: 'Li', nombre_es: 'Linaza',       familia: 'grano',   color: '#8B7355', orden: 1, activo: true },
  { abreviatura: 'Qi', nombre_es: 'Quinoa',       familia: 'grano',   color: '#8B7355', orden: 2, activo: true },
];

export const MOCK_FAMILIAS_INGREDIENTE = [
  { slug: 'hoja',    nombre_es: 'Hoja',    abreviatura: 'Ho', color: '#4FAC27', orden: 1, activo: true },
  { slug: 'fruta',   nombre_es: 'Fruta',   abreviatura: 'Fr', color: '#EF9F27', orden: 2, activo: true },
  { slug: 'alga',    nombre_es: 'Alga',    abreviatura: 'Al', color: '#00AFCC', orden: 3, activo: true },
  { slug: 'semilla', nombre_es: 'Semilla', abreviatura: 'Se', color: '#C47A2B', orden: 4, activo: true },
  { slug: 'mineral', nombre_es: 'Mineral', abreviatura: 'Mi', color: '#7D83A2', orden: 5, activo: true },
  { slug: 'flor',    nombre_es: 'Flor',    abreviatura: 'Fl', color: '#E07898', orden: 6, activo: true },
  { slug: 'grano',   nombre_es: 'Grano',   abreviatura: 'Gr', color: '#8B7355', orden: 7, activo: true },
];

export const MOCK_CATEGORIAS = [
  { slug: 'capilar',  nombre_es: 'Cuidado Capilar',  nombre_en: 'Hair Care',   imagen_url: null, orden: 1, activo: true },
  { slug: 'facial',   nombre_es: 'Cuidado Facial',   nombre_en: 'Facial Care', imagen_url: null, orden: 2, activo: true },
  { slug: 'corporal', nombre_es: 'Cuidado Corporal', nombre_en: 'Body Care',   imagen_url: null, orden: 3, activo: true },
];

// Banners del carrusel del home (orden = posición en el slider)
export const MOCK_BANNERS = [
  {
    id: 'b1',
    imagen_desktop_url: 'assets/img/banner-01-desktop.jpeg',
    imagen_mobile_url:  'assets/img/banner-01-mobile.jpeg',
    titulo_es:  'Infusión de Romero',
    enlace_url: 'pages/catalogo.html?cat=capilar',
    orden: 1, activo: true,
  },
  {
    id: 'b2',
    imagen_desktop_url: 'assets/img/banner-02-desktop.jpeg',
    imagen_mobile_url:  'assets/img/banner-02-mobile.jpeg',
    titulo_es:  'Concentrado Argán',
    enlace_url: 'pages/producto.html?slug=concentrado-argan-humectacion',
    orden: 2, activo: true,
  },
  {
    id: 'b3',
    imagen_desktop_url: 'assets/img/banner-03-desktop.jpeg',
    imagen_mobile_url:  'assets/img/banner-03-mobile.jpeg',
    titulo_es:  'Gel Aloe Vera',
    enlace_url: 'pages/producto.html?slug=gel-aloe-vera',
    orden: 3, activo: true,
  },
];
