import { pipeline, env } from "@huggingface/transformers";
import { AI_CONFIG } from "../config.js";
import { isWebGPUSupported, logError } from "../utils/index.js";

env.allowLocalModels = false;

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
  }

  async loadModel(onProgress) {
    try {
      if (onProgress) {
        onProgress(10);
      }

      this.generator = await this.#createPipeline(onProgress);

      this.isModelLoaded = true;
      if (onProgress) {
        onProgress(100);
      }

      return true;
    } catch (error) {
      logError("RootFactsService.loadModel", error);
      throw error;
    }
  }

  async #createPipeline(onProgress) {
    const progressCallback = (progress) => {
      if (onProgress && progress.status === "progress" && progress.progress) {
        onProgress(10 + Math.round(progress.progress * 0.85));
      }
    };

    if (isWebGPUSupported()) {
      try {
        this.currentBackend = "webgpu";
        return await pipeline("text2text-generation", this.config.model, {
          dtype: this.config.dtype,
          device: "webgpu",
          progress_callback: progressCallback,
        });
      } catch (error) {
        console.warn(
          "Transformers WebGPU backend failed, falling back to WASM",
          error,
        );
      }
    }

    this.currentBackend = "wasm";
    return pipeline("text2text-generation", this.config.model, {
      dtype: this.config.dtype,
      progress_callback: progressCallback,
    });
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
