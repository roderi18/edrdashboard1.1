#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

import parser from '@babel/parser';
import traverseModule from '@babel/traverse';

const traverse = traverseModule.default;
const ROOT = path.resolve(process.argv[2] || 'src');
const OUTPUT = path.resolve(process.argv[3] || 'docs/copy-audit/user-facing-copy.json');
const EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const SKIP_PARTS = new Set(['node_modules', '.next', '_examples', '_mock', 'data', 'assets']);
const USER_PROPS = new Set([
  'label',
  'title',
  'placeholder',
  'helperText',
  'aria-label',
  'caption',
  'description',
  'message',
  'text',
  'tooltip',
  'emptyContent',
  'searchPlaceholder',
  'loadingText',
  'buttonText',
  'confirmButtonText',
  'cancelButtonText',
  'noOptionsText',
  'errorMessage',
  'successMessage',
  'nombre',
]);
const MESSAGE_CALLS = new Set([
  'alert',
  'confirm',
  'enqueueSnackbar',
  'toast.success',
  'toast.error',
  'toast.warning',
  'toast.info',
]);
const SHORT_UI_WORDS = new Set([
  'Aceptar', 'Actualizar', 'Agregar', 'Aplicar', 'Atrás', 'Buscar', 'Cancelar', 'Cerrar',
  'Confirmar', 'Continuar', 'Crear', 'Descargar', 'Editar', 'Eliminar', 'Enviar', 'Entrar',
  'Guardar', 'Importar', 'Iniciar', 'Limpiar', 'Nuevo', 'Reintentar', 'Restaurar', 'Salir',
  'Seleccionar', 'Subir', 'Volver', 'Sí', 'No', 'Siguiente', 'Anterior', 'Ver', 'Compartir',
]);

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP_PARTS.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return EXTENSIONS.has(path.extname(entry.name)) ? [full] : [];
  });

