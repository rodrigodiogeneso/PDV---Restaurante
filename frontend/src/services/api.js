import axios from 'axios';
import { useUiStore } from '../stores/ui';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pdv_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  useUiStore().iniciarRequisicao();
  return config;
});

api.interceptors.response.use(
  (response) => {
    useUiStore().finalizarRequisicao();
    return response;
  },
  (erro) => {
    useUiStore().finalizarRequisicao();

    const isLogin = erro.config?.url?.includes('/auth/login');
    if (erro.response?.status === 401 && !isLogin) {
      localStorage.removeItem('pdv_token');
      localStorage.removeItem('pdv_usuario');
      if (location.pathname !== '/login') location.href = '/login';
    } else if (!isLogin) {
      const mensagem = erro.response?.data?.erro || 'Erro de conexão com o servidor.';
      useUiStore().mostrarErro(mensagem);
    }

    return Promise.reject(erro);
  }
);

export default api;
