import { leerDestacamentos } from "src/server/datos.mjs";

export const dynamic = "force-dynamic";

// Todos los destacamentos con lo que ya está registrado (sin teléfonos).
export async function GET() {
  try {
    // Lista pública y sin datos de personas: la CDN la guarda 5 minutos (y la
    // sirve vieja mientras la renueva). Antes cada visita llegaba al servidor.
    return Response.json(await leerDestacamentos(), {
      headers: {
        "Cache-Control":
          "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("[api/destacamentos]", error);
    return Response.json(
      { error: "No se pudieron leer los destacamentos." },
      { status: 502 },
    );
  }
}
