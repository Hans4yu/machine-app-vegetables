import { pipeline, env } from "@huggingface/transformers";
import { AI_CONFIG } from "../config.js";
import { isWebGPUSupported, logError } from "../utils/index.js";

env.allowLocalModels = false;
env.useBrowserCache = true;

const MAX_LOADING_PROGRESS = 98;

const FILE_LABELS = [
  { pattern: /encoder_model.*\.onnx$/i, key: "encoder", label: "Encoder" },
  {
    pattern: /decoder_model.*\.onnx$/i,
    key: "decoder",
    label: "Decoder",
  },
  { pattern: /tokenizer/i, key: "tokenizer", label: "Tokenizer" },
  { pattern: /config/i, key: "config", label: "Konfigurasi" },
  { pattern: /\.onnx$/i, key: "onnx", label: "Model ONNX" },
];

const TONE_PROMPTS = {
  normal: (vegetable) =>
    `Tell a unique and interesting fun fact about ${vegetable} in 2-3 sentences.`,
  funny: (vegetable) =>
    `Tell a hilarious and funny fun fact about ${vegetable} in 2-3 sentences. Use humor and be playful.`,
  professional: (vegetable) =>
    `Provide a scientific and professional fact about ${vegetable} in 2-3 sentences. Use formal language.`,
  casual: (vegetable) =>
    `Share a cool and casual fun fact about ${vegetable} in 2-3 sentences. Use friendly, everyday language.`,
};

class RootFactsService {
  constructor() {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.config = AI_CONFIG;
    this.currentBackend = null;
    this.currentTone = "normal";
    this.loadingFiles = new Map();
    this.lastLoadingProgress = 0;
  }

