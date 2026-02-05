
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


function fazerLogin() 
{
  const usuario = document.getElementById("usuario").value.trim();
  const senha = document.getElementById("senha").value.trim();

  if(!usuario || !senha){
    alert("Preencha usuário e senha");
    return;
  }

  db.collection("usuarios")
    .where("usuario", "==", usuario)
    .where("senha", "==", senha)
    .limit(1)
    .get()
    .then(snapshot => {
      if (snapshot.empty) {
        alert("Usuário ou senha inválidos");
        return;
      }

      // salva usuário logado (COM ID)
      usuarioLogado = {
        id: snapshot.docs[0].id,
        ...snapshot.docs[0].data()
      };
      localStorage.setItem(
        "usuarioLogado",
         JSON.stringify(usuarioLogado)
);
      
// troca telas
      document.getElementById("telaLogin").style.display = "none";

      document.getElementById("sistema").style.display = "block";

      // área admin
     if(usuarioLogado.tipo === "master"){
  document.getElementById("areaAdmin").style.display = "block";
  document.getElementById("areaLogs").style.display = "block";
  document.getElementById("areaMasterConfig").style.display = "block";


  carregarUsuarios();
  carregarLogs();
}


      // carrega dados
      carregarEstoque();
      carregarSaida();
      carregarLaboratorio();
      carregarDividas();
      carregarAbatimentosDividas();
    })
    .catch(err => {
      console.error(err);
      alert("Erro ao conectar com o banco");
    });
}


// ======================
// ESTOQUE - ENTRADA
// ======================
function addEntrada(){
  let data = prompt("Data (DDMMAAAA):");
data = formatarData(data);
if(!data) return;
if (!validarDataNaoFutura(data)) return;
 
const nome = prompt("Material:");
if(!validarNome(nome)) return;

  const qtd = Number(prompt("Qtd:"));
  if(!data || !nome || qtd <= 0) return;

db.collection("estoque")
  .add({
    data,
    nome,
    quantidade: qtd,
    dataOrdem: dataParaOrdem(data),
    dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
  })

}

