<template>
  <div class="container comanda-layout" :class="{ 'somente-leitura': !podeAdicionarItens }">
    <aside v-if="podeAdicionarItens" class="produtos">
      <div class="busca-wrapper">
        <svg class="busca-icone" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="9" cy="9" r="6.5" stroke="currentColor" stroke-width="1.6" />
          <path d="M18 18L14 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
        </svg>
        <input v-model="busca" type="search" class="busca-produto" placeholder="Buscar item..." />
        <button v-if="busca" class="busca-limpar" type="button" @click="busca = ''" aria-label="Limpar busca">✕</button>
      </div>

      <p v-if="!produtosAgrupados.length" class="vazio">Nenhum item encontrado.</p>

      <div v-for="grupo in produtosAgrupados" :key="grupo.categoria" class="grupo-categoria">
        <p class="categoria-titulo">{{ grupo.categoria }}</p>
        <div class="produtos-grid">
          <div v-for="produto in grupo.itens" :key="produto.id" class="produto-card" @click="adicionarItem(produto)">
            <p class="nome">{{ produto.nome }}</p>
            <p class="preco">R$ {{ produto.preco.toFixed(2) }}</p>
            <span class="setor" :class="produto.setor_impressao">{{ produto.setor_impressao }}</span>
          </div>
        </div>
      </div>
    </aside>

    <section class="resumo">
      <p class="titulo">Comanda #{{ mesaNumero ?? mesaId }}</p>

      <div class="total-linha">
        <span>Subtotal</span>
        <span>R$ {{ totalGeral.toFixed(2) }}</span>
      </div>

      <div v-if="descontoAplicado > 0" class="total-linha desconto-linha">
        <span>Desconto</span>
        <span>-R$ {{ descontoAplicado.toFixed(2) }}</span>
      </div>

      <div class="total-linha total-final">
        <span>Total</span>
        <span>R$ {{ totalComDesconto.toFixed(2) }}</span>
      </div>

      <div class="itens">
        <p v-if="!itensExistentes.length && !itensPendentes.length" class="vazio">
          Nenhum item lançado ainda.
        </p>

        <template v-if="itensExistentes.length">
          <p class="subtitulo">Já enviados</p>
          <div v-for="item in itensExistentes" :key="item.id" class="item-linha">
            <span>{{ item.quantidade }}x {{ item.produto_nome }}</span>
            <span>R$ {{ (item.preco_unitario * item.quantidade).toFixed(2) }}</span>
            <button v-if="podeCancelar" class="cancelar" @click="cancelarItem(item)">✕</button>
          </div>
        </template>

        <template v-if="podeAdicionarItens && itensPendentes.length">
          <p class="subtitulo">Ainda não enviados</p>
          <div v-for="(item, i) in itensPendentes" :key="i" class="item-linha">
            <span>{{ item.quantidade }}x {{ item.nome }}</span>
            <span>R$ {{ (item.preco * item.quantidade).toFixed(2) }}</span>
            <button class="cancelar" @click="removerPendente(i)">✕</button>
          </div>
        </template>
      </div>

      <button v-if="podeAdicionarItens" class="enviar" :disabled="itensPendentes.length === 0 || processando" @click="enviarPedido">
        {{ labelEnviar }}
      </button>

      <!-- Desconto (admin/caixa) -->
      <div v-if="podeCancelar && itensExistentes.length" class="secao-desconto">
        <p class="subtitulo">Desconto</p>
        <div class="form-inline">
          <span class="prefixo-moeda">R$</span>
          <input v-model.number="desconto.valor" type="number" min="0" step="0.01" placeholder="0,00" />
          <button :disabled="processando" @click="aplicarDesconto">Aplicar</button>
          <button v-if="descontoAplicado > 0" class="btn-limpar" :disabled="processando" @click="removerDesconto">Remover</button>
        </div>
      </div>

      <button class="imprimir" :disabled="processando || !itensExistentes.length" @click="mostrarPreviaConta = true">Imprimir conta</button>

      <!-- Fechamento: um único fluxo, dentro de um modal, cobre tanto o pagamento
           simples (uma forma, valor cheio) quanto a conta dividida em várias partes. -->
      <div v-if="podeCancelar && itensExistentes.length" class="secao-fechar">
        <button class="fechar" :disabled="processando" @click="abrirFechamento">Fechar mesa</button>
      </div>

      <!-- Modal de pré-visualização da pré-conta antes de mandar pra impressora -->
      <div v-if="mostrarPreviaConta" class="modal-backdrop" @click.self="mostrarPreviaConta = false">
        <div class="modal modal-previa">
          <h3>Pré-conta — Mesa {{ mesaNumero ?? mesaId }}</h3>
          <div class="previa-itens">
            <div v-for="item in itensExistentes" :key="item.id" class="previa-linha">
              <span>{{ item.quantidade }}x {{ item.produto_nome }}</span>
              <span>R$ {{ (item.preco_unitario * item.quantidade).toFixed(2) }}</span>
            </div>
          </div>
          <div class="total-linha">
            <span>Subtotal</span>
            <span>R$ {{ totalGeral.toFixed(2) }}</span>
          </div>
          <div v-if="descontoAplicado > 0" class="total-linha desconto-linha">
            <span>Desconto</span>
            <span>-R$ {{ descontoAplicado.toFixed(2) }}</span>
          </div>
          <div class="total-linha total-final">
            <span>Total</span>
            <span>R$ {{ totalComDesconto.toFixed(2) }}</span>
          </div>
          <p class="modal-aviso">Confere os itens acima antes de mandar pra impressora do bar.</p>
          <div class="modal-actions">
            <button @click="mostrarPreviaConta = false">Cancelar</button>
            <button class="btn-salvar" :disabled="processando" @click="imprimirConta">Confirmar e imprimir</button>
          </div>
        </div>
      </div>

      <!-- Modal de fechamento: registra pagamento(s) e confirma o fechamento da mesa -->
      <div v-if="mostrarFechamento" class="modal-backdrop" @click.self="mostrarFechamento = false">
        <div class="modal modal-fechamento">
          <template v-if="etapaFechamento === 'pagamento'">
            <h3>Fechar mesa {{ mesaNumero ?? mesaId }}</h3>

            <div class="fechamento-status">
              <div class="fechamento-status-linha">
                <span>Total da conta</span>
                <span>R$ {{ totalComDesconto.toFixed(2) }}</span>
              </div>
              <div v-if="totalPago > 0" class="fechamento-status-linha">
                <span>Já pago</span>
                <span>R$ {{ totalPago.toFixed(2) }}</span>
              </div>
              <div class="fechamento-status-linha restante" :class="{ zerado: restante <= 0.01 }">
                <span>Falta pagar</span>
                <span>R$ {{ restante.toFixed(2) }}</span>
              </div>
            </div>

            <div v-if="pagamentos.length" class="lista-pagamentos">
              <div v-for="p in pagamentos" :key="p.id" class="pagamento-linha">
                <span>{{ formaIcone(p.forma_pagamento) }} {{ formaLabel(p.forma_pagamento) }}</span>
                <span>R$ {{ p.valor.toFixed(2) }}</span>
                <button class="cancelar" :disabled="processando" @click="removerPagamento(p)">✕</button>
              </div>
            </div>

            <template v-if="restante > 0.01">
              <button v-if="!mostrarDivisao" class="link-dividir" type="button" @click="mostrarDivisao = true">
                Dividir essa conta entre várias pessoas?
              </button>
              <div v-else class="form-inline dividir-pessoas">
                <input v-model.number="numeroPessoasDivisao" type="number" min="1" placeholder="Nº de pessoas" />
                <span v-if="valorPorPessoa > 0" class="valor-por-pessoa">R$ {{ valorPorPessoa.toFixed(2) }} cada</span>
                <button v-if="valorPorPessoa > 0" type="button" @click="preencherValorDividido">Usar valor</button>
              </div>

              <label class="label-valor" for="valor-pagamento">Valor deste pagamento</label>
              <div class="form-inline">
                <span class="prefixo-moeda">R$</span>
                <input
                  id="valor-pagamento"
                  v-model.number="novoPagamento.valor"
                  type="number"
                  min="0"
                  step="0.01"
                  :placeholder="restante.toFixed(2)"
                />
              </div>

              <p class="modal-instrucao">Forma de pagamento:</p>
              <div class="formas-pagamento">
                <button
                  v-for="f in formasPagamento"
                  :key="f.valor"
                  class="forma-btn"
                  :disabled="processando"
                  @click="registrarPagamentoModal(f.valor)"
                >
                  {{ f.icone }} {{ f.label }}
                </button>
              </div>
            </template>

            <div class="modal-actions">
              <button @click="mostrarFechamento = false">Cancelar</button>
            </div>
          </template>

          <template v-else>
            <h3>Confirmar fechamento</h3>
            <div class="lista-pagamentos">
              <div v-for="p in pagamentos" :key="p.id" class="pagamento-linha">
                <span>{{ formaIcone(p.forma_pagamento) }} {{ formaLabel(p.forma_pagamento) }}</span>
                <span>R$ {{ p.valor.toFixed(2) }}</span>
              </div>
            </div>
            <p class="modal-total">Total: R$ {{ totalComDesconto.toFixed(2) }}</p>
            <p class="modal-aviso">Confirma que o pagamento foi recebido e a mesa pode ser liberada?</p>
            <div class="modal-actions">
              <button @click="etapaFechamento = 'pagamento'">Voltar</button>
              <button class="btn-salvar" :disabled="processando" @click="fecharMesaFinal">Confirmar e fechar</button>
            </div>
          </template>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '../services/api';
