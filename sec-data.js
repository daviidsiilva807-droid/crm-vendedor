/* ==========================================================================
   Modulo MINHA SECAO - Camada de dados (localStorage por usuario)
   - Estoque da secao: produtos, quantidade, minimo e local na loja
   - Tarefas: checklist diario (repete todo dia) e tarefas avulsas com prazo
   Depende de app-data.js (CRM.loginAtual) carregado antes.
   ========================================================================== */

(function () {
  const CATEGORIAS = ["Vestuário", "Tênis", "Acessórios", "Outro"];
  const GRUPOS = ["Abertura", "Reposição", "Organização", "Fechamento"];

  const CHECKLIST_PADRAO = [
    { titulo: "Conferir a vitrine e a arrumação da seção", grupo: "Abertura" },
    { titulo: "Verificar preços e etiquetas das peças expostas", grupo: "Abertura" },
    { titulo: "Repor as peças em falta na área de venda", grupo: "Reposição" },
    { titulo: "Dobrar e reorganizar as araras e prateleiras", grupo: "Organização" },
    { titulo: "Devolver ao lugar as peças dos provadores", grupo: "Organização" },
    { titulo: "Lançar as vendas do dia", grupo: "Fechamento" },
    { titulo: "Conferir reservas e pedidos pendentes", grupo: "Fechamento" }
  ];

  function chaveEstoque() {
    return `crm_secEstoque_v1_${CRM.loginAtual()}`;
  }

  function chaveTarefas() {
    return `crm_secTarefas_v1_${CRM.loginAtual()}`;
  }

  function lerLista(nomeChave) {
    try {
      const bruto = localStorage.getItem(nomeChave);
      const dados = bruto ? JSON.parse(bruto) : [];
      return Array.isArray(dados) ? dados : [];
    } catch (erro) {
      return [];
    }
  }

  function gravar(nomeChave, lista) {
    localStorage.setItem(nomeChave, JSON.stringify(lista));
  }

  function limpar(texto, max) {
    return String(texto === null || texto === undefined ? "" : texto).trim().slice(0, max || 200);
  }

  function inteiro(valor) {
    const n = Math.floor(Number(valor));
    return Number.isFinite(n) ? n : NaN;
  }

  function gerarId() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  function hojeISO() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function dataISOValida(texto) {
    return /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(new Date(`${texto}T00:00:00`).getTime());
  }

  /* -------------------------------- Estoque -------------------------------- */

  /** Situacao: "zerado", "baixo" (qtd <= minimo) ou "ok". */
  function situacao(item) {
    if (item.quantidade <= 0) return "zerado";
    if (item.minimo > 0 && item.quantidade <= item.minimo) return "baixo";
    return "ok";
  }

  function listarEstoque() {
    return lerLista(chaveEstoque())
      .map((item) => {
        const base = {
          id: String(item.id || ""),
          nome: limpar(item.nome, 120),
          categoria: CATEGORIAS.includes(item.categoria) ? item.categoria : "Outro",
          tamanho: limpar(item.tamanho, 20),
          cor: limpar(item.cor, 30),
          local: limpar(item.local, 60),
          quantidade: Math.max(0, inteiro(item.quantidade) || 0),
          minimo: Math.max(0, inteiro(item.minimo) || 0),
          atualizadoEm: item.atualizadoEm || ""
        };
        return Object.assign(base, { situacao: situacao(base) });
      })
      .filter((item) => item.id && item.nome)
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  function buscarItem(id) {
    return listarEstoque().find((item) => item.id === id) || null;
  }

  function salvarItem(dados, idEdicao) {
    const nome = limpar(dados && dados.nome, 120);
    const quantidade = inteiro(dados && dados.quantidade);
    const minimo = dados && String(dados.minimo).trim() !== "" ? inteiro(dados.minimo) : 0;
    const categoria = CATEGORIAS.includes(dados && dados.categoria) ? dados.categoria : "Outro";

    if (!nome) {
      return { ok: false, mensagem: "Informe o nome do produto." };
    }
    if (!Number.isInteger(quantidade) || quantidade < 0 || quantidade > 100000) {
      return { ok: false, mensagem: "Quantidade inválida. Use um número inteiro de 0 a 100000." };
    }
    if (!Number.isInteger(minimo) || minimo < 0 || minimo > 100000) {
      return { ok: false, mensagem: "Estoque mínimo inválido. Use um número inteiro de 0 a 100000." };
    }

    const lista = lerLista(chaveEstoque());
    const indice = idEdicao ? lista.findIndex((item) => item.id === idEdicao) : -1;
    const anterior = indice >= 0 ? lista[indice] : {};

    const item = Object.assign({}, anterior, {
      id: anterior.id || gerarId(),
      nome,
      categoria,
      tamanho: limpar(dados.tamanho, 20),
      cor: limpar(dados.cor, 30),
      local: limpar(dados.local, 60),
      quantidade,
      minimo,
      criadoEm: anterior.criadoEm || new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
    });

    if (indice >= 0) {
      lista[indice] = item;
    } else {
      lista.push(item);
    }
    gravar(chaveEstoque(), lista);
    return { ok: true, item, novo: indice < 0 };
  }

  function ajustarQuantidade(id, delta) {
    const lista = lerLista(chaveEstoque());
    const item = lista.find((x) => x.id === id);
    const passo = inteiro(delta);
    if (!item || !Number.isInteger(passo)) {
      return { ok: false };
    }
    item.quantidade = Math.min(100000, Math.max(0, (inteiro(item.quantidade) || 0) + passo));
    item.atualizadoEm = new Date().toISOString();
    gravar(chaveEstoque(), lista);
    return { ok: true, quantidade: item.quantidade };
  }

  function removerItem(id) {
    gravar(chaveEstoque(), lerLista(chaveEstoque()).filter((item) => item.id !== id));
    return { ok: true };
  }

  function resumoEstoque() {
    const itens = listarEstoque();
    return {
      produtos: itens.length,
      pecas: itens.reduce((soma, item) => soma + item.quantidade, 0),
      baixo: itens.filter((item) => item.situacao === "baixo").length,
      zerado: itens.filter((item) => item.situacao === "zerado").length
    };
  }

  /* --------------------------- Reposicao por grade -------------------------- */

  function normalizarTexto(texto) {
    return String(texto || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
  }

  /**
   * Le uma grade como "1P, 2M, 3G" ou "1x40, 2x42" ou "1P 2M 3G".
   * Cada pedaco e quantidade + tamanho. Tamanhos repetidos sao somados.
   */
  function lerGrade(texto) {
    const bruto = limpar(texto, 400);
    if (!bruto) {
      return { ok: false, mensagem: "Informe a grade. Ex.: 1P, 2M, 3G." };
    }

    const PEDACO = /^(\d{1,5})\s*x?\s*([A-Za-z0-9]{1,6})$/i;
    const TOKEN = /^(\d{1,5})x?([A-Za-z0-9]{1,6})$/i;
    const pedacos = [];

    bruto.split(/[,;\n]+/).forEach((parte) => {
      const p = parte.trim();
      if (!p) return;
      if (PEDACO.test(p)) {
        pedacos.push(p);
      } else if (/\s/.test(p)) {
        // "1P 2M 3G" sem virgulas: cada palavra e um pedaco
        p.split(/\s+/).forEach((token) => pedacos.push(token));
      } else {
        pedacos.push(p);
      }
    });

    const porTamanho = new Map();
    for (const pedaco of pedacos) {
      const m = pedaco.match(PEDACO) || pedaco.match(TOKEN);
      if (!m) {
        return { ok: false, mensagem: `Não entendi "${limpar(pedaco, 20)}". Use quantidade + tamanho, como 1P ou 2M.` };
      }
      const quantidade = Number(m[1]);
      const tamanho = m[2].toUpperCase();
      if (quantidade < 1) {
        return { ok: false, mensagem: `A quantidade de "${tamanho}" precisa ser pelo menos 1.` };
      }
      porTamanho.set(tamanho, (porTamanho.get(tamanho) || 0) + quantidade);
    }

    if (!porTamanho.size) {
      return { ok: false, mensagem: "Informe a grade. Ex.: 1P, 2M, 3G." };
    }

    const itens = Array.from(porTamanho, ([tamanho, quantidade]) => ({ tamanho, quantidade }));
    const total = itens.reduce((soma, i) => soma + i.quantidade, 0);
    if (total > 100000) {
      return { ok: false, mensagem: "Quantidade total grande demais." };
    }
    return { ok: true, itens, total };
  }

  /**
   * Soma a grade ao estoque do produto. Para cada tamanho: se ja existe o mesmo
   * produto + cor + tamanho, soma; senao cria um item novo (herdando categoria,
   * minimo e local de outro tamanho do mesmo produto, se houver).
   */
  function reporGrade(dados) {
    const nome = limpar(dados && dados.nome, 120);
    if (!nome) {
      return { ok: false, mensagem: "Informe o produto que está sendo reposto." };
    }
    const grade = lerGrade(dados && dados.grade);
    if (!grade.ok) {
      return grade;
    }

    const cor = limpar(dados && dados.cor, 30);
    const lista = lerLista(chaveEstoque());
    const mesmoProduto = lista.filter(
      (i) => normalizarTexto(i.nome) === normalizarTexto(nome) && normalizarTexto(i.cor) === normalizarTexto(cor)
    );
    const modelo = mesmoProduto[0] || {};
    const agora = new Date().toISOString();
    let somados = 0;
    let criados = 0;

    grade.itens.forEach((entrada) => {
      const existente = mesmoProduto.find((i) => String(i.tamanho || "").toUpperCase() === entrada.tamanho);
      if (existente) {
        existente.quantidade = Math.min(100000, (inteiro(existente.quantidade) || 0) + entrada.quantidade);
        existente.atualizadoEm = agora;
        somados += 1;
        return;
      }
      lista.push({
        id: gerarId(),
        nome: modelo.nome || nome,
        categoria: CATEGORIAS.includes(modelo.categoria)
          ? modelo.categoria
          : (CATEGORIAS.includes(dados.categoria) ? dados.categoria : "Outro"),
        tamanho: entrada.tamanho,
        cor: modelo.cor !== undefined ? modelo.cor : cor,
        local: modelo.local !== undefined && modelo.local !== "" ? modelo.local : limpar(dados.local, 60),
        quantidade: entrada.quantidade,
        minimo: Math.max(0, inteiro(modelo.minimo) || 0),
        criadoEm: agora,
        atualizadoEm: agora
      });
      criados += 1;
    });

    gravar(chaveEstoque(), lista);
    return { ok: true, somados, criados, total: grade.total, itens: grade.itens };
  }

  /** Nomes distintos de produtos, para sugerir no campo de reposicao. */
  function nomesDeProdutos() {
    return Array.from(new Set(listarEstoque().map((i) => i.nome)));
  }

  /* -------------------------------- Tarefas -------------------------------- */

  /**
   * Tarefa diaria (repete=true): feita quando feitoEm === hoje, volta a ficar
   * pendente sozinha no dia seguinte.
   * Tarefa avulsa: feita quando feitoEm tem qualquer data; pode ter prazo.
   */
  function estaFeita(tarefa) {
    return tarefa.repete ? tarefa.feitoEm === hojeISO() : Boolean(tarefa.feitoEm);
  }

  function listarTarefas() {
    const hoje = hojeISO();
    return lerLista(chaveTarefas())
      .map((tarefa) => {
        const base = {
          id: String(tarefa.id || ""),
          titulo: limpar(tarefa.titulo, 140),
          grupo: GRUPOS.includes(tarefa.grupo) ? tarefa.grupo : "Organização",
          repete: tarefa.repete === true,
          prazo: dataISOValida(String(tarefa.prazo || "")) ? tarefa.prazo : "",
          feitoEm: dataISOValida(String(tarefa.feitoEm || "")) ? tarefa.feitoEm : "",
          criadoEm: tarefa.criadoEm || ""
        };
        base.feita = estaFeita(base);
        base.atrasada = !base.repete && !base.feita && base.prazo !== "" && base.prazo < hoje;
        return base;
      })
      .filter((tarefa) => tarefa.id && tarefa.titulo);
  }

  function salvarTarefa(dados) {
    const titulo = limpar(dados && dados.titulo, 140);
    const repete = Boolean(dados && dados.repete);
    const prazo = limpar(dados && dados.prazo, 10);

    if (!titulo) {
      return { ok: false, mensagem: "Descreva a tarefa." };
    }
    if (!repete && prazo && !dataISOValida(prazo)) {
      return { ok: false, mensagem: "Prazo inválido." };
    }

    const lista = lerLista(chaveTarefas());
    const tarefa = {
      id: gerarId(),
      titulo,
      grupo: GRUPOS.includes(dados && dados.grupo) ? dados.grupo : "Organização",
      repete,
      prazo: repete ? "" : prazo,
      feitoEm: "",
      criadoEm: new Date().toISOString()
    };
    lista.push(tarefa);
    gravar(chaveTarefas(), lista);
    return { ok: true, tarefa };
  }

  function alternarTarefa(id) {
    const lista = lerLista(chaveTarefas());
    const tarefa = lista.find((item) => item.id === id);
    if (!tarefa) {
      return { ok: false };
    }
    tarefa.feitoEm = estaFeita(tarefa) ? "" : hojeISO();
    gravar(chaveTarefas(), lista);
    return { ok: true, feita: Boolean(tarefa.feitoEm) };
  }

  function removerTarefa(id) {
    gravar(chaveTarefas(), lerLista(chaveTarefas()).filter((item) => item.id !== id));
    return { ok: true };
  }

  /** Remove as avulsas ja concluidas. Devolve quantas saíram. */
  function limparConcluidas() {
    const lista = lerLista(chaveTarefas());
    const restantes = lista.filter((tarefa) => tarefa.repete === true || !tarefa.feitoEm);
    gravar(chaveTarefas(), restantes);
    return lista.length - restantes.length;
  }

  /** Adiciona o checklist padrao sem duplicar o que ja existe. */
  function adicionarChecklistPadrao() {
    const lista = lerLista(chaveTarefas());
    const existentes = new Set(lista.filter((t) => t.repete === true).map((t) => limpar(t.titulo, 140)));
    let adicionadas = 0;
    CHECKLIST_PADRAO.forEach((modelo) => {
      if (existentes.has(modelo.titulo)) return;
      lista.push({
        id: gerarId(),
        titulo: modelo.titulo,
        grupo: modelo.grupo,
        repete: true,
        prazo: "",
        feitoEm: "",
        criadoEm: new Date().toISOString()
      });
      adicionadas += 1;
    });
    gravar(chaveTarefas(), lista);
    return adicionadas;
  }

  /** Cria uma tarefa avulsa de reposicao para um item do estoque (sem duplicar). */
  function criarTarefaReposicao(item) {
    const titulo = limpar(`Repor ${item.nome}${item.tamanho ? ` (${item.tamanho})` : ""}`, 140);
    const ja = listarTarefas().some((t) => !t.repete && !t.feita && t.titulo === titulo);
    if (ja) {
      return { ok: true, jaExistia: true };
    }
    const resultado = salvarTarefa({ titulo, grupo: "Reposição", repete: false, prazo: hojeISO() });
    return Object.assign({ jaExistia: false }, resultado);
  }

  function resumoTarefasHoje() {
    const doDia = listarTarefas().filter((t) => t.repete || (!t.feita && (!t.prazo || t.prazo <= hojeISO())) || t.feitoEm === hojeISO());
    const feitas = doDia.filter((t) => t.feita).length;
    return {
      total: doDia.length,
      feitas,
      pendentes: doDia.length - feitas,
      atrasadas: doDia.filter((t) => t.atrasada).length
    };
  }

  window.SEC = {
    CATEGORIAS,
    GRUPOS,
    hojeISO,
    listarEstoque,
    buscarItem,
    salvarItem,
    ajustarQuantidade,
    removerItem,
    resumoEstoque,
    lerGrade,
    reporGrade,
    nomesDeProdutos,
    listarTarefas,
    salvarTarefa,
    alternarTarefa,
    removerTarefa,
    limparConcluidas,
    adicionarChecklistPadrao,
    criarTarefaReposicao,
    resumoTarefasHoje
  };
})();
