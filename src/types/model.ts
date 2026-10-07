export type ModelType = "chat" | "embedding" | "unknown";

export interface ModelInfo {
  name: string;
  fileName: string;
  sizeBytes: number;
  quant: string | null;
  modelType: ModelType;
}
