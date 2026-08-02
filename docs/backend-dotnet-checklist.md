# A4 — Checklist de cambios en el backend .NET (API Miembros)

Este es el lado que **realmente** aplica la seguridad por alcance. Mientras no esté,
el reenvío del token (A3) no bloquea nada: `GetAllMiembros` sigue devolviendo todo.

Proyecto Firebase: **`systexploradores`** (de ahí salen emisor y audiencia).

## 1. Validar el ID token de Firebase (JWT Bearer)

Los tokens de Firebase son **JWT RS256** firmados por Google. En ASP.NET Core basta
configurar el esquema OIDC apuntando a Firebase (descarga y cachea las llaves solo):

```csharp
builder.Services
  .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
  .AddJwtBearer(options =>
  {
    options.Authority = "https://securetoken.google.com/systexploradores";
    options.TokenValidationParameters = new TokenValidationParameters
    {
      ValidateIssuer   = true,
      ValidIssuer      = "https://securetoken.google.com/systexploradores",
      ValidateAudience = true,
      ValidAudience    = "systexploradores",
      ValidateLifetime = true,
    };
  });

// ...
app.UseAuthentication();
app.UseAuthorization();
```

- El `Authority` hace que el handler descubra automáticamente el JWKS de Google y
  valide la firma. No hay que manejar llaves a mano.
- Token ausente / inválido / expirado → **401** (protege los endpoints con
  `[Authorize]`).

## 2. Leer los custom claims

El token trae (los setea esta app en A2):

| Claim | Tipo | Ejemplo |
|---|---|---|
| `rol` | string | `"usuario_region"` |
| `alcanceNivel` | string | `"region"` (destacamento/seccion/region/nacional/global) |
| `regiones` | string[] | `["12"]` |
| `secciones` | string[] | `[]` |
| `destacamentos` | string[] | `[]` |
| `soloLectura` | bool | `true` |

Los arrays de Firebase llegan como **claims repetidos** del mismo tipo:

```csharp
var nivel        = User.FindFirst("alcanceNivel")?.Value ?? "";
var soloLectura  = User.FindFirst("soloLectura")?.Value == "true";
var regiones     = User.FindAll("regiones").Select(c => c.Value).ToHashSet();
var secciones    = User.FindAll("secciones").Select(c => c.Value).ToHashSet();
var destacamentos= User.FindAll("destacamentos").Select(c => c.Value).ToHashSet();
```

Sin claims de alcance (usuario sin rol) → **403** (fail-closed).

## 3. Filtrar/autorizar por endpoint

Cada miembro debe poder resolverse a `idRegion`, `idSeccion`, `idDestacamento`. Si
la tabla `Miembros` solo tiene `idDestacamento`, hacer JOIN
Destacamento → Seccion → Region para tener los tres ids.

| Endpoint | Regla |
|---|---|
| `GET GetAllMiembros` | `global`/`nacional`: todos. `region`: `WHERE idRegion IN (@regiones)`. `seccion`: `WHERE idSeccion IN (@secciones)`. `destacamento`: `WHERE idDestacamento IN (@destacamentos)`. |
| `GET GetMiembro(id)` | Cargar y verificar que su id de alcance esté en el set del llamante; si no → **404** (o 403). |
| `POST SetMiembros` | **403** si `soloLectura`, o si el `idDestacamento` destino no cae en el alcance. |
| `POST UpdateMiembros` | **403** si `soloLectura`, o si el miembro no está en alcance. |
| `DELETE DeleteMiembro` | **403** si `soloLectura` o fuera de alcance (o si el rol no elimina). |

Ejemplo de filtro de lectura:

```csharp
IQueryable<Miembro> q = db.Miembros; // con join a Seccion/Region si hace falta
q = nivel switch
{
  "global" or "nacional" => q,
  "region"       => q.Where(m => regiones.Contains(m.IdRegion.ToString())),
  "seccion"      => q.Where(m => secciones.Contains(m.IdSeccion.ToString())),
  "destacamento" => q.Where(m => destacamentos.Contains(m.IdDestacamento.ToString())),
  _              => q.Where(m => false), // fail-closed
};
```

> Los ids se comparan como **string** (así viajan en el claim). Cuida el
> casteo/normalización para que `"12"` calce con `IdRegion = 12`.

## 4. Fail-closed y auditoría

- Sin token → 401. Token válido sin alcance → 403. Fuera de alcance → no aparece
  (listas) o 403/404 (por id). Escritura con `soloLectura` → 403.
- Registrar cada denegación (uid del token + acción + id de miembro) en el log de
  auditoría del .NET.

## 5. (Opcional pero recomendado) estructura

Los cargos de consulta (regionales, área, Consejo Nacional) son **solo lectura**
también sobre regiones/secciones/destacamentos. Si esos endpoints de estructura
permiten escritura, aplicar el mismo `soloLectura`/alcance ahí.

## 6. Dependencia con esta app

- La app ya **envía** el token (A3) y **setea** los claims al asignar rol (A2).
- Para que los usuarios ya existentes tengan claims, se corre una vez el backfill
  (`scripts/permissions/backfill-user-claims.mjs`) — requiere el service account.
- Orden sugerido de activación: (1) backfill de claims, (2) desplegar el .NET con
  validación **en modo log** (no bloquea, solo registra qué filtraría), (3) activar
  el bloqueo real tras confirmar que el filtrado es correcto por rol.
