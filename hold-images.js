const BASE = "./assets/holds";

// Auto-generated from files currently present in assets/holds.
// Each id resolves to an AVIF (preferred) and a PNG fallback of the same name.
// `scale` is reduced for smaller/grainier images to keep perceived quality high.
export const HOLD_IMAGES = [
  { id: "hold-1", hueBin: 10, saturation: 0.60, scale: 1.00, quality: 1.00 },
  { id: "hold-2", hueBin: 1, saturation: 0.07, scale: 1.00, quality: 1.00 },
  { id: "hold-3", hueBin: 1, saturation: 0.90, scale: 0.84, quality: 0.78 },
  { id: "hold-4", hueBin: 1, saturation: 0.96, scale: 0.92, quality: 0.89 },
  { id: "hold-5", hueBin: 6, saturation: 0.90, scale: 1.00, quality: 1.00 },
  { id: "hold-6", hueBin: 6, saturation: 0.29, scale: 0.92, quality: 0.89 },
  { id: "hold-7", hueBin: 1, saturation: 0.77, scale: 0.86, quality: 0.81 },
  { id: "hold-8", hueBin: 6, saturation: 0.55, scale: 0.92, quality: 0.89 },
  { id: "hold-9", hueBin: 0, saturation: 0.84, scale: 0.78, quality: 0.70 },
  { id: "hold-10", hueBin: 6, saturation: 0.28, scale: 0.78, quality: 0.70 },
  { id: "hold-12", hueBin: 0, saturation: 0.64, scale: 0.60, quality: 0.46 },
  { id: "hold-13", hueBin: 6, saturation: 0.08, scale: 0.86, quality: 0.81 },
  { id: "hold-14", hueBin: 10, saturation: 0.59, scale: 0.52, quality: 0.35 },
  { id: "hold-15", hueBin: 3, saturation: 0.79, scale: 0.78, quality: 0.70 },
  { id: "hold-16", hueBin: 10, saturation: 0.57, scale: 0.52, quality: 0.35 },
  { id: "hold-17", hueBin: 1, saturation: 0.84, scale: 0.92, quality: 0.89 },
  { id: "hold-21", hueBin: 0, saturation: 0.69, scale: 0.52, quality: 0.35 },
  { id: "hold-23", hueBin: 6, saturation: 0.71, scale: 0.96, quality: 0.95 },
  { id: "hold-24", hueBin: 11, saturation: 0.00, scale: 0.80, quality: 0.73 },
  { id: "hold-25", hueBin: 6, saturation: 0.78, scale: 0.86, quality: 0.81 },
  { id: "hold-26", hueBin: 7, saturation: 0.09, scale: 1.00, quality: 1.00 },
].map((hold) => ({
  ...hold,
  avif: `${BASE}/${hold.id}.avif`,
  png: `${BASE}/${hold.id}.png`,
}));
