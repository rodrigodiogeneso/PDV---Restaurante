import { defineStore } from 'pinia';
import api from '../services/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('pdv_token') || null,
    usuario: JSON.parse(localStorage.getItem('pdv_usuario') || 'null'),
    deveTrocarSenha: localStorage.getItem('pdv_deve_trocar_senha') === 'true',
  }),
  actions: {
    async login(email, senha) {
      const { data } = await api.post('/auth/login', { email, senha });
      this.token = data.token;
      this.usuario = data.usuario;
      this.deveTrocarSenha = Boolean(data.deve_trocar_senha);
      localStorage.setItem('pdv_token', data.token);
      localStorage.setItem('pdv_usuario', JSON.stringify(data.usuario));
      localStorage.setItem('pdv_deve_trocar_senha', String(this.deveTrocarSenha));
    },
    marcarSenhaTrocada() {
      this.deveTrocarSenha = false;
      localStorage.setItem('pdv_deve_trocar_senha', 'false');
    },
    logout() {
      this.token = null;
      this.usuario = null;
      this.deveTrocarSenha = false;
      localStorage.removeItem('pdv_token');
      localStorage.removeItem('pdv_usuario');
      localStorage.removeItem('pdv_deve_trocar_senha');
    },
  },
});
