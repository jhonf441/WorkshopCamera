# WorkshopCamera -- historial de versiones

## 2.11.3 -- 2026-10-30

- Manifest: sbcRequired true (needs WorkshopService); side bar keeps the group names

## 2.11.2 -- 2026-10-29

- Phone layout fixes (44 px touch targets, no overflow), Workbench full-screen section picker, clamps hint, interrupted jobs off the table, Machine scale label

## 2.11.1 -- 2026-10-29

- State chips with an icon: the icon carries the color and there is no dot (family.css); chosen chip tinted

## 2.11.0 -- 2026-10-29

- Side bars: no gray line, a chosen item goes to the start of its section; Printing: start-up chip without the mode rows, tests notice only when the chip is not green, no-sensor fault reading; Vision: settings cards packed in columns, laser crosses only with Laser mode; Zones: visible mode dot

## 2.10.12 -- 2026-10-28

- Design family: final shared styles

## 2.10.11 -- 2026-10-28

- Design family: page bar with badge, title and one line; menu, cards, buttons and states are the shared wf-* classes; fixed the alert and chip classes that did not match their CSS

## 2.10.10 -- 2026-10-28

- Minimalist design: neutral page header and cards, text tabs that wrap, gray icons, dot and word states, no tinted boxes or shadows

## 2.10.9 -- 2026-10-28

- Risk dialogs get their colored side bar back; one type scale (Roboto in the panels, no half sizes)

## 2.10.8 -- 2026-10-28

- Risk dialogs get their colored side bar back; one type scale (Roboto in the panels, no half sizes)

## 2.10.7 -- 2026-10-27

- Plan warnings in words, risk dialogs in DWC style, mesh point selection, link to Machine modes

## 2.10.6 -- 2026-10-27

- Side bar no longer makes the page jump when a shorter section is chosen; start-up chip as in every page (header, same wording)

## 2.10.5 -- 2026-10-26

- Run-time guard: the 3.6 build refuses to start on a host with window.DWC and the 3.7 build outside DWC 3.7.x (visible warning); shipped as a strict per-line zip (dwcVersion 3.6 / 3.7)

## 2.10.4 -- 2026-10-26

- The "camera does not answer" box no longer outlives its view: pictures of the Studio preview, the live card, the thumbnails and the Captures / Videos preview show a note in place, and changing tab, leaving the page, closing the viewer or the mosaic and stopping the plugin release the boxes and cancel the preview timer.

## 2.10.3 -- 2026-10-26

- Universal zip: the DWC 3.6 side is now built with the official 3.6 pipeline, so its i18n catalogs are registered and the menu captions show names instead of raw plugins.* keys.

## 2.10.2 -- 2026-10-26

- Shared lifecycle cleanup, friendly transport errors and the confirmation texts of the shared JS code.

## 2.10.1 -- 2026-10-24

- Printing: FFF switch ignores an all-commented macro, one-row Preview and Back, same navigation buttons as the other assistants; Camera: orientation asks Vision through the service

## 2.10.0 -- 2026-10-24

- Workbench 2.19.0 (live trace, interrupted counter, rotate handle, polyline snap, map ruler); Camera Studio phase 2 (stabilization, burst, rebuild a video), page without cameras with network search, flash row; shared start-up assistant fixes

## 2.9.2 -- 2026-10-24

- Start-up card reports its pending count to the service (machine setup list)

## 2.9.1 -- 2026-10-24

- Mosaic live-mode id kept out of buildCameraPanel

## 2.9.0 -- 2026-10-24

- Studio: cinema controls for the timelapse (live preview with the look, presets, interval ramp, framing, color and LUT, codecs, per-take settings)

## 2.8.2 -- 2026-10-24

- Mosaic shows live video only for the camera in live mode; the others stay in photo

## 2.8.1 -- 2026-10-23

- One sign-in for every tab (token in localStorage)

