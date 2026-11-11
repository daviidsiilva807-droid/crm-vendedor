/* ==========================================================================
   Planta da loja (mapa das secoes) - compartilhada entre a pagina da secao
   e a pagina de compartilhamento. Depende de secao-escala.js (Escala).
   ========================================================================== */

(function () {
  /* Coordenadas aproximadas da planta impressa (viewBox 600 x 545).
     `secao` liga o desenho ao numero da folha; `tipo` muda so o visual. */
  const ZONAS = [
    { secao: 7, tipo: "parede", x: 4, y: 3, w: 176, h: 24 },
    { secao: 6, tipo: "parede", x: 190, y: 3, w: 168, h: 24 },
    { secao: 8, tipo: "parede", x: 4, y: 33, w: 25, h: 99 },
    { secao: 8, tipo: "movel", x: 105, y: 58, w: 146, h: 60 },
    { secao: 3, tipo: "movel", x: 261, y: 66, w: 49, h: 55 },
    { secao: 5, tipo: "movel", x: 69, y: 165, w: 74, h: 28 },
    { secao: 1, tipo: "movel", x: 99, y: 193, w: 24, h: 66 },
    { secao: 6, tipo: "movel", x: 191, y: 165, w: 92, h: 55 },
    { secao: 5, tipo: "movel", x: 218, y: 231, w: 43, h: 47 },
    { secao: 4, tipo: "movel", x: 337, y: 207, w: 54, h: 44 },
    { secao: 3, tipo: "parede", x: 413, y: 225, w: 21, h: 220 },
    { secao: 4, tipo: "movel", x: 251, y: 308, w: 54, h: 33 },
    { secao: 3, tipo: "movel", x: 332, y: 286, w: 75, h: 171 },
    { secao: 4, tipo: "movel", x: 207, y: 377, w: 76, h: 27 },
    { secao: 2, tipo: "movel", x: 207, y: 404, w: 76, h: 28 },
    { secao: 1, tipo: "parede", x: 10, y: 468, w: 110, h: 24 },
    { secao: 2, tipo: "parede", x: 130, y: 468, w: 170, h: 24 },
    { secao: 3, tipo: "parede", x: 310, y: 468, w: 95, h: 24 }
  ];

  const AREAS_FIXAS = [
    { nome: "CAIXA", x: 380, y: 17, w: 113, h: 115 },
    { nome: "BOH", x: 499, y: 6, w: 86, h: 121 },
    { nome: "PROVADOR", x: 440, y: 209, w: 150, h: 296 },
    { nome: "LAUNCH ZONE", x: 67, y: 278, w: 103, h: 159 }
  ];

  const SVG_NS = "http://www.w3.org/2000/svg";

  function criarSVG(tag, atributos) {
    const no = document.createElementNS(SVG_NS, tag);
    Object.keys(atributos || {}).forEach((chave) => no.setAttribute(chave, atributos[chave]));
    return no;
  }

  function desenharFixos(grupo) {
    grupo.textContent = "";

    AREAS_FIXAS.forEach((area) => {
      grupo.appendChild(criarSVG("rect", {
        x: area.x, y: area.y, width: area.w, height: area.h, rx: 6,
        fill: "#f1f3f6", stroke: "#cbd5e1", "stroke-width": 1.5,
        "stroke-dasharray": "5 4"
      }));

      const texto = criarSVG("text", {
        x: area.x + area.w / 2,
        y: area.y + area.h / 2,
        "text-anchor": "middle",
        "dominant-baseline": "middle",
        class: "fixo-rotulo"
      });
      texto.textContent = area.nome;
      grupo.appendChild(texto);
    });
  }

  /* opcoes.responsavelPor(secao) -> { nome } | null ; opcoes.selecionada -> numero | null */
  function desenharZonas(grupo, opcoes) {
    const config = opcoes || {};
    const responsavelPor = config.responsavelPor || (() => null);
    const secaoSelecionada = config.selecionada === undefined ? null : config.selecionada;

    grupo.textContent = "";

    ZONAS.forEach((zona, indice) => {
      const cor = Escala.corDaSecao(zona.secao);
      const dono = responsavelPor(zona.secao);
      const selecionada = secaoSelecionada === zona.secao;

      const bloco = criarSVG("g", { class: "zona", tabindex: "0", role: "button" });
      bloco.dataset.secao = String(zona.secao);
      bloco.dataset.indice = String(indice);
      bloco.setAttribute("aria-label", `Secao ${String(zona.secao).padStart(2, "0")} - ${dono ? dono.nome : ""}`);

      if (secaoSelecionada !== null && !selecionada) {
        bloco.classList.add("apagada");
      }

      bloco.appendChild(criarSVG("rect", {
        x: zona.x, y: zona.y, width: zona.w, height: zona.h,
        rx: zona.tipo === "parede" ? 3 : 6,
        fill: cor.suave,
        stroke: cor.forte,
        "stroke-width": selecionada ? 3 : 1.8
      }));

      /* Blocos estreitos e verticais (paredes laterais, araras) levam o
         numero deitado para nao estourar a largura. */
      const meioX = zona.x + zona.w / 2;
      const meioY = zona.y + zona.h / 2;
      const deitado = zona.w < 30 && zona.h > zona.w;
      const cabe = deitado ? (zona.h >= 26 && zona.w >= 15) : (zona.w >= 26 && zona.h >= 20);

      if (cabe) {
        const texto = criarSVG("text", {
          x: meioX,
          y: meioY,
          "text-anchor": "middle",
          "dominant-baseline": "middle",
          class: "zona-rotulo",
          fill: cor.forte
        });

        if (deitado) {
          texto.setAttribute("transform", `rotate(-90 ${meioX} ${meioY})`);
        }

        texto.textContent = String(zona.secao).padStart(2, "0");
        bloco.appendChild(texto);
      }

      const titulo = criarSVG("title", {});
      titulo.textContent = `Secao ${String(zona.secao).padStart(2, "0")}${dono ? " - " + dono.nome : ""}`;
      bloco.appendChild(titulo);

      grupo.appendChild(bloco);
    });
  }

  window.MapaLoja = { ZONAS, AREAS_FIXAS, criarSVG, desenharFixos, desenharZonas };
})();
