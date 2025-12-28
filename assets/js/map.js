/* assets/js/map.js */
/* global L, APP_CONFIG, Utils */

window.TripsMap = (() => {
  const state = {
    map: null,

    // layers
    citiesLayer: null,      // MarkerClusterGroup
    transportLayer: null,   // LayerGroup
    zonesLayer: null,       // GeoJSON layer (persistent)

    // icons
    cityIcon: null
  };

  function _ensureMapReady() {
    if (!state.map) throw new Error("TripsMap not initialized. Call TripsMap.init() first.");
  }

  function _makeCityIcon() {
    return new L.Icon({
      iconUrl:
        "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      shadowSize: [41, 41]
    });
  }

  function _colorForType(type) {
    const t = Utils.norm(type);
    if (t.includes("train")) return APP_CONFIG.colors.train;
    if (t.includes("flight") || t.includes("plane") || t.includes("avion")) return APP_CONFIG.colors.flight;
    return APP_CONFIG.colors.default;
  }

  function _safeAddArrow(polyline, color) {
    // Prevent "Cannot read properties of undefined (reading 'arrowHead')"
    if (!L.polylineDecorator || !L.Symbol || typeof L.Symbol.arrowHead !== "function") {
      console.warn("[TripsMap] Arrowheads disabled (leaflet-polylinedecorator not fully available).");
      return null;
    }

    const deco = L.polylineDecorator(polyline, {
      patterns: [
        {
          offset: "60%",
          repeat: 0,
          symbol: L.Symbol.arrowHead({
            pixelSize: 12,
            polygon: false,
            pathOptions: { stroke: true, color, weight: 2, opacity: 0.95 }
          })
        }
      ]
    });

    deco.addTo(state.transportLayer);
    return deco;
  }

  function init() {
    // Create map
    state.map = L.map("map", { worldCopyJump: true }).setView(
      APP_CONFIG.initialView.center,
      APP_CONFIG.initialView.zoom
    );

    // Tiles
    L.tileLayer(APP_CONFIG.tiles.url, {
      maxZoom: APP_CONFIG.tiles.maxZoom,
      attribution: APP_CONFIG.tiles.attribution
    }).addTo(state.map);

    // Layers
    state.transportLayer = L.layerGroup().addTo(state.map);
    state.citiesLayer = L.markerClusterGroup();
    state.map.addLayer(state.citiesLayer);

    // Icons
    state.cityIcon = _makeCityIcon();

    return state.map;
  }

  function invalidate() {
    _ensureMapReady();
    state.map.invalidateSize();
  }

  function clear() {
    // ✅ IMPORTANT: we clear only dynamic layers
    // ❌ Do NOT remove tiles or zones layer here
    if (state.citiesLayer) state.citiesLayer.clearLayers();
    if (state.transportLayer) state.transportLayer.clearLayers();
  }

  async function loadZones() {
    _ensureMapReady();

    const url = APP_CONFIG?.zones?.url;
    if (!url) {
      console.warn("[TripsMap] No zones.url in APP_CONFIG");
      return;
    }

    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) {
      console.warn("[TripsMap] Zones fetch failed:", r.status, url);
      return;
    }

    const geo = await r.json();

    // Accept Feature or FeatureCollection
    const data =
      geo?.type === "Feature"
        ? { type: "FeatureCollection", features: [geo] }
        : geo;

    // Replace existing zones layer
    if (state.zonesLayer) state.zonesLayer.remove();

    state.zonesLayer = L.geoJSON(data, {
      style: () => (APP_CONFIG.zones.style || {}),
      onEachFeature: (feature, layer) => {
        const name = feature?.properties?.name || "Zone";
        const trip = feature?.properties?.trip || "";
        layer.bindTooltip(`<b>${name}</b><br>${trip}`, { sticky: true });
      }
    }).addTo(state.map);
  }

  function addCityMarker(latlng, name) {
    _ensureMapReady();
    if (!latlng) return null;

    const m = L.marker(latlng, { icon: state.cityIcon });

    // Always show city name (no count)
    m.bindTooltip(name, {
      permanent: true,
      direction: "top",
      offset: [0, -18],
      opacity: 0.9
    });

    state.citiesLayer.addLayer(m);
    return m;
  }

  function addTransport({ depLatLng, arrLatLng, type, popupHtml }) {
    _ensureMapReady();

    const color = _colorForType(type);

    // If you later want curves again, you can swap this array for a curve generator
    const points = [depLatLng, arrLatLng];

    const line = L.polyline(points, {
      color,
      weight: 3,
      opacity: 0.9,
      className: "flight-path"
    }).addTo(state.transportLayer);

    if (popupHtml) line.bindPopup(popupHtml);

    // Arrowhead on the line (safe)
    _safeAddArrow(line, color);

    // Click -> open popup
    if (popupHtml) {
      line.on("click", () => line.openPopup());
    }

    // CSS class for UI cards
    const cssClass = Utils.cardClass(type);

    return { line, cssClass, color };
  }

  return {
    init,
    invalidate,
    clear,
    loadZones,
    addCityMarker,
    addTransport
  };
})();
