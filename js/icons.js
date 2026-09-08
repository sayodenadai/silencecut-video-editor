// Ícones em SVG (substituem emojis por elementos vetoriais nítidos e acessíveis)
const Icons = (() => {
  const base = (inner, viewBox = "0 0 24 24") =>
    `<svg viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`;

  const set = {
    undo: base(`<path d="M1 4v6h6"/><path d="M3.5 15a9 9 0 1 0 2.1-9.4L1 10"/>`),
    redo: base(`<path d="M23 4v6h-6"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L23 10"/>`),
    scissors: base(`<circle cx="6" cy="6" r="2.6"/><circle cx="6" cy="18" r="2.6"/><path d="M8.3 8.1L20 19"/><path d="M8.3 15.9L20 5"/>`),
    mute: base(`<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 9l6 6"/><path d="M22 9l-6 6"/>`),
    trash: base(`<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7"/>`),
    play: base(`<path d="M8 5v14l11-7z" fill="currentColor" stroke="none"/>`),
    pause: base(`<rect x="6.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1" fill="currentColor" stroke="none"/>`),
    plus: base(`<path d="M12 5v14"/><path d="M5 12h14"/>`),
    minus: base(`<path d="M5 12h14"/>`),
    upload: base(`<path d="M12 16V4"/><path d="M6 10l6-6 6 6"/><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>`),
    logout: base(`<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="M15 16l5-4-5-4"/><path d="M20 12H9"/>`),
    download: base(`<path d="M12 4v12"/><path d="M6 10l6 6 6-6"/><path d="M4 20h16"/>`),
    film: base(`<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 15h18M8 4v16M16 4v16"/>`),
  };

  function svg(name) {
    return set[name] || "";
  }

  // preenche todo elemento com [data-icon="nome"] com o SVG correspondente
  function hydrate(root = document) {
    root.querySelectorAll("[data-icon]").forEach((el) => {
      const name = el.getAttribute("data-icon");
      if (set[name]) el.innerHTML = set[name];
    });
  }

  return { svg, hydrate };
})();
