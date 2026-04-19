/* ==========================================
   VISUAL COMPANION — FACE RECOGNITION
   v2.0 — persistent storage + clean returns
========================================== */
const faceapi    = require("face-api.js");
const canvas     = require("canvas");
const path       = require("path");
const fs         = require("fs");
const { Canvas, Image, ImageData } = canvas;

faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const MODEL_PATH   = path.join(__dirname, "models");
const DB_PATH      = path.join(__dirname, "data", "faces.json");
const THRESHOLD    = parseFloat(process.env.FACE_THRESHOLD) || 0.6;

// In-memory store — populated from disk on loadModels()
let labeledDescriptors = [];

/* ===============================
   LOAD MODELS + RESTORE SAVED FACES
=============================== */
async function loadModels() {
  await faceapi.nets.ssdMobilenetv1.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceLandmark68Net.loadFromDisk(MODEL_PATH);
  await faceapi.nets.faceRecognitionNet.loadFromDisk(MODEL_PATH);
  console.log("✅ Face models loaded");

  _loadFromDisk();
}

/* ===============================
   EXTRACT FACE DESCRIPTOR
   Returns Float32Array or null
=============================== */
async function getFaceDescriptor(imageBuffer) {
  try {
    const img = await canvas.loadImage(imageBuffer);
    const detection = await faceapi
      .detectSingleFace(img)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) return null;
    return detection.descriptor;
  } catch (err) {
    console.error("getFaceDescriptor error:", err.message);
    return null;
  }
}

/* ===============================
   SAVE PERSON
   Returns { success, name } or throws
=============================== */
async function saveFace(name, imageBuffer) {
  if (!name || name.trim() === "") throw new Error("Name is required");

  const trimmed = name.trim();

  // Check duplicate
  const exists = labeledDescriptors.find(
    ld => ld.label.toLowerCase() === trimmed.toLowerCase()
  );
  if (exists) {
    console.warn(`⚠️  Face already saved for "${trimmed}"`);
    return { success: false, reason: "duplicate", name: trimmed };
  }

  const descriptor = await getFaceDescriptor(imageBuffer);
  if (!descriptor) throw new Error("No face detected in image");

  const labeled = new faceapi.LabeledFaceDescriptors(trimmed, [descriptor]);
  labeledDescriptors.push(labeled);
  _saveToDisk();

  console.log(`✅ Face saved for "${trimmed}" (total: ${labeledDescriptors.length})`);
  return { success: true, name: trimmed };
}

/* ===============================
   RECOGNIZE PERSON
   Returns { name, distance, confident }
   or null if no face / no saved people
=============================== */
async function recognizeFace(imageBuffer) {
  const descriptor = await getFaceDescriptor(imageBuffer);
  if (!descriptor) return null;
  if (labeledDescriptors.length === 0) return null;

  const matcher   = new faceapi.FaceMatcher(labeledDescriptors, THRESHOLD);
  const bestMatch = matcher.findBestMatch(descriptor);

  // face-api returns "unknown" when distance > threshold
  if (bestMatch.label === "unknown") {
    return { name: null, distance: bestMatch.distance, confident: false };
  }

  return {
    name:      bestMatch.label,
    distance:  parseFloat(bestMatch.distance.toFixed(3)),
    confident: bestMatch.distance <= THRESHOLD
  };
}

/* ===============================
   DELETE PERSON
   Returns true if removed, false if not found
=============================== */
function deleteFace(name) {
  const before = labeledDescriptors.length;
  labeledDescriptors = labeledDescriptors.filter(
    ld => ld.label.toLowerCase() !== name.trim().toLowerCase()
  );
  if (labeledDescriptors.length < before) {
    _saveToDisk();
    console.log(`🗑️  Face deleted for "${name}"`);
    return true;
  }
  return false;
}

/* ===============================
   LIST SAVED PEOPLE
   Returns array of names
=============================== */
function listFaces() {
  return labeledDescriptors.map(ld => ld.label);
}

/* ===============================
   PRIVATE — persist to disk
=============================== */
function _saveToDisk() {
  try {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

    const serialized = labeledDescriptors.map(ld => ({
      label:       ld.label,
      descriptors: ld.descriptors.map(d => Array.from(d))  // Float32Array → plain array
    }));

    fs.writeFileSync(DB_PATH, JSON.stringify(serialized, null, 2), "utf8");
    console.log(`💾 Faces saved to disk (${serialized.length} people)`);
  } catch (err) {
    console.error("❌ Could not save faces to disk:", err.message);
  }
}

function _loadFromDisk() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.log("ℹ️  No face database found — starting fresh");
      return;
    }

    const raw = fs.readFileSync(DB_PATH, "utf8");
    const parsed = JSON.parse(raw);

    labeledDescriptors = parsed.map(entry =>
      new faceapi.LabeledFaceDescriptors(
        entry.label,
        entry.descriptors.map(d => new Float32Array(d))  // plain array → Float32Array
      )
    );

    console.log(`📂 Loaded ${labeledDescriptors.length} face(s) from disk`);
  } catch (err) {
    console.error("❌ Could not load faces from disk:", err.message);
    labeledDescriptors = [];
  }
}

/* ===============================
   EXPORTS
=============================== */
module.exports = {
  loadModels,
  getFaceDescriptor,
  saveFace,
  recognizeFace,
  deleteFace,
  listFaces
};
