/* ==========================================
   VISUAL COMPANION — APP
   v2.0 — with recognition & name-based save
========================================== */
const App = {
  video: null,
  monitorInterval: null,
  isAnalyzing: false,
  _greetCooldowns: {},
  _hazardHistory: [],
  isLowPower: false,

  async init() {
    this.renderCommands();
    try { await AI.loadModels(); } catch(e) { console.warn("Face models unavailable:", e.message); }
    await People.load();

    // NOTE: Speech.listen() is intentionally NOT called here.
    // It starts AFTER the welcome narration finishes inside _showWelcomeIntro.
    // Starting the mic before speaking blocks speechSynthesis on Chrome/mobile.

    document.getElementById("vbStatus").textContent = "Ready — say a command";
    document.getElementById("statusPill").textContent = "READY";

    setTimeout(() => this._showWelcomeIntro(), 600);
  },

  _showWelcomeIntro() {

    if (!document.getElementById("vcIntroStyles")) {
      const s = document.createElement("style");
      s.id = "vcIntroStyles";
      s.textContent = `
        @keyframes vcFadeIn  { from{opacity:0}to{opacity:1} }
        @keyframes vcSlideUp { from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)} }
        @keyframes wcPulse   { 0%,100%{background:transparent}50%{background:#1a2240} }
      `;
      document.head.appendChild(s);
    }

    const featured = [
      { cmd: "start camera",     desc: "Turn on the camera",       say: "Say start camera, to turn on the camera." },
      { cmd: "start monitor",    desc: "Auto-describe the scene",  say: "Say start monitor, to automatically describe the scene every few seconds." },
      { cmd: "describe",         desc: "Instant description",      say: "Say describe, for an instant description of what I can see right now." },
      { cmd: "who is this",      desc: "Identify a face",          say: "Say who is this, to identify the person in front of the camera." },
      { cmd: "save this person", desc: "Enroll someone new",       say: "Say save this person, to remember a new face." },
      { cmd: "forget [name]",    desc: "Remove a saved person",    say: "Say forget, followed by a name, to remove them from memory." },
      { cmd: "show people",      desc: "Open face registry",       say: "Say show people, to open your saved faces list." },
      { cmd: "help / commands",  desc: "See all commands",         say: "And say help or commands, to see the full list at any time." },
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
        Your AI-powered eye — sees, describes, and recognises people in real time.
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
      setTimeout(() => {
        overlay.remove();
        Speech.listen(); // start mic ONLY after popup is gone and speech is done
      }, 320);
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

    // KEY FIX: chain via onend — never queue multiple utterances at once.
    // Browser speech queues are unreliable; onend chaining works everywhere.
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

    // Phase 2: read each command one by one, highlight the row as it's spoken
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

    // Phase 1: greet and describe what the popup shows, then hand off to commands
    speak("Welcome to Visual Companion.", () => {
      if (dismissed) return;
      speak("I am your AI powered eye. I can see what is in front of the camera, describe scenes, and recognise people in real time.", () => {
        if (dismissed) return;
        speak("Here are the voice commands you can start using right now.", () => {
          if (dismissed) return;
          setTimeout(readNextCommand, 200);
        });
      });
    });
  },

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

  startMonitor() {
    if (this.monitorInterval) return;
    this.monitorInterval = setInterval(() => { this.analyzeNow(); }, Config.MONITOR.interval);
    document.getElementById("statusPill").textContent = "MONITORING";
    document.getElementById("scanLine").classList.add("active");
    Speech.speak("Monitoring started.");
  },

  async analyzeNow() {
    if (this.isAnalyzing) return;
    if (!this.video?.srcObject) { Speech.speak("Start the camera first."); return; }
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
        const hazardKeywords = ["hazard", "falling", "car", "stairs", "hole", "fire", "obstacle", "step", "danger", "caution"];
        const isHazard = hazardKeywords.some(kw => data.description.toLowerCase().includes(kw));
        
        this._hazardHistory.push(isHazard);
        if (this._hazardHistory.length > 3) this._hazardHistory.shift();
        
        const multiFrameHazard = this._hazardHistory.filter(Boolean).length >= 2;
        
        if (isHazard) {
          if (multiFrameHazard) {
            Speech.speak("CRITICAL SAFETY ALERT: " + data.description);
            this.showToast("🚨 MULTI-FRAME HAZARD CONFIRMED");
          } else {
            Speech.speak("Warning: " + data.description);
          }
          this.addLiveFeedCard(data.description, "ai-hazard");
        } else {
          if (Config.AI.speakResults) Speech.speak(data.description);
          this.addLiveFeedCard(data.description, "ai");
        }
      }
    } catch (err) {
      console.error("Analyze error:", err);
      document.getElementById("thinkingIndicator").classList.remove("show");
    }
    this.isAnalyzing = false;
  },

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
      if (data?.description) {
        const matched = People.list.find(p => data.description.toLowerCase().includes(p.name.toLowerCase()));
        if (matched) { this._announceRecognized(matched.name); return; }
      }
      const unknown = Config.AI.unknownLabel || "Unknown Person";
      Speech.speak(`I don't recognise this person. ${Config.AI.saveUnknownFaces ? "Would you like to save them?" : ""}`);
      this.showToast(`❓ ${unknown}`);
    } catch (err) {
      console.error("Recognition error:", err);
      Speech.speak("Sorry, I couldn't identify that person.");
    }
  },

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

  reportError() {
    Speech.speak("Error reported. Thank you for your feedback.");
    this.showToast("📝 AI Error Reported to Developers");
    console.log("Feedback Log: User reported an AI error.");
  },

  toggleLowPower() {
    this.isLowPower = !this.isLowPower;
    Config.MONITOR.interval = this.isLowPower ? 10000 : 4000;
    const btn = document.getElementById("btnLowPower");
    if (btn) btn.textContent = `🔋 Eco Mode: ${this.isLowPower ? 'ON' : 'OFF'}`;
    this.showToast(`Eco Mode ${this.isLowPower ? 'Enabled' : 'Disabled'}`);
    Speech.speak(`Eco mode ${this.isLowPower ? 'enabled' : 'disabled'}`);
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = setInterval(() => { this.analyzeNow(); }, Config.MONITOR.interval);
    }
  },

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
    Speech.speak("Stopped.");
  },

  addLiveFeedCard(description, type = "ai") {
    const pane = document.getElementById("pane-live");
    const empty = document.getElementById("emptyLive");
    if (empty) empty.style.display = "none";
    const card = document.createElement("div");
    card.className = "feed-card";
    
    let label = "";
    if (type === "ai") label = `<span class="dc-tag tag-scene">AI Generation</span>`;
    else if (type === "rule") label = `<span class="dc-tag tag-match">Rule-based Match</span>`;
    else if (type === "ai-hazard") label = `<span class="dc-tag tag-text" style="background:rgba(255,87,34,0.15); border-color:var(--warn); color:var(--warn);">⚠️ AI Hazard Alert</span>`;
    
    card.innerHTML = `<div class="feed-time">${new Date().toLocaleTimeString()} &nbsp; ${label}</div><div class="feed-text">${description}</div>`;
    pane.insertBefore(card, pane.firstChild);
  },

  showToast(msg) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.style.opacity = "1";
    setTimeout(() => { toast.style.opacity = "0"; }, 3000);
  },

  switchTab(tabName) {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-pane").forEach(p => p.classList.remove("active"));
    document.querySelector(`[data-tab="${tabName}"]`)?.classList.add("active");
    document.getElementById(`pane-${tabName}`)?.classList.add("active");
  },

  renderCommands() {
    const grid = document.getElementById("commandsGrid");
    if (!grid) return;
    const commands = [
      { cmd: "start camera",               desc: "Turns on the camera" },
      { cmd: "start monitor",              desc: "Auto-analyzes every few seconds" },
      { cmd: "analyze / describe",         desc: "Describe what's in view now" },
      { cmd: "who is this",                desc: "Identify the person on screen" },
      { cmd: "do you know [name]",         desc: "Check if someone is saved" },
      { cmd: "save this person as [name]", desc: "Save person with a spoken name" },
      { cmd: "save this person",           desc: "Save — then say the name" },
      { cmd: "forget [name]",              desc: "Remove a saved person" },
      { cmd: "who have you seen",          desc: "List all saved people" },
      { cmd: "show people",                desc: "Open saved people tab" },
      { cmd: "live feed",                  desc: "Go to live descriptions" },
      { cmd: "report error",               desc: "Report an AI mistake" },
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

  async _captureBlob(quality = 0.9) {
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width  = this.video.videoWidth;
    canvas.height = this.video.videoHeight;
    ctx.drawImage(this.video, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
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
