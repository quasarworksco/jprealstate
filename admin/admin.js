/* =========================================================
   JP Real Estate — Panel admin
   Resumen · Calendario · Embudo · Contactos · Enlaces · Ajustes
   ========================================================= */
import * as store from "../assets/js/store.js";
import { hora12, fechaLarga } from "../assets/js/booking.js";

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CFG = window.JP_CONFIG || {};
const WA = CFG.whatsapp || "13219612892";
const qs = new URLSearchParams(location.search);

/* ---------- catálogos ---------- */
const STAGES = [
  { id: "nuevo", label: "Nuevo", next: "Contactar en menos de 1 hora", weight: 10 },
  { id: "contactado", label: "Contactado", next: "Proponer una llamada o visita", weight: 25 },
  { id: "cita", label: "Cita agendada", next: "Confirmar la cita el día anterior", weight: 45 },
  { id: "visita", label: "Visita / presentación", next: "Enviar opciones y resolver dudas", weight: 65 },
  { id: "negociacion", label: "Negociación", next: "Cerrar oferta y documentos", weight: 85 },
  { id: "cerrado", label: "Cerrado", next: "Pedir reseña y referidos", weight: 100 },
  { id: "perdido", label: "Perdido", next: "Retomar en 60 días", weight: 0 },
];
const STAGE = Object.fromEntries(STAGES.map((s, i) => [s.id, { ...s, i }]));
const OPEN = ["nuevo", "contactado", "cita", "visita", "negociacion"];
const SOURCES = {
  instagram: { label: "Instagram", short: "IG" },
  facebook: { label: "Facebook", short: "FB" },
  google: { label: "Google Ads", short: "G" },
  tiktok: { label: "TikTok", short: "TT" },
  whatsapp: { label: "WhatsApp", short: "WA" },
  sitio: { label: "Sitio web", short: "WEB" },
  referido: { label: "Referido", short: "REF" },
  otro: { label: "Otro", short: "•" },
};
const ESTADOS = { solicitada: "Por confirmar", confirmada: "Confirmada", completada: "Completada", cancelada: "Cancelada", no_asistio: "No asistió" };
const ACTIVE = ["solicitada", "confirmada"];
const TIPOS = ["Llamada 1 a 1", "Visita a propiedad", "Reunión presencial", "Videollamada", "Cita (sitio web)"];
const INTERESES = ["Comprar", "Vender", "Alquilar", "Invertir", "Compra", "Venta", "Alquiler"];
const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DAYMS = 864e5;

/* ---------- estado ---------- */
const today = () => store.ymd(new Date());
const S = {
  user: null, access: null,
  leads: [], citas: [], team: [],
  agenda: { ...store.AGENDA_DEFAULT },
  view: "resumen",
  cal: { y: new Date().getFullYear(), m: new Date().getMonth(), sel: today() },
  f: { q: "", origen: "", interes: "", etapa: "", soloAlertas: false },
  campaign: "",
  drawerLead: null,
  started: false,
};

/* ---------- utilidades ---------- */
const ms = store.toMillis;
const initials = (n) => (n || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("") || "?";
const digits = (t) => { const d = String(t || "").replace(/\D/g, ""); return d.length === 10 ? "1" + d : d; };
const waLink = (phone, text) => `https://wa.me/${digits(phone)}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
const money = (n) => (n ? "$" + Math.round(n).toLocaleString("en-US") : "$0");
const moneyShort = (n) => (n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}k` : money(n));
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const rel = (t) => {
  if (!t) return "";
  const d = Date.now() - t;
  if (d < 6e4) return "ahora";
  if (d < 36e5) return `hace ${Math.round(d / 6e4)} min`;
  if (d < DAYMS) return `hace ${Math.round(d / 36e5)} h`;
  if (d < 30 * DAYMS) return `hace ${Math.round(d / DAYMS)} d`;
  const x = new Date(t);
  return `${x.getDate()} ${MON[x.getMonth()]}`;
};
const dur = (d) => (d < 36e5 ? `${Math.max(1, Math.round(d / 6e4))} min` : d < DAYMS ? `${Math.round(d / 36e5)} h` : `${Math.round(d / DAYMS)} d`);
const shortDate = (f) => { const d = new Date(`${f}T12:00:00`); return `${["dom", "lun", "mar", "mié", "jue", "vie", "sáb"][d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}`; };
const citaTime = (c) => +new Date(`${c.fecha}T${c.hora || "00:00"}:00`);
const leadById = (id) => S.leads.find((l) => l.id === id);
const citasOf = (lead) => S.citas.filter((c) => c.leadId === lead.id || (!c.leadId && digits(c.telefono) && digits(c.telefono) === digits(lead.telefono)));
const nextCita = (lead) => citasOf(lead).filter((c) => ACTIVE.includes(c.estado) && citaTime(c) >= Date.now() - 36e5).sort((a, b) => citaTime(a) - citaTime(b))[0];
const stageSince = (l) => l.etapaAt || ms(l.createdAt);
const valorOf = (l) => +l.valor || 0;
const who = () => S.access?.email || "";

/** Temperatura del contacto (0–100) según etapa, cita, datos y actividad reciente. */
function score(l) {
  if (l.etapa === "perdido") return 0;
  if (l.etapa === "cerrado") return 100;
  let s = STAGE[l.etapa]?.weight ?? 10;
  if (nextCita(l)) s += 15;
  if (l.presupuesto) s += 6;
  if (l.email) s += 3;
  if (l.accion === "llamada") s += 6;
  const idle = Date.now() - Math.max(ms(l.updatedAt), stageSince(l));
  if (idle > 14 * DAYMS) s -= 25; else if (idle > 5 * DAYMS) s -= 10;
  return Math.max(1, Math.min(99, s));
}
const temp = (sc) => (sc >= 60 ? { k: "hot", t: "Caliente" } : sc >= 35 ? { k: "warm", t: "Tibio" } : { k: "cold", t: "Frío" });
/** Alerta: contacto nuevo sin respuesta por más de 2 h, o abierto sin movimiento en 7 días. */
function alertOf(l) {
  const since = Date.now() - stageSince(l);
  if (l.etapa === "nuevo" && since > 2 * 36e5) return `Sin contactar ${dur(since)}`;
  if (OPEN.includes(l.etapa) && l.etapa !== "nuevo" && Date.now() - Math.max(ms(l.updatedAt), stageSince(l)) > 7 * DAYMS && !nextCita(l)) return `Sin movimiento ${dur(Date.now() - Math.max(ms(l.updatedAt), stageSince(l)))}`;
  return "";
}

/* ---------- toast ---------- */
let toastT;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("is-on");
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove("is-on"), 2600);
}
const fail = (e) => { console.error(e); toast(e?.code === "permission-denied" ? "No tienes permiso para esta acción." : "No se pudo guardar. Revisa tu conexión."); };

/* =========================================================
   AUTH
   ========================================================= */
const auth = $("#auth");
const app = $("#app");
let authMode = "login";

