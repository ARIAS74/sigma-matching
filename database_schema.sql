-- Sigma Matching Database Schema
-- Version: 1.0
-- Date: 2025-08-22

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'agent');
CREATE TYPE lead_status AS ENUM ('NOUVEAU', 'EN_COURS', 'EN_PAUSE', 'CLOS');
CREATE TYPE bien_type AS ENUM ('APPARTEMENT', 'MAISON', 'TERRAIN', 'LOCAL', 'AUTRE');
CREATE TYPE bien_etat AS ENUM ('NEUF', 'ANCIEN', 'A_RENOVER', 'VEFA');
CREATE TYPE objectif_type AS ENUM ('RP', 'LOCATIF', 'PRO', 'AUTRE');
CREATE TYPE urgence_level AS ENUM ('FAIBLE', 'MOYENNE', 'FORTE');
CREATE TYPE source_type AS ENUM ('LEBONCOIN', 'SELOGER', 'BIENICI', 'LOGICIMMO', 'PAP', 'AUTRE');
CREATE TYPE actor_type AS ENUM ('SYSTEM', 'AGENT', 'ADMIN');
CREATE TYPE action_type AS ENUM ('LEAD_CREATED', 'MATCH_FOUND', 'STATUS_CHANGED', 'FLAG_CHANGED', 'COMMENT_ADDED', 'EXPORT_DONE', 'LOGIN', 'ERROR');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- NULL for OAuth users
    google_id VARCHAR(255) UNIQUE, -- NULL for email/password users
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'agent',
    is_active BOOLEAN NOT NULL DEFAULT true,
    email_verified BOOLEAN NOT NULL DEFAULT false,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Leads table
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    budget_max_eur NUMERIC(12,2) NOT NULL CHECK (budget_max_eur > 0),
    villes TEXT[] NOT NULL CHECK (array_length(villes, 1) > 0),
    type_bien bien_type NOT NULL,
    surface_min NUMERIC(8,2) CHECK (surface_min > 0),
    surface_max NUMERIC(8,2) CHECK (surface_max > 0 AND (surface_min IS NULL OR surface_max >= surface_min)),
    nb_pieces_min INTEGER CHECK (nb_pieces_min > 0),
    etat bien_etat,
    objectif objectif_type NOT NULL,
    urgence urgence_level NOT NULL DEFAULT 'MOYENNE',
    mandat_url TEXT,
    statut lead_status NOT NULL DEFAULT 'NOUVEAU',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Biens proposés table
CREATE TABLE biens_proposes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    source source_type NOT NULL,
    titre TEXT NOT NULL,
    url TEXT NOT NULL,
    prix_eur NUMERIC(12,2) NOT NULL CHECK (prix_eur > 0),
    ville VARCHAR(100) NOT NULL,
    surface_m2 NUMERIC(8,2) CHECK (surface_m2 > 0),
    type_bien bien_type NOT NULL,
    nb_pieces INTEGER CHECK (nb_pieces > 0),
    etat bien_etat,
    description TEXT,
    date_detection TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Flags agent
    interessant BOOLEAN NOT NULL DEFAULT false,
    contacte BOOLEAN NOT NULL DEFAULT false,
    refuse BOOLEAN NOT NULL DEFAULT false,
    a_revoir BOOLEAN NOT NULL DEFAULT false,
    
    -- Métadonnées
    commentaire_agent TEXT,
    score_match NUMERIC(5,2) CHECK (score_match >= 0 AND score_match <= 100),
    url_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for deduplication
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historique des actions table
CREATE TABLE historique_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_type actor_type NOT NULL,
    actor_id UUID REFERENCES users(id),
    lead_id UUID REFERENCES leads(id),
    bien_id UUID REFERENCES biens_proposes(id),
    action action_type NOT NULL,
    meta JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions table for JWT token management
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX idx_leads_agent_id ON leads(agent_id);
CREATE INDEX idx_leads_statut ON leads(statut) WHERE statut != 'CLOS';
CREATE INDEX idx_leads_urgence ON leads(urgence) WHERE urgence = 'FORTE';

