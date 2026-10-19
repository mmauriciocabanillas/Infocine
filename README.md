# INFOCINE

Web de reservas para la función de Avengers: Endgame del viernes 23 de octubre de 2026, 4:30 p. m., Auditorio de Ciencias Sociales, UNT. **S/ 5 por entrada, exclusivamente al ingresar.**

## Abrir en este equipo

Las dependencias y `.env.local` ya están preparados. Desde PowerShell:

```powershell
Set-Location -LiteralPath 'C:\Users\ASUS\Documents\Siklerito\Proyectos Personales\Cine'
npm run dev
```

Abre <http://127.0.0.1:3000>. Para detener el servidor: `Ctrl+C`.

- `/`: presentación de la función.
- `/reservar/endgame-2026`: nombre, plano de 198 butacas y confirmación.
- `/entradas/<enlace-privado>`: un QR por asiento y descarga PDF.
- `/admin`: listado completo, filtros, cobros, pausa, cancelación, selección múltiple, borrado definitivo y restablecimiento de la función.
- `/admin/validar`: cámara, lectura de imagen o código manual.

En modo local, el acceso del equipo utiliza la contraseña **LOCAL_ADMIN_PASSWORD** de `.env.local`, sin correo. Ese archivo contiene secretos, está ignorado por Git y no debe compartirse. Los datos de prueba se guardan en `.data/cine.sqlite`; no se envían a Supabase. El modo local solo atiende solicitudes de este equipo y se rechaza en Vercel.

Para preparar otra instalación con Node.js 24:

```powershell
npm ci
npm run setup:local
npm run dev
```

## Comportamiento implementado

- A01–K18: 11 filas, 9 asientos por bloque, pasillo entre 09 y 10.
- **Máximo 4 entradas activas por nombre y función**, acumuladas entre reservas. Se ignoran mayúsculas, tildes y espacios repetidos. Las canceladas no cuentan; las ingresadas sí. La interfaz, API y PostgreSQL aplican el límite. Las reservas anteriores se conservan.
- Reserva de varios asientos en una transacción; ante una colisión no se confirma parcialmente.
- Idempotencia: reintentar la misma operación devuelve los mismos tickets.
- Una reserva bloquea el asiento sin marcarlo pagado. No existen formularios ni integración de pago online.
- Tokens aleatorios por entrada y enlace privado de recuperación; no se busca una reserva por nombre.
- Disponibilidad actualizada cada 5 segundos y verificada nuevamente al confirmar.
- Protección contra reservas automatizadas: máximo **3 intentos de reserva por IP cada 10 minutos**, aunque cambie el nombre. Incluye errores y reintentos; el cuarto devuelve HTTP 429 con `Retry-After: 600`. Consultar el plano y administrar entradas no consume esa cuota. Una IP puede obtener hasta 12 entradas en la ventana (3 reservas de 4).
- En Vercel se utiliza `x-vercel-forwarded-for`, validada y normalizada, y se guarda únicamente su HMAC con `RATE_LIMIT_SECRET`. El contador está en Supabase, compartido entre instancias; reiniciar Vercel o cambiar de navegador no lo reinicia. Si Vercel no entrega una IP válida, se rechaza la operación.
- Nombre y QR de terceros protegidos. La API pública devuelve solo función y butacas ocupadas.
- Personal autenticado: verificar no consume el QR; al recibir el dinero se confirma pago e ingreso de forma atómica.
- Segundo ingreso rechazado. Cancelación administrativa invalida el QR y libera la butaca; una entrada ya utilizada no se cancela.
- El administrador puede seleccionar entradas de cualquier estado y eliminarlas definitivamente, o eliminar todas. Se retiran también sus pagos, ingresos, registros de auditoría y reservas que queden vacías. Los QR y enlaces privados sin entradas dejan de funcionar.
- **Restablecer función** elimina todo lo anterior y vuelve a habilitar reservas conservando horario, aforo, precio y cuentas del equipo. El cierre por horario sigue vigente. Eliminar todas conserva el estado habilitado/pausado. Ambas acciones requieren escribir una confirmación; no se ejecutan al instalar la actualización.
- Interfaz y PDF sin avisos de prueba; el proveedor local continúa separado de Supabase.
- Fuentes servidas desde la aplicación, sin peticiones a Google Fonts.

## Conectar Supabase y Vercel

El proyecto ya está creado en Supabase y desplegado en Vercel. Esta actualización necesita ejecutar **`supabase/migrations/202610190001_limits_and_bulk_delete.sql`** en el SQL Editor del proyecto existente y publicar el código actualizado. La migración conserva las reservas actuales; instala el límite y la operación administrativa de borrado. Se puede repetir sin borrar datos.

El bloqueo por IP reutiliza `cine_rate_limit`, ya instalado en la migración original. **No requiere otra migración, claves nuevas ni servicios adicionales**: basta publicar el código, conservando `RATE_LIMIT_SECRET` y la conexión actual a Supabase. Usuarios del mismo wifi pueden compartir la cuota; cambiar a otra IP permite eludirla. No garantiza identidad ni detiene por completo ataques con IP distribuidas.

1. Solo para un proyecto nuevo: ejecuta primero `supabase/migrations/202610160001_cine.sql` una vez y después `supabase/migrations/202610190001_limits_and_bulk_delete.sql`. En el proyecto existente ejecuta únicamente la segunda migración.
2. En Authentication, deshabilita el registro público y crea las cuentas del equipo. Copia sus UUID y asigna el rol en SQL:

```sql
insert into public.cine_staff(user_id, role)
values ('UUID-DE-LA-CUENTA'::uuid, 'admin');
-- Para personal que solo valida/cobra: sustituir admin por door.
```

3. Configura estas variables en un entorno local para probar Supabase y después en Vercel:

```dotenv
DATA_BACKEND=supabase
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_ANON_KEY=TU-CLAVE-PUBLICABLE-O-ANON
SUPABASE_SERVICE_ROLE_KEY=TU-CLAVE-SECRETA-O-SERVICE-ROLE
RATE_LIMIT_SECRET=SECRETO-ALEATORIO-DE-AL-MENOS-32-CARACTERES
```

Las claves se utilizan solo en el servidor. **No** añadir el prefijo `NEXT_PUBLIC_` a la clave secreta. El nombre de variable `SUPABASE_SERVICE_ROLE_KEY` acepta la clave secreta actual o la service role heredada; `SUPABASE_ANON_KEY` acepta publicable o anon. No compartir `.env.local` ni subirlo al repositorio. Para producción no copiar `DATA_BACKEND=local`.

4. Crea un repositorio privado y súbelo sin `.env.local`, `.data`, `node_modules` ni `.next`. Importa ese repositorio en Vercel como proyecto Next.js, selecciona Node.js 24, registra las variables y despliega. No hay cron, almacenamiento de archivos ni servicios adicionales requeridos.
5. En el dominio HTTPS real, prueba desde dos navegadores: mismo asiento simultáneo; descarga y lectura del QR; ingreso; rechazo de repetición; cancelación; acceso sin sesión. Ensaya además la cámara trasera con el teléfono que se usará en puerta.

La base de datos protege las tablas con RLS sin políticas de acceso público y retira EXECUTE de las RPC para `PUBLIC`, `anon` y `authenticated`. Solo la API de servidor invoca las funciones con privilegios. El rol del encargado se consulta en servidor; las funciones de ingreso/cancelación comprueban también ese rol en PostgreSQL.

## Decisiones operativas que deben cerrarse

- **Hora de cierre:** por defecto, al inicio de la función (23/10/2026, 4:30 p. m., Lima). Se puede pausar antes desde administración o cambiar `closes_at` en `cine_events`.
- **Recuperación:** enlace privado y PDF; no hay correo ni recuperación por nombre. Si se pierden ambos, interviene el organizador.
- **Cancelación:** solo administrador; no hay caducidad automática por falta de pago.
- **Privacidad:** definir contacto institucional y plazo de conservación antes de usar nombres reales. La página actual declara que los datos permanecen hasta su eliminación por el organizador; no promete borrado automático.
- **Doomsday:** no se añadió una afirmación editorial nueva sobre tráiler/poscréditos. El afiche original conserva el texto aportado; hay que unificarlo con el organizador.
- **Identidad:** el límite utiliza el nombre, porque el formulario no pide un identificador verificado. Cambiar de nombre permite eludirlo y dos personas con el mismo nombre comparten la cuota. Para un límite real por persona se necesita identificación adicional. El limitador técnico por IP no identifica personas.
- **Conectividad:** la verificación es online. Si falla el servidor, la pantalla no registra un ingreso exitoso. No hay admisión offline.

## Verificar

```powershell
npm test
npm run build
npm run test:e2e
npm audit --omit=dev
```

Las pruebas de navegador utilizan Microsoft Edge instalado en este equipo, un servidor de producción temporal en el puerto 3001 y una base SQLite independiente por ejecución. No modifican la base del servidor de desarrollo. El servidor temporal se cierra al terminar. Las capturas y PDF de prueba se escriben en `test-results/`, ignorado por Git.

## Identidad, combos y redes

La investigación y las decisiones del rediseño están en `docs/REDISENO_INFOCINE.md`. La marca visible es INFOCINE. El logo vectorial conserva las formas y el círculo crema; el boleto blanco pasa a negro. Los QR nuevos usan INFOCINE y se siguen aceptando los QR con el prefijo anterior.

Los precios y los enlaces sociales están en `src/lib/presentation.ts`. La fotografía de los combos está en `public/images/combos.png`, referenciada por `SNACK_IMAGE`. Canchita (S/ 2.50) y gaseosa (S/ 3.00) se muestran por separado.

## Archivos

- `docs/ANALISIS_Y_DECISIONES.md`: revisión crítica y contraste con la especificación.
- `docs/referencias/`: Markdown, manifiesto y nueve originales extraídos del ZIP sin modificaciones; hashes verificados.
- `src/`: interfaz, API, autenticación y proveedores de datos.
- `supabase/migrations/`: esquema, restricciones, permisos y operaciones transaccionales.
- `tests/`: validación SQLite, PostgreSQL y flujos de navegador.

Referencias técnicas consultadas: [Route Handlers de Next.js](https://nextjs.org/docs/app/getting-started/route-handlers), [funciones PostgreSQL en Supabase](https://supabase.com/docs/guides/database/functions), [validación del usuario en Supabase](https://supabase.com/docs/reference/javascript/auth-getuser).

Los avisos de prueba se retiraron por solicitud del organizador. Esto no migra datos de SQLite a Supabase ni publica cambios automáticamente. La configuración predeterminada del servidor es Supabase; el desarrollo local se activa explícitamente con DATA_BACKEND=local.
