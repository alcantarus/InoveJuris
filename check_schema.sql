-- Script to check which tables are missing the 'environment' column
SELECT 
    table_name 
FROM 
    information_schema.tables 
WHERE 
    table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name NOT IN (
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'environment'
    );
