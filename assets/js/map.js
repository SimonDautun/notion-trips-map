window.TripsMap = (function () {
  let map, cityLayer, transportLayer, cityIcon, zonesLayer;

  function init() {
    const cfg = window.APP_CONFIG;

    map = L.map("map", { worldCopyJump: true }).setView(cfg.initialView.center, cfg.initialView.zoom);

    L.tileLayer(cfg.tiles.url, {
      maxZoom: cfg.tiles.maxZoom,
      attribution: cfg.tiles.attribution
    }).addTo(map);

    // IMPORTANT: tu ne voulais plus de regroupement visuel => layer simple (pas MarkerCluster)
    cityLayer = L.layerGroup().addTo(map);
    transportLayer = L.layerGroup().addTo(map);
    zonesLayer = L.layerGroup().addTo(map);

    cityIcon = new L.Icon({
      iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png",
      shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      shadowSize: [41, 41]
    });

    return map;
  }

  function invalidate() {
    if (!map) return;
    map.invalidateSize(true);
  }

  function clear() {
    cityLayer.clearLayers();
    transportLayer.clearLayers();
    zonesLayer.clearLayers();
  }

  function colorForType(type) {
    const t = Utils.norm(type);
    if (t.includes("train")) return APP_CONFIG.colors.train;
    if (t.includes("flight") || t.includes("plane") || t.includes("avion")) return APP_CONFIG.colors.flight;
    return APP_CONFIG.colors.default;
  }

  function cardClassForType(type) {
    const t = Utils.norm(type);
    if (t.includes("train")) return "green";
    if (t.includes("flight") || t.includes("plane") || t.includes("avion")) return "blue";
    return "gray";
  }

  function safeAddArrow(line, color) {
    if (L.polylineDecorator && L.Symbol && typeof L.Symbol.arrowHead === "function") {
      L.polylineDecorator(line, {
        patterns: [{
          offset: "60%",
          repeat: 0,
          symbol: L.Symbol.arrowHead({
            pixelSize: 12,
            polygon: false,
            pathOptions: { stroke: true, color, weight: 2, opacity: 0.95 }
          })
        }]
      }).addTo(transportLayer);
    }
  }

  async function loadZones() {
  const url = APP_CONFIG.zones?.url;
  if (!url) return;

  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`zones geojson (${res.status})`);
    const geo = await res.json();

    const style = APP_CONFIG.zones?.style || {};

    const layer = L.geoJSON(geo, {
      style: () => style,
      onEachFeature: (feature, leafletLayer) => {
        const p = feature.properties || {};
        const tip = p.tooltip || p.name || "Zone";
        leafletLayer.bindTooltip(tip, {
          sticky: true,
          direction: "top",
          opacity: 0.95
        });

        // Optionnel: popup plus riche au clic
        if (p.trip || p.name) {
          const html = `
            <div style="font-family: ui-sans-serif, system-ui;">
              <div style="font-weight:900;">${p.name || "Zone"}</div>
              ${p.trip ? `<div style="margin-top:6px;opacity:.85;">${p.trip}</div>` : ""}
            </div>
          `;
          leafletLayer.bindPopup(html);
        }
      }
    });

    zonesLayer.addLayer(layer);

  } catch (e) {
    console.warn("Zones non chargées:", e.message);
  }
}


  function addCityMarker(latlng, name) {
    const m = L.marker(latlng, { icon: cityIcon });
    m.bindTooltip(name, { permanent: true, direction: "top", offset: [0, -18], opacity: 0.9 });
    cityLayer.addLayer(m);
  }

  function addTransport({ depLatLng, arrLatLng, type, popupHtml }) {
    const color = colorForType(type);
    const line = L.polyline([depLatLng, arrLatLng], {
      color,
      weight: Utils.norm(type).includes("train") ? 4 : 3,
      opacity: 0.9,
      className: "flight-path"
    }).addTo(transportLayer);

    safeAddArrow(line, color);
    line.bindPopup(popupHtml);

    return { line, cssClass: cardClassForType(type), color };
  }

  return {
    init,
    invalidate,
    clear,
    addCityMarker,
    addTransport,
    loadZones,
    colorForType,
    cardClassForType,
    getMap: () => map
  };
})();
