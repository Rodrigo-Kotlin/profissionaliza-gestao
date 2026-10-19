-- -----------------------------------------------------------------------------
-- Phase 2.7C: restrict trigger-only functions to trigger execution
-- -----------------------------------------------------------------------------
-- These functions are not RPC endpoints. They are invoked only by their
-- database triggers and must not remain executable by API roles.
revoke execute on function public.guard_contract_document_mutation() from public, anon, authenticated;
revoke execute on function public.guard_contract_execution_mutation() from public, anon, authenticated;
