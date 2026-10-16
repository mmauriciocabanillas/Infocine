# Validación local - 16 de octubre de 2026

| Comprobación | Resultado y alcance |
| --- | --- |
| `npm test` | **19/19** según el contador de Node Test Runner, incluyendo el contenedor de pruebas PostgreSQL. SQLite y PostgreSQL embebido PGlite. |
| `npm run build` | Compilación de producción correcta, TypeScript correcto y rutas generadas. |
| `npm run test:e2e` | **4/4** en Microsoft Edge/Chromium contra servidor de producción local y base independiente. |
| `npm audit --omit=dev --audit-level=high` | **0 vulnerabilidades detectadas** en dependencias de producción. No constituye una auditoría integral de seguridad. |
| Originales del ZIP | **9/9 SHA-256 coinciden** con el manifiesto. |
| PDF descargado desde la interfaz | Dos páginas para dos asientos. Primera página renderizada e inspeccionada: butaca, nombre, fecha, precio, QR y marca local legibles, sin solapamientos. |
| Vista móvil | 390 × 844 px, sin desbordamiento de la página; plano horizontal desplazable y 198 controles. |

## Flujos de navegador

1. Reserva de dos asientos, QR distintos, descarga PDF, inicio de sesión, **lectura de la imagen del QR**, cobro e ingreso, rechazo de segundo uso y cancelación de otra entrada.
2. Dos confirmaciones HTTP simultáneas para los mismos asientos: una acepta y otra devuelve conflicto. Reintento ganador devuelve el mismo enlace. Origen ajeno rechazado.
3. Presentación y plano en pantalla móvil.
4. Lectura y validación de **20 QR adicionales**, distintos, generados con los parámetros de la aplicación.

Los 19 casos del contador de datos incluyen validación de nombre, asientos, reserva multi-butaca, reversión por conflicto, idempotencia, aforo completo, cancelación, pago/ingreso, roles, permisos anónimos, QR inválido, cierre y limitación de solicitudes.

## Correcciones verificadas durante la revisión

- Corregido el INSERT del proveedor local detectado por las primeras pruebas.
- Comparación de origen con el destino real (`Host`): Next normalizaba la URL interna a localhost y rechazaba operaciones legítimas contra 127.0.0.1.
- Biblioteca PDF actualizada a 4.2.1 tras alerta de auditoría.
- Lectura de QR con búsqueda ampliada y alternativa para QR aislado cuando falla la detección de esquinas.
- Separación de bases de pruebas automáticas y manuales; se preservaron los registros introducidos manualmente.
- Marca local en la portada, consulta de entradas y PDF.

## Evidencia

Las imágenes de `capturas/` proceden de las pruebas de esta entrega. Muestran datos ficticios y no acreditan reservas ni ingresos del evento real:

- `inicio-desktop.png` / `inicio-mobile.png`.
- `reserva-mobile.png`.
- `entradas-desktop.png`.
- `puerta-desktop.png`.
- `boleto-prueba.png`.

## Sin verificar

No se crearon proyectos ni se ejecutaron operaciones contra Supabase/Vercel. No se probaron la cámara física de un teléfono, latencia remota, funcionamiento sin internet ni recuperación por correo (esta última no está implementada).
