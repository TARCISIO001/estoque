
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

function login() {
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

      // troca telas
      document.getElementById("login").style.display = "none";
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
  estoque.innerHTML = "";
  db.collection("estoque")
  .orderBy("dataOrdem", "desc")
  .onSnapshot(s => {

    estoque.innerHTML = "";
    s.forEach(d => {
      const i = d.data();
      estoque.innerHTML += `
      <tr>
        <td>${i.data}</td>
        <td>${i.nome}</td>
        <td>${i.quantidade}</td>
       <td>
  <button onclick="alterarEstoque('${d.id}',1)">➕</button>
  <button onclick="alterarEstoque('${d.id}',-1)">➖</button>
  <button onclick="editarNome('estoque','${d.id}','${i.nome}')">✏️</button>
  <button onclick="excluir('estoque','${d.id}')">🗑️</button>
</td>

      </tr>`;
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
  saida.innerHTML = "";
  db.collection("saida")
  .orderBy("dataOrdem", "desc")
  .onSnapshot(s=>{

    saida.innerHTML = "";
    s.forEach(d=>{
      const i=d.data();
      saida.innerHTML += `
      <tr>
        <td>${i.data}</td>
        <td>${i.nome}</td>
        <td>${i.quantidade}</td>
        <td>
  <button onclick="alterarSaida('${d.id}',1)">➕</button>
  <button onclick="alterarSaida('${d.id}',-1)">➖</button>
  <button onclick="editarNome('saida','${d.id}','${i.nome}')">✏️</button>
  <button onclick="excluir('saida','${d.id}')">🗑️</button>
</td>

      </tr>`;
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
  laboratorio.innerHTML="";
  db.collection("laboratorio")
  .orderBy("dataOrdem", "desc")
  .onSnapshot(s=>{


    laboratorio.innerHTML="";
    s.forEach(d=>{
      const i=d.data();
      laboratorio.innerHTML+=`
      <tr>
        <td>${i.data}</td>
        <td>${i.nome}</td>
        <td>${i.quantidade}</td>
        <td>
  <button onclick="alterarLaboratorio('${d.id}',1)">➕</button>
  <button onclick="alterarLaboratorio('${d.id}',-1)">➖</button>
  <button onclick="editarNome('laboratorio','${d.id}','${i.nome}')">✏️</button>
  
   <button onclick="excluir('laboratorio','${d.id}')">🗑️</button>
 
</td>

      </tr>`;
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


// ======================
// DÍVIDAS
// ======================
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
  if(qtd <= 0) return;

  const v = Number(prompt("Valor unitário:"));
  if(v <= 0) return;

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
  dividas.innerHTML = "";
  let total = 0;

  db.collection("dividas")
    .orderBy("dataOrdem", "desc")
    .onSnapshot(snapshot => {

    dividas.innerHTML = "";
    total = 0;

    snapshot.forEach(d => {
      const i = d.data();
      const subtotal = (i.quantidade || 1) * i.valor;
      total += subtotal;

      dividas.innerHTML += `
      <tr>
        <td>${i.data}</td>
        <td>${i.nome}</td>

        <td ${
          usuarioLogado?.tipo === "master"
            ? `contenteditable onblur="editarQtdDivida('${d.id}', this.innerText)"`
            : ""
        }>
          ${i.quantidade || 1}
        </td>

        <td ${
          usuarioLogado?.tipo === "master"
            ? `contenteditable onblur="editarDivida('${d.id}', this.innerText)"`
            : ""
        }>
          ${i.valor.toFixed(2)}
        </td>

        <td>
          ${
            usuarioLogado?.tipo === "master"
              ? `
              <button onclick="editarQtdDivida('${d.id}',1,true)">➕</button>
              <button onclick="editarQtdDivida('${d.id}',-1,true)">➖</button>
              <button onclick="editarNome('dividas','${d.id}','${i.nome}')">✏️</button>
              <button onclick="editarValorDivida('${d.id}', ${i.valor})">💲</button>
              <button onclick="excluir('dividas','${d.id}')">🗑️</button>

              `
              : '👁️'
          }
        </td>
      </tr>`;
    });

    totalDividas.innerText = total.toFixed(2);
  });
}


function editarDivida(id, v, inc){
  if(usuarioLogado?.tipo !== "master"){
    alert("Somente o administrador pode alterar dívidas");
    return;
  }

  const r = db.collection("dividas").doc(id);

r.get().then(d=>{
  let n = inc ? d.data().valor + v : Number(v);
  if(n < 0) n = 0;

  r.update({ valor: n }).then(()=>{
    registrarLog(
      "Alteração dívida",
      `${usuarioLogado.usuario} alterou dívida | Novo valor: ${n}`
    );
  });
});
}

function editarValorDivida(id, valorAtual){
  if(usuarioLogado?.tipo !== "master"){
    alert("Somente o administrador pode alterar o valor");
    return;
  }

  const novoValor = Number(prompt("Novo valor unitário:", valorAtual));

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
    if(n < 0) n = 0;

    r.update({ quantidade: n }).then(() => {
      registrarLog(
        "Alteração dívida",
        `${usuarioLogado.usuario} alterou QUANTIDADE da dívida | Nova qtd: ${n}`
      );
    });
  });
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
  // somente letras, acentos e espaços
  if(!/^[A-Za-zÀ-ÿ\s]+$/.test(nome)){
    alert("Erro: o nome deve conter somente letras e espaços.");
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


