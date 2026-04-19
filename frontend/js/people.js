/* ==========================================
   VISUAL COMPANION — PEOPLE MANAGER
   v2.0 — with local persistence & recognition
========================================== */
window.People = {
  list: [],

  /* ===============================
     STORAGE KEY
  =============================== */
  STORAGE_KEY: "visual_companion_people",

  /* ===============================
     LOAD PEOPLE
     Tries backend first, falls back to localStorage
  =============================== */
  async load() {
    // Always load from localStorage first so UI is instant
    this._loadFromStorage();

    // Then try to sync from backend (if Config is available)
    if (typeof Config !== "undefined" && Config?.API_BASE && Config?.ENDPOINTS?.people) {
      try {
        const res = await fetch(Config.API_BASE + Config.ENDPOINTS.people);
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          this.list = data;
          this._saveToStorage(); // Keep local copy in sync
          console.log(`Loaded ${this.list.length} people from backend ✅`);
        }
      } catch (err) {
        console.warn("⚠️ Backend unavailable, using local data:", err.message);
      }
    }

    this.render();
  },

  /* ===============================
     SAVE PERSON
     Saves to localStorage + optionally backend
  =============================== */
  async save(name, imageBlob) {
    // Basic validation
    if (!name || name.trim() === "") {
      console.warn("❌ Name missing");
      App?.showToast?.("Name is required");
      return;
    }
    if (!imageBlob) {
      console.warn("❌ Image missing");
      App?.showToast?.("Image is required");
      return;
    }

    const trimmedName = name.trim();

    // Check for duplicate
    const existing = this.recognize(trimmedName);
    if (existing) {
      App?.showToast?.(`⚠️ ${trimmedName} is already saved`);
      Speech?.speak?.(`${trimmedName} is already in your people list.`);
      return;
    }

    // Convert imageBlob to base64 for localStorage
    const imageBase64 = await this._blobToBase64(imageBlob);

    const person = {
      id: Date.now().toString(),
      name: trimmedName,
      imageUrl: imageBase64,         // local base64 for display & recognition
      photoUrl: imageBase64,
      timestamp: new Date().toISOString()
    };

    // Save locally first (instant, always works)
    this.list.unshift(person);
    this._saveToStorage();
    this.render();
    Speech?.speak?.(`${trimmedName} has been saved.`);
    App?.showToast?.(`✅ Saved: ${trimmedName}`);
    console.log(`Person saved locally: ${trimmedName} ✅`);

    // Also try backend (non-blocking)
    if (typeof Config !== "undefined" && Config?.API_BASE && Config?.ENDPOINTS?.savePerson) {
      try {
        const form = new FormData();
        form.append("name", trimmedName);
        form.append("image", imageBlob);
        const res = await fetch(Config.API_BASE + Config.ENDPOINTS.savePerson, {
          method: "POST",
          body: form
        });
        const data = await res.json();
        if (data && (data.success || data.person)) {
          // Update with server's version if it has a better URL
          if (data.person?.photoUrl || data.person?.imageUrl) {
            const idx = this.list.findIndex(p => p.id === person.id);
            if (idx !== -1) {
              this.list[idx] = { ...person, ...data.person, imageUrl: imageBase64 };
              this._saveToStorage();
              this.render();
            }
          }
          console.log(`Person also synced to backend ✅`);
        }
      } catch (err) {
        console.warn("⚠️ Backend sync failed (local save still succeeded):", err.message);
      }
    }
  },

  /* ===============================
     RECOGNIZE PERSON BY NAME
     Returns the person object or null
  =============================== */
  recognize(name) {
    if (!name) return null;
    const query = name.trim().toLowerCase();
    return this.list.find(p => p.name.toLowerCase() === query) || null;
  },

  /* ===============================
     SEARCH / FILTER PEOPLE
     Returns array of matching people
  =============================== */
  search(query) {
    if (!query || query.trim() === "") return [...this.list];
    const q = query.trim().toLowerCase();
    return this.list.filter(p => p.name.toLowerCase().includes(q));
  },

  /* ===============================
     DELETE PERSON BY NAME
  =============================== */
  delete(name) {
    if (!name) return;
    const before = this.list.length;
    this.list = this.list.filter(p => p.name.toLowerCase() !== name.trim().toLowerCase());
    if (this.list.length < before) {
      this._saveToStorage();
      this.render();
      Speech?.speak?.(`${name} has been removed.`);
      App?.showToast?.(`🗑️ Removed: ${name}`);
      console.log(`Person deleted: ${name} ✅`);
      // Also delete from backend (non-blocking)
      if (typeof Config !== "undefined" && Config.backendAvailable?.()) {
        fetch(Config.url("deletePerson", name), { method: "DELETE" })
          .then(r => r.ok ? console.log(`Backend delete ok: ${name}`) : console.warn(`Backend delete failed: ${name}`))
          .catch(err => console.warn("Backend delete error:", err.message));
      }
    } else {
      console.warn(`Person not found: ${name}`);
    }
  },

  /* ===============================
     IDENTIFY — check if a name is known
     Returns a spoken/display string
  =============================== */
  identify(name) {
    const person = this.recognize(name);
    if (person) {
      const when = person.timestamp
        ? `first saved on ${new Date(person.timestamp).toLocaleDateString()}`
        : "";
      const msg = `I know ${person.name}${when ? ", " + when : ""}.`;
      Speech?.speak?.(msg);
      App?.showToast?.(`✅ Recognized: ${person.name}`);
      return person;
    } else {
      const msg = `I don't recognise anyone named ${name}.`;
      Speech?.speak?.(msg);
      App?.showToast?.(`❓ Unknown: ${name}`);
      return null;
    }
  },

  /* ===============================
     RENDER PEOPLE LIST IN UI
  =============================== */
  render(people = null) {
    const displayList = people || this.list;
    const pane = document.getElementById("pane-people");
    const empty = document.getElementById("emptyPeople");
    if (!pane) return;

    // Remove old cards
    pane.querySelectorAll(".person-card").forEach(c => c.remove());

    if (!displayList || displayList.length === 0) {
      if (empty) empty.style.display = "flex";
      return;
    }
    if (empty) empty.style.display = "none";

    displayList.forEach(person => {
      const card = document.createElement("div");
      card.className = "person-card";
      card.dataset.personId = person.id || "";
      card.dataset.personName = person.name || "";

      const imgUrl = person.photoUrl || person.imageUrl;
      const avatarHtml = imgUrl
        ? `
          <img
            class="person-avatar-img"
            src="${imgUrl}"
            alt="${person.name}"
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          />
          <div class="person-avatar" style="display:none;">👤</div>
        `
        : `<div class="person-avatar">👤</div>`;

      card.innerHTML = `
        <div class="person-avatar-wrap">
          ${avatarHtml}
        </div>
        <div class="person-info">
          <div class="person-name">${person.name || "Unknown"}</div>
          <div class="person-time">
            ${person.timestamp ? new Date(person.timestamp).toLocaleString() : ""}
          </div>
        </div>
        <button
          class="person-delete-btn"
          title="Remove ${person.name}"
          onclick="People.delete('${person.name.replace(/'/g, "\\'")}')">✕</button>
      `;

      // Click card to identify/announce the person
      card.addEventListener("click", (e) => {
        if (e.target.classList.contains("person-delete-btn")) return;
        People.identify(person.name);
      });

      pane.appendChild(card);
    });
  },

  /* ===============================
     PRIVATE: localStorage helpers
  =============================== */
  _saveToStorage() {
    try {
      // Store without base64 images if they're very large (keep only metadata + thumbnail)
      const toStore = this.list.map(p => ({
        ...p,
        // Truncate base64 to save space — keep full if under 200KB
        imageUrl: p.imageUrl && p.imageUrl.length < 200000 ? p.imageUrl : null,
        photoUrl: p.photoUrl && p.photoUrl.length < 200000 ? p.photoUrl : null,
      }));
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toStore));
    } catch (err) {
      console.warn("⚠️ Could not save to localStorage (storage full?):", err.message);
    }
  },

  _loadFromStorage() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.list = parsed;
          console.log(`Loaded ${this.list.length} people from localStorage ✅`);
        }
      }
    } catch (err) {
      console.warn("⚠️ Could not read from localStorage:", err.message);
      this.list = [];
    }
  },

  /* ===============================
     PRIVATE: Blob → base64
  =============================== */
  _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("FileReader failed"));
      reader.readAsDataURL(blob);
    });
  }
};
