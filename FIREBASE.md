# Firebase — JP Real Estate

Proyecto: **jprealestate-ebc82** · Cuenta principal del panel: **jprealstatefl@gmail.com**

El panel admin (`/admin/`), el formulario para anuncios (`/registro/`) y la agenda del
sitio guardan todo en Firestore. La configuración web está en `assets/js/config.js`
(es pública por diseño: la seguridad la dan las reglas).

## Pasos en la consola de Firebase (una sola vez)

1. **Reglas de Firestore**
   Firebase Console → *Firestore Database* → pestaña **Reglas** → borra lo que hay,
   pega todo el contenido de [`firestore.rules`](firestore.rules) → **Publicar**.

2. **Dominios autorizados para iniciar sesión**
   *Authentication* → *Settings* → **Authorized domains** → **Add domain**:
   - `quasarworksco.github.io`
   - `jprealstate.com` (cuando el sitio pase al dominio propio)

3. **Inicio de sesión con correo** (ya está activo)
   *Authentication* → *Sign-in method* → **Email/Password** = Enabled.

4. **Cuenta principal** (ya está creada)
   `jprealstatefl@gmail.com` existe en *Authentication → Users*. Es administradora
   siempre por las reglas. Se recomienda cambiar la contraseña desde
   “Olvidé mi contraseña” en `/admin/`, ya que se compartió por chat.

## Equipo

Desde el panel → **Ajustes → Equipo** se habilita el correo de cada persona
(rol *Admin* o *Agente*). Luego esa persona entra a `/admin/`, pulsa
**“Crear mi acceso”** y crea su contraseña.

## Colecciones

| Colección  | Qué guarda | Quién lee | Quién escribe |
|------------|------------|-----------|---------------|
| `leads`    | Contactos del embudo (etapa, origen, notas, valor, historial) | Equipo | Público solo **crea** (validado); equipo edita |
| `citas`    | Citas del calendario | Equipo | Público solo **crea** (estado “solicitada”); equipo edita |
| `ocupados` | Horarios tomados `AAAA-MM-DDTHH:MM` (sin datos personales) | Todos | Se crean al reservar; no se pueden pisar (evita doble reserva) |
| `ajustes`  | `agenda`: horario de atención | Todos | Admin |
| `access`   | Permisos por correo `{ role, active }` | Equipo | Admin |

## Enlaces

- Panel: https://quasarworksco.github.io/jprealstate/admin/
- Formulario para anuncios: https://quasarworksco.github.io/jprealstate/registro/
  (los enlaces por canal con UTM se copian desde **Panel → Enlaces**)
- Demo con datos de ejemplo (no toca Firebase):
  https://quasarworksco.github.io/jprealstate/admin/?local=1&demo=1

## Modo local

Con `firebase.enabled: false` en `assets/js/config.js`, o abriendo cualquier página
con `?local=1`, todo se guarda solo en el navegador (útil para pruebas y demos).
