window.Utils = {
  norm(s) {
    return String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  },

  cityOnly(label) {
    return (label || "").split(",")[0].trim();
  },

  fmtDate(iso) {
    return iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";
  },

  nights(a, b) {
    if (!a || !b) return null;
    const d = Math.abs((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
    return Math.round(d);
  },

  isMobile() {
    return window.matchMedia(
      `(max-width: ${window.APP_CONFIG.mobile.maxWidth}px)`
    ).matches;
  },

  // 👉 Utilisé par TripsMap.addTransport
  cardClass(type) {
    const t = this.norm(type);

    if (t.includes("train")) return "card card--train";
    if (t.includes("flight") || t.includes("plane") || t.includes("avion")) {
      return "card card--flight";
    }

    return "card";
  }
};