## 2.8.0 -- 2026-10-23

- Focus assistant works with the relay key; LIVE/PHOTO badge; flash by strip

## 2.7.0 -- 2026-10-23

- Flash per strip, focus assistant, live grid; numeric PIN field

## 2.6.14 -- 2026-10-23

- Common page header: health chip, session chip, quiet start-up icon when ready

## 2.6.13 -- 2026-10-22

- Side-bar pin only while the bar is open; Lights panel counts only the faults the service marks

## 2.6.12 -- 2026-10-22

- Pin on every side bar, thin scrollbars, one sign-in dialog

## 2.6.11 -- 2026-10-22

- Pin on every side bar, thin scrollbars everywhere

## 2.6.10 -- 2026-10-22

- Sign-in never opens by itself; keyboard only on touch

## 2.6.9 -- 2026-10-22

- Camera images that cannot load say why

## 2.6.8 -- 2026-10-22

- Sessions made clear: not-signed-in chip, sign-in on visitor 403, refusal toast

## 2.6.7 -- 2026-10-22

- Sign-in dialog focus and kiosk keyboard helper; Jog blocked touches explained

## 2.6.6 -- 2026-10-22

- Kiosk keyboard helper call, sign-in dialog font

## 2.6.5 -- 2026-10-22

- Jog and bars tell why an action is blocked and ask for the session; Jog loses the Machine pointer sections

## 2.6.4 -- 2026-10-22

- Sign-in dialog redesign and on-screen keyboard; single floating panel for power actions; risk bar on one line; Jog gear and scrollbar; side tabs transition

## 2.6.3 -- 2026-10-21

- PIN sign enters by itself when the PIN has the length that worked last time

## 2.6.2 -- 2026-10-21

- Video thumbnails: accept the legacy miniatura key

## 2.6.1 -- 2026-10-21

- Camera relay requests carry the identity; page routes in English

## 2.6.0 -- 2026-10-21

- Operator and technician views, full-width sheets on narrow screens, relay protocol check, shared load data instead of its own measuring

## 2.5.0 -- 2026-10-21

- English migration: texts through the catalog, no in-browser translator, interfaces per part

## 2.4.1 -- 2026-10-20

- English names: remaining values, ids, theme panels and the Vision backend keys (fixes a mismatch with the page)

## 2.4.0 -- 2026-10-20

- All the code, data keys and enum values are in English; stored data is converted by the one-off migration script

## 2.3.8 -- 2026-10-19

- Timelapse schedule date fields use the same field look as the other inputs

## 2.3.7 -- 2026-10-18

- Internal: local names in English (no visible change)

## 2.3.6 -- 2026-10-18

- Start-up entry is a chip in the page header

## 2.3.5 -- 2026-10-18

- Start-up strip of the Timelapses page spans the full width (the repaint no longer wipes its placement)

## 2.3.4 -- 2026-10-17

- Start-up strip on the Timelapses and captures page, under the header like the other pages

## 2.3.3 -- 2026-10-16

- Start-up card: rows for captures (folder with room, date and position on the photo) and timelapse (ffmpeg, clock of the Pi)

## 2.3.2 -- 2026-10-16

- Start-up strip with the same spacing as the other pages

## 2.3.1 -- 2026-10-16

- Start-up dialog: sans-serif font, dark scrollbars, and a card with a single ready row no longer repeats its name

## 2.3.0 -- 2026-10-16

- Start-up card is now a dialog opened from a strip on the page (one card per function, progress, step-by-step assistant), with a plain explanation for every row

## 2.2.14 -- 2026-10-16

- Start-up assistant (shared piece), Lights: the strip pin is chosen in Advanced (plain LED removed)

## 2.2.13 -- 2026-10-15

- Start-up card (shared piece): Printing assistant renamed so it no longer collides with the card

## 2.2.12 -- 2026-10-15

- Rebuilt with the shared start-up card piece

