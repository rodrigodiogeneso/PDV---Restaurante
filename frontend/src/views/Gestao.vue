<template>
  <div class="container gestao">
    <!-- Menu inicial: escolhe qual área gerenciar -->
    <div v-if="!secaoAtiva" class="menu-gestao">
      <button class="menu-card" @click="secaoAtiva = 'cardapio'">
        <span class="menu-icone">🍽️</span>
        <span class="menu-titulo">Cardápio</span>
        <span class="menu-sub">{{ produtos.length }} produtos · {{ categorias.length }} categorias</span>
      </button>
      <button class="menu-card" @click="secaoAtiva = 'impressoras'">
        <span class="menu-icone">🖨️</span>
        <span class="menu-titulo">Impressoras</span>
        <span class="menu-sub">{{ impressoras.length }} cadastradas</span>
      </button>
      <button class="menu-card" @click="secaoAtiva = 'usuarios'">
        <span class="menu-icone">👥</span>
        <span class="menu-titulo">Usuários</span>
        <span class="menu-sub">{{ usuarios.length }} usuários</span>
      </button>
    </div>

    <template v-else>
      <button class="btn-voltar" @click="secaoAtiva = null">← Voltar</button>

    <section v-if="secaoAtiva === 'cardapio'" class="card">
      <p class="titulo">Cardápio</p>

      <div class="form-linha">
        <input v-model="novoProduto.nome" placeholder="Nome do produto" />
        <input v-model.number="novoProduto.preco" type="number" step="0.01" placeholder="Preço" />
        <select v-model="novoProduto.categoria_id">
          <option :value="null">Sem categoria</option>
          <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nome }}</option>
        </select>
        <select v-model="novoProduto.setor_impressao">
          <option value="cozinha">Cozinha</option>
          <option value="bar">Bar</option>
        </select>
        <button @click="criarProduto">Adicionar</button>
      </div>

      <div class="form-linha">
        <input v-model="novaCategoria" placeholder="Nova categoria" />
        <button @click="criarCategoria">Adicionar categoria</button>
      </div>

      <p class="subtitulo">Filtrar lista</p>
      <div class="form-linha">
        <input v-model="filtro.busca" placeholder="Buscar por nome..." />
        <select v-model="filtro.categoriaId">
          <option value="">Todas categorias</option>
          <option v-for="c in categorias" :key="c.id" :value="String(c.id)">{{ c.nome }}</option>
        </select>
        <select v-model="filtro.setor">
          <option value="">Todos setores</option>
          <option value="cozinha">Cozinha</option>
          <option value="bar">Bar</option>
        </select>
        <select v-model="filtro.status">
          <option value="">Ativos e inativos</option>
          <option value="ativo">Só ativos</option>
          <option value="inativo">Só inativos</option>
        </select>
      </div>

      <div class="tabela-wrap">
        <table>
        <thead>
          <tr><th>Nome</th><th>Categoria</th><th>Preço</th><th>Setor</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="p in produtosFiltrados" :key="p.id" :class="{ inativo: !p.ativo }">
            <template v-if="edicaoProdutoId === p.id">
              <td><input v-model="edicaoProduto.nome" /></td>
              <td>
                <select v-model="edicaoProduto.categoria_id">
                  <option :value="null">Sem categoria</option>
                  <option v-for="c in categorias" :key="c.id" :value="c.id">{{ c.nome }}</option>
                </select>
              </td>
              <td><input v-model.number="edicaoProduto.preco" type="number" step="0.01" /></td>
              <td>
                <select v-model="edicaoProduto.setor_impressao">
                  <option value="cozinha">Cozinha</option>
                  <option value="bar">Bar</option>
                </select>
              </td>
              <td>{{ p.ativo ? 'Ativo' : 'Inativo' }}</td>
              <td class="acoes">
                <button @click="salvarProduto(p.id)">Salvar</button>
                <button @click="edicaoProdutoId = null">Cancelar</button>
              </td>
            </template>
            <template v-else>
              <td>{{ p.nome }}</td>
              <td>{{ p.categoria_nome || '—' }}</td>
              <td>R$ {{ p.preco.toFixed(2) }}</td>
              <td>{{ p.setor_impressao }}</td>
              <td>{{ p.ativo ? 'Ativo' : 'Inativo' }}</td>
              <td class="acoes">
                <button @click="iniciarEdicaoProduto(p)">Editar</button>
                <button @click="alternarAtivo(p)">{{ p.ativo ? 'Desativar' : 'Ativar' }}</button>
              </td>
            </template>
          </tr>
          <tr v-if="!produtosFiltrados.length"><td colspan="6" class="vazio">Nenhum produto encontrado.</td></tr>
        </tbody>
      </table>
        </div>
    </section>

    <section v-if="secaoAtiva === 'impressoras'" class="card">
      <p class="titulo">Impressoras</p>

      <div class="form-linha">
        <input v-model="novaImpressora.nome" placeholder="Nome (ex: Impressora cozinha)" />
        <select v-model="novaImpressora.setor">
          <option value="cozinha">Cozinha</option>
          <option value="bar">Bar / Caixa</option>
        </select>
        <input v-model="novaImpressora.ip" placeholder="IP (ex: 192.168.0.101)" />
        <input v-model.number="novaImpressora.porta" type="number" placeholder="Porta" />
        <button @click="criarImpressora">Adicionar</button>
      </div>

      <div class="tabela-wrap">
        <table>
        <thead>
          <tr><th>Nome</th><th>Setor</th><th>IP</th><th>Porta</th><th>Status</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="i in impressoras" :key="i.id" :class="{ inativo: !i.ativa }">
            <template v-if="edicaoImpressoraId === i.id">
              <td><input v-model="edicaoImpressora.nome" /></td>
              <td>
                <select v-model="edicaoImpressora.setor">
                  <option value="cozinha">Cozinha</option>
                  <option value="bar">Bar / Caixa</option>
                </select>
              </td>
              <td><input v-model="edicaoImpressora.ip" /></td>
              <td><input v-model.number="edicaoImpressora.porta" type="number" /></td>
              <td>{{ i.ativa ? 'Ativa' : 'Inativa' }}</td>
              <td class="acoes">
                <button @click="salvarImpressora(i.id)">Salvar</button>
                <button @click="edicaoImpressoraId = null">Cancelar</button>
              </td>
            </template>
            <template v-else>
              <td>{{ i.nome }}</td>
              <td>{{ i.setor === 'cozinha' ? 'Cozinha' : 'Bar / Caixa' }}</td>
              <td>{{ i.ip }}</td>
              <td>{{ i.porta }}</td>
              <td>{{ i.ativa ? 'Ativa' : 'Inativa' }}</td>
              <td class="acoes">
                <button @click="iniciarEdicaoImpressora(i)">Editar</button>
                <button @click="alternarAtivaImpressora(i)">{{ i.ativa ? 'Desativar' : 'Ativar' }}</button>
              </td>
            </template>
          </tr>
          <tr v-if="!impressoras.length"><td colspan="6" class="vazio">Nenhuma impressora cadastrada.</td></tr>
        </tbody>
      </table>
        </div>
    </section>

    <section v-if="secaoAtiva === 'usuarios'" class="card">
      <p class="titulo">Usuários</p>

      <div class="form-linha">
        <input v-model="novoUsuario.nome" placeholder="Nome" />
        <input v-model="novoUsuario.email" type="email" placeholder="E-mail" />
        <input v-model="novoUsuario.senha" type="password" placeholder="Senha" />
        <select v-model="novoUsuario.papel">
          <option value="garcom">Garçom</option>
          <option value="caixa">Caixa</option>
          <option value="cozinha">Cozinha</option>
          <option value="bar">Bar</option>
          <option value="admin">Admin</option>
        </select>
        <button @click="criarUsuario">Adicionar</button>
      </div>

      <div class="tabela-wrap">
        <table>
        <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th>Status</th><th></th></tr></thead>
        <tbody>
          <tr v-for="u in usuarios" :key="u.id" :class="{ inativo: !u.ativo }">
            <template v-if="edicaoUsuarioId === u.id">
              <td><input v-model="edicaoUsuario.nome" /></td>
              <td>{{ u.email }}</td>
              <td>
                <select v-model="edicaoUsuario.papel">
                  <option value="garcom">Garçom</option>
                  <option value="caixa">Caixa</option>
                  <option value="cozinha">Cozinha</option>
                  <option value="bar">Bar</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td>{{ u.ativo ? 'Ativo' : 'Inativo' }}</td>
              <td class="acoes">
                <button @click="salvarUsuario(u.id)">Salvar</button>
                <button @click="edicaoUsuarioId = null">Cancelar</button>
              </td>
            </template>
            <template v-else>
              <td>{{ u.nome }}</td>
              <td>{{ u.email }}</td>
              <td><span class="papel-badge" :class="u.papel">{{ papelLabel(u.papel) }}</span></td>
              <td>{{ u.ativo ? 'Ativo' : 'Inativo' }}</td>
              <td class="acoes">
                <button @click="iniciarEdicaoUsuario(u)">Editar</button>
                <button @click="abrirResetSenha(u)">Resetar senha</button>
                <button @click="alternarAtivoUsuario(u)">{{ u.ativo ? 'Inativar' : 'Reativar' }}</button>
                <button @click="removerUsuario(u)">Remover</button>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
        </div>
    </section>

    <!-- Modal de reset de senha -->
    <div v-if="resetSenhaUsuario" class="modal-backdrop" @click.self="fecharResetSenha">
      <div class="modal">
        <h3>Resetar senha — {{ resetSenhaUsuario.nome }}</h3>
        <p class="modal-aviso">A pessoa vai precisar trocar essa senha no próximo login.</p>
        <label>Nova senha</label>
        <input v-model="novaSenhaReset" type="password" minlength="6" autofocus />
        <label>Confirmar nova senha</label>
        <input v-model="confirmarSenhaReset" type="password" minlength="6" />
        <p v-if="erroReset" class="erro-reset">{{ erroReset }}</p>
        <div class="modal-actions">
          <button @click="fecharResetSenha">Cancelar</button>
          <button class="btn-salvar" :disabled="resetando" @click="confirmarResetSenha">
            {{ resetando ? 'Salvando...' : 'Resetar senha' }}
          </button>
        </div>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import api from '../services/api';

