# market

Proxy somente leitura de cotações da B3 via [brapi.dev](https://brapi.dev/docs).

Não roda no GitHub Pages (somente estático). O build publicado não conhece
endereço de API e mostra as cotações como indisponíveis; ver
[publicação no GitHub Pages](../../../../../docs/architecture/github-pages.md#dependências-de-backend).

| Rota                          | Resposta                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GET /market/quotes/:ticker`  | `ticker`, `name`, `priceCents`, `previousCloseCents?`, `marketTime`, `history[{date, closeCents}]`, `fetchedAt`, `stale` |
| `GET /market/tickers?search=` | `results[{ticker, name, type}]` (ações e fundos)                                                                         |

- `BRAPI_TOKEN` (opcional) fica só no servidor e vai no header `Authorization`.
  Sem ele, a fonte atende apenas PETR4, MGLU3, VALE3 e ITUB4.
- `BRAPI_BASE_URL` padrão `https://brapi.dev` (somente HTTPS).
- Cache em memória de 30 minutos por ticker, requisições compartilhadas, uma
  consulta por vez à fonte e espera de 5 minutos após falha, devolvendo a última
  resposta válida com `stale: true`. Buscas de tickers ficam 24 horas em cache;
  uma busca que falha também espera 5 minutos antes de nova consulta.
- Limites: cada cache (cotações, falhas, buscas e falhas de busca) guarda no
  máximo 500 entradas, descartando as menos usadas (LRU). Um orçamento de 120
  consultas à fonte por hora protege a cota do plano gratuito (~15.000 por mês);
  esgotado, a rota devolve a última cotação conhecida com `stale: true` ou 503.
  Cada cliente pode fazer até 60 requisições por minuto às rotas `/market`;
  acima disso, 429 com `Retry-After`. Sem dependências adicionais.
- Histórico: `range=3mo&interval=1d` (limite do plano gratuito). Valores em
  centavos; datas civis de São Paulo; nenhum ponto criado para dias sem pregão.
- Erros: 400 ticker ou busca inválidos; 404 não encontrado; 502 fonte
  indisponível (`unavailable`), acesso recusado pela fonte (`unauthorized`) ou
  resposta inválida da fonte, como JSON malformado ou outro ativo (`invalid`);
  503 limite da fonte ou do orçamento (`rate_limited`, com `Retry-After`); 429
  limite por cliente. Erros internos do aplicativo continuam 500, sem detalhes.
  A resposta nunca cita o token nem nomes de configuração; o aviso de acesso
  recusado vai apenas para o log do servidor. Nenhum dado de usuário é recebido
  ou guardado.
