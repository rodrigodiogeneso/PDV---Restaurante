import { createRouter, createWebHistory } from 'vue-router';
import MapaMesas from '../views/MapaMesas.vue';
import Comanda from '../views/Comanda.vue';
import Kds from '../views/Kds.vue';
import Login from '../views/Login.vue';
import TrocarSenha from '../views/TrocarSenha.vue';
import Gestao from '../views/Gestao.vue';
import Relatorios from '../views/Relatorios.vue';
import Auditoria from '../views/Auditoria.vue';
import { useAuthStore } from '../stores/auth';

const routes = [
  { path: '/login', component: Login },
  { path: '/trocar-senha', component: TrocarSenha },
  { path: '/', component: MapaMesas },
  { path: '/mesa/:mesaId/comanda/:comandaId', component: Comanda, props: true },
  { path: '/kds/:setor', component: Kds, props: true },
  { path: '/gestao', component: Gestao, meta: { papeis: ['admin'] } },
  { path: '/relatorios', component: Relatorios, meta: { papeis: ['admin', 'caixa'] } },
  { path: '/auditoria', component: Auditoria, meta: { papeis: ['admin'] } },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  if (to.path !== '/login' && !auth.token) return '/login';
  if (to.path === '/login' && auth.token) return '/';
  if (auth.token && auth.deveTrocarSenha && to.path !== '/trocar-senha') return '/trocar-senha';
  if (to.path === '/trocar-senha' && !auth.deveTrocarSenha && auth.token) return '/';
  if (to.meta.papeis && !to.meta.papeis.includes(auth.usuario?.papel)) return '/';
});

export default router;