const PAPEL_LABELS = {
  admin: 'Admin',
  garcom: 'Garçom',
  caixa: 'Caixa',
  cozinha: 'Cozinha',
  bar: 'Bar',
};

const secaoAtiva = ref(null);
const categorias = ref([]);
const produtos = ref([]);
const usuarios = ref([]);
const impressoras = ref([]);

const novoProduto = reactive({ nome: '', preco: null, categoria_id: null, setor_impressao: 'cozinha' });
const filtro = reactive({ busca: '', categoriaId: '', setor: '', status: '' });
const produtosFiltrados = computed(() => {
  return produtos.value.filter((p) => {
    if (filtro.busca && !p.nome.toLowerCase().includes(filtro.busca.toLowerCase())) return false;
    if (filtro.categoriaId && Number(filtro.categoriaId) !== p.categoria_id) return false;
    if (filtro.setor && p.setor_impressao !== filtro.setor) return false;
    if (filtro.status === 'ativo' && !p.ativo) return false;
    if (filtro.status === 'inativo' && p.ativo) return false;
    return true;
  });
});
const novaCategoria = ref('');

const edicaoProdutoId = ref(null);
const edicaoProduto = reactive({ nome: '', preco: null, categoria_id: null, setor_impressao: 'cozinha' });

const novoUsuario = reactive({ nome: '', email: '', senha: '', papel: 'garcom' });
const edicaoUsuarioId = ref(null);
const edicaoUsuario = reactive({ nome: '', papel: 'garcom' });

