// Player central: reproduz a sequência de clipes da timeline como um vídeo só
const Player = (() => {
  const videoEl = document.getElementById("player");
  const emptyEl = document.getElementById("player-empty");
  const btnPlay = document.getElementById("btn-playpause");
  const timeCur = document.getElementById("time-current");
  const timeTotal = document.getElementById("time-total");
  const chkSkip = document.getElementById("chk-skip-preview");

  let currentClipId = null;
  let rafId = null;
  let isPlaying = false;

  function init() {
    btnPlay.addEventListener("click", togglePlay);
    videoEl.addEventListener("ended", handleClipEnded);
    videoEl.addEventListener("click", togglePlay);

    document.addEventListener("keydown", (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || e.target.isContentEditable) return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.key === "s" || e.key === "S") Timeline.splitAtPlayhead();
      if (e.key === "m" || e.key === "M") Timeline.toggleMute();
      if (e.key === "Delete" || e.key === "Backspace") Timeline.deleteSelected();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); doUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))) { e.preventDefault(); doRedo(); }
    });
  }

  function doUndo() {
    if (State.undo()) { Timeline.render(); reload(); Utils.toast("Desfeito"); }
  }
  function doRedo() {
    if (State.redo()) { Timeline.render(); reload(); Utils.toast("Refeito"); }
  }

  function reload() {
    const total = State.totalDuration();
    timeTotal.textContent = Utils.fmtTime(total);
    if (State.s.timeline.length === 0) {
      emptyEl.classList.remove("hidden");
      videoEl.removeAttribute("src");
      currentClipId = null;
      timeCur.textContent = Utils.fmtTime(0);
      return;
    }
    emptyEl.classList.add("hidden");
    seekGlobal(Utils.clamp(State.s.playhead, 0, total));
  }

  function loadClipMedia(clip, localTime, playAfter) {
    const media = State.getMedia(clip.mediaId);
    if (!media) return;
    currentClipId = clip.id;
    if (videoEl.src !== media.url) {
      videoEl.src = media.url;
    }
    const applySeek = () => {
      videoEl.currentTime = clip.srcIn + localTime;
      videoEl.muted = !!clip.muted;
      if (playAfter) videoEl.play().catch(() => {});
    };
    if (videoEl.readyState >= 1) applySeek();
    else videoEl.addEventListener("loadedmetadata", applySeek, { once: true });
  }

  function seekGlobal(time) {
    const total = State.totalDuration();
    time = Utils.clamp(time, 0, total);
    State.s.playhead = time;
    Timeline.renderPlayhead();
    timeCur.textContent = Utils.fmtTime(time);

    const loc = State.locateTime(time);
    if (!loc) return;
    loadClipMedia(loc.clip, loc.localTime, isPlaying);
  }

  function togglePlay() {
    if (State.s.timeline.length === 0) return;
    if (isPlaying) {
      videoEl.pause();
      isPlaying = false;
      btnPlay.innerHTML = Icons.svg("play");
      cancelAnimationFrame(rafId);
    } else {
      if (!currentClipId) seekGlobal(State.s.playhead);
      videoEl.play().catch(() => {});
      isPlaying = true;
      btnPlay.innerHTML = Icons.svg("pause");
      tick();
    }
  }

  function handleClipEnded() {
    const loc = State.locateTime(State.s.playhead);
    if (!loc) return;
    const nextIndex = loc.index + 1;
    if (nextIndex < State.s.timeline.length) {
      const nextClip = State.s.timeline[nextIndex];
      const starts = State.clipStarts();
      State.s.playhead = starts[nextIndex];
      loadClipMedia(nextClip, 0, true);
    } else {
      isPlaying = false;
      btnPlay.innerHTML = Icons.svg("play");
      cancelAnimationFrame(rafId);
    }
  }

  function tick() {
    if (!isPlaying) return;
    const loc = State.locateTime(State.s.playhead);
    if (loc && currentClipId === loc.clip.id) {
      const clip = loc.clip;
      const localTime = videoEl.currentTime - clip.srcIn;
      const starts = State.clipStarts();
      const idx = State.s.timeline.findIndex((c) => c.id === clip.id);
      let globalTime = starts[idx] + Utils.clamp(localTime, 0, State.clipDuration(clip));

      // pular silêncios não ignorados durante a pré-visualização
      if (chkSkip.checked) {
        const activeSil = (clip.silences || []).find((s) => !s.ignored && localTime >= s.start && localTime < s.end - 0.02);
        if (activeSil) {
          const jumpLocal = activeSil.end;
          if (jumpLocal >= State.clipDuration(clip) - 0.02) {
            handleClipEnded();
          } else {
            videoEl.currentTime = clip.srcIn + jumpLocal;
            globalTime = starts[idx] + jumpLocal;
          }
        }
      }

      State.s.playhead = globalTime;
      Timeline.renderPlayhead();
      timeCur.textContent = Utils.fmtTime(globalTime);

      // checagem de fim de clipe (troca de mídia) quando o navegador não dispara 'ended'
      if (localTime >= State.clipDuration(clip) - 0.03 && idx < State.s.timeline.length - 1) {
        handleClipEnded();
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  return { init, reload, seekGlobal, togglePlay };
})();
