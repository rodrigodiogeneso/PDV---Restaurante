<template>
  <div class="container relatorios">
    <h1 class="titulo-pagina">Relatórios</h1>

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
        <button @click="carregar">Gerar</button>
      </div>
    </div>

    <!-- Menu inicial: escolhe qual relatório ver -->
    <div v-if="!secaoAtiva" class="menu-gestao">
      <button class="menu-card" @click="secaoAtiva = 'vendas'">
        <span class="menu-icone">💰</span>
        <span class="menu-titulo">Vendas</span>
        <span class="menu-sub">
          {{ relatorio ? `R$ ${relatorio.resumo.totalLiquido.toFixed(2)} no período` : 'Carregando...' }}
        </span>
      </button>
      <button class="menu-card" @click="secaoAtiva = 'produtos'">
        <span class="menu-icone">🏆</span>
        <span class="menu-titulo">Produtos mais vendidos</span>
        <span class="menu-sub">
          {{ relatorio ? `${relatorio.porProduto.length} no ranking` : 'Carregando...' }}
        </span>
      </button>
      <button class="menu-card" @click="secaoAtiva = 'pagamentos'">
        <span class="menu-icone">💳</span>
        <span class="menu-titulo">Formas de pagamento</span>
        <span class="menu-sub">
          {{ relatorio ? `${relatorio.porFormaPagamento.length} formas usadas` : 'Carregando...' }}
        </span>
      </button>
    </div>

    <template v-else>
      <button class="btn-voltar" @click="secaoAtiva = null">← Voltar</button>

      <section v-if="secaoAtiva === 'vendas'" class="card">
        <p class="titulo">Vendas</p>

        <div v-if="relatorio" class="resumo-cards">
          <div class="stat-card">
            <p class="stat-label">Total bruto</p>
            <p class="stat-valor">R$ {{ relatorio.resumo.totalVendido.toFixed(2) }}</p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Descontos</p>
            <p class="stat-valor desconto">-R$ {{ relatorio.resumo.totalDescontos.toFixed(2) }}</p>
          </div>
          <div class="stat-card destaque">
            <p class="stat-label">Total líquido</p>
            <p class="stat-valor">R$ {{ relatorio.resumo.totalLiquido.toFixed(2) }}</p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Comandas</p>
            <p class="stat-valor">{{ relatorio.resumo.totalComandas }}</p>
          </div>
          <div class="stat-card">
            <p class="stat-label">Ticket médio</p>
            <p class="stat-valor">R$ {{ relatorio.resumo.ticketMedio.toFixed(2) }}</p>
          </div>
        </div>

        <p class="subtitulo">Vendas por dia</p>
        <div class="tabela-wrap">
          <table>
          <thead><tr><th>Data</th><th>Comandas</th><th>Total</th></tr></thead>
          <tbody>
            <tr v-for="d in relatorio?.porDia" :key="d.data">
              <td>{{ formatarDataCurta(d.data) }}</td>
              <td>{{ d.comandas }}</td>
              <td>R$ {{ d.total.toFixed(2) }}</td>
            </tr>
            <tr v-if="relatorio && !relatorio.porDia.length"><td colspan="3" class="vazio">Nenhuma venda no período.</td></tr>
          </tbody>
        </table>
        </div>

        <button class="btn-csv" @click="exportarCSV">Baixar CSV</button>
      </section>

      <section v-if="secaoAtiva === 'produtos'" class="card">
        <p class="titulo">Produtos mais vendidos</p>
        <div class="tabela-wrap">
          <table>
          <thead><tr><th>Produto</th><th>Quantidade</th><th>Total</th></tr></thead>
          <tbody>
            <tr v-for="p in relatorio?.porProduto" :key="p.produto_nome">
              <td>{{ p.produto_nome }}</td>
              <td>{{ p.quantidade }}</td>
              <td>R$ {{ p.total.toFixed(2) }}</td>
            </tr>
            <tr v-if="relatorio && !relatorio.porProduto.length"><td colspan="3" class="vazio">Nenhuma venda no período.</td></tr>
          </tbody>
        </table>
        </div>
      </section>

      <section v-if="secaoAtiva === 'pagamentos'" class="card">
        <p class="titulo">Formas de pagamento</p>
        <div class="tabela-wrap">
          <table>
          <thead><tr><th>Forma</th><th>Pagamentos</th><th>Total</th></tr></thead>
          <tbody>
            <tr v-for="f in relatorio?.porFormaPagamento" :key="f.forma_pagamento">
              <td>{{ formaLabel(f.forma_pagamento) }}</td>
              <td>{{ f.quantidade_pagamentos }}</td>
              <td>R$ {{ f.total.toFixed(2) }}</td>
            </tr>
            <tr v-if="relatorio && !relatorio.porFormaPagamento.length"><td colspan="3" class="vazio">Nenhum pagamento no período.</td></tr>
          </tbody>
        </table>
        </div>

        <button class="btn-csv" @click="exportarCSVPagamentos">Baixar CSV</button>
      </section>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import api from '../services/api';

