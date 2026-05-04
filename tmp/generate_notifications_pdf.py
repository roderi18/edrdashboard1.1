from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, PageBreak, ListFlowable, ListItem


OUTPUT_PATH = r"C:\Users\rdpr1\OneDrive\Escritorio\next-js\documentacion-notificaciones.pdf"


notifications = [
    (
        "Autenticación",
        [
            "Inicio de sesión exitoso",
            "Intento fallido de inicio de sesión",
            "Restablecimiento de contraseña solicitado",
            "Contraseña cambiada correctamente",
            "Inicio de sesión desde dispositivo nuevo",
            "Bloqueo por demasiados intentos",
        ],
        [
            "Inicio de sesión exitoso",
            "Intento fallido de inicio de sesión",
            "Restablecimiento de contraseña solicitado",
            "Contraseña cambiada correctamente",
            "Cuenta creada correctamente",
            "Inicio de sesión desde dispositivo nuevo",
        ],
    ),
    (
        "Administradores",
        [
            "Nuevo administrador creado",
            "Administrador actualizado",
            "Administrador desactivado",
            "Cambio de permisos de administrador",
            "Acceso no autorizado detectado",
            "Acción sensible realizada en panel administrativo",
        ],
        [
            "Tu cuenta fue actualizada por un administrador",
            "Tu acceso fue limitado o restaurado",
        ],
    ),
    (
        "Miembros / Usuarios",
        [
            "Nuevo miembro creado",
            "Miembro actualizado",
            "Miembro eliminado o desactivado",
            "Miembro sin región o destacamento asignado",
            "Miembro con datos incompletos",
            "Miembro con documento o perfil pendiente",
            "Cambio de estado del miembro",
            "Duplicado posible detectado",
        ],
        [
            "Tu cuenta fue creada",
            "Tu perfil fue actualizado",
            "Tu estado cambió",
            "Tu cuenta fue activada",
            "Tu cuenta fue suspendida",
            "Debes completar tu perfil",
            "Se actualizó tu información personal",
        ],
    ),
    (
        "Nacional",
        [
            "Registro nacional creado",
            "Registro nacional actualizado",
            "Cambio de responsables nacionales",
            "Asignación nacional modificada",
        ],
        [
            "Cambio en estructura nacional que te afecta",
            "Nueva asignación nacional visible en tu perfil",
        ],
    ),
    (
        "Regional",
        [
            "Región creada",
            "Región actualizada",
            "Región eliminada o desactivada",
            "Cambio de autoridad regional",
            "Región sin miembros asignados",
            "Región con crecimiento relevante",
        ],
        [
            "Fuiste asignado a una región",
            "Tu región fue actualizada",
            "Cambio de responsable regional",
        ],
    ),
    (
        "Seccional",
        [
            "Sección creada",
            "Sección actualizada",
            "Sección eliminada o desactivada",
            "Cambio de responsable seccional",
            "Sección sin miembros",
            "Sección sin destacamentos",
        ],
        [
            "Fuiste asignado a una sección",
            "Tu sección fue actualizada",
            "Cambio de responsable seccional",
        ],
    ),
    (
        "Destacamentos",
        [
            "Destacamento creado",
            "Destacamento actualizado",
            "Destacamento desactivado",
            "Cambio de líder del destacamento",
            "Destacamento sin miembros",
            "Destacamento con sobrecupo o inconsistencia",
        ],
        [
            "Fuiste asignado a un destacamento",
            "Tu destacamento fue actualizado",
            "Cambio de encargado del destacamento",
        ],
    ),
    (
        "Productos",
        [
            "Producto creado",
            "Producto actualizado",
            "Producto publicado",
            "Producto movido a borrador",
            "Producto sin inventario",
            "Producto con inventario bajo",
            "Error al subir imágenes",
            "Imágenes compactadas correctamente",
            "Producto eliminado",
            "Cambio de precio",
            "Cambio de categoría",
        ],
        [
            "Producto disponible nuevamente",
            "Producto agotado",
            "Cambio de precio en producto guardado o comprado",
            "Nuevo producto publicado",
            "Producto en promoción",
        ],
    ),
    (
        "Inventario",
        [
            "Inventario actualizado manualmente",
            "Entrada de inventario registrada",
            "Salida de inventario registrada",
            "Stock bajo",
            "Stock agotado",
            "Movimiento sospechoso de inventario",
            "Ajuste masivo realizado",
            "Error de sincronización de inventario",
        ],
        [
            "Producto nuevamente disponible",
            "Producto casi agotado",
            "Pedido afectado por falta de inventario",
        ],
    ),
    (
        "Carrito / Checkout",
        [
            "Checkout iniciado",
            "Checkout abandonado",
            "Error en proceso de pago",
            "Compra completada",
            "Compra cancelada",
        ],
        [
            "Producto agregado al carrito",
            "Carrito guardado",
            "Checkout iniciado",
            "Compra completada",
            "Compra fallida",
            "Pago rechazado",
            "Pedido cancelado",
            "Carrito con producto agotado",
        ],
    ),
    (
        "Pedidos",
        [
            "Nuevo pedido recibido",
            "Pedido pagado",
            "Pedido pendiente de pago",
            "Pedido cancelado",
            "Pedido entregado",
            "Pedido reembolsado",
            "Pedido con incidencia",
            "Pedido con datos incompletos",
        ],
        [
            "Pedido creado",
            "Pedido confirmado",
            "Pedido pagado",
            "Pedido en preparación",
            "Pedido enviado",
            "Pedido entregado",
            "Pedido cancelado",
            "Pedido rechazado",
            "Reembolso procesado",
        ],
    ),
    (
        "Facturas",
        [
            "Factura creada",
            "Factura actualizada",
            "Factura anulada",
            "Factura vencida",
            "Factura pagada",
            "Error al generar factura",
        ],
        [
            "Factura generada",
            "Factura disponible para ver o descargar",
            "Factura vencida",
            "Pago aplicado a factura",
            "Factura anulada",
        ],
    ),
    (
        "Publicaciones",
        [
            "Publicación creada",
            "Publicación actualizada",
            "Publicación publicada",
            "Publicación enviada a borrador",
            "Publicación eliminada",
            "Publicación programada",
            "Publicación con error de contenido",
        ],
        [
            "Nueva publicación disponible",
            "Publicación actualizada",
            "Publicación destacada",
            "Comentario o interacción nueva, si luego se agrega esa funcionalidad",
        ],
    ),
    (
        "Archivos",
        [
            "Archivo subido",
            "Archivo actualizado",
            "Archivo eliminado",
            "Archivo compartido",
            "Error al subir archivo",
            "Espacio de almacenamiento alto",
        ],
        [
            "Archivo compartido contigo",
            "Archivo actualizado",
            "Archivo eliminado",
            "Error de acceso a archivo",
        ],
    ),
    (
        "Permisos",
        [
            "Permiso otorgado",
            "Permiso revocado",
            "Rol actualizado",
            "Acceso denegado a usuario",
            "Cambio crítico de permisos",
        ],
        [
            "Tus permisos fueron actualizados",
            "Ya tienes acceso a un módulo",
            "Tu acceso fue restringido",
        ],
    ),
    (
        "Mail / Chat",
        [
            "Nuevo mensaje recibido",
            "Mensaje sin responder",
            "Conversación marcada como importante",
            "Error en envío de mensaje",
        ],
        [
            "Nuevo mensaje recibido",
            "Mensaje respondido",
            "Conversación cerrada",
            "Mensaje no entregado",
        ],
    ),
    (
        "Calendario",
        [
            "Evento creado",
            "Evento actualizado",
            "Evento cancelado",
            "Recordatorio de evento",
            "Cambio de horario",
            "Invitados confirmados",
        ],
        [
            "Nuevo evento asignado",
            "Recordatorio de evento",
            "Evento reprogramado",
            "Evento cancelado",
        ],
    ),
    (
        "Tareas / Kanban",
        [
            "Tarea creada",
            "Tarea asignada",
            "Tarea vencida",
            "Tarea completada",
            "Cambio de prioridad",
            "Comentario nuevo en tarea",
        ],
        [
            "Se te asignó una tarea",
            "Tu tarea cambió de estado",
            "Tarea próxima a vencer",
            "Tarea completada",
            "Comentario nuevo en tu tarea",
        ],
    ),
    (
        "Tours / Eventos / Reservas",
        [
            "Tour creado",
            "Tour actualizado",
            "Tour cancelado",
            "Nueva reserva",
            "Reserva cancelada",
            "Cupo lleno",
        ],
        [
            "Reserva creada",
            "Reserva confirmada",
            "Reserva cancelada",
            "Recordatorio de actividad",
            "Cambio de horario o lugar",
        ],
    ),
    (
        "Jobs / Empleos",
        [
            "Vacante creada",
            "Vacante actualizada",
            "Vacante cerrada",
            "Nueva postulación",
            "Postulación revisada",
        ],
        [
            "Nueva vacante publicada",
            "Postulación enviada",
            "Postulación en revisión",
            "Postulación aceptada",
            "Postulación rechazada",
        ],
    ),
    (
        "Dashboard / Resúmenes",
        [
            "Resumen diario disponible",
            "Caída de métricas",
            "Incremento anormal de registros",
            "Inventario crítico",
            "Pedidos pendientes altos",
            "Facturas vencidas altas",
        ],
        [
            "Resumen semanal",
            "Nuevos movimientos de tu cuenta",
        ],
    ),
]


