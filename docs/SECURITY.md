# Platform Security

## Fase 2.7D

Esta fase cobre hosting, headers, CORS, Storage, RLS, Auth, secrets,
backup/restore e observabilidade. Não altera regras de negócio nem aplica
Force RLS globalmente.

### CORS

As quatro Edge Functions documentais usam `supabase/functions/_shared/cors.ts`.
As origens permitidas são:

- `https://profissionaliza-gestao.pages.dev`
- previews de uma única etiqueta em `*.profissionaliza-gestao.pages.dev`

Origens desconhecidas, domínios parecidos, HTTP e subdomínios aninhados são
rejeitados com `403`. Requests sem `Origin` continuam permitidos para uso
server-to-server, mas não recebem `Access-Control-Allow-Origin`.

### Headers

`public/_headers` versiona `Content-Security-Policy`, `Permissions-Policy`,
`X-Content-Type-Options`, `Referrer-Policy` e `X-Frame-Options`. A CSP permite
somente recursos próprios, Google Fonts, Supabase e ViaCEP usados pelo app.
HSTS não é versionado sem confirmação de `includeSubDomains` no domínio; deve
ser configurado no Cloudflare após confirmar que todos os subdomínios são HTTPS.

### Storage

`contract-documents` é privado e backend-only. As funções usam a secret
`SUPABASE_SECRET_KEYS` e emitem signed URLs temporárias após autorização RPC.
Não devem ser criadas policies permissivas para `authenticated` nem acesso
direto pelo browser.

### Force RLS

As tabelas core têm RLS habilitado, mas Force RLS não foi aplicado. A maioria
das RPCs documentais e de domínio é `SECURITY DEFINER` com `row_security = off`;
habilitar Force RLS exige matriz de compatibilidade e testes de autorização
antes de qualquer migration.

### Legacy secret

O secret remoto `SUPABASE_SERVICE_ROLE_KEY` ainda existe. O código pesquisado
usa `SUPABASE_SECRET_KEYS.default`, sem referência ativa à chave legacy. Sua
remoção/rotação requer aprovação humana e smoke autenticado posterior.

### Auth, backup e observabilidade

- Signup público deve permanecer desabilitado/restrito para o sistema institucional.
- Site URL e redirects devem ser exact-match para Production, localhost local e previews realmente usados.
- RPO/RTO inicial proposto: RPO 24h e RTO 8h, até confirmação do plano Supabase.
- Restore real não deve ocorrer em Production; executar apenas em projeto isolado, com checklist de schema, Auth, Storage, RPCs e smoke.
- Monitorar erros frontend, falhas Auth, erros das Edge Functions, deploys, migrations e fluxo documental.
