import { EditorProximaActividad } from './editor-proxima-actividad';
import {
  EditorLema,
  EditorMiProgreso,
  EditorBienvenida,
  EditorDestacamentoDestacado,
} from './editores-simples';
import {
  EditorHistorias,
  EditorComunicados,
  EditorAccesosRapidos,
  EditorProximosEventos,
} from './editores-de-listas';

// ----------------------------------------------------------------------
// QUE EDITOR LLEVA CADA BLOQUE.
//
// Todos los bloques de la portada tienen editor de contenido. El unico sin el es
// el "Encabezado de la tienda", que tiene su propio editor visual en la tienda.
//
// "Mi progreso" y las cifras de la bienvenida se escriben a mano y son los mismos
// para todos: sus editores lo avisan. Cuando salgan del Sistema de Ascenso, sus
// editores se quitan de aqui.
// ----------------------------------------------------------------------

export const EDITORES_DE_BLOQUE = Object.freeze({
  bienvenida: EditorBienvenida,
  'proxima-actividad': EditorProximaActividad,
  'mi-progreso': EditorMiProgreso,
  comunicados: EditorComunicados,
  'proximos-eventos': EditorProximosEventos,
  'destacamento-destacado': EditorDestacamentoDestacado,
  lema: EditorLema,
  'accesos-rapidos': EditorAccesosRapidos,
  historias: EditorHistorias,
});
