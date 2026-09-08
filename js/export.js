// Exportação para MP4 usando ffmpeg.wasm (100% no navegador, sem servidor)
const Exporter = (() => {
  const overlay = document.getElementById("export-overlay");
  const fill = document.getElementById("export-progress-fill");
  const statusEl = document.getElementById("export-status");
  const downloadBtn = document.getElementById("export-download");
  const cancelBtn = document.getElementById("btn-export-cancel");

  let ffmpeg = null;
  let loaded = false;
  let cancelled = false;

  async function ensureLoaded() {
    if (loaded) return;
    statusEl.textContent = "Carregando motor de exportação (ffmpeg.wasm)…";
    const { FFmpeg } = FFmpegWASM;
    const { toBlobURL } = FFmpegUtil;
    ffmpeg = new FFmpeg();
    ffmpeg.on("progress", ({ progress }) => {
      if (progress >= 0 && progress <= 1) setProgress(progress);
    });
    const coreBase = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
    const ffmpegBase = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${coreBase}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${coreBase}/ffmpeg-core.wasm`, "application/wasm"),
      classWorkerURL: await toBlobURL(`${ffmpegBase}/814.ffmpeg.js`, "text/javascript"),
    });
    loaded = true;
  }

  function setProgress(p) {
    fill.style.width = `${Math.round(Utils.clamp(p, 0, 1) * 100)}%`;
  }

  function extOf(name) {
    const m = /\.([a-zA-Z0-9]+)$/.exec(name || "");
    return m ? m[1].toLowerCase() : "mp4";
  }

  // Reaplica os cortes de silêncio não ignorados sobre uma cópia da timeline,
  // sem alterar o estado real do editor.
  function buildFinalSegments() {
    const segments = [];
    for (const clip of State.s.timeline) {
      const dur = State.clipDuration(clip);
      const kept = (clip.silences || []).filter((s) => !s.ignored).sort((a, b) => a.start - b.start);
      if (kept.length === 0) {
        segments.push({ mediaId: clip.mediaId, in: clip.srcIn, out: clip.srcOut, muted: clip.muted });
        continue;
      }
      let cursor = 0;
      for (const sil of kept) {
        if (sil.start > cursor + 0.02) {
          segments.push({ mediaId: clip.mediaId, in: clip.srcIn + cursor, out: clip.srcIn + sil.start, muted: clip.muted });
        }
        cursor = sil.end;
      }
      if (cursor < dur - 0.02) {
        segments.push({ mediaId: clip.mediaId, in: clip.srcIn + cursor, out: clip.srcIn + dur, muted: clip.muted });
      }
    }
    return segments.filter((s) => s.out - s.in > 0.05);
  }

  async function run() {
    if (State.s.timeline.length === 0) {
      Utils.toast("Adicione vídeos à timeline antes de exportar.");
      return;
    }
    cancelled = false;
    overlay.classList.remove("hidden");
    downloadBtn.classList.add("hidden");
    cancelBtn.classList.remove("hidden");
    setProgress(0);

    try {
      await ensureLoaded();
      if (cancelled) return;

      const segments = buildFinalSegments();
      if (segments.length === 0) {
        Utils.toast("Nada para exportar depois dos cortes.");
        overlay.classList.add("hidden");
        return;
      }

      // grava cada mídia de origem única no sistema de arquivos do ffmpeg
      const { fetchFile } = FFmpegUtil;
      const writtenMedia = new Set();
      let step = 0;
      const totalSteps = segments.length + 2;

      for (const seg of segments) {
        if (cancelled) return;
        const media = State.getMedia(seg.mediaId);
        if (!writtenMedia.has(seg.mediaId)) {
          statusEl.textContent = `Carregando "${media.name}"…`;
          const data = await fetchFile(media.file);
          await ffmpeg.writeFile(`src_${seg.mediaId}.${extOf(media.name)}`, data);
          writtenMedia.add(seg.mediaId);
        }
      }

      const segFiles = [];
      for (let i = 0; i < segments.length; i++) {
        if (cancelled) return;
        const seg = segments[i];
        const media = State.getMedia(seg.mediaId);
        const inName = `src_${seg.mediaId}.${extOf(media.name)}`;
        const outName = `seg_${i}.mp4`;
        statusEl.textContent = `Cortando trecho ${i + 1} de ${segments.length}…`;

        const args = [
          "-ss", seg.in.toFixed(3),
          "-to", seg.out.toFixed(3),
          "-i", inName,
          "-c:v", "libx264", "-preset", "ultrafast", "-crf", "20",
          "-c:a", "aac", "-ar", "48000",
        ];
        if (seg.muted) args.push("-af", "volume=0");
        args.push("-movflags", "+faststart", outName);

        await ffmpeg.exec(args);
        segFiles.push(outName);
        step++;
        setProgress(step / totalSteps);
      }

      if (cancelled) return;

      statusEl.textContent = "Juntando trechos…";
      const listContent = segFiles.map((f) => `file '${f}'`).join("\n");
      await ffmpeg.writeFile("list.txt", listContent);
      await ffmpeg.exec(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "output.mp4"]);
      step++;
      setProgress(step / totalSteps);

      const data = await ffmpeg.readFile("output.mp4");
      const blob = new Blob([data.buffer], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);

      downloadBtn.href = url;
      const projectName = document.getElementById("project-name").textContent.trim() || "video-editado";
      downloadBtn.download = `${projectName.replace(/[^\w\-]+/g, "_")}.mp4`;
      downloadBtn.classList.remove("hidden");
      cancelBtn.classList.add("hidden");
      statusEl.textContent = "Exportação concluída!";
      setProgress(1);
    } catch (err) {
      console.error(err);
      statusEl.textContent = "Erro ao exportar. Veja o console para detalhes.";
      Utils.toast("Falha na exportação.", "error");
    }
  }

  function init() {
    document.getElementById("btn-export").addEventListener("click", run);
    cancelBtn.addEventListener("click", () => {
      cancelled = true;
      overlay.classList.add("hidden");
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay && !downloadBtn.classList.contains("hidden")) {
        overlay.classList.add("hidden");
      }
    });
  }

  return { init };
})();
