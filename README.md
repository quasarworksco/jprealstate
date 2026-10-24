# JP Real State — sitio web

Rediseño del sitio de JP Real State (Paula Chavez & Juliana Osorio · The Team | lpt realty).

Sitio estático, sin dependencias: abre `index.html` o publícalo en cualquier hosting estático (GitHub Pages, Netlify, Vercel).

- `index.html` — estructura y contenido
- `styles.css` — diseño (blanco y negro, tipografías Inter Tight + Instrument Serif)
- `main.js` — animaciones con GSAP + ScrollTrigger y scroll suave con Lenis (cargados desde CDN): preloader con contador, títulos que se revelan, galería horizontal anclada, marquesina reactiva al scroll, vista previa de imágenes en Servicios, cursor con inversión de color, botones magnéticos y formulario que envía la cita por WhatsApp
- `assets/` — logo, foto del equipo e imágenes

Respeta `prefers-reduced-motion` y funciona en móvil.