function carregarEstoque(){
  db.collection("estoque")
    .orderBy("dataOrdem", "desc")
    .onSnapshot(snapshot => {

      snapshot.docChanges().forEach(change => {
        const d = change.doc;
        const i = d.data();

        let tr = document.getElementById("estoque-" + d.id);

        // REMOVER
        if (change.type === "removed") {
          if (tr) tr.remove();
          return;
        }

        // CRIAR
        if (!tr) {
          tr = document.createElement("tr");
          tr.id = "estoque-" + d.id;
          estoque.prepend(tr); // novos em cima
        }

        // DESTAQUE AO ALTERAR
        if (change.type === "modified") {
          tr.classList.remove("tr-qtd");
          void tr.offsetWidth;
          tr.classList.add("tr-qtd");
        }

        tr.innerHTML = `
          <td>${i.data}</td>
          <td>${i.nome}</td>
          <td>${i.quantidade}</td>
          <td>
            <button onclick="alterarEstoque('${d.id}',1)">➕</button>
            <button onclick="alterarEstoque('${d.id}',-1)">➖</button>
            <button onclick="editarNome('estoque','${d.id}','${i.nome}')">✏️</button>
            <button onclick="excluir('estoque','${d.id}')">🗑️</button>
          </td>
        `;
      });
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
  let data = prompt("Data (DDMMAAAA):");
data = formatarData(data);
if(!data) return;
if (!validarDataNaoFutura(data)) return;

  const nome = prompt("Material:");
if(!validarNome(nome)) return;

  const qtd  = Number(prompt("Qtd:"));
  if(!data || !nome || qtd <= 0) return;

  db.collection("estoque").where("nome","==",nome).limit(1).get()
  .then(s=>{
    if(s.empty) return alert("Não existe no estoque");

    const e = s.docs[0];
    if(e.data().quantidade < qtd) return alert("Estoque insuficiente");

    db.collection("estoque").doc(e.id)
      .update({ quantidade: e.data().quantidade - qtd });

   db.collection("saida")
  .add({
    data,
    nome,
    quantidade: qtd,
    dataOrdem: dataParaOrdem(data),
    dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
  })

  .then(() => {
    registrarLog(
      "Saída",
      `Retirou ${qtd} de ${nome}`
    );
  });

  });
}

function carregarSaida(){
  db.collection("saida")
    .orderBy("dataOrdem", "desc")
    .onSnapshot(snapshot => {

      snapshot.docChanges().forEach(change => {
        const d = change.doc;
        const i = d.data();

        let tr = document.getElementById("saida-" + d.id);

        if (change.type === "removed") {
          if (tr) tr.remove();
          return;
        }

        if (!tr) {
          tr = document.createElement("tr");
          tr.id = "saida-" + d.id;
          saida.prepend(tr);
        }

        if (change.type === "modified") {
          tr.classList.remove("tr-qtd");
          void tr.offsetWidth;
          tr.classList.add("tr-qtd");
        }

        tr.innerHTML = `
          <td>${i.data}</td>
          <td>${i.nome}</td>
          <td>${i.quantidade}</td>
         <td>
  <button onclick="alterarSaida('${d.id}',1)">➕</button>
  <button onclick="alterarSaida('${d.id}',-1)">➖</button>
  <button onclick="editarNome('saida','${d.id}','${i.nome}')">✏️</button>

  ${
    usuarioLogado?.tipo === "master"
      ? `<button onclick="enviarParaLaboratorio('${d.id}')">🧪</button>`
      : ""
  }

  <button onclick="excluir('saida','${d.id}')">🗑️</button>
</td>

        `;
      });
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
  let data = prompt("Data (DDMMAAAA):");
  data = formatarData(data);
  if(!data) return;
  if (!validarDataNaoFutura(data)) return;

  const n = prompt("Nome:");
if(!validarNome(n)) return;

  const q = Number(prompt("Qtd:"));

  if(!n || q <= 0) return;

  db.collection("laboratorio").add({
  data,
  nome: n,
  quantidade: q,
  dataOrdem: dataParaOrdem(data),
  dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
});

}
function carregarLaboratorio(){
  db.collection("laboratorio")
    .orderBy("dataOrdem", "desc")
    .onSnapshot(snapshot => {

      snapshot.docChanges().forEach(change => {
        const d = change.doc;
        const i = d.data();

        let tr = document.getElementById("lab-" + d.id);

        if (change.type === "removed") {
          if (tr) tr.remove();
          return;
        }

        if (!tr) {
          tr = document.createElement("tr");
          tr.id = "lab-" + d.id;
          laboratorio.prepend(tr);
        }

        if (change.type === "modified") {
          tr.classList.remove("tr-qtd");
          void tr.offsetWidth;
          tr.classList.add("tr-qtd");
        }

        tr.innerHTML = `
          <td>${i.data}</td>
          <td>${i.nome}</td>
          <td>${i.quantidade}</td>
          <td>
            <button onclick="alterarLaboratorio('${d.id}',1)">➕</button>
            <button onclick="alterarLaboratorio('${d.id}',-1)">➖</button>
            <button onclick="editarNome('laboratorio','${d.id}','${i.nome}')">✏️</button>
            <button onclick="excluir('laboratorio','${d.id}')">🗑️</button>
          </td>
        `;
      });
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

        tr.innerHTML = `
          <td>${i.data || ""}</td>
          <td>${i.nome || ""}</td>

          <td ${
            usuarioLogado?.tipo === "master"
              ? `contenteditable
                 onfocus="this.dataset.prev=this.innerText"
                 onblur="salvarQtdDivida('${id}', this)"`
              : ""
          }>${qtdOk}</td>

          <td ${
            usuarioLogado?.tipo === "master"
              ? `contenteditable
                 onfocus="this.dataset.prev=this.innerText"
                 onblur="salvarValorDivida('${id}', this)"`
              : ""
          }>${valorOk.toFixed(2)}</td>

          <td>
            ${
              usuarioLogado?.tipo === "master"
                ? `
                  <button onclick="editarQtdDivida('${id}',1,true)">➕</button>
                  <button onclick="editarQtdDivida('${id}',-1,true)">➖</button>
                  <button onclick="editarNome('dividas','${id}','${(i.nome || "").replace(/"/g, '\\"')}')">✏️</button>
                  <button onclick="editarValorDivida('${id}', ${valorOk})">💲</button>
                  <button onclick="excluir('dividas','${id}')">🗑️</button>
                `
                : "👁️"
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
            <td>${a.data || ""}</td>
            <td>${valorOk.toFixed(2)}</td>
            <td>${a.obs || ""}</td>
            <td>
              ${
                usuarioLogado?.tipo === "master"
                  ? `<button onclick="excluirAbatimentoDividas('${id}')">🗑️</button>`
                  : "👁️"
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
  // remove qualquer coisa que não seja número
  valor = valor.replace(/\D/g, "");

  if(valor.length !== 8){
    alert("Data inválida. Use o formato DDMMAAAA");
    return null;
  }

  const dia  = valor.substring(0,2);
  const mes  = valor.substring(2,4);
  const ano  = valor.substring(4,8);

  if(dia < 1 || dia > 31 || mes < 1 || mes > 12){
    alert("Data inválida");
    return null;
  }

  return `${dia}/${mes}/${ano}`;
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
          <td>${u.usuario}</td>
          <td>${u.tipo}</td>
          <td>
            <button onclick="excluirUsuario('${doc.id}')">🗑️</button>
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
      <td>${l.usuario}</td>
      <td>${l.acao}</td>
      <td>${l.detalhes}</td>
      <td>${l.data}</td>
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


function alterarSenhaMaster(){
  if(usuarioLogado?.tipo !== "master"){
    alert("Acesso negado");
    return;
  }

  const novaSenha = prompt("Digite a nova senha do MASTER:");
  if(!novaSenha || novaSenha.length < 4){
    alert("Senha muito curta");
    return;
  }

  db.collection("usuarios")
    .doc(usuarioLogado.id)
    .update({ senha: novaSenha })
    .then(()=>{
      registrarLog("Segurança", "Senha do MASTER alterada");
      alert("Senha alterada com sucesso");
    });
}
/*ALTERAR LOGIN MASTER */
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
      alert("Login alterado com sucesso");
    });
}

/*ALTERAR SENHA MASTER*/
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
    usuarioLogado = JSON.parse(salvo);
document.getElementById("telaLogin").style.display = "none";

    document.getElementById("sistema").style.display = "block";

    if (usuarioLogado.tipo === "master") {
      document.getElementById("areaAdmin").style.display = "block";
      document.getElementById("areaLogs").style.display = "block";
      document.getElementById("areaMasterConfig").style.display = "block";

      carregarUsuarios();
      carregarLogs();
    }

    carregarEstoque();
    carregarSaida();
    carregarLaboratorio();
    carregarDividas();
    carregarAbatimentosDividas();


    // 🔑 inicia o timer automático de logout
    resetarTimer();
  }
});


 

// ======================
// SAIR / LOGOUT
// ======================
function sair() {
  localStorage.removeItem("usuarioLogado");
  location.reload();
}

// ======================
// EXPANDIR BOX NO MOBILE
// ======================
document.addEventListener("DOMContentLoaded", () => {

  if (window.innerWidth > 900) return; // só celular

  const boxes = document.querySelectorAll(".box");

  boxes.forEach(box => {

    box.addEventListener("touchstart", () => {
      // remove expansão das outras
      boxes.forEach(b => b.classList.remove("box-ativa"));

      // ativa a tocada
      box.classList.add("box-ativa");
    });

  });

});







