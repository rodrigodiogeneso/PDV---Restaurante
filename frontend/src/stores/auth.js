import { defineStore } from 'pinia';
import api from '../services/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('pdv_token') || null,
    usuario: JSON.parse(localStorage.getItem('pdv_usuario') || 'null'),
  }),
  actions: {
    async login(email, senha) {
      const { data } = await api.post('/auth/login', { email, senha });
      this.token = data.token;
      this.usuario = data.usuario;
      localStorage.setItem('pdv_token', data.token);
      localStorage.setItem('pdv_usuario', JSON.stringify(data.usuario));
    },
    logout() {
      this.token = null;
      this.usuario = null;
      localStorage.removeItem('pdv_token');
      localStorage.removeItem('pdv_usuario');
    },
  },
});
