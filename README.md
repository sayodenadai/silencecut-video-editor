# SilenceCut — Editor de Vídeo no Navegador

Editor de vídeo 100% client-side (HTML + CSS + JS puro) com detecção automática
de silêncio e exportação para MP4 via `ffmpeg.wasm`. Nenhum vídeo sai do seu
computador — tudo roda no navegador.

## Como rodar

O app **precisa** ser servido por um servidor HTTP local (não abra o
`index.html` direto com `file://`), porque o `ffmpeg.wasm` carrega um worker e
um binário `.wasm` que exigem esse contexto.

Escolha uma opção:

```bash
npx serve .
```

```bash
python -m http.server 5500
```

Depois abra `http://localhost:5500` (ou a porta indicada) no Chrome ou Edge.

## Fluxo de uso

1. **Login** — tela simples de entrada (demo local, aceita qualquer e-mail/senha,
   ou "Entrar como convidado").
2. **Importar** — clique em "+ Importar" na barra lateral esquerda e selecione
   um ou vários vídeos.
3. **Adicionar à timeline** — clique no botão "+" de um item de mídia (ou
   arraste-o para a timeline).
4. **Detectar silêncios** — ajuste a sensibilidade e a duração mínima no
   painel direito e clique em "Detectar silêncios". Os trechos aparecem em
   laranja sobre a waveform e na lista à direita.
5. **Revisar** — clique num trecho de silêncio (na timeline ou na lista) para
   ignorá-lo (ele deixa de ser cortado).
6. **Cortar** — "Cortar todos os silêncios" remove definitivamente os trechos
   não ignorados, dividindo o clipe em blocos.
7. **Edição manual** — selecione um bloco e use os botões (ou atalhos) da
   barra superior:
   - `S` dividir no cursor
   - `M` mutar/desmutar o bloco selecionado
   - `Delete` excluir o bloco selecionado
   - `Ctrl+Z` / `Ctrl+Y` desfazer / refazer
   - Arraste um bloco pela timeline para reordenar
   - Arraste as bordas de um bloco para aparar (trim)
8. **Exportar** — clique em "Exportar MP4". A conversão roda no navegador via
   `ffmpeg.wasm`; ao terminar, um botão de download do `.mp4` final aparece.

## Estrutura

```
video-editor/
  index.html        estrutura das telas (login + editor)
  styles.css         tema escuro (estilo Premiere/CapCut)
  js/
    utils.js          helpers (tempo, toast, clamp…)
    state.js           estado central + histórico (undo/redo)
    silence.js          decodificação de áudio + detecção de silêncio
    media.js              upload e lista de mídias
    timeline.js             blocos, waveform, drag, cortes, mute
    player.js                 player sincronizado com a timeline
    export.js                  exportação MP4 via ffmpeg.wasm
    app.js                      login e inicialização
```

## Limitações conhecidas (demo)

- Login é local/demonstrativo — não há backend ou validação real de senha.
- A exportação re-codifica cada trecho (H.264/AAC) para poder concatenar
  clipes de fontes diferentes; vídeos longos podem demorar para exportar,
  pois tudo roda via WebAssembly no navegador.
- A decodificação de áudio para detecção de silêncio depende do navegador
  conseguir decodificar a trilha do arquivo (funciona bem em MP4/WebM/MOV
  com áudio AAC/Opus/PCM no Chrome/Edge).
