/* JP Real State — interactions (GSAP + ScrollTrigger + Lenis) */
(() => {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const root = document.documentElement;
  const body = document.body;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const motion = hasGsap && !reduced;

  if (!motion) root.classList.add("no-motion");
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);
  $("#year").textContent = new Date().getFullYear();

  /* ---------- Button text roll: wrap label so it can slide ---------- */
  $$(".btn__text").forEach((t) => {
    const label = t.textContent.trim();
    t.innerHTML = `<i data-text="${label}">${label}</i>`;
  });

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  if (motion && window.Lenis) {
    lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- Mobile menu ---------- */
  const burger = $(".burger");
  const menu = $("#mobile-menu");
  const setMenu = (open) => {
    body.classList.toggle("menu-open", open);
    burger.setAttribute("aria-expanded", open);
    burger.setAttribute("aria-label", open ? "Cerrar menú" : "Abrir menú");
    menu.setAttribute("aria-hidden", !open);
    if (lenis) open ? lenis.stop() : lenis.start();
    else body.style.overflow = open ? "hidden" : "";
  };
  burger.addEventListener("click", () => setMenu(!body.classList.contains("menu-open")));
  addEventListener("keydown", (e) => e.key === "Escape" && setMenu(false));

  /* ---------- Anchor links ---------- */
  $$('a[href^="#"]').forEach((a) => a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    const target = id.length > 1 && $(id);
    if (!target) return;
    e.preventDefault();
    const wasOpen = body.classList.contains("menu-open");
    setMenu(false);
    const go = () => (lenis ? lenis.scrollTo(target, { duration: 1.6 }) : target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" }));
    wasOpen ? setTimeout(go, 350) : go();
  }));

  /* ---------- Interest links prefill the form ---------- */
  $$("[data-interest]").forEach((a) => a.addEventListener("click", () => {
    const r = $(`.form__chips input[value="${a.dataset.interest}"]`);
    if (r) r.checked = true;
  }));

  /* ---------- Images only needed on hover: load after the page ---------- */
  const lateImages = () => $$("img[data-src]").forEach((img) => { img.src = img.dataset.src; img.removeAttribute("data-src"); });
  if (finePointer && innerWidth > 760) {
    document.readyState === "complete" ? lateImages() : addEventListener("load", lateImages, { once: true });
  }

  /* ---------- Hero word rotator ---------- */
  const startRotator = () => {
    if (reduced) return;
    const items = $$(".rotator__item");
    let i = 0;
    setInterval(() => {
      const cur = items[i];
      cur.classList.replace("is-active", "is-leaving");
      setTimeout(() => cur.classList.remove("is-leaving"), 1100);
      i = (i + 1) % items.length;
      items[i].classList.add("is-active");
    }, 3000);
  };

  /* ---------- Split text into masked words (keeps <em>) ---------- */
  const splitWords = (el) => {
    const inners = [];
    const frag = document.createDocumentFragment();
    [...el.childNodes].forEach((node) => {
      const tag = node.nodeType === 1 ? node.tagName.toLowerCase() : null;
      if (tag === "br") { frag.appendChild(document.createElement("br")); return; }
      node.textContent.split(/\s+/).filter(Boolean).forEach((word) => {
        // keep trailing punctuation glued to the previous word
        if (/^[.,;:!?]+$/.test(word) && inners.length) {
          inners[inners.length - 1].append(word);
          return;
        }
        const mask = document.createElement("span");
        mask.className = "w-mask";
        const inner = document.createElement("span");
        inner.className = "w-in";
        if (tag) {
          const t = document.createElement(tag);
          t.textContent = word;
          inner.appendChild(t);
        } else inner.textContent = word;
        mask.appendChild(inner);
        frag.append(mask, " ");
        inners.push(inner);
      });
    });
    el.textContent = "";
    el.appendChild(frag);
    return inners;
  };

  /* ---------- Fallback: no GSAP or reduced motion ---------- */
  const wa = $(".wa-float");
  const nav = $(".nav");
  if (!motion) {
    $(".preloader")?.remove();
    startRotator();
    $$(".step").forEach((s) => s.classList.add("is-in"));
    let lastY = 0;
    addEventListener("scroll", () => {
      const y = scrollY;
      wa.classList.toggle("is-visible", y > innerHeight * 0.5);
      nav.classList.toggle("is-hidden", y > lastY && y > innerHeight && !body.classList.contains("menu-open"));
      nav.classList.toggle("is-solid", y > innerHeight * 0.8);
      lastY = y;
    }, { passive: true });
  }

  /* =========================================================
     Motion (GSAP)
     ========================================================= */
  if (motion) {
    const expo = "expo.out";

    /* ---------- Preloader + hero intro ---------- */
    const pre = $(".preloader");
    const num = $(".preloader__num");
    body.classList.add("is-loading");
    lenis?.stop();
    const counter = { v: 0 };

    gsap.set(".hero__media img", { scale: 1.35 });
    gsap.set(".hero__title .line__in", { yPercent: 115 });
    gsap.set("[data-hero]", { y: 30, autoAlpha: 0 });
    gsap.set(nav, { yPercent: -100, autoAlpha: 0 });

    // full loader only on the first visit of the session; afterwards just the hero intro
    let seen = false;
    try { seen = !!sessionStorage.getItem("jp-intro"); sessionStorage.setItem("jp-intro", "1"); } catch (e) {}
    const t = seen ? 0 : 0.9; // moment the hero starts revealing

    const intro = gsap.timeline({ paused: true });
    if (seen) {
      intro.to(pre, { autoAlpha: 0, duration: 0.4, ease: "power2.out" }, 0);
    } else {
      intro
        .to(counter, { v: 100, duration: 0.75, ease: "power2.inOut", onUpdate: () => (num.textContent = Math.round(counter.v)) }, 0)
        .to(".preloader__line", { scaleX: 1, duration: 0.75, ease: "power2.inOut" }, 0)
        .to(".preloader__center, .preloader__top, .preloader__bottom", { autoAlpha: 0, y: -30, duration: 0.3, stagger: 0.03, ease: "power2.in" }, 0.72)
        .to(pre, { yPercent: -100, duration: 0.8, ease: "expo.inOut" }, 0.8);
    }
    intro
      .to(".hero__media img", { scale: 1, duration: 2.2, ease: expo }, t + 0.05)
      .to(".hero__title .line__in", { yPercent: 0, duration: 1.4, stagger: 0.1, ease: expo }, t + 0.3)
      .to("[data-hero]", { y: 0, autoAlpha: 1, duration: 1.2, stagger: 0.08, ease: expo }, t + 0.5)
      .to(nav, { yPercent: 0, autoAlpha: 1, duration: 1.1, ease: expo, clearProps: "transform" }, t + 0.4)
      .add(() => {
        pre.remove();
        body.classList.remove("is-loading");
        lenis?.start();
        startRotator();
        ScrollTrigger.refresh();
      }, t + 0.5);

    let started = false;
    const play = () => { if (!started) { started = true; intro.play(); } };
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(play);
    setTimeout(play, 800); // don't wait on slow font downloads

    /* ---------- Hero parallax on scroll ---------- */
    gsap.to(".hero__media", { yPercent: 22, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
    gsap.to(".hero__content, .hero__foot", { y: -80, autoAlpha: 0.2, ease: "none", scrollTrigger: { trigger: ".hero", start: "40% top", end: "bottom top", scrub: true } });

    /* ---------- Nav hide/show & WhatsApp ---------- */
    ScrollTrigger.create({
      start: 0, end: "max",
      onUpdate: (s) => {
        const y = s.scroll();
        nav.classList.toggle("is-hidden", s.direction === 1 && y > innerHeight && !body.classList.contains("menu-open"));
        nav.classList.toggle("is-solid", y > innerHeight * 0.8);
        wa.classList.toggle("is-visible", y > innerHeight * 0.5);
      },
    });

    /* ---------- Headings: masked word reveal ---------- */
    $$("[data-split]").forEach((el) => {
      const words = splitWords(el);
      gsap.from(words, {
        yPercent: 115, rotate: 4, duration: 1.4, stagger: 0.06, ease: expo,
        scrollTrigger: { trigger: el, start: "top 86%" },
      });
    });

    /* ---------- Intro: words light up with scroll ---------- */
    const introWords = splitWords($("[data-words]"));
    gsap.fromTo(introWords, { opacity: 0.12 }, {
      opacity: 1, stagger: 0.1, ease: "none",
      scrollTrigger: { trigger: ".intro__text", start: "top 80%", end: "bottom 50%", scrub: true },
    });

    /* ---------- Generic reveal (batched) ---------- */
    gsap.set("[data-reveal]", { y: 60, autoAlpha: 0 });
    ScrollTrigger.batch("[data-reveal]", {
      start: "top 90%",
      onEnter: (batch) => {
        gsap.to(batch, { y: 0, autoAlpha: 1, duration: 1.3, stagger: 0.09, ease: expo, overwrite: true });
        batch.forEach((el) => el.classList.add("is-in"));
      },
    });

    /* ---------- About image: curtain + parallax ---------- */
    gsap.fromTo(".about__frame", { clipPath: "inset(100% 0% 0% 0%)" }, {
      clipPath: "inset(0% 0% 0% 0%)", duration: 1.8, ease: "expo.inOut",
      scrollTrigger: { trigger: ".about__frame", start: "top 82%" },
    });
    gsap.from(".about__frame img", { scale: 1.4, duration: 2.4, ease: expo, scrollTrigger: { trigger: ".about__frame", start: "top 82%" } });
    $$("[data-speed]").forEach((img) => {
      const amt = +img.dataset.speed * 100;
      gsap.fromTo(img, { yPercent: -amt / 2 }, { yPercent: amt / 2, ease: "none", scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true } });
    });
    gsap.from(".about__badge", { scale: 0, rotate: -90, duration: 1.4, ease: "back.out(1.6)", scrollTrigger: { trigger: ".about__frame", start: "top 60%" } });

    /* ---------- Marquee reacts to scroll speed/direction ---------- */
    const mTrack = $(".marquee__track");
    let mx = 0, dir = -1, boost = 0;
    ScrollTrigger.create({
      trigger: ".marquee", start: "top bottom", end: "bottom top",
      onUpdate: (s) => { dir = s.direction === 1 ? -1 : 1; boost = Math.min(8, Math.abs(s.getVelocity()) / 250); },
    });
    gsap.ticker.add(() => {
      boost *= 0.93;
      mx += (0.045 + boost * 0.09) * dir;
      if (mx <= -50) mx += 50;
      if (mx > 0) mx -= 50;
      gsap.set(mTrack, { xPercent: mx, skewX: -boost * dir * 0.8 });
    });

    /* ---------- Counters ---------- */
    $$("[data-count]").forEach((el) => {
      const end = +el.dataset.count;
      const o = { v: 0 };
      el.textContent = "0";
      gsap.to(o, {
        v: end, duration: 2, ease: "power3.out",
        onUpdate: () => (el.textContent = Math.round(o.v)),
        scrollTrigger: { trigger: el, start: "top 90%" },
      });
    });

    /* ---------- Services: floating preview follows cursor ---------- */
    if (finePointer && innerWidth > 760) {
      const prev = $(".services-preview");
      const prevInner = $(".services-preview__inner");
      const list = $(".services__list");
      const px = gsap.quickTo(prev, "x", { duration: 0.7, ease: "power3" });
      const py = gsap.quickTo(prev, "y", { duration: 0.7, ease: "power3" });
      const pr = gsap.quickTo(prev, "rotate", { duration: 0.8, ease: "power3" });
      gsap.set(prev, { scale: 0, autoAlpha: 0, xPercent: 0, yPercent: 0 });
      let lastX = 0;
      list.addEventListener("mouseenter", (e) => { gsap.set(prev, { x: e.clientX, y: e.clientY }); gsap.to(prev, { scale: 1, autoAlpha: 1, duration: 0.6, ease: expo }); });
      list.addEventListener("mouseleave", () => gsap.to(prev, { scale: 0, autoAlpha: 0, duration: 0.5, ease: "power3.in" }));
      list.addEventListener("mousemove", (e) => {
        px(e.clientX); py(e.clientY);
        pr(gsap.utils.clamp(-12, 12, (e.clientX - lastX) * 0.6));
        lastX = e.clientX;
      });
      $$(".srow").forEach((row) => row.addEventListener("mouseenter", () => {
        prevInner.style.transform = `translateY(${-row.dataset.index * 100}%)`;
      }));
    }

    /* ---------- Horizontal gallery (pinned) ---------- */
    const track = $(".hgallery__track");
    const dist = () => Math.max(0, track.scrollWidth - innerWidth);
    gsap.to(track, {
      x: () => -dist(), ease: "none",
      scrollTrigger: {
        trigger: ".hgallery", start: "top top", end: () => `+=${dist()}`,
        pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: (s) => gsap.set(".hgallery__progress i", { scaleX: s.progress }),
      },
    });


    /* ---------- CTA band: image expands to full bleed ---------- */
    gsap.fromTo(".band__media", { clipPath: "inset(12% 16% 12% 16% round 8px)" }, {
      clipPath: "inset(0% 0% 0% 0% round 0px)", ease: "none",
      scrollTrigger: { trigger: ".band", start: "top 85%", end: "top top", scrub: true },
    });
    gsap.fromTo(".band__media img", { scale: 1.3 }, { scale: 1, ease: "none", scrollTrigger: { trigger: ".band", start: "top bottom", end: "bottom top", scrub: true } });

    /* ---------- Footer giant wordmark ---------- */
    gsap.from(".footer__big span", { yPercent: 105, duration: 1.6, stagger: 0.1, ease: expo, scrollTrigger: { trigger: ".footer__big", start: "top 95%" } });

    /* ---------- Magnetic buttons ---------- */
    if (finePointer) {
      $$(".magnetic").forEach((el) => {
        const xTo = gsap.quickTo(el, "x", { duration: 0.6, ease: "power3" });
        const yTo = gsap.quickTo(el, "y", { duration: 0.6, ease: "power3" });
        el.addEventListener("mousemove", (e) => {
          const r = el.getBoundingClientRect();
          xTo((e.clientX - r.left - r.width / 2) * 0.3);
          yTo((e.clientY - r.top - r.height / 2) * 0.4);
        });
        el.addEventListener("mouseleave", () => gsap.to(el, { x: 0, y: 0, duration: 1, ease: "elastic.out(1, .4)" }));
      });
    }

    addEventListener("load", () => ScrollTrigger.refresh());
  }

  /* =========================================================
     Custom cursor (independent of GSAP)
     ========================================================= */
  if (finePointer && !reduced) {
    root.classList.add("has-cursor");
    const cursor = $(".cursor");
    const blob = $(".cursor__blob"), dot = $(".cursor__dot"), label = $(".cursor__label");
    const labelText = $("span", label);
    let mx = -100, my = -100, bx = mx, by = my, lx = mx, ly = my;
    addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
      cursor.classList.remove("is-hidden");
    }, { passive: true });
    const loop = () => {
      bx += (mx - bx) * 0.18; by += (my - by) * 0.18;
      lx += (mx - lx) * 0.12; ly += (my - ly) * 0.12;
      blob.style.transform = `translate3d(${bx}px, ${by}px, 0)`;
      label.style.translate = `${lx}px ${ly}px`;
      requestAnimationFrame(loop);
    };
    loop();
    document.addEventListener("mouseover", (e) => {
      const t = e.target;
      const lab = t.closest("[data-cursor]");
      if (lab) {
        labelText.textContent = lab.dataset.cursor;
        cursor.classList.add("is-label");
        cursor.classList.remove("is-hover");
        return;
      }
      cursor.classList.remove("is-label");
      cursor.classList.toggle("is-hover", !!t.closest("a, button, label, [data-hover], .srow"));
    });
    document.addEventListener("mousedown", () => cursor.classList.add("is-down"));
    document.addEventListener("mouseup", () => cursor.classList.remove("is-down"));
    document.addEventListener("mouseleave", () => cursor.classList.add("is-hidden"));
  }

  /* =========================================================
     Form → WhatsApp or e-mail
     ========================================================= */
  const WHATSAPP = "13219612892";
  const EMAIL = ""; // correo del negocio que recibe las citas
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
    checks.forEach(([el, good]) => el.closest(".field").classList.toggle("has-error", !good));
    const bad = checks.find(([, good]) => !good);
    if (bad) { bad[0].focus(); return; }

    const msg = form.mensaje.value.trim();
    const lines = [
      `• Interés: ${form.interes.value}`,
      `• Nombre: ${name.value.trim()}`,
      `• Correo: ${email.value.trim()}`,
      `• Teléfono: ${phone.value.trim()}`,
      msg && `• Mensaje: ${msg}`,
    ].filter(Boolean);

    if (e.submitter?.value === "correo") {
      const subject = `Solicitud de cita (${form.interes.value}) — ${name.value.trim()}`;
      const bodyText = ["¡Hola JP Real State! Quiero agendar una cita.", "", ...lines].join("\n");
      location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
      ok.textContent = "¡Gracias! Abrimos tu app de correo con el mensaje listo para enviar.";
    } else {
      const text = ["¡Hola JP Real State! Quiero agendar una cita.", ...lines].join("\n");
      window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`, "_blank", "noopener");
      ok.textContent = "¡Gracias! Abrimos WhatsApp con tu mensaje listo para enviar.";
    }
    form.reset();
  });
  $$("input", form).forEach((i) => i.addEventListener("input", () => i.closest(".field")?.classList.remove("has-error")));
})();
