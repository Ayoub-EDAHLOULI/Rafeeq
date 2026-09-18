import type { ModelInfo } from "../types/model";

export const mockModels: ModelInfo[] = [
  {
    name: "Llama 3.1 8B Instruct",
    fileName: "llama-3.1-8b-instruct.Q4_K_M.gguf",
    sizeBytes: 4_920_000_000,
    quant: "Q4_K_M",
  },
  {
    name: "Mistral 7B Instruct v0.3",
    fileName: "mistral-7b-instruct-v0.3.Q5_K_M.gguf",
    sizeBytes: 5_130_000_000,
    quant: "Q5_K_M",
  },
  {
    name: "Phi-3 Mini 4K Instruct",
    fileName: "phi-3-mini-4k-instruct.Q8_0.gguf",
    sizeBytes: 4_060_000_000,
    quant: "Q8_0",
  },
  {
    name: "Qwen2.5 Coder 7B",
    fileName: "qwen2.5-coder-7b.Q4_0.gguf",
    sizeBytes: 4_370_000_000,
    quant: "Q4_0",
  },
];
