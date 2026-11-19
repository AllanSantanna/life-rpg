# market

Proxy somente leitura de cotações da B3 via [brapi.dev](https://brapi.dev/docs).

| Rota                          | Resposta                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GET /market/quotes/:ticker`  | `ticker`, `name`, `priceCents`, `previousCloseCents?`, `marketTime`, `history[{date, closeCents}]`, `fetchedAt`, `stale` |
| `GET /market/tickers?search=` | `results[{ticker, name, type}]` (ações e fundos)                                                                         |

- `BRAPI_TOKEN` (opcional) fica só no servidor e vai no header `Authorization`.
  Sem ele, a fonte atende apenas PETR4, MGLU3, VALE3 e ITUB4.
- `BRAPI_BASE_URL` padrão `https://brapi.dev` (somente HTTPS).
- Cache em memória de 30 minutos por ticker, requisições compartilhadas, uma
  consulta por vez à fonte e espera de 5 minutos após falha, devolvendo a última
  resposta válida com `stale: true`.
- Histórico: `range=3mo&interval=1d` (limite do plano gratuito). Valores em
  centavos; datas civis de São Paulo; nenhum ponto criado para dias sem pregão.
- Erros: 400 ticker inválido, 404 não encontrado, 502 fonte indisponível ou token
  exigido, 503 limite atingido. Nenhum dado de usuário é recebido ou guardado.
