import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgpu";
import { AI_CONFIG } from "../config.js";
import {
  isWebGPUSupported,
  validateModelMetadata,
  logError,
} from "../utils/index.js";

class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.config = AI_CONFIG;
    this.activeBackend = null;
    this.hasRetriedBackendPrediction = false;
    this.performanceStats = {
      operations: 0,
      totalTime: 0,
      averageTime: 0,
    };
  }

  async loadModel(onProgress) {
    try {
      await this.#setBestBackend();

      const [modelRes, metaRes] = await Promise.all([
        fetch(this.config.modelPath),
        fetch(this.config.metadataPath),
      ]);

      if (!modelRes.ok || !metaRes.ok) {
        throw new Error("Failed to fetch model or metadata");
      }

      const metadata = await metaRes.json();

      if (!validateModelMetadata(metadata)) {
        throw new Error("Invalid model metadata");
      }

      this.labels = metadata.labels;

      if (onProgress) {
        onProgress(30);
      }

      await this.#loadLayersModel(onProgress);

      if (onProgress) {
        onProgress(100);
      }

      return true;
    } catch (error) {
      logError("DetectionService.loadModel", error);
      throw error;
    }
  }

  async #setBestBackend(forceWebGL = false) {
    const preferredBackend =
      !forceWebGL && isWebGPUSupported() ? "webgpu" : "webgl";

    try {
      await tf.setBackend(preferredBackend);
      await tf.ready();
      this.activeBackend = tf.getBackend();
    } catch (backendError) {
      console.warn(
        `${preferredBackend} backend failed, falling back to WebGL`,
        backendError,
      );
      await tf.setBackend("webgl");
      await tf.ready();
      this.activeBackend = tf.getBackend();
    }

    console.log("TensorFlow.js backend:", this.activeBackend);
  }

  async #loadLayersModel(onProgress) {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }

    this.model = await tf.loadLayersModel(this.config.modelPath, {
      onProgress: (fraction) => {
        if (onProgress) {
          onProgress(30 + Math.round(fraction * 65));
        }
      },
    });
  }

  async predict(imageElement) {
    if (!this.model || !imageElement) {
      return null;
    }

    const startTime = performance.now();

    const result = tf.tidy(() => {
      const tensor = tf.browser
        .fromPixels(imageElement)
        .resizeBilinear([224, 224])
        .toFloat()
        .div(255)
        .expandDims(0);

      const predictions = this.model.predict(tensor);
      const data = Array.from(predictions.dataSync());

      if (data.some((value) => !Number.isFinite(value))) {
        console.warn("Model output contains invalid values:", data);
        return {
          label: "Loading...",
          confidence: 0,
          isValid: false,
          invalidOutput: true,
        };
      }

      const indexed = data.map((v, i) => ({ value: v, index: i }));
      indexed.sort((a, b) => b.value - a.value);
      const top5 = indexed
        .slice(0, 5)
        .map(
          (item) =>
            `${this.labels[item.index]}: ${(item.value * 100).toFixed(1)}%`,
        );
      console.log("Top 5 predictions:", top5);

      let maxIndex = 0;
      let maxValue = data[0];
      for (let i = 1; i < data.length; i++) {
        if (data[i] > maxValue) {
          maxValue = data[i];
          maxIndex = i;
        }
      }

      // Clamp confidence between 0-100
      const confidence = Math.min(100, Math.max(0, Math.round(maxValue * 100)));
      const label = this.labels[maxIndex] || "Unknown";

      return { label, confidence, isValid: true };
    });

    const elapsed = performance.now() - startTime;
    this.performanceStats.operations += 1;
    this.performanceStats.totalTime += elapsed;
    this.performanceStats.averageTime =
      this.performanceStats.totalTime / this.performanceStats.operations;

    if (
      result?.invalidOutput &&
      this.activeBackend === "webgpu" &&
      !this.hasRetriedBackendPrediction
    ) {
      this.hasRetriedBackendPrediction = true;
      console.warn(
        "WebGPU produced invalid prediction output, retrying with WebGL",
      );
      await this.#setBestBackend(true);
      await this.#loadLayersModel();
      return this.predict(imageElement);
    }

    return result;
  }

  getBackend() {
    return tf.getBackend();
  }
}

export default DetectionService;
