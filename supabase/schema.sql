-- ========================================================
-- SCHEMA DE BANCO DE DADOS SUPABASE PARA CONTROLE DE GELO
-- Executar este script no 'SQL Editor' do seu painel Supabase
-- ========================================================

-- 1. Tabela de Lançamentos / Movimentações (Vendas, Produções, Cortesias, Perdas)
CREATE TABLE IF NOT EXISTS public.movements (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('venda', 'producao', 'cortesia', 'perda')),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(10, 2) DEFAULT 0,
  total_price NUMERIC(10, 2) DEFAULT 0,
  attendant_id TEXT,
  attendant_name TEXT NOT NULL,
  date TEXT NOT NULL,
  time TEXT NOT NULL,
  payment_method TEXT,
  discount JSONB,
  loss_reason TEXT,
  courtesy_recipient TEXT,
  observation TEXT,
  is_canceled BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'ativo',
  canceled_at TEXT,
  canceled_by TEXT,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabela de Frentistas / Atendentes
CREATE TABLE IF NOT EXISTS public.attendants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Configurações do Sistema
CREATE TABLE IF NOT EXISTS public.settings (
  id TEXT PRIMARY KEY DEFAULT '00000000-0000-0000-0000-000000000000',
  default_ice_bag_price NUMERIC(10, 2) DEFAULT 16.00,
  initial_stock INTEGER DEFAULT 0,
  admin_password TEXT DEFAULT '102035',
  pending_admin_password TEXT,
  minimum_stock_alert INTEGER DEFAULT 15,
  max_discount_percentage NUMERIC(5, 2) DEFAULT 50.00,
  max_bags_per_sale INTEGER DEFAULT 100,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Usuários e Contas do Sistema
CREATE TABLE IF NOT EXISTS public.system_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'operador',
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de Logs de Eventos e Auditoria
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  type TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS) com acesso permissivo para a chave anon/service
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso Público Read/Write para o Applet
CREATE POLICY "Permitir Acesso Completo Movements" ON public.movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir Acesso Completo Attendants" ON public.attendants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir Acesso Completo Settings" ON public.settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir Acesso Completo System Users" ON public.system_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Permitir Acesso Completo Audit Logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

-- Inserir configurações padrão caso a tabela esteja vazia
INSERT INTO public.settings (id, default_ice_bag_price, initial_stock, admin_password, minimum_stock_alert, max_discount_percentage, max_bags_per_sale)
VALUES ('00000000-0000-0000-0000-000000000000', 16.00, 0, '102035', 15, 50.00, 100)
ON CONFLICT (id) DO NOTHING;