import { conectarWebSocket } from '../services/ws';
import { useAuthStore } from '../stores/auth';

const props = defineProps(['mesaId', 'comandaId']);
const router = useRouter();
const auth = useAuthStore();

const produtos = ref([]);
const mesaNumero = ref(null);
const busca = ref('');
const itensPendentes = ref([]);
const itensExistentes = ref([]);
const processando = ref(false);
const podeCancelar = computed(() => ['admin', 'caixa'].includes(auth.usuario?.papel));
const podeAdicionarItens = computed(() => ['admin', 'garcom', 'caixa'].includes(auth.usuario?.papel));
const desconto = reactive({ tipo: 'valor', valor: 0 });

const pagamentos = ref([]);
const novoPagamento = reactive({ valor: null });
const numeroPessoasDivisao = ref(null);
const mostrarPreviaConta = ref(false);
const mostrarFechamento = ref(false);
const mostrarDivisao = ref(false);
const etapaFechamento = ref('pagamento');

const formasPagamento = [
  { valor: 'dinheiro', label: 'Dinheiro', icone: '💵' },
  { valor: 'cartao_credito', label: 'Crédito', icone: '💳' },
  { valor: 'cartao_debito', label: 'Débito', icone: '💳' },
  { valor: 'pix', label: 'PIX', icone: '📱' },
];
function formaLabel(valor) {
  return formasPagamento.find((f) => f.valor === valor)?.label || valor;
}
function formaIcone(valor) {
  return formasPagamento.find((f) => f.valor === valor)?.icone || '';
}