const resetSenhaUsuario = ref(null);
const novaSenhaReset = ref('');
const confirmarSenhaReset = ref('');
const erroReset = ref('');
const resetando = ref(false);

const novaImpressora = reactive({ nome: '', setor: 'cozinha', ip: '', porta: 9100 });
const edicaoImpressoraId = ref(null);
const edicaoImpressora = reactive({ nome: '', setor: 'cozinha', ip: '', porta: 9100 });

function papelLabel(papel) {
  return PAPEL_LABELS[papel] || papel;
}

async function carregarCategorias() {
  const { data } = await api.get('/produtos/categorias');
  categorias.value = data;
}
async function carregarProdutos() {
  const { data } = await api.get('/produtos?incluirInativos=1');
  produtos.value = data;
}
async function carregarUsuarios() {
  const { data } = await api.get('/usuarios');
  usuarios.value = data;
}
async function carregarImpressoras() {
  const { data } = await api.get('/impressoras');
  impressoras.value = data;
}

async function criarCategoria() {
  if (!novaCategoria.value.trim()) return;
  await api.post('/produtos/categorias', { nome: novaCategoria.value });
  novaCategoria.value = '';
  await carregarCategorias();
}

async function criarProduto() {
  if (!novoProduto.nome || !novoProduto.preco) return;
  await api.post('/produtos', { ...novoProduto });
  novoProduto.nome = '';
  novoProduto.preco = null;
  novoProduto.categoria_id = null;
  await carregarProdutos();
}

