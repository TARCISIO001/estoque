
// ======================
// FIREBASE CONFIG (TOPO)
// ======================
var firebaseConfig = {
  apiKey: "AIzaSyDRYDcYZuvTz-ot3cWgv_kkj2hiGdPe6Ts",
  authDomain: "controle-estoque-81fdc.firebaseapp.com",
  projectId: "controle-estoque-81fdc",
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ======================
// LOGIN
// ======================

let usuarioLogado = null;
// total das dívidas (quantidade * valor)
let totalDividasBruto = 0;
// total já abatido/pago
let totalAbatidoDividas = 0;
let dadosSistemaCarregados = false;


// TEMPO DE INATIVIDADE PARA LOGOUT (10 minutos)
const TEMPO_LIMITE = 10 * 60 * 1000; // 10 minutos em milissegundos
let timerLogout; // guarda o timer

function resetarTimer() {
  // se já existir um timer, cancela
  if (timerLogout) clearTimeout(timerLogout);

  // cria novo timer
  timerLogout = setTimeout(() => {
    alert("Você ficou inativo. Voltando para login.");
    sair(); // chama a função de logout que você já tem
  }, TEMPO_LIMITE);
}

function ativarLayoutSistema() {
  document.body.classList.remove("login-page");
}

function escaparTextoAcao(valor) {
  return String(valor ?? "")
    .trim()
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ");
}


function botaoAcao(classe, onclick, icone, texto) {
  return `<button type="button" class="acao-btn ${classe}" onclick="${onclick}" title="${texto}" aria-label="${texto}"><span class="acao-ico">${icone}</span><span class="acao-txt">${texto}</span></button>`;
}

function botaoAcaoEstatico(classe, icone, texto) {
  return `<span class="acao-btn ${classe} acao-static" title="${texto}" aria-label="${texto}"><span class="acao-ico">${icone}</span><span class="acao-txt">${texto}</span></span>`;
}

function linhaAcoes(botoes) {
  return `<div class="acoes-linha">${botoes.filter(Boolean).join("")}</div>`;
}



// ======================
// FORMULÁRIOS INTERNOS / BUSCA
// ======================
const CONFIG_LISTAS_MOVIMENTO = {
  estoque: {
    buscaId: "buscaEstoque",
    totalId: "resumoEstoqueTotal",
    ultimaId: "resumoEstoqueUltima",
    contadorId: "contadorEstoqueVisivel"
  },
  saida: {
    buscaId: "buscaSaida",
    totalId: "resumoSaidaTotal",
    ultimaId: "resumoSaidaUltima",
    contadorId: "contadorSaidaVisivel"
  },
  laboratorio: {
    buscaId: "buscaLaboratorio",
    totalId: "resumoLaboratorioTotal",
    ultimaId: "resumoLaboratorioUltima",
    contadorId: "contadorLaboratorioVisivel"
  }
};

function normalizarBusca(valor) {
  return String(valor ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function mascaraDataCampo(campo) {
  if (!campo) return;

  const numeros = String(campo.value ?? "").replace(/\D/g, "").slice(0, 8);

  if (numeros.length <= 2) {
    campo.value = numeros;
    return;
  }

  if (numeros.length <= 4) {
    campo.value = `${numeros.slice(0, 2)}/${numeros.slice(2)}`;
    return;
  }

  campo.value = `${numeros.slice(0, 2)}/${numeros.slice(2, 4)}/${numeros.slice(4)}`;
}

function preencherHoje(idCampo) {
  const campo = document.getElementById(idCampo);
  if (!campo) return;

  const hoje = new Date();
  const dia = String(hoje.getDate()).padStart(2, "0");
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const ano = hoje.getFullYear();

  campo.value = `${dia}/${mes}/${ano}`;
  campo.focus();
}

function alternarFormulario(idForm, idCampoInicial) {
  const form = document.getElementById(idForm);
  if (!form) return;

  const abrir = !form.classList.contains("aberto");
  form.classList.toggle("aberto", abrir);

  if (abrir && idCampoInicial) {
    setTimeout(() => document.getElementById(idCampoInicial)?.focus(), 80);
  }
}

function abrirFormulario(idForm, idCampoInicial) {
  const form = document.getElementById(idForm);
  if (form) form.classList.add("aberto");
  if (idCampoInicial) setTimeout(() => document.getElementById(idCampoInicial)?.focus(), 80);
}

function valorCampo(idCampo) {
  return String(document.getElementById(idCampo)?.value ?? "").trim();
}

function focarCampo(idCampo) {
  setTimeout(() => document.getElementById(idCampo)?.focus(), 80);
}

function mensagemFormulario(idForm, texto, tipo = "ok") {
  const form = document.getElementById(idForm);
  const msg = form?.querySelector(".form-mensagem");
  if (!msg) return;

  msg.textContent = texto || "";
  msg.classList.remove("erro", "ok");
  if (texto) msg.classList.add(tipo);

  if (texto && tipo === "ok") {
    setTimeout(() => {
      if (msg.textContent === texto) msg.textContent = "";
      msg.classList.remove("ok");
    }, 3500);
  }
}

function limparFormularioMovimento(idForm, idCampoInicial) {
  const form = document.getElementById(idForm);
  if (form) form.reset();
  mensagemFormulario(idForm, "");
  if (idCampoInicial) focarCampo(idCampoInicial);
}

function obterDataFormulario(idCampo, idForm) {
  const campo = document.getElementById(idCampo);
  const data = formatarData(campo?.value || "");

  if (!data) {
    focarCampo(idCampo);
    return null;
  }

  if (!validarDataNaoFutura(data)) {
    focarCampo(idCampo);
    return null;
  }

  if (campo) campo.value = data;
  mensagemFormulario(idForm, "");
  return data;
}

function obterQuantidadeFormulario(idCampo) {
  const valor = Number(String(document.getElementById(idCampo)?.value ?? "").replace(",", "."));

  if (!Number.isFinite(valor) || valor <= 0) {
    alert("Informe uma quantidade maior que zero.");
    focarCampo(idCampo);
    return null;
  }

  return valor;
}

function filtrarTabela(tbodyId, termo) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;

  const busca = normalizarBusca(termo);

  tbody.querySelectorAll("tr").forEach((tr) => {
    const texto = tr.dataset.busca || normalizarBusca(tr.textContent);
    tr.hidden = !!busca && !texto.includes(busca);
  });

  atualizarResumoLista(tbodyId);
}

function aplicarFiltroAtual(tbodyId) {
  const cfg = CONFIG_LISTAS_MOVIMENTO[tbodyId];
  const termo = cfg ? document.getElementById(cfg.buscaId)?.value || "" : "";
  filtrarTabela(tbodyId, termo);
}

function atualizarResumoLista(tbodyId) {
  const cfg = CONFIG_LISTAS_MOVIMENTO[tbodyId];
  const tbody = document.getElementById(tbodyId);
  if (!cfg || !tbody) return;

  const linhas = Array.from(tbody.querySelectorAll("tr"));
  const visiveis = linhas.filter((tr) => !tr.hidden);
  const primeiraLinha = visiveis[0] || linhas[0];
  const ultimaData = primeiraLinha?.dataset.data || "--/--/----";

  const totalEl = document.getElementById(cfg.totalId);
  const ultimaEl = document.getElementById(cfg.ultimaId);
  const contadorEl = document.getElementById(cfg.contadorId);

  if (totalEl) totalEl.textContent = linhas.length;
  if (ultimaEl) ultimaEl.textContent = ultimaData;

  if (contadorEl) {
    if (!linhas.length) {
      contadorEl.textContent = "0 registros";
    } else if (visiveis.length === linhas.length) {
      contadorEl.textContent = `${linhas.length} ${linhas.length === 1 ? "registro" : "registros"}`;
    } else {
      contadorEl.textContent = `${visiveis.length} de ${linhas.length} registros`;
    }
  }
}

function prepararLinhaMovimento(tr, item) {
  const data = item?.data || "";
  const nome = item?.nome || "";
  const quantidade = Number(item?.quantidade ?? 0);

  tr.dataset.data = data;
  tr.dataset.quantidade = Number.isFinite(quantidade) ? String(quantidade) : "0";
  tr.dataset.busca = normalizarBusca(`${data} ${nome} ${quantidade}`);
}


function obterDiaSemana(dataFormatada) {
  if (!dataFormatada) return "";
  const partes = String(dataFormatada).split("/").map(Number);
  if (partes.length !== 3) return "";

  const [dia, mes, ano] = partes;
  const data = new Date(ano, mes - 1, dia);
  if (
    data.getFullYear() !== ano ||
    data.getMonth() !== mes - 1 ||
    data.getDate() !== dia
  ) {
    return "";
  }

  return data.toLocaleDateString("pt-BR", { weekday: "long" });
}

function renderDataMovimento(data) {
  const diaSemana = obterDiaSemana(data);
  return `
    <div class="data-card">
      <span class="data-icone" aria-hidden="true">🗓️</span>
      <span class="data-principal">${data || "--/--/----"}</span>
      ${diaSemana ? `<span class="data-dia">${diaSemana}</span>` : ""}
    </div>
  `;
}

function etiquetaMovimento(tipo) {
  if (tipo === "estoque") return "📦 ENTRADA";
  if (tipo === "saida") return "📤 SAÍDA";
  if (tipo === "laboratorio") return "🧪 LABORATÓRIO";
  return "📌 MATERIAL";
}

function renderMaterialMovimento(nome, tipo) {
  return `
    <div class="material-card">
      <strong class="material-nome">${nome || "Sem nome"}</strong>
      <span class="material-etiqueta">${etiquetaMovimento(tipo)}</span>
    </div>
  `;
}

const TELAS_SISTEMA = [
  "telaEntrada",
  "telaSaida",
  "telaLaboratorio",
  "telaDividas",
  "telaUsuarios",
  "telaLogs",
  "telaConfiguracoes"
];

function usuarioEhMaster() {
  return usuarioLogado?.tipo === "master";
}

function atualizarSaudacaoUsuario() {
  const el = document.getElementById("saudacaoUsuario");
  if (!el) return;

  const nome = usuarioLogado?.usuario || "usuário";
  const tipo = usuarioEhMaster() ? "MASTER" : "Usuário";
  el.textContent = `Olá, ${nome} • ${tipo}`;
}

function aplicarPermissoesVisuais() {
  const isMaster = usuarioEhMaster();

  document.querySelectorAll("[data-master-only]").forEach((el) => {
    el.classList.toggle("oculto-permissao", !isMaster);
    el.style.display = isMaster ? "" : "none";
  });

  ["areaAdmin", "areaLogs", "areaMasterConfig"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = isMaster ? "" : "none";
  });

  document.querySelectorAll(".dividas-acoes button").forEach((btn) => {
    btn.style.display = isMaster ? "inline-flex" : "none";
  });
}

function mostrarMenuPrincipal() {
  const menu = document.getElementById("menuPrincipal");
  const btnMenu = document.getElementById("btnMenuTopo");

  TELAS_SISTEMA.forEach((id) => {
    const tela = document.getElementById(id);
    if (tela) tela.classList.remove("ativa");
  });

  if (menu) menu.style.display = "block";
  if (btnMenu) btnMenu.style.display = "none";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function abrirTela(idTela) {
  const telasMaster = ["telaUsuarios", "telaLogs", "telaConfiguracoes"];
  if (telasMaster.includes(idTela) && !usuarioEhMaster()) {
    alert("Acesso permitido somente para o MASTER.");
    mostrarMenuPrincipal();
    return;
  }

  const menu = document.getElementById("menuPrincipal");
  const btnMenu = document.getElementById("btnMenuTopo");
  const telaAlvo = document.getElementById(idTela);

  if (!telaAlvo) return;

  TELAS_SISTEMA.forEach((id) => {
    const tela = document.getElementById(id);
    if (tela) tela.classList.remove("ativa");
  });

  if (menu) menu.style.display = "none";
  telaAlvo.classList.add("ativa");
  if (btnMenu) btnMenu.style.display = "inline-flex";

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function prepararSistemaLogado() {
  ativarLayoutSistema();
  atualizarSaudacaoUsuario();
  aplicarPermissoesVisuais();

  const login = document.getElementById("telaLogin");
  const sistema = document.getElementById("sistema");

  if (login) login.style.display = "none";
  if (sistema) sistema.style.display = "block";

  mostrarMenuPrincipal();
}

function carregarDadosSistema() {
  if (dadosSistemaCarregados) return;
  dadosSistemaCarregados = true;

  if (usuarioEhMaster()) {
    carregarUsuarios();
    carregarLogs();
  }

  carregarEstoque();
  carregarSaida();
  carregarLaboratorio();
  carregarDividas();
  carregarAbatimentosDividas();
}

function mostrarSistemaAposLogin() {
  prepararSistemaLogado();
}


function fazerLogin() {
  const usuario = document.getElementById("usuario").value.trim();
  const senha = document.getElementById("senha").value.trim();

  if (!usuario || !senha) {
    alert("Preencha usuário e senha");
    return;
  }

  db.collection("usuarios")
    .where("usuario", "==", usuario)
    .where("senha", "==", senha)
    .limit(1)
    .get()
    .then((snapshot) => {
      if (snapshot.empty) {
        alert("Usuário ou senha inválidos");
        return;
      }

      // ✅ salva usuário logado (COM ID)
      usuarioLogado = {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      };

      localStorage.setItem("usuarioLogado", JSON.stringify(usuarioLogado));

      prepararSistemaLogado();
      carregarDadosSistema();
      resetarTimer();
    })
    .catch((err) => {
      console.error(err);
      alert("Erro ao conectar com o banco: " + (err?.message || err));
    });
}


document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("btnEntrar");
  if (btn) btn.addEventListener("click", fazerLogin);

  // Enter no teclado
  const u = document.getElementById("usuario");
  const s = document.getElementById("senha");
  [u, s].forEach(el => {
    if (!el) return;
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") fazerLogin();
    });
  });
});



