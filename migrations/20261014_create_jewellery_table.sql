-- ============================================================
-- MIGRATION: Create jewellery table
-- Date: 2026-10-14
-- Description: Jewellery product inventory for admin/superadmin
-- ============================================================

CREATE TABLE IF NOT EXISTS jewellery (
  id               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  product_code     VARCHAR(64)      NOT NULL UNIQUE,
  product_name     VARCHAR(255)     NOT NULL,
  jewellery_type   VARCHAR(100)     DEFAULT NULL,
  gemstone_type    VARCHAR(100)     DEFAULT NULL,
  color            VARCHAR(100)     DEFAULT NULL,
  description      TEXT            DEFAULT NULL,
  material         VARCHAR(150)     DEFAULT NULL,
  price            DECIMAL(12, 2)  NOT NULL,
  currency         VARCHAR(10)     NOT NULL DEFAULT 'USD',
  stock_quantity   INT             NOT NULL DEFAULT 1,
  image_url        VARCHAR(512)    DEFAULT NULL,
  is_handcrafted   TINYINT(1)      NOT NULL DEFAULT 1,
  status           ENUM('active','inactive','draft') NOT NULL DEFAULT 'active',
  created_by       INT             DEFAULT NULL COMMENT 'user id of admin who created this item',
  created_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_status (status),
  INDEX idx_jewellery_type (jewellery_type),
  INDEX idx_product_code (product_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
