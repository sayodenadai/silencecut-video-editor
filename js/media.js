// Upload de mídia, lista lateral e adição de clipes à timeline
const Media = (() => {
  const listEl = document.getElementById("media-list");
  const inputEl = document.getElementById("input-upload");

  function init() {
    inputEl.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      inputEl.value = "";
      for (const file of files) {
        await addFile(file);
      }
    });
  }

  async function addFile(file) {
    const id = Utils.uid("media");
    const url = URL.createObjectURL(file);
    const item = {
      id,
      name: file.name,
      file,
      url,
      duration: 0,
      audioBuffer: null,
      peaks: null,
      peaksPerSecond: 10,
      sizeBytes: file.size,
      thumb: null,
      status: "loading", // loading | ready | error
    };
    State.s.media.push(item);
    render();
    Utils.toast(`Importando "${file.name}"…`);

    try {
      // duração + thumbnail via elemento <video> oculto
      await loadVideoMeta(item);
      // áudio para waveform + detecção
      const audioBuffer = await Silence.decode(file);
      item.audioBuffer = audioBuffer;
      const mono = Silence.toMono(audioBuffer);
      item.peaks = Silence.computePeaks(mono, item.peaksPerSecond, audioBuffer.sampleRate);
      item.status = "ready";
      Utils.toast(`"${file.name}" pronto.`, "success");
    } catch (err) {
      console.error(err);
      item.status = "ready-no-audio";
      Utils.toast(`"${file.name}" importado sem áudio detectável.`, "");
    }
    render();
  }

  function loadVideoMeta(item) {
    return new Promise((resolve, reject) => {
      const v = document.createElement("video");
      v.src = item.url;
      v.muted = true;
      v.preload = "metadata";
      v.addEventListener("loadedmetadata", () => {
        item.duration = v.duration;
        v.currentTime = Math.min(0.5, v.duration / 2);
      });
      v.addEventListener("seeked", () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 104;
          canvas.height = 68;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
          item.thumb = canvas.toDataURL("image/jpeg", 0.7);
        } catch (e) { /* CORS ou codec sem frame; ignora thumb */ }
        resolve();
      });
      v.addEventListener("error", () => reject(new Error("Falha ao carregar vídeo")));
    });
  }

  function render() {
    if (State.s.media.length === 0) {
      listEl.innerHTML = `<p class="empty-hint">Nenhum vídeo importado ainda.<br/>Clique em "+ Importar" para começar.</p>`;
      return;
    }
    listEl.innerHTML = "";
    for (const item of State.s.media) {
      const el = document.createElement("div");
      el.className = "media-item";
      el.draggable = true;
      el.dataset.mediaId = item.id;
      el.innerHTML = `
        ${item.thumb ? `<img class="media-thumb" src="${item.thumb}" />` : `<div class="media-thumb"></div>`}
        <div class="media-info">
          <div class="media-name">${escapeHtml(item.name)}</div>
          <div class="media-meta">${item.status === "loading" ? "analisando…" : Utils.fmtDuration(item.duration)} · ${Utils.fmtBytes(item.sizeBytes)}</div>
        </div>
        <button class="media-add-btn" title="Adicionar à timeline">${Icons.svg("plus")}</button>
      `;
      el.querySelector(".media-add-btn").addEventListener("click", (ev) => {
        ev.stopPropagation();
        addToTimeline(item.id);
      });
      el.addEventListener("dblclick", () => addToTimeline(item.id));
      el.addEventListener("dragstart", (ev) => {
        ev.dataTransfer.setData("text/media-id", item.id);
        ev.dataTransfer.effectAllowed = "copy";
      });
      listEl.appendChild(el);
    }
  }

  function addToTimeline(mediaId) {
    const item = State.getMedia(mediaId);
    if (!item) return;
    if (item.status === "loading") {
      Utils.toast("Aguarde o vídeo terminar de carregar.");
      return;
    }
    const clip = {
      id: Utils.uid("clip"),
      mediaId: item.id,
      name: item.name,
      srcIn: 0,
      srcOut: item.duration || 1,
      muted: false,
      silences: [], // { id, start, end (relativo ao clipe), ignored }
    };
    State.s.timeline.push(clip);
    State.pushHistory();
    State.s.selectedClipId = clip.id;
    Timeline.render();
    Player.reload();
    Utils.toast(`"${item.name}" adicionado à timeline.`);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  return { init, addFile, addToTimeline, render };
})();
