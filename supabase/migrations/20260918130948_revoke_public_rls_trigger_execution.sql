-- La funzione è richiamata dall'event trigger interno; i ruoli API non devono
-- poterla invocare direttamente, soprattutto perché è SECURITY DEFINER.
revoke execute on function public.rls_auto_enable()
  from public, anon, authenticated;
