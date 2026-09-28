"use client";

import dayjs from "dayjs";
import { useRef, useState, useEffect, useCallback } from "react";

// ----------------------------------------------------------------------
// LO ESCRITO SOBREVIVE A RECARGAR LA PÁGINA.
//
// Antes, un F5, cerrar la pestaña sin querer o que el celular recargara la
// página al volver de otra aplicación (pasa mucho en Android con poca memoria)
// borraba todo el formulario, y había que empezar de cero.
//
// El borrador del dashboard (`use-form-draft`) aquí no sirve: exige el uid de
// quien edita y esta página no tiene sesión, así que nunca guardaba nada.
//
// - Los valores y el paso van a `localStorage`; el logo, que es un archivo, a
//   IndexedDB (no cabe en `localStorage`).
// - Se restaura SOLO al abrir: aquí no hay datos del servidor que pisar, y quien
//   recarga quiere seguir donde estaba.
// - Es de este dispositivo y caduca a los 7 días. Enviar o "Empezar de nuevo" lo
//   borra: la página es pública y el equipo puede ser el de la iglesia.
// - Si el almacenamiento está bloqueado (modo privado) el formulario funciona
//   igual, solo que sin borrador.
// ----------------------------------------------------------------------

const CLAVE = "errd-registro:borrador:v1";
const VIGENCIA_MS = 7 * 24 * 60 * 60 * 1000;
const RETARDO_MS = 400;

// Las horas son objetos dayjs: viajan como "HH:mm" y vuelven a ser dayjs.
const HORAS = ["horaReunion", "horaReunionFin"];
const horaATexto = (v) =>
  v && dayjs(v).isValid() ? dayjs(v).format("HH:mm") : "";
const textoAHora = (t) => {
  const [h, m] = String(t || "").split(":");
  return h && m ? dayjs().hour(Number(h)).minute(Number(m)).second(0) : null;
};

const paraGuardar = (valores) => {
  // El logo va aparte, a IndexedDB.
  const resto = { ...valores };
  delete resto.logo;
  const datos = { ...resto.datos };
  HORAS.forEach((h) => {
    datos[h] = horaATexto(datos[h]);
  });
  return { ...resto, datos, trampa: "" };
};

const paraRestaurar = (guardado, iniciales) => {
  const datos = { ...iniciales.datos, ...guardado.datos };
  HORAS.forEach((h) => {
    datos[h] = textoAHora(datos[h]);
  });
  return {
    ...iniciales,
    ...guardado,
    remitente: { ...iniciales.remitente, ...guardado.remitente },
    destacamento: { ...iniciales.destacamento, ...guardado.destacamento },
    miembro: { ...iniciales.miembro, ...guardado.miembro },
    datos,
    logo: null,
  };
};

// ------------------------------------------------ logo en IndexedDB

const conBase = (accion) =>
  new Promise((resolve) => {
    try {
      const pedido = indexedDB.open("errd-registro", 1);
      pedido.onupgradeneeded = () =>
        pedido.result.createObjectStore("borrador");
      pedido.onerror = () => resolve(null);
      pedido.onsuccess = () => {
        const base = pedido.result;
        try {
          const tienda = base
            .transaction("borrador", "readwrite")
            .objectStore("borrador");
          const op = accion(tienda);
          op.onsuccess = () => resolve(op.result ?? null);
          op.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      };
    } catch {
      resolve(null);
    }
  });

const guardarLogo = (archivo) =>
  conBase((t) =>
    archivo instanceof File
      ? t.put(
          { blob: archivo, nombre: archivo.name, tipo: archivo.type },
          "logo",
        )
      : t.delete("logo"),
  );

const leerLogo = async () => {
  const g = await conBase((t) => t.get("logo"));
  return g?.blob
    ? new File([g.blob], g.nombre || "logo", { type: g.tipo || g.blob.type })
    : null;
};

// ------------------------------------------------ localStorage

const leer = () => {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || "null");
    if (!g?.valores) return null;
    if (Date.now() - Number(g.fecha || 0) > VIGENCIA_MS) {
      localStorage.removeItem(CLAVE);
      return null;
    }
    return g;
  } catch {
    return null;
  }
};

// Un formulario sin tocar no es un borrador: guardarlo haría aparecer el aviso
// de "recuperado" sin nada que recuperar.
const escribir = (valores, paso, iniciales) => {
  try {
    const guardable = paraGuardar(valores);
    if (
      !paso &&
      JSON.stringify(guardable) === JSON.stringify(paraGuardar(iniciales))
    ) {
      localStorage.removeItem(CLAVE);
      return;
    }
    localStorage.setItem(
      CLAVE,
      JSON.stringify({ fecha: Date.now(), paso, valores: guardable }),
    );
  } catch {
    /* cuota llena o bloqueado: el formulario sigue igual */
  }
};

export const borrarBorradorDelRegistro = () => {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada que hacer */
  }
  guardarLogo(null);
};

/**
 * Restaura al abrir y guarda mientras se escribe.
 * Devuelve `restaurado` (true si había algo que recuperar) y `empezarDeNuevo`.
 */
export function useBorradorDelRegistro({ methods, iniciales, paso, setPaso }) {
  const [listo, setListo] = useState(false);
  const [restaurado, setRestaurado] = useState(false);
  const pasoActual = useRef(paso);
  pasoActual.current = paso;

  // Al abrir: lo guardado vuelve al formulario, con su paso y su logo.
  useEffect(() => {
    let vigente = true;
    const g = leer();
    if (!g) {
      setListo(true);
      return undefined;
    }
    methods.reset(paraRestaurar(g.valores, iniciales));
    setPaso(Math.max(0, Number(g.paso) || 0));
    setRestaurado(true);
    leerLogo().then((logo) => {
      if (vigente && logo) methods.setValue("logo", logo);
      if (vigente) setListo(true);
    });
    return () => {
      vigente = false;
    };
    // Solo al montar: releerlo después pisaría lo que se está escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mientras se escribe: con un respiro, y enseguida al salir de la página
  // (el respiro no puede ser lo que haga perder la última tecla).
  useEffect(() => {
    if (!listo) return undefined;
    let temporizador = null;
    let logoAnterior = methods.getValues("logo");
    const guardarYa = () => {
      clearTimeout(temporizador);
      escribir(methods.getValues(), pasoActual.current, iniciales);
    };
    const suscripcion = methods.watch((valores, { name }) => {
      if (name === "logo" || valores.logo !== logoAnterior) {
        logoAnterior = valores.logo;
        guardarLogo(valores.logo);
      }
      clearTimeout(temporizador);
      temporizador = setTimeout(guardarYa, RETARDO_MS);
    });
    const alOcultar = () =>
      document.visibilityState === "hidden" && guardarYa();
    window.addEventListener("pagehide", guardarYa);
    document.addEventListener("visibilitychange", alOcultar);
    return () => {
      clearTimeout(temporizador);
      suscripcion.unsubscribe();
      window.removeEventListener("pagehide", guardarYa);
      document.removeEventListener("visibilitychange", alOcultar);
    };
  }, [listo, methods, iniciales]);

  // Cambiar de paso también se guarda: al recargar se vuelve al mismo.
  useEffect(() => {
    if (listo) escribir(methods.getValues(), paso, iniciales);
  }, [listo, paso, methods, iniciales]);

  const empezarDeNuevo = useCallback(() => {
    borrarBorradorDelRegistro();
    methods.reset(iniciales);
    setPaso(0);
    setRestaurado(false);
  }, [methods, iniciales, setPaso]);

  return { restaurado, empezarDeNuevo };
}
