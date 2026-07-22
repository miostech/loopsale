// Alias público "Loop API" do webhook. Reaproveita o handler do n8n (mesma
// lógica, mesmo lookup de integração por platform "n8n"), sem expor a
// ferramenta ao cliente. O caminho /api/webhooks/n8n continua válido.
export { POST } from "../n8n/route";
