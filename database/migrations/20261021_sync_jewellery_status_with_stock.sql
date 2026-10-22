ALTER TABLE jewellery
  MODIFY COLUMN status VARCHAR(30) NOT NULL DEFAULT 'active';

UPDATE jewellery
SET status = CASE
  WHEN COALESCE(stock_quantity, 0) <= 0 THEN 'out_of_stock'
  ELSE 'active'
END;
