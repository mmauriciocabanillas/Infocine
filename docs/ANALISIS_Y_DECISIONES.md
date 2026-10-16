# Revisión crítica y decisiones de implementación

Fecha: 16 de octubre de 2026. Carpeta de trabajo: `C:\Users\ASUS\Documents\Siklerito\Proyectos Personales\Cine`.

## Diagnóstico

La especificación entregada era un levantamiento de requisitos: no contenía código, tablas creadas ni despliegues. La carpeta del proyecto estaba vacía. Se tomaron sus requisitos como contexto del producto, sin tratar instrucciones históricas o recomendaciones pendientes como autorizaciones nuevas para publicar, contratar servicios o modificar originales.

El ZIP contiene nueve originales, un Markdown y un manifiesto. Los nueve SHA-256 coinciden. Durante el trabajo, los archivos pasaron de la ruta indicada inicialmente en Descargas a `C:\Users\ASUS\Downloads\Cine`; se utilizaron desde esa ubicación. Los originales de Descargas no se modificaron.

| Punto débil o abierto | Corrección aplicada |
| --- | --- |
| Límite de cuatro butacas solo propuesto | El usuario confirmó **sin límite adicional al aforo**. Servidor y base permiten 1–198. |
| Numeración física no confirmada | El usuario confirmó **A–K / 01–18**, pasillo entre 09 y 10. |
| Estado visual del mapa insuficiente para impedir sobreventa | Transacción y unicidad parcial de función + asiento activo. |
| Riesgo de reservas parciales | Si algún asiento está ocupado, se revierte toda la operación. |
| Reintentos de red podían duplicar reservas | Clave de idempotencia y huella del contenido. |
| QR podía confundirse con un pago | Reserva sin pago; cobro e ingreso solo tras confirmación del encargado. |
| Un QR copiado podía usarse dos veces | Actualización atómica con bloqueo y rechazo de entrada consumida. |
| Nombre no es prueba de identidad | No se usa para recuperar entradas ni para autorizar acceso administrativo. |
| Recuperación no definida | Enlace privado aleatorio + PDF, sin inventar correo obligatorio. |
| Cancelación no definida | Solo administrador, liberando asiento e invalidando el QR anterior. |
| Ticket gráfico decía jueves 23 | Ticket web y PDF muestran **viernes 23 de octubre de 2026**. PSD/PNG originales intactos. |
| Tráiler/poscréditos de Doomsday contradictorios | No se afirma contenido adicional nuevo. El afiche se muestra como original. Redacción pendiente. |
| Limitación por IP podía bloquear a una red universitaria | Margen de 600 solicitudes por IP/10 min; no se impone una cuota de butacas por persona. |
| Pruebas podían confundirse con reservas reales | SQLite separado de Supabase y marcas locales visibles, también en PDF. |

## Solución construida

Next.js, React y TypeScript; datos en Supabase/PostgreSQL al configurar producción. Se añadió un proveedor SQLite exclusivamente para pruebas locales. No es una alternativa de persistencia para Vercel y se bloquea cuando el proceso declara ese entorno.

La API pública expone función y butacas ocupadas, no nombres ni tokens. Los tickets se consultan mediante un secreto de 64 caracteres hexadecimales. El equipo inicia sesión con Supabase Auth y requiere un rol registrado en `cine_staff`; las sesiones usan cookies HttpOnly y las mutaciones comprueban el origen. Las tablas no conceden lectura pública ni las RPC ejecución anónima.

Los pagos se calculan con el precio almacenado en la función y guardado en cada ticket; el cliente no puede fijar el precio ni marcar cobros. Pago e ingreso tienen campos distintos y se escriben juntos al confirmar el dinero recibido. Se registra quién realizó la operación.

Se eligió consulta de disponibilidad cada cinco segundos. Supabase Realtime era una propuesta; no hace falta para garantizar exclusión. La base decide al confirmar.

## Suposiciones adoptadas

Son decisiones reversibles de implementación, no acuerdos históricos atribuidos al usuario:

1. Cierre de reservas al comenzar la función, con pausa manual disponible.
2. Recuperación mediante enlace privado y descarga PDF.
3. Cancelación exclusiva del administrador, sin liberación automática por falta de pago.
4. Un solo evento inicial; las tablas separan ocupación por función para reutilizar la sala.
5. Confirmación de cobro e ingreso en un paso, después de marcar recibido el dinero.

## Validación y límites

- Esquema PostgreSQL ejecutado en PGlite, incluyendo permisos, atomicidad, idempotencia, catálogo, aforo, cancelación, roles, pago y doble uso.
- SQLite comprobado con casos equivalentes y reserva de las 198 butacas en una operación.
- Navegador: reserva, QR distintos, PDF descargado, acceso del equipo, ingreso único, cancelación y solicitudes HTTP simultáneas.
- Móvil: 198 controles, plano desplazable, controles táctiles y ausencia de desbordamiento de la página.
- Originales: nueve hashes verificados.
- Se corrigió la dependencia PDF señalada por la auditoría; se fijó una versión actual sin alertas de producción.

**No equivale a una validación de Supabase/Vercel:** el usuario indicó que los proyectos todavía no existen. No hay URL pública, conexión real a Supabase ni prueba de cámara física en el teléfono de puerta. Los detalles del resultado final de las comprobaciones figuran en `VALIDACION.md`.

## Pendiente antes de abrir reservas reales

Crear y conectar los proyectos; asignar cuentas del equipo; definir contacto y conservación de nombres; confirmar hora de cierre y material editorial de Doomsday; ensayar el ingreso con la conexión y el teléfono reales.

## Autocrítica

La protección de concurrencia y QR evita duplicaciones, pero no comprueba quién escribe un nombre. Sin límite por operación, una persona puede ocupar el aforo: se respeta la decisión del usuario y no se presenta el limitador por IP como verificación de identidad.

El PDF conserva un diseño vertical cinematográfico, pero no reutiliza el PSD como plantilla exacta: así evita imprimir el día incorrecto y permite datos/QR dinámicos. El PSD permanece disponible para una futura adaptación gráfica aprobada.

La revisión local prueba el código y el SQL; no prueba latencia, cuotas, entrega de cookies, permisos de cámara ni concurrencia del servicio remoto. El ensayo en infraestructura real sigue siendo necesario.
