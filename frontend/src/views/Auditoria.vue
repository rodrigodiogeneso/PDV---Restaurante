<template>
  <div class="container auditoria">
    <h1 class="titulo-pagina">Auditoria</h1>

    <div class="card filtros">
      <div class="form-linha">
        <label>
          De
          <input v-model="filtros.inicio" type="date" />
        </label>
        <label>
          Até
          <input v-model="filtros.fim" type="date" />
        </label>
        <label>
          Ação
          <select v-model="filtros.acao">
            <option value="">Todas</option>
            <option v-for="a in acoesDisponiveis" :key="a" :value="a">{{ acaoLabel(a) }}</option>
          </select>
        </label>
        <label>
          Usuário
          <select v-model="filtros.usuario_id">
            <option value="">Todos</option>
            <option v-for="u in usuarios" :key="u.id" :value="u.id">{{ u.nome }}</option>
          </select>
        </label>
        <button @click="carregar">Filtrar</button>
        <button class="btn-csv" @click="exportarCSV">Baixar CSV</button>
      </div>
    </div>

    <div class="card">
      <div class="tabela-wrap">
        <table>
        <thead>
          <tr><th>Quando</th><th>Usuário</th><th>Ação</th><th>Entidade</th><th>Detalhes</th></tr>
        </thead>
        <tbody>
          <tr v-for="r in registros" :key="r.id">
            <td class="quando">{{ formatarData(r.criado_em) }}</td>
            <td>{{ r.usuario_nome || '—' }}</td>
            <td><span class="acao-badge">{{ acaoLabel(r.acao) }}</span></td>
            <td>{{ r.entidade || '—' }}{{ r.entidade_id ? ` #${r.entidade_id}` : '' }}</td>
            <td class="detalhes">{{ formatarDetalhes(r.detalhes) }}</td>
          </tr>
          <tr v-if="!registros.length"><td colspan="5" class="vazio">Nenhum registro no período selecionado.</td></tr>
        </tbody>
      </table>
        </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import api from '../services/api';

const ACAO_LABELS = {
  login: 'Login',
  login_falhou: 'Login falhou',
  mesa_aberta: 'Mesa aberta',
  mesa_fechada: 'Mesa fechada',
  mesa_reservada: 'Mesa reservada',
  conta_impressa: 'Conta impressa',
  desconto_aplicado: 'Desconto aplicado',
  pagamento_registrado: 'Pagamento registrado',
  pagamento_removido: 'Pagamento removido',
  senha_alterada: 'Senha alterada',
  pedido_criado: 'Pedido criado',
  item_cancelado: 'Item cancelado',
  item_removido: 'Item removido',
  item_status_atualizado: 'Status do item atualizado',
  produto_criado: 'Produto criado',
  produto_editado: 'Produto editado',
  categoria_criada: 'Categoria criada',
  insumo_criado: 'Insumo criado',
  insumo_editado: 'Insumo editado',
  ficha_tecnica_vinculada: 'Ficha técnica vinculada',
  ficha_tecnica_removida: 'Ficha técnica removida',
  estoque_movimentado: 'Estoque movimentado',
  usuario_criado: 'Usuário criado',
  usuario_editado: 'Usuário editado',
  usuario_removido: 'Usuário removido',
  usuario_ativado: 'Usuário reativado',
  usuario_inativado: 'Usuário inativado',
  login_bloqueado_inativo: 'Login bloqueado (usuário inativo)',
  caixa_aberto: 'Caixa aberto',
  caixa_fechado: 'Caixa fechado',
  impressora_criada: 'Impressora criada',
  impressora_editada: 'Impressora editada',
};

function acaoLabel(acao) {
  return ACAO_LABELS[acao] || acao;
}

function formatarData(dataSqlite) {
  // SQLite CURRENT_TIMESTAMP vem como "YYYY-MM-DD HH:MM:SS" em UTC, sem timezone
  return new Date(dataSqlite.replace(' ', 'T') + 'Z').toLocaleString('pt-BR');
}

function formatarDetalhes(json) {
  if (!json) return '—';
  try {
    const obj = JSON.parse(json);
    return Object.entries(obj)
      .map(([chave, valor]) => `${chave}: ${typeof valor === 'object' ? JSON.stringify(valor) : valor}`)
      .join(' · ');
  } catch {
    return json;
  }
}

const registros = ref([]);
const usuarios = ref([]);
const acoesDisponiveis = ref([]);
const hoje = new Date().toISOString().slice(0, 10);
const filtros = reactive({ inicio: hoje, fim: hoje, acao: '', usuario_id: '' });

async function carregar() {
  const params = {};
  if (filtros.inicio) params.inicio = filtros.inicio;
  if (filtros.fim) params.fim = filtros.fim;
  if (filtros.acao) params.acao = filtros.acao;
  if (filtros.usuario_id) params.usuario_id = filtros.usuario_id;

  const { data } = await api.get('/auditoria', { params });
  registros.value = data;
}

async function exportarCSV() {
  const params = {};
  if (filtros.inicio) params.inicio = filtros.inicio;
  if (filtros.fim) params.fim = filtros.fim;
  if (filtros.acao) params.acao = filtros.acao;
  if (filtros.usuario_id) params.usuario_id = filtros.usuario_id;

  const resp = await api.get('/auditoria/csv', { params, responseType: 'blob' });
  const url = URL.createObjectURL(resp.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'auditoria.csv';
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(async () => {
  const [resUsuarios, resAcoes] = await Promise.all([api.get('/usuarios'), api.get('/auditoria/acoes')]);
  usuarios.value = resUsuarios.data;
  acoesDisponiveis.value = resAcoes.data;
  await carregar();
});
</script>

<style scoped>
.auditoria { display: flex; flex-direction: column; gap: 20px; }
.titulo-pagina { font-size: 18px; font-weight: 500; margin: 0; }
.card {
  background: white; border: 1px solid #e0e0e0; border-radius: 12px; padding: 16px;
}
.form-linha { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; }
.form-linha label {
  display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #666;
}
.form-linha input, .form-linha select {
  padding: 8px; border-radius: 8px; border: 1px solid #ccc; font-size: 13px;
}
.form-linha button {
  background: #1a1a1a; color: white; border: none; border-radius: 8px; padding: 9px 16px; cursor: pointer; font-size: 13px;
}
.form-linha .btn-csv { background: white; color: #1a1a1a; border: 1px solid #ccc; }

.tabela-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; color: #888; font-weight: 500; padding: 6px 8px; border-bottom: 1px solid #eee; }
td { padding: 6px 8px; border-bottom: 1px solid #f2f2f2; vertical-align: top; }
.quando { white-space: nowrap; color: #666; }
.detalhes { color: #666; font-size: 12px; }
.vazio { color: #999; text-align: center; }
.acao-badge {
  font-size: 11px; padding: 2px 8px; border-radius: 6px; background: #eee; color: #555; white-space: nowrap;
}

@media (max-width: 700px) {
  .form-linha { flex-direction: column; align-items: stretch; }
  .form-linha input, .form-linha select { font-size: 16px; padding: 10px; }
  .form-linha button { padding: 10px 14px; font-size: 14px; }
}
</style>
