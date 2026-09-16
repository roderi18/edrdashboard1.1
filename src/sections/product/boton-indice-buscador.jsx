import { useState, useEffect, useCallback } from 'react';

import Button from '@mui/material/Button';

import { miniaturaDesdeUrl } from 'src/utils/miniatura-buscador';

import {
  guardarProductoEnIndice,
  obtenerIndiceDeProductos,
} from 'src/services/buscador-indice-service';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// PONER AL DIA LAS CARAS DEL BUSCADOR.
//
// Desde ahora, cada producto que se guarda deja su miniatura en el indice. Los
// que ya estaban publicados no la tienen, y su foto de verdad pesa entre 16 y
// 250 kB: bajarlas al escribir dejaria el buscador en gris.
//
// Este boton las prepara de una vez: baja cada foto, la reduce a 64px en el
// propio navegador y guarda el resultado —unos 2 kB— en el indice. Se hace aqui
// y no en un script porque encoger una imagen necesita un navegador; el servidor
// no sabe leer un webp.
//
// Solo aparece si FALTA alguna, asi que en cuanto esten todas desaparece solo.
// ----------------------------------------------------------------------

export function BotonIndiceBuscador({ productos = [], sx }) {
  const [pendientes, setPendientes] = useState([]);
  const [preparando, setPreparando] = useState(false);
  const [hechos, setHechos] = useState(0);

  useEffect(() => {
    let cancelado = false;

    if (!productos.length) return undefined;

    obtenerIndiceDeProductos()
      .then((indice) => {
        if (cancelado) return;

        setPendientes(
          productos.filter(
            (producto) => producto?.coverUrl && !indice[String(producto.id)]?.miniatura
          )
        );
      })
      .catch(() => {
        // Sin indice no hay nada que ofrecer: el buscador sigue encontrando los
        // productos, solo que sin foto.
      });

    return () => {
      cancelado = true;
    };
  }, [productos]);

  const prepararMiniaturas = useCallback(async () => {
    setPreparando(true);
    setHechos(0);

    const fallidos = [];

    // De una en una, a proposito: son decenas de imagenes y bajarlas todas a la
    // vez deja sin red al resto de la pantalla.
    for (const producto of pendientes) {
      try {
        const miniatura = await miniaturaDesdeUrl(producto.coverUrl);

        if (miniatura) {
          await guardarProductoEnIndice({
            id: producto.id,
            nombre: producto.name || producto.nombre,
            codigo: producto.code || producto.codigo || '',
            categoria: producto.category || producto.categoria || '',
            miniatura,
          });
        }
      } catch {
        fallidos.push(producto.name || producto.id);
      }

      setHechos((actual) => actual + 1);
    }

    setPreparando(false);
    setPendientes(fallidos.length ? pendientes.filter((p) => fallidos.includes(p.name)) : []);

    if (fallidos.length) {
      toast.error(`No se pudieron preparar ${fallidos.length} imágenes. Vuelve a intentarlo.`);
    } else {
      toast.success('El buscador ya tiene las imágenes de la tienda.');
    }
  }, [pendientes]);

  if (!pendientes.length) return null;

  return (
    <Button
      variant="outlined"
      color="inherit"
      loading={preparando}
      onClick={prepararMiniaturas}
      startIcon={<Iconify icon="eva:search-fill" />}
      sx={sx}
    >
      {preparando
        ? `Preparando ${hechos} de ${pendientes.length}...`
        : `Preparar buscador (${pendientes.length})`}
    </Button>
  );
}
