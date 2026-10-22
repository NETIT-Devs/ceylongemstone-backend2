ALTER TABLE banners
  ADD COLUMN secondary_button_text VARCHAR(100) NULL AFTER button_link,
  ADD COLUMN secondary_button_link VARCHAR(255) NULL AFTER secondary_button_text;