const hoje = new Date().toISOString().slice(0, 10);
const filtros = reactive({ inicio: hoje, fim: hoje });
const relatorio = ref(null);
const secaoAtiva = ref(null);

const FORMA_LABELS = {
  dinheiro: '💵 Dinheiro',
  cartao_credito: '💳 Crédito',
  cartao_debito: '💳 Débito',
  pix: '📱 PIX',
  misto: '🔀 Misto',
};

function formaLabel(forma) {
  return FORMA_LABELS[forma] || forma || 'Não informado';
}

function formatarDataCurta(data) {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

async function carregar() {
  const { data } = await api.get('/relatorios/vendas', { params: { ...filtros } });
  relatorio.value = data;
}

async function exportarCSV() {
  const resp = await api.get('/relatorios/vendas/csv', {
    params: { ...filtros },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(resp.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vendas_${filtros.inicio}_${filtros.fim}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportarCSVPagamentos() {
  const resp = await api.get('/relatorios/pagamentos/csv', {
    params: { ...filtros },
    responseType: 'blob',
  });
  const url = URL.createObjectURL(resp.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pagamentos_${filtros.inicio}_${filtros.fim}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

onMounted(carregar);
</script>

<style scoped>
.relatorios { display: flex; flex-direction: column; gap: 20px; }
.titulo-pagina { font-size: 18px; font-weight: 500; margin: 0; }
.card {
  background: white; border: 1px solid #e0e0e0; border-radius: 12px; padding: 16px;
}
.form-linha { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; }
.form-linha label {
  display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: #666;
}
.form-linha input {
  padding: 8px; border-radius: 8px; border: 1px solid #ccc; font-size: 13px;
}
.form-linha button {
  background: #1a1a1a; color: white; border: none; border-radius: 8px; padding: 9px 16px; cursor: pointer; font-size: 13px;
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

.resumo-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin-bottom: 20px; }
.stat-card {
  background: #f1efe8; border-radius: 12px; padding: 16px;
}
.stat-card.destaque { background: #0f6e56; }
.stat-card.destaque .stat-label { color: rgba(255,255,255,0.7); }
.stat-card.destaque .stat-valor { color: white; }
.stat-label { font-size: 12px; color: #666; margin: 0 0 6px; }
.stat-valor { font-size: 22px; font-weight: 600; margin: 0; }
.stat-valor.desconto { color: #a03a3a; }

.subtitulo { font-weight: 500; margin: 0 0 12px; }
.tabela-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
table { width: 100%; border-collapse: collapse; font-size: 13px; }
th { text-align: left; color: #888; font-weight: 500; padding: 6px 8px; border-bottom: 1px solid #eee; }
td { padding: 6px 8px; border-bottom: 1px solid #f2f2f2; }
.vazio { color: #999; text-align: center; }

.btn-csv {
  margin-top: 14px; background: white; color: #1a1a1a; border: 1px solid #ccc;
  border-radius: 8px; padding: 9px 16px; cursor: pointer; font-size: 13px;
}

@media (max-width: 700px) {
  .form-linha { flex-direction: column; align-items: stretch; }
  .form-linha input { font-size: 16px; padding: 10px; }
  .form-linha button { padding: 10px 14px; font-size: 14px; }
}
</style>