// ======================
// ESTOQUE - ENTRADA
// ======================
function addEntrada(){
  abrirTela("telaEntrada");
  abrirFormulario("formEntrada", "entradaData");
}

function salvarEntradaFormulario(){
  const formId = "formEntrada";
  const data = obterDataFormulario("entradaData", formId);
  if(!data) return;

  const nome = valorCampo("entradaNome");
  if(!validarNome(nome)) {
    focarCampo("entradaNome");
    return;
  }

  const qtd = obterQuantidadeFormulario("entradaQtd");
  if(qtd === null) return;

  db.collection("estoque")
    .add({
      data,
      nome,
      quantidade: qtd,
      dataOrdem: dataParaOrdem(data),
      dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
    })
    .then(() => {
      registrarLog(
        "Entrada",
        `${usuarioLogado?.usuario || "usuário"} cadastrou entrada | Material: ${nome} | Qtd: ${qtd}`
      );
      limparFormularioMovimento(formId, "entradaData");
      mensagemFormulario(formId, "Entrada salva com sucesso.", "ok");
    })
    .catch((err) => {
      console.error(err);
      mensagemFormulario(formId, "Erro ao salvar entrada.", "erro");
      alert("Erro ao salvar entrada.");
    });
}

function carregarEstoque(){
  const estoqueEl = document.getElementById("estoque");
  if (!estoqueEl) return;

  db.collection("estoque")
    .orderBy("dataOrdem", "desc")
    .onSnapshot(snapshot => {
      estoqueEl.innerHTML = "";

      snapshot.forEach(d => {
        const i = d.data() || {};
        const tr = document.createElement("tr");
        tr.id = "estoque-" + d.id;
        prepararLinhaMovimento(tr, i);

        const nomeSeguro = escaparTextoAcao(i.nome || "");

        tr.innerHTML = `
          <td data-label="Material">${renderMaterialMovimento(i.nome || "", "estoque")}</td>
          <td data-label="Data">${renderDataMovimento(i.data || "")}</td>
          <td data-label="Qtd"><span class="qtd-numero">${i.quantidade ?? ""}</span></td>
          <td data-label="Ações">
            ${linhaAcoes([
              botaoAcao("acao-add", `alterarEstoque('${d.id}',1)`, "➕", "Mais"),
              botaoAcao("acao-sub", `alterarEstoque('${d.id}',-1)`, "➖", "Menos"),
              botaoAcao("acao-edit", `editarNome('estoque','${d.id}','${nomeSeguro}')`, "✏️", "Editar"),
              botaoAcao("acao-delete", `excluir('estoque','${d.id}')`, "🗑️", "Excluir")
            ])}
          </td>
        `;

        estoqueEl.appendChild(tr);
      });

      aplicarFiltroAtual("estoque");
    });
}

