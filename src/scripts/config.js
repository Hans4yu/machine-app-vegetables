const APP_CONFIG = {
  detectionConfidenceThreshold: 30, // Lowered to show more results for testing
  analyzingDelay: 2000,
  factsGenerationDelay: 2000,
  detectionRetryInterval: 100,
};

const UI_CONFIG = {
  animationDuration: 300,
  fadeAnimation: "fadeIn 0.5s ease-out forwards",
  confidenceThresholds: {
    excellent: 90,
    good: 80,
  },
  factsCardOpacity: {
    loading: 0.6,
    normal: 1.0,
  },
};

const CAMERA_CONFIG = {
  defaultFPS: 30,
  minFPS: 15,
  maxFPS: 60,
  fpsStep: 15,
  videoConstraints: {
    width: { ideal: 640 },
    height: { ideal: 480 },
  },
};

const AI_CONFIG = {
  model: "Xenova/LaMini-Flan-T5-248M",
  dtype: "q4",
  maxNewTokens: 150,
  temperature: 0.85,
  topP: 0.92,
  doSample: true,
  modelPath: "/model/model.json",
  metadataPath: "/model/metadata.json",
};

export { APP_CONFIG, UI_CONFIG, CAMERA_CONFIG, AI_CONFIG };
