/* ==========================================
   VISUAL COMPANION — APP
   v3.0 — Ethical Improvements:
   1. Error Reporting (voice + button + feedback logging)
   2. Multi-frame Hazard Validation (safety-first alerts + fallback)
   3. Transparency Labels (AI vs rule-based decisions)
   4. Adaptive Processing (low-power mode)
========================================== */
const App = {
  video: null,
  monitorInterval: null,
  isAnalyzing: false,
  _greetCooldowns: {},

  /* Ethical Issue 1: Error report state */
  _lastDescription: "",
  _feedbackLog: [],

  /* Ethical Issue 2: Multi-frame hazard tracking */
  _hazardFrameCount: 0,
  _lastHazardText: "",
  HAZARD_CONFIRM_FRAMES: 2,  // need 2 consecutive hazard detections to trigger alert

  /* Ethical Issue 4: Power mode */
  _lowPowerMode: false,
  _frameSkipCounter: 0,

  /* ===============================
     INIT
  =============================== */
  async init() {
    this.renderCommands();
    try { await AI.loadModels(); } catch(e) { console.warn("Face models unavailable:", e.message); }
    await People.load();

    // Load saved feedback log
    this._loadFeedbackLog();

    document.getElementById("vbStatus").textContent = "Ready — say a command";
    document.getElementById("statusPill").textContent = "READY";

    setTimeout(() => this._showWelcomeIntro(), 600);
  },

  /* ===============================
     WELCOME INTRO (trimmed for brevity, same logic as before)
  =============================== */
  _showWelcomeIntro() {
    if (!document.getElementById("vcIntroStyles")) {
      const s = document.createElement("style");
      s.id = "vcIntroStyles";
      s.textContent = `
        @keyframes vcFadeIn  { from{opacity:0}to{opacity:1} }
        @keyframes vcSlideUp { from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)} }
      `;
      document.head.appendChild(s);
    }

    const featured = [
      { cmd: "start camera",     desc: "Turn on the camera",       say: "Say start camera, to turn on the camera." },
      { cmd: "start monitor",    desc: "Auto-describe the scene",  say: "Say start monitor, to automatically describe what's around you." },
      { cmd: "analyze",          desc: "Instant description",      say: "Say analyze, for a quick description of what's in front of you right now." },
      { cmd: "who is this",      desc: "Identify a face",          say: "Say who is this, to identify the person in front of the camera." },
      { cmd: "save this person", desc: "Remember someone new",     say: "Say save this person, to remember a new face." },
      { cmd: "report error",     desc: "Report AI mistakes",       say: "Say report error, if I describe something wrong." },
      { cmd: "low power",        desc: "Save battery",             say: "Say low power, to save battery by scanning less often." },
      { cmd: "help",             desc: "See all commands",         say: "And say help, to see the full list at any time." },
    ];

    const overlay = document.createElement("div");
    overlay.id = "welcomeOverlay";
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:9999;
      display:flex;align-items:center;justify-content:center;
      background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);
      animation:vcFadeIn .35s ease;
    `;

    const box = document.createElement("div");
    box.style.cssText = `
      background:#0d0e14;border:1px solid #2a2d3e;border-radius:16px;
      padding:28px 32px;max-width:480px;width:92%;text-align:center;
      font-family:inherit;color:#e8eaf0;
      animation:vcSlideUp .4s ease;
    `;

    const cmdRowsHTML = featured.map((f, i) => `
      <div id="wcRow${i}" style="display:flex;flex-direction:column;gap:2px;padding:5px 7px;transition:background .3s;border-radius:6px">
        <span style="color:#c8cadc;font-weight:500;font-size:.79rem">"${f.cmd}"</span>
        <span style="color:#5a5f78;font-size:.69rem">${f.desc}</span>
      </div>
    `).join("");

    box.innerHTML = `
      <div style="font-size:2rem;margin-bottom:10px">👁</div>
      <h2 style="font-size:1.25rem;font-weight:600;margin:0 0 6px;color:#fff;letter-spacing:.03em">
        Welcome to Visual Companion
      </h2>
      <p style="font-size:.83rem;color:#8a8fa8;margin:0 0 16px;line-height:1.6">
        Your AI-powered eye — describes scenes, identifies people, and keeps you safe.
      </p>
      <div style="height:3px;border-radius:3px;background:#1e2130;margin-bottom:16px;overflow:hidden">
        <div id="wcBar" style="height:100%;width:0%;background:linear-gradient(90deg,#4f6ef7,#7c3aed);transition:width .12s linear"></div>
      </div>
      <div style="text-align:left;background:#13141d;border-radius:10px;padding:12px 14px;margin-bottom:16px">
        <div style="font-size:.68rem;letter-spacing:.1em;color:#4f6ef7;margin-bottom:8px;font-weight:600">VOICE COMMANDS</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px 8px">${cmdRowsHTML}</div>
      </div>
      <p style="font-size:.75rem;color:#5a5f78;margin:0 0 14px">
        Closing in <span id="wcCountdown">—</span>s
      </p>
      <button id="wcDismiss" style="
        background:transparent;border:1px solid #2a2d3e;color:#8a8fa8;
        padding:7px 22px;border-radius:8px;font-size:.8rem;cursor:pointer;
        transition:border-color .2s,color .2s;"
        onmouseover="this.style.borderColor='#4f6ef7';this.style.color='#fff'"
        onmouseout="this.style.borderColor='#2a2d3e';this.style.color='#8a8fa8'">
        Got it — dismiss
      </button>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    let dismissed = false;
    let countdownTimer = null;

    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      clearInterval(countdownTimer);
      window.speechSynthesis.cancel();
      overlay.style.transition = "opacity .3s";
      overlay.style.opacity = "0";
      setTimeout(() => { overlay.remove(); Speech.listen(); }, 320);
    };

    document.getElementById("wcDismiss").addEventListener("click", dismiss);

    const startCountdown = () => {
      if (dismissed) return;
      const SECS = 5;
      let rem = SECS;
      const cd = document.getElementById("wcCountdown");
      const bar = document.getElementById("wcBar");
      if (cd) cd.textContent = SECS;
      countdownTimer = setInterval(() => {
        if (dismissed) { clearInterval(countdownTimer); return; }
        rem -= 0.1;
        if (bar) bar.style.width = ((SECS - rem) / SECS * 100).toFixed(1) + "%";
        if (cd) cd.textContent = Math.ceil(rem);
        if (rem <= 0) dismiss();
      }, 100);
    };

    const speak = (text, onDone) => {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang  = Config?.VOICE?.lang  || "en-US";
      u.rate  = 0.9;
      u.pitch = Config?.VOICE?.pitch || 1;
      u.onend   = () => { setTimeout(() => { if (onDone) onDone(); }, 150); };
      u.onerror = () => { setTimeout(() => { if (onDone) onDone(); }, 150); };
      window.speechSynthesis.speak(u);
    };

    let cmdIndex = 0;
    const readNextCommand = () => {
      if (dismissed) return;
      if (cmdIndex >= featured.length) {
        speak("You are all set. Say start camera to begin.", () => {
          if (!dismissed) startCountdown();
        });
        return;
      }
      const i = cmdIndex++;
      const row = document.getElementById("wcRow" + i);
      if (row) {
        row.style.background = "#1a2240";
        setTimeout(() => { if (row) row.style.background = "transparent"; }, 1500);
      }
      speak(featured[i].say, readNextCommand);
    };

    speak("Welcome to Visual Companion.", () => {
      if (dismissed) return;
      speak("I am your AI powered assistant. I describe what's around you, identify people, and alert you to hazards.", () => {
        if (dismissed) return;
        speak("Here are the voice commands you can use.", () => {
          if (dismissed) return;
          setTimeout(readNextCommand, 200);
        });
      });
    });
  },

  /* ===============================
     START CAMERA
  =============================== */
  async startCamera() {
    try {
      if (this.video?.srcObject) return;
      this.video = document.getElementById("video");
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.video.srcObject = stream;
      document.getElementById("camPlaceholder").style.display = "none";
      document.getElementById("camBadge").textContent = "LIVE";
      document.getElementById("statusPill").textContent = "CAMERA ON";
      document.getElementById("btnMonitor").disabled = false;
      document.getElementById("btnAnalyze").disabled = false;
      document.getElementById("btnStop").disabled = false;
      document.getElementById("btnStart").disabled = true;
      Speech.speak("Camera started.");
    } catch (err) {
      console.error("Camera error:", err);
      Speech.speak("Please allow camera access.");
    }
  },

  /* ===============================
     START MONITOR
     Uses adaptive interval based on power mode (Ethical Issue 4)
  =============================== */
  startMonitor() {
    if (this.monitorInterval) return;
    const interval = Config.getMonitorInterval();
    this.monitorInterval = setInterval(() => { this.analyzeNow(); }, interval);
    document.getElementById("statusPill").textContent = "MONITORING";
    document.getElementById("scanLine").classList.add("active");
    const modeLabel = this._lowPowerMode ? " (low-power mode)" : "";
    Speech.speak(`Monitoring started${modeLabel}. Scanning every ${interval / 1000} seconds.`);
  },

  /* ===============================
     ANALYZE NOW
     Includes hazard validation (Ethical Issue 2)
     and transparency labels (Ethical Issue 3)
  =============================== */
  async analyzeNow() {
    if (this.isAnalyzing) return;
    if (!this.video?.srcObject) { Speech.speak("Start the camera first."); return; }

    // Ethical Issue 4: In low-power mode, skip every other frame
    if (this._lowPowerMode) {
      this._frameSkipCounter++;
      if (this._frameSkipCounter % 2 !== 0) return;
    }

    this.isAnalyzing = true;
    try {
      document.getElementById("thinkingIndicator").classList.add("show");
      const blob = await this._captureBlob();
      const form = new FormData();
      form.append("image", blob);
      const res = await fetch(Config.url("describe"), { method: "POST", body: form });
      const data = await res.json();
      document.getElementById("thinkingIndicator").classList.remove("show");

      if (data?.description) {
        this._lastDescription = data.description;

        // Ethical Issue 3: Determine source label
        const source = data.source || "ai";

        if (Config.AI.speakResults) Speech.speak(data.description);
        this.addLiveFeedCard(data.description, source);

        // Ethical Issue 2: Multi-frame hazard validation
        if (data.hazardDetected && data.hazard) {
          this._hazardFrameCount++;
          this._lastHazardText = data.hazard;

          if (this._hazardFrameCount >= this.HAZARD_CONFIRM_FRAMES) {
            this._showHazardAlert(data.hazard);
            this._hazardFrameCount = 0;
          }
        } else {
          this._hazardFrameCount = Math.max(0, this._hazardFrameCount - 1);
        }
      }

      // Handle fallback warning (Ethical Issue 2)
      if (data?.fallbackWarning) {
        Speech.speak(data.fallbackWarning);
        this.addLiveFeedCard(data.fallbackWarning, "safety");
      }

    } catch (err) {
      console.error("Analyze error:", err);
      document.getElementById("thinkingIndicator").classList.remove("show");
      // Ethical Issue 2: Fallback when network fails
      this.addLiveFeedCard("⚠️ Could not reach AI. Please be cautious and try again.", "safety");
      Speech.speak("Connection lost. Please proceed carefully.");
    }
    this.isAnalyzing = false;
  },

  /* ===============================
     HAZARD ALERT (Ethical Issue 2)
  =============================== */
  _showHazardAlert(hazardText) {
    const banner = document.getElementById("hazardBanner");
    const textEl = document.getElementById("hazardText");
    if (banner && textEl) {
      textEl.textContent = hazardText;
      banner.style.display = "flex";
    }
    // Speak hazard with priority
    window.speechSynthesis.cancel();
    Speech.speak("Safety alert! " + hazardText);
    this.addLiveFeedCard("⚠️ SAFETY: " + hazardText, "safety");
  },

  dismissHazard() {
    const banner = document.getElementById("hazardBanner");
    if (banner) banner.style.display = "none";
  },

  /* ===============================
     ERROR REPORTING (Ethical Issue 1)
  =============================== */
  openErrorReport() {
    document.getElementById("errorReportOverlay").style.display = "flex";
    document.getElementById("errorReportDetails").value = "";
    Speech.speak("Error report opened. Select what went wrong or describe it.");
  },

  closeErrorReport() {
    document.getElementById("errorReportOverlay").style.display = "none";
  },

  async submitErrorReport() {
    const errorType = document.querySelector('input[name="errorType"]:checked')?.value || "other";
    const details = document.getElementById("errorReportDetails")?.value || "";

    const report = {
      errorType,
      details,
      lastDescription: this._lastDescription,
      timestamp: new Date().toISOString()
    };

    // Save locally always
    this._feedbackLog.push(report);
    this._saveFeedbackLog();

    // Try to send to backend
    if (Config.backendAvailable()) {
      try {
        await fetch(Config.url("reportError"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(report)
        });
      } catch (err) {
        console.warn("Could not send report to backend:", err.message);
      }
    }

    this.closeErrorReport();
    Speech.speak("Thank you. Your feedback has been recorded and will help improve the system.");
    this.showToast("✅ Error report submitted");
  },

  _saveFeedbackLog() {
    try {
      localStorage.setItem(Config.FEEDBACK_STORAGE_KEY, JSON.stringify(this._feedbackLog));
    } catch (e) { console.warn("Could not save feedback log:", e.message); }
  },

  _loadFeedbackLog() {
    try {
      const raw = localStorage.getItem(Config.FEEDBACK_STORAGE_KEY);
      if (raw) this._feedbackLog = JSON.parse(raw);
    } catch (e) { this._feedbackLog = []; }
  },

  /* ===============================
     POWER MODE TOGGLE (Ethical Issue 4)
  =============================== */
  togglePowerMode() {
    this._lowPowerMode = !this._lowPowerMode;
    Config.lowPowerMode = this._lowPowerMode;

    const btn = document.getElementById("powerModeBtn");
    const icon = document.getElementById("powerIcon");
    const label = document.getElementById("powerLabel");

    if (this._lowPowerMode) {
      btn?.classList.add("low-power");
      if (icon) icon.textContent = "🔋";
      if (label) label.textContent = "ECO";
      Speech.speak("Low power mode on. Scanning less often to save battery.");
      this.showToast("🔋 Low-power mode ON");
    } else {
      btn?.classList.remove("low-power");
      if (icon) icon.textContent = "⚡";
      if (label) label.textContent = "NORMAL";
      Speech.speak("Normal power mode. Full speed scanning.");
      this.showToast("⚡ Normal power mode");
    }

    // Restart monitoring with new interval if currently active
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
      this.startMonitor();
    }
  },

  /* ===============================
     RECOGNIZE FACE
  =============================== */
  async recognizeCurrentFace() {
    if (!this.video?.srcObject) { Speech.speak("Start the camera first."); return; }
    this.showToast("🔍 Recognizing...");
    try {
      const blob = await this._captureBlob();
      const form = new FormData();
      form.append("image", blob);
      const res = await fetch(Config.url("recognize"), { method: "POST", body: form });
      const data = await res.json();
      if (data?.name) { this._announceRecognized(data.name); return; }
      const unknown = Config.AI.unknownLabel || "Unknown Person";
      Speech.speak(`I don't recognise this person.`);
      this.showToast(`❓ ${unknown}`);
    } catch (err) {
      console.error("Recognition error:", err);
      Speech.speak("Sorry, I couldn't identify that person.");
    }
  },

  /* ===============================
     SAVE PERSON FLOW
  =============================== */
  savePerson() {
    if (!this.video?.srcObject) { Speech.speak("Start the camera first."); return; }
    this._captureBlob().then(blob => {
      this._pendingBlob = blob;
      const canvas = document.getElementById("canvas");
      document.getElementById("savePreviewImg").src = canvas.toDataURL();
      document.getElementById("saveOverlay").style.display = "flex";
      document.getElementById("saveStatus").textContent = "Listening for name...";
      document.getElementById("saveVoiceHint").textContent = "Say the person's name or type below";
      document.getElementById("saveNameInput").value = "";
      document.getElementById("saveNameInput").style.display = "block";
      document.getElementById("saveConfirmBtn").style.display = "inline-block";
      Speech.stop();
      Speech.speak("Say the person's name.");
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.lang = Config?.VOICE?.lang || "en-US";
        rec.maxAlternatives = 1;
        rec.onresult = (e) => {
          const name = e.results[0][0].transcript.trim();
          document.getElementById("saveNameInput").value = name;
          document.getElementById("saveStatus").textContent = `Heard: "${name}" — confirm or edit below`;
        };
        rec.onerror = () => { document.getElementById("saveStatus").textContent = "Couldn't hear — type the name below"; };
        rec.onend = () => { setTimeout(() => Speech.listen(), 1000); };
        try { rec.start(); } catch (err) { console.warn("rec.start blocked:", err); setTimeout(() => Speech.listen(), 500); }
      }
    });
  },

  confirmSave() {
    const nameInput = document.getElementById("saveNameInput");
    const name = nameInput?.value?.trim();
    if (!name) {
      document.getElementById("saveStatus").textContent = "Please enter a name first";
      Speech.speak("Please say or type a name.");
      return;
    }
    this._doSave(name);
  },

  cancelSave() {
    this._pendingBlob = null;
    document.getElementById("saveOverlay").style.display = "none";
    document.getElementById("saveNameInput").style.display = "none";
    document.getElementById("saveConfirmBtn").style.display = "none";
    setTimeout(() => Speech.listen(), 500);
  },

  async savePersonWithName(name) {
    if (!name || name.trim() === "") { Speech.speak("Please provide a name."); return; }
    if (!this.video?.srcObject) { Speech.speak("Start the camera first."); return; }
    document.getElementById("saveOverlay").style.display = "flex";
    document.getElementById("saveStatus").textContent = `Saving "${name}"...`;
    document.getElementById("saveVoiceHint").textContent = `Name: "${name}"`;
    await this._doSave(name);
  },

  /* ===============================
     STOP ALL
  =============================== */
  stopAll() {
    if (this.monitorInterval) { clearInterval(this.monitorInterval); this.monitorInterval = null; }
    if (this.video?.srcObject) { this.video.srcObject.getTracks().forEach(t => t.stop()); this.video.srcObject = null; }
    document.getElementById("camPlaceholder").style.display = "flex";
    document.getElementById("camBadge").textContent = "NO CAMERA";
    document.getElementById("scanLine").classList.remove("active");
    document.getElementById("statusPill").textContent = "STANDBY";
    document.getElementById("btnStart").disabled = false;
    document.getElementById("btnMonitor").disabled = true;
    document.getElementById("btnAnalyze").disabled = true;
    document.getElementById("btnStop").disabled = true;
    this.dismissHazard();
    Speech.speak("Stopped.");
  },

  /* ===============================
     LIVE FEED CARD
     Ethical Issue 3: Shows source label (AI / Rule / Safety)
  =============================== */
  addLiveFeedCard(description, source = "ai") {
    const pane = document.getElementById("pane-live");
    const empty = document.getElementById("emptyLive");
    if (empty) empty.style.display = "none";

    // Ethical Issue 3: Source badge for transparency
    let sourceBadge = "";
    if (source === "ai") {
      sourceBadge = '<span class="feed-source ai-source">🤖 AI GENERATED</span>';
    } else if (source === "rule") {
      sourceBadge = '<span class="feed-source rule-source">📏 RULE-BASED</span>';
    } else if (source === "safety") {
      sourceBadge = '<span class="feed-source safety-source">⚠️ SAFETY ALERT</span>';
    }

    // Ethical Issue 4: Low-power badge
    const powerBadge = this._lowPowerMode ? '<span class="low-power-badge">🔋 ECO</span>' : "";

    const card = document.createElement("div");
    card.className = "feed-card";
    card.innerHTML = `
      <div class="feed-time">
        ${new Date().toLocaleTimeString()}${sourceBadge}${powerBadge}
      </div>
      <div class="feed-text">${description}</div>
    `;
    pane.insertBefore(card, pane.firstChild);
  },

  showToast(msg) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); }, 3000);
  },

  switchTab(tabName) {
    document.querySelectorAll(".tab").forEach(t => { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    const tab = document.querySelector(`[data-tab="${tabName}"]`);
    if (tab) { tab.classList.add("active"); tab.setAttribute("aria-selected", "true"); }
    document.getElementById(`pane-${tabName}`)?.classList.add("active");
  },

  renderCommands() {
    const grid = document.getElementById("commandsGrid");
    if (!grid) return;
    const commands = [
      { cmd: "start camera",               desc: "Turns on the camera" },
      { cmd: "start monitor",              desc: "Auto-describes every few seconds" },
      { cmd: "analyze / describe",         desc: "Describe what's in front of you now" },
      { cmd: "who is this",                desc: "Identify the person on screen" },
      { cmd: "do you know [name]",         desc: "Check if someone is saved" },
      { cmd: "save this person as [name]", desc: "Save person with a spoken name" },
      { cmd: "save this person",           desc: "Save — then say the name" },
      { cmd: "forget [name]",              desc: "Remove a saved person" },
      { cmd: "who have you seen",          desc: "List all saved people" },
      { cmd: "show people",                desc: "Open saved people tab" },
      { cmd: "report error",               desc: "Report wrong AI description" },
      { cmd: "low power / save battery",   desc: "Toggle battery-saving mode" },
      { cmd: "live feed",                  desc: "Go to live descriptions" },
      { cmd: "commands / help",            desc: "Show this list" },
      { cmd: "stop",                       desc: "Stop camera and monitoring" },
    ];
    grid.innerHTML = commands.map(c => `
      <div class="command-item">
        <div class="command-phrase">"${c.cmd}"</div>
        <div class="command-desc">${c.desc}</div>
      </div>
    `).join("");
  },

  /* ===============================
     PRIVATE HELPERS
  =============================== */
  async _captureBlob(quality = 0.9) {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width  = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    ctx.drawImage(this.video, 0, 0);

    // Ethical Issue 4: Lower quality in low-power mode to reduce processing
    const q = this._lowPowerMode ? 0.6 : quality;
    return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", q));
  },

  async _doSave(name) {
    const statusEl = document.getElementById("saveStatus");
    try {
      if (statusEl) statusEl.textContent = `Saving "${name}"...`;
      const blob = this._pendingBlob || await this._captureBlob();
      this._pendingBlob = null;
      await People.save(name, blob);
      if (statusEl) statusEl.textContent = `✅ Saved: ${name}`;
      setTimeout(() => {
        document.getElementById("saveOverlay").style.display = "none";
        document.getElementById("saveNameInput").style.display = "none";
        document.getElementById("saveConfirmBtn").style.display = "none";
      }, 800);
    } catch (err) {
      console.error("Save error:", err);
      if (statusEl) statusEl.textContent = "❌ Save failed — try again";
      Speech.speak("Sorry, something went wrong while saving.");
      setTimeout(() => { document.getElementById("saveOverlay").style.display = "none"; }, 1500);
    } finally {
      setTimeout(() => Speech.listen(), 1200);
    }
  },

  _announceRecognized(name) {
    const cooldown = Config?.PEOPLE?.greetCooldownMs ?? 10000;
    const now = Date.now();
    const last = this._greetCooldowns[name] || 0;
    if (now - last < cooldown) { console.log(`Greet cooldown active for ${name}`); return; }
    this._greetCooldowns[name] = now;
    const person = People.recognize(name);
    if (person && Config?.PEOPLE?.greetOnRecognise !== false) {
      Speech.speak(`Hello, ${name}!`);
      this.showToast(`👋 Hello, ${name}!`);
    }
    this.addLiveFeedCard(`✅ Recognised: <strong>${name}</strong>`, "rule");
    this.switchTab("people");
  }
};

window.App = App;

window.addEventListener("DOMContentLoaded", () => App.init());
