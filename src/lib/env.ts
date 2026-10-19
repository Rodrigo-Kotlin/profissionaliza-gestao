import { environment, isDevelopment } from '@/config/environment'

/**
 * Ambiente de execução da aplicação, injetado via `VITE_APP_ENV`.
 * Os únicos valores válidos são `development` e `production`.
 */
export const APP_ENVIRONMENT = environment

/** True somente no ambiente local de desenvolvimento. */
export const isDevEnvironment = isDevelopment