let ws = null;
let intervaloSeguranca = null;

const totalPendente = computed(() =>
  itensPendentes.value.reduce((soma, item) => soma + item.preco * item.quantidade, 0)
);
const totalExistente = computed(() =>
  itensExistentes.value.reduce((soma, item) => soma + item.preco_unitario * item.quantidade, 0)
);
const totalGeral = computed(() => totalExistente.value + totalPendente.value);

const SETOR_LABEL = { cozinha: 'cozinha', bar: 'bar' };
const labelEnviar = computed(() => {
  const setores = [...new Set(itensPendentes.value.map((i) => i.setor))];
  if (setores.length !== 1) return 'Enviar para cozinha e bar';
  return `Enviar para ${SETOR_LABEL[setores[0]] || setores[0]}`;
});

const descontoAplicado = computed(() => (desconto.valor > 0 ? desconto.valor : 0));
const totalComDesconto = computed(() => Math.max(0, totalGeral.value - descontoAplicado.value));

const totalPago = computed(() => pagamentos.value.reduce((soma, p) => soma + p.valor, 0));
const restante = computed(() => Math.max(0, totalComDesconto.value - totalPago.value));

const valorPorPessoa = computed(() => {
  if (!numeroPessoasDivisao.value || numeroPessoasDivisao.value < 1) return 0;
  return totalComDesconto.value / numeroPessoasDivisao.value;
});
function preencherValorDividido() {
  novoPagamento.valor = Number(valorPorPessoa.value.toFixed(2));
}