CREATE INDEX idx_biens_lead_id_date ON biens_proposes(lead_id, date_detection DESC);
CREATE INDEX idx_biens_url_hash ON biens_proposes(url_hash);
CREATE INDEX idx_biens_source ON biens_proposes(source);
CREATE INDEX idx_biens_flags ON biens_proposes(interessant, contacte, refuse, a_revoir) WHERE interessant OR contacte OR refuse OR a_revoir;

CREATE INDEX idx_historique_actor ON historique_actions(actor_type, actor_id);
CREATE INDEX idx_historique_lead ON historique_actions(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX idx_historique_bien ON historique_actions(bien_id) WHERE bien_id IS NOT NULL;
CREATE INDEX idx_historique_action ON historique_actions(action);
CREATE INDEX idx_historique_date ON historique_actions(created_at DESC);

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(refresh_token);
CREATE INDEX idx_sessions_expires ON user_sessions(expires_at);

-- Unique constraints
CREATE UNIQUE INDEX idx_biens_unique_per_lead ON biens_proposes(lead_id, url_hash);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_biens_updated_at BEFORE UPDATE ON biens_proposes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate URL hash
CREATE OR REPLACE FUNCTION generate_url_hash(input_url TEXT)
RETURNS VARCHAR(64) AS $$
BEGIN
    -- Normalize URL and generate SHA-256 hash
    RETURN encode(digest(lower(trim(input_url)), 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically generate URL hash
CREATE OR REPLACE FUNCTION set_url_hash()
RETURNS TRIGGER AS $$
BEGIN
    NEW.url_hash = generate_url_hash(NEW.url);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_biens_url_hash BEFORE INSERT OR UPDATE ON biens_proposes FOR EACH ROW EXECUTE FUNCTION set_url_hash();

-- Function to log actions automatically
CREATE OR REPLACE FUNCTION log_action(
    p_actor_type actor_type,
    p_actor_id UUID,
    p_lead_id UUID DEFAULT NULL,
    p_bien_id UUID DEFAULT NULL,
    p_action action_type,
    p_meta JSONB DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    action_id UUID;
BEGIN
    INSERT INTO historique_actions (actor_type, actor_id, lead_id, bien_id, action, meta, ip_address, user_agent)
    VALUES (p_actor_type, p_actor_id, p_lead_id, p_bien_id, p_action, p_meta, p_ip_address, p_user_agent)
    RETURNING id INTO action_id;
    
    RETURN action_id;
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE biens_proposes ENABLE ROW LEVEL SECURITY;
ALTER TABLE historique_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for leads table
CREATE POLICY leads_agent_isolation ON leads
    FOR ALL TO PUBLIC
    USING (agent_id = current_setting('app.current_user_id')::UUID);

-- RLS Policies for biens_proposes table
CREATE POLICY biens_agent_isolation ON biens_proposes
    FOR ALL TO PUBLIC
    USING (lead_id IN (SELECT id FROM leads WHERE agent_id = current_setting('app.current_user_id')::UUID));

-- RLS Policies for historique_actions table
CREATE POLICY historique_agent_isolation ON historique_actions
    FOR SELECT TO PUBLIC
    USING (
        actor_id = current_setting('app.current_user_id')::UUID
        OR lead_id IN (SELECT id FROM leads WHERE agent_id = current_setting('app.current_user_id')::UUID)
        OR bien_id IN (
            SELECT bp.id FROM biens_proposes bp
            JOIN leads l ON bp.lead_id = l.id
            WHERE l.agent_id = current_setting('app.current_user_id')::UUID
        )
    );

-- RLS Policies for user_sessions table
CREATE POLICY sessions_user_isolation ON user_sessions
    FOR ALL TO PUBLIC
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- Admin bypass policies (when current_user_role is 'admin')
CREATE POLICY leads_admin_access ON leads
    FOR ALL TO PUBLIC
    USING (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY biens_admin_access ON biens_proposes
    FOR ALL TO PUBLIC
    USING (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY historique_admin_access ON historique_actions
    FOR ALL TO PUBLIC
    USING (current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY sessions_admin_access ON user_sessions
    FOR ALL TO PUBLIC
    USING (current_setting('app.current_user_role', true) = 'admin');

-- Views for common queries
CREATE VIEW leads_with_stats AS
SELECT 
    l.*,
    COUNT(bp.id) as total_biens,
    COUNT(bp.id) FILTER (WHERE bp.interessant) as biens_interessants,
    COUNT(bp.id) FILTER (WHERE bp.contacte) as biens_contactes,
    COUNT(bp.id) FILTER (WHERE bp.refuse) as biens_refuses,
    COUNT(bp.id) FILTER (WHERE bp.a_revoir) as biens_a_revoir,
    MAX(bp.date_detection) as derniere_detection
FROM leads l
LEFT JOIN biens_proposes bp ON l.id = bp.lead_id
GROUP BY l.id;

CREATE VIEW biens_with_lead_info AS
SELECT 
    bp.*,
    l.nom as lead_nom,
    l.prenom as lead_prenom,
    l.budget_max_eur,
    l.urgence,
    u.first_name as agent_first_name,
    u.last_name as agent_last_name
FROM biens_proposes bp
JOIN leads l ON bp.lead_id = l.id
JOIN users u ON l.agent_id = u.id;

-- Grant permissions to sigma_user
GRANT CONNECT ON DATABASE sigma_matching TO sigma_user;
GRANT USAGE ON SCHEMA public TO sigma_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO sigma_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO sigma_user;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO sigma_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sigma_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO sigma_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO sigma_user;

-- Insert default admin user (password: admin123!)
INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified)
VALUES (
    'admin@sigma-matching.com',
    crypt('admin123!', gen_salt('bf', 12)),
    'Admin',
    'System',
    'admin',
    true
);

-- Sample data for testing (optional)
-- Uncomment the following lines to insert test data

/*
-- Insert test agent
INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified)
VALUES (
    'agent@test.com',
    crypt('test123!', gen_salt('bf', 12)),
    'Jean',
    'Dupont',
    'agent',
    true
);

-- Insert test lead
INSERT INTO leads (agent_id, nom, prenom, budget_max_eur, villes, type_bien, surface_min, surface_max, nb_pieces_min, objectif, urgence)
VALUES (
    (SELECT id FROM users WHERE email = 'agent@test.com'),
    'Martin',
    'Pierre',
    350000.00,
    ARRAY['Paris', 'Boulogne-Billancourt'],
    'APPARTEMENT',
    60.0,
    80.0,
    3,
    'RP',
    'MOYENNE'
);
*/

-- Comments for documentation
COMMENT ON TABLE users IS 'Table des utilisateurs du système (agents et administrateurs)';
COMMENT ON TABLE leads IS 'Table des leads/mandats de recherche des clients acheteurs';
COMMENT ON TABLE biens_proposes IS 'Table des biens immobiliers détectés et proposés aux leads';
COMMENT ON TABLE historique_actions IS 'Journal d''audit de toutes les actions du système';
COMMENT ON TABLE user_sessions IS 'Table de gestion des sessions utilisateur et refresh tokens';

COMMENT ON COLUMN leads.villes IS 'Array des villes cibles pour la recherche';
COMMENT ON COLUMN biens_proposes.url_hash IS 'Hash SHA-256 de l''URL pour la déduplication';
COMMENT ON COLUMN biens_proposes.score_match IS 'Score de matching calculé (0-100)';
COMMENT ON COLUMN historique_actions.meta IS 'Métadonnées JSON flexibles selon le type d''action';