const normalizeText = (value) =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const looksUserFacing = (text) => {
  if (!text || text.length > 500) return false;
  if (SHORT_UI_WORDS.has(text)) return true;
  if (text.length < 3 || !/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(text)) return false;
  if (/^(https?:|\/|\.\/|\.\.\/|src\/|api\/|dashboard\/)/i.test(text)) return false;
  if (/^[\w.-]+\/[\w.+-]+$/.test(text)) return false;
  if (/^[a-z0-9_-]+:[a-z0-9_-]+$/i.test(text)) return false;
  if (/^[a-z][A-Za-z0-9_]*$/.test(text) && !SHORT_UI_WORDS.has(text)) return false;
  if (/^#[0-9a-f]{3,8}$/i.test(text)) return false;
  if (/^\d+(px|rem|em|vh|vw|ms|s|%)$/.test(text)) return false;
  if (/\.(js|jsx|ts|tsx|json|png|jpg|jpeg|svg|webp|pdf|docx)$/i.test(text)) return false;
  if (/^[A-Z0-9_]{3,}$/.test(text)) return false;
  if (/^[\w.-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(text)) return false;
  return /\s|[¿?¡!.,:;()]/.test(text) || SHORT_UI_WORDS.has(text);
};

const memberName = (node) => {
  if (!node) return '';
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'ThisExpression') return 'this';
  if (node.type === 'MemberExpression' || node.type === 'OptionalMemberExpression') {
    return [memberName(node.object), memberName(node.property)].filter(Boolean).join('.');
  }
  return '';
};

const jsxName = (node) => {
  if (!node) return '';
  if (node.type === 'JSXIdentifier') return node.name;
  if (node.type === 'JSXMemberExpression') {
    return `${jsxName(node.object)}.${jsxName(node.property)}`;
  }
  return '';
};

const moduleFor = (relativePath) => {
  const normalized = relativePath.replaceAll('\\', '/').toLowerCase();
  const mappings = [
    ['/auth/', 'Autenticación y acceso'],
    ['/sections/chat/', 'Chat y mensajería'],
    ['/sections/member/', 'Miembros'],
    ['/sections/admin/', 'Administración y permisos'],
    ['/sections/regional/', 'Regiones'],
    ['/sections/sectional/', 'Secciones'],
    ['/sections/dest/', 'Destacamentos'],
    ['/sections/national/', 'Nivel nacional'],
    ['/sections/certificates/', 'Certificados'],
    ['/sections/calendar/', 'Calendario'],
    ['/sections/file-manager/', 'Archivos'],
    ['/sections/mail/', 'Correo'],
    ['/sections/order/', 'Órdenes'],
    ['/sections/product/', 'Productos'],
    ['/sections/checkout/', 'Pagos y checkout'],
    ['/sections/invoice/', 'Facturas'],
    ['/sections/user-account/', 'Cuenta de usuario'],
    ['/sections/user/', 'Usuarios'],
    ['/sections/job/', 'Empleos'],
    ['/sections/tour/', 'Recorridos'],
    ['/sections/kanban/', 'Tareas y tablero'],
    ['/components/', 'Componentes compartidos'],
    ['/layouts/', 'Navegación y estructura'],
    ['/app/api/', 'API y mensajes del servidor'],
    ['/app/', 'Páginas y metadatos'],
    ['/services/', 'Servicios y operaciones'],
    ['/models/', 'Validaciones de datos'],
    ['/utils/', 'Utilidades compartidas'],
  ];
  return mappings.find(([needle]) => normalized.includes(needle))?.[1] || 'Otros módulos';
};

const surfaceFor = ({ context, component = '', property = '', call = '', file = '' }) => {
  const lowered = `${context} ${component} ${property} ${call} ${file}`.toLowerCase();
  if (/toast|snackbar|notification|notificaci/.test(lowered)) return 'Notificación';
  if (/error|throw|response\.json|validation|helpertext|invalid|schema/.test(lowered)) {
    return 'Error o validación';
  }
  if (/placeholder|textfield|input|autocomplete|select/.test(lowered)) return 'Campo o ayuda';
  if (/button|iconbutton|menuitem|tab|aria-label|tooltip/.test(lowered)) return 'Botón o acción';
  if (/dialog|alert|confirm|warning|aviso/.test(lowered)) return 'Aviso o confirmación';
  if (/nav|breadcrumb|menu/.test(lowered)) return 'Navegación';
  if (/metadata|heading|typography|card|empty/.test(lowered)) return 'Título o contenido';
  return 'Texto general';
};

const priorityFor = (text, surface, moduleName) => {
  if (/contraseña|token|permiso|autoriz|eliminar|médic|pago|factura|seguridad|sesión expir/i.test(text)) {
    return 'Baja: conservar claridad';
  }
  if (moduleName === 'Autenticación y acceso' || /vacío|sin resultados|bienven|éxito|completado/i.test(text)) {
    return 'Alta';
  }
  if (surface === 'Notificación' || surface === 'Título o contenido') return 'Alta';
  return 'Media';
};

const findings = [];
const addFinding = ({ text, file, line, context, component = '', property = '', call = '' }) => {
  const normalized = normalizeText(text);
  if (!looksUserFacing(normalized)) return;
  const relative = path.relative(process.cwd(), file);
  const moduleName = moduleFor(relative);
  const surface = surfaceFor({ context, component, property, call, file: relative });
  findings.push({
    text: normalized,
    module: moduleName,
    surface,
    priority: priorityFor(normalized, surface, moduleName),
    source: relative.replaceAll('\\', '/'),
    line: Number(line) || 1,
    context,
  });
};

for (const file of walk(ROOT)) {
  let ast;
  const source = fs.readFileSync(file, 'utf8');
  try {
    ast = parser.parse(source, {
      sourceType: 'unambiguous',
      errorRecovery: true,
      plugins: ['jsx', 'typescript', 'decorators-legacy', 'classProperties', 'optionalChaining'],
    });
  } catch {
    continue;
  }

  traverse(ast, {
    JSXText(nodePath) {
      const component = jsxName(nodePath.parentPath?.node?.openingElement?.name);
      addFinding({
        text: nodePath.node.value,
        file,
        line: nodePath.node.loc?.start.line,
        context: 'JSXText',
        component,
      });
    },
    StringLiteral(nodePath) {
      const parent = nodePath.parentPath?.node;
      if (!parent) return;
      if (['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(parent.type)) {
        return;
      }

      if (parent.type === 'JSXAttribute') {
        const property = jsxName(parent.name);
        if (!USER_PROPS.has(property)) return;
        const component = jsxName(nodePath.parentPath?.parentPath?.node?.name);
        addFinding({
          text: nodePath.node.value,
          file,
          line: nodePath.node.loc?.start.line,
          context: 'JSXAttribute',
          component,
          property,
        });
        return;
      }

      if (parent.type === 'CallExpression' || parent.type === 'NewExpression') {
        const call = memberName(parent.callee);
        if (
          MESSAGE_CALLS.has(call) ||
          /Error$/.test(call) ||
          /^(toast|console)\./.test(call) ||
          /snackbar|notify|message|response\.json/i.test(call)
        ) {
          addFinding({
            text: nodePath.node.value,
            file,
            line: nodePath.node.loc?.start.line,
            context: parent.type,
            call,
          });
        }
        return;
      }

      if (parent.type === 'ObjectProperty' || parent.type === 'ObjectMethod') {
        const property = memberName(parent.key) || parent.key?.value || '';
        if (!USER_PROPS.has(property)) return;
        addFinding({
          text: nodePath.node.value,
          file,
          line: nodePath.node.loc?.start.line,
          context: 'ObjectProperty',
          property,
        });
        return;
      }

      if (parent.type === 'VariableDeclarator') {
        const variable = memberName(parent.id);
        if (!/message|label|title|text|description|placeholder|caption|notice|warning|error/i.test(variable)) {
          return;
        }
        addFinding({
          text: nodePath.node.value,
          file,
          line: nodePath.node.loc?.start.line,
          context: 'VariableDeclarator',
          property: variable,
        });
      }
    },
    TemplateLiteral(nodePath) {
      const parent = nodePath.parentPath?.node;
      const call =
        parent?.type === 'CallExpression' || parent?.type === 'NewExpression'
          ? memberName(parent.callee)
          : '';
      const property =
        parent?.type === 'ObjectProperty' ? memberName(parent.key) || parent.key?.value || '' : '';
      const isRelevant =
        MESSAGE_CALLS.has(call) ||
        /Error$/.test(call) ||
        /^(toast|console)\./.test(call) ||
        USER_PROPS.has(property) ||
        nodePath.findParent((item) => item.isJSXExpressionContainer());
      if (!isRelevant) return;
      const text = nodePath.node.quasis
        .map((quasi, index) => `${quasi.value.cooked || ''}${index < nodePath.node.expressions.length ? '{…}' : ''}`)
        .join('');
      addFinding({
        text,
        file,
        line: nodePath.node.loc?.start.line,
        context: 'TemplateLiteral',
        call,
        property,
      });
    },
  });
}

const deduplicated = new Map();
for (const finding of findings) {
  const key = `${finding.module}\u0000${finding.surface}\u0000${finding.text.toLocaleLowerCase('es')}`;
  const existing = deduplicated.get(key);
  if (!existing) {
    deduplicated.set(key, { ...finding, sources: [`${finding.source}:${finding.line}`] });
  } else if (existing.sources.length < 8) {
    const source = `${finding.source}:${finding.line}`;
    if (!existing.sources.includes(source)) existing.sources.push(source);
  }
}

const items = [...deduplicated.values()]
  .map(({ source, line, ...item }) => item)
  .sort((a, b) =>
    a.module.localeCompare(b.module, 'es') ||
    a.surface.localeCompare(b.surface, 'es') ||
    a.text.localeCompare(b.text, 'es')
  );
const summary = {
  generatedAt: new Date().toISOString(),
  scannedRoot: path.relative(process.cwd(), ROOT).replaceAll('\\', '/'),
  sourceFiles: walk(ROOT).length,
  uniqueTexts: items.length,
  byModule: Object.fromEntries(
    [...new Set(items.map((item) => item.module))]
      .map((moduleName) => [moduleName, items.filter((item) => item.module === moduleName).length])
      .sort((a, b) => b[1] - a[1])
  ),
  bySurface: Object.fromEntries(
    [...new Set(items.map((item) => item.surface))]
      .map((surface) => [surface, items.filter((item) => item.surface === surface).length])
      .sort((a, b) => b[1] - a[1])
  ),
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, `${JSON.stringify({ summary, items }, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(summary, null, 2));
