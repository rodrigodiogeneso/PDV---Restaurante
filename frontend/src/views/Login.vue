<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="entrar">
      <div class="login-topo">
        <h1>Rancho Alegre</h1>
        <p class="subtitulo">Entre com seu usuário para continuar</p>
      </div>

      <div class="campo">
        <label>E-mail</label>
        <input v-model="email" type="email" required autofocus />
      </div>

      <div class="campo">
        <label>Senha</label>
        <input v-model="senha" type="password" required />
      </div>

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
  background: linear-gradient(160deg, #cfe8f7 0%, #a9d4ee 45%, #8dc3e6 100%);
  padding: 16px;
}
.login-card {
  background: white;
  border-radius: 16px;
  border-top: 4px solid #2f8fce;
  padding: 40px 32px 32px;
  width: 340px;
  max-width: 100%;
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-shadow: 0 12px 36px rgba(30, 90, 130, 0.18);
}
.login-topo { text-align: center; display: flex; flex-direction: column; gap: 6px; }
h1 { font-size: 21px; margin: 0; color: #16496b; }
.subtitulo { font-size: 13px; color: #666; margin: 0; }
.campo { display: flex; flex-direction: column; gap: 6px; }
label { font-size: 12px; color: #555; font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; }
input {
  padding: 12px 14px; border-radius: 9px; border: 1.5px solid #d8e4ec; font-size: 16px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
input:focus { outline: none; border-color: #2f8fce; box-shadow: 0 0 0 3px rgba(47, 143, 206, 0.15); }
.erro { color: #a03a3a; font-size: 13px; margin: -8px 0 0; background: #fcebeb; padding: 8px 10px; border-radius: 8px; }
button {
  margin-top: 4px; background: #2f8fce; color: white; border: none;
  padding: 13px; border-radius: 9px; cursor: pointer; font-size: 15px; font-weight: 500;
  transition: background 0.15s;
}
button:hover:not(:disabled) { background: #24709f; }
button:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
