// Re-export image-related modules for backwards compatibility.
// New code should import from "./image-gen" or "./image-render" directly.

export {
  generateImage,
  IMAGE_PROMPT_TEMPLATE,
  IMAGE_NEGATIVE_PROMPT,
} from "./image-gen";
export { downloadImage, renderImageToTerminal, openImage } from "./image-render";
