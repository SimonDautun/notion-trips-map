window.UI = (function () {
  const els = {};

  function init() {
    els.tripList = document.getElementById("tripList");
    els.stayList = document.getElementById("stayList");
    els.kpiNights = document.getElementById("kpiNights");
    els.kpiDistance = document.getElementById("kpiDistance");
    els.lastUpdated = document.getElementById("lastUpdated");
    els.overlay = document.querySelector(".overlay");

    // Mobile: panel repliable
    setupMobilePanel();
  }

  function setupMobilePanel() {
    if (!els.overlay) return;

    // crée bouton si pas déjà présent
    let btn = document.getElementById("togglePanel");
    if (!btn) {
      const header = els.overlay.querySelector(".header");
      btn = document.createElement("button");
      btn.id = "togglePanel";
      btn.type = "button";
      btn.textContent = "Ouvrir";
      btn.className = "panelToggle";
      header.appendChild(btn);
    }

    const setCollapsed = (collapsed) => {
      els.overlay.classList.toggle("collapsed", collapsed);
      btn.textContent = collapsed ? "Ouvrir" : "Réduire";
      // map.invalidateSize sera appelé depuis app.js après toggle (pour éviter dépendances)
    };

    // défaut mobile: réduit
    if (Utils.isMobile()) setCollapsed(true);
    else setCollapsed(false);

    btn.addEventListener("click", () => {
      const collapsed = !els.overlay.classList.contains("collapsed");
      setCollapsed(collapsed);
      window.dispatchEvent(new CustomEvent("overlay:toggled"));
    });
  }

  function clearLists() {
    els.tripList.innerHTML = "";
    els.stayList.innerHTML = "";
  }

  function addTripCard({ title, type, dateLabel, onClick, cssClass }) {
    const card = document.createElement("div");
    card.className = `card ${cssClass}`;
    card.innerHTML = `
      <div class="title">${title}</div>
      <div class="meta">
        <span class="badge">${type}</span>
        <span class="badge">${dateLabel}</span>
      </div>
    `;
    card.addEventListener("click", onClick);
    els.tripList.appendChild(card);
  }

  function addStayCard({ city, type, dateLabel, nightsLabel }) {
    const card = document.createElement("div");
    card.className = "card gray";
    card.innerHTML = `
      <div class="title">${city}</div>
      <div class="meta">
        <span class="badge">${type}</span>
        <span class="badge">${dateLabel}${nightsLabel ? ` (${nightsLabel})` : ""}</span>
      </div>
    `;
    els.stayList.appendChild(card);
  }

  function setKPIs({ totalNights, totalKm }) {
    els.kpiNights.textContent = totalNights > 0 ? totalNights.toLocaleString("fr-FR") : "—";
    els.kpiDistance.textContent = totalKm > 0 ? Math.round(totalKm).toLocaleString("fr-FR") + " km" : "—";
    els.lastUpdated.textContent = "maj: " + new Date().toLocaleDateString("fr-FR");
  }

  return { init, clearLists, addTripCard, addStayCard, setKPIs };
})();
