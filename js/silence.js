// Decodificação de áudio, geração de picos (waveform) e detecção de silêncio
const Silence = (() => {
  let audioCtx = null;
  function getCtx() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
  }

  // Decodifica o arquivo e retorna um AudioBuffer (mono, downmix)
  async function decode(file) {
    const ctx = getCtx();
    const arrayBuffer = await file.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuffer.slice(0));
  }

  // Extrai um array mono de amostras a partir do AudioBuffer (média dos canais)
  function toMono(audioBuffer) {
    const ch = audioBuffer.numberOfChannels;
    const len = audioBuffer.length;
    const out = new Float32Array(len);
    for (let c = 0; c < ch; c++) {
      const data = audioBuffer.getChannelData(c);
      for (let i = 0; i < len; i++) out[i] += data[i] / ch;
    }
    return out;
  }

  // Gera picos (min/max por bucket) para desenhar a waveform rapidamente
  function computePeaks(monoData, bucketsPerSecond, sampleRate) {
    const totalBuckets = Math.max(1, Math.ceil((monoData.length / sampleRate) * bucketsPerSecond));
    const samplesPerBucket = Math.max(1, Math.floor(monoData.length / totalBuckets));
    const peaks = new Float32Array(totalBuckets);
    for (let b = 0; b < totalBuckets; b++) {
      let max = 0;
      const start = b * samplesPerBucket;
      const end = Math.min(monoData.length, start + samplesPerBucket);
      for (let i = start; i < end; i++) {
        const v = Math.abs(monoData[i]);
        if (v > max) max = v;
      }
      peaks[b] = max;
    }
    return peaks; // um valor por (1/bucketsPerSecond) segundos
  }

  // Calcula RMS em janelas de ~20ms para detecção de silêncio
  function computeRmsWindows(monoData, sampleRate, windowMs = 20) {
    const windowSize = Math.max(1, Math.floor((windowMs / 1000) * sampleRate));
    const numWindows = Math.ceil(monoData.length / windowSize);
    const rms = new Float32Array(numWindows);
    for (let w = 0; w < numWindows; w++) {
      const start = w * windowSize;
      const end = Math.min(monoData.length, start + windowSize);
      let sum = 0;
      for (let i = start; i < end; i++) sum += monoData[i] * monoData[i];
      rms[w] = Math.sqrt(sum / Math.max(1, end - start));
    }
    return { rms, windowMs };
  }

  function rmsToDb(rms) {
    if (rms <= 0.0000001) return -100;
    return 20 * Math.log10(rms);
  }

  // sensitivity 0-100 -> limiar em dB. 0 = só silêncio absoluto (-55dB), 100 = bem permissivo (-24dB)
  function sensitivityToDb(sensitivity) {
    const min = -55;
    const max = -24;
    return min + (sensitivity / 100) * (max - min);
  }

  // Detecta trechos de silêncio a partir de um AudioBuffer já decodificado.
  // Retorna lista de { start, end } em segundos, relativa ao início do áudio.
  function detectSilences(audioBuffer, { sensitivity = 50, minSilenceLen = 0.4 } = {}) {
    const mono = toMono(audioBuffer);
    const sampleRate = audioBuffer.sampleRate;
    const { rms, windowMs } = computeRmsWindows(mono, sampleRate, 20);
    const thresholdDb = sensitivityToDb(sensitivity);

    const isSilentWindow = new Array(rms.length);
    for (let i = 0; i < rms.length; i++) {
      isSilentWindow[i] = rmsToDb(rms[i]) < thresholdDb;
    }

    const secPerWindow = windowMs / 1000;
    const minWindows = Math.max(1, Math.round(minSilenceLen / secPerWindow));

    const silences = [];
    let runStart = -1;
    for (let i = 0; i <= isSilentWindow.length; i++) {
      const silent = i < isSilentWindow.length ? isSilentWindow[i] : false;
      if (silent && runStart === -1) {
        runStart = i;
      } else if (!silent && runStart !== -1) {
        const runLen = i - runStart;
        if (runLen >= minWindows) {
          silences.push({
            start: runStart * secPerWindow,
            end: i * secPerWindow,
          });
        }
        runStart = -1;
      }
    }
    return silences;
  }

  return { decode, toMono, computePeaks, detectSilences, sensitivityToDb };
})();
