<template>
  <div class="container gestao">
    <section class="card">
      <p class="titulo">Produtos</p>

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

    <section class="card">
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
        <thead><tr><th>Nome</th><th>E-mail</th><th>Papel</th><th></th></tr></thead>
        <tbody>
          <tr v-for="u in usuarios" :key="u.id">
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
              <td class="acoes">
                <button @click="salvarUsuario(u.id)">Salvar</button>
                <button @click="edicaoUsuarioId = null">Cancelar</button>
              </td>
            </template>
            <template v-else>
              <td>{{ u.nome }}</td>
              <td>{{ u.email }}</td>
              <td><span class="papel-badge" :class="u.papel">{{ papelLabel(u.papel) }}</span></td>
              <td class="acoes">
                <button @click="iniciarEdicaoUsuario(u)">Editar</button>
                <button @click="removerUsuario(u)">Remover</button>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
        </div>
    </section>
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

const categorias = ref([]);
const produtos = ref([]);
const usuarios = ref([]);

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
  await api.delete(`/usuarios/${u.id}`);
  await carregarUsuarios();
}

onMounted(() => {
  carregarCategorias();
  carregarProdutos();
  carregarUsuarios();
});
</script>

<style scoped>
.gestao { display: flex; flex-direction: column; gap: 20px; }
.card {
  background: white; border: 1px solid #e0e0e0; border-radius: 12px; padding: 16px;
}
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

@media (max-width: 700px) {
  .form-linha { flex-direction: column; align-items: stretch; }
  .form-linha input, .form-linha select { font-size: 16px; padding: 10px; }
  .form-linha button { padding: 10px 14px; font-size: 14px; }
  .acoes { flex-wrap: wrap; }
}
</style>
