-- Publicações por advogado cadastrado: separa UF e número da OAB no cadastro.
-- O DJEN aceita numeroOab + ufOab; manter os valores separados evita captura ampla.
-- Idempotente: pode ser executada quantas vezes for necessário.

BEGIN;

ALTER TABLE public.lawyers
  ADD COLUMN IF NOT EXISTS uf_oab TEXT;

-- Backfill: hoje a UF está embutida como sufixo em oab_number (ex.: 84503BA).
UPDATE public.lawyers
SET uf_oab = UPPER(BTRIM(SUBSTRING(BTRIM(oab_number) FROM '([A-Za-z]{2})$')))
WHERE (uf_oab IS NULL OR BTRIM(uf_oab) = '')
  AND BTRIM(oab_number) ~* '[A-Za-z]{2}$';

UPDATE public.lawyers
SET oab_number = BTRIM(REGEXP_REPLACE(oab_number, '[A-Za-z]{2}$', ''))
WHERE oab_number ~* '[A-Za-z]{2}$';

UPDATE public.lawyers
SET uf_oab = UPPER(BTRIM(uf_oab))
WHERE uf_oab IS NOT NULL;

UPDATE public.lawyers
SET oab_number = BTRIM(oab_number)
WHERE oab_number IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lawyers_oab_number_digits_check') THEN
    ALTER TABLE public.lawyers ADD CONSTRAINT lawyers_oab_number_digits_check
      CHECK (oab_number ~ '^[0-9]{1,10}$');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lawyers_uf_oab_format_check') THEN
    ALTER TABLE public.lawyers ADD CONSTRAINT lawyers_uf_oab_format_check
      CHECK (uf_oab ~ '^[A-Z]{2}$');
  END IF;
END $$;

ALTER TABLE public.lawyers ALTER COLUMN oab_number SET NOT NULL;
ALTER TABLE public.lawyers ALTER COLUMN uf_oab SET NOT NULL;

-- Substitui as constraints antigas (duplicadas) pela chave correta para o DJEN.
ALTER TABLE public.lawyers DROP CONSTRAINT IF EXISTS lawyers_oab_number_key;
ALTER TABLE public.lawyers DROP CONSTRAINT IF EXISTS lawyers_oab_number_env_key;
ALTER TABLE public.lawyers DROP CONSTRAINT IF EXISTS lawyers_oab_number_environment_key;
ALTER TABLE public.lawyers DROP CONSTRAINT IF EXISTS lawyers_oab_number_uf_env_key;

ALTER TABLE public.lawyers ADD CONSTRAINT lawyers_oab_number_uf_env_key
  UNIQUE (oab_number, uf_oab, environment);

-- Rastreabilidade da sincronização: quais OABs foram usadas como filtro.
ALTER TABLE public.publication_sync_log
  ADD COLUMN IF NOT EXISTS lawyer_oabs TEXT;

COMMENT ON COLUMN public.lawyers.oab_number IS
  'Número da OAB somente com dígitos; enviado como numeroOab ao DJEN.';
COMMENT ON COLUMN public.lawyers.uf_oab IS
  'UF da OAB em maiúsculas; enviada como ufOab ao DJEN.';
COMMENT ON COLUMN public.publication_sync_log.lawyer_oabs IS
  'OABs dos advogados cadastrados usados como filtro nesta sincronização.';

COMMIT;
