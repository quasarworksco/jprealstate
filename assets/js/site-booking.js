/* =========================================================
   Agenda en el formulario del sitio: muestra el selector de
   día y hora y guarda la cita en el CRM (Firestore).
   Se monta cuando la sección de contacto se acerca, para no
   cargar Firebase al abrir la página.
   ========================================================= */
import * as store from "./store.js";
import { mountBooking, hora12, fechaLarga } from "./booking.js";

const el = document.querySelector("#cita-form [data-booking]");
let booking = null;
let mounting = null;
const mount = () => (mounting ??= mountBooking(el).then((b) => (booking = b)));

if (el) {
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    mount();
  }, { rootMargin: "900px 0px" }).observe(el);
}

window.JPBooking = {
  value: () => booking?.value() || null,
  label: (s) => `${fechaLarga(s.fecha)} · ${hora12(s.hora)}`,
  save: (data) => store.publicCita(data),
  isTaken: (err) => err instanceof store.SlotTakenError,
  refresh: () => booking?.refresh(),
  reset: () => booking?.reset(),
};