def bullet_list(items, bullet_color):
    style = ParagraphStyle(
        "BulletBody",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=13,
        leftIndent=12,
        firstLineIndent=0,
        spaceBefore=1,
        spaceAfter=1,
        textColor=colors.HexColor("#1f2937"),
    )
    return ListFlowable(
        [
            ListItem(
                Paragraph(item, style),
                value="bullet",
                bulletColor=bullet_color,
            )
            for item in items
        ],
        bulletType="bullet",
        start="circle",
        leftIndent=8,
        bulletFontName="Helvetica",
        bulletFontSize=8,
        bulletOffsetY=1,
    )


styles = getSampleStyleSheet()
styles.add(
    ParagraphStyle(
        "TitleCustom",
        parent=styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=20,
        leading=24,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=8,
    )
)
styles.add(
    ParagraphStyle(
        "SubtitleCustom",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#475569"),
        spaceAfter=14,
    )
)
styles.add(
    ParagraphStyle(
        "SectionCustom",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=18,
        textColor=colors.white,
        backColor=colors.HexColor("#1d4ed8"),
        borderPadding=(6, 8, 6),
        spaceBefore=10,
        spaceAfter=10,
    )
)
styles.add(
    ParagraphStyle(
        "RoleCustom",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#0f172a"),
        spaceBefore=5,
        spaceAfter=5,
    )
)
styles.add(
    ParagraphStyle(
        "BodyCustom",
        parent=styles["BodyText"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        alignment=TA_LEFT,
        textColor=colors.HexColor("#334155"),
        spaceAfter=8,
    )
)


def add_page_number(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(colors.HexColor("#64748b"))
    canvas.drawRightString(A4[0] - 2 * cm, 1.1 * cm, f"Página {doc.page}")
    canvas.restoreState()


story = []
story.append(Spacer(1, 0.6 * cm))
story.append(Paragraph("Plan de Notificaciones de la Aplicación", styles["TitleCustom"]))
story.append(
    Paragraph(
        "Listado de notificaciones sugeridas, dividido por módulos y por tipo de usuario: administradores y usuarios comunes.",
        styles["SubtitleCustom"],
    )
)
story.append(
    Paragraph(
        "Consideraciones clave para implementar notificaciones: definir canal, prioridad, destinatario, estado de lectura, entidad relacionada, reglas anti-duplicado, preferencias por usuario y trazabilidad en auditoría.",
        styles["BodyCustom"],
    )
)

for module_name, admin_items, user_items in notifications:
    story.append(Paragraph(module_name, styles["SectionCustom"]))
    story.append(Paragraph("Administradores", styles["RoleCustom"]))
    story.append(bullet_list(admin_items, colors.HexColor("#1d4ed8")))
    story.append(Spacer(1, 0.12 * cm))
    story.append(Paragraph("Usuarios comunes", styles["RoleCustom"]))
    story.append(bullet_list(user_items, colors.HexColor("#059669")))
    story.append(Spacer(1, 0.35 * cm))


doc = SimpleDocTemplate(
    OUTPUT_PATH,
    pagesize=A4,
    leftMargin=1.8 * cm,
    rightMargin=1.8 * cm,
    topMargin=1.5 * cm,
    bottomMargin=1.6 * cm,
    title="Plan de Notificaciones",
    author="Codex",
)

doc.build(story, onFirstPage=add_page_number, onLaterPages=add_page_number)
print(OUTPUT_PATH)
