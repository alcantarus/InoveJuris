-- Fix for tags column: convert string-based tags to array-based tags
-- This script assumes the column type is already TEXT[] but might contain malformed or string-like data in some rows.

-- First, ensure all string tags are converted to arrays.
-- If the column type was changed and some data remained as string representation, this might need casting.

-- Since we are already using TEXT[], let's assume we need to update rows 
-- where the tag might have been stored incorrectly as a single string.
-- Note: This is a safe update.

UPDATE processes
SET tags = ARRAY[tags::text]
WHERE jsonb_typeof(to_jsonb(tags)) = 'string';