function alterarEstoque(id, v){
  const r = db.collection("estoque").doc(id);
  r.get().then(d => {
    let n = d.data().quantidade + v;
    if(n < 0) return;
let acao = v > 0 ? "Aumentou" : "Diminuiu";

r.update({ quantidade: n }).then(() => {
  registrarLog(
    "Estoque",
    `${usuarioLogado.usuario} ${acao.toLowerCase()} estoque | Material: ${d.data().nome} | Nova qtd: ${n}`
  );
});
  });
}

// ======================
// SAÍDA
// ======================
function addSaida(){
  abrirTela("telaSaida");
  abrirFormulario("formSaida", "saidaData");
}

function salvarSaidaFormulario(){
  const formId = "formSaida";
  const data = obterDataFormulario("saidaData", formId);
  if(!data) return;

  const nome = valorCampo("saidaNome");
  if(!validarNome(nome)) {
    focarCampo("saidaNome");
    return;
  }

  const qtd = obterQuantidadeFormulario("saidaQtd");
  if(qtd === null) return;

  db.collection("estoque").where("nome","==",nome).limit(1).get()
    .then(s=>{
      if(s.empty) {
        alert("Não existe no estoque");
        focarCampo("saidaNome");
        return null;
      }

      const e = s.docs[0];
      const qtdEstoque = Number(e.data().quantidade ?? 0);
      if(qtdEstoque < qtd) {
        alert("Estoque insuficiente");
        focarCampo("saidaQtd");
        return null;
      }

      return db.collection("estoque").doc(e.id)
        .update({ quantidade: qtdEstoque - qtd })
        .then(() => db.collection("saida").add({
          data,
          nome,
          quantidade: qtd,
          dataOrdem: dataParaOrdem(data),
          dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
        }))
        .then(() => {
          registrarLog(
            "Saída",
            `${usuarioLogado?.usuario || "usuário"} retirou ${qtd} de ${nome}`
          );
          limparFormularioMovimento(formId, "saidaData");
          mensagemFormulario(formId, "Saída salva com sucesso.", "ok");
        });
    })
    .catch((err) => {
      console.error(err);
      mensagemFormulario(formId, "Erro ao salvar saída.", "erro");
      alert("Erro ao salvar saída.");
    });
}