function iniciarEdicaoProduto(p) {
  edicaoProdutoId.value = p.id;
  Object.assign(edicaoProduto, {
    nome: p.nome,
    preco: p.preco,
    categoria_id: p.categoria_id,
    setor_impressao: p.setor_impressao,
  });
}
async function salvarProduto(id) {
  await api.put(`/produtos/${id}`, { ...edicaoProduto });
  edicaoProdutoId.value = null;
  await carregarProdutos();
}
async function alternarAtivo(p) {
  await api.put(`/produtos/${p.id}`, { ativo: p.ativo ? 0 : 1 });
  await carregarProdutos();
}

async function criarUsuario() {
  if (!novoUsuario.nome || !novoUsuario.email || !novoUsuario.senha) return;
  await api.post('/usuarios', { ...novoUsuario });
  novoUsuario.nome = '';
  novoUsuario.email = '';
  novoUsuario.senha = '';
  novoUsuario.papel = 'garcom';
  await carregarUsuarios();
}

function iniciarEdicaoUsuario(u) {
  edicaoUsuarioId.value = u.id;
  Object.assign(edicaoUsuario, { nome: u.nome, papel: u.papel });
}
async function salvarUsuario(id) {
  await api.put(`/usuarios/${id}`, { ...edicaoUsuario });
  edicaoUsuarioId.value = null;
  await carregarUsuarios();
}
async function removerUsuario(u) {
  if (!window.confirm(`Remover o usuário ${u.nome}?`)) return;
  try {
    await api.delete(`/usuarios/${u.id}`);
    await carregarUsuarios();
  } catch (e) {
    window.alert(e.response?.data?.erro || 'Não foi possível remover o usuário.');
  }
}
async function alternarAtivoUsuario(u) {
  await api.put(`/usuarios/${u.id}`, { ativo: u.ativo ? 0 : 1 });
  await carregarUsuarios();
}

function abrirResetSenha(u) {
  resetSenhaUsuario.value = u;
  novaSenhaReset.value = '';
  confirmarSenhaReset.value = '';
  erroReset.value = '';
}
function fecharResetSenha() {
  resetSenhaUsuario.value = null;
}
async function confirmarResetSenha() {
  erroReset.value = '';
  if (novaSenhaReset.value.length < 6) {
    erroReset.value = 'A senha deve ter pelo menos 6 caracteres.';
    return;
  }
  if (novaSenhaReset.value !== confirmarSenhaReset.value) {
    erroReset.value = 'As senhas não coincidem.';
    return;
  }
  resetando.value = true;
  try {
    await api.put(`/usuarios/${resetSenhaUsuario.value.id}`, { senha: novaSenhaReset.value });
    fecharResetSenha();
  } catch (e) {
    erroReset.value = e.response?.data?.erro || 'Não foi possível resetar a senha.';
  } finally {
    resetando.value = false;
  }
}

async function criarImpressora() {
  if (!novaImpressora.nome || !novaImpressora.ip) return;
  await api.post('/impressoras', { ...novaImpressora });
  novaImpressora.nome = '';
  novaImpressora.ip = '';
  novaImpressora.porta = 9100;
  await carregarImpressoras();
}

