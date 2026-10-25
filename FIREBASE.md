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
   - `jprealstate.com`
   - `www.jprealstate.com`
   - `quasarworksco.github.io` (dirección anterior; redirige al dominio)

3. **Inicio de sesión con correo** (ya está activo)
   *Authentication* → *Sign-in method* → **Email/Password** = Enabled.

4. **Cuenta principal** (ya está creada)
   `jprealstatefl@gmail.com` existe en *Authentication → Users*. Es administradora
   siempre por las reglas. Se recomienda cambiar la contraseña en
   **Usuarios → Cambiar mi contraseña**, ya que se compartió por chat.

## Usuarios

Panel → **Usuarios**:

- **Mi cuenta** (todas las personas): cambiar la propia contraseña (pide la actual)
  o recibir un correo para restablecerla.
- **Equipo** (solo Admin): agregar usuarios con nombre, correo, contraseña inicial y
  rol (*Admin* o *Agente*), cambiar el rol, desactivar el acceso y enviar a cualquiera
  un correo para restablecer su contraseña. La cuenta principal siempre es Admin.
- Si la persona ya tenía cuenta, se deja la contraseña vacía y solo se habilita su
  acceso; también puede crear la suya con **“Crear mi acceso”** en `/admin/`.

## Colecciones

| Colección  | Qué guarda | Quién lee | Quién escribe |
|------------|------------|-----------|---------------|
| `leads`    | Contactos del embudo (etapa, origen, notas, valor, historial) | Equipo | Público solo **crea** (validado); equipo edita |
| `citas`    | Citas del calendario | Equipo | Público solo **crea** (estado “solicitada”); equipo edita |
| `ocupados` | Horarios tomados `AAAA-MM-DDTHH:MM` (sin datos personales) | Todos | Se crean al reservar; no se pueden pisar (evita doble reserva) |
| `ajustes`  | `agenda`: horario de atención | Todos | Admin |
| `access`   | Permisos por correo `{ role, active }` | Equipo | Admin |

## Enlaces

- Panel: https://jprealstate.com/admin/
- Formulario para anuncios: https://jprealstate.com/registro/
  (los enlaces por canal con UTM se copian desde **Panel → Enlaces**)
- Demo con datos de ejemplo (no toca Firebase):
  https://jprealstate.com/admin/?local=1&demo=1

## Modo local

Con `firebase.enabled: false` en `assets/js/config.js`, o abriendo cualquier página
con `?local=1`, todo se guarda solo en el navegador (útil para pruebas y demos).
