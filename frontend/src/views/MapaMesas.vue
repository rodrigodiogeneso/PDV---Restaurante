<template>
  <div class="container">
    <!-- Gate: papel caixa precisa abrir o caixa do dia antes de ver as mesas -->
    <div v-if="ehCaixa && !sessaoCaixa" class="abrir-caixa-tela">
      <div class="abrir-caixa-card">
        <div class="abrir-caixa-icone">💰</div>
        <h2>Abrir caixa</h2>
        <p class="abrir-caixa-texto">
          Bom turno, {{ auth.usuario?.nome?.split(' ')[0] }}! Informe o valor que já
          está na gaveta pra começar o dia.
        </p>
        <label>Valor inicial em caixa</label>
        <div class="input-moeda">
          <span class="prefixo-moeda">R$</span>
          <input v-model.number="valorAbertura" type="number" min="0" step="0.01" placeholder="0,00" autofocus />
        </div>
        <button class="btn-abrir-caixa" :disabled="abrindoCaixa || valorAbertura === null" @click="abrirCaixa">
          {{ abrindoCaixa ? 'Abrindo...' : 'Abrir caixa' }}
        </button>
      </div>
    </div>

    <template v-else>
      <div v-if="ehCaixa && sessaoCaixa" class="barra-caixa">
        <div class="barra-caixa-info">
          <span class="barra-caixa-icone">🗄️</span>
          <div>
            <p class="barra-caixa-titulo">Caixa aberto às {{ horaAbertura }}</p>
            <p class="barra-caixa-sub">Abertura: R$ {{ sessaoCaixa.valor_abertura.toFixed(2) }}</p>
          </div>
        </div>
        <div class="barra-caixa-acoes">
          <button @click="verVendasHoje">Ver vendas de hoje</button>
          <button class="btn-fechar-caixa" @click="abrirConfirmacaoFechar">Fechar caixa</button>
        </div>
      </div>

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

      <!-- Modal de resumo de vendas do caixa (ver vendas de hoje / confirmar fechamento) -->
      <div v-if="resumoCaixa" class="modal-backdrop" @click.self="resumoCaixa = null">
        <div class="modal modal-resumo">
          <h3>{{ modoFecharCaixa ? '🔒 Fechar caixa' : '📊 Vendas de hoje' }}</h3>
          <p class="resumo-abertura">Abertura às {{ horaAbertura }} · R$ {{ sessaoCaixa.valor_abertura.toFixed(2) }}</p>

          <div class="resumo-formas">
            <div v-for="f in resumoCaixa.porFormaPagamento" :key="f.forma_pagamento" class="resumo-linha">
              <span>{{ formaLabel(f.forma_pagamento) }}</span>
              <span>R$ {{ f.total.toFixed(2) }}</span>
            </div>
            <p v-if="!resumoCaixa.porFormaPagamento.length" class="vazio">Nenhuma venda registrada ainda.</p>
          </div>

          <div class="resumo-total">
            <span>Total vendido</span>
            <span>R$ {{ resumoCaixa.totalGeral.toFixed(2) }}</span>
          </div>

          <p v-if="modoFecharCaixa" class="resumo-aviso">Confere os valores acima antes de encerrar o turno.</p>

          <div class="modal-actions">
            <button @click="resumoCaixa = null">{{ modoFecharCaixa ? 'Voltar' : 'Fechar' }}</button>
            <button v-if="modoFecharCaixa" class="btn-salvar" :disabled="fechandoCaixa" @click="confirmarFecharCaixa">
              {{ fechandoCaixa ? 'Fechando...' : 'Confirmar fechamento' }}
            </button>
          </div>
        </div>
      </div>
    </template>
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
const ehCaixa = computed(() => auth.usuario?.papel === 'caixa');
const mesas = ref([]);
const mesaSelecionada = ref(null);
const nomeCliente = ref('');
const abrindo = ref(false);

const agora = ref(Date.now());
let intervaloRelogio = null;

const sessaoCaixa = ref(null);
const valorAbertura = ref(null);
const abrindoCaixa = ref(false);
const resumoCaixa = ref(null);
const modoFecharCaixa = ref(false);
const fechandoCaixa = ref(false);

const horaAbertura = computed(() => {
  if (!sessaoCaixa.value) return '';
  return new Date(sessaoCaixa.value.aberto_em.replace(' ', 'T') + 'Z').toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
});

const FORMA_LABELS = {
  dinheiro: '💵 Dinheiro',
  cartao_credito: '💳 Crédito',
  cartao_debito: '💳 Débito',
  pix: '📱 PIX',
};
function formaLabel(forma) {
  return FORMA_LABELS[forma] || forma;
}

async function verificarCaixa() {
  const { data } = await api.get('/caixa/atual');
  sessaoCaixa.value = data.sessao;
}

