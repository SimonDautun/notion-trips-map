window.APP_CONFIG = {
  initialView: { center: [35, 105], zoom: 4 }, // Chine
  tiles: {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    maxZoom: 19,
    attribution: "© OpenStreetMap contributors"
  },
  colors: {
    flight: "#2b6cb0",
    train: "#2a9d4b",
    default: "#2b6cb0"
  },
  // responsive thresholds
  mobile: {
    maxWidth: 640
  },
  // data
  dataUrl: "cities.json"
};
