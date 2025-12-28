(async function main() {
  UI.init();
  const map = TripsMap.init();
  await TripsMap.loadZones();

  window.addEventListener("overlay:toggled", () => {
    setTimeout(() => TripsMap.invalidate(), 250);
  });

  async function load() {
    const r = await fetch(APP_CONFIG.dataUrl, { cache: "no-store" });
    if (!r.ok) throw new Error(`Impossible de charger cities.json (${r.status})`);
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  }

  function render(records) {
    TripsMap.clear();
    UI.clearLists();

    const cities = new Map(); // norm(name) -> { latlng, name }
    let totalKm = 0;
    let totalNights = 0;

    records.sort((a, b) =>
      (a.departure_date || a.arrival_date || "").localeCompare(b.departure_date || b.arrival_date || "")
    );

    records.forEach((r) => {
      const arr = Array.isArray(r.arrival) && r.arrival.length === 2 ? L.latLng(r.arrival[0], r.arrival[1]) : null;
      const dep = Array.isArray(r.departure) && r.departure.length === 2 ? L.latLng(r.departure[0], r.departure[1]) : null;
      const type = r.type || "";

      if (arr) {
        const name = Utils.cityOnly(r.arrival_label);
        const key = Utils.norm(name);
        if (!cities.has(key)) cities.set(key, { latlng: arr, name });
      }
      if (dep) {
        const name = Utils.cityOnly(r.departure_label);
        const key = Utils.norm(name);
        if (!cities.has(key)) cities.set(key, { latlng: dep, name });
      }

      // Transport
      if (dep && arr) {
        const title = `${Utils.cityOnly(r.departure_label)} → ${Utils.cityOnly(r.arrival_label)}`;
        const dateLabel = `${Utils.fmtDate(r.departure_date)} → ${Utils.fmtDate(r.arrival_date)}`;

        const popupHtml = `<b>${title}</b><br>${type}<br>${dateLabel}`;
        const { line, cssClass } = TripsMap.addTransport({
          depLatLng: dep,
          arrLatLng: arr,
          type,
          popupHtml
        });

        UI.addTripCard({
          title,
          type,
          dateLabel: Utils.fmtDate(r.departure_date),
          cssClass,
          onClick: () => line.openPopup()
        });

        if (typeof r.distance_km === "number") totalKm += r.distance_km;
        return;
      }

      // Stay
      if (arr) {
        let a = r.arrival_date;
        let d = r.departure_date;
        if (a && d && a.slice(0, 10) > d.slice(0, 10)) [a, d] = [d, a];

        const n = Utils.nights(a, d);
        if (typeof n === "number" && n > 0) totalNights += n;

        UI.addStayCard({
          city: Utils.cityOnly(r.arrival_label),
          type,
          dateLabel: `${Utils.fmtDate(a)} → ${Utils.fmtDate(d)}`,
          nightsLabel: n != null ? `${n} nuits` : null
        });
      }
    });

    // Cities
    cities.forEach((c) => TripsMap.addCityMarker(c.latlng, c.name));

    UI.setKPIs({ totalNights, totalKm });
  }

  try {
    const records = await load();
    render(records);
  } catch (e) {
    console.error(e);
    alert("Erreur: " + e.message);
  }
})();
