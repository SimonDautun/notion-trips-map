window.APP_CONFIG = {
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
  dataUrl: "cities.json",
  zones: {
    url: "assets/data/zones.geojson",
    style: {
      color: "#f59e0b",
      weight: 2,
      opacity: 1,
      fillColor: "#f59e0b",
      fillOpacity: 0.18
    }
  }
};
