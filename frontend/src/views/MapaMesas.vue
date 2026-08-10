<template>
  <div class="container">
    <div class="legenda">
      <span><i class="dot disponivel"></i> Disponível</span>
      <span><i class="dot ocupada"></i> Ocupada</span>
      <span><i class="dot reservada"></i> Reservada</span>
    </div>

    <div class="grid">
      <div v-for="mesa in mesas" :key="mesa.id" class="card" :class="mesa.status">
        <p class="numero">Mesa {{ mesa.numero }}</p>

        <template v-if="mesa.status === 'disponivel'">
          <p class="status">Disponível</p>
          <button v-if="podeAbrirMesa" @click="abrirModal(mesa)">Abrir mesa</button>
        </template>

        <template v-else-if="mesa.status === 'ocupada'">
          <p class="status">Ocupada</p>
          <p class="cliente">{{ mesa.comanda?.nome_cliente || 'Cliente não informado' }}</p>
          <p v-if="mesa.comanda?.aberta_em" class="tempo-aberto">⏱ {{ tempoAberto(mesa.comanda.aberta_em) }}</p>
          <p class="total">R$ {{ mesaTotal(mesa).toFixed(2) }}</p>
          <p v-if="mesa.comanda?.desconto_valor > 0" class="desconto">
            {{ mesa.comanda.desconto_tipo === 'percentual' ? `${mesa.comanda.desconto_valor}% desc.` : `R$ ${mesa.comanda.desconto_valor.toFixed(2)} desc.` }}
          </p>
          <button @click="irParaComanda(mesa)">Ver comanda</button>
        </template>

        <template v-else-if="mesa.status === 'reservada'">
          <p class="status">Reservada · {{ mesa.reserva?.horario }}</p>
          <p class="cliente">{{ mesa.reserva?.nome_cliente }}</p>
        </template>
      </div>
    </div>

    <!-- Modal simples de abertura de mesa -->
    <div v-if="mesaSelecionada" class="modal-backdrop" @click.self="mesaSelecionada = null">
      <div class="modal">
        <h3>Abrir Mesa {{ mesaSelecionada.numero }}</h3>
        <label>Nome do cliente</label>
        <input v-model="nomeCliente" placeholder="Opcional" />
        <div class="modal-actions">
          <button @click="mesaSelecionada = null">Cancelar</button>
          <button :disabled="abrindo" @click="confirmarAbertura">Abrir</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../services/api';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const auth = useAuthStore();
const podeAbrirMesa = computed(() => ['admin', 'garcom', 'caixa'].includes(auth.usuario?.papel));
const mesas = ref([]);
const mesaSelecionada = ref(null);
const nomeCliente = ref('');
const abrindo = ref(false);

const agora = ref(Date.now());
let intervaloRelogio = null;

function tempoAberto(abertaEm) {
  const minutos = Math.floor((agora.value - new Date(abertaEm.replace(' ', 'T') + 'Z').getTime()) / 60000);
  if (minutos < 1) return 'agora';
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  return `${horas}h${String(minutos % 60).padStart(2, '0')}`;
}

async function carregarMesas() {
  const { data } = await api.get('/mesas');
  mesas.value = data;
}

function abrirModal(mesa) {
  mesaSelecionada.value = mesa;
  nomeCliente.value = '';
}

async function confirmarAbertura() {
  abrindo.value = true;
  try {
    const { data } = await api.post(`/mesas/${mesaSelecionada.value.id}/abrir`, {
      nome_cliente: nomeCliente.value || null,
    });
    router.push(`/mesa/${mesaSelecionada.value.id}/comanda/${data.comanda_id}`);
  } finally {
    abrindo.value = false;
  }
}

function irParaComanda(mesa) {
  router.push(`/mesa/${mesa.id}/comanda/${mesa.comanda.id}`);
}

function mesaTotal(mesa) {
  const subtotal = mesa.comanda?.total || 0;
  if (!mesa.comanda?.desconto_valor) return subtotal;
  const desc = mesa.comanda.desconto_tipo === 'percentual'
    ? subtotal * (mesa.comanda.desconto_valor / 100)
    : mesa.comanda.desconto_valor;
  return Math.max(0, subtotal - desc);
}

onMounted(() => {
  carregarMesas();
  intervaloRelogio = setInterval(() => { agora.value = Date.now(); }, 30000);
});
onUnmounted(() => clearInterval(intervaloRelogio));
</script>

<style scoped>
.legenda {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  font-size: 13px;
  color: #555;
  margin-bottom: 20px;
}
.dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  border-radius: 2px;
  margin-right: 6px;
}
.dot.disponivel { background: #97c459; }
.dot.ocupada { background: #e24b4a; }
.dot.reservada { background: #ef9f27; }

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
}
.card {
  border-radius: 12px;
  padding: 14px;
  text-align: center;
}
.card.disponivel { background: #eaf3de; }
.card.ocupada { background: #fcebeb; }
.card.reservada { background: #faeeda; }
.card button { width: 100%; margin-top: 4px; }

.numero { font-weight: 500; margin: 0 0 4px; }
.status { font-size: 13px; margin: 0 0 4px; }
.cliente { font-size: 13px; font-weight: 500; margin: 0 0 8px; }
.tempo-aberto { font-size: 11px; color: #999; margin: 0 0 6px; }
.total { font-size: 13px; margin: 0 0 4px; }
.desconto { font-size: 11px; color: #0f6e56; margin: 0 0 8px; font-weight: 500; }

.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4);
  display: flex; align-items: center; justify-content: center;
  padding: 16px;
}
.modal {
  background: white; border-radius: 12px; padding: 20px; width: 300px; max-width: 100%;
  display: flex; flex-direction: column; gap: 8px;
}
.modal label { font-size: 13px; color: #666; }
.modal input { padding: 10px; border-radius: 8px; border: 1px solid #ccc; font-size: 16px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }

@media (max-width: 860px) {
  .container { padding: 12px; }
  .grid { grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
  .card { padding: 16px 12px; }
  .card button { padding: 12px; font-size: 14px; }
  .modal-actions button { padding: 12px; font-size: 14px; }
}
</style>
