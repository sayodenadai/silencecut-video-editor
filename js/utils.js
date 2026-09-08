// Funções utilitárias compartilhadas
const Utils = (() => {
  function uid(prefix = "id") {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function fmtTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = seconds - m * 60;
    return `${String(m).padStart(2, "0")}:${s.toFixed(1).padStart(4, "0")}`;
  }

  function fmtDuration(seconds) {
    if (!isFinite(seconds)) return "0s";
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds - m * 60);
    return `${m}m ${s}s`;
  }

  function fmtBytes(bytes) {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  let toastTimer = null;
  function toast(message, type = "") {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.className = `toast ${type}`;
    el.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add("hidden"), 3200);
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  return { uid, fmtTime, fmtDuration, fmtBytes, clamp, toast, deepClone };
})();