async function abrirCaixa() {
  if (valorAbertura.value === null || valorAbertura.value < 0) return;
  abrindoCaixa.value = true;
  try {
    const { data } = await api.post('/caixa/abrir', { valor_abertura: valorAbertura.value });
    sessaoCaixa.value = data.sessao;
    await carregarMesas();
  } finally {
    abrindoCaixa.value = false;
  }
}

async function verVendasHoje() {
  const { data } = await api.get('/caixa/resumo');
  modoFecharCaixa.value = false;
  resumoCaixa.value = data.resumo;
}

async function abrirConfirmacaoFechar() {
  const { data } = await api.get('/caixa/resumo');
  modoFecharCaixa.value = true;
  resumoCaixa.value = data.resumo;
}

async function confirmarFecharCaixa() {
  fechandoCaixa.value = true;
  try {
    await api.post('/caixa/fechar');
    resumoCaixa.value = null;
    sessaoCaixa.value = null;
    valorAbertura.value = null;
  } finally {
    fechandoCaixa.value = false;
  }
}

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

onMounted(async () => {
  if (ehCaixa.value) {
    await verificarCaixa();
    if (sessaoCaixa.value) await carregarMesas();
  } else {
    await carregarMesas();
  }
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
.btn-salvar { background: #0f6e56; color: white; border: none; }

.abrir-caixa-tela {
  min-height: 70vh; display: flex; align-items: center; justify-content: center;
}
.abrir-caixa-card {
  background: white; border-radius: 16px; padding: 36px 32px; width: 340px; max-width: 100%;
  display: flex; flex-direction: column; gap: 8px; text-align: center;
  box-shadow: 0 8px 28px rgba(0,0,0,0.08);
}
.abrir-caixa-icone { font-size: 36px; margin-bottom: 4px; }
.abrir-caixa-card h2 { margin: 0; font-size: 19px; }
.abrir-caixa-texto { font-size: 13px; color: #666; margin: 4px 0 16px; line-height: 1.5; }
.abrir-caixa-card label { font-size: 12px; color: #888; text-align: left; text-transform: uppercase; letter-spacing: 0.03em; }
.input-moeda {
  display: flex; align-items: center; gap: 6px; border: 1.5px solid #ddd; border-radius: 10px;
  padding: 4px 14px; margin: 4px 0 4px; transition: border-color 0.15s, box-shadow 0.15s;
}
.input-moeda:focus-within { border-color: #0f6e56; box-shadow: 0 0 0 3px rgba(15, 110, 86, 0.12); }
.input-moeda .prefixo-moeda { color: #888; font-size: 15px; }
.abrir-caixa-card input {
  border: none; outline: none; padding: 12px 0; font-size: 20px; font-weight: 600; width: 100%;
  text-align: left; background: transparent;
}
.btn-abrir-caixa {
  margin-top: 16px; background: #0f6e56; color: white; border: none; padding: 14px; border-radius: 10px;
  cursor: pointer; font-size: 15px; font-weight: 500; transition: background 0.15s;
}
.btn-abrir-caixa:hover:not(:disabled) { background: #0c5943; }
.btn-abrir-caixa:disabled { opacity: 0.5; cursor: not-allowed; }

.barra-caixa {
  display: flex; flex-wrap: wrap; gap: 12px; align-items: center; justify-content: space-between;
  background: #eaf3de; border: 1px solid #d3e6c0; border-radius: 12px; padding: 14px 18px; margin-bottom: 20px;
}
.barra-caixa-info { display: flex; align-items: center; gap: 12px; }
.barra-caixa-icone { font-size: 22px; }
.barra-caixa-titulo { font-size: 14px; font-weight: 600; margin: 0; color: #2d4a1f; }
.barra-caixa-sub { font-size: 12px; color: #5a7a4a; margin: 2px 0 0; }
.barra-caixa-acoes { display: flex; gap: 8px; }
.barra-caixa-acoes button { font-size: 12px; padding: 8px 12px; }
.btn-fechar-caixa { color: #a03a3a; border-color: #e0b4b4 !important; }

.modal-resumo { width: 340px; }
.resumo-abertura { font-size: 12px; color: #888; margin: 0 0 12px; }
.resumo-formas { display: flex; flex-direction: column; gap: 8px; margin: 4px 0 12px; }
.resumo-linha {
  display: flex; justify-content: space-between; font-size: 14px; background: #f7f6f2;
  border-radius: 8px; padding: 8px 12px;
}
.resumo-total {
  display: flex; justify-content: space-between; align-items: center; font-weight: 600; font-size: 16px;
  background: #0f6e56; color: white; border-radius: 10px; padding: 12px 14px; margin-top: 4px;
}
.resumo-aviso { font-size: 12px; color: #666; margin: 10px 0 0; }
.vazio { color: #999; font-size: 13px; }

@media (max-width: 860px) {
  .container { padding: 12px; }
  .grid { grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; }
  .card { padding: 16px 12px; }
  .card button { padding: 12px; font-size: 14px; }
  .modal-actions button { padding: 12px; font-size: 14px; }
}
</style>
