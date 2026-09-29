-- ========================================================
-- DeliverrPro - Supabase Database Schema & Setup Script
-- Run this in your Supabase Project -> SQL Editor
-- ========================================================

-- 1. USERS TABLE (Customers)
CREATE TABLE IF NOT EXISTS public.users (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "uid" TEXT UNIQUE NOT NULL,
    "shopName" TEXT,
    "ownerName" TEXT,
    "mobile" TEXT UNIQUE NOT NULL,
    "village" TEXT,
    "pincode" TEXT,
    "villageArea" TEXT,
    "landmark" TEXT,
    "role" TEXT DEFAULT 'customer',
    "status" TEXT DEFAULT 'active',
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- 2. ADMINS TABLE
CREATE TABLE IF NOT EXISTS public.admins (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "uid" TEXT UNIQUE NOT NULL,
    "mobile" TEXT UNIQUE NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT DEFAULT 'admin',
    "ownerName" TEXT DEFAULT 'Administrator',
    "shopName" TEXT DEFAULT 'Deliverr Admin',
    "status" TEXT DEFAULT 'active',
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- 3. PRODUCTS TABLE
CREATE TABLE IF NOT EXISTS public.products (
    "id" TEXT PRIMARY KEY,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "imageUrl" TEXT,
    "status" TEXT DEFAULT 'active',
    "variants" JSONB DEFAULT '[]'::jsonb,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- 4. ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.orders (
    "id" TEXT PRIMARY KEY,
    "customerId" TEXT,
    "shopName" TEXT,
    "ownerName" TEXT,
    "customerMobile" TEXT,
    "village" TEXT,
    "pincode" TEXT,
    "landmark" TEXT,
    "items" JSONB DEFAULT '[]'::jsonb,
    "totalQuantity" INT DEFAULT 0,
    "totalAmount" NUMERIC DEFAULT 0,
    "paymentStatus" TEXT DEFAULT 'paid',
    "paymentId" TEXT,
    "orderDate" TEXT,
    "deliveryStatus" TEXT DEFAULT 'pending',
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- 5. BROADCASTS TABLE
CREATE TABLE IF NOT EXISTS public.broadcasts (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "priority" TEXT DEFAULT 'normal',
    "expiryDate" TEXT,
    "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- 6. SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.settings (
    "id" TEXT PRIMARY KEY DEFAULT 'global',
    "orderClosingTime" TEXT DEFAULT '21:00',
    "serviceAreas" JSONB DEFAULT '[{"name":"Hathin","pincode":"121103","status":"active"}]'::jsonb,
    "updatedAt" TIMESTAMPTZ DEFAULT now()
);

-- ========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- Allows client access using your Supabase public anon key
-- ========================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Allow read & write for public anon access
CREATE POLICY "Allow public all on users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on admins" ON public.admins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on broadcasts" ON public.broadcasts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all on settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);

-- ========================================================
-- ENABLE REALTIME
-- ========================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ========================================================
-- SEED DEFAULT ADMIN & INITIAL PRODUCTS
-- ========================================================

-- Insert Default Admin (Mobile: 9999999999, Password: admin123)
INSERT INTO public.admins ("uid", "mobile", "password", "role", "ownerName", "shopName", "status")
VALUES ('admin_9999999999', '9999999999', 'admin123', 'admin', 'Administrator', 'Deliverr Admin', 'active')
ON CONFLICT ("mobile") DO NOTHING;

-- Insert Global Settings
INSERT INTO public.settings ("id", "orderClosingTime", "serviceAreas")
VALUES ('global', '21:00', '[{"name":"Hathin","pincode":"121103","status":"active"}]'::jsonb)
ON CONFLICT ("id") DO NOTHING;

-- Insert Default Products with Multi-variants
INSERT INTO public.products ("id", "name", "category", "imageUrl", "status", "variants")
VALUES 
('p1', 'Burger Bun', 'Breads & Buns', 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&w=150&q=80', 'active', '[{"name":"Chhota","price":45,"unit":"Darjan"},{"name":"Bada","price":80,"unit":"Darjan"}]'::jsonb),
('p2', 'Bread', 'Breads & Buns', 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=150&q=80', 'active', '[{"name":"250g","price":25,"unit":"Packet"},{"name":"450g","price":40,"unit":"Packet"},{"name":"600g","price":50,"unit":"Packet"},{"name":"700g","price":60,"unit":"Packet"}]'::jsonb),
('p3', 'Veg Momos (Frozen)', 'Momos', 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=150&q=80', 'active', '[{"name":"Gol","price":180,"unit":"1 Packet (50 Pcs)"},{"name":"Lambe","price":200,"unit":"1 Packet (50 Pcs)"}]'::jsonb),
('p4', 'Lal Sauce', 'Sauces & Spreads', 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=150&q=80', 'active', '[{"name":"Local","price":90,"unit":"1 Bottle (1.2 Kg)"},{"name":"Kirti","price":120,"unit":"1 Bottle (1.2 Kg)"},{"name":"TamTam","price":150,"unit":"1 Bottle (1.2 Kg)"}]'::jsonb),
('p5', 'Vinegar', 'Sauces & Spreads', 'https://images.unsplash.com/photo-1607305387299-a3d9611cd46f?auto=format&fit=crop&w=150&q=80', 'active', '[{"name":"White","price":60,"unit":"1 Bottle (1 Ltr)"},{"name":"Black","price":70,"unit":"1 Bottle (1 Ltr)"}]'::jsonb),
('p6', 'Chowmein Noodles', 'Noodles & Pasta', 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=150&q=80', 'active', '[{"name":"Standard","price":65,"unit":"1 Packet (1 Kg)"}]'::jsonb),
('p7', 'Spring Rolls (Veg)', 'Rolls', 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=150&q=80', 'active', '[{"name":"Standard","price":140,"unit":"1 Packet (20 Pcs)"}]'::jsonb),
('p8', 'Aloo Patties', 'Patties & Snacks', 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?auto=format&fit=crop&w=150&q=80', 'active', '[{"name":"Standard","price":80,"unit":"1 Box (10 Pcs)"}]'::jsonb),
('p9', 'Premium Mayonnaise', 'Sauces & Spreads', 'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=150&q=80', 'active', '[{"name":"Standard","price":160,"unit":"1 Jar (1 Kg)"}]'::jsonb),
('p10', 'Fresh Eggs Crate', 'Eggs & Dairy', 'https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?auto=format&fit=crop&w=150&q=80', 'active', '[{"name":"Standard","price":180,"unit":"1 Crate (30 Eggs)"}]'::jsonb)
ON CONFLICT ("id") DO NOTHING;
