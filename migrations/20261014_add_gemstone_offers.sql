ALTER TABLE gemstones
  ADD COLUMN offer_rate DECIMAL(5, 2) NULL,
  ADD COLUMN offer_start_date DATE NULL,
  ADD COLUMN offer_end_date DATE NULL;
