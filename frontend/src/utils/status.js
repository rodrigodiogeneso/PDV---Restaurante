export const STATUS_LABELS = {
  pendente: 'Pendente',
  preparando: 'Preparando',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}
