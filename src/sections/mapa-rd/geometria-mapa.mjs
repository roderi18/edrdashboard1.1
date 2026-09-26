// Natural Earth 1:10m, dominio público. Se conserva cada vértice y cada isla.
// Datos y fuentes en los GeoJSON y README de esta carpeta.
export const MAP_WIDTH = 1000;
export const MAP_HEIGHT = 620;

function mercator([longitud, latitud]) {
  const radianes = Math.PI / 180;
  return [longitud * radianes, -Math.log(Math.tan(Math.PI / 4 + (latitud * radianes) / 2))];
}

function poligonosDe(geometry) {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
}

export function crearProyeccion(referencia) {
  const puntos = poligonosDe(referencia).flat(2).map(mercator);
  const minX = Math.min(...puntos.map(([x]) => x));
  const maxX = Math.max(...puntos.map(([x]) => x));
  const minY = Math.min(...puntos.map(([, y]) => y));
  const maxY = Math.max(...puntos.map(([, y]) => y));
  // País, provincias y nombres comparten escala para no desplazarse entre sí.
  const escala = Math.min((MAP_WIDTH - 64) / (maxX - minX), (MAP_HEIGHT - 64) / (maxY - minY));
  const offsetX = (MAP_WIDTH - (maxX - minX) * escala) / 2;
  const offsetY = (MAP_HEIGHT - (maxY - minY) * escala) / 2;
  return (coordenadas) => {
    const [x, y] = mercator(coordenadas);
    return { x: (x - minX) * escala + offsetX, y: (y - minY) * escala + offsetY };
  };
}

export function crearContorno(geometry, referencia = geometry) {
  const proyectar = crearProyeccion(referencia);
  return poligonosDe(geometry)
    .flatMap((poligono) =>
      poligono.map(
        (anillo) =>
          `${anillo
            .map((coordenadas, indice) => {
              const { x, y } = proyectar(coordenadas);
              return `${indice ? 'L' : 'M'}${x.toFixed(3)},${y.toFixed(3)}`;
            })
            .join(' ')} Z`
      )
    )
    .join(' ');
}
