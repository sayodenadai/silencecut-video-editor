// Ponto de entrada: login e ligação dos módulos
(function App() {
  const viewLogin = document.getElementById("view-login");
  const viewEditor = document.getElementById("view-editor");
  const loginForm = document.getElementById("login-form");
  const btnGuest = document.getElementById("btn-guest");
  const userEmailEl = document.getElementById("user-email");

  const SESSION_KEY = "silencecut_session";

  function enterEditor(email) {
    State.s.user = { email };
    userEmailEl.textContent = email;
    viewLogin.classList.add("hidden");
    viewEditor.classList.remove("hidden");
    localStorage.setItem(SESSION_KEY, JSON.stringify({ email }));

    if (!App._initialized) {
      Media.init();
      Timeline.init();
      Player.init();
      Exporter.init();
      State.initHistory();
      Timeline.render();
      Player.reload();
      wireTopbar();
      App._initialized = true;
    }
  }

  function wireTopbar() {
    document.getElementById("btn-undo").addEventListener("click", () => {
      if (State.undo()) { Timeline.render(); Player.reload(); Utils.toast("Desfeito"); }
    });
    document.getElementById("btn-redo").addEventListener("click", () => {
      if (State.redo()) { Timeline.render(); Player.reload(); Utils.toast("Refeito"); }
    });
    document.getElementById("btn-split").addEventListener("click", () => Timeline.splitAtPlayhead());
    document.getElementById("btn-mute").addEventListener("click", () => Timeline.toggleMute());
    document.getElementById("btn-delete").addEventListener("click", () => Timeline.deleteSelected());
    document.getElementById("btn-playpause").addEventListener("click", () => {}); // já ligado no Player

    document.getElementById("btn-logout").addEventListener("click", () => {
      localStorage.removeItem(SESSION_KEY);
      location.reload();
    });
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value.trim();
    if (!email) return;
    enterEditor(email);
  });

  btnGuest.addEventListener("click", () => {
    enterEditor("convidado@local");
  });

  // restaura sessão local, se houver
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (saved && saved.email) enterEditor(saved.email);
  } catch (e) { /* ignora sessão inválida */ }
})();
