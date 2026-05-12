-- Policies
SELECT policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename = 'installments';

-- Constraints
SELECT 
    conname AS constraint_name, 
    confrelid::regclass AS references_table, 
    conrelid::regclass AS table_name, 
    confdeltype AS delete_action
FROM pg_constraint 
WHERE conrelid = 'installments'::regclass OR confrelid = 'installments'::regclass;
