/* =========================================================
   Capa de datos — JP Real Estate
   ---------------------------------------------------------
   Misma API para Firestore (modo "firebase") y para el
   navegador (modo "local"). Colecciones:
     leads   → contactos del embudo de ventas
     citas   → agenda de citas
     access  → permisos del equipo (doc id = correo)
     ocupados→ horarios reservados, sin datos personales
               (doc id = "AAAA-MM-DDTHH:MM"; evita doble reserva)
     ajustes → horario de atención (doc "agenda")
   El SDK de Firebase se carga solo cuando hace falta.
   ========================================================= */
const SDK = "https://www.gstatic.com/firebasejs/10.12.2";
const cfg = window.JP_CONFIG || {};
const forceLocal = new URLSearchParams(location.search).has("local");

export const mode = cfg.firebase?.enabled && cfg.firebase?.apiKey && !forceLocal ? "firebase" : "local";
export const ownerEmail = (cfg.ownerEmail || "").toLowerCase();

const ORDER = { leads: ["createdAt", "desc"], citas: ["fecha", "asc"], access: null, ocupados: null, ajustes: null };

/* ---------- horario de atención (se puede cambiar desde el panel) ---------- */
export const AGENDA_DEFAULT = {
  dias: [1, 2, 3, 4, 5, 6],   // 0 = domingo … 6 = sábado
  desde: "09:00",
  hasta: "18:00",
  intervalo: 30,              // minutos entre horarios
  diasAdelante: 30,           // cuántos días se pueden reservar
  anticipacionHoras: 2,       // no se reserva con menos de esto
};
export const slotId = (fecha, hora) => `${fecha}T${hora}`;
/** Fecha local en formato AAAA-MM-DD (no UTC). */
export const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ---------- helpers ---------- */
export const toMillis = (v) => {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  if (v.seconds != null) return v.seconds * 1000;
  return +new Date(v) || 0;
};
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

/* =========================================================
   Firebase
   ========================================================= */
let fbPromise = null;
export function loadFirebase() {
  if (mode !== "firebase") return Promise.resolve(null);
  fbPromise ??= (async () => {
    const [{ initializeApp }, fs, au] = await Promise.all([
      import(`${SDK}/firebase-app.js`),
      import(`${SDK}/firebase-firestore.js`),
      import(`${SDK}/firebase-auth.js`),
    ]);
    const app = initializeApp(cfg.firebase);
    return { fs, au, db: fs.getFirestore(app), auth: au.getAuth(app) };
  })();
  return fbPromise;
}

/* =========================================================
   Local (navegador)
   ========================================================= */
const KEY = "jp-db-v1";
const localRead = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
const localWrite = (db) => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} emitLocal(); };
const localListeners = new Set();
const emitLocal = () => localListeners.forEach((fn) => fn());
addEventListener("storage", (e) => { if (e.key === KEY) emitLocal(); });
const localId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* =========================================================
   Auth
   ========================================================= */
export function onAuth(cb) {
  if (mode === "local") { cb({ email: "modo-local", local: true }); return () => {}; }
  let unsub = () => {};
  loadFirebase().then(({ au, auth }) => { unsub = au.onAuthStateChanged(auth, cb); });
  return () => unsub();
}
export async function login(email, pass) {
  const { au, auth } = await loadFirebase();
  return au.signInWithEmailAndPassword(auth, email.trim(), pass);
}
export async function register(email, pass) {
  const { au, auth } = await loadFirebase();
  return au.createUserWithEmailAndPassword(auth, email.trim(), pass);
}
export async function resetPassword(email) {
  const { au, auth } = await loadFirebase();
  return au.sendPasswordResetEmail(auth, email.trim());
}
/**
 * Crea un usuario (correo + contraseña) sin cerrar la sesión de quien lo crea:
 * usa una segunda instancia de Firebase solo para el alta y luego la cierra.
 * Si el correo ya tenía cuenta, no es error: solo falta habilitarle el acceso.
 */
