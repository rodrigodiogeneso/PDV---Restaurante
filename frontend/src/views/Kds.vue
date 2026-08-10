<template>
  <div class="container">
    <p class="setor-label">Setor: {{ setor }}</p>
    <div class="colunas">
      <div v-for="coluna in colunas" :key="coluna.status" class="coluna">
        <p class="coluna-titulo">{{ coluna.label }} · {{ itensPorStatus(coluna.status).length }}</p>
        <div
          v-for="item in itensPorStatus(coluna.status)"
          :key="item.id"
          class="item-card"
        >
          <div class="item-topo">
            <span class="mesa">Mesa {{ item.mesa_numero }}</span>
            <span class="tempo">{{ tempoDecorrido(item.criado_em) }}</span>
          </div>
          <p class="produto">{{ item.quantidade }}x {{ item.produto_nome }}</p>
          <div class="item-acoes">
            <button v-if="coluna.proximoStatus" @click="avancarStatus(item)">
              {{ coluna.proximoLabel }}
            </button>
            <button v-if="podeCancelar" class="cancelar" @click="cancelarItem(item)">Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import api from '../services/api';
import { conectarWebSocket } from '../services/ws';
import { useAuthStore } from '../stores/auth';

const props = defineProps(['setor']);
const auth = useAuthStore();

const itens = ref([]);
const podeCancelar = computed(() => ['admin', 'caixa'].includes(auth.usuario?.papel));
let ws = null;
let intervaloSeguranca = null;

const colunas = [
  { status: 'pendente', label: 'Pendente', proximoStatus: 'preparando', proximoLabel: 'Iniciar preparo' },
  { status: 'preparando', label: 'Preparando', proximoStatus: 'pronto', proximoLabel: 'Marcar como pronto' },
  { status: 'pronto', label: 'Pronto', proximoStatus: null },
];

function itensPorStatus(status) {
  return itens.value.filter((i) => i.status === status);
}

function tempoDecorrido(criadoEm) {
  const minutos = Math.floor((Date.now() - new Date(criadoEm).getTime()) / 60000);
  const h = String(Math.floor(minutos / 60)).padStart(2, '0');
  const m = String(minutos % 60).padStart(2, '0');
  return `${h}:${m}`;
}

async function carregar() {
  const { data } = await api.get(`/pedidos/kds/${props.setor}`);
  itens.value = data;
}

async function avancarStatus(item) {
  const coluna = colunas.find((c) => c.status === item.status);
  await api.patch(`/pedidos/itens/${item.id}/status`, { status: coluna.proximoStatus });
  await carregar();
}

async function cancelarItem(item) {
  if (!window.confirm(`Cancelar ${item.quantidade}x ${item.produto_nome} da Mesa ${item.mesa_numero}?`)) return;
  await api.patch(`/pedidos/itens/${item.id}/status`, { status: 'cancelado' });
  await carregar();
}

onMounted(() => {
  carregar();
  ws = conectarWebSocket((msg) => {
    if (msg.tipo === 'pedido_criado' || msg.tipo === 'item_atualizado') carregar();
  });
  // Poll de segurança bem espaçado, caso o WebSocket fique indisponível por muito tempo
  intervaloSeguranca = setInterval(carregar, 30000);
});
onUnmounted(() => {
  ws?.fechar();
  clearInterval(intervaloSeguranca);
});
</script>

<style scoped>
.setor-label {
  font-size: 13px; font-weight: 500; background: #faeeda; color: #854f0b;
  display: inline-block; padding: 4px 12px; border-radius: 8px; margin-bottom: 16px;
}
.colunas {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}
.coluna-titulo { font-size: 13px; color: #666; margin: 0 0 10px; }
.item-card {
  background: white; border: 1px solid #e0e0e0; border-radius: 12px;
  padding: 12px; margin-bottom: 10px;
}
.item-topo { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
.mesa { font-weight: 500; }
.tempo { color: #999; }
.produto { font-size: 13px; margin: 0 0 10px; }
.item-acoes { display: flex; gap: 6px; }
.item-acoes .cancelar { background: white; border: 1px solid #e0b4b4; color: #a03a3a; }
</style>
