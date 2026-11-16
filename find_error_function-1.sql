
SELECT proname, prosrc
FROM pg_proc
WHERE prosrc LIKE '%Não é possível alterar um contrato já quitado ou cancelado%';