async function carregarProdutos() {
  const { data } = await api.get('/produtos');
  produtos.value = data;
}

// NFD separa a letra do acento em dois pontos de código (ex: "é" -> "e" + "´");
// descartar os pontos de código de marcas combinantes (0x0300–0x036f) deixa só a letra.
function normalizar(texto) {
  return Array.from(texto.normalize('NFD'))
    .filter((ch) => ch.codePointAt(0) < 0x0300 || ch.codePointAt(0) > 0x036f)
    .join('')
    .toLowerCase();
}

const produtosAgrupados = computed(() => {
  const termo = normalizar(busca.value.trim());
  const grupos = [];
  for (const produto of produtos.value) {
    if (termo && !normalizar(produto.nome).includes(termo)) continue;
    const categoria = (produto.categoria_nome || 'Outros').toUpperCase();
    let grupo = grupos.find((g) => g.categoria === categoria);
    if (!grupo) {
      grupo = { categoria, itens: [] };
      grupos.push(grupo);
    }
    grupo.itens.push(produto);
  }
  // "Serviços" (ex: aluguel de espaço) não é comida/bebida — sempre por último, fora da ordem alfabética.
  return [...grupos.filter((g) => g.categoria !== 'SERVIÇOS'), ...grupos.filter((g) => g.categoria === 'SERVIÇOS')];
});

async function carregarItensExistentes() {
  const { data } = await api.get(`/pedidos/comanda/${props.comandaId}`);
  itensExistentes.value = data;
}

async function carregarDesconto() {
  const { data } = await api.get('/mesas');
  const mesa = data.find(m => m.id === Number(props.mesaId));
  mesaNumero.value = mesa?.numero ?? null;
  if (mesa?.comanda?.desconto_valor > 0) {
    desconto.valor = mesa.comanda.desconto_valor;
  }
}

async function carregarPagamentos() {
  const { data } = await api.get(`/mesas/${props.mesaId}/pagamentos`);
  pagamentos.value = data.pagamentos;
}

function adicionarItem(produto) {
  if (!window.confirm(`Adicionar 1x ${produto.nome}?`)) return;

  const existente = itensPendentes.value.find((i) => i.produto_id === produto.id);
  if (existente) {
    existente.quantidade += 1;
  } else {
    itensPendentes.value.push({
      produto_id: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      quantidade: 1,
      setor: produto.setor_impressao,
    });
  }
}

function removerPendente(indice) {
  itensPendentes.value.splice(indice, 1);
}

async function cancelarItem(item) {
  if (!window.confirm(`Remover ${item.quantidade}x ${item.produto_nome}?`)) return;
  await api.delete(`/pedidos/itens/${item.id}`);
  await carregarItensExistentes();
}

async function enviarPedido() {
  processando.value = true;
  try {
    await api.post('/pedidos', {
      comanda_id: props.comandaId,
      itens: itensPendentes.value.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade })),
    });
    itensPendentes.value = [];
    await carregarItensExistentes();
  } finally {
    processando.value = false;
  }
}

async function imprimirConta() {
  processando.value = true;
  try {
    await api.post(`/mesas/${props.mesaId}/imprimir-conta`);
    mostrarPreviaConta.value = false;
  } finally {
    processando.value = false;
  }
}

async function aplicarDesconto() {
  processando.value = true;
  try {
    await api.post(`/mesas/${props.mesaId}/desconto`, { tipo: desconto.tipo, valor: desconto.valor });
  } finally {
    processando.value = false;
  }
}

async function removerDesconto() {
  desconto.valor = 0;
  processando.value = true;
  try {
    await api.post(`/mesas/${props.mesaId}/desconto`, { valor: 0 });
  } finally {
    processando.value = false;
  }
}

async function registrarPagamentoModal(forma) {
  const valor = novoPagamento.valor > 0 ? novoPagamento.valor : restante.value;
  processando.value = true;
  try {
    await api.post(`/mesas/${props.mesaId}/pagamento`, { forma_pagamento: forma, valor });
    novoPagamento.valor = null;
    await carregarPagamentos();
    if (restante.value <= 0.01) etapaFechamento.value = 'confirmar';
  } catch (e) {
    alert(e.response?.data?.erro || 'Erro ao registrar pagamento');
  } finally {
    processando.value = false;
  }
}

