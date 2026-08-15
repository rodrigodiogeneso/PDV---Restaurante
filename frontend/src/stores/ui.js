import { defineStore } from 'pinia';

export const useUiStore = defineStore('ui', {
  state: () => ({ erro: null, requisicoesAtivas: 0, falhaImpressaoVersao: 0 }),
  getters: {
    carregando: (state) => state.requisicoesAtivas > 0,
  },
  actions: {
    mostrarErro(mensagem) {
      this.erro = mensagem;
    },
    limparErro() {
      this.erro = null;
    },
    notificarFalhaImpressao() {
      this.falhaImpressaoVersao += 1;
    },
    iniciarRequisicao() {
      this.requisicoesAtivas += 1;
    },
    finalizarRequisicao() {
      this.requisicoesAtivas = Math.max(0, this.requisicoesAtivas - 1);
    },
  },
});