function showAuth(noAccessEmail) {
  app.hidden = true;
  auth.hidden = false;
  $("#login-form").hidden = !!noAccessEmail;
  $(".auth__links").hidden = !!noAccessEmail;
  $("[data-noaccess]").hidden = !noAccessEmail;
  if (noAccessEmail) $("[data-noaccess-email]").textContent = noAccessEmail;
}
$("[data-auth-mode]").addEventListener("click", () => {
  authMode = authMode === "login" ? "register" : "login";
  $("[data-auth-submit]").textContent = authMode === "login" ? "Entrar" : "Crear acceso";
  $("[data-auth-mode]").textContent = authMode === "login" ? "Crear mi acceso" : "Ya tengo acceso";
  $("[data-auth-sub]").textContent = authMode === "login" ? "Inicia sesión para ver la agenda y el embudo de ventas." : "Crea tu contraseña. La administración debe habilitar tu correo.";
  $("#login-form").pass.autocomplete = authMode === "login" ? "current-password" : "new-password";
});
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target, msg = $("[data-auth-msg]");
  msg.className = "auth__msg"; msg.textContent = "";
  if (!f.email.value || f.pass.value.length < 6) { msg.textContent = "Escribe tu correo y una contraseña de al menos 6 caracteres."; return; }
  const btn = $("[data-auth-submit]"); btn.disabled = true;
  try {
    if (authMode === "login") await store.login(f.email.value, f.pass.value);
    else await store.register(f.email.value, f.pass.value);
  } catch (err) {
    const m = {
      "auth/invalid-credential": "Correo o contraseña incorrectos.", "auth/wrong-password": "Correo o contraseña incorrectos.",
      "auth/user-not-found": "No existe una cuenta con ese correo.", "auth/email-already-in-use": "Ese correo ya tiene cuenta: inicia sesión.",
      "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.", "auth/invalid-email": "El correo no es válido.",
    };
    msg.textContent = m[err.code] || "No se pudo iniciar sesión.";
  } finally { btn.disabled = false; }
});
$("[data-auth-reset]").addEventListener("click", async () => {
  const f = $("#login-form"), msg = $("[data-auth-msg]");
  if (!f.email.value) { msg.className = "auth__msg"; msg.textContent = "Escribe tu correo y vuelve a pulsar “Olvidé mi contraseña”."; return; }
  try { await store.resetPassword(f.email.value); msg.className = "auth__msg is-ok"; msg.textContent = "Te enviamos un correo para crear una nueva contraseña."; }
  catch (e) { msg.className = "auth__msg"; msg.textContent = "No se pudo enviar el correo."; }
});
$$("[data-logout]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); store.logout().then(() => location.reload()); }));
$(".side__user").addEventListener("click", () => (location.hash = "usuarios"));

store.onAuth(async (user) => {
  if (!user) { showAuth(); return; }
  const access = await store.getAccess(user);
  if (!access) { showAuth(user.email); return; }
  S.user = user; S.access = access;
  start();
});

/* =========================================================
   APP
   ========================================================= */
const TITLES = { resumen: "Resumen", calendario: "Calendario", embudo: "Embudo de ventas", contactos: "Contactos", enlaces: "Enlaces para anuncios", usuarios: "Usuarios", ajustes: "Ajustes" };

async function start() {
  if (S.started) return;
  S.started = true;
  auth.hidden = true;
  app.hidden = false;
  const email = S.access.email === "modo-local" ? "Modo local" : S.access.email;
  $("[data-user-email]").textContent = email;
  $("[data-user-role]").textContent = S.access.owner ? "Cuenta principal" : S.access.role;
  $("[data-user-initial]").textContent = email[0] || "J";
  const t = new Date();
  $("[data-today]").textContent = `${cap(fechaLarga(today()))} de ${t.getFullYear()}`;
  if (store.mode === "local") $("[data-localbar]").hidden = false;

  S.agenda = await store.getAgenda();
  let first = 0;
  const ready = () => { if (++first >= 2) maybeDemo(); };
  store.watch("leads", (rows) => { S.leads = rows; refresh(); ready(); }, fail);
  store.watch("citas", (rows) => { S.citas = rows; refresh(); ready(); }, fail);
  if (S.access.role === "admin") store.watch("access", (rows) => { S.team = rows; if (S.view === "usuarios") render(false); });

  addEventListener("hashchange", route);
  route();
}

function route() {
  const v = location.hash.slice(1);
  S.view = TITLES[v] ? v : "resumen";
  render(true);
}

/** Vuelve a pintar la vista actual sin perder el foco ni lo escrito. */
function refresh() {
  render(false);
  if ($("#drawer").open && S.drawerLead) {
    const l = leadById(S.drawerLead);
    if (l) openLead(l, true); else $("#drawer").close();
  }
}

function render(animate) {
  $$(".side__nav a").forEach((a) => a.classList.toggle("is-on", a.dataset.view === S.view));
  $("[data-title]").textContent = TITLES[S.view];
  document.title = `${TITLES[S.view]} | Panel JP Real Estate`;
  // badges
  const pend = S.citas.filter((c) => c.estado === "solicitada" && c.fecha >= today()).length;
  const alerts = S.leads.filter((l) => alertOf(l)).length;
  const bc = $('[data-badge="citas"]'), bl = $('[data-badge="leads"]');
  bc.hidden = !pend; bc.textContent = pend;
  bl.hidden = !alerts; bl.textContent = alerts;

  const view = $("#view");
  const active = document.activeElement;
  const focusId = active && view.contains(active) ? active.id : null;
  const sel = focusId && "selectionStart" in active ? [active.selectionStart, active.selectionEnd] : null;
  const scrollers = $$("[data-keep-scroll]", view).map((el) => [el.dataset.keepScroll, el.scrollLeft, el.scrollTop]);

  view.innerHTML = VIEWS[S.view]();
  if (animate) { view.style.animation = "none"; void view.offsetWidth; view.style.animation = ""; }
  BIND[S.view]?.(view);

  scrollers.forEach(([k, l, t]) => { const el = $(`[data-keep-scroll="${k}"]`, view); if (el) { el.scrollLeft = l; el.scrollTop = t; } });
  if (focusId) { const el = document.getElementById(focusId); if (el) { el.focus(); if (sel && el.setSelectionRange) try { el.setSelectionRange(...sel); } catch (e) {} } }
  requestAnimationFrame(() => $$("[data-w]", view).forEach((el) => (el.style.width = el.dataset.w)));
}

/* =========================================================
   VISTAS
   ========================================================= */
const VIEWS = {};
const BIND = {};

/* ---------- componentes ---------- */
const srcTag = (o) => `<span class="tag">${esc(SOURCES[o]?.label || "Otro")}</span>`;
const pill = (estado) => `<span class="pill pill--${esc(estado)}">${esc(ESTADOS[estado] || estado)}</span>`;
const tempBadge = (l) => { const sc = score(l); const t = temp(sc); return `<span class="temp temp--${t.k}" title="Temperatura ${sc}/100">${t.t}</span>`; };
const empty = (t) => `<div class="empty">${t}</div>`;

/** Embudo visual con la conversión entre etapas. */
function funnelSVG(leads, big = false) {
  const steps = STAGES.filter((s) => s.id !== "perdido");
  const reached = steps.map((s, i) => leads.filter((l) => (l.etapa === "perdido" ? i === 0 : (STAGE[l.etapa]?.i ?? 0) >= i)).length);
  const top = reached[0] || 1;
  const value = steps.map((s) => leads.filter((l) => l.etapa === s.id).reduce((a, l) => a + valorOf(l), 0));
  return `<div class="fx${big ? " fx--big" : ""}">
    ${steps.map((s, i) => {
      const w = Math.max(22, (reached[i] / top) * 100);
      const conv = i === 0 ? 100 : reached[i - 1] ? Math.round((reached[i] / reached[i - 1]) * 100) : 0;
      return `<div class="fx__row">
        <div class="fx__label"><b>${esc(s.label)}</b><small>${i === 0 ? "Entraron al embudo" : `${conv}% avanzó desde la etapa anterior`}</small></div>
        <div class="fx__track"><div class="fx__bar fx__bar--${i}" data-w="${w}%"><b>${reached[i]}</b>${value[i] ? `<span>${moneyShort(value[i])}</span>` : ""}</div></div>
        <div class="fx__pct">${Math.round((reached[i] / top) * 100)}%</div>
      </div>`;
    }).join("")}
  </div>`;
}

/* ---------- RESUMEN ---------- */
VIEWS.resumen = () => {
  const now = Date.now(), t0 = today(), in7 = store.ymd(new Date(now + 7 * DAYMS));
  const L = S.leads;
  const nuevos7 = L.filter((l) => ms(l.createdAt) > now - 7 * DAYMS).length;
  const nuevosPrev = L.filter((l) => ms(l.createdAt) <= now - 7 * DAYMS && ms(l.createdAt) > now - 14 * DAYMS).length;
  const porConfirmar = S.citas.filter((c) => c.estado === "solicitada" && c.fecha >= t0).length;
  const proximas = S.citas.filter((c) => ACTIVE.includes(c.estado) && c.fecha >= t0 && c.fecha <= in7).sort((a, b) => citaTime(a) - citaTime(b));
  const cerrados = L.filter((l) => l.etapa === "cerrado");
  const tasa = L.length ? Math.round((cerrados.length / L.length) * 100) : 0;
  const pipeline = L.filter((l) => OPEN.includes(l.etapa)).reduce((a, l) => a + valorOf(l), 0);
  const alerts = L.filter((l) => alertOf(l));
  const by = {};
  L.filter((l) => ms(l.createdAt) > now - 30 * DAYMS).forEach((l) => { const k = SOURCES[l.origen] ? l.origen : "otro"; by[k] = (by[k] || 0) + 1; });
  const srcs = Object.entries(by).sort((a, b) => b[1] - a[1]);
  const maxSrc = Math.max(1, ...srcs.map((s) => s[1]));
  const delta = nuevos7 - nuevosPrev;

  return `
  <div class="kpis">
    <div class="card kpi kpi--dark"><small>Valor en el embudo</small><strong>${moneyShort(pipeline)}</strong><span>${L.filter((l) => OPEN.includes(l.etapa)).length} oportunidades abiertas</span></div>
    <div class="card kpi"><small>Contactos nuevos · 7 días</small><strong>${nuevos7}</strong><span class="${delta >= 0 ? "up" : "down"}">${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta)} vs. semana anterior</span></div>
    <div class="card kpi"><small>Citas próximas · 7 días</small><strong>${proximas.length}</strong><span>${porConfirmar} por confirmar</span></div>
    <div class="card kpi"><small>Tasa de cierre</small><strong>${tasa}%</strong><span>${cerrados.length} cerrados · ${moneyShort(cerrados.reduce((a, l) => a + valorOf(l), 0))}</span></div>
  </div>
  ${alerts.length ? `<a class="alertbar" href="#embudo" data-alerts><span class="alertbar__dot"></span><b>${alerts.length} ${alerts.length === 1 ? "contacto necesita" : "contactos necesitan"} atención</b><span>${esc(alerts.slice(0, 3).map((l) => `${l.nombre} (${alertOf(l).toLowerCase()})`).join(" · "))}</span><span class="alertbar__go">Ver →</span></a>` : ""}
  <div class="dash">
    <div class="card">
      <div class="card__head"><h2>Embudo de ventas</h2><a class="lnk" href="#embudo">Abrir tablero →</a></div>
      ${L.length ? funnelSVG(L) : empty("Aún no hay contactos. Comparte tu enlace de anuncios para empezar.")}
    </div>
    <div class="stack">
      <div class="card">
        <div class="card__head"><h2>Próximas citas</h2><a class="lnk" href="#calendario">Calendario →</a></div>
        <div class="list">${proximas.slice(0, 6).map((c) => {
          const d = new Date(`${c.fecha}T12:00:00`);
          return `<div class="li" data-cita="${c.id}"><div class="li__date"><b>${d.getDate()}</b><small>${MON[d.getMonth()]}</small></div><div class="li__main"><b>${esc(c.nombre)}</b><small>${hora12(c.hora)} · ${esc(c.tipo || "Cita")}</small></div>${pill(c.estado)}</div>`;
        }).join("") || empty("No hay citas en los próximos 7 días.")}</div>
      </div>
      <div class="card">
        <div class="card__head"><h2>Origen de contactos · 30 días</h2><a class="lnk" href="#enlaces">Enlaces →</a></div>
        <div class="bars">${srcs.map(([k, n]) => `<div class="bar"><span>${esc(SOURCES[k].label)}</span><div class="bar__track"><div class="bar__fill" data-w="${(n / maxSrc) * 100}%"></div></div><b>${n}</b></div>`).join("") || empty("Sin datos todavía.")}</div>
      </div>
    </div>
  </div>
  <div class="card" style="margin-top:14px">
    <div class="card__head"><h2>Contactos recientes</h2><a class="lnk" href="#contactos">Ver todos →</a></div>
    <div class="list">${L.slice(0, 6).map((l) => `<div class="li" data-lead="${l.id}"><span class="av">${esc(initials(l.nombre))}</span><div class="li__main"><b>${esc(l.nombre)}</b><small>${esc(l.interes || "—")} · ${esc(SOURCES[l.origen]?.label || "Otro")} · ${rel(ms(l.createdAt))}</small></div><span class="stg">${esc(STAGE[l.etapa]?.label || l.etapa)}</span></div>`).join("") || empty("Sin contactos todavía.")}</div>
  </div>`;
};
BIND.resumen = (v) => {
  $$("[data-cita]", v).forEach((el) => el.addEventListener("click", () => openCita(S.citas.find((c) => c.id === el.dataset.cita))));
  $$("[data-lead]", v).forEach((el) => el.addEventListener("click", () => openLead(leadById(el.dataset.lead))));
  $("[data-alerts]", v)?.addEventListener("click", () => { S.f.soloAlertas = true; });
};

/* ---------- CALENDARIO ---------- */
VIEWS.calendario = () => {
  const { y, m, sel } = S.cal;
  const first = new Date(y, m, 1);
  const startOffset = (first.getDay() + 6) % 7; // lunes primero
  const start = new Date(y, m, 1 - startOffset);
  const t0 = today();
  const byDay = {};
  S.citas.forEach((c) => (byDay[c.fecha] ||= []).push(c));
  Object.values(byDay).forEach((a) => a.sort((p, q) => (p.hora > q.hora ? 1 : -1)));
  const pending = S.citas.filter((c) => c.estado === "solicitada" && c.fecha >= t0).sort((a, b) => citaTime(a) - citaTime(b));

  let cells = "";
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const f = store.ymd(d);
    const list = byDay[f] || [];
    const closed = !S.agenda.dias.includes(d.getDay());
    cells += `<div class="cal__day${d.getMonth() !== m ? " is-out" : ""}${f === t0 ? " is-today" : ""}${f === sel ? " is-sel" : ""}${closed ? " is-closed" : ""}" data-day="${f}">
      <span class="cal__num">${d.getDate()}</span>
      ${list.slice(0, 3).map((c) => `<span class="ev ev--${esc(c.estado)}" title="${esc(`${hora12(c.hora)} · ${c.nombre}`)}"><b>${hora12(c.hora).replace(" ", "").toLowerCase()}</b> ${esc(c.nombre.split(" ")[0])}</span>`).join("")}
      ${list.length > 3 ? `<span class="more">+${list.length - 3} más</span>` : ""}
    </div>`;
    if (i === 34) { const nx = new Date(start); nx.setDate(start.getDate() + 35); if (nx.getMonth() !== m) break; }
  }

  // panel del día
  const sd = new Date(`${sel}T12:00:00`);
  const dayCitas = byDay[sel] || [];
  const slots = store.slotsForDay(S.agenda, sd);
  const times = [...new Set([...slots, ...dayCitas.map((c) => c.hora)])].sort();
  const busy = Object.fromEntries(dayCitas.filter((c) => !["cancelada", "no_asistio"].includes(c.estado)).map((c) => [c.hora, c]));
  const past = (h) => +new Date(`${sel}T${h}:00`) < Date.now();

  return `
  ${pending.length ? `<div class="pending" data-keep-scroll="pending">${pending.map((c) => `
    <div class="pending__item">
      <div><b>${esc(c.nombre)}</b><br /><small>${cap(shortDate(c.fecha))} · ${hora12(c.hora)} · ${esc(c.tipo || "Cita")}</small></div>
      <div class="row"><button class="b b--sm b--dark" data-confirm="${c.id}">Confirmar y avisar</button><button class="b b--sm b--line" data-open-cita="${c.id}">Ver</button></div>
    </div>`).join("")}</div>` : ""}
  <div class="cal">
    <div class="card">
      <div class="cal__head">
        <h2>${MONTHS[m]} ${y}</h2>
        <button class="icon-b" data-cal="-1" aria-label="Mes anterior"><svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg></button>
        <button class="b b--sm b--line" data-cal="0">Hoy</button>
        <button class="icon-b" data-cal="1" aria-label="Mes siguiente"><svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg></button>
      </div>
      <div class="cal__grid">${DOW.map((d) => `<div class="cal__dow">${d}</div>`).join("")}${cells}</div>
      <div class="legend">${Object.entries(ESTADOS).map(([k, v]) => pill(k)).join("")}</div>
    </div>
    <div class="card dayp">
      <h3>${cap(fechaLarga(sel))}</h3>
      <p>${slots.length ? `${dayCitas.filter((c) => ACTIVE.includes(c.estado)).length} citas · ${slots.filter((h) => !busy[h] && !past(h)).length} horarios libres` : "Día sin atención según tu horario"}</p>
      <div class="slotlist" data-keep-scroll="slots">
        ${times.map((h) => {
          const c = busy[h] || dayCitas.find((x) => x.hora === h);
          if (c) return `<div class="slot slot--busy slot--${esc(c.estado)}" data-open-cita="${c.id}"><span class="slot__t">${hora12(h)}</span><span class="slot__who">${esc(c.nombre)}<small>${esc(c.tipo || "Cita")}</small></span>${pill(c.estado)}</div>`;
          return past(h) ? "" : `<div class="slot slot--free" data-new-at="${h}"><span class="slot__t">${hora12(h)}</span><span>Libre</span><span>+ Agendar</span></div>`;
        }).join("") || empty("Sin horarios para este día.")}
      </div>
      <button class="b b--dark b--block" style="margin-top:12px" data-new-at="">+ Nueva cita este día</button>
    </div>
  </div>`;
};
BIND.calendario = (v) => {
  $$("[data-cal]", v).forEach((b) => b.addEventListener("click", () => {
    const d = +b.dataset.cal;
    if (!d) { const n = new Date(); S.cal = { y: n.getFullYear(), m: n.getMonth(), sel: today() }; }
    else { const n = new Date(S.cal.y, S.cal.m + d, 1); S.cal.y = n.getFullYear(); S.cal.m = n.getMonth(); }
    render(false);
  }));
  $$("[data-day]", v).forEach((el) => el.addEventListener("click", () => {
    S.cal.sel = el.dataset.day;
    const d = new Date(`${el.dataset.day}T12:00:00`);
    if (d.getMonth() !== S.cal.m) { S.cal.m = d.getMonth(); S.cal.y = d.getFullYear(); }
    render(false);
    if (innerWidth < 1180) $(".dayp")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
  $$("[data-open-cita]", v).forEach((el) => el.addEventListener("click", () => openCita(S.citas.find((c) => c.id === el.dataset.openCita))));
  $$("[data-new-at]", v).forEach((el) => el.addEventListener("click", () => openCita(null, { fecha: S.cal.sel, hora: el.dataset.newAt })));
  $$("[data-confirm]", v).forEach((el) => el.addEventListener("click", () => confirmCita(S.citas.find((c) => c.id === el.dataset.confirm))));
};

async function confirmCita(c) {
  if (!c) return;
  const text = `Hola ${c.nombre.split(" ")[0]}, te saluda JP Real Estate. Te confirmamos tu ${(c.tipo || "cita").toLowerCase()} el ${fechaLarga(c.fecha)} a las ${hora12(c.hora)} (hora de Florida). ¡Te esperamos!`;
  const w = digits(c.telefono) ? window.open(waLink(c.telefono, text), "_blank") : null;
  try {
    await store.update("citas", c.id, { estado: "confirmada" });
    toast(w ? "Cita confirmada. Envía el mensaje en WhatsApp." : "Cita confirmada.");
  } catch (e) { fail(e); }
}

/* ---------- EMBUDO ---------- */
function filtered() {
  const q = S.f.q.trim().toLowerCase();
  return S.leads.filter((l) =>
    (!q || [l.nombre, l.telefono, l.email, l.zona, l.mensaje].some((x) => String(x || "").toLowerCase().includes(q))) &&
    (!S.f.origen || (SOURCES[l.origen] ? l.origen : "otro") === S.f.origen) &&
    (!S.f.interes || (l.interes || "").toLowerCase().startsWith(S.f.interes.toLowerCase().slice(0, 4))) &&
    (!S.f.etapa || l.etapa === S.f.etapa) &&
    (!S.f.soloAlertas || alertOf(l)));
}
const filtersBar = (withStage) => `
  <div class="toolbar">
    <label class="search"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input id="f-q" type="search" placeholder="Buscar nombre, teléfono, zona…" value="${esc(S.f.q)}" /></label>
    <select class="sel" id="f-origen"><option value="">Todos los orígenes</option>${Object.entries(SOURCES).map(([k, s]) => `<option value="${k}" ${S.f.origen === k ? "selected" : ""}>${s.label}</option>`).join("")}</select>
    <select class="sel" id="f-interes"><option value="">Todo interés</option>${["Comprar", "Vender", "Alquilar", "Invertir"].map((k) => `<option ${S.f.interes === k ? "selected" : ""}>${k}</option>`).join("")}</select>
    ${withStage ? `<select class="sel" id="f-etapa"><option value="">Todas las etapas</option>${STAGES.map((s) => `<option value="${s.id}" ${S.f.etapa === s.id ? "selected" : ""}>${s.label}</option>`).join("")}</select>` : ""}
    <label class="toggle"><input type="checkbox" id="f-alertas" ${S.f.soloAlertas ? "checked" : ""} /><span>Solo con alerta</span></label>
    <span class="grow"></span>
    ${withStage ? `<button class="b b--line" data-export>Exportar CSV</button>` : ""}
  </div>`;
const bindFilters = (v) => {
  $("#f-q", v).addEventListener("input", (e) => { S.f.q = e.target.value; render(false); });
  $("#f-origen", v).addEventListener("change", (e) => { S.f.origen = e.target.value; render(false); });
  $("#f-interes", v).addEventListener("change", (e) => { S.f.interes = e.target.value; render(false); });
  $("#f-etapa", v)?.addEventListener("change", (e) => { S.f.etapa = e.target.value; render(false); });
  $("#f-alertas", v).addEventListener("change", (e) => { S.f.soloAlertas = e.target.checked; render(false); });
  $("[data-export]", v)?.addEventListener("click", exportCSV);
};

VIEWS.embudo = () => {
  const L = filtered();
  const open = L.filter((l) => OPEN.includes(l.etapa));
  const won = L.filter((l) => l.etapa === "cerrado");
  const lost = L.filter((l) => l.etapa === "perdido");
  const pipeline = open.reduce((a, l) => a + valorOf(l), 0);
  const weighted = open.reduce((a, l) => a + valorOf(l) * (STAGE[l.etapa].weight / 100), 0);
  const winRate = won.length + lost.length ? Math.round((won.length / (won.length + lost.length)) * 100) : 0;
  const cycle = won.map((l) => (l.etapaAt || ms(l.updatedAt)) - ms(l.createdAt)).filter((x) => x > 0);
  const avgCycle = cycle.length ? cycle.reduce((a, b) => a + b, 0) / cycle.length : 0;
  const alerts = L.filter((l) => alertOf(l)).length;

  // rendimiento por canal
  const chan = {};
  L.forEach((l) => {
    const k = SOURCES[l.origen] ? l.origen : "otro";
    chan[k] ||= { n: 0, cita: 0, won: 0, val: 0 };
    chan[k].n++;
    if ((STAGE[l.etapa]?.i ?? 0) >= 2 && l.etapa !== "perdido") chan[k].cita++;
    if (l.etapa === "cerrado") { chan[k].won++; chan[k].val += valorOf(l); }
  });
  const chanRows = Object.entries(chan).sort((a, b) => b[1].won - a[1].won || b[1].n - a[1].n);

  return `
  <div class="pkpis">
    <div class="pk pk--dark"><small>Valor en el embudo</small><strong>${moneyShort(pipeline)}</strong><span>Ponderado por etapa: ${moneyShort(weighted)}</span></div>
    <div class="pk"><small>Oportunidades abiertas</small><strong>${open.length}</strong><span>${alerts ? `<em class="warn">${alerts} con alerta</em>` : "Todo al día"}</span></div>
    <div class="pk"><small>Ganadas</small><strong>${won.length}</strong><span>${moneyShort(won.reduce((a, l) => a + valorOf(l), 0))} en operaciones</span></div>
    <div class="pk"><small>Tasa de éxito</small><strong>${winRate}%</strong><span>Ganadas vs. perdidas</span></div>
    <div class="pk"><small>Ciclo de venta</small><strong>${avgCycle ? dur(avgCycle) : "—"}</strong><span>Del primer contacto al cierre</span></div>
  </div>

  <div class="fxwrap">
    <div class="card">
      <div class="card__head"><h2>Embudo de conversión</h2><span class="muted" style="font-size:13px">${L.length} contactos</span></div>
      ${L.length ? funnelSVG(L, true) : empty("Sin contactos con estos filtros.")}
    </div>
    <div class="card">
      <div class="card__head"><h2>Rendimiento por canal</h2><a class="lnk" href="#enlaces">Enlaces →</a></div>
      ${chanRows.length ? `<table class="mini"><thead><tr><th>Canal</th><th>Contactos</th><th>Citas</th><th>Cierres</th><th>Conv.</th></tr></thead><tbody>
        ${chanRows.map(([k, c]) => `<tr><td><span class="chan">${esc(SOURCES[k].short)}</span>${esc(SOURCES[k].label)}</td><td>${c.n}</td><td>${c.cita}</td><td><b>${c.won}</b>${c.val ? `<small> · ${moneyShort(c.val)}</small>` : ""}</td><td><span class="convbar"><i style="width:${Math.round((c.won / c.n) * 100)}%"></i></span>${Math.round((c.won / c.n) * 100)}%</td></tr>`).join("")}
      </tbody></table>` : empty("Sin datos todavía.")}
    </div>
  </div>

  ${filtersBar(false)}
  <div class="kanban" data-keep-scroll="kanban">
    ${STAGES.map((s) => {
      const cards = L.filter((l) => l.etapa === s.id).sort((a, b) => (!!alertOf(b) - !!alertOf(a)) || score(b) - score(a));
      const val = cards.reduce((a, l) => a + valorOf(l), 0);
      return `<section class="col col--${s.id}" data-col="${s.id}">
        <header class="col__head"><div><b>${esc(s.label)}</b><small>${val ? moneyShort(val) : "—"}</small></div><span>${cards.length}</span></header>
        <p class="col__tip">${esc(s.next)}</p>
        <div class="col__cards">${cards.map(cardHTML).join("") || `<div class="col__empty">Arrastra aquí</div>`}</div>
      </section>`;
    }).join("")}
  </div>`;
};
function cardHTML(l) {
  const a = alertOf(l), nc = nextCita(l), sc = score(l), t = temp(sc);
  const since = Date.now() - stageSince(l);
  return `<article class="lc${a ? " lc--alert" : ""}" draggable="true" data-id="${l.id}" tabindex="0">
    <div class="lc__top"><span class="av av--sm">${esc(initials(l.nombre))}</span><div class="lc__name"><b>${esc(l.nombre)}</b><small>${esc([l.interes, l.tipo].filter(Boolean).join(" · ") || "Sin detalle")}</small></div><span class="temp temp--${t.k}" title="Temperatura ${sc}/100"></span></div>
    ${l.presupuesto || l.zona ? `<p>${esc([l.presupuesto, l.zona].filter(Boolean).join(" · "))}</p>` : ""}
    <div class="lc__meta">${srcTag(l.origen)}${valorOf(l) ? `<span class="tag tag--dark">${moneyShort(valorOf(l))}</span>` : ""}<span class="lc__age" title="Tiempo en esta etapa">${dur(since)}</span></div>
    ${a ? `<div class="lc__alert">⚠ ${esc(a)}</div>` : ""}
    ${nc ? `<div class="lc__cita"><svg viewBox="0 0 24 24"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>${cap(shortDate(nc.fecha))} · ${hora12(nc.hora)}</div>` : ""}
    <div class="lc__quick">
      ${digits(l.telefono) ? `<a class="qb" href="${waLink(l.telefono, `Hola ${(l.nombre || "").split(" ")[0]}, te saluda JP Real Estate.`)}" target="_blank" rel="noopener" title="WhatsApp" data-stop>WA</a><a class="qb" href="tel:+${digits(l.telefono)}" title="Llamar" data-stop>Tel</a>` : ""}
      ${l.etapa !== "cerrado" && l.etapa !== "perdido" ? `<button class="qb qb--next" data-advance="${l.id}" title="Pasar a la siguiente etapa" data-stop>Avanzar →</button>` : ""}
    </div>
  </article>`;
}
BIND.embudo = (v) => {
  bindFilters(v);
  let dragId = null;
  $$(".lc", v).forEach((c) => {
    c.addEventListener("click", (e) => { if (e.target.closest("[data-stop]")) return; openLead(leadById(c.dataset.id)); });
    c.addEventListener("keydown", (e) => { if (e.key === "Enter") openLead(leadById(c.dataset.id)); });
    c.addEventListener("dragstart", (e) => { dragId = c.dataset.id; c.classList.add("is-drag"); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", dragId); });
    c.addEventListener("dragend", () => { c.classList.remove("is-drag"); $$(".col", v).forEach((x) => x.classList.remove("is-over")); });
  });
  $$(".col", v).forEach((col) => {
    col.addEventListener("dragover", (e) => { e.preventDefault(); col.classList.add("is-over"); });
    col.addEventListener("dragleave", (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove("is-over"); });
    col.addEventListener("drop", (e) => { e.preventDefault(); col.classList.remove("is-over"); const id = e.dataTransfer.getData("text/plain") || dragId; moveStage(leadById(id), col.dataset.col); });
  });
  $$("[data-advance]", v).forEach((b) => b.addEventListener("click", () => {
    const l = leadById(b.dataset.advance);
    const i = STAGE[l.etapa]?.i ?? 0;
    moveStage(l, STAGES[Math.min(i + 1, 5)].id);
  }));
};

async function moveStage(l, etapa) {
  if (!l || !etapa || l.etapa === etapa) return;
  const now = Date.now();
  try {
    await store.update("leads", l.id, { etapa, etapaAt: now, historial: [...(l.historial || []), { etapa, at: now, by: who() }] });
    toast(`${l.nombre.split(" ")[0]} → ${STAGE[etapa].label}`);
    if (etapa === "cita" && !nextCita(l)) openCita(null, { lead: l });
    if (etapa === "cerrado" && !valorOf(l)) setTimeout(() => openLead(leadById(l.id), false, "valor"), 300);
  } catch (e) { fail(e); }
}

/* ---------- CONTACTOS ---------- */
VIEWS.contactos = () => {
  const L = filtered();
  return `${filtersBar(true)}
  <div class="tablewrap"><table>
    <thead><tr><th>Contacto</th><th>Teléfono</th><th>Interés</th><th>Origen</th><th>Etapa</th><th>Temperatura</th><th>Valor</th><th>Entró</th></tr></thead>
    <tbody>${L.map((l) => `<tr data-lead="${l.id}">
      <td><span class="who"><span class="av">${esc(initials(l.nombre))}</span><span><b>${esc(l.nombre)}</b><br /><small class="muted">${esc(l.email || "")}</small></span></span></td>
      <td>${esc(l.telefono || "—")}</td><td>${esc(l.interes || "—")}</td><td>${srcTag(l.origen)}</td>
      <td><span class="stg">${esc(STAGE[l.etapa]?.label || l.etapa)}</span>${alertOf(l) ? ' <span class="warn">⚠</span>' : ""}</td>
      <td>${tempBadge(l)}</td><td>${valorOf(l) ? money(valorOf(l)) : "—"}</td><td>${rel(ms(l.createdAt))}</td></tr>`).join("")}</tbody>
  </table>${L.length ? "" : empty("No hay contactos con estos filtros.")}</div>`;
};
BIND.contactos = (v) => {
  bindFilters(v);
  $$("[data-lead]", v).forEach((r) => r.addEventListener("click", () => openLead(leadById(r.dataset.lead))));
};
function exportCSV() {
  const cols = ["nombre", "telefono", "email", "interes", "tipo", "presupuesto", "zona", "origen", "campana", "etapa", "valor", "mensaje"];
  const rows = [[...cols, "creado"], ...filtered().map((l) => [...cols.map((c) => l[c] ?? ""), new Date(ms(l.createdAt)).toISOString()])];
  const csv = rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  a.download = `contactos-jp-real-estate-${today()}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ---------- ENLACES ---------- */
const CHANNELS = [
  { id: "instagram", label: "Instagram", sub: "Meta Ads · historias, reels y bio", medium: "paid_social", hint: "Pégalo en “URL del sitio web” del anuncio de Meta o en el enlace de tu bio." },
  { id: "facebook", label: "Facebook", sub: "Meta Ads · publicaciones y anuncios", medium: "paid_social", hint: "Úsalo como destino del botón “Registrarte” en Meta Ads Manager." },
  { id: "google", label: "Google Ads", sub: "Búsqueda y Performance Max", medium: "cpc", hint: "Pégalo como “URL final” del anuncio en Google Ads." },
  { id: "tiktok", label: "TikTok", sub: "TikTok Ads y bio", medium: "paid_social", hint: "Úsalo como URL de destino o en el enlace de tu perfil." },
  { id: "whatsapp", label: "WhatsApp", sub: "Estados, listas y grupos", medium: "social", hint: "Compártelo en tus estados o en mensajes a clientes." },
  { id: "referido", label: "Referidos", sub: "Clientes que te recomiendan", medium: "referral", hint: "Envíalo a tus clientes para que lo compartan." },
];
const regBase = () => new URL("../registro/", location.href).href;
const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const linkFor = (ch) => {
  const u = new URL(regBase());
  u.searchParams.set("utm_source", ch.id);
  u.searchParams.set("utm_medium", ch.medium);
  if (S.campaign) u.searchParams.set("utm_campaign", slug(S.campaign));
  return u.href;
};
VIEWS.enlaces = () => {
  const count = (k) => S.leads.filter((l) => l.origen === k).length;
  const site = new URL("../#contacto", location.href).href;
  return `
  <div class="card links-intro">
    <div>
      <h2 style="margin:0 0 6px">Un enlace por canal, todo conectado al embudo</h2>
      <p class="muted" style="margin:0">Cada enlace abre el formulario “Agenda tu llamada 1 a 1 o envíanos un mensaje”. Las llamadas caen en el calendario y todos los contactos en el embudo, marcados con el canal de donde llegaron.</p>
    </div>
    <label class="in" style="min-width:260px"><span>Nombre de la campaña (opcional)</span><input id="campaign" placeholder="Ej. Open house noviembre" value="${esc(S.campaign)}" /></label>
  </div>
  <div class="links">
    ${CHANNELS.map((ch) => `<div class="card lk">
      <div class="lk__top"><span class="lk__ic">${esc(SOURCES[ch.id].short)}</span><div><b>${esc(ch.label)}</b><small>${esc(ch.sub)}</small></div><div class="lk__count"><b>${count(ch.id)}</b>contactos</div></div>
      <div class="lk__url"><input readonly value="${esc(linkFor(ch))}" aria-label="Enlace para ${esc(ch.label)}" /><button class="b b--sm b--dark" data-copy="${esc(linkFor(ch))}">Copiar</button></div>
      <p class="lk__hint">${esc(ch.hint)}</p>
      <div class="lk__actions"><a class="b b--sm b--line" href="${esc(linkFor(ch))}" target="_blank" rel="noopener">Probar ↗</a><button class="b b--sm b--line" data-qr="${esc(linkFor(ch))}" data-qr-name="${esc(ch.label)}">Código QR</button></div>
    </div>`).join("")}
    <div class="card lk">
      <div class="lk__top"><span class="lk__ic">WEB</span><div><b>Agenda del sitio web</b><small>Formulario “Agenda tu cita” de la página</small></div><div class="lk__count"><b>${count("sitio")}</b>contactos</div></div>
      <div class="lk__url"><input readonly value="${esc(site)}" aria-label="Enlace al sitio" /><button class="b b--sm b--dark" data-copy="${esc(site)}">Copiar</button></div>
      <p class="lk__hint">Las citas que reservan en el sitio también aparecen aquí y bloquean ese horario.</p>
      <div class="lk__actions"><a class="b b--sm b--line" href="${esc(site)}" target="_blank" rel="noopener">Probar ↗</a><button class="b b--sm b--line" data-qr="${esc(site)}" data-qr-name="Sitio web">Código QR</button></div>
    </div>
  </div>`;
};
BIND.enlaces = (v) => {
  $("#campaign", v).addEventListener("input", (e) => { S.campaign = e.target.value; render(false); });
  $$("[data-copy]", v).forEach((b) => b.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); }
    catch (e) { const i = b.previousElementSibling; i.select(); document.execCommand("copy"); }
    b.textContent = "¡Copiado!"; toast("Enlace copiado. Pégalo en tu anuncio.");
    setTimeout(() => (b.textContent = "Copiar"), 1800);
  }));
  $$("[data-qr]", v).forEach((b) => b.addEventListener("click", () => showQR(b.dataset.qr, b.dataset.qrName)));
};
function showQR(url, name) {
  if (!window.qrcode) { toast("Cargando el generador de QR… intenta de nuevo."); return; }
  const qr = window.qrcode(0, "M"); qr.addData(url); qr.make();
  const src = qr.createDataURL(10, 20);
  modal(`<div class="dh"><div><h2>Código QR</h2><small>${esc(name)}</small></div><button class="x" data-close aria-label="Cerrar">✕</button></div>
    <div class="qr"><img src="${src}" alt="Código QR del enlace" /><p class="muted" style="margin:0;font-size:13px;text-align:center;word-break:break-all">${esc(url)}</p>
    <a class="b b--dark" href="${src}" download="qr-${slug(name)}.gif">Descargar QR</a></div>`);
}

/* ---------- AJUSTES ---------- */
VIEWS.ajustes = () => {
  const a = S.agenda;
  const isAdmin = S.access.role === "admin";
  const dn = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  return `<div class="settings">
    <form class="card stack" id="agenda-form">
      <div><h2>Horario de atención</h2><p class="muted" style="margin:4px 0 0;font-size:13.5px">Es lo que ven tus clientes al agendar en el sitio y en el formulario de anuncios.</p></div>
      <div class="days">${[1, 2, 3, 4, 5, 6, 0].map((d) => `<label><input type="checkbox" name="dia" value="${d}" ${a.dias.includes(d) ? "checked" : ""} /><span>${dn[d]}</span></label>`).join("")}</div>
      <div class="grid2"><label class="in"><span>Desde</span><input type="time" name="desde" value="${a.desde}" /></label><label class="in"><span>Hasta</span><input type="time" name="hasta" value="${a.hasta}" /></label></div>
      <div class="grid3">
        <label class="in"><span>Duración</span><select name="intervalo">${[15, 20, 30, 45, 60].map((n) => `<option value="${n}" ${a.intervalo === n ? "selected" : ""}>${n} min</option>`).join("")}</select></label>
        <label class="in"><span>Días a futuro</span><input type="number" name="diasAdelante" min="1" max="120" value="${a.diasAdelante}" /></label>
        <label class="in"><span>Aviso mínimo (h)</span><input type="number" name="anticipacionHoras" min="0" max="72" value="${a.anticipacionHoras}" /></label>
      </div>
      <button class="b b--dark" type="submit" ${isAdmin ? "" : "disabled"}>Guardar horario</button>
    </form>
    <div class="stack">
      <div class="card stack">
        <h2>Conexión</h2>
        <p style="margin:0">${store.mode === "firebase" ? `Conectado a Firebase · proyecto <b>${esc(CFG.firebase.projectId)}</b>. Los datos se comparten en tiempo real con todo el equipo.` : "Modo local: los datos viven solo en este navegador. Para compartirlos con el equipo, activa Firebase en <code style='background:var(--bg)'>assets/js/config.js</code> (ver FIREBASE.md)."}</p>
        ${store.mode === "local" ? `<div class="r" style="display:flex;gap:8px;flex-wrap:wrap"><button class="b b--line" data-seed>Cargar datos de ejemplo</button><button class="b b--danger" data-wipe>Borrar datos locales</button></div>` : ""}
      </div>
    </div>
  </div>`;
};
BIND.ajustes = (v) => {
  $("#agenda-form", v).addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const ag = {
      dias: $$('input[name="dia"]:checked', f).map((i) => +i.value).sort(),
      desde: f.desde.value, hasta: f.hasta.value, intervalo: +f.intervalo.value,
      diasAdelante: Math.max(1, +f.diasAdelante.value || 30), anticipacionHoras: Math.max(0, +f.anticipacionHoras.value || 0),
    };
    if (!ag.dias.length || ag.desde >= ag.hasta) { toast("Revisa los días y que “Desde” sea antes de “Hasta”."); return; }
    try { await store.saveAgenda(ag); S.agenda = ag; toast("Horario guardado."); render(false); } catch (err) { fail(err); }
  });
  bindLocalTools(v);
};

/* ---------- USUARIOS: mi cuenta + equipo ---------- */
VIEWS.usuarios = () => {
  const isAdmin = S.access.role === "admin";
  const me = S.access.email;
  const local = store.mode === "local";
  const roleLabel = S.access.owner ? "Cuenta principal · Admin" : S.access.role === "admin" ? "Admin" : "Agente";
  const myName = S.team.find((t) => t.id === me)?.nombre || "";
  return `<div class="settings">
    <div class="stack">
      <div class="card stack">
        <div class="me">
          <span class="av av--lg">${esc((myName || me || "J")[0])}</span>
          <div><h2>${esc(myName || (local ? "Modo local" : me))}</h2><small class="muted">${esc(local ? "Demo en este navegador" : me)} · ${roleLabel}</small></div>
        </div>
      </div>
      <form class="card stack" id="pass-form" novalidate>
        <div><h2>Cambiar mi contraseña</h2><p class="muted" style="margin:4px 0 0;font-size:13.5px">Por seguridad te pedimos la contraseña actual.</p></div>
        <label class="in"><span>Contraseña actual</span><input type="password" name="actual" autocomplete="current-password" ${local ? "disabled" : ""} /></label>
        <div class="grid2"><label class="in"><span>Nueva contraseña</span><input type="password" name="nueva" minlength="6" autocomplete="new-password" ${local ? "disabled" : ""} /></label><label class="in"><span>Repite la nueva</span><input type="password" name="repite" minlength="6" autocomplete="new-password" ${local ? "disabled" : ""} /></label></div>
        <p class="muted" style="margin:0;font-size:12.5px">${local ? "En la demo no hay contraseñas: esta opción funciona en el panel real." : "Mínimo 6 caracteres. Al guardar, tu sesión sigue abierta."}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="b b--dark" type="submit" ${local ? "disabled" : ""}>Guardar contraseña</button>${local ? "" : `<button class="b b--line" type="button" data-reset-me>Enviarme correo para restablecerla</button>`}</div>
      </form>
    </div>
    ${isAdmin ? `<div class="card stack">
      <div><h2>Equipo</h2><p class="muted" style="margin:4px 0 0;font-size:13.5px">Personas que pueden entrar al panel. Cambia el rol, desactiva el acceso o envía un correo para restablecer su contraseña.</p></div>
      <div class="team__row team__row--owner"><span class="team__who"><b>${esc(store.ownerEmail || "Cuenta principal")}</b><small>Cuenta principal · siempre Admin</small></span><span class="tag tag--dark">Dueña</span></div>
      <div class="team">${S.team.map((t) => {
        const self = t.id === me;
        return `<div class="team__row"><span class="team__who"><b>${esc(t.nombre || t.id)}</b><small>${esc(t.nombre ? t.id : "")}${self ? " · tú" : ""}</small></span>
          <select class="sel" data-role="${esc(t.id)}" ${self ? "disabled" : ""}><option value="admin" ${t.role === "admin" ? "selected" : ""}>Admin</option><option value="agente" ${t.role === "agente" ? "selected" : ""}>Agente</option></select>
          <label class="toggle"><input type="checkbox" data-active="${esc(t.id)}" ${t.active ? "checked" : ""} ${self ? "disabled" : ""} /><span>Activo</span></label>
          <span class="team__acts">${local ? "" : `<button class="icon-b" data-reset="${esc(t.id)}" title="Enviar correo para restablecer contraseña" aria-label="Restablecer contraseña"><svg viewBox="0 0 24 24"><rect x="4" y="10.5" width="16" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg></button>`}${self ? "" : `<button class="icon-b" data-del-team="${esc(t.id)}" title="Quitar acceso" aria-label="Quitar acceso">✕</button>`}</span></div>`;
      }).join("") || `<p class="muted" style="margin:0">Aún no hay más personas en el equipo.</p>`}</div>
      <form class="stack team__new" id="team-form" novalidate>
        <h3 style="margin:0;font-size:14px">Agregar usuario</h3>
        <div class="grid2"><label class="in"><span>Nombre</span><input name="nombre" placeholder="Ej. Juliana Osorio" /></label><label class="in"><span>Correo*</span><input type="email" name="email" required placeholder="persona@correo.com" autocomplete="off" /></label></div>
        <div class="grid2"><label class="in"><span>Contraseña inicial*</span><input type="text" name="pass" minlength="6" placeholder="Mínimo 6 caracteres" autocomplete="new-password" /></label><label class="in"><span>Rol</span><select name="role"><option value="agente">Agente · contactos y citas</option><option value="admin">Admin · todo, incluido el equipo</option></select></label></div>
        <p class="muted" style="margin:0;font-size:12.5px">Comparte el correo y la contraseña con la persona; luego podrá cambiarla en Usuarios → Cambiar mi contraseña. Si ya tenía cuenta, deja la contraseña vacía y solo se habilita su acceso.</p>
        <button class="b b--dark" type="submit">Agregar usuario</button>
      </form>
    </div>` : `<div class="card stack"><h2>Equipo</h2><p class="muted" style="margin:0">Solo los administradores pueden agregar usuarios. Pide a la cuenta principal que te dé el rol Admin si lo necesitas.</p></div>`}
  </div>`;
};
BIND.usuarios = (v) => {
  $("#pass-form", v).addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, btn = $('button[type="submit"]', f);
    if (!f.actual.value) { toast("Escribe tu contraseña actual."); f.actual.focus(); return; }
    if (f.nueva.value.length < 6) { toast("La nueva contraseña debe tener al menos 6 caracteres."); f.nueva.focus(); return; }
    if (f.nueva.value !== f.repite.value) { toast("Las contraseñas nuevas no coinciden."); f.repite.focus(); return; }
    if (f.nueva.value === f.actual.value) { toast("La nueva contraseña debe ser distinta de la actual."); return; }
    btn.disabled = true;
    try { await store.changePassword(f.actual.value, f.nueva.value); f.reset(); toast("Contraseña actualizada."); }
    catch (err) {
      const m = { "auth/invalid-credential": "La contraseña actual no es correcta.", "auth/wrong-password": "La contraseña actual no es correcta.", "auth/weak-password": "La nueva contraseña es muy débil.", "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.", "auth/requires-recent-login": "Vuelve a iniciar sesión e inténtalo de nuevo." };
      toast(m[err.code] || "No se pudo cambiar la contraseña.");
    } finally { btn.disabled = false; }
  });
  $("[data-reset-me]", v)?.addEventListener("click", async () => {
    try { await store.resetPassword(S.access.email); toast(`Te enviamos un correo a ${S.access.email}.`); } catch (e) { toast("No se pudo enviar el correo."); }
  });
  $$("[data-reset]", v).forEach((b) => b.addEventListener("click", async () => {
    try { await store.resetPassword(b.dataset.reset); toast(`Correo para restablecer enviado a ${b.dataset.reset}.`); } catch (e) { toast("No se pudo enviar el correo."); }
  }));
  $("#team-form", v)?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, btn = $('button[type="submit"]', f);
    const email = f.email.value.trim().toLowerCase(), pass = f.pass.value;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast("Escribe un correo válido."); return; }
    if (pass && pass.length < 6) { toast("La contraseña debe tener al menos 6 caracteres."); return; }
    btn.disabled = true;
    try {
      let msg = "Acceso habilitado. La persona puede entrar con “Crear mi acceso”.";
      if (pass) {
        const r = await store.createUser(email, pass);
        msg = r.existed ? "Ese correo ya tenía cuenta: se habilitó su acceso con su contraseña actual." : "Usuario creado. Ya puede entrar con su correo y contraseña.";
      }
      await store.create("access", { role: f.role.value, active: true, nombre: f.nombre.value.trim(), addedBy: who() }, email);
      f.reset(); toast(msg);
    } catch (err) {
      const m = { "auth/weak-password": "La contraseña es muy débil.", "auth/invalid-email": "El correo no es válido." };
      if (m[err.code]) toast(m[err.code]); else fail(err);
    } finally { btn.disabled = false; }
  });
  $$("[data-role]", v).forEach((s) => s.addEventListener("change", () => store.update("access", s.dataset.role, { role: s.value }).catch(fail)));
  $$("[data-active]", v).forEach((c) => c.addEventListener("change", () => store.update("access", c.dataset.active, { active: c.checked }).catch(fail)));
  $$("[data-del-team]", v).forEach((b) => b.addEventListener("click", () => confirm(`¿Quitar el acceso de ${b.dataset.delTeam}?`) && store.remove("access", b.dataset.delTeam).catch(fail)));
};

/* =========================================================
   MODAL Y PANEL LATERAL
   ========================================================= */
function modal(html) {
  const d = $("#modal");
  $("[data-modal-body]").innerHTML = html;
  $$("[data-close]", d).forEach((b) => b.addEventListener("click", () => d.close()));
  if (!d.open) d.showModal();
  return d;
}
$("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") e.target.close(); });
$("#drawer").addEventListener("click", (e) => { if (e.target.id === "drawer") e.target.close(); });
$("#drawer").addEventListener("close", () => (S.drawerLead = null));

/* ---------- cita ---------- */
function openCita(c, preset = {}) {
  const isNew = !c;
  const lead = preset.lead || (c?.leadId && leadById(c.leadId));
  const v = c || {
    nombre: lead?.nombre || "", telefono: lead?.telefono || "", email: lead?.email || "",
    tipo: "Llamada 1 a 1", fecha: preset.fecha || S.cal.sel || today(), hora: preset.hora || "", estado: "confirmada", mensaje: "",
  };
  const d = modal(`<form id="cita-form" class="stack" novalidate>
    <div class="dh"><div><h2>${isNew ? "Nueva cita" : esc(v.nombre)}</h2><small>${isNew ? (lead ? `Para ${esc(lead.nombre)}` : "Agenda una cita en el calendario") : `${esc(v.tipo || "Cita")} · ${esc(SOURCES[v.origen]?.label || "Panel")}`}</small></div><button type="button" class="x" data-close aria-label="Cerrar">✕</button></div>
    ${!isNew ? `<div class="quick">${digits(v.telefono) ? `<a class="b b--sm b--wa" href="${waLink(v.telefono, `Hola ${v.nombre.split(" ")[0]}, te saluda JP Real Estate sobre tu cita del ${fechaLarga(v.fecha)} a las ${hora12(v.hora)}.`)}" target="_blank" rel="noopener">WhatsApp</a><a class="b b--sm b--line" href="tel:+${digits(v.telefono)}">Llamar</a>` : ""}${v.email ? `<a class="b b--sm b--line" href="mailto:${esc(v.email)}">Correo</a>` : ""}${lead ? `<button type="button" class="b b--sm b--line" data-goto-lead="${lead.id}">Ver contacto</button>` : ""}</div>` : ""}
    <div class="grid2"><label class="in"><span>Nombre*</span><input name="nombre" required value="${esc(v.nombre)}" /></label><label class="in"><span>Teléfono</span><input name="telefono" type="tel" value="${esc(v.telefono)}" /></label></div>
    <div class="grid2"><label class="in"><span>Correo</span><input name="email" type="email" value="${esc(v.email)}" /></label><label class="in"><span>Tipo</span><select name="tipo">${[...new Set([...TIPOS, v.tipo].filter(Boolean))].map((t) => `<option ${t === v.tipo ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label></div>
    <div class="grid3"><label class="in"><span>Fecha*</span><input name="fecha" type="date" required value="${esc(v.fecha)}" /></label><label class="in"><span>Hora*</span><input name="hora" type="time" step="900" required value="${esc(v.hora)}" /></label><label class="in"><span>Estado</span><select name="estado">${Object.entries(ESTADOS).map(([k, t]) => `<option value="${k}" ${k === v.estado ? "selected" : ""}>${t}</option>`).join("")}</select></label></div>
    <label class="in"><span>Notas</span><textarea name="mensaje" rows="3">${esc(v.mensaje || "")}</textarea></label>
    ${isNew && !lead ? `<label class="toggle"><input type="checkbox" name="crearLead" checked /><span>Crear también el contacto en el embudo</span></label>` : ""}
    <div class="foot">${!isNew ? `<button type="button" class="b b--danger" data-del>Eliminar</button>` : ""}<div class="r"><button type="button" class="b b--line" data-close>Cancelar</button><button class="b b--dark" type="submit">${isNew ? "Agendar" : "Guardar"}</button></div></div>
  </form>`);
  $("[data-goto-lead]", d)?.addEventListener("click", (e) => { d.close(); openLead(leadById(e.target.dataset.gotoLead)); });
  $("[data-del]", d)?.addEventListener("click", async () => {
    if (!confirm("¿Eliminar esta cita?")) return;
    try { await store.remove("citas", c.id); if (ACTIVE.includes(c.estado)) await store.releaseSlot(c.fecha, c.hora); d.close(); toast("Cita eliminada."); } catch (e) { fail(e); }
  });
  $("#cita-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const data = { nombre: f.nombre.value.trim(), telefono: f.telefono.value.trim(), email: f.email.value.trim(), tipo: f.tipo.value, fecha: f.fecha.value, hora: f.hora.value, estado: f.estado.value, mensaje: f.mensaje.value.trim() };
    if (!data.nombre || !data.fecha || !data.hora) { toast("Completa nombre, fecha y hora."); return; }
    const clash = S.citas.find((x) => x.id !== c?.id && x.fecha === data.fecha && x.hora === data.hora && ACTIVE.includes(x.estado));
    if (clash && ACTIVE.includes(data.estado) && !confirm(`Ya hay una cita con ${clash.nombre} a esa hora. ¿Agendar de todas formas?`)) return;
    try {
      if (isNew) {
        let leadId = lead?.id;
        if (!leadId && f.crearLead?.checked) {
          leadId = await store.create("leads", { nombre: data.nombre, telefono: data.telefono, email: data.email, origen: "otro", etapa: "cita", etapaAt: Date.now(), accion: "llamada", historial: [{ etapa: "cita", at: Date.now(), by: who() }] });
        }
        await store.create("citas", { ...data, origen: lead?.origen || "panel", leadId: leadId || "" });
        if (ACTIVE.includes(data.estado)) await store.holdSlot(data.fecha, data.hora);
        if (lead && (STAGE[lead.etapa]?.i ?? 0) < 2) await store.update("leads", lead.id, { etapa: "cita", etapaAt: Date.now(), historial: [...(lead.historial || []), { etapa: "cita", at: Date.now(), by: who() }] });
        S.cal.sel = data.fecha;
        toast("Cita agendada.");
      } else {
        const wasActive = ACTIVE.includes(c.estado), isActive = ACTIVE.includes(data.estado);
        const moved = c.fecha !== data.fecha || c.hora !== data.hora;
        await store.update("citas", c.id, data);
        if (wasActive && (moved || !isActive)) await store.releaseSlot(c.fecha, c.hora);
        if (isActive && (moved || !wasActive)) await store.holdSlot(data.fecha, data.hora);
        toast("Cita actualizada.");
      }
      d.close();
    } catch (err) { fail(err); }
  });
}

/* ---------- contacto (panel lateral) ---------- */
function openLead(l, keep = false, focus = "") {
  if (!l) return;
  S.drawerLead = l.id;
  const d = $("#drawer");
  const typed = keep ? $("#note-in")?.value : "";
  const sc = score(l), t = temp(sc), a = alertOf(l);
  const cs = citasOf(l).sort((x, y) => citaTime(y) - citaTime(x));
  const timeline = [
    { at: ms(l.createdAt), t: `Entró por ${SOURCES[l.origen]?.label || "otro canal"}${l.campana ? ` · campaña “${l.campana}”` : ""}`, k: "in" },
    ...(l.historial || []).map((h) => ({ at: h.at, t: `Pasó a ${STAGE[h.etapa]?.label || h.etapa}`, k: "stage", by: h.by })),
    ...(l.notas || []).map((n) => ({ at: n.at, t: n.text, k: "note", by: n.by })),
    ...cs.map((c) => ({ at: ms(c.createdAt) || citaTime(c), t: `Cita ${ESTADOS[c.estado]?.toLowerCase()} · ${shortDate(c.fecha)} ${hora12(c.hora)}`, k: "cita" })),
  ].filter((x) => x.at).sort((x, y) => y.at - x.at);
  const fact = (k, v, wide) => (v ? `<div class="${wide ? "wide" : ""}"><small>${k}</small><span>${esc(v)}</span></div>` : "");
  const first = (l.nombre || "").split(" ")[0];

  $("[data-drawer-body]").innerHTML = `
    <div class="dh"><div><h2>${esc(l.nombre)}</h2><small>Entró ${rel(ms(l.createdAt))} · ${esc(SOURCES[l.origen]?.label || "Otro")}</small></div><button class="x" data-close aria-label="Cerrar">✕</button></div>
    <div class="lead-score"><div class="ring ring--${t.k}" style="--p:${sc}"><b>${sc}</b></div><div><b>${t.t}</b><small>${esc(STAGE[l.etapa]?.next || "")}</small></div>${a ? `<span class="warn">⚠ ${esc(a)}</span>` : ""}</div>
    <div class="stagepick" role="radiogroup" aria-label="Etapa">${STAGES.map((s) => `<button type="button" class="sp${s.id === l.etapa ? " is-on" : ""}${(STAGE[l.etapa]?.i ?? 0) > s.i && l.etapa !== "perdido" && s.id !== "perdido" ? " is-done" : ""} sp--${s.id}" data-stage="${s.id}">${esc(s.label)}</button>`).join("")}</div>
    <div class="quick">
      ${digits(l.telefono) ? `<a class="b b--sm b--wa" href="${waLink(l.telefono, `Hola ${first}, te saluda JP Real Estate. Vimos tu solicitud y queremos ayudarte.`)}" target="_blank" rel="noopener">WhatsApp</a><a class="b b--sm b--line" href="tel:+${digits(l.telefono)}">Llamar</a>` : ""}
      ${l.email ? `<a class="b b--sm b--line" href="mailto:${esc(l.email)}">Correo</a>` : ""}
      <button class="b b--sm b--dark" data-lead-cita>+ Agendar cita</button>
    </div>
    <div class="facts">
      ${fact("Teléfono", l.telefono)}${fact("Correo", l.email)}${fact("Interés", l.interes)}${fact("Tipo de propiedad", l.tipo)}${fact("Presupuesto", l.presupuesto)}${fact("Zona", l.zona)}
      ${fact("Prefiere", l.contactoPreferido)}${fact("Solicitó", l.accion === "llamada" ? "Llamada 1 a 1" : l.accion === "mensaje" ? "Mensaje" : "")}${fact("Campaña", l.campana)}${fact("Mensaje", l.mensaje, true)}
    </div>
    <div class="sec"><h3>Valor de la operación</h3>
      <form class="note-form" id="valor-form"><input id="valor-in" type="number" min="0" step="1000" placeholder="Ej. 450000" value="${valorOf(l) || ""}" /><button class="b b--line" type="submit">Guardar</button></form>
    </div>
    <div class="sec"><h3>Citas <span>${cs.length}</span></h3>
      <div class="list">${cs.map((c) => `<div class="li" data-cita="${c.id}"><div class="li__date"><b>${new Date(`${c.fecha}T12:00:00`).getDate()}</b><small>${MON[new Date(`${c.fecha}T12:00:00`).getMonth()]}</small></div><div class="li__main"><b>${esc(c.tipo || "Cita")}</b><small>${hora12(c.hora)}</small></div>${pill(c.estado)}</div>`).join("") || `<p class="muted" style="margin:0;font-size:13.5px">Sin citas todavía.</p>`}</div>
    </div>
    <div class="sec"><h3>Notas e historial</h3>
      <form class="note-form" id="note-form"><input id="note-in" placeholder="Escribe una nota y pulsa Enter…" maxlength="1000" /><button class="b b--dark" type="submit">Agregar</button></form>
      <ol class="tl">${timeline.map((x) => `<li class="tl__i tl__i--${x.k}"><p>${esc(x.t)}</p><small>${rel(x.at)}${x.by && x.by !== "modo-local" ? ` · ${esc(x.by)}` : ""}</small></li>`).join("")}</ol>
    </div>
    <div class="foot">${S.access.role === "admin" ? `<button class="b b--danger" data-del-lead>Eliminar contacto</button>` : ""}<div class="r"><button class="b b--line" data-close>Cerrar</button></div></div>`;

  const body = $("[data-drawer-body]");
  $$("[data-close]", body).forEach((b) => b.addEventListener("click", () => d.close()));
  $$("[data-stage]", body).forEach((b) => b.addEventListener("click", () => moveStage(l, b.dataset.stage)));
  $("[data-lead-cita]", body).addEventListener("click", () => openCita(null, { lead: l }));
  $$("[data-cita]", body).forEach((el) => el.addEventListener("click", () => openCita(S.citas.find((c) => c.id === el.dataset.cita))));
  $("#note-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const i = $("#note-in"); const text = i.value.trim();
    if (!text) return;
    i.value = "";
    try { await store.addNote(l.id, text, who()); } catch (err) { i.value = text; fail(err); }
  });
  $("#valor-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    try { await store.update("leads", l.id, { valor: Math.max(0, +$("#valor-in").value || 0) }); toast("Valor guardado."); } catch (err) { fail(err); }
  });
  $("[data-del-lead]", body)?.addEventListener("click", async () => {
    if (!confirm(`¿Eliminar a ${l.nombre}? Esta acción no se puede deshacer.`)) return;
    try { await store.remove("leads", l.id); d.close(); toast("Contacto eliminado."); } catch (err) { fail(err); }
  });
  if (typed) $("#note-in").value = typed;
  if (!d.open) d.showModal();
  if (focus === "valor") $("#valor-in").focus();
}

/* ---------- nuevo contacto ---------- */
function newLead() {
  const d = modal(`<form id="lead-form" class="stack" novalidate>
    <div class="dh"><div><h2>Nuevo contacto</h2><small>Se agrega al embudo de ventas</small></div><button type="button" class="x" data-close aria-label="Cerrar">✕</button></div>
    <div class="grid2"><label class="in"><span>Nombre*</span><input name="nombre" required /></label><label class="in"><span>Teléfono</span><input name="telefono" type="tel" /></label></div>
    <div class="grid2"><label class="in"><span>Correo</span><input name="email" type="email" /></label><label class="in"><span>Interés</span><select name="interes">${["Comprar", "Vender", "Alquilar", "Invertir"].map((x) => `<option>${x}</option>`).join("")}</select></label></div>
    <div class="grid3"><label class="in"><span>Tipo</span><input name="tipo" placeholder="Casa, apto…" /></label><label class="in"><span>Presupuesto</span><input name="presupuesto" placeholder="$400k – $600k" /></label><label class="in"><span>Zona</span><input name="zona" placeholder="Orlando" /></label></div>
    <div class="grid3"><label class="in"><span>Origen</span><select name="origen">${Object.entries(SOURCES).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join("")}</select></label><label class="in"><span>Etapa</span><select name="etapa">${STAGES.map((s) => `<option value="${s.id}">${s.label}</option>`).join("")}</select></label><label class="in"><span>Valor (USD)</span><input name="valor" type="number" min="0" step="1000" /></label></div>
    <label class="in"><span>Notas</span><textarea name="mensaje" rows="2"></textarea></label>
    <div class="foot"><div class="r"><button type="button" class="b b--line" data-close>Cancelar</button><button class="b b--dark" type="submit">Agregar</button></div></div>
  </form>`);
  $("#lead-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    if (!f.nombre.value.trim()) { toast("Escribe el nombre."); return; }
    const data = Object.fromEntries(["nombre", "telefono", "email", "interes", "tipo", "presupuesto", "zona", "origen", "etapa", "mensaje"].map((k) => [k, f[k].value.trim()]));
    try {
      await store.create("leads", { ...data, valor: +f.valor.value || 0, etapaAt: Date.now(), historial: [{ etapa: data.etapa, at: Date.now(), by: who() }] });
      d.close(); toast("Contacto agregado.");
    } catch (err) { fail(err); }
  });
}
$("[data-new-lead]").addEventListener("click", newLead);
$("[data-new-cita]").addEventListener("click", () => openCita(null, { fecha: S.view === "calendario" ? S.cal.sel : today() }));

/* =========================================================
   MODO LOCAL: datos de ejemplo para demostraciones
   ========================================================= */
function bindLocalTools(root = document) {
  $$("[data-seed]", root).forEach((b) => (b.onclick = () => seed().then(() => toast("Datos de ejemplo cargados."))));
  $$("[data-wipe]", root).forEach((b) => (b.onclick = () => { if (confirm("¿Borrar todos los datos guardados en este navegador?")) { localStorage.removeItem("jp-db-v1"); location.reload(); } }));
}
bindLocalTools();

function maybeDemo() {
  if (store.mode === "local" && qs.has("demo") && !S.leads.length && !S.citas.length) seed();
}

async function seed() {
  if (store.mode !== "local") return;
  const now = Date.now(), H = 36e5;
  const D = (days, hours = 0) => now - days * DAYMS - hours * H;
  const P = [
    ["Valentina Restrepo", "instagram", "Comprar", "Casa", "$400k – $600k", "Kissimmee", "nuevo", 480000, D(0, 3)],
    ["Andrés Gómez", "google", "Comprar", "Apartamento", "$250k – $400k", "Orlando", "nuevo", 320000, D(0, 0.4)],
    ["Camila Herrera", "facebook", "Alquilar", "Apartamento", "Alquiler: $2,000 – $3,500/mes", "Doral", "nuevo", 0, D(1, 2)],
    ["Luis Fernando Ruiz", "sitio", "Vender", "Casa", "$600k – $1M", "Winter Garden", "contactado", 720000, D(2)],
    ["Mariana Castillo", "instagram", "Comprar", "Townhouse", "$400k – $600k", "Lake Nona", "contactado", 455000, D(4)],
    ["Jorge Peña", "tiktok", "Invertir", "Apartamento", "$250k – $400k", "Tampa", "contactado", 290000, D(9)],
    ["Daniela Ortiz", "google", "Comprar", "Casa", "$400k – $600k", "Clermont", "cita", 515000, D(3)],
    ["Ricardo Salazar", "referido", "Vender", "Casa", "Más de $1M", "Windermere", "cita", 1250000, D(5)],
    ["Paola Medina", "instagram", "Comprar", "Casa", "$600k – $1M", "Orlando", "cita", 640000, D(2)],
    ["Sebastián Vargas", "facebook", "Comprar", "Apartamento", "$250k – $400k", "Kissimmee", "visita", 335000, D(8)],
    ["Natalia Rojas", "sitio", "Comprar", "Casa", "$400k – $600k", "Davenport", "visita", 470000, D(11)],
    ["Felipe Morales", "google", "Invertir", "Comercial", "$600k – $1M", "Orlando", "negociacion", 880000, D(15)],
    ["Isabella Cruz", "instagram", "Comprar", "Casa", "$400k – $600k", "St. Cloud", "negociacion", 498000, D(13)],
    ["Carlos Mendoza", "referido", "Comprar", "Casa", "$600k – $1M", "Lake Nona", "cerrado", 690000, D(34)],
    ["Laura Jiménez", "instagram", "Comprar", "Townhouse", "$250k – $400k", "Kissimmee", "cerrado", 365000, D(41)],
    ["Diego Torres", "google", "Vender", "Casa", "$400k – $600k", "Orlando", "cerrado", 540000, D(27)],
    ["Gabriela Silva", "facebook", "Alquilar", "Casa", "Alquiler: más de $3,500/mes", "Windermere", "perdido", 0, D(22)],
    ["Manuel Quintero", "tiktok", "Comprar", "Apartamento", "Menos de $250k", "Tampa", "perdido", 210000, D(30)],
  ];
  const stageDays = { nuevo: 0, contactado: 1, cita: 2, visita: 5, negociacion: 9, cerrado: 21, perdido: 6 };
  const db = { leads: {}, citas: {}, ocupados: {}, ajustes: JSON.parse(localStorage.getItem("jp-db-v1") || "{}").ajustes || {} };
  const slots = (d) => store.slotsForDay(S.agenda, d);
  let ci = 0;
  P.forEach(([nombre, origen, interes, tipo, presupuesto, zona, etapa, valor, created], i) => {
    const id = "demo" + i;
    const path = STAGES.slice(1, (STAGE[etapa].i || 0) + 1).map((s) => s.id).filter((s) => s !== "perdido");
    if (etapa === "perdido") path.push("perdido");
    const etapaAt = etapa === "nuevo" ? created : Math.min(now - 2 * H, created + stageDays[etapa] * DAYMS);
    const historial = path.map((s, k) => ({ etapa: s, at: Math.min(etapaAt, created + (k + 1) * ((etapaAt - created) / Math.max(1, path.length))), by: "" }));
    const phone = `407${String(5550100 + i * 37).slice(-7)}`;
    db.leads[id] = {
      nombre, telefono: phone, email: `${slug(nombre).split("-")[0]}.${slug(nombre).split("-").slice(-1)[0]}@ejemplo.com`,
      interes, tipo, presupuesto, zona, origen, campana: ["instagram", "facebook"].includes(origen) ? "open-house-noviembre" : "",
      accion: i % 3 ? "llamada" : "mensaje", contactoPreferido: "WhatsApp", etapa, valor, etapaAt, historial,
      mensaje: i % 4 === 0 ? "Me interesa conocer opciones cerca de buenas escuelas." : "",
      notas: etapa === "negociacion" ? [{ text: "Envió oferta 3% por debajo del precio. Esperando contraoferta.", at: now - 2 * DAYMS, by: "" }] : [],
      createdAt: created, updatedAt: etapa === "contactado" && i === 5 ? created + DAYMS : etapaAt, ejemplo: true,
    };
    if (["cita", "visita", "negociacion"].includes(etapa) || (etapa === "contactado" && i === 4)) {
      // próxima cita en los siguientes días hábiles
      for (let k = 1 + (ci % 6); k < 30; k++) {
        const d = new Date(); d.setDate(d.getDate() + k);
        const sl = slots(d); if (!sl.length) continue;
        const hora = sl[(ci * 5) % sl.length], fecha = store.ymd(d);
        if (db.ocupados[store.slotId(fecha, hora)]) continue;
        db.citas["c" + id] = { nombre, telefono: phone, email: db.leads[id].email, interes, fecha, hora, tipo: etapa === "visita" ? "Visita a propiedad" : "Llamada 1 a 1", estado: ci % 3 === 0 ? "solicitada" : "confirmada", origen, leadId: id, mensaje: "", createdAt: created + H, updatedAt: created + H, ejemplo: true };
        db.ocupados[store.slotId(fecha, hora)] = { fecha, hora, createdAt: now };
        ci++;
        break;
      }
    }
    if (["cerrado", "visita"].includes(etapa)) {
      const d = new Date(now - (stageDays[etapa] + 2) * DAYMS);
      while (!S.agenda.dias.includes(d.getDay())) d.setDate(d.getDate() - 1);
      db.citas["p" + id] = { nombre, telefono: phone, email: db.leads[id].email, interes, fecha: store.ymd(d), hora: "11:00", tipo: "Visita a propiedad", estado: "completada", origen, leadId: id, createdAt: created + H, updatedAt: created + H, ejemplo: true };
    }
  });
  localStorage.setItem("jp-db-v1", JSON.stringify(db));
  dispatchEvent(new StorageEvent("storage", { key: "jp-db-v1" }));
}