async function removerPagamento(pagamento) {
  if (!window.confirm(`Remover pagamento de R$ ${pagamento.valor.toFixed(2)} (${formaLabel(pagamento.forma_pagamento)})?`)) return;
  processando.value = true;
  try {
    await api.delete(`/mesas/${props.mesaId}/pagamento/${pagamento.id}`);
    await carregarPagamentos();
    if (restante.value > 0.01) etapaFechamento.value = 'pagamento';
  } finally {
    processando.value = false;
  }
}

function abrirFechamento() {
  mostrarDivisao.value = false;
  numeroPessoasDivisao.value = null;
  novoPagamento.valor = null;
  etapaFechamento.value = restante.value <= 0.01 ? 'confirmar' : 'pagamento';
  mostrarFechamento.value = true;
}

async function fecharMesaFinal() {
  if (!window.confirm(`Confirma o fechamento da mesa ${mesaNumero.value ?? mesaId}? Essa ação não pode ser desfeita.`)) return;
  processando.value = true;
  try {
    await api.post(`/mesas/${props.mesaId}/fechar`);
    router.push('/');
  } catch (e) {
    alert(e.response?.data?.erro || 'Erro ao fechar mesa');
  } finally {
    processando.value = false;
  }
}

onMounted(() => {
  carregarProdutos();
  carregarItensExistentes();
  carregarDesconto();
  carregarPagamentos();
  ws = conectarWebSocket((msg) => {
    if (['pedido_criado', 'item_atualizado', 'item_removido'].includes(msg.tipo)) carregarItensExistentes();
  });
  // Poll de segurança bem espaçado, caso o WebSocket fique indisponível por muito tempo
  intervaloSeguranca = setInterval(carregarItensExistentes, 30000);
});
onUnmounted(() => {
  ws?.fechar();
  clearInterval(intervaloSeguranca);
});
</script>

