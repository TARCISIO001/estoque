
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
// ======================
// LOGIN (CORRIGIDO)
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
        carregarUsuarios(); // ✅ AGORA SIM
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
 const nome = prompt("Material:");
if(!validarNome(nome)) return;

  const qtd = Number(prompt("Qtd:"));
  if(!data || !nome || qtd <= 0) return;

  db.collection("estoque").add({ data, nome, quantidade: qtd });
}

function carregarEstoque(){
  estoque.innerHTML = "";
  db.collection("estoque").onSnapshot(s => {
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
    r.update({ quantidade: n });
  });
}

// ======================
// SAÍDA
// ======================
function addSaida(){
  let data = prompt("Data (DDMMAAAA):");
data = formatarData(data);
if(!data) return;
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

    db.collection("saida").add({ data, nome, quantidade: qtd });
  });
}

function carregarSaida(){
  saida.innerHTML = "";
  db.collection("saida").onSnapshot(s=>{
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

        r.update({ quantidade: novaQtd });
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

  const n = prompt("Nome:");
if(!validarNome(n)) return;

  const q = Number(prompt("Qtd:"));

  if(!n || q <= 0) return;

  db.collection("laboratorio").add({
    data: data,
    nome: n,
    quantidade: q
  });
}
function carregarLaboratorio(){
  laboratorio.innerHTML="";
  db.collection("laboratorio").onSnapshot(s=>{
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
    r.update({ quantidade: novaQtd });
  });
}

// ======================
// DÍVIDAS
// ======================
function addDivida(){
  let data = prompt("Data (DDMMAAAA):");
  data = formatarData(data);
  if(!data) return;

const n = prompt("Nome:");
if(!validarNome(n)) return;

  const v = Number(prompt("Valor:"));

  if(!n || v <= 0) return;

  db.collection("dividas").add({
    data: data,
    nome: n,
    valor: v
  });
}


function carregarDividas(){
  dividas.innerHTML="";
  let total=0;

  db.collection("dividas").onSnapshot(s=>{
    dividas.innerHTML="";
    total=0;

    s.forEach(d=>{
      const i=d.data();
      total+=i.valor;

      dividas.innerHTML+=`
      <tr>
        <td>${i.data}</td>
        <td>${i.nome}</td>
        <td contenteditable onblur="editarDivida('${d.id}',this.innerText)">
          ${i.valor.toFixed(2)}
        </td>
        <td>
          <button onclick="editarDivida('${d.id}',1,true)">➕</button>
          <button onclick="editarDivida('${d.id}',-1,true)">➖</button>
          <button onclick="excluir('dividas','${d.id}')">🗑️</button>
        </td>
      </tr>`;
    });

    totalDividas.innerText = total.toFixed(2);
  });
}

function editarDivida(id,v,inc){
  const r=db.collection("dividas").doc(id);
  r.get().then(d=>{
    let n = inc ? d.data().valor + v : Number(v);
    if(n < 0) n = 0;
    r.update({ valor: n });
  });
}

// ======================
// EXCLUIR
// ======================
function excluir(c,id){
  if(confirm("Excluir?")) db.collection(c).doc(id).delete();
}

// FORMATO DATA
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

function validarNome(nome){
  // somente letras, acentos e espaços
  if(!/^[A-Za-zÀ-ÿ\s]+$/.test(nome)){
    alert("Erro: o nome deve conter somente letras e espaços.");
    return false;
  }
  return true;
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

