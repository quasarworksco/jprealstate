/* =========================================================
   Configuración de servicios externos — JP Real Estate
   ---------------------------------------------------------
   - Firebase / Firestore: base de datos compartida en tiempo real
     para el panel admin (/admin), el formulario de redes (/registro)
     y la agenda de citas del sitio.
     Con `enabled: false` (o abriendo la página con ?local=1) todo se
     guarda en el navegador con el mismo modelo de colecciones, útil
     para probar sin conexión.
     La configuración web de Firebase es pública por diseño: la
     seguridad la dan las reglas de Firestore (ver firestore.rules).
   ========================================================= */
window.JP_CONFIG = {
  // Cuenta principal (dueña del panel): siempre administradora.
  // Debe coincidir con el correo escrito en firestore.rules.
  // La contraseña NUNCA se guarda en el código.
  ownerEmail: 'jprealstatefl@gmail.com',
  whatsapp: '13219612892',
  firebase: {
    enabled: true,
    apiKey: 'AIzaSyBILDUoXDSwMCF0ZfdsqyPbJpuDOfbi7iE',
    authDomain: 'jprealestate-ebc82.firebaseapp.com',
    projectId: 'jprealestate-ebc82',
    storageBucket: 'jprealestate-ebc82.firebasestorage.app',
    messagingSenderId: '420138733720',
    appId: '1:420138733720:web:f4f686a82ea15771c700ed'
  }
};
