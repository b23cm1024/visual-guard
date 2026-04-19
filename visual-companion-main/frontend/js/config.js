/* ==========================================
   VISUAL COMPANION — CONFIG
   v2.1 — added recognize + deletePerson endpoints
========================================== */
window.Config = {

  /* ===============================
     Backend API
  =============================== */
  API_BASE: "https://visual-companion-backend.onrender.com",
  ENDPOINTS: {
    describe:     "/describe",
    savePerson:   "/save-person",
    recognize:    "/recognize",
    people:       "/people",
    deletePerson: "/people"   // DELETE /people/:name
  },

  /* ===============================
     Face API model path
  =============================== */
  FACE_MODELS: "/models",

  /* ===============================
     AI / Recognition settings
  =============================== */
  AI: {
    speakResults:        true,
    confidenceThreshold: 0.6,
    maxResults:          5,
    unknownLabel:        "Unknown Person",
    saveUnknownFaces:    false
  },

  /* ===============================
     People / Recognition behaviour
  =============================== */
  PEOPLE: {
    storageKey:       "visual_companion_people",
    maxImageSizeKB:   200,
    greetOnRecognise: true,
    greetCooldownMs:  10000
  },

  /* ===============================
     Monitoring (live camera scan)
  =============================== */
  MONITOR: {
    interval:  4000,
    autoStart: true
  },

  /* ===============================
     Voice / Speech
  =============================== */
  VOICE: {
    lang:       "en-US",
    continuous: true,
    rate:       1,
    pitch:      1
  },

  /* ===============================
     HELPER — is backend reachable?
  =============================== */
  backendAvailable() {
    return (
      typeof this.API_BASE === "string" &&
      this.API_BASE.trim() !== "" &&
      typeof this.ENDPOINTS === "object"
    );
  },

  /* ===============================
     HELPER — full URL builder
     Config.url("savePerson")             → "https://.../save-person"
     Config.url("deletePerson", "Rahul")  → "https://.../people/Rahul"
  =============================== */
  url(endpoint, param) {
    const base = this.ENDPOINTS[endpoint];
    if (!base) {
      console.warn(`Config.url: unknown endpoint "${endpoint}"`);
      return null;
    }
    const full = this.API_BASE + base;
    return param ? `${full}/${encodeURIComponent(param)}` : full;
  }
};