export async function createUser(email, pass) {
  if (mode === "local") return { existed: false };
  const [{ initializeApp, getApps, deleteApp }, au] = await Promise.all([import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`)]);
  const name = "alta-usuarios";
  const app2 = getApps().find((a) => a.name === name) || initializeApp(cfg.firebase, name);
  const auth2 = au.getAuth(app2);
  try {
    await au.createUserWithEmailAndPassword(auth2, email.trim(), pass);
    await au.signOut(auth2);
    return { existed: false };
  } catch (e) {
    if (e.code === "auth/email-already-in-use") return { existed: true };
    throw e;
  } finally {
    deleteApp(app2).catch(() => {});
  }
}
export async function logout() {
  if (mode === "local") return;
  const { au, auth } = await loadFirebase();
  return au.signOut(auth);
}
/** Devuelve { role, active, owner } o null si la persona no tiene acceso. */
export async function getAccess(user) {
  if (!user) return null;
  if (mode === "local") return { role: "admin", active: true, owner: true, email: "modo-local" };
  const email = (user.email || "").toLowerCase();
  if (ownerEmail && email === ownerEmail) return { role: "admin", active: true, owner: true, email };
  const { fs, db } = await loadFirebase();
  try {
    const snap = await fs.getDoc(fs.doc(db, "access", email));
    if (snap.exists() && snap.data().active) return { ...snap.data(), owner: false, email };
  } catch (e) { /* sin permiso → sin acceso */ }
  return null;
}

/* =========================================================
   Lectura en tiempo real
   ========================================================= */
export function watch(col, cb, onError) {
  if (mode === "local") {
    const run = () => {
      let rows = Object.entries(localRead()[col] || {}).map(([id, d]) => ({ id, ...d }));
      const o = ORDER[col];
      if (o) rows.sort((a, b) => {
        const x = a[o[0]] ?? "", y = b[o[0]] ?? "";
        return (x > y ? 1 : x < y ? -1 : 0) * (o[1] === "desc" ? -1 : 1);
      });
      cb(rows);
    };
    localListeners.add(run);
    run();
    return () => localListeners.delete(run);
  }
  let unsub = () => {}, stopped = false;
  loadFirebase().then(({ fs, db }) => {
    if (stopped) return;
    const o = ORDER[col];
    const q = o ? fs.query(fs.collection(db, col), fs.orderBy(o[0], o[1])) : fs.collection(db, col);
    unsub = fs.onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
  });
  return () => { stopped = true; unsub(); };
}

/* =========================================================
   Escritura (panel admin)
   ========================================================= */
export async function create(col, data, id) {
  data = clean(data);
  if (mode === "local") {
    const db = localRead();
    const key = id || localId();
    db[col] = db[col] || {};
    db[col][key] = { ...data, createdAt: Date.now(), updatedAt: Date.now() };
    localWrite(db);
    return key;
  }
  const { fs, db } = await loadFirebase();
  const payload = { ...data, createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp() };
  if (id) { await fs.setDoc(fs.doc(db, col, id), payload); return id; }
  const ref = await fs.addDoc(fs.collection(db, col), payload);
  return ref.id;
}
export async function update(col, id, data) {
  data = clean(data);
  if (mode === "local") {
    const db = localRead();
    if (!db[col]?.[id]) return;
    db[col][id] = { ...db[col][id], ...data, updatedAt: Date.now() };
    localWrite(db);
    return;
  }
  const { fs, db } = await loadFirebase();
  return fs.updateDoc(fs.doc(db, col, id), { ...data, updatedAt: fs.serverTimestamp() });
}
export async function remove(col, id) {
  if (mode === "local") {
    const db = localRead();
    if (db[col]) delete db[col][id];
    localWrite(db);
    return;
  }
  const { fs, db } = await loadFirebase();
  return fs.deleteDoc(fs.doc(db, col, id));
}
/** Para el panel: agrega una nota al historial del contacto. */
export async function addNote(leadId, text, author) {
  const note = { text: String(text).slice(0, 1000), at: Date.now(), by: author || "" };
  if (mode === "local") {
    const db = localRead();
    const lead = db.leads?.[leadId];
    if (!lead) return;
    lead.notas = [...(lead.notas || []), note];
    lead.updatedAt = Date.now();
    localWrite(db);
    return;
  }
  const { fs, db } = await loadFirebase();
  return fs.updateDoc(fs.doc(db, "leads", leadId), { notas: fs.arrayUnion(note), updatedAt: fs.serverTimestamp() });
}

/* =========================================================
   Escritura pública (sitio web y formulario de redes)
   Solo crea documentos; las reglas validan cada campo.
   ========================================================= */
const LEAD_FIELDS = ["nombre", "telefono", "email", "interes", "tipo", "presupuesto", "zona", "plazo", "mensaje", "origen", "campana", "accion", "contactoPreferido"];
const CITA_FIELDS = ["nombre", "telefono", "email", "interes", "fecha", "hora", "mensaje", "origen", "tipo"];
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] != null && o[k] !== "").map((k) => [k, String(o[k]).trim().slice(0, k === "mensaje" ? 1000 : 120)]));

/** Nuevo contacto en el embudo (etapa "nuevo"). */
export async function publicLead(data) {
  const lead = { ...pick(data, LEAD_FIELDS), etapa: "nuevo" };
  if (mode === "local") return create("leads", lead);
  const { fs, db } = await loadFirebase();
  const ref = await fs.addDoc(fs.collection(db, "leads"), { ...lead, createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp() });
  return ref.id;
}

export class SlotTakenError extends Error {}

/**
 * Reserva desde el sitio o el formulario de redes: crea la cita, su contacto
 * en el embudo (etapa "cita") y bloquea el horario. Si el horario ya está
 * ocupado lanza SlotTakenError.
 */
export async function publicCita(data) {
  const lead = { ...pick(data, LEAD_FIELDS), etapa: "cita" };
  const cita = { ...pick(data, CITA_FIELDS), estado: "solicitada" };
  const sid = slotId(cita.fecha, cita.hora);
  if (mode === "local") {
    const db = localRead();
    if (db.ocupados?.[sid]) throw new SlotTakenError("Horario ocupado");
    const leadId = await create("leads", lead);
    await create("ocupados", { fecha: cita.fecha, hora: cita.hora }, sid);
    return create("citas", { ...cita, leadId });
  }
  const { fs, db } = await loadFirebase();
  const leadRef = fs.doc(fs.collection(db, "leads"));
  const citaRef = fs.doc(fs.collection(db, "citas"));
  const slotRef = fs.doc(db, "ocupados", sid);
  const batch = fs.writeBatch(db);
  const ts = { createdAt: fs.serverTimestamp(), updatedAt: fs.serverTimestamp() };
  batch.set(leadRef, { ...lead, ...ts });
  batch.set(citaRef, { ...cita, leadId: leadRef.id, ...ts });
  batch.set(slotRef, { fecha: cita.fecha, hora: cita.hora, createdAt: fs.serverTimestamp() });
  const slotTaken = async () => { try { return (await fs.getDoc(slotRef)).exists(); } catch (e) { return false; } };
  if (await slotTaken()) throw new SlotTakenError("Horario ocupado");
  try {
    await batch.commit();
  } catch (e) {
    // Las reglas no permiten volver a escribir un horario que ya existe:
    // si el rechazo es porque alguien lo tomó en este instante, avisamos eso.
    if (e?.code === "permission-denied" && (await slotTaken())) throw new SlotTakenError("Horario ocupado");
    throw e;
  }
  return citaRef.id;
}

/* =========================================================
   Horarios (público)
   ========================================================= */
/** Horario de atención guardado desde el panel, o el predeterminado. */
export async function getAgenda() {
  if (mode === "local") return { ...AGENDA_DEFAULT, ...(localRead().ajustes?.agenda || {}) };
  try {
    const { fs, db } = await loadFirebase();
    const snap = await fs.getDoc(fs.doc(db, "ajustes", "agenda"));
    return { ...AGENDA_DEFAULT, ...(snap.exists() ? snap.data() : {}) };
  } catch (e) { return { ...AGENDA_DEFAULT }; }
}
export async function saveAgenda(agenda) {
  if (mode === "local") {
    const db = localRead();
    db.ajustes = { ...(db.ajustes || {}), agenda };
    localWrite(db);
    return;
  }
  const { fs, db } = await loadFirebase();
  return fs.setDoc(fs.doc(db, "ajustes", "agenda"), agenda);
}
/** Conjunto de horarios ocupados ("AAAA-MM-DDTHH:MM") desde hoy. */
export async function getTakenSlots() {
  const today = ymd(new Date());
  if (mode === "local") return new Set(Object.keys(localRead().ocupados || {}).filter((k) => k >= today));
  const { fs, db } = await loadFirebase();
  const snap = await fs.getDocs(fs.query(fs.collection(db, "ocupados"), fs.where("fecha", ">=", today)));
  return new Set(snap.docs.map((d) => d.id));
}
/** Para el panel: bloquear / liberar un horario al crear, mover o cancelar citas. */
export async function holdSlot(fecha, hora) {
  if (!fecha || !hora) return;
  try { await create("ocupados", { fecha, hora }, slotId(fecha, hora)); } catch (e) { /* ya estaba ocupado */ }
}
export async function releaseSlot(fecha, hora) {
  if (!fecha || !hora) return;
  try { await remove("ocupados", slotId(fecha, hora)); } catch (e) {}
}

/** Lista de horarios (["09:00", "09:30", …]) para un día según el horario de atención. */
export function slotsForDay(agenda, date) {
  if (!agenda.dias.includes(date.getDay())) return [];
  const [h1, m1] = agenda.desde.split(":").map(Number);
  const [h2, m2] = agenda.hasta.split(":").map(Number);
  const out = [];
  for (let t = h1 * 60 + m1; t + agenda.intervalo <= h2 * 60 + m2; t += agenda.intervalo) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return out;
}
