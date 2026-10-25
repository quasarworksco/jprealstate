/* =========================================================
   Selector de día y hora — usa el horario de atención y los
   horarios ya ocupados para mostrar solo lo disponible.
   ========================================================= */
import { getAgenda, getTakenSlots, slotsForDay, slotId, ymd } from "./store.js";

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

export const hora12 = (h) => {
  const [hh, mm] = h.split(":").map(Number);
  return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
};
export const fechaLarga = (fecha) => {
  const d = new Date(`${fecha}T12:00:00`);
  return `${DAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
};

export async function mountBooking(root, { onChange } = {}) {
  root.classList.add("bk");
  root.innerHTML = `<p class="bk__loading">Cargando horarios disponibles…</p>`;
  let agenda, taken;
  try {
    [agenda, taken] = await Promise.all([getAgenda(), getTakenSlots().catch(() => new Set())]);
  } catch (e) {
    root.innerHTML = `<p class="bk__loading">No pudimos cargar la agenda. Escríbenos por WhatsApp y te ayudamos.</p>`;
    return { value: () => null, refresh: () => {} };
  }
  let sel = { fecha: null, hora: null };

  const build = () => {
    const now = Date.now() + agenda.anticipacionHoras * 3600e3;
    const days = [];
    const start = new Date(); start.setHours(0, 0, 0, 0);
    for (let i = 0; i <= agenda.diasAdelante; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const fecha = ymd(d);
      const slots = slotsForDay(agenda, d).filter((h) => !taken.has(slotId(fecha, h)) && +new Date(`${fecha}T${h}:00`) > now);
      days.push({ d, fecha, slots });
    }
    return days;
  };

  const render = () => {
    const days = build();
    if (!sel.fecha || !days.find((x) => x.fecha === sel.fecha && x.slots.length)) {
      sel.fecha = days.find((x) => x.slots.length)?.fecha || null;
      sel.hora = null;
    }
    const day = days.find((x) => x.fecha === sel.fecha);
    if (day && sel.hora && !day.slots.includes(sel.hora)) sel.hora = null;

    const prevScroll = root.querySelector(".bk__days")?.scrollLeft;
    root.innerHTML = `
      <div class="bk__head"><span>1. Elige el día</span>
        <span class="bk__nav"><button type="button" data-scroll="-1" aria-label="Días anteriores">‹</button><button type="button" data-scroll="1" aria-label="Más días">›</button></span>
      </div>
      <div class="bk__days" role="radiogroup" aria-label="Día">
        ${days.map((x) => `<button type="button" role="radio" class="bk__day${x.fecha === sel.fecha ? " is-on" : ""}" data-fecha="${x.fecha}" aria-checked="${x.fecha === sel.fecha}" ${x.slots.length ? "" : "disabled"}>
            <small>${DAYS[x.d.getDay()]}</small><b>${x.d.getDate()}</b><small>${MONTHS[x.d.getMonth()]}</small></button>`).join("")}
      </div>
      <div class="bk__head"><span>2. Elige la hora</span>${day ? `<span class="bk__when">${fechaLarga(day.fecha)}</span>` : ""}</div>
      <div class="bk__slots" role="radiogroup" aria-label="Hora">
        ${day && day.slots.length
          ? day.slots.map((h) => `<button type="button" role="radio" class="bk__slot${h === sel.hora ? " is-on" : ""}" data-hora="${h}" aria-checked="${h === sel.hora}">${hora12(h)}</button>`).join("")
          : `<p class="bk__empty">No hay horarios disponibles en los próximos días. Escríbenos y buscamos un espacio.</p>`}
      </div>`;
    const strip = root.querySelector(".bk__days");
    const on = strip.querySelector(".is-on");
    if (prevScroll != null) strip.scrollLeft = prevScroll;
    else if (on) strip.scrollLeft = on.offsetLeft - strip.clientWidth / 2 + on.clientWidth / 2;
    root.querySelectorAll("[data-scroll]").forEach((b) => b.addEventListener("click", () => strip.scrollBy({ left: +b.dataset.scroll * strip.clientWidth * 0.8, behavior: "smooth" })));
    root.querySelectorAll(".bk__day").forEach((b) => b.addEventListener("click", () => { sel = { fecha: b.dataset.fecha, hora: null }; render(); onChange?.(null); }));
    root.querySelectorAll(".bk__slot").forEach((b) => b.addEventListener("click", () => { sel.hora = b.dataset.hora; render(); onChange?.({ ...sel }); }));
  };
  render();

  return {
    value: () => (sel.fecha && sel.hora ? { ...sel } : null),
    async refresh() { taken = await getTakenSlots().catch(() => taken); render(); },
    reset() { sel = { fecha: null, hora: null }; render(); },
  };
}
