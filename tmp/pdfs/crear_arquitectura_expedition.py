from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import simpleSplit
from reportlab.lib.pagesizes import landscape, A4


ROOT = Path(r"C:\Users\rdpr1\OneDrive\Escritorio\next-js")
OUT = ROOT / "output" / "pdf" / "Arquitectura_y_Flujos_EXPEDITION.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

FONT = "Arial"
BOLD = "Arial-Bold"
pdfmetrics.registerFont(TTFont(FONT, r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont(BOLD, r"C:\Windows\Fonts\arialbd.ttf"))

W, H = landscape(A4)
NAVY = HexColor("#12233D")
BLUE = HexColor("#1D5E96")
TEAL = HexColor("#087E84")
GREEN = HexColor("#29845B")
ORANGE = HexColor("#BD6B23")
PURPLE = HexColor("#6E55A3")
LIGHT = HexColor("#F3F6FA")
PALE = HexColor("#E8F1F6")
TEXT = HexColor("#243246")
MUTED = HexColor("#58697D")
LINE = HexColor("#B9C8D5")
WHITE = HexColor("#FFFFFF")

c = canvas.Canvas(str(OUT), pagesize=(W, H))
c.setTitle("Arquitectura, módulos y flujos de EXPEDITION")
c.setAuthor("Análisis técnico del proyecto EXPEDITION")
c.setSubject("Conectividad y flujo de módulos verificados en el código local")


def txt(x, y, value, size=9, color=TEXT, bold=False):
    c.setFont(BOLD if bold else FONT, size)
    c.setFillColor(color)
    c.drawString(x, y, value)


def wrapped(x, y, value, width, size=8.4, leading=12, color=TEXT, bold=False, max_lines=None):
    lines = simpleSplit(value, BOLD if bold else FONT, size, width)
    if max_lines:
        lines = lines[:max_lines]
    for line in lines:
        txt(x, y, line, size, color, bold)
        y -= leading
    return y


def page(title, subtitle, number):
    c.setFillColor(NAVY)
    c.rect(0, H-76, W, 76, fill=1, stroke=0)
    txt(35, H-36, title, 20, WHITE, True)
    txt(36, H-57, subtitle, 9, HexColor("#D8E5F0"))
    c.setStrokeColor(LINE)
    c.line(35, 37, W-35, 37)
    txt(35, 22, "EXPEDITION  |  Arquitectura actual del repositorio", 8, MUTED)
    txt(W-103, 22, f"Página {number} de 4", 8, MUTED)


def box(x, y, w, h, title, body=None, fill=LIGHT, edge=LINE, title_color=NAVY, size=10):
    c.setFillColor(fill)
    c.setStrokeColor(edge)
    c.roundRect(x, y, w, h, 8, fill=1, stroke=1)
    txt(x+12, y+h-21, title, size, title_color, True)
    if body:
        wrapped(x+12, y+h-38, body, w-24, 8.2, 11.2, TEXT)


def arrow(x1, y1, x2, y2, color=LINE, width=1.6):
    import math
    c.setStrokeColor(color)
    c.setFillColor(color)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)
    a = math.atan2(y2-y1, x2-x1)
    l = 7
    p = c.beginPath()
    p.moveTo(x2, y2)
    p.lineTo(x2-l*math.cos(a-0.48), y2-l*math.sin(a-0.48))
    p.lineTo(x2-l*math.cos(a+0.48), y2-l*math.sin(a+0.48))
    p.close()
    c.drawPath(p, fill=1, stroke=0)


def capsule(x, y, w, h, label, fill, color=WHITE, size=9):
    c.setFillColor(fill)
    c.roundRect(x, y, w, h, 8, fill=1, stroke=0)
    lines = simpleSplit(label, BOLD, size, w-18)
    top = y+h/2 + ((len(lines)-1)*11)/2 - 3
    for line in lines:
        c.setFont(BOLD, size)
        c.setFillColor(color)
        c.drawCentredString(x+w/2, top, line)
        top -= 11


# 1. Resumen y alcance.
page("Arquitectura y flujos de EXPEDITION", "Inventario de módulos, conectividad y procesos | Estado observado: octubre de 2026", 1)
txt(37, 489, "Resumen ejecutivo", 15, NAVY, True)
wrapped(37, 467, "La aplicación principal usa Next.js 16 y Firebase App Hosting. Firebase Auth gestiona la identidad; Firestore y Storage alojan datos operativos; una API .NET externa proporciona el padrón y gran parte de la estructura organizativa.", 768, 10, 15)

