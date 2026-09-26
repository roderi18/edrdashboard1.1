export const MIN_ZOOM = 0.7;
export const MAX_ZOOM = 8;
export const VISTA_INICIAL = { zoom: 1, x: 0, y: 0 };

// Mantiene el punto bajo el cursor o entre los dedos mientras cambia la escala.
export function acercarEnPunto(vista, escala, origen, destino = origen) {
  const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, escala));
  return {
    zoom,
    x: destino.x - ((origen.x - vista.x) / vista.zoom) * zoom,
    y: destino.y - ((origen.y - vista.y) / vista.zoom) * zoom,
  };
}

export function medirDedos(puntos) {
  const [primero, segundo] = puntos;
  return {
    centro: segundo ? { x: (primero.x + segundo.x) / 2, y: (primero.y + segundo.y) / 2 } : primero,
    distancia: segundo ? Math.hypot(segundo.x - primero.x, segundo.y - primero.y) : 0,
  };
}
