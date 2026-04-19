/* ==========================================
   VISUAL COMPANION — CONFIG
   v3.0 — ethical improvements:
   - Error report endpoint
   - Power mode settings
   - Adaptive processing intervals
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
    deletePerson: "/people",       // DELETE /people/:name
    reportError:  "/report-error"  // POST — Ethical Issue 1
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
     Ethical Issue 4: Adaptive intervals
  =============================== */
  MONITOR: {
    interval:       4000,   // Normal mode: 4s
    lowPowerInterval: 8000, // Low-power mode: 8s — saves battery
    autoStart:      true
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
     Power Mode (Ethical Issue 4: Energy)
     false = normal, true = low-power
  =============================== */
  lowPowerMode: false,

  /* ===============================
     Error report log (Ethical Issue 1: local)
  =============================== */
  FEEDBACK_STORAGE_KEY: "visual_companion_feedback",

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
  =============================== */
  url(endpoint, param) {
    const base = this.ENDPOINTS[endpoint];
    if (!base) {
      console.warn(`Config.url: unknown endpoint "${endpoint}"`);
      return null;
    }
    const full = this.API_BASE + base;
    return param ? `${full}/${encodeURIComponent(param)}` : full;
  },

  /* ===============================
     HELPER — get current monitoring interval
     Returns shorter interval in normal mode,
     longer in low-power mode (Ethical Issue 4)
  =============================== */
  getMonitorInterval() {
    return this.lowPowerMode
      ? this.MONITOR.lowPowerInterval
      : this.MONITOR.interval;
  }
};
