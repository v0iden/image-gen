window.APP_CONFIG = {
  /** Default output size: "post" (1080×1350) or "story" (1080×1920) */
  defaultSize: "post",

  /** Preset colours for text/logo. Each needs at least hex; label is optional. */
  presetColours: [
    { id: "hvit", label: "Hvit", hex: "#ffffff" },
    { id: "svart", label: "Svart", hex: "#000000" },
    { id: "bla", label: "Blå", hex: "#2b3086" },
    { id: "rod", label: "Rød", hex: "#ff0000" },
    { id: "neon", label: "Neon", hex: "#00ff11" },
  ],

  /** Preset background images (paths under preset-images/). Add files to that folder and list names here. */
  presetImages: ["bg1.png", "bg2.png", "bg3.jpeg"],
};
