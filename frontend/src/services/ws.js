// Conecta ao canal de eventos em tempo real do backend, com reconexão automática.
// O token JWT é enviado na query string para autenticação.
export function conectarWebSocket(onMensagem) {
  let socket;
  let fechadoPeloChamador = false;

  function abrir() {
    const token = localStorage.getItem('pdv_token');
    if (!token) return; // sem login, não conecta
    const protocolo = location.protocol === 'https:' ? 'wss' : 'ws';
    socket = new WebSocket(`${protocolo}://${location.host}/ws?token=${token}`);

    socket.onmessage = (evento) => {
      try {
        onMensagem(JSON.parse(evento.data));
      } catch {
        // ignora mensagem inválida
      }
    };

    socket.onclose = () => {
      if (!fechadoPeloChamador) setTimeout(abrir, 3000);
    };
  }

  abrir();

  return {
    fechar() {
      fechadoPeloChamador = true;
      socket.close();
    },
  };
}
