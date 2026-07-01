-- @param {BigInt} $1:userId
-- @param {String} $2:name
SELECT 
  id,
  name,
  type,
  user_id,
  created_at
FROM categories
WHERE user_id = $1 AND name = $2;