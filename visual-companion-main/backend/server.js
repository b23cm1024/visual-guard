/* ==========================================
   VISUAL COMPANION — SERVER
   v2.0 — wired to face recognition
========================================== */
const express  = require("express");
const cors     = require("cors");
const multer   = require("multer");
const path     = require("path");

const { analyzeImage }                               = require("./vision");
const { loadModels, saveFace, recognizeFace,
        deleteFace, listFaces, getFaceDescriptor }   = require("./faceRecognition");

const app = express();

/* ===============================
   MIDDLEWARE
=============================== */
app.use(cors({ origin: "*" }));
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }   // 5 MB
});

/* ===============================
   LOAD FACE MODELS ON STARTUP
=============================== */
loadModels().catch(err => {
  console.error("❌ Failed to load face models:", err.message);
  process.exit(1);   // no point running without models
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
   Returns { description, name?, confident? }
   — also attempts face recognition so the
     frontend gets both in one round-trip
=============================== */
app.post("/describe", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  try {
    // Run vision + face recognition in parallel
    const [description, faceResult] = await Promise.allSettled([
      analyzeImage(req.file.buffer, req.file.mimetype, "Describe this image"),
      recognizeFace(req.file.buffer)
    ]);

    const response = {
      description: description.status === "fulfilled" ? description.value : null
    };

    // Attach recognition result if confident
    if (faceResult.status === "fulfilled" && faceResult.value?.confident) {
      response.name      = faceResult.value.name;
      response.distance  = faceResult.value.distance;
      response.confident = true;
    }

    res.json(response);

  } catch (err) {
    console.error("❌ /describe error:", err.message);
    res.status(500).json({ error: "Failed to analyze image" });
  }
});

/* ===============================
   SAVE PERSON
   POST /save-person  { name, image: file }
   Returns { success, person } or { success: false, reason }
=============================== */
app.post("/save-person", upload.single("image"), async (req, res) => {
  const name = req.body?.name?.trim();

  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }
  if (!req.file) {
    return res.status(400).json({ error: "Image is required" });
  }

  try {
    const result = await saveFace(name, req.file.buffer);

    if (!result.success) {
      // Duplicate — not a server error, just a conflict
      return res.status(409).json({
        success: false,
        reason:  result.reason,   // "duplicate"
        name:    result.name
      });
    }

    res.json({
      success: true,
      person: {
        name:      result.name,
        timestamp: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error("❌ /save-person error:", err.message);

    // Known user-facing errors
    if (err.message === "No face detected in image") {
      return res.status(422).json({ error: "No face detected. Please try again." });
    }

    res.status(500).json({ error: "Failed to save person" });
  }
});

/* ===============================
   RECOGNIZE PERSON
   POST /recognize  { image: file }
   Returns { name, distance, confident } or { name: null }
=============================== */
app.post("/recognize", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No image uploaded" });
  }

  try {
    const result = await recognizeFace(req.file.buffer);

    if (!result) {
      return res.json({ name: null, reason: "no_face" });
    }

    res.json(result);   // { name, distance, confident }

  } catch (err) {
    console.error("❌ /recognize error:", err.message);
    res.status(500).json({ error: "Recognition failed" });
  }
});

/* ===============================
   GET PEOPLE
   GET /people
   Returns array of saved names + metadata
=============================== */
app.get("/people", (req, res) => {
  const names = listFaces();
  const people = names.map(name => ({
    name,
    timestamp: null   // face DB doesn't store timestamps — extend faceRecognition.js if needed
  }));
  res.json(people);
});

/* ===============================
   DELETE PERSON
   DELETE /people/:name
=============================== */
app.delete("/people/:name", (req, res) => {
  const name = decodeURIComponent(req.params.name).trim();

  if (!name) {
    return res.status(400).json({ error: "Name is required" });
  }

  const removed = deleteFace(name);

  if (!removed) {
    return res.status(404).json({ error: `"${name}" not found` });
  }

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
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
