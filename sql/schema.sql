-- LifeDrop database schema
-- Run this once against your MySQL server, e.g.:
--   mysql -u root -p < sql/schema.sql

CREATE DATABASE IF NOT EXISTS lifedrop
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE lifedrop;

-- ===== Donors =====
CREATE TABLE IF NOT EXISTS donors (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(120) NOT NULL,
  gender        ENUM('Male','Female','Other') NOT NULL DEFAULT 'Male',
  dob           DATE NOT NULL,
  blood_group   ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NOT NULL,
  weight_kg     DECIMAL(5,2) NOT NULL,
  street        VARCHAR(150),
  area          VARCHAR(100),
  city          VARCHAR(80) NOT NULL,
  pincode       VARCHAR(12),
  mobile        VARCHAR(20) NOT NULL,
  email         VARCHAR(150),
  is_active     TINYINT(1) NOT NULL DEFAULT 1, -- 1 = currently available to donate, 0 = not available right now
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_city (city),
  INDEX idx_group (blood_group),
  INDEX idx_active (is_active)
) ENGINE=InnoDB;

-- ===== Users (for login) =====
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  identifier    VARCHAR(150) NOT NULL UNIQUE, -- email or mobile used to log in
  password_hash VARCHAR(255) NOT NULL,
  donor_id      INT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ===== Blood Requests =====
-- The "Request Blood" form no longer sends emails — it just saves the
-- request here, so an admin (or you, querying the DB directly) can follow up.
CREATE TABLE IF NOT EXISTS blood_requests (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  requester_name    VARCHAR(120) NOT NULL,
  requester_mobile  VARCHAR(20) NOT NULL,
  city              VARCHAR(80) NOT NULL,
  blood_group       ENUM('A+','A-','B+','B-','AB+','AB-','O+','O-') NOT NULL,
  hospital          VARCHAR(150),
  message           VARCHAR(500),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_city (city),
  INDEX idx_group (blood_group)
) ENGINE=InnoDB;

-- Optional: a couple of sample donors so /api/donors returns results immediately.
INSERT INTO donors (name, gender, dob, blood_group, weight_kg, street, area, city, pincode, mobile, email, is_active)
VALUES
 ('Arun Kumar', 'Male',   '1994-03-12', 'O+',  72.5, 'Anna Salai', 'T. Nagar', 'Chennai',    '600017', '9800000001', 'arun@example.com', 1),
 ('Divya S',    'Female', '1997-07-01', 'A+',  58.0, 'Race Course Rd', 'RS Puram', 'Coimbatore', '641002', '9800000002', 'divya@example.com', 1),
 ('Karthik R',  'Male',   '1990-11-20', 'B+',  80.0, 'Perundurai Rd', 'Surampatti', 'Erode',    '638009', '9800000003', 'karthik@example.com', 1),
 ('Meena V',    'Female', '1995-05-05', 'AB+', 61.0, 'Bypass Rd', 'Anna Nagar', 'Madurai',      '625020', '9800000004', 'meena@example.com', 1),
 ('Suresh P',   'Male',   '1988-01-15', 'O-',  75.0, 'Cherry Rd', 'Suramangalam', 'Salem',      '636005', '9800000005', 'suresh@example.com', 0)
ON DUPLICATE KEY UPDATE name = name;

-- If you already ran an older version of this schema and the donors table
-- exists without is_active, uncomment the line below and run it once:
-- ALTER TABLE donors ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1;

-- Optional: a ready-to-use test login account, linked to Arun Kumar (donor id 1)
-- above. Use these to test User Login right away, without registering first:
--   Email:    arun@example.com
--   Password: Test@1234
-- The password_hash below is that password already hashed with bcrypt — never
-- put a plain-text password in a real database.
INSERT INTO users (identifier, password_hash, donor_id)
VALUES ('arun@example.com', '$2a$10$GRR6QAuOSvTPjzvJCtWz5OM8TrBICTsos6Wa3TlHAH4szu3MVxRAO', 1)
ON DUPLICATE KEY UPDATE identifier = identifier;
