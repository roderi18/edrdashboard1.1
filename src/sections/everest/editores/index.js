import { EditorProximaActividad } from './editor-proxima-actividad';
import { EditorLema, EditorBienvenida, EditorDestacamentoDestacado } from './editores-simples';
import {
  EditorHistorias,
  EditorComunicados,
  EditorAccesosRapidos,
  EditorProximosEventos,
} from './editores-de-listas';

// ----------------------------------------------------------------------
// QUE EDITOR LLEVA CADA BLOQUE.
//
// Un bloque sin editor aqui se ve en el Designer con su vista previa, pero no se
// puede cambiar. Hoy son dos, a proposito y a la espera de una decision:
//
//   - "Mi progreso": si es de verdad el progreso de cada miembro, tiene que salir
//     del Sistema de Ascenso, no escribirse a mano para todos.
//   - "Encabezado de la tienda": tiene su propio editor visual, en la tienda.
// ----------------------------------------------------------------------

export const EDITORES_DE_BLOQUE = Object.freeze({
  bienvenida: EditorBienvenida,
  'proxima-actividad': EditorProximaActividad,
  comunicados: EditorComunicados,
  'proximos-eventos': EditorProximosEventos,
  'destacamento-destacado': EditorDestacamentoDestacado,
  lema: EditorLema,
  'accesos-rapidos': EditorAccesosRapidos,
  historias: EditorHistorias,
});
