-- Add original_due_date to installments table
ALTER TABLE installments ADD COLUMN IF NOT EXISTS original_due_date TIMESTAMP WITH TIME ZONE;

-- Populate original_due_date with current dueDate for existing records
UPDATE installments SET original_due_date = dueDate WHERE original_due_date IS NULL;
