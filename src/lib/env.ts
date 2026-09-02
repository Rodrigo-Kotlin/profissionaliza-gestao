const APP_ENV = (import.meta.env.VITE_APP_ENV ?? 'development').toLowerCase()

/**
 * Ambiente de execução da aplicação, injetado via `VITE_APP_ENV`.
 * `development` é o valor padrão (DEV/homologação). Produção futura deve usar
 * `VITE_APP_ENV=production`, sem alteração de código.
 */
export const APP_ENVIRONMENT = APP_ENV

/** True quando rodando em DEV/homologação (usado para indicador visual discreto). */
export const isDevEnvironment = APP_ENV === 'development' || APP_ENV === 'dev' || APP_ENV === 'staging' || APP_ENV === 'preview'