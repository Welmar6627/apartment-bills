-- ============================================================
-- DB Setup Script for Apartment Utility Bills Manager
-- Target Database: PostgreSQL / Supabase
-- Run this in your Supabase SQL Editor or psql
-- ============================================================

-- Drop tables if they exist (safe reset)
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS bills CASCADE;
DROP TABLE IF EXISTS tenants CASCADE;

-- 1. Create tenants table
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE
);

-- 2. Create bills table
--    per_person_amount = total_amount / 8 (auto-calculated by the app)
CREATE TABLE bills (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    per_person_amount NUMERIC(10, 2) NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create payments table
--    One payment record per (bill, tenant) pair via UNIQUE constraint
--    Status: pending → approved / rejected
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    reference_number VARCHAR(13) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tenant_bill_payment UNIQUE (bill_id, tenant_id)
);

-- ============================================================
-- Seed: Pre-populate 7 tenants
-- ✏️  Customize these names to match your actual tenants!
-- ============================================================
INSERT INTO tenants (name) VALUES 
('Andrie Kenn Kimpano'),
('Jad Talisic'),
('Julius Amonn Neccesito'),
('Lawrence Miole'),
('Jonel Pagal'),
('John Vincent Ausa'),
('Jasper Endriga');

-- ============================================================
-- Done! Your tables are ready.
-- Next steps:
--   1. Copy your Supabase DATABASE_URL to .env.local
--   2. Set ADMIN_PIN and NEXT_PUBLIC_ADMIN_PIN in .env.local
--   3. Run: npm run dev
--   4. Visit: http://localhost:3000 (Tenant Portal)
--   5. Visit: http://localhost:3000/admin-dashboard?pin=YOUR_PIN (Admin)
-- ============================================================