function iniciarEdicaoImpressora(i) {
  edicaoImpressoraId.value = i.id;
  Object.assign(edicaoImpressora, { nome: i.nome, setor: i.setor, ip: i.ip, porta: i.porta });
}
async function salvarImpressora(id) {
  await api.put(`/impressoras/${id}`, { ...edicaoImpressora });
  edicaoImpressoraId.value = null;
  await carregarImpressoras();
}
async function alternarAtivaImpressora(i) {
  await api.put(`/impressoras/${i.id}`, { ativa: i.ativa ? 0 : 1 });
  await carregarImpressoras();
}

onMounted(() => {
  carregarCategorias();
  carregarProdutos();
  carregarUsuarios();
  carregarImpressoras();
});
</script>

<style scoped>
.gestao { display: flex; flex-direction: column; gap: 20px; }
.card {
  background: white; border: 1px solid #e0e0e0; border-radius: 12px; padding: 16px;
}

.menu-gestao {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;
}
.menu-card {
  background: white; border: 1px solid #e0e0e0; border-radius: 14px; padding: 28px 20px;
  display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center;
  cursor: pointer; transition: border-color 0.15s, transform 0.1s, box-shadow 0.15s;
}
.menu-card:hover { border-color: #0f6e56; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
.menu-card:active { transform: scale(0.98); }
.menu-icone { font-size: 32px; }
.menu-titulo { font-size: 15px; font-weight: 600; color: #1a1a1a; }
.menu-sub { font-size: 12px; color: #888; }

.btn-voltar {
  align-self: flex-start; background: none; border: none; color: #0f6e56; font-size: 14px;
  font-weight: 500; cursor: pointer; padding: 4px 0; margin-bottom: -4px;
}
.btn-voltar:hover { text-decoration: underline; }
.titulo { font-weight: 500; margin: 0 0 12px; }
.subtitulo { font-size: 13px; color: #666; margin: 16px 0 8px; }

.form-linha { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
.form-linha input, .form-linha select {
  padding: 8px; border-radius: 8px; border: 1px solid #ccc; font-size: 13px;
}
.form-linha button {
  background: #1a1a1a; color: white; border: none; border-radius: 8px; padding: 8px 14px; cursor: pointer; font-size: 13px;
}

.tabela-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; color: #888; font-weight: 500; padding: 6px 8px; border-bottom: 1px solid #eee; }
td { padding: 6px 8px; border-bottom: 1px solid #f2f2f2; }
tr.inativo { opacity: 0.5; }
.acoes { display: flex; gap: 6px; }
.acoes button, td button {
  background: white; border: 1px solid #ccc; border-radius: 6px; padding: 4px 8px; cursor: pointer; font-size: 12px;
}
.vazio { color: #999; text-align: center; }
.papel-badge {
  font-size: 11px; padding: 2px 8px; border-radius: 6px; background: #eee; color: #666;
}
.papel-badge.admin { background: #1a1a1a; color: white; }
.papel-badge.garcom { background: #e6f1fb; color: #185fa5; }
.papel-badge.caixa { background: #eaf3de; color: #4c7a1f; }
.papel-badge.cozinha { background: #faeeda; color: #854f0b; }
.papel-badge.bar { background: #f1e6fb; color: #6a3fa0; }

.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1001;
  display: flex; align-items: center; justify-content: center; padding: 16px;
}
.modal {
  background: white; border-radius: 12px; padding: 20px; width: 320px; max-width: 100%;
  display: flex; flex-direction: column; gap: 8px;
}
.modal h3 { margin: 0 0 4px; font-size: 16px; }
.modal-aviso { font-size: 13px; color: #666; margin: 0 0 8px; }
.modal label { font-size: 13px; color: #444; margin-top: 4px; }
.modal input { padding: 10px; border-radius: 8px; border: 1px solid #ccc; font-size: 16px; }
.erro-reset { color: #a03a3a; font-size: 13px; margin: 4px 0 0; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; }
.btn-salvar { background: #0f6e56; color: white; border: none; }

@media (max-width: 700px) {
  .form-linha { flex-direction: column; align-items: stretch; }
  .form-linha input, .form-linha select { font-size: 16px; padding: 10px; }
  .form-linha button { padding: 10px 14px; font-size: 14px; }
  .acoes { flex-wrap: wrap; }
}
</style>