function carregarSaida(){
  const saidaEl = document.getElementById("saida");
  if (!saidaEl) return;

  db.collection("saida")
    .orderBy("dataOrdem", "desc")
    .onSnapshot(snapshot => {
      saidaEl.innerHTML = "";

      snapshot.forEach(d => {
        const i = d.data() || {};
        const tr = document.createElement("tr");
        tr.id = "saida-" + d.id;
        prepararLinhaMovimento(tr, i);

        const nomeSeguro = escaparTextoAcao(i.nome || "");

        tr.innerHTML = `
          <td data-label="Material">${renderMaterialMovimento(i.nome || "", "saida")}</td>
          <td data-label="Data">${renderDataMovimento(i.data || "")}</td>
          <td data-label="Qtd"><span class="qtd-numero">${i.quantidade ?? ""}</span></td>
          <td data-label="Ações">
            ${linhaAcoes([
              botaoAcao("acao-add", `alterarSaida('${d.id}',1)`, "➕", "Mais"),
              botaoAcao("acao-sub", `alterarSaida('${d.id}',-1)`, "➖", "Menos"),
              botaoAcao("acao-edit", `editarNome('saida','${d.id}','${nomeSeguro}')`, "✏️", "Editar"),
              usuarioLogado?.tipo === "master"
                ? botaoAcao("acao-lab", `enviarParaLaboratorio('${d.id}')`, "🧪", "Lab")
                : "",
              botaoAcao("acao-delete", `excluir('saida','${d.id}')`, "🗑️", "Excluir")
            ])}
          </td>
        `;

        saidaEl.appendChild(tr);
      });

      aplicarFiltroAtual("saida");
    });
}

function alterarSaida(id, v){
  const r = db.collection("saida").doc(id);

  r.get().then(d=>{
    let novaQtd = d.data().quantidade + v;
    if(novaQtd < 0) return;

    db.collection("estoque")
      .where("nome","==",d.data().nome)
      .limit(1)
      .get()
      .then(s=>{
        if(s.empty) return;

        const e = s.docs[0];
        let estoqueNovo = e.data().quantidade - v;
        if(estoqueNovo < 0) return alert("Estoque insuficiente");

        db.collection("estoque").doc(e.id)
          .update({ quantidade: estoqueNovo });

        r.update({ quantidade: novaQtd }).then(()=>{
          registrarLog(
            "Saída",
            `${usuarioLogado.usuario} alterou saída | Material: ${d.data().nome} | Nova qtd: ${novaQtd}`
          );
        });
      });
  });
}

// ======================
// ENVIAR PARA LABORATORIO
// ======================
function enviarParaLaboratorio(idSaida){
  if(usuarioLogado?.tipo !== "master"){
    alert("Somente o administrador pode enviar para o laboratório");
    return;
  }

  const r = db.collection("saida").doc(idSaida);

  r.get().then(doc=>{
    if(!doc.exists){
      alert("Registro não encontrado");
      return;
    }

    const d = doc.data();

    db.collection("laboratorio").add({
      data: d.data,
      nome: d.nome,
      quantidade: d.quantidade,
      dataOrdem: d.dataOrdem,
      dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
    }).then(()=>{
      registrarLog(
        "Laboratório",
        `${usuarioLogado.usuario} enviou para laboratório | Material: ${d.nome} | Qtd: ${d.quantidade}`
      );

      alert("Enviado para o laboratório com sucesso 🧪");
    });

  });
}


// ======================
// LABORATÓRIO (CORRIGIDO)
// ======================
function addLaboratorio(){
  abrirTela("telaLaboratorio");
  abrirFormulario("formLaboratorio", "laboratorioData");
}

function salvarLaboratorioFormulario(){
  const formId = "formLaboratorio";
  const data = obterDataFormulario("laboratorioData", formId);
  if(!data) return;

  const nome = valorCampo("laboratorioNome");
  if(!validarNome(nome)) {
    focarCampo("laboratorioNome");
    return;
  }

  const qtd = obterQuantidadeFormulario("laboratorioQtd");
  if(qtd === null) return;

  db.collection("laboratorio").add({
    data,
    nome,
    quantidade: qtd,
    dataOrdem: dataParaOrdem(data),
    dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    registrarLog(
      "Laboratório",
      `${usuarioLogado?.usuario || "usuário"} cadastrou laboratório | Material: ${nome} | Qtd: ${qtd}`
    );
    limparFormularioMovimento(formId, "laboratorioData");
    mensagemFormulario(formId, "Laboratório salvo com sucesso.", "ok");
  })
  .catch((err) => {
    console.error(err);
    mensagemFormulario(formId, "Erro ao salvar laboratório.", "erro");
    alert("Erro ao salvar laboratório.");
  });
}

function carregarLaboratorio(){
  const laboratorioEl = document.getElementById("laboratorio");
  if (!laboratorioEl) return;

  db.collection("laboratorio")
    .orderBy("dataOrdem", "desc")
    .onSnapshot(snapshot => {
      laboratorioEl.innerHTML = "";

      snapshot.forEach(d => {
        const i = d.data() || {};
        const tr = document.createElement("tr");
        tr.id = "lab-" + d.id;
        prepararLinhaMovimento(tr, i);

        const nomeSeguro = escaparTextoAcao(i.nome || "");

        tr.innerHTML = `
          <td data-label="Material">${renderMaterialMovimento(i.nome || "", "laboratorio")}</td>
          <td data-label="Data">${renderDataMovimento(i.data || "")}</td>
          <td data-label="Qtd"><span class="qtd-numero">${i.quantidade ?? ""}</span></td>
          <td data-label="Ações">
            ${linhaAcoes([
              botaoAcao("acao-add", `alterarLaboratorio('${d.id}',1)`, "➕", "Mais"),
              botaoAcao("acao-sub", `alterarLaboratorio('${d.id}',-1)`, "➖", "Menos"),
              botaoAcao("acao-edit", `editarNome('laboratorio','${d.id}','${nomeSeguro}')`, "✏️", "Editar"),
              botaoAcao("acao-delete", `excluir('laboratorio','${d.id}')`, "🗑️", "Excluir")
            ])}
          </td>
        `;

        laboratorioEl.appendChild(tr);
      });

      aplicarFiltroAtual("laboratorio");
    });
}

function alterarLaboratorio(id, v){
  const r = db.collection("laboratorio").doc(id);

  r.get().then(d=>{
    let novaQtd = d.data().quantidade + v;
    if(novaQtd < 0) return;

    r.update({ quantidade: novaQtd }).then(()=>{
      registrarLog(
        "Laboratório",
        `${usuarioLogado.usuario} alterou laboratório | Material: ${d.data().nome} | Nova qtd: ${novaQtd}`
      );
    });
  });
}


/// ======================
// DÍVIDAS (COM ABATIMENTO)
// ======================

