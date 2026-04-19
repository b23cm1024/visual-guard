/* ==========================================
   VISUAL COMPANION — AI ENGINE
========================================== */
window.AI = {
  modelsLoaded: false,

  /* ===============================
     LOAD FACE API MODELS
  =============================== */
  async loadModels() {
    const MODEL_URL = Config.FACE_MODELS;
    await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);
    await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
    this.modelsLoaded = true;
    console.log("Face models loaded ✅");
  },

  /* ===============================
     ANALYZE CAMERA FRAME
  =============================== */
  async analyzeFrame(video) {
    if (!this.modelsLoaded) return;
    const detections = await faceapi
      .detectAllFaces(video)
      .withFaceLandmarks()
      .withFaceDescriptors();
    return detections;
  },

  /* ===============================
     DESCRIBE SCENE USING BACKEND
  =============================== */
  async describeScene(imageBlob) {
    const formData = new FormData();
    formData.append("image", imageBlob);
    const response = await fetch(
      Config.API_BASE + Config.ENDPOINTS.describe,
      {
        method: "POST",
        body: formData
      }
    );
    const data = await response.json();
    return data.description;
  },

  /* ===============================
     TEXT TO SPEECH
  =============================== */
  speak(text) {
    if (!Config.AI.speakResults) return;
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = Config.VOICE.lang;
    speech.rate = 1;
    speech.pitch = 1;
    window.speechSynthesis.speak(speech);
  },

  /* ===============================
     CAPTURE FRAME FROM VIDEO
  =============================== */
  captureFrame(video, canvas) {
    const ctx = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    return new Promise(resolve => {
      canvas.toBlob(resolve, "image/jpeg", 0.9);
    });
  }
};