box(37, 338, 240, 76, "Interfaz y sesión", "Rutas Next.js, vistas, navegación filtrada por rol, proveedores globales y caché local.", PALE, BLUE)
box(300, 338, 240, 76, "Datos operativos", "Firestore, Storage y reglas de acceso; productos, pedidos, chat, asistencia y contenido.", PALE, TEAL)
box(563, 338, 240, 76, "Padrón y organización", "Rutas /api de Next.js conectadas con la API .NET de miembros y entidades.", PALE, ORANGE)

txt(37, 304, "Lectura del sistema", 13, NAVY, True)
items = [
    ("7 áreas de navegación", "Principal, Organización, Tienda, Formación, Comunicación, Planificación y Administración."),
    ("2 caminos de datos", "Acceso directo a Firebase y llamadas a /api que consultan la API .NET u operan con Firebase Admin."),
    ("Conexiones transversales", "Permisos, auditoría, notificaciones y almacenamiento enlazan varios módulos."),
    ("Código de plantilla", "Hay páginas heredadas y rutas de demostración; su presencia no equivale a una función productiva."),
]
y = 274
for head, body in items:
    c.setFillColor(TEAL)
    c.circle(43, y+2, 3, fill=1, stroke=0)
    txt(55, y, head, 9.4, NAVY, True)
    wrapped(195, y, body, 603, 9, 13)
    y -= 47
txt(37, 65, "Alcance: análisis estático de archivos locales; no constituye prueba de disponibilidad en producción.", 8.5, MUTED)
c.showPage()


# 2. Diagrama de conectividad.
page("Diagrama de conectividad", "Las flechas indican dependencia o intercambio de datos implementado en el código", 2)
capsule(36, 444, 122, 48, "Usuario / navegador", BLUE)
capsule(188, 444, 143, 48, "Next.js: páginas y vistas", NAVY)
capsule(359, 444, 128, 48, "Firebase Auth", TEAL)
capsule(519, 444, 128, 48, "Roles y permisos", PURPLE)
capsule(676, 444, 130, 48, "Menú y guardas", BLUE)
for a,b in [(158,188),(331,359),(487,519),(647,676)]:
    arrow(a,468,b-4,468,BLUE)

domains = [
    (39, 340, "Organización y miembros"), (200, 340, "Asistencia"),
    (361, 340, "Tienda y pedidos"), (522, 340, "Chat y notificaciones"),
    (683, 340, "Portada, archivos y plan"),
]
for x,y,t in domains:
    box(x,y,145,55,t,fill=LIGHT,edge=LINE,size=9)
arrow(739,444,739,399,BLUE)
for x in [111,272,433,594,755]:
    arrow(739,415,x,415,LINE,1.0) if x != 739 else None
    arrow(x,415,x,398,LINE,1.0)

capsule(70, 209, 156, 55, "Rutas Next.js /api", BLUE)
capsule(267, 209, 156, 55, "Cloud Firestore", TEAL)
capsule(464, 209, 145, 55, "Firebase Storage", TEAL)
capsule(650, 209, 155, 55, "Web Push", GREEN)
arrow(111,340,148,269,BLUE)
arrow(272,340,345,269,TEAL)
arrow(433,340,345,269,TEAL)
arrow(433,340,536,269,TEAL)
arrow(594,340,345,269,TEAL)
arrow(594,340,728,269,GREEN)
arrow(755,340,345,269,TEAL)

capsule(70, 95, 156, 55, "API .NET externa", ORANGE)
capsule(267, 95, 156, 55, "Firebase Admin SDK", PURPLE)
capsule(464, 95, 145, 55, "Cloud Scheduler", NAVY)
arrow(148,209,148,155,ORANGE)
arrow(227,236,263,236,PURPLE)
arrow(345,209,345,155,PURPLE)
arrow(536,150,190,207,NAVY)
txt(37, 64, "Las tareas programadas llaman a /api/tareas/* para cumpleaños, respaldos, resúmenes y salud.", 8.4, MUTED)
c.showPage()


# 3. Flujo.
page("Diagrama de flujo", "Recorrido principal de acceso y operaciones; cada rama representa un proceso real del proyecto", 3)
capsule(35, 458, 118, 42, "Abrir aplicación", BLUE)
capsule(179, 458, 124, 42, "Validar sesión", TEAL)
capsule(329, 458, 124, 42, "Cargar perfil", PURPLE)
capsule(479, 458, 142, 42, "Resolver permisos", PURPLE)
capsule(648, 458, 154, 42, "Mostrar módulos", BLUE)
for a,b in [(153,179),(303,329),(453,479),(621,648)]:
    arrow(a,479,b-3,479,BLUE)