// (você já declarou essas 2 variáveis no topo do arquivo, então NÃO repita)
// let totalDividasBruto = 0;
// let totalAbatidoDividas = 0;

function addDivida(){
  if(usuarioLogado?.tipo !== "master"){
    alert("Somente o administrador pode adicionar dívidas");
    return;
  }

  let data = prompt("Data (DDMMAAAA):");
  data = formatarData(data);
  if(!data) return;
  if (!validarDataNaoFutura(data)) return;

  const n = prompt("Nome:");
  if(!validarNome(n)) return;

  const qtd = Number(prompt("Quantidade:"));
  if(isNaN(qtd) || qtd <= 0) return;

  const v = Number(String(prompt("Valor unitário:")).replace(",", "."));
  if(isNaN(v) || v <= 0) return;

  db.collection("dividas").add({
    data: data,
    nome: n,
    quantidade: qtd,
    valor: v,
    dataOrdem: dataParaOrdem(data),
    dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function carregarDividas(){
  const dividasElement = document.getElementById("dividas");
  if(!dividasElement) return;

  db.collection("dividas")
    .orderBy("dataOrdem", "desc")
    .onSnapshot(snapshot => {

      dividasElement.innerHTML = "";
      totalDividasBruto = 0;

      snapshot.forEach(doc => {
        const i = doc.data();
        const id = doc.id;

        const qtd = Number(i.quantidade ?? 0);
        const valor = Number(i.valor ?? 0);

        const qtdOk = isNaN(qtd) ? 0 : qtd;
        const valorOk = isNaN(valor) ? 0 : valor;

        totalDividasBruto += qtdOk * valorOk;

        const tr = document.createElement("tr");
        tr.id = "divida-" + id;

        const nomeSeguro = escaparTextoAcao(i.nome || "");

        tr.innerHTML = `
          <td data-label="Nome">${i.nome || ""}</td>
          <td data-label="Data">${i.data || ""}</td>

          <td data-label="Qtd" ${
            usuarioLogado?.tipo === "master"
              ? `contenteditable
                 onfocus="this.dataset.prev=this.innerText"
                 onblur="salvarQtdDivida('${id}', this)"`
              : ""
          }>${qtdOk}</td>

          <td data-label="Valor" ${
            usuarioLogado?.tipo === "master"
              ? `contenteditable
                 onfocus="this.dataset.prev=this.innerText"
                 onblur="salvarValorDivida('${id}', this)"`
              : ""
          }>${valorOk.toFixed(2)}</td>

          <td data-label="Ações">
            ${
              usuarioLogado?.tipo === "master"
                ? linhaAcoes([
                    botaoAcao("acao-add", `editarQtdDivida('${id}',1,true)`, "➕", "Mais"),
                    botaoAcao("acao-sub", `editarQtdDivida('${id}',-1,true)`, "➖", "Menos"),
                    botaoAcao("acao-edit", `editarNome('dividas','${id}','${nomeSeguro}')`, "✏️", "Editar"),
                    botaoAcao("acao-money", `editarValorDivida('${id}', ${valorOk})`, "💲", "Valor"),
                    botaoAcao("acao-delete", `excluir('dividas','${id}')`, "🗑️", "Excluir")
                  ])
                : linhaAcoes([
                    botaoAcaoEstatico("acao-view", "👁️", "Visualizar")
                  ])
            }
          </td>
        `;

        // como o orderBy já vem desc, APPEND mantém a ordem certa
        dividasElement.appendChild(tr);
      });

      atualizarSaldoDividas();
    }, err => {
      console.error("Erro ao ler dividas:", err);
    });
}

// salva quantidade digitada direto na célula
function salvarQtdDivida(id, tdEl){
  if(usuarioLogado?.tipo !== "master") return;

  const txt = String(tdEl.innerText || "").trim();
  const n = Number(txt);

  if(isNaN(n) || n < 0){
    alert("Quantidade inválida");
    tdEl.innerText = tdEl.dataset.prev ?? "";
    return;
  }

  db.collection("dividas").doc(id).update({ quantidade: n })
    .then(() => {
      registrarLog(
        "Alteração dívida",
        `${usuarioLogado.usuario} alterou QUANTIDADE da dívida | Nova qtd: ${n}`
      );
    })
    .catch(err => {
      console.error(err);
      alert("Erro ao salvar quantidade");
      tdEl.innerText = tdEl.dataset.prev ?? "";
    });
}

// salva valor digitado direto na célula
function salvarValorDivida(id, tdEl){
  if(usuarioLogado?.tipo !== "master") return;

  const txt = String(tdEl.innerText || "").trim().replace(",", ".");
  const n = Number(txt);

  if(isNaN(n) || n < 0){
    alert("Valor inválido");
    tdEl.innerText = tdEl.dataset.prev ?? "0.00";
    return;
  }

  db.collection("dividas").doc(id).update({ valor: n })
    .then(() => {
      registrarLog(
        "Alteração dívida",
        `${usuarioLogado.usuario} alterou VALOR da dívida | Novo valor: ${n}`
      );
    })
    .catch(err => {
      console.error(err);
      alert("Erro ao salvar valor");
      tdEl.innerText = tdEl.dataset.prev ?? "0.00";
    });
}

// botão 💲 (mantém o seu padrão com prompt)
function editarValorDivida(id, valorAtual){
  if(usuarioLogado?.tipo !== "master"){
    alert("Somente o administrador pode alterar o valor");
    return;
  }

  const novoValor = Number(String(prompt("Novo valor unitário:", valorAtual)).replace(",", "."));

  if(isNaN(novoValor) || novoValor < 0){
    alert("Valor inválido");
    return;
  }

  db.collection("dividas")
    .doc(id)
    .update({ valor: novoValor })
    .then(() => {
      registrarLog(
        "Alteração dívida",
        `${usuarioLogado.usuario} alterou VALOR da dívida | Novo valor: ${novoValor}`
      );
    });
}

function editarQtdDivida(id, v, inc){
  if(usuarioLogado?.tipo !== "master"){
    alert("Somente o administrador pode alterar dívidas");
    return;
  }

  const r = db.collection("dividas").doc(id);

  r.get().then(d => {
    let n = inc ? (d.data().quantidade || 1) + v : Number(v);
    if(isNaN(n) || n < 0) n = 0;

    r.update({ quantidade: n }).then(() => {
      registrarLog(
        "Alteração dívida",
        `${usuarioLogado.usuario} alterou QUANTIDADE da dívida | Nova qtd: ${n}`
      );
    });
  });
}

// ===== saldo = total bruto - total imply abatido =====
function atualizarSaldoDividas(){
  const elSaldo = document.getElementById("totalDividas");
  const elTotal = document.getElementById("totalDividasBruto");
  const elAbatido = document.getElementById("totalAbatidoDividas");

  if(elTotal) elTotal.innerText = totalDividasBruto.toFixed(2);
  if(elAbatido) elAbatido.innerText = totalAbatidoDividas.toFixed(2);

  const saldo = Math.max(0, totalDividasBruto - totalAbatidoDividas);
  if(elSaldo) elSaldo.innerText = saldo.toFixed(2);
}

function abaterDividas(){
  if(usuarioLogado?.tipo !== "master"){
    alert("Somente o administrador pode abater dívidas");
    return;
  }

  const saldoAtual = Math.max(0, totalDividasBruto - totalAbatidoDividas);
  if(saldoAtual <= 0){
    alert("Não há saldo de dívidas para abater.");
    return;
  }

  let valor = prompt(`Quanto deseja abater/pagar?\nSaldo atual: R$ ${saldoAtual.toFixed(2)}`);
  if(valor === null) return;

  valor = Number(String(valor).replace(",", "."));
  if(isNaN(valor) || valor <= 0){
    alert("Valor inválido");
    return;
  }

  if(valor > saldoAtual){
    alert("O valor informado é maior que o saldo atual.");
    return;
  }

  const obs = prompt("Observação (opcional):") || "";

  db.collection("abatimentosDividas").add({
    valor: valor,
    obs: obs,
    data: new Date().toLocaleDateString("pt-BR"),
    usuario: usuarioLogado?.usuario || "desconhecido",
    dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then(() => {
    registrarLog(
      "Abate dívida",
      `${usuarioLogado.usuario} abateu R$ ${valor.toFixed(2)}${obs ? ` | Obs: ${obs}` : ""}`
    );
  })
  .catch(err => {
    console.error(err);
    alert("Erro ao registrar abatimento");
  });
}

function carregarAbatimentosDividas(){
  // pode ser null se você ainda não colocou a tabela no HTML
  const lista = document.getElementById("listaAbatimentosDividas");

  db.collection("abatimentosDividas")
    .orderBy("dataCriacao", "desc")
    .onSnapshot(snapshot => {

      if(lista) lista.innerHTML = "";
      totalAbatidoDividas = 0;

      snapshot.forEach(doc => {
        const a = doc.data();
        const id = doc.id;

        const valor = Number(a.valor ?? 0);
        const valorOk = isNaN(valor) ? 0 : valor;
        totalAbatidoDividas += valorOk;

        if(lista){
          const tr = document.createElement("tr");
          tr.id = "abatimento-" + id;

          tr.innerHTML = `
            <td data-label="Data">${a.data || ""}</td>
            <td data-label="Valor">${valorOk.toFixed(2)}</td>
            <td data-label="Obs">${a.obs || ""}</td>
            <td data-label="Ações">
              ${
                usuarioLogado?.tipo === "master"
                  ? linhaAcoes([
                      botaoAcao("acao-delete", `excluirAbatimentoDividas('${id}')`, "🗑️", "Excluir")
                    ])
                  : linhaAcoes([
                      botaoAcaoEstatico("acao-view", "👁️", "Visualizar")
                    ])
              }
            </td>
          `;
          lista.appendChild(tr);
        }
      });

      atualizarSaldoDividas();
    }, err => {
      console.error("Erro ao ler abatimentosDividas:", err);
    });
}

function excluirAbatimentoDividas(id){
  if(usuarioLogado?.tipo !== "master"){
    alert("Somente o administrador pode excluir abatimentos");
    return;
  }

  if(confirm("Excluir abatimento?")){
    db.collection("abatimentosDividas").doc(id).delete().then(()=>{
      registrarLog(
        "Exclusão",
        `${usuarioLogado.usuario} excluiu um abatimento de dívidas`
      );
    });
  }
}

// ======================
// EDITAR QUANTIDADES
// ======================
function editarQuantidade(colecao, id, atual){
  if(usuarioLogado?.tipo !== "master"){
    alert("Acesso negado");
    return;
  }

  const nova = Number(prompt("Nova quantidade:", atual));

  if(isNaN(nova) || nova < 0){
    alert("Quantidade inválida");
    return;
  }

  db.collection(colecao)
    .doc(id)
    .update({ quantidade: nova })
    .then(() => {
      registrarLog(
        "Alteração quantidade",
        `${usuarioLogado.usuario} alterou quantidade em ${colecao} | Nova qtd: ${nova}`
      );
    });
}

// ======================
// EXCLUIR
// ======================
function excluir(c, id){
  if(c === "dividas" && usuarioLogado?.tipo !== "master"){
    alert("Somente o administrador pode excluir dívidas");
    return;
  }

  if(confirm("Excluir?")){
    db.collection(c).doc(id).delete().then(()=>{
      registrarLog(
        "Exclusão",
        `${usuarioLogado.usuario} excluiu registro da coleção ${c}`
      );
    });
  }
}


// ======================
// FORMATO E VALIDAÇÃO DATA
// ======================
function formatarData(valor){
  if (valor === null || valor === undefined) return null;

  // aceita 27052026 ou 27/05/2026 e devolve sempre DD/MM/AAAA
  valor = String(valor).replace(/\D/g, "");

  if(valor.length !== 8){
    alert("Data inválida. Use o formato DD/MM/AAAA");
    return null;
  }

  const dia  = Number(valor.substring(0,2));
  const mes  = Number(valor.substring(2,4));
  const ano  = Number(valor.substring(4,8));

  const dataTeste = new Date(ano, mes - 1, dia);
  const dataExiste =
    dataTeste.getFullYear() === ano &&
    dataTeste.getMonth() === mes - 1 &&
    dataTeste.getDate() === dia;

  if(!dataExiste){
    alert("Data inválida. Confira dia, mês e ano.");
    return null;
  }

  return `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${ano}`;
}

// FORMATAR DATA INVALIDA 
function validarDataNaoFutura(dataFormatada) {
  // dataFormatada = DD/MM/AAAA
  const [dia, mes, ano] = dataFormatada.split("/").map(Number);

  const dataInformada = new Date(ano, mes - 1, dia);
  dataInformada.setHours(0,0,0,0);

  const hoje = new Date();
  hoje.setHours(0,0,0,0);

  if (dataInformada > hoje) {
    alert("❌ Data inválida.\nSó é permitido hoje ou datas anteriores.");
    return false;
  }

  return true;
}


function validarNome(nome){
  nome = String(nome ?? "").trim();

  if(!nome){
    alert("Informe o nome.");
    return false;
  }

  // permite letras, números, acentos e espaços
  if(!/^[A-Za-zÀ-ÿ0-9\s]+$/.test(nome)){
    alert("Erro: o nome pode conter letras, números e espaços.");
    return false;
  }
  return true;
}

  //VALIDAR NOME
function editarNome(colecao, id, nomeAtual){
  const novoNome = prompt("Editar nome:", nomeAtual);
  if(!novoNome) return;

  if(!validarNome(novoNome)) return;

  db.collection(colecao)
    .doc(id)
    .update({ nome: novoNome })
    .then(()=>{
      registrarLog(
        "Edição de nome",
        `Coleção: ${colecao} | De "${nomeAtual}" para "${novoNome}"`
      );
    });
}

// função criar area  master

function criarUsuario(){
  if(usuarioLogado?.tipo !== "master"){
    return alert("Acesso negado");
  }

  const usuario = prompt("Novo usuário:");
  const senha = prompt("Senha:");
  if(!usuario || !senha) return;

  db.collection("usuarios").add({
    usuario: usuario,
    senha: senha,
    tipo: "usuario"
  }).then(()=>{
    alert("Usuário criado com sucesso");
  });
}

// carregar usuarios
function carregarUsuarios(){
  const lista = document.getElementById("listaUsuarios");
  if(!lista) return;

  db.collection("usuarios").onSnapshot(snapshot=>{
    lista.innerHTML = "";

    snapshot.forEach(doc=>{
      const u = doc.data();

      // não mostrar o próprio usuário
      if(u.usuario === usuarioLogado.usuario) return;

      lista.innerHTML += `
        <tr>
          <td data-label="Usuário">${u.usuario}</td>
          <td data-label="Tipo">${u.tipo}</td>
          <td data-label="Ações">
            ${linhaAcoes([
              botaoAcao("acao-delete", `excluirUsuario('${doc.id}')`, "🗑️", "Excluir")
            ])}
          </td>
        </tr>
      `;
    });
  });
}


// para ecluir usuarios
function excluirUsuario(id){
  if(usuarioLogado?.tipo !== "master"){
    alert("Acesso negado");
    return;
  }

  if(confirm("Deseja realmente excluir este usuário?")){
    db.collection("usuarios").doc(id).delete()
      .then(()=> alert("Usuário excluído com sucesso"));
  }
}

// ======================
// CARREGAR LOGS
// ======================
function carregarLogs(){
  const lista = document.getElementById("listaLogs");
  if(!lista) return;

  db.collection("logs")
    .orderBy("dataCriacao", "desc")
    .onSnapshot(snapshot=>{
      lista.innerHTML = "";

      snapshot.forEach(doc => {
        const l = doc.data();
        let classe = "";

        if(l.acao.includes("Entrada") || l.acao.includes("Aumentou")) classe = "log-add";
        else if(l.acao.includes("Saída") || l.acao.includes("Diminuiu")) classe = "log-rem";
        else if(l.acao.includes("Exclusão")) classe = "log-del";
        else if(l.acao.includes("dívida")) classe = "log-divida";

        lista.innerHTML += `
          <tr class="${classe}">
            <td data-label="Usuário">${l.usuario}</td>
            <td data-label="Ação">${l.acao}</td>
            <td data-label="Detalhes">${l.detalhes}</td>
            <td data-label="Data">${l.data}</td>
          </tr>
        `;
      });

    });
}

function registrarLog(acao, detalhes){
  db.collection("logs").add({
    usuario: usuarioLogado?.usuario || "desconhecido",
    tipoUsuario: usuarioLogado?.tipo || "desconhecido",
    acao: acao,
    detalhes: detalhes,
    data: new Date().toLocaleString("pt-BR"),
    dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
  });
}


function alterarLoginMaster(){
  if(usuarioLogado?.tipo !== "master"){
    alert("Acesso negado");
    return;
  }

  const novoUsuario = prompt("Novo login do MASTER:");
  if(!novoUsuario || novoUsuario.length < 3){
    alert("Login inválido");
    return;
  }

  db.collection("usuarios")
    .doc(usuarioLogado.id)
    .update({ usuario: novoUsuario })
    .then(()=>{
      registrarLog("Segurança", "Login do MASTER alterado");
      usuarioLogado.usuario = novoUsuario;
      localStorage.setItem("usuarioLogado", JSON.stringify(usuarioLogado));
      alert("Login alterado com sucesso");
    });
}

function alterarSenhaMaster(){
  if(usuarioLogado?.tipo !== "master"){
    alert("Acesso negado");
    return;
  }

  const novaSenha = prompt("Nova senha do MASTER:");
  if(!novaSenha || novaSenha.length < 4){
    alert("Senha muito curta");
    return;
  }

  db.collection("usuarios")
    .doc(usuarioLogado.id)
    .update({ senha: novaSenha })
    .then(()=>{
      registrarLog("Segurança", "Senha do MASTER alterada");
      usuarioLogado.senha = novaSenha;
      localStorage.setItem("usuarioLogado", JSON.stringify(usuarioLogado));
      alert("Senha alterada com sucesso");
    });
}

function dataParaOrdem(data) {
  const [dia, mes, ano] = data.split("/");
  return Number(`${ano}${mes}${dia}`);
}

function migrarDatasParaOrdem() {
  const colecoes = ["estoque", "saida", "laboratorio", "dividas"];

  colecoes.forEach(c => {
    db.collection(c).get().then(snapshot => {
      snapshot.forEach(doc => {
        const d = doc.data();
        if (d.data && !d.dataOrdem) {
          db.collection(c).doc(doc.id).update({
            dataOrdem: dataParaOrdem(d.data)
          });
        }
      });
    });
  });

  alert("Migração concluída. Recarregue a página.");
}


document.addEventListener("DOMContentLoaded", () => {

  // 🔑 iniciar escuta de atividades do usuário para logout automático
  document.addEventListener("mousemove", resetarTimer);
  document.addEventListener("keydown", resetarTimer);
  document.addEventListener("click", resetarTimer);
  document.addEventListener("scroll", resetarTimer);

  const salvo = localStorage.getItem("usuarioLogado");

  if (salvo) {
    try {
      usuarioLogado = JSON.parse(salvo);
      prepararSistemaLogado();
      carregarDadosSistema();
      resetarTimer();
    } catch (err) {
      console.error("Erro ao restaurar login salvo:", err);
      localStorage.removeItem("usuarioLogado");
    }
  }
});


 

// ======================
// SAIR / LOGOUT
// ======================
function sair() {
  localStorage.removeItem("usuarioLogado");
  location.reload();
}



async function gerarPDFRelatorio() {
  try {
    // Checagens básicas
    if (!window.jspdf || !window.jspdf.jsPDF) {
      alert("jsPDF não carregou. Confira os <script> no index.html.");
      return;
    }
    if (typeof db === "undefined") {
      alert("Firestore (db) não está disponível.");
      return;
    }
    // autotable injeta pdf.autoTable(...)
    // Se não existir, é porque a lib não foi adicionada no HTML
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    if (typeof pdf.autoTable !== "function") {
      alert("AutoTable não carregou. Adicione jspdf-autotable no index.html.");
      return;
    }

    const pageW = pdf.internal.pageSize.getWidth();
    const marginX = 14;

    // Cabeçalho
    const hoje = new Date();
    const dataHora = hoje.toLocaleString("pt-BR");

    pdf.setFontSize(14);
    pdf.text("RELATÓRIO - CONTROLE DE ESTOQUE", marginX, 14);

    pdf.setFontSize(10);
    pdf.text(`Gerado em: ${dataHora}`, marginX, 20);
    pdf.text(`Usuário: ${usuarioLogado?.usuario || "-"}`, marginX, 25);

    let y = 32;

    // Helper: título de seção
    function tituloSecao(txt) {
      // quebra página se estiver muito embaixo
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }
      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);
      pdf.text(txt, marginX, y);
      y += 6;
    }

    // Helper: tabela
    function tabela(colunas, rows) {
      pdf.autoTable({
        startY: y,
        head: [colunas],
        body: rows,
        margin: { left: marginX, right: marginX },
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fontSize: 9 }
      });

      y = pdf.lastAutoTable.finalY + 10;
    }

    // Helper: busca coleção ordenada e monta rows
    async function addColecaoTabela({
      titulo,
      colecao,
      colunas,
      mapRow,
      orderField = "dataOrdem",
      orderDir = "desc",
      limit = 500
    }) {
      tituloSecao(titulo);

      let query = db.collection(colecao);
      // Nem toda coleção pode ter dataOrdem, mas no seu sistema tem nas principais :contentReference[oaicite:3]{index=3}
      try {
        query = query.orderBy(orderField, orderDir);
      } catch (e) {
        // se não der orderBy, segue sem ordenar
      }

      const snap = await query.limit(limit).get();
      const rows = [];
      snap.forEach((doc) => rows.push(mapRow(doc.data(), doc.id)));

      if (rows.length === 0) {
        pdf.setFontSize(10);
        pdf.text("Sem registros.", marginX, y);
        y += 10;
        return;
      }

      tabela(colunas, rows);
    }

    // =========================
    // ENTRADA / SAÍDA / LAB
    // =========================
    await addColecaoTabela({
      titulo: "ENTRADA ESTOQUE",
      colecao: "estoque",
      colunas: ["Data", "Material", "Qtd"],
      mapRow: (d) => [d.data || "", d.nome || "", String(d.quantidade ?? "")]
    });

    await addColecaoTabela({
      titulo: "SAÍDA ESTOQUE",
      colecao: "saida",
      colunas: ["Data", "Material", "Qtd"],
      mapRow: (d) => [d.data || "", d.nome || "", String(d.quantidade ?? "")]
    });

    await addColecaoTabela({
      titulo: "LABORATÓRIO",
      colecao: "laboratorio",
      colunas: ["Data", "Material", "Qtd"],
      mapRow: (d) => [d.data || "", d.nome || "", String(d.quantidade ?? "")]
    });

    // =========================
    // DÍVIDAS (com SALDO DEVEDOR em vermelho)
    // =========================
    tituloSecao("DÍVIDAS");

    // calcula bruto (qtd * valor)
    const snapDiv = await db.collection("dividas").get();
    let bruto = 0;
    const rowsDividas = [];
    snapDiv.forEach((doc) => {
      const d = doc.data();
      const qtd = Number(d.quantidade ?? 0);
      const val = Number(d.valor ?? 0);
      const qtdOk = isNaN(qtd) ? 0 : qtd;
      const valOk = isNaN(val) ? 0 : val;

      bruto += qtdOk * valOk;

      rowsDividas.push([
        d.data || "",
        d.nome || "",
        String(qtdOk),
        valOk.toFixed(2)
      ]);
    });

    // calcula abatido
    const snapAb = await db.collection("abatimentosDividas").get();
    let abatido = 0;
    const rowsAbat = [];
    snapAb.forEach((doc) => {
      const a = doc.data();
      const v = Number(a.valor ?? 0);
      const vOk = isNaN(v) ? 0 : v;
      abatido += vOk;

      rowsAbat.push([
        a.data || "",
        vOk.toFixed(2),
        a.obs || ""
      ]);
    });

    const saldo = Math.max(0, bruto - abatido);

    // mostra saldo em vermelho (igual estilo do seu h3 .box h3) :contentReference[oaicite:4]{index=4}
    if (y > 265) { pdf.addPage(); y = 20; }

    pdf.setTextColor(240, 3, 3);
    pdf.setFontSize(16);
    pdf.text(`Saldo devedor: R$ ${saldo.toFixed(2)}`, marginX, y);
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    y += 6;

    pdf.text(`Total: R$ ${bruto.toFixed(2)}   |   Abatido: R$ ${abatido.toFixed(2)}`, marginX, y);
    y += 8;

    // tabela de dívidas (se tiver)
    if (rowsDividas.length > 0) {
      tabela(["Data", "Nome", "Qtd", "Valor"], rowsDividas);
    } else {
      pdf.setFontSize(10);
      pdf.text("Sem dívidas registradas.", marginX, y);
      y += 10;
    }

    // tabela de abatimentos (se tiver)
    tituloSecao("PAGAMENTOS / ABATIMENTOS");
    if (rowsAbat.length > 0) {
      tabela(["Data", "Valor", "Obs"], rowsAbat);
    } else {
      pdf.setFontSize(10);
      pdf.text("Sem abatimentos registrados.", marginX, y);
      y += 10;
    }

    // Salva
    pdf.save(`relatorio_estoque_${new Date().toISOString().slice(0, 10)}.pdf`);
  } catch (err) {
    console.error(err);
    alert("Erro ao gerar PDF. Veja o console (F12) para detalhes.");
  }
}
