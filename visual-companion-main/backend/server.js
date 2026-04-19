/* ==========================================
   VISUAL COMPANION — SERVER
   v3.0 — ethical improvements:
   - Error reporting endpoint
   - Hazard detection endpoint
   - Feedback logging
========================================== */
const express  = require("express");
const cors     = require("cors");
const multer   = require("multer");
const path     = require("path");
const fs       = require("fs");

const { analyzeImage, detectHazards }                = require("./vision");
const { loadModels, saveFace, recognizeFace,
        deleteFace, listFaces, getFaceDescriptor }   = require("./faceRecognition");

const app = express();

/* ===============================
   MIDDLEWARE
=============================== */
app.use(cors({ origin: "*" }));
app.use(express.json());

// Vercel Serverless rewrite fix: strip /api from URL
app.use((req, res, next) => {
  if (req.url.startsWith('/api')) {
    req.url = req.url.substring(4) || '/';
  }
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }   // 5 MB
});

/* ===============================
   FEEDBACK LOG (Ethical Issue 1: Accountability)
=============================== */
const FEEDBACK_LOG = process.env.VERCEL ? path.join("/tmp", "feedback.json") : path.join(__dirname, "data", "feedback.json");

function logFeedback(entry) {
  try {
    fs.mkdirSync(path.dirname(FEEDBACK_LOG), { recursive: true });
    let existing = [];
    if (fs.existsSync(FEEDBACK_LOG)) {
      existing = JSON.parse(fs.readFileSync(FEEDBACK_LOG, "utf8"));
    }
    existing.push({ ...entry, timestamp: new Date().toISOString() });
    fs.writeFileSync(FEEDBACK_LOG, JSON.stringify(existing, null, 2), "utf8");
    console.log(`📝 Feedback logged (total: ${existing.length})`);
  } catch (err) {
    console.error("❌ Could not log feedback:", err.message);
  }
}

/* ===============================
   LOAD FACE MODELS ON STARTUP
=============================== */
loadModels().catch(err => {
  console.error("❌ Failed to load face models:", err.message);
  process.exit(1);
});

/* ===============================
   ROOT
=============================== */
app.get("/", (req, res) => {
  res.json({
    status:  "ok",
    message: "Visual Companion backend running ✅",
    people:  listFaces().length
  });
});

/* ===============================
   DESCRIBE IMAGE
   POST /describe  { image: file }
   Accessibility-first prompt for visually impaired users.
   Also runs hazard check in parallel (Ethical Issue 2).
=============================== */
app.post("/describe", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  try {
    const [description, faceResult, hazardResult] = await Promise.allSettled([
      analyzeImage(req.file.buffer, req.file.mimetype,
        "In under 20 words, tell me what is in front of me and what I should do."
      ),
      recognizeFace(req.file.buffer),
      detectHazards(req.file.buffer, req.file.mimetype)
    ]);

    const response = {
      description: description.status === "fulfilled" ? description.value : null,
      source: "ai"  // Ethical Issue 3: Transparency — label the source
    };

    // Attach recognition result if confident
    if (faceResult.status === "fulfilled" && faceResult.value?.confident) {
      response.name      = faceResult.value.name;
      response.distance  = faceResult.value.distance;
      response.confident = true;
    }

    // Attach hazard info (Ethical Issue 2: Safety)
    if (hazardResult.status === "fulfilled" && hazardResult.value) {
      const hazardText = hazardResult.value.toLowerCase();
      if (hazardText.includes("caution") || hazardText.includes("hazard") ||
          hazardText.includes("danger") || hazardText.includes("careful") ||
          hazardText.includes("warning") || hazardText.includes("watch out")) {
        response.hazard = hazardResult.value;
        response.hazardDetected = true;
      }
    }

    res.json(response);

  } catch (err) {
    console.error("❌ /describe error:", err.message);
    // Ethical Issue 2: Fallback warning when AI fails
    res.status(500).json({
      error: "Failed to analyze image",
      fallbackWarning: "⚠️ AI could not process this frame. Please proceed with caution and try again."
    });
  }
});

/* ===============================
   REPORT ERROR (Ethical Issue 1: Accountability)
   POST /report-error
=============================== */
app.post("/report-error", express.json(), (req, res) => {
  const { errorType, details, lastDescription } = req.body || {};
  logFeedback({
    type: "error_report",
    errorType: errorType || "unknown",
    details: details || "",
    lastDescription: lastDescription || "",
    userAgent: req.headers["user-agent"] || ""
  });
  res.json({ success: true, message: "Thank you for your feedback." });
});

/* ===============================
   SAVE PERSON
=============================== */
app.post("/save-person", upload.single("image"), async (req, res) => {
  const name = req.body?.name?.trim();
  if (!name) return res.status(400).json({ error: "Name is required" });
  if (!req.file) return res.status(400).json({ error: "Image is required" });

  try {
    const result = await saveFace(name, req.file.buffer);
    if (!result.success) {
      return res.status(409).json({
        success: false, reason: result.reason, name: result.name
      });
    }
    res.json({
      success: true,
      person: { name: result.name, timestamp: new Date().toISOString() }
    });
  } catch (err) {
    console.error("❌ /save-person error:", err.message);
    if (err.message === "No face detected in image") {
      return res.status(422).json({ error: "No face detected. Please try again." });
    }
    res.status(500).json({ error: "Failed to save person" });
  }
});

/* ===============================
   RECOGNIZE PERSON
=============================== */
app.post("/recognize", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No image uploaded" });

  try {
    const result = await recognizeFace(req.file.buffer);
    if (!result) return res.json({ name: null, reason: "no_face" });
    res.json(result);
  } catch (err) {
    console.error("❌ /recognize error:", err.message);
    res.status(500).json({ error: "Recognition failed" });
  }
});

/* ===============================
   GET PEOPLE
=============================== */
app.get("/people", (req, res) => {
  const names = listFaces();
  const people = names.map(name => ({
    name,
    timestamp: null
  }));
  res.json(people);
});

/* ===============================
   DELETE PERSON
=============================== */
app.delete("/people/:name", (req, res) => {
  const name = decodeURIComponent(req.params.name).trim();
  if (!name) return res.status(400).json({ error: "Name is required" });

  const removed = deleteFace(name);
  if (!removed) return res.status(404).json({ error: `"${name}" not found` });
  res.json({ success: true, name });
});

/* ===============================
   GLOBAL ERROR HANDLER
=============================== */
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

/* ===============================
   START SERVER
=============================== */
const PORT = process.env.PORT || 5000;
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

// Export for Vercel Serverless
module.exports = app;