  async loadModel(onProgress) {
    if (this.isReady()) {
      this.#emitProgress(onProgress, {
        percent: 100,
        status: "ready",
        message: "Model fun fact siap.",
      });
      return true;
    }

    const envSnapshot = this.#configureOfflineLoading();

    try {
      this.generator = null;
      this.isModelLoaded = false;
      this.loadingFiles.clear();
      this.lastLoadingProgress = 0;

      this.#emitProgress(onProgress, {
        percent: 0,
        status: "init",
        message: "Menyiapkan model fun fact...",
      });

      this.generator = await this.#createPipeline(onProgress);

      this.isModelLoaded = true;
      this.#emitProgress(onProgress, {
        percent: 100,
        status: "ready",
        message: `Model fun fact siap (${this.currentBackend?.toUpperCase() || "AI"}).`,
      });

      return true;
    } catch (error) {
      this.generator = null;
      this.isModelLoaded = false;
      logError("RootFactsService.loadModel", error);
      throw error;
    } finally {
      env.allowLocalModels = envSnapshot.allowLocalModels;
    }
  }

  async #createPipeline(onProgress) {
    const progressCallback = (progress) =>
      this.#handleModelProgress(progress, onProgress);
    const loadingOptions = {
      dtype: this.config.dtype,
      progress_callback: progressCallback,
      ...(this.#isOfflineMode() ? { local_files_only: true } : {}),
    };

    if (isWebGPUSupported()) {
      try {
        this.currentBackend = "webgpu";
        this.#emitProgress(onProgress, {
          percent: Math.max(1, this.lastLoadingProgress),
          status: "backend",
          message: "Memuat text generator dengan WebGPU...",
        });
        return await pipeline("text2text-generation", this.config.model, {
          device: "webgpu",
          ...loadingOptions,
        });
      } catch (error) {
        if (this.#shouldAbortFallback(error)) {
          throw error;
        }

        console.warn(
          "Transformers WebGPU backend failed, falling back to WASM",
          error,
        );
        this.#emitProgress(onProgress, {
          percent: Math.max(1, this.lastLoadingProgress),
          status: "backend-fallback",
          message: "WebGPU gagal, mencoba WASM...",
        });
      }
    }

    this.currentBackend = "wasm";
    return pipeline("text2text-generation", this.config.model, {
      ...loadingOptions,
    });
  }

  #configureOfflineLoading() {
    const snapshot = {
      allowLocalModels: env.allowLocalModels,
    };

    if (this.#isOfflineMode()) {
      env.allowLocalModels = true;
    }

    return snapshot;
  }

  #handleModelProgress(progress, onProgress) {
    if (!progress?.file) {
      return;
    }

    const fileKey = progress.file;
    const fileInfo = this.#getFileInfo(fileKey);
    const current = this.loadingFiles.get(fileKey) || {
      key: fileInfo.key,
      label: fileInfo.label,
      file: fileKey,
      progress: 0,
      loaded: 0,
      total: 0,
      done: false,
    };

    if (progress.status === "progress") {
      current.loaded = progress.loaded || current.loaded;
      current.total = progress.total || current.total;
      current.progress = Math.min(
        95,
        this.#normalizeProgress(progress.progress),
      );
    } else if (progress.status === "done") {
      current.progress = 100;
      current.done = true;
    } else if (progress.status === "download") {
      current.progress = Math.max(current.progress, 1);
    }

    this.loadingFiles.set(fileKey, current);

    const percent = this.#calculateOverallProgress();
    this.#emitProgress(onProgress, {
      percent,
      status: progress.status,
      file: fileKey,
      fileLabel: current.label,
      files: this.#summarizeTrackedFiles(),
      message: this.#createProgressMessage(current, progress.status),
    });
  }

  #calculateOverallProgress() {
    const files = [...this.loadingFiles.values()];
    if (!files.length) {
      return this.lastLoadingProgress;
    }

    const average =
      files.reduce((total, file) => total + file.progress, 0) / files.length;
    const nextProgress = Math.min(
      MAX_LOADING_PROGRESS,
      Math.max(this.lastLoadingProgress, Math.round(average)),
    );

    this.lastLoadingProgress = nextProgress;
    return nextProgress;
  }

  #summarizeTrackedFiles() {
    const summary = {};

    for (const file of this.loadingFiles.values()) {
      if (!summary[file.key]) {
        summary[file.key] = {
          label: file.label,
          progress: file.progress,
          done: file.done,
        };
        continue;
      }

      summary[file.key].progress = Math.max(
        summary[file.key].progress,
        file.progress,
      );
      summary[file.key].done = summary[file.key].done || file.done;
    }

    return summary;
  }

  #createProgressMessage(file, status) {
    if (status === "done") {
      return `${file.label} selesai dimuat.`;
    }

    if (status === "download" || status === "progress") {
      return `Memuat ${file.label} ${Math.round(file.progress)}%...`;
    }

    return `Menyiapkan ${file.label}...`;
  }

  #getFileInfo(file) {
    return (
      FILE_LABELS.find(({ pattern }) => pattern.test(file)) || {
        key: "other",
        label: "Aset model",
      }
    );
  }

  #normalizeProgress(progress = 0) {
    const value = Number(progress);
    if (!Number.isFinite(value)) {
      return 0;
    }

    return Math.min(100, Math.max(0, Math.round(value)));
  }

  #emitProgress(onProgress, payload) {
    if (!onProgress) {
      return;
    }

    onProgress({
      backend: this.currentBackend,
      files: this.#summarizeTrackedFiles(),
      ...payload,
    });
  }

  #isOfflineMode() {
    return typeof navigator !== "undefined" && navigator.onLine === false;
  }

  #shouldAbortFallback(error) {
    const message = `${error?.message || error || ""}`;
    return (
      message.includes("Failed to fetch") ||
      message.includes("local_files_only") ||
      message.includes("file was not found")
    );
  }

  setTone(tone) {
    if (TONE_PROMPTS[tone]) {
      this.currentTone = tone;
    }
  }

  _sanitizeInput(input) {
    return input
      .replace(/[<>{}[\]\\|`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50);
  }

  async generateFacts(vegetable, tone = null) {
    if (!this.isReady() || this.isGenerating) {
      return null;
    }

    const activeTone = tone || this.currentTone || "normal";
    const sanitized = this._sanitizeInput(vegetable);

    if (!sanitized) {
      return null;
    }

    this.isGenerating = true;

    try {
      const promptFn = TONE_PROMPTS[activeTone] || TONE_PROMPTS.normal;
      const prompt = promptFn(sanitized);

      const output = await this.generator(prompt, {
        max_new_tokens: this.config.maxNewTokens,
        temperature: this.config.temperature,
        top_p: this.config.topP,
        do_sample: this.config.doSample,
      });

      const text =
        output?.[0]?.generated_text || output?.[0]?.translation_text || null;

      return text ? this.#cleanGeneratedText(text) : null;
    } catch (error) {
      logError("RootFactsService.generateFacts", error);
      return null;
    } finally {
      this.isGenerating = false;
    }
  }

  isReady() {
    return this.isModelLoaded && this.generator !== null;
  }

  #cleanGeneratedText(text) {
    return text.replace(/\s+/g, " ").trim();
  }
}

export default RootFactsService;
