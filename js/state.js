// Estado central da aplicação + histórico de desfazer/refazer
const State = (() => {
  const s = {
    user: null,
    media: [],            // { id, name, file, url, duration, audioBuffer, peaks, sizeBytes }
    timeline: [],         // clipes na ordem em que aparecem na timeline
    selectedClipId: null,
    zoom: 100,             // pixels por segundo
    sensitivity: 50,       // 0-100
    minSilenceLen: 0.4,    // segundos
    playhead: 0,           // segundos, posição global na timeline
  };

  const history = [];
  let historyIndex = -1;
  const MAX_HISTORY = 60;

  function snapshotTimeline() {
    return Utils.deepClone(s.timeline);
  }

  function pushHistory() {
    // descarta redo futuro
    history.splice(historyIndex + 1);
    history.push(snapshotTimeline());
    if (history.length > MAX_HISTORY) history.shift();
    historyIndex = history.length - 1;
  }

  function undo() {
    if (historyIndex <= 0) return false;
    historyIndex--;
    s.timeline = Utils.deepClone(history[historyIndex]);
    return true;
  }

  function redo() {
    if (historyIndex >= history.length - 1) return false;
    historyIndex++;
    s.timeline = Utils.deepClone(history[historyIndex]);
    return true;
  }

  function initHistory() {
    history.length = 0;
    historyIndex = -1;
    pushHistory();
  }

  function getMedia(id) {
    return s.media.find((m) => m.id === id);
  }

  function getClip(id) {
    return s.timeline.find((c) => c.id === id);
  }

  function clipDuration(clip) {
    return Math.max(0, clip.srcOut - clip.srcIn);
  }

  function totalDuration() {
    return s.timeline.reduce((sum, c) => sum + clipDuration(c), 0);
  }

  // posição inicial (em segundos, na timeline global) de cada clipe
  function clipStarts() {
    const starts = [];
    let t = 0;
    for (const c of s.timeline) {
      starts.push(t);
      t += clipDuration(c);
    }
    return starts;
  }

  // dado um tempo global, retorna { clip, index, localTime }
  function locateTime(globalTime) {
    const starts = clipStarts();
    for (let i = s.timeline.length - 1; i >= 0; i--) {
      if (globalTime >= starts[i] || i === 0) {
        const clip = s.timeline[i];
        const local = Utils.clamp(globalTime - starts[i], 0, clipDuration(clip));
        return { clip, index: i, localTime: local, clipStart: starts[i] };
      }
    }
    return null;
  }

  return {
    s,
    pushHistory,
    undo,
    redo,
    initHistory,
    getMedia,
    getClip,
    clipDuration,
    totalDuration,
    clipStarts,
    locateTime,
  };
})();