## 2.2.11 -- 2026-10-15

- Spanish texts with accents and enie

## 2.2.10 -- 2026-10-15

- Remove the keyboard workaround (kiosk.hide_keyboard): the ghost-tap fix is enough

## 2.2.9 -- 2026-10-15

- Closing a floating panel swallows the rest of the same tap so it cannot reach a text field underneath

## 2.2.8 -- 2026-10-14

- Hide every mention of another plugin when it is absent

## 2.2.7 -- 2026-10-14

- Cleanup: no more lookups of the old service Id (PiCustomCodes) or mentions of the removed custom G-codes

## 2.2.6 -- 2026-10-14

- Timelapses and captures: space between the header and the content

## 2.2.5 -- 2026-10-14

- Header like the other pages: same padding and no extra line under the title (the purpose is its tooltip)

## 2.2.4 -- 2026-10-14

- Side bar icons are 18 px like the bar of Vision

## 2.2.3 -- 2026-10-13

- The side bar is like the ones of Vision and the Work table: 190 px, 52 px folded with the double arrow in the middle, it folds by itself after choosing and opens only with the arrow (nothing floats over the page when the pointer passes by)

## 2.2.2 -- 2026-10-13

- The side bar has the double arrow (fold / open) like the bar of Vision, besides folding by itself after choosing

## 2.2.1 -- 2026-10-13

- The side bar has no pin: it is open at first, folds to the icons by itself when something is chosen and opens again over the page with the pointer or the focus

## 2.2.0 -- 2026-10-13

- Timelapses and captures page: Record / Videos / Captures / Settings as a side bar like Vision (pin or automatic)

## 2.1.1 -- 2026-10-13

- Files and macros written by the plugin are in English; bilingual risk texts

## 2.1.0 -- 2026-10-13

- Official localization completed; the Timelapses and captures page follows the common design line

## 2.0.0 -- 2026-10-13

- Needs WorkshopService 2.0: calls its central API (POST /machine/WorkshopService/api) instead of the custom codes M9003 / M9010, which are gone
- Camera relay, its service settings, the key of the day and hiding the keyboard through the API
- Includes the i18n helper fix of 1.x (the helper no longer clashes with local variables named tt)


## 1.16.0 -- 2026-10-13

- Official DWC localization and build pipeline

## 1.15.8 -- 2026-10-13

- Sidebar closed rail and settings; shared updates; English texts pending

## 1.15.7 -- 2026-10-12

- Camara sin ajustes de DWC: direccion propia con migracion unica; estado desde DWC y solo con la pagina a la vista; sin nombre de programa; dwcVersion 3.6

## 1.15.6 -- 2026-10-11

- El flash vuelve a como estaba al cerrar el visor

## 1.15.5 -- 2026-10-11

- Traducciones nuevas (barra de Vision, aviso del jog sin limites)

## 1.15.4 -- 2026-10-11

- Traducciones del detalle del PID

## 1.15.3 -- 2026-10-11

- Traducciones nuevas; el traductor tambien cubre Impresion 3D, Timelapses y Servicio de la Pi

## 1.15.2 -- 2026-10-11

- Declara la dependencia de WorkshopService

## 1.15.1 -- 2026-10-11

- La camara Principal guardada con el Id viejo vuelve a pasar por el relay y no pide direccion

## 1.15.0 -- 2026-10-11

- Carpetas en ingles bajo 0:/sys/workshop (datos, disenos, malla, cortar por partes); arreglos de la Mesa de trabajo

## 1.14.0 -- 2026-10-11

- Id nuevo en ingles (Workshop...) y guardado seguro ante cortes de luz

## 1.13.0 -- 2026-10-11

- Id nuevo en ingles (Workshop...) y guardado seguro ante cortes de luz

# TallerCamara -- historial de versiones

## 1.12.4 -- 2026-10-10

