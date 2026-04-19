/* ==========================================
   VISUAL COMPANION — SPEECH
   v2.0 — with people recognition commands
========================================== */
window.Speech = {
  recognition: null,
  isListening: false,
  _restartTimer: null,

  /* ===============================
     TEXT TO SPEECH
  =============================== */
  speak(text) {
    if (!text) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang   = Config?.VOICE?.lang  || "en-US";
    utter.rate   = Config?.VOICE?.rate  || 1;
    utter.pitch  = Config?.VOICE?.pitch || 1;
    window.speechSynthesis.speak(utter);
  },

  /* ===============================
     START LISTENING
  =============================== */
  listen() {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech recognition not supported");
      this._setStatus("Voice not supported in this browser");
      return;
    }

    if (this.isListening) return;

    this.recognition = new SpeechRecognition();
    this.recognition.lang            = Config?.VOICE?.lang       || "en-US";
    this.recognition.continuous      = Config?.VOICE?.continuous ?? true;
    this.recognition.interimResults  = false;

    this.recognition.onstart = () => {
      this.isListening = true;
      this._setStatus("Listening...");
      this._setMic(true);
    };

    this.recognition.onresult = (e) => {
      const text = e.results[e.results.length - 1][0].transcript.trim();
      this._setHeard(`"${text}"`);
      console.log("Heard:", text);
      this.process(text);
    };

    this.recognition.onerror = (e) => {
      console.error("Speech error:", e.error);
      // "no-speech" is harmless — don't alarm the user
      const msg = e.error === "no-speech"
        ? "Listening..."
        : "Voice error — retrying...";
      this._setStatus(msg);
      this.isListening = false;
      this._scheduleRestart(2000);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this._setMic(false);
      this._scheduleRestart(800);
    };

    try {
      this.recognition.start();
    } catch (err) {
      console.warn("Recognition start blocked:", err.message);
    }
  },

  /* ===============================
     STOP LISTENING
  =============================== */
  stop() {
    clearTimeout(this._restartTimer);
    try { this.recognition?.stop(); } catch (_) {}
    this.isListening = false;
    this._setStatus("Microphone off");
    this._setMic(false);
  },

  /* ===============================
     PROCESS VOICE COMMANDS
  =============================== */
  process(rawText) {
    if (!rawText) return;
    const text = rawText.toLowerCase().trim();
    console.log("Processing command:", text);

    /* --- Camera & monitoring --- */
    if (text.includes("start camera")) {
      App?.startCamera?.();
      this.speak("Starting camera");

    } else if (text.includes("start monitor")) {
      App?.startMonitor?.();
      this.speak("Monitoring started");

    } else if (
      text.includes("analyze") ||
      text.includes("analyse") ||
      text.includes("describe")
    ) {
      App?.analyzeNow?.();
      this.speak("Analyzing");

    } else if (text.includes("stop")) {
      App?.stopAll?.();
      this.speak("Stopping everything");

    /* --- Save person --- */
    } else if (
      text.includes("save this person") ||
      text.includes("save person")
    ) {
      // Allow "save this person as Rahul"
      const asMatch = text.match(/save (?:this )?person as (.+)/);
      if (asMatch) {
        const name = this._toTitleCase(asMatch[1].trim());
        App?.savePersonWithName?.(name);
        this.speak(`Saving ${name}`);
      } else {
        App?.savePerson?.();
        this.speak("Please say the person's name");
      }

    /* --- Recognise: "who is this" / "who is in front" --- */
    } else if (
      text.includes("who is this") ||
      text.includes("who is that") ||
      text.includes("who is in front") ||
      text.includes("identify person") ||
      text.includes("recognise") ||
      text.includes("recognize")
    ) {
      App?.recognizeCurrentFace?.();

    /* --- Do you know [name]? --- */
    } else if (
      text.includes("do you know") ||
      text.includes("have you seen")
    ) {
      const nameMatch =
        text.match(/do you know (.+)/) ||
        text.match(/have you seen (.+)/);
      if (nameMatch) {
        const name = this._toTitleCase(nameMatch[1].replace(/[?.!]$/, "").trim());
        People?.identify?.(name);
      } else {
        this.speak("Please say a name, like: do you know Rahul");
      }

    /* --- Who have you seen? / List people --- */
    } else if (
      text.includes("who have you seen") ||
      text.includes("list people") ||
      text.includes("show people") ||
      text.includes("saved people")
    ) {
      const count = People?.list?.length || 0;
      if (count === 0) {
        this.speak("I don't have anyone saved yet.");
      } else {
        const names = People.list.slice(0, 5).map(p => p.name).join(", ");
        this.speak(`I know ${count} ${count === 1 ? "person" : "people"}: ${names}`);
      }
      App?.switchTab?.("people");

    /* --- Forget [name] --- */
    } else if (text.includes("forget")) {
      const nameMatch = text.match(/forget (.+)/);
      if (nameMatch) {
        const name = this._toTitleCase(nameMatch[1].replace(/[?.!]$/, "").trim());
        People?.delete?.(name);
      } else {
        this.speak("Please say a name, like: forget Rahul");
      }

    /* --- Navigation --- */
    } else if (text.includes("commands") || text.includes("help")) {
      App?.switchTab?.("commands");

    } else if (text.includes("live feed") || text.includes("live view")) {
      App?.switchTab?.("live");

    /* --- Error Reporting (Ethical Issue 1) --- */
    } else if (text.includes("report error") || text.includes("report problem") || text.includes("wrong")) {
      App?.openErrorReport?.();
      this.speak("Opening error report. Tell me what went wrong.");

    /* --- Power Mode (Ethical Issue 4) --- */
    } else if (
      text.includes("low power") || text.includes("power save") ||
      text.includes("save battery") || text.includes("eco mode")
    ) {
      App?.togglePowerMode?.();

    /* --- Unrecognised --- */
    } else {
      console.log("No command matched for:", text);
    }
  },

  /* ===============================
     PRIVATE HELPERS
  =============================== */
  _scheduleRestart(delay) {
    clearTimeout(this._restartTimer);
    this._restartTimer = setTimeout(() => this.listen(), delay);
  },

  _setStatus(msg) {
    const el = document.getElementById("vbStatus");
    if (el) el.textContent = msg;
  },

  _setHeard(msg) {
    const el = document.getElementById("vbHeard");
    if (el) el.textContent = msg;
  },

  _setMic(active) {
    ["micOrb", "micOrb2"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.opacity = active ? "1" : "0.3";
    });
  },

  _toTitleCase(str) {
    return str.replace(/\b\w/g, c => c.toUpperCase());
  }
};
