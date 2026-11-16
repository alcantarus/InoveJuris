-- Rename columns to snake_case to avoid case-sensitivity issues and follow best practices
DO $$
BEGIN
  -- inssProtocol -> inss_protocol
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'inssProtocol') THEN
    ALTER TABLE contracts RENAME COLUMN "inssProtocol" TO inss_protocol;
  END IF;

  -- gpsGenerated -> gps_generated
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'gpsGenerated') THEN
    ALTER TABLE contracts RENAME COLUMN "gpsGenerated" TO gps_generated;
  END IF;

  -- gpsPaid -> gps_paid
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'gpsPaid') THEN
    ALTER TABLE contracts RENAME COLUMN "gpsPaid" TO gps_paid;
  END IF;

  -- inssDeferred -> inss_deferred
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'inssDeferred') THEN
    ALTER TABLE contracts RENAME COLUMN "inssDeferred" TO inss_deferred;
  END IF;

  -- contractSigned -> contract_signed
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'contractSigned') THEN
    ALTER TABLE contracts RENAME COLUMN "contractSigned" TO contract_signed;
  END IF;

  -- proxySigned -> proxy_signed
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'proxySigned') THEN
    ALTER TABLE contracts RENAME COLUMN "proxySigned" TO proxy_signed;
  END IF;

  -- launchDate -> launch_date
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'launchDate') THEN
    ALTER TABLE contracts RENAME COLUMN "launchDate" TO launch_date;
  END IF;

  -- contractDate -> contract_date
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'contractDate') THEN
    ALTER TABLE contracts RENAME COLUMN "contractDate" TO contract_date;
  END IF;

  -- processNumber -> process_number
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'processNumber') THEN
    ALTER TABLE contracts RENAME COLUMN "processNumber" TO process_number;
  END IF;

  -- contractValue -> contract_value
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'contractValue') THEN
    ALTER TABLE contracts RENAME COLUMN "contractValue" TO contract_value;
  END IF;

  -- paymentMethod -> payment_method
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'paymentMethod') THEN
    ALTER TABLE contracts RENAME COLUMN "paymentMethod" TO payment_method;
  END IF;

  -- installmentsCount -> installments_count
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'installmentsCount') THEN
    ALTER TABLE contracts RENAME COLUMN "installmentsCount" TO installments_count;
  END IF;

  -- childbirthDate -> childbirth_date
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'childbirthDate') THEN
    ALTER TABLE contracts RENAME COLUMN "childbirthDate" TO childbirth_date;
  END IF;

  -- commissionPercent -> commission_percent
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'commissionPercent') THEN
    ALTER TABLE contracts RENAME COLUMN "commissionPercent" TO commission_percent;
  END IF;

  -- commissionValue -> commission_value
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'commissionValue') THEN
    ALTER TABLE contracts RENAME COLUMN "commissionValue" TO commission_value;
  END IF;

  -- commissionPaid -> commission_paid
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'commissionPaid') THEN
    ALTER TABLE contracts RENAME COLUMN "commissionPaid" TO commission_paid;
  END IF;

  -- amountReceivable -> amount_receivable
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'amountReceivable') THEN
    ALTER TABLE contracts RENAME COLUMN "amountReceivable" TO amount_receivable;
  END IF;

  -- amountReceived -> amount_received
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'amountReceived') THEN
    ALTER TABLE contracts RENAME COLUMN "amountReceived" TO amount_received;
  END IF;

  -- lawArea -> law_area
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contracts' AND column_name = 'lawArea') THEN
    ALTER TABLE contracts RENAME COLUMN "lawArea" TO law_area;
  END IF;

END $$;