- Compatibilidad con los Id nuevos en ingles (busca el servicio por el Id nuevo o el viejo); sin cambiar ningun Id todavia

## 1.12.3 -- 2026-10-10

- Selector del tamano del titulo del timelapse

## 1.12.2 -- 2026-10-10

- Timelapses y capturas a todo el ancho, tarjetas sin huecos; traducciones

## 1.12.1 -- 2026-10-10

- Espacio para los videos: valores segun lo libre en la Pi, con aviso si el actual no entra

## 1.12.0 -- 2026-10-10

- Timelapse: programar inicio y fin, una foto por capa, fecha y hora en cada foto, suavizar cambios de luz, ultima foto en vivo; estilos de DESIGN.md en tema claro y oscuro

## 1.11.0 -- 2026-10-10

- Timelapse redisenado: pestanas Grabar, Videos, Capturas y Ajustes; ajustes agrupados con donde se guarda; iguales en el visor y en la pagina

## 1.10.0 -- 2026-10-10

- Aviso antes de borrar solos videos o fotos por los topes; casilla Conservar; plazo en los ajustes

## 1.9.1 -- 2026-10-10

- El mosaico ya no se cierra al instante en la pantalla tactil

## 1.9.0 -- 2026-10-10

- Orientacion por camara y pantalla (Auto con Vision), duracion maxima y espacio de videos, pagina Timelapses y capturas

## 1.8.0 -- 2026-10-10

- Clave del relay con la contrasena de DWC; espacio libre y lista de timelapses que se actualiza sola

## 1.7.0 -- 2026-10-10

- Timelapse a mano, varias camaras y armado del video

## 1.6.1 -- 2026-10-10

- La barra roja de riesgo activo y los carteles de confirmacion se ven tambien en pantalla completa

## 1.6.0 -- 2026-10-10

- Visor de camaras nuevo: zoom y desplazamiento, mosaico con todas las camaras, foto o video por camara, deteccion de ESP32 y flash al agregar, captura y galeria, timelapses con descarga e interruptor, estado y estadisticas en vivo. Estilo comun segun DESIGN.md (alto de botones, colores de la paleta, encabezados)

## 1.5.4 -- 2026-10-10

- Traducciones y enganche de Vision con el area de corte

## 1.5.3 -- 2026-10-10

- Los comandos de la pagina van por HTTP desde el primero (antes salian por G-code mientras cargaban los plugins) y reintentan ~15 s si el servicio se esta reiniciando

## 1.5.2 -- 2026-10-10

- Camara en vivo en el mapa de Zonas, pantalla completa y Hallar centro; estilo comun (colores de pantalla, pestanas como v-tabs, Offsets en un solo lugar)

## 1.5.1 -- 2026-10-10

- Registro de plugins: el modulo de advertencias ya no pisa window.__taller (ningun plugin JS arrancaba). Las calibraciones y ajustes guardados quedan anotados en Actividad

## 1.5.0 -- 2026-10-10

- Estandar de advertencias: lo que solo mueve pide doble toque ambar; lo que puede dañar (sondas, Z0, laser, malla, marcas) un toque y el cartel; soltar motores, cartel rojo con casilla y aviso de riesgo activo (barra roja y LEDs). Nombre visible del servicio: Servicio de la Pi

## 1.4.1 -- 2026-10-10

- Las paginas mandan sus comandos M9000/M9003/M9010 por HTTP al servicio de la Pi (sin la cola de la Duet); si el servicio no lo tiene, vuelven al G-code

## 1.4.0 -- 2026-10-10

- La camara Principal muestra y deja cambiar la camara que lee el relay de la Pi. Comandos M9003 en ingles; los nombres en español siguen como alias; traducciones al ingles completas

## 1.3.8 -- 2026-10-10

- Tema claro: el visor de camara sigue el tema claro de DWC

## 1.3.7 -- 2026-10-10

