-- @param {BigInt} $1:userId
-- @param {String} $2:fromDate
-- @param {String} $3:toDate
SELECT 
  COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::text as total_income,
  COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::text as total_expense,
  (COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) -
  COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0))::text as balance
FROM transactions
WHERE user_id = $1
  AND ($2 = '' OR date >= TO_TIMESTAMP($2, 'YYYY-MM-DD'))
  AND ($3 = '' OR date <= TO_TIMESTAMP($3, 'YYYY-MM-DD'));