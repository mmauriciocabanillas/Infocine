# Rediseño INFOCINE

16 de octubre de 2026. Cambios en el mismo checkout de Infocine, rama `main`.

## Diagnóstico

La versión anterior mezclaba una paleta de panel administrativo con un afiche dentro de una tarjeta inclinada. Varias frases repetían la invitación a reservar sin añadir información. La marca, los boletos y las pantallas usaban Cine CEFINF en lugar del nombre definitivo.

No existe una certificación ni una regla universal que garantice que una web no parezca generada por IA. El objetivo verificable es darle una identidad propia, organizar el contenido real del evento y quitar decisiones visuales repetitivas que no ayudan a reservar.

## Investigación y criterios

| Referencia primaria | Qué se comprobó | Aplicación en INFOCINE |
| --- | --- | --- |
| [NN/g: principios de diseño visual](https://www.nngroup.com/articles/principles-visual-design/) | Escala, contraste, jerarquía y agrupación ayudan a ordenar la información. | Película y reserva como primera lectura; datos de función agrupados y combos en otra sección. |
| [NN/g: tipografía, espaciado y consistencia](https://www.nngroup.com/articles/why-does-design-look-good/) | Un sistema de una o dos familias, alineación y una paleta acotada favorecen la coherencia. | Dos familias con funciones fijas, negro y crema, márgenes comunes y separadores sencillos. |
| [BFI Southbank](https://www.bfi.org.uk/bfi-southbank) | Página real revisada visualmente. En el navegador, el h1 declaró `HelveticaNeueLTPro-Bd, HelveticaNeue` y los h2 `Open Sans`. Se distinguen programación y comida/bebida, con imágenes vinculadas a cada contenido. | Se toma la claridad de organización; no se copia su interfaz ni se afirma que sus fuentes sean las de INFOCINE. |
| [Anton](https://fonts.google.com/specimen/Anton) y [Public Sans](https://fonts.google.com/specimen/Public+Sans) | Familias seleccionadas para esta implementación. | Anton en titulares y marca; Public Sans en información, menús, formularios y acciones. Ambas se sirven desde la aplicación. |

Se intentó revisar Curzon, pero su protección bloqueó la página. No se atribuyen fuentes ni detalles visuales a una referencia que no pudo comprobarse. Los criterios de arriba son principios de diseño, no un detector de IA ni una promesa sobre la percepción de cada visitante.

## Decisiones aplicadas

- **Marca:** solo INFOCINE como nombre del producto, también en pestaña, boletos, PDF y mensajes. CEFINF permanece como organizador.
- **Logo:** se usa el SVG oficial aportado. Solo el relleno blanco del boleto se cambia a negro; círculo crema, recortes, perforaciones, geometría y transparencia permanecen. Los originales de Descargas no se modifican.
- **Portada:** fotografía de Tony Stark integrada en el fondo del cartel, sin reutilizar el afiche completo ni su texto impreso. El título, la reserva y los datos se renderizan como texto de la web.
- **Imágenes de apoyo:** el símbolo de Endgame en blanco y negro acompaña la explicación de la reserva. La composición de reparto se utiliza en el boleto.
- **Composición:** se eliminan la tarjeta inclinada del afiche, la tira de iconos y el banner final. Se retira la frase «Algunas historias se viven mejor juntos».
- **Texto:** mensajes breves que explican reserva, QR y pago en puerta; se eliminan eslóganes de relleno de las pantallas operativas.
- **Butacas:** símbolo vectorial de asiento con número, estado accesible, marca de selección y señal de ocupación. Se mantienen 198 asientos, A01–K18 y pasillo central.
- **Combos:** carta de seis ofertas, con contenido, precio y precio normal tachado según la tabla del usuario. Solo información; no se añade una venta online ni se modifica el precio de entrada.
- **Combos:** fotografía proporcionada por el organizador en `public/images/combos.png`. Canchita (S/ 2.50) y gaseosa (S/ 3.00) se muestran en filas separadas.
- **Redes:** Facebook con ID `100086475223991` e Instagram `cefinf.unt`, proporcionados por el usuario. El enlace de Instagram omite los parámetros de seguimiento.

## Compatibilidad y datos

Los QR nuevos llevan el prefijo `INFOCINE:`. El lector acepta también `CINECEFINF:` y el token opaco sin prefijo. No se cambia ningún identificador de función, secreto de entrada ni reserva. La migración SQL y los proveedores de persistencia permanecen sin cambios.

Las pruebas se ejecutaron contra SQLite independiente en el puerto 3001. No se ejecutaron escrituras en Supabase ni se modificaron datos de la web desplegada. El usuario confirmó que Supabase y Vercel ya existen; la publicación de esta revisión no se realizó en este trabajo.

## Verificación

- Compilación de producción y TypeScript correctos.
- 19 pruebas de datos y 4 flujos de navegador correctos.
- Reserva, PDF, lectura de QR desde imagen, cobro, ingreso único y cancelación.
- Veinte QR comprobados alternando prefijo nuevo y anterior.
- Anchuras 320, 390, 768 y 1280 px: página sin desbordamiento y título sin recorte horizontal.
- Plano móvil desplazable, conservando sus 198 controles.
- Logo: boleto negro; trazado y crema del círculo iguales al original.
- Auditoría de dependencias de producción sin vulnerabilidades detectadas.
- PDF generado por la interfaz renderizado para revisión visual.

Las capturas de esta revisión están en `docs/capturas/infocine/`. Los datos visibles son ficticios. La cámara física y el comportamiento de esta revisión en Vercel/Supabase requieren comprobación en esa infraestructura; no se presentan las pruebas locales como resultados remotos.