<style scoped>
.comanda-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 16px;
}
.comanda-layout.somente-leitura {
  grid-template-columns: 1fr;
  max-width: 420px;
}
.produtos {
  display: flex;
  flex-direction: column;
  gap: 20px;
  align-content: start;
}
.busca-wrapper {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  background: white;
  border: 1.5px solid #e0e0e0;
  border-radius: 10px;
  padding: 0 12px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.busca-wrapper:focus-within {
  border-color: #0f6e56;
  box-shadow: 0 0 0 3px rgba(15, 110, 86, 0.12);
}
.busca-icone {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: #999;
}
.busca-produto {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  padding: 12px 8px;
  font-size: 14px;
  min-width: 0;
}
.busca-produto::-webkit-search-cancel-button { display: none; }
.busca-limpar {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 13px;
  padding: 4px;
  line-height: 1;
  flex-shrink: 0;
}
.busca-limpar:hover { color: #666; }
.categoria-titulo {
  font-size: 12px;
  color: #888;
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.produtos-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}
.produto-card {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.1s;
}
.produto-card:hover { border-color: #999; }
.produto-card:active { transform: scale(0.97); }
.nome { font-weight: 500; margin: 0 0 4px; font-size: 14px; }
.preco { color: #666; font-size: 13px; margin: 0 0 8px; }
.setor {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 6px;
}
.setor.cozinha { background: #faeeda; color: #854f0b; }
.setor.bar { background: #e6f1fb; color: #185fa5; }

.resumo {
  background: #f1efe8;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  position: sticky;
  top: 16px;
  align-self: start;
  max-height: calc(100vh - 32px);
  overflow-y: auto;
}
.titulo { font-weight: 500; margin: 0 0 12px; }
.itens { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.vazio { color: #999; font-size: 13px; }
.subtitulo { font-size: 12px; color: #888; margin: 8px 0 0; text-transform: uppercase; letter-spacing: 0.03em; }
.item-linha { display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 13px; }
.item-linha .cancelar {
  background: none; border: none; color: #a03a3a; cursor: pointer; padding: 0 2px;
  font-size: 13px; line-height: 1;
}
.total-linha {
  display: flex; justify-content: space-between; font-weight: 500;
  border-top: 1px solid #ddd; margin-top: 12px; padding-top: 12px;
}
.enviar {
  margin-top: 12px; background: #1a1a1a; color: white; border: none; padding: 10px;
}
.enviar:disabled { opacity: 0.4; cursor: not-allowed; }
.imprimir {
  margin-top: 8px; background: white; color: #1a1a1a; border: 1px solid #ccc; padding: 10px;
}
.desconto-linha { color: #0f6e56; }
.total-final { font-size: 16px; }

.secao-desconto { margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd; }
.form-inline { display: flex; gap: 6px; align-items: center; }
.prefixo-moeda { font-size: 13px; color: #666; }
.form-inline input { padding: 6px; border-radius: 6px; border: 1px solid #ccc; font-size: 13px; width: 70px; }
.form-inline button { font-size: 12px; padding: 6px 10px; }
.btn-limpar { color: #a03a3a; border-color: #e0b4b4; }

.secao-fechar { margin-top: 12px; padding-top: 12px; border-top: 1px solid #ddd; }
.formas-pagamento { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin: 6px 0 4px; }
.forma-btn {
  padding: 10px; font-size: 13px; text-align: center; border-radius: 8px;
  border: 1px solid #ccc; background: white; cursor: pointer; transition: all 0.15s;
}
.forma-btn:hover:not(:disabled) { border-color: #0f6e56; }
.forma-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.fechar {
  width: 100%; margin-top: 4px; background: #0f6e56; color: white; border: none; padding: 10px; font-size: 13px;
}
.fechar:disabled { opacity: 0.4; cursor: not-allowed; }

.modal-fechamento { width: 320px; }
.fechamento-status {
  background: #f7f6f2; border-radius: 10px; padding: 10px 12px; display: flex;
  flex-direction: column; gap: 4px; margin-bottom: 4px;
}
.fechamento-status-linha { display: flex; justify-content: space-between; font-size: 13px; }
.fechamento-status-linha.restante { font-weight: 600; }
.fechamento-status-linha.restante.zerado { color: #0f6e56; }
.lista-pagamentos { display: flex; flex-direction: column; gap: 6px; margin-bottom: 4px; }
.pagamento-linha {
  display: flex; justify-content: space-between; align-items: center; gap: 8px;
  font-size: 13px; background: #f7f6f2; border-radius: 8px; padding: 6px 10px;
}
.pagamento-linha .cancelar {
  background: none; border: none; color: #a03a3a; cursor: pointer; padding: 0 2px; font-size: 13px;
}
.link-dividir {
  align-self: flex-start; background: none; border: none; color: #0f6e56; font-size: 13px;
  cursor: pointer; padding: 4px 0; text-decoration: underline;
}
.dividir-pessoas input { flex: 1; min-width: 0; }
.valor-por-pessoa { font-size: 13px; font-weight: 500; color: #0f6e56; white-space: nowrap; }
.label-valor { font-size: 12px; color: #666; margin: 4px 0 -2px; }

.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1001;
  display: flex; align-items: center; justify-content: center;
}
.modal {
  background: white; border-radius: 12px; padding: 20px; width: 300px; max-width: calc(100vw - 32px);
  display: flex; flex-direction: column; gap: 8px;
}
.modal h3 { margin: 0 0 4px; font-size: 16px; }
.modal-previa { width: 340px; }
.previa-itens { max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; margin: 4px 0; }
.previa-linha { display: flex; justify-content: space-between; font-size: 13px; color: #444; }
.modal-total { font-size: 15px; font-weight: 600; margin: 0 0 12px; }
.modal-instrucao { font-size: 13px; color: #666; margin: 0 0 8px; }
.modal-aviso { font-size: 13px; color: #666; margin: 0 0 8px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
.btn-salvar { background: #0f6e56; color: white; border: none; }

@media (max-width: 860px) {
  .container { padding: 12px; }
  .comanda-layout {
    grid-template-columns: 1fr;
  }
  .comanda-layout.somente-leitura { max-width: none; }
  .resumo { position: static; max-height: none; overflow-y: visible; order: -1; }
  .produtos-grid { grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); }
  .produto-card { padding: 14px 12px; }
  .busca-produto { font-size: 16px; }
  .item-linha, .pagamento-linha { font-size: 14px; }
  .enviar, .imprimir, .fechar {
    padding: 14px;
    font-size: 15px;
  }
  .forma-btn { padding: 12px; font-size: 13px; }
  .form-inline input { font-size: 16px; padding: 10px; }
}
</style>
