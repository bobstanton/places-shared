import { createPointLabelLayerConfig } from './TextLabelLayerStyles';

export interface TextLayerOptions {
  sourceId: string;
  defaultColor?: string;
  layerId?: string;
  textOverlap?: "never" | "always" | "cooperative";
  variableAnchorOffsets?: unknown[];
}

export function createTextLayerConfig(options: TextLayerOptions) {
  return createPointLabelLayerConfig(options);
}
