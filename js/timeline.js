// Renderização e interação da timeline: blocos, waveform, arrastar, cortar, mutar
const Timeline = (() => {
  const scrollEl = document.getElementById("timeline-scroll");
  const rulerEl = document.getElementById("timeline-ruler");
  const trackEl = document.getElementById("timeline-track");
  const playheadEl = document.getElementById("playhead");
  const zoomInput = document.getElementById("zoom");
  const silenceListEl = document.getElementById("silence-list");
  const silenceCountEl = document.getElementById("silence-count");
  const btnCutAll = document.getElementById("btn-cut-all");

  let dragState = null; // { clipId, startX, originIndex }

  function init() {
    zoomInput.addEventListener("input", () => {
      State.s.zoom = Number(zoomInput.value);
      render();
    });

    document.getElementById("btn-zoom-in").addEventListener("click", () => {
      State.s.zoom = Utils.clamp(State.s.zoom + 30, 20, 400);
      zoomInput.value = State.s.zoom;
      render();
    });
    document.getElementById("btn-zoom-out").addEventListener("click", () => {
      State.s.zoom = Utils.clamp(State.s.zoom - 30, 20, 400);
      zoomInput.value = State.s.zoom;
      render();
    });

    scrollEl.addEventListener("click", (e) => {
      if (e.target === trackEl || e.target === rulerEl) {
        const rect = trackEl.getBoundingClientRect();
        const x = e.clientX - rect.left + scrollEl.scrollLeft;
        const time = Utils.clamp(x / State.s.zoom, 0, State.totalDuration());
        Player.seekGlobal(time);
      }
      if (e.target === trackEl) {
        State.s.selectedClipId = null;
        render();
      }
    });

    scrollEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    });
    scrollEl.addEventListener("drop", (e) => {
      e.preventDefault();
      const mediaId = e.dataTransfer.getData("text/media-id");
      if (mediaId) Media.addToTimeline(mediaId);
    });

    document.getElementById("btn-detect").addEventListener("click", detectAll);
    btnCutAll.addEventListener("click", cutAllSilences);

    document.getElementById("sensitivity").addEventListener("input", (e) => {
      State.s.sensitivity = Number(e.target.value);
      document.getElementById("sensitivity-value").textContent = `${State.s.sensitivity}%`;
    });
    document.getElementById("minlen").addEventListener("input", (e) => {
      State.s.minSilenceLen = Number(e.target.value) / 10;
      document.getElementById("minlen-value").textContent = `${State.s.minSilenceLen.toFixed(1)}s`;
    });
  }

  function pxPerSec() {
    return State.s.zoom;
  }

  function render() {
    const total = Math.max(30, State.totalDuration() + 10);
    const widthPx = total * pxPerSec();
    trackEl.style.width = `${widthPx}px`;
    rulerEl.style.width = `${widthPx}px`;

    renderRuler(total, widthPx);
    renderClips();
    renderPlayhead();
    renderSilenceList();

    btnCutAll.disabled = !State.s.timeline.some((c) => (c.silences || []).some((s) => !s.ignored));
  }

  function renderRuler(total, widthPx) {
    rulerEl.innerHTML = "";
    const ppS = pxPerSec();
    let step = 1;
    if (ppS < 40) step = 5;
    if (ppS < 20) step = 10;
    if (ppS >= 150) step = 0.5;
    for (let t = 0; t <= total; t += step) {
      const tick = document.createElement("div");
      tick.className = "ruler-tick";
      tick.style.left = `${t * ppS}px`;
      tick.textContent = Utils.fmtTime(t).replace(/\.\d$/, "");
      rulerEl.appendChild(tick);
    }
  }

  function renderClips() {
    // remove blocos antigos (mantém playhead)
    trackEl.querySelectorAll(".clip-block").forEach((el) => el.remove());

    const starts = State.clipStarts();
    State.s.timeline.forEach((clip, i) => {
      const media = State.getMedia(clip.mediaId);
      const dur = State.clipDuration(clip);
      const x = starts[i] * pxPerSec();
      const w = Math.max(4, dur * pxPerSec());

      const el = document.createElement("div");
      el.className = "clip-block" + (clip.id === State.s.selectedClipId ? " selected" : "");
      el.style.left = `${x}px`;
      el.style.width = `${w}px`;
      el.dataset.clipId = clip.id;

      const header = document.createElement("div");
      header.className = "clip-header";
      header.innerHTML = `${clip.muted ? '<span class="mute-flag">🔇</span>' : ""}<span>${escapeHtml(clip.name)}</span>`;
      el.appendChild(header);

      const waveWrap = document.createElement("div");
      waveWrap.className = "clip-wave";
      const canvas = document.createElement("canvas");
      waveWrap.appendChild(canvas);
      el.appendChild(waveWrap);

      if (clip.muted) {
        const muteOverlay = document.createElement("div");
        muteOverlay.className = "clip-mute-overlay";
        waveWrap.appendChild(muteOverlay);
      }

      // overlays de silêncio
      (clip.silences || []).forEach((sil) => {
        const sx = (sil.start / dur) * 100;
        const sw = ((sil.end - sil.start) / dur) * 100;
        const ov = document.createElement("div");
        ov.className = "silence-overlay" + (sil.ignored ? " ignored" : "");
        ov.style.left = `${sx}%`;
        ov.style.width = `${sw}%`;
        ov.title = sil.ignored ? "Silêncio ignorado (clique para reativar)" : "Silêncio detectado (clique para ignorar)";
        ov.addEventListener("click", (e) => {
          e.stopPropagation();
          sil.ignored = !sil.ignored;
          State.pushHistory();
          render();
        });
        waveWrap.appendChild(ov);
      });

      const handleL = document.createElement("div");
      handleL.className = "resize-handle left";
      const handleR = document.createElement("div");
      handleR.className = "resize-handle right";
      el.appendChild(handleL);
      el.appendChild(handleR);

      el.addEventListener("click", (e) => {
        if (e.target === handleL || e.target === handleR) return;
        e.stopPropagation();
        selectClip(clip.id);
      });
      el.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        toggleMute(clip.id);
      });

      setupDrag(el, clip);
      setupResize(el, clip, handleL, "left");
      setupResize(el, clip, handleR, "right");

      trackEl.appendChild(el);

      // desenha waveform de forma assíncrona (após medir largura real)
      requestAnimationFrame(() => drawClipWave(canvas, media, clip));
    });
  }

  function drawClipWave(canvas, media, clip) {
    if (!media || !media.peaks) return;
    const wrap = canvas.parentElement;
    const cssW = wrap.clientWidth || 1;
    const cssH = wrap.clientHeight || 1;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    const peaks = media.peaks;
    const pps = media.peaksPerSecond;
    const startIdx = Math.floor(clip.srcIn * pps);
    const endIdx = Math.ceil(clip.srcOut * pps);
    const n = Math.max(1, endIdx - startIdx);
    const mid = cssH / 2;

    ctx.fillStyle = getCssVar("--wave") || "#9c8cff";
    const barW = Math.max(1, cssW / n);
    for (let i = 0; i < n; i++) {
      const idx = startIdx + i;
      const v = idx >= 0 && idx < peaks.length ? peaks[idx] : 0;
      const h = Math.max(1, v * cssH * 0.9);
      ctx.globalAlpha = 0.9;
      ctx.fillRect(i * barW, mid - h / 2, Math.max(1, barW - 0.5), h);
    }
  }

  function getCssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function renderPlayhead() {
    playheadEl.style.left = `${State.s.playhead * pxPerSec()}px`;
  }

  function selectClip(id) {
    State.s.selectedClipId = id;
    render();
  }

  // ---------- arrastar para reordenar ----------
  function setupDrag(el, clip) {
    let dragging = false;
    let startX = 0;
    let originalOrder = null;

    el.addEventListener("mousedown", (e) => {
      if (e.target.classList.contains("resize-handle")) return;
      startX = e.clientX;
      dragging = false;
      originalOrder = [...State.s.timeline];

      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        if (!dragging && Math.abs(dx) > 6) {
          dragging = true;
          el.classList.add("dragging");
          selectClip(clip.id);
        }
        if (dragging) {
          const rect = scrollEl.getBoundingClientRect();
          const x = ev.clientX - rect.left + scrollEl.scrollLeft;
          const time = x / pxPerSec();
          const newIndex = computeDropIndex(clip.id, time);
          reorderClip(clip.id, newIndex, false);
        }
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        el.classList.remove("dragging");
        if (dragging) {
          const changed = JSON.stringify(originalOrder.map((c) => c.id)) !== JSON.stringify(State.s.timeline.map((c) => c.id));
          if (changed) State.pushHistory();
          render();
        }
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  function computeDropIndex(clipId, time) {
    const others = State.s.timeline.filter((c) => c.id !== clipId);
    let acc = 0;
    for (let i = 0; i < others.length; i++) {
      const dur = State.clipDuration(others[i]);
      if (time < acc + dur / 2) return i;
      acc += dur;
    }
    return others.length;
  }

  function reorderClip(clipId, newIndex, record = true) {
    const idx = State.s.timeline.findIndex((c) => c.id === clipId);
    if (idx === -1) return;
    const [clip] = State.s.timeline.splice(idx, 1);
    const insertAt = Utils.clamp(newIndex, 0, State.s.timeline.length);
    State.s.timeline.splice(insertAt, 0, clip);
    if (record) State.pushHistory();
    renderClips();
    renderPlayhead();
  }

  // ---------- redimensionar (trim in/out) ----------
  function setupResize(el, clip, handle, side) {
    handle.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      const media = State.getMedia(clip.mediaId);
      const startX = e.clientX;
      const startIn = clip.srcIn;
      const startOut = clip.srcOut;

      const onMove = (ev) => {
        const dx = (ev.clientX - startX) / pxPerSec();
        if (side === "left") {
          clip.srcIn = Utils.clamp(startIn + dx, 0, clip.srcOut - 0.15);
        } else {
          clip.srcOut = Utils.clamp(startOut + dx, clip.srcIn + 0.15, media ? media.duration : startOut + 999);
        }
        clip.silences = [];
        renderClips();
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        State.pushHistory();
        render();
        Player.reload();
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  }

  // ---------- ações ----------
  function toggleMute(id) {
    const clip = State.getClip(id || State.s.selectedClipId);
    if (!clip) { Utils.toast("Selecione um bloco primeiro."); return; }
    clip.muted = !clip.muted;
    State.pushHistory();
    render();
  }

  function deleteSelected() {
    const id = State.s.selectedClipId;
    if (!id) { Utils.toast("Selecione um bloco primeiro."); return; }
    State.s.timeline = State.s.timeline.filter((c) => c.id !== id);
    State.s.selectedClipId = null;
    State.pushHistory();
    render();
    Player.reload();
  }

  function splitAtPlayhead() {
    const loc = State.locateTime(State.s.playhead);
    if (!loc) { Utils.toast("Nada para dividir."); return; }
    const { clip, index, localTime } = loc;
    if (localTime <= 0.05 || localTime >= State.clipDuration(clip) - 0.05) {
      Utils.toast("Posicione o cursor dentro de um bloco para dividir.");
      return;
    }
    const splitSrc = clip.srcIn + localTime;
    const left = { ...Utils.deepClone(clip), id: Utils.uid("clip"), srcOut: splitSrc, silences: sliceSilences(clip.silences, 0, localTime) };
    const right = { ...Utils.deepClone(clip), id: Utils.uid("clip"), srcIn: splitSrc, silences: sliceSilences(clip.silences, localTime, State.clipDuration(clip)).map((s) => ({ ...s, start: s.start - localTime, end: s.end - localTime })) };
    State.s.timeline.splice(index, 1, left, right);
    State.s.selectedClipId = left.id;
    State.pushHistory();
    render();
    Utils.toast("Bloco dividido.");
  }

  function sliceSilences(silences, from, to) {
    return (silences || [])
      .filter((s) => s.end > from && s.start < to)
      .map((s) => ({ ...s, start: Math.max(s.start, from), end: Math.min(s.end, to) }));
  }

  // ---------- detecção de silêncio ----------
  function detectAll() {
    if (State.s.timeline.length === 0) {
      Utils.toast("Adicione um vídeo à timeline primeiro.");
      return;
    }
    let count = 0;
    for (const clip of State.s.timeline) {
      const media = State.getMedia(clip.mediaId);
      if (!media || !media.audioBuffer) continue;
      const raw = Silence.detectSilences(media.audioBuffer, {
        sensitivity: State.s.sensitivity,
        minSilenceLen: State.s.minSilenceLen,
      });
      const clipDur = State.clipDuration(clip);
      clip.silences = raw
        .filter((s) => s.end > clip.srcIn && s.start < clip.srcOut)
        .map((s) => ({
          id: Utils.uid("sil"),
          start: Utils.clamp(s.start - clip.srcIn, 0, clipDur),
          end: Utils.clamp(s.end - clip.srcIn, 0, clipDur),
          ignored: false,
        }))
        .filter((s) => s.end - s.start > 0.05);
      count += clip.silences.length;
    }
    State.pushHistory();
    render();
    Utils.toast(count > 0 ? `${count} trecho(s) de silêncio encontrado(s).` : "Nenhum silêncio encontrado com esses parâmetros.", count > 0 ? "success" : "");
  }

  function cutAllSilences() {
    const newTimeline = [];
    let cutSeconds = 0;
    for (const clip of State.s.timeline) {
      const dur = State.clipDuration(clip);
      const kept = (clip.silences || []).filter((s) => !s.ignored).sort((a, b) => a.start - b.start);
      if (kept.length === 0) {
        newTimeline.push(clip);
        continue;
      }
      let cursor = 0;
      for (const sil of kept) {
        if (sil.start > cursor + 0.02) {
          newTimeline.push(makeSubClip(clip, cursor, sil.start));
        }
        cutSeconds += sil.end - sil.start;
        cursor = sil.end;
      }
      if (cursor < dur - 0.02) {
        newTimeline.push(makeSubClip(clip, cursor, dur));
      }
    }
    State.s.timeline = newTimeline;
    State.s.selectedClipId = null;
    State.pushHistory();
    render();
    Player.reload();
    Utils.toast(`Silêncios cortados. ${cutSeconds.toFixed(1)}s removidos.`, "success");
  }

  function makeSubClip(clip, localFrom, localTo) {
    return {
      id: Utils.uid("clip"),
      mediaId: clip.mediaId,
      name: clip.name,
      srcIn: clip.srcIn + localFrom,
      srcOut: clip.srcIn + localTo,
      muted: clip.muted,
      silences: [],
    };
  }

  function renderSilenceList() {
    const starts = State.clipStarts();
    const rows = [];
    State.s.timeline.forEach((clip, i) => {
      (clip.silences || []).forEach((sil) => {
        rows.push({ clip, sil, globalStart: starts[i] + sil.start, globalEnd: starts[i] + sil.end });
      });
    });
    silenceCountEl.textContent = rows.length;

    if (rows.length === 0) {
      silenceListEl.innerHTML = `<p class="empty-hint">Rode a detecção para ver os trechos de silêncio aqui.</p>`;
      return;
    }
    silenceListEl.innerHTML = "";
    rows.sort((a, b) => a.globalStart - b.globalStart);
    for (const row of rows) {
      const el = document.createElement("div");
      el.className = "silence-item" + (row.sil.ignored ? " ignored" : "");
      el.innerHTML = `
        <span class="silence-swatch"></span>
        <span class="silence-time">${Utils.fmtTime(row.globalStart)}
          <span class="silence-dur">(${(row.globalEnd - row.globalStart).toFixed(1)}s)</span>
        </span>
        <button class="silence-toggle">${row.sil.ignored ? "Cortar" : "Ignorar"}</button>
      `;
      el.querySelector(".silence-toggle").addEventListener("click", (e) => {
        e.stopPropagation();
        row.sil.ignored = !row.sil.ignored;
        State.pushHistory();
        render();
      });
      el.addEventListener("click", () => Player.seekGlobal(row.globalStart));
      silenceListEl.appendChild(el);
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    init,
    render,
    renderClips,
    renderPlayhead,
    selectClip,
    toggleMute,
    deleteSelected,
    splitAtPlayhead,
    detectAll,
    cutAllSilences,
  };
})();
