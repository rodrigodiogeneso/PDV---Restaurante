<template>
  <div class="loading-bar" v-if="ui.carregando"></div>

  <div v-if="ui.erro" class="erro-banner">
    <span>{{ ui.erro }}</span>
    <button @click="ui.limparErro">✕</button>
  </div>

  <nav v-if="auth.usuario && !auth.deveTrocarSenha" class="topnav">
    <router-link to="/">Mesas</router-link>
    <template v-if="auth.usuario.papel === 'admin'">
      <span class="divisor"></span>
      <router-link to="/gestao">Gestão</router-link>
      <router-link to="/relatorios">Relatórios</router-link>
      <router-link to="/auditoria">Auditoria</router-link>
    </template>
    <span class="spacer"></span>
    <span class="usuario">{{ auth.usuario.nome }}</span>
    <button class="sair" @click="sair">Sair</button>
  </nav>

  <router-view />
</template>

<script setup>
import { watch, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from './stores/auth';
import { useUiStore } from './stores/ui';
import { conectarWebSocket } from './services/ws';

const router = useRouter();
const auth = useAuthStore();
const ui = useUiStore();

const SETOR_LABEL = { cozinha: 'cozinha', bar: 'bar' };

let ws = null;

watch(
  () => auth.usuario,
  (usuario) => {
    ws?.fechar();
    ws = null;
    if (!usuario) return;

    ws = conectarWebSocket((msg) => {
      if (msg.tipo !== 'impressao_falhou') return;
      const { setor, mesa_numero } = msg.dados;
      ui.mostrarErro(`Falha ao imprimir na ${SETOR_LABEL[setor] || setor} (mesa ${mesa_numero}) — verifique a impressora.`);
    });
  },
  { immediate: true }
);

onUnmounted(() => ws?.fechar());

function sair() {
  auth.logout();
  router.push('/login');
}
</script>

<style scoped>
.loading-bar {
  position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 1000;
  background: linear-gradient(90deg, #0f6e56, #97c459, #0f6e56);
  background-size: 200% 100%;
  animation: deslizar 1.2s linear infinite;
}
@keyframes deslizar {
  0% { background-position: 0% 0; }
  100% { background-position: 200% 0; }
}
.erro-banner {
  position: fixed; top: 0; left: 0; right: 0; z-index: 999;
  background: #fcebeb; color: #a03a3a; font-size: 13px;
  padding: 10px 24px; display: flex; justify-content: space-between; align-items: center;
}
.erro-banner button {
  background: none; border: none; color: #a03a3a; cursor: pointer; font-size: 13px;
}
.topnav {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 24px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
.topnav a, .topnav .divisor, .topnav .sair { flex-shrink: 0; }
.topnav a {
  text-decoration: none;
  color: #333;
  font-size: 14px;
  font-weight: 500;
}
.topnav a.router-link-active {
  color: #0f6e56;
}
.divisor { width: 1px; align-self: stretch; background: #e0e0e0; }
.spacer { flex: 1; }
.usuario { font-size: 13px; color: #666; }
.sair {
  background: none; border: 1px solid #ccc; border-radius: 6px;
  padding: 4px 10px; font-size: 13px; cursor: pointer; color: #333;
}

@media (max-width: 700px) {
  .topnav { padding: 10px 12px; gap: 12px; }
  .usuario { display: none; }
  .erro-banner { padding: 10px 12px; font-size: 12px; }
}
</style>