- Linea de diseno comun en el panel (colores, letra minima 10 px); avisos de riesgo: cartel Continuar/Cancelar antes de mover la maquina sola, usar la sonda, encender el laser, bajar a Z0, soltar o probar motores o reiniciar la placa

## 1.3.6 -- 2026-10-10

- Ajustes de la camara: el selector de resolucion ya no agrega una barra de desplazamiento horizontal

## 1.3.5 -- 2026-10-10

- Los avisos de camara ya no hablan de la webcam de DWC (no se usa): dicen 'sin direccion de camara'

## 1.3.4 -- 2026-10-10

- Los avisos de DWC (errores, M291) ya no quedan detras de los paneles ni del mapa de Zonas

## 1.3.3 -- 2026-10-10

- Tira de LEDs: el texto dice si muestra los LEDs de estado o toda la tira (cuando la iluminacion tiene el control)

## 1.3.2 -- 2026-10-10

- Cerrar el visor cierra tambien la hoja Camaras del engranaje; traducciones al ingles de la lista de camaras

## 1.3.1 -- 2026-10-10

- Ajustes de imagen solo con una ESP32-CAM elegida

## 1.3.0 -- 2026-10-10

- Varias camaras de vigilancia: cualquier stream MJPEG (ESP32-CAM, camara IP...), lista para todas las pantallas y selector en el visor para elegir cual ver

## 1.2.5 -- 2026-10-09

- Resoluciones: tabla de framesize corregida para el firmware nuevo (VGA daba 400x296); perfiles en SVGA; hasta SXGA

## 1.2.4 -- 2026-10-09

- Tabla de resoluciones del firmware nuevo de la ESP32-CAM corregida (la vieja estaba corrida 2 lugares) y perfil Equilibrado a 800x600

## 1.2.3 -- 2026-10-09

- LEDs de estado: se ven tambien con el automatico apagado (color de la iluminacion o apagados); barra contraida vuelve al circulo

## 1.2.2 -- 2026-10-09

- LEDs de estado: helper compartido actualizado (mismo que Barra/Jog)

## 1.2.1 -- 2026-10-09

- Reintento automatico de M9003 mientras PiCustomCodes se reinicia

## 1.2.0 -- 2026-10-09

- Engranaje de ajustes: perfiles (Equilibrado, Durante el corte, Detalle, Poca luz, Fluido), sugerido segun la maquina, ajuste fino, guardado en sys/taller-camara.json y re-aplicado al abrir

## 1.1.12 -- 2026-10-09

- Ocultar el teclado en pantalla solo desde el kiosko (localhost)

## 1.1.11 -- 2026-10-09

- Traduccion: pagina Salud de la Pi

## 1.1.10 -- 2026-10-09

- Ya no vuelve a activar la webcam en Ajustes de DWC

## 1.1.9 -- 2026-10-09

- Menos lecturas de estado a DSF (titubeo del jog con la Pi cargada)

## 1.1.8 -- 2026-10-08

- Traduccion: tarjeta Zona activa, mesh y textos del backend

## 1.1.7 -- 2026-10-08

- Traduccion: paginas Vue (deteccion de ruta) y version compartida del traductor

## 1.1.6 -- 2026-10-08

- Traduccion: textos de las paginas Vue con saltos de linea

## 1.1.5 -- 2026-10-08

- Traduccion: paginas Consumo/Motores/Actividad/Servicios y menu lateral

## 1.1.4 -- 2026-10-08

- Traduccion: textos armados por partes se traducen completos

## 1.1.3 -- 2026-10-08

- Traduccion al ingles (sigue el idioma de DWC)

## 1.1.2 -- 2026-10-08

- Nombre visible en ingles

## 1.1.1 -- 2026-10-08

- Funciona aunque la webcam este deshabilitada en DWC (usa el relay de la Pi)

## 1.1.0 -- 2026-10-08

- Boton flotante propio si no esta instalada la barra lateral

