/* JP Real State — interactions */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const body = document.body;

  $("#year").textContent = new Date().getFullYear();

  /* ---------- Hero: split title into words, stagger intro ---------- */
  $$(".hero__title .split").forEach((line) => {
    const html = line.innerHTML.trim();
    const parts = html.split(/\s+(?![^<]*>)/);
    line.innerHTML = parts.map((p) => `<span class="word"><span>${p}</span></span>`).join(" ");
  });
  $$(".hero__title .word > span").forEach((w, i) => (w.style.transitionDelay = `${i * 90 + 100}ms`));
  [".hero__eyebrow", ".hero__lead", ".hero__actions"].forEach((s, i) => {
    const el = $(s);
    el.setAttribute("data-in", "");
    el.style.transitionDelay = `${[0, 650, 800][i]}ms`;
  });

  /* ---------- Preloader ---------- */
  $$(".preloader__word span").forEach((s, i) => s.style.setProperty("--i", i));
  const start = () => {
    const pre = $(".preloader");
    pre.classList.add("is-done");
    body.classList.remove("is-loading");
    setTimeout(() => body.classList.add("is-ready"), 250);
    setTimeout(() => pre.remove(), 1400);
  };
  const minTime = reduced ? 0 : 2100;
  const t0 = performance.now();
  const onLoaded = () => setTimeout(start, Math.max(0, minTime - (performance.now() - t0)));
  if (document.readyState === "complete") onLoaded();
  else window.addEventListener("load", onLoaded, { once: true });
  setTimeout(() => body.classList.contains("is-loading") && start(), 5000); // safety net

  /* ---------- Hero word rotator ---------- */
  const items = $$(".rotator__item");
  let ri = 0;
  if (!reduced) {
    setInterval(() => {
      const cur = items[ri];
      cur.classList.remove("is-active");
      cur.classList.add("is-leaving");
      setTimeout(() => cur.classList.remove("is-leaving"), 1000);
      ri = (ri + 1) % items.length;
      items[ri].classList.add("is-active");
    }, 3200);
  }

  /* ---------- Reveal on scroll ---------- */
  $$("[data-delay]").forEach((el) => el.style.setProperty("--d", `${el.dataset.delay}ms`));
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    }),
    { threshold: 0.18, rootMargin: "0px 0px -6% 0px" }
  );
  $$(".reveal").forEach((el) => io.observe(el));
  // clip-path hides the target from IntersectionObserver, so watch its parent instead
  const clipIO = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    $(".reveal-clip", e.target).classList.add("is-in");
    clipIO.unobserve(e.target);
  }), { threshold: 0.2 });
  $$(".reveal-clip").forEach((el) => clipIO.observe(el.parentElement));

  /* ---------- Counters ---------- */
  const countIO = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (!e.isIntersecting) return;
    const el = e.target, end = +el.dataset.count, dur = reduced ? 1 : 1800, t = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t) / dur);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    countIO.unobserve(el);
  }), { threshold: 0.6 });
  $$("[data-count]").forEach((el) => countIO.observe(el));

  /* ---------- Statement: words light up while scrolling ---------- */
  const stmt = $("[data-scrub-words]");
  const goldWords = ["primera", "consulta", "llaves,", "contigo"];
  stmt.innerHTML = stmt.textContent.trim().split(/\s+/)
    .map((w) => `<span class="w${goldWords.includes(w) ? " gold" : ""}">${w}</span>`).join(" ");
  const words = $$(".w", stmt);

  /* ---------- Nav ---------- */
  const nav = $(".nav");
  const progress = $(".progress");
  const wa = $(".wa-float");
  let lastY = 0;

  /* ---------- Horizontal gallery ---------- */
  const hg = $(".hgallery");
  const track = $(".hgallery__track");
  const useHG = !reduced;
  let hgDist = 0;
  const sizeHG = () => {
    if (!useHG) { hg.classList.add("is-static"); return; }
    hgDist = Math.max(0, track.scrollWidth - innerWidth);
    hg.style.height = `${innerHeight + hgDist}px`;
  };

  /* ---------- Timeline ---------- */
  const tl = $(".timeline");
  const tlLine = $(".timeline__line i");

  /* ---------- Parallax ---------- */
  const parallax = $$("[data-parallax]");
  const inner = $$("[data-parallax-inner]");

  const sections = $$("main section[id]");
  const navLinks = $$(".nav__links a");

  const onScroll = () => {
    const y = scrollY, vh = innerHeight;
    const max = document.documentElement.scrollHeight - vh;
    progress.style.transform = `scaleX(${max > 0 ? y / max : 0})`;

    nav.classList.toggle("is-solid", y > vh * 0.75);
    nav.classList.toggle("is-hidden", y > lastY && y > vh && !body.classList.contains("menu-open"));
    lastY = y;
    wa.classList.toggle("is-visible", y > vh * 0.5);

    if (!reduced) {
      parallax.forEach((el) => {
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > vh) return;
        el.style.transform = `translate3d(0, ${(r.top) * -+el.dataset.parallax}px, 0)`;
      });
      inner.forEach((el) => {
        const r = el.getBoundingClientRect();
        el.style.translate = `0 ${(r.top + r.height / 2 - vh / 2) * -+el.dataset.parallaxInner}px`;
      });

      // statement words
      const sr = stmt.getBoundingClientRect();
      const sp = Math.min(1, Math.max(0, (vh * 0.85 - sr.top) / (sr.height + vh * 0.35)));
      const lit = Math.round(sp * words.length);
      words.forEach((w, i) => w.classList.toggle("on", i < lit));

      // horizontal gallery
      if (useHG) {
        const r = hg.getBoundingClientRect();
        const p = Math.min(1, Math.max(0, -r.top / (r.height - vh)));
        track.style.transform = `translate3d(${-p * hgDist}px,0,0)`;
      }
    }

    // timeline line
    const tr = tl.getBoundingClientRect();
    const tp = Math.min(1, Math.max(0, (vh * 0.6 - tr.top) / tr.height));
    tlLine.style.setProperty("--p", tp);

    // active nav link
    let current = "";
    sections.forEach((s) => { if (s.getBoundingClientRect().top < vh * 0.4) current = s.id; });
    navLinks.forEach((a) => a.classList.toggle("is-active", a.getAttribute("href") === `#${current}`));
  };

  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { onScroll(); ticking = false; });
  }, { passive: true });
  addEventListener("resize", () => { sizeHG(); onScroll(); });
  addEventListener("load", () => { sizeHG(); onScroll(); });
  sizeHG(); onScroll();

  /* ---------- Mobile menu ---------- */
  const burger = $(".burger");
  const menu = $("#mobile-menu");
  const setMenu = (open) => {
    body.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", open);
    burger.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    menu.setAttribute("aria-hidden", !open);
    body.style.overflow = open ? "hidden" : "";
  };
  burger.addEventListener("click", () => setMenu(!body.classList.contains("menu-open")));
  $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
  addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));

  /* ---------- Service panels ---------- */
  const panels = $$(".panel");
  const openPanel = (p) => panels.forEach((x) => x.classList.toggle("is-open", x === p));
  panels.forEach((p) => {
    if (finePointer) p.addEventListener("mouseenter", () => openPanel(p));
    p.addEventListener("click", () => openPanel(p));
    p.addEventListener("focus", () => openPanel(p));
  });

  /* ---------- Interest links prefill the form ---------- */
  $$("[data-interest]").forEach((a) => a.addEventListener("click", () => {
    const r = $(`.form__chips input[value="${a.dataset.interest}"]`);
    if (r) r.checked = true;
  }));

  /* ---------- Pointer effects (desktop) ---------- */
  if (finePointer && !reduced) {
    // cursor
    const cursor = $(".cursor"), dot = $(".cursor__dot"), ring = $(".cursor__ring");
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    addEventListener("mousemove", (e) => { mx = e.clientX; my = e.clientY; dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`; });
    const loop = () => {
      rx += (mx - rx) * 0.16; ry += (my - ry) * 0.16;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    };
    loop();
    $$("a, button, .panel, label").forEach((el) => {
      el.addEventListener("mouseenter", () => cursor.classList.add("is-hover"));
      el.addEventListener("mouseleave", () => cursor.classList.remove("is-hover"));
    });
    $$("[data-cursor]").forEach((el) => {
      el.addEventListener("mouseenter", () => cursor.classList.add("is-view"));
      el.addEventListener("mouseleave", () => cursor.classList.remove("is-view"));
    });

    // magnetic buttons
    $$(".magnetic").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.25}px, ${y * 0.35}px)`;
      });
      el.addEventListener("mouseleave", () => (el.style.transform = ""));
    });

    // tilt cards with glow
    $$(".tilt").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.transform = `rotateX(${(0.5 - py) * 8}deg) rotateY(${(px - 0.5) * 10}deg) translateY(-6px)`;
        el.style.setProperty("--mx", `${px * 100}%`);
        el.style.setProperty("--my", `${py * 100}%`);
      });
      el.addEventListener("mouseleave", () => (el.style.transform = ""));
    });
  }

  /* ---------- Form → WhatsApp ---------- */
  const form = $("#cita-form");
  const ok = $(".form__ok", form);
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = form.nombre, email = form.correo, phone = form.telefono;
    const checks = [
      [name, name.value.trim().length > 1],
      [email, /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())],
      [phone, phone.value.replace(/\D/g, "").length >= 7],
    ];
    let valid = true;
    checks.forEach(([el, good]) => { el.closest(".field").classList.toggle("has-error", !good); if (!good) valid = false; });
    if (!valid) { checks.find(([, g]) => !g)[0].focus(); return; }

    const interes = form.interes.value;
    const msg = form.mensaje.value.trim();
    const text = [
      `¡Hola JP Real State! Quiero agendar una cita.`,
      `• Interés: ${interes}`,
      `• Nombre: ${name.value.trim()}`,
      `• Correo: ${email.value.trim()}`,
      `• Teléfono: ${phone.value.trim()}`,
      msg && `• Mensaje: ${msg}`,
    ].filter(Boolean).join("\n");
    window.open(`https://wa.me/13219612892?text=${encodeURIComponent(text)}`, "_blank", "noopener");
    ok.textContent = "¡Gracias! Abrimos WhatsApp con tu mensaje listo para enviar.";
    form.reset();
  });
  $$("input", form).forEach((i) => i.addEventListener("input", () => i.closest(".field")?.classList.remove("has-error")));
})();