txt(184, 438, "Sin sesión → acceso / recuperación → nueva validación", 8.5, MUTED)

flows = [
    ("Organización", "Miembros / entidades", "Servicio cliente → /api", "API .NET → alcance → vista", BLUE),
    ("Asistencia", "Padrón y destacamento", "Marcar y validar", "Guardar en Firestore", TEAL),
    ("Tienda", "Productos → carrito", "Crear pedido", "Inventario + recibo + aviso", ORANGE),
    ("Chat", "Elegir conversación", "/api/chat valida acceso", "Mensaje + aviso / push", PURPLE),
    ("Designer", "Editar borrador", "Verificar permiso", "Publicar + versión + historial", GREEN),
]
ys = [365, 294, 223, 152, 81]
for (name, s1, s2, s3, color), y in zip(flows, ys):
    capsule(37,y,115,45,name,color)
    box(174,y,170,45,s1,fill=LIGHT,title_color=NAVY,size=8.8)
    box(365,y,180,45,s2,fill=LIGHT,title_color=NAVY,size=8.8)
    box(566,y,237,45,s3,fill=LIGHT,title_color=NAVY,size=8.8)
    arrow(152,y+22,170,y+22,color)
    arrow(344,y+22,361,y+22,color)
    arrow(545,y+22,562,y+22,color)
arrow(725,458,725,417,BLUE)
txt(37, 57, "Procesos transversales: auditoría, permisos, notificaciones, almacenamiento y caché de lecturas.", 8.5, MUTED)
c.showPage()


# 4. Inventario y límites.
page("Inventario de módulos y evidencia", "Distinción entre funciones operativas y páginas conservadas de la plantilla", 4)
rows = [
    ("Acceso y administración", "Firebase Auth, perfiles, cargos, claims, roles, aprobaciones y salud", "Auth / Firestore / Admin"),
    ("Organización", "Nacional, región, sección, destacamento, iglesia, miembro y directiva", "API .NET + Firestore"),
    ("Miembro", "Ficha, tutores, salud, historial, premios, cintas, pines y estatus", "API .NET + Firestore + Storage"),
    ("Asistencia", "Pase de lista, licencias y reportes", "Miembros + Firestore"),
    ("Comercio", "Productos, inventario, carrito, pedidos, recibos y reseñas", "Firestore + Storage + chat"),
    ("Comunicación", "Chat, buzones, campana y Web Push", "/api/chat + Firestore + Push"),
    ("Contenido", "Portada, Designer, campañas, versiones, certificados y archivos", "Firestore + Storage"),
    ("Planificación", "Calendario de actividades", "Firestore + avisos"),
    ("Automatización", "Cumpleaños, respaldo, resumen de cambios y salud", "Scheduler + /api/tareas"),
]
x0, y0 = 35, 485
widths = [153, 455, 165]
c.setFillColor(PALE)
c.rect(x0,y0, sum(widths),30,fill=1,stroke=0)
for x,label in [(x0+8,"Área"),(x0+widths[0]+8,"Módulos"),(x0+widths[0]+widths[1]+8,"Conexión")]:
    txt(x,y0+10,label,9,NAVY,True)
y = y0
for i,(a,b,d) in enumerate(rows):
    y -= 34
    if i%2==1:
        c.setFillColor(LIGHT)
        c.rect(x0,y,sum(widths),34,fill=1,stroke=0)
    txt(x0+8,y+12,a,8.3,TEXT,True)
    txt(x0+widths[0]+8,y+12,b,8.0,TEXT)
    txt(x0+widths[0]+widths[1]+8,y+12,d,8.0,MUTED)
    c.setStrokeColor(LINE)
    c.line(x0,y,x0+sum(widths),y)

txt(35, 147, "Estado de las rutas heredadas", 10, NAVY, True)
wrapped(35, 131, "Mail usa datos simulados; Kanban responde con un tablero simulado; algunas rutas de producto y publicaciones son ejemplos del kit. Capacitación está deshabilitada en la navegación actual. El calendario, en cambio, usa Firestore.", 765, 8.5, 12)
txt(35, 88, "Archivos base revisados", 9, NAVY, True)
wrapped(35, 73, "src/app/layout.jsx · src/layouts/nav-config-dashboard.jsx · src/lib/firebase.js · src/auth/components/context/firebase/auth-provider.jsx · src/app/api/members/route.js · src/app/api/chat/route.js · src/services/product-service.js · src/services/order-service.js · apphosting.yaml", 765, 7.7, 10)
c.showPage()
c.save()
print(OUT)
