<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="entrar">
      <h1>Rancho Alegre</h1>
      <p class="subtitulo">Entre com seu usuário para continuar</p>

      <label>E-mail</label>
      <input v-model="email" type="email" required autofocus />

      <label>Senha</label>
      <input v-model="senha" type="password" required />

      <p v-if="erro" class="erro">{{ erro }}</p>

      <button type="submit" :disabled="enviando">
        {{ enviando ? 'Entrando...' : 'Entrar' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const email = ref('');
const senha = ref('');
const erro = ref('');
const enviando = ref(false);

const router = useRouter();
const auth = useAuthStore();

async function entrar() {
  erro.value = '';
  enviando.value = true;
  try {
    await auth.login(email.value, senha.value);
    router.push('/');
  } catch (e) {
    erro.value = e.response?.data?.erro || 'Não foi possível entrar. Tente novamente.';
  } finally {
    enviando.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1efe8;
  padding: 16px;
}
.login-card {
  background: white;
  border-radius: 12px;
  padding: 32px;
  width: 320px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}
h1 { font-size: 18px; margin: 0; }
.subtitulo { font-size: 13px; color: #666; margin: 0 0 12px; }
label { font-size: 13px; color: #444; margin-top: 8px; }
input { padding: 12px; border-radius: 8px; border: 1px solid #ccc; font-size: 16px; }
.erro { color: #a03a3a; font-size: 13px; margin: 4px 0 0; }
button {
  margin-top: 16px; background: #1a1a1a; color: white; border: none;
  padding: 10px; border-radius: 8px; cursor: pointer; font-size: 14px;
}
button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
