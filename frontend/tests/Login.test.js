import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import Login from '../src/views/Login.vue';
import api from '../src/services/api';

const push = vi.fn();

vi.mock('vue-router', () => ({
  useRouter: () => ({ push }),
}));

vi.mock('../src/services/api', () => ({
  default: { post: vi.fn() },
}));

describe('Login.vue', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    push.mockClear();
    api.post.mockReset();
    localStorage.clear();
  });

  it('faz login com sucesso e redireciona para a home', async () => {
    api.post.mockResolvedValueOnce({
      data: { token: 'abc123', usuario: { id: 1, nome: 'Admin', papel: 'admin' } },
    });

    const wrapper = mount(Login);
    await wrapper.find('input[type="email"]').setValue('admin@restaurante.local');
    await wrapper.find('input[type="password"]').setValue('admin123');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'admin@restaurante.local',
      senha: 'admin123',
    });
    expect(push).toHaveBeenCalledWith('/');
    expect(localStorage.getItem('pdv_token')).toBe('abc123');
  });

  it('mostra mensagem de erro quando as credenciais são inválidas', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { erro: 'Credenciais inválidas' } } });

    const wrapper = mount(Login);
    await wrapper.find('input[type="email"]').setValue('admin@restaurante.local');
    await wrapper.find('input[type="password"]').setValue('errada');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(wrapper.text()).toContain('Credenciais inválidas');
    expect(push).not.toHaveBeenCalled();
  });
});
