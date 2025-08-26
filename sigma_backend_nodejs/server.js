#!/usr/bin/env node
/**
 * Sigma Matching - Backend API Node.js Express
 * Agent IA autonome pour agents immobiliers
 */

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const axios = require('axios');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// Configuration
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Configuration PostgreSQL
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://sigma_user:password@localhost/sigma_matching',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// CORS
const corsOptions = {
    origin: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['http://localhost:3000', 'http://localhost:5173'],
    credentials: true,
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limite chaque IP à 100 requêtes par windowMs
    message: 'Trop de requêtes depuis cette IP, réessayez plus tard.'
});
app.use('/api/', limiter);

// ==================== MIDDLEWARE D'AUTHENTIFICATION ====================

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Token d\'authentification requis' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const result = await pool.query('SELECT * FROM users WHERE id = $1 AND is_active = true', [decoded.userId]);
        
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Utilisateur non trouvé ou inactif' });
        }

        req.user = result.rows[0];
        next();
    } catch (error) {
        console.error('Erreur authentification:', error);
        return res.status(403).json({ error: 'Token invalide' });
    }
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès administrateur requis' });
    }
    next();
};

// ==================== FONCTIONS UTILITAIRES ====================

const hashPassword = async (password) => {
    return await bcrypt.hash(password, 12);
};

const comparePassword = async (password, hash) => {
    return await bcrypt.compare(password, hash);
};

const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

const logAction = async (userId, action, details = {}, req) => {
    try {
        await pool.query(
            'INSERT INTO historique_actions (user_id, action, details, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)',
            [userId, action, JSON.stringify(details), req.ip, req.get('User-Agent')]
        );
    } catch (error) {
        console.error('Erreur logging action:', error);
    }
};

const triggerN8nWorkflow = async (workflowName, data) => {
    try {
        const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook';
        await axios.post(`${n8nWebhookUrl}/${workflowName}`, data, { timeout: 10000 });
        console.log(`Workflow ${workflowName} déclenché avec succès`);
    } catch (error) {
        console.error(`Erreur déclenchement workflow ${workflowName}:`, error.message);
    }
};

// ==================== ROUTES AUTHENTIFICATION ====================

// Inscription
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, first_name, last_name, role = 'agent' } = req.body;

        // Validation
        if (!email || !password || !first_name || !last_name) {
            return res.status(400).json({ error: 'Tous les champs sont requis' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères' });
        }

        // Vérifier si l'utilisateur existe
        const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(400).json({ error: 'Email déjà utilisé' });
        }

        // Hasher le mot de passe
        const hashedPassword = await hashPassword(password);

        // Créer l'utilisateur
        const result = await pool.query(
            'INSERT INTO users (email, password_hash, first_name, last_name, role) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [email, hashedPassword, first_name, last_name, role]
        );

        const user = result.rows[0];
        const token = generateToken(user.id);

        // Logger l'action
        await logAction(user.id, 'USER_REGISTER', { email }, req);

        // Retourner la réponse (sans le mot de passe)
        delete user.password_hash;
        res.status(201).json({
            message: 'Utilisateur créé avec succès',
            token,
            user
        });

    } catch (error) {
        console.error('Erreur inscription:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Connexion
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        // Récupérer l'utilisateur
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Identifiants invalides' });
        }

        const user = result.rows[0];

        // Vérifier le mot de passe
        const isValidPassword = await comparePassword(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Identifiants invalides' });
        }

        // Vérifier si le compte est actif
        if (!user.is_active) {
            return res.status(401).json({ error: 'Compte désactivé' });
        }

        // Générer le token
        const token = generateToken(user.id);

        // Logger l'action
        await logAction(user.id, 'USER_LOGIN', { email }, req);

        // Retourner la réponse (sans le mot de passe)
        delete user.password_hash;
        res.json({
            message: 'Connexion réussie',
            token,
            user
        });

    } catch (error) {
        console.error('Erreur connexion:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Profil utilisateur
app.get('/api/auth/me', authenticateToken, async (req, res) => {
    try {
        const user = { ...req.user };
        delete user.password_hash;
        res.json({ user });
    } catch (error) {
        console.error('Erreur récupération profil:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Connexion Google OAuth
app.post('/api/auth/google', async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ error: 'Token Google requis' });
        }

        // Vérifier le token Google
        const googleResponse = await axios.get(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${token}`);
        
        if (googleResponse.status !== 200) {
            return res.status(401).json({ error: 'Token Google invalide' });
        }

        const googleData = googleResponse.data;
        const email = googleData.email;

        // Rechercher ou créer l'utilisateur
        let result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        let user;

        if (result.rows.length === 0) {
            // Créer un nouvel utilisateur
            const insertResult = await pool.query(
                'INSERT INTO users (email, first_name, last_name, is_active) VALUES ($1, $2, $3, $4) RETURNING *',
                [email, googleData.given_name || '', googleData.family_name || '', true]
            );
            user = insertResult.rows[0];
        } else {
            user = result.rows[0];
        }

        // Générer le token
        const jwtToken = generateToken(user.id);

        // Logger l'action
        await logAction(user.id, 'GOOGLE_LOGIN', { email }, req);

        // Retourner la réponse
        delete user.password_hash;
        res.json({
            message: 'Connexion Google réussie',
            token: jwtToken,
            user
        });

    } catch (error) {
        console.error('Erreur connexion Google:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// ==================== ROUTES LEADS ====================

// Récupérer tous les leads
app.get('/api/leads', authenticateToken, async (req, res) => {
    try {
        let query, params;

        if (req.user.role === 'admin') {
            query = 'SELECT * FROM leads ORDER BY created_at DESC';
            params = [];
        } else {
            query = 'SELECT * FROM leads WHERE agent_id = $1 ORDER BY created_at DESC';
            params = [req.user.id];
        }

        const result = await pool.query(query, params);
        
        res.json({
            leads: result.rows,
            total: result.rows.length
        });

    } catch (error) {
        console.error('Erreur récupération leads:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Créer un nouveau lead
app.post('/api/leads', authenticateToken, async (req, res) => {
    try {
        const {
            nom, prenom, email, telephone, type_bien, budget_max_eur,
            villes, surface_min, surface_max, nb_pieces_min, nb_pieces_max,
            etat, urgence = 'MOYENNE', notes
        } = req.body;

        // Validation
        if (!nom || !prenom || !type_bien || !budget_max_eur || !villes) {
            return res.status(400).json({ error: 'Champs requis: nom, prenom, type_bien, budget_max_eur, villes' });
        }

        if (budget_max_eur <= 0) {
            return res.status(400).json({ error: 'Le budget doit être positif' });
        }

        if (!Array.isArray(villes) || villes.length === 0) {
            return res.status(400).json({ error: 'Au moins une ville requise' });
        }

        // Créer le lead
        const result = await pool.query(
            `INSERT INTO leads (
                agent_id, nom, prenom, email, telephone, type_bien, budget_max_eur,
                villes, surface_min, surface_max, nb_pieces_min, nb_pieces_max,
                etat, urgence, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
            RETURNING *`,
            [
                req.user.id, nom, prenom, email, telephone, type_bien, budget_max_eur,
                JSON.stringify(villes), surface_min, surface_max, nb_pieces_min, nb_pieces_max,
                etat, urgence, notes
            ]
        );

        const lead = result.rows[0];

        // Logger l'action
        await logAction(req.user.id, 'LEAD_CREATE', { lead_id: lead.id, nom, prenom }, req);

        // Déclencher le workflow n8n
        await triggerN8nWorkflow('lead-created', lead);

        res.status(201).json({
            message: 'Lead créé avec succès',
            lead
        });

    } catch (error) {
        console.error('Erreur création lead:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Récupérer un lead spécifique
app.get('/api/leads/:id', authenticateToken, async (req, res) => {
    try {
        const leadId = parseInt(req.params.id);
        let query, params;

        if (req.user.role === 'admin') {
            query = 'SELECT * FROM leads WHERE id = $1';
            params = [leadId];
        } else {
            query = 'SELECT * FROM leads WHERE id = $1 AND agent_id = $2';
            params = [leadId, req.user.id];
        }

        const result = await pool.query(query, params);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Lead non trouvé' });
        }

        res.json({ lead: result.rows[0] });

    } catch (error) {
        console.error('Erreur récupération lead:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Mettre à jour un lead
app.put('/api/leads/:id', authenticateToken, async (req, res) => {
    try {
        const leadId = parseInt(req.params.id);
        const updates = req.body;

        // Vérifier que le lead existe et appartient à l'utilisateur
        let checkQuery, checkParams;
        if (req.user.role === 'admin') {
            checkQuery = 'SELECT * FROM leads WHERE id = $1';
            checkParams = [leadId];
        } else {
            checkQuery = 'SELECT * FROM leads WHERE id = $1 AND agent_id = $2';
            checkParams = [leadId, req.user.id];
        }

        const checkResult = await pool.query(checkQuery, checkParams);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Lead non trouvé' });
        }

        // Construire la requête de mise à jour
        const allowedFields = [
            'nom', 'prenom', 'email', 'telephone', 'type_bien', 'budget_max_eur',
            'villes', 'surface_min', 'surface_max', 'nb_pieces_min', 'nb_pieces_max',
            'etat', 'urgence', 'statut', 'notes'
        ];

        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;

        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                updateFields.push(`${key} = $${paramIndex}`);
                updateValues.push(key === 'villes' ? JSON.stringify(value) : value);
                paramIndex++;
            }
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'Aucun champ valide à mettre à jour' });
        }

        updateFields.push(`updated_at = $${paramIndex}`);
        updateValues.push(new Date());
        updateValues.push(leadId);

        const updateQuery = `UPDATE leads SET ${updateFields.join(', ')} WHERE id = $${paramIndex + 1} RETURNING *`;
        const result = await pool.query(updateQuery, updateValues);

        // Logger l'action
        await logAction(req.user.id, 'LEAD_UPDATE', { lead_id: leadId, updates }, req);

        res.json({
            message: 'Lead mis à jour avec succès',
            lead: result.rows[0]
        });

    } catch (error) {
        console.error('Erreur mise à jour lead:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// ==================== ROUTES BIENS ====================

// Récupérer les biens pour un lead
app.get('/api/leads/:id/biens', authenticateToken, async (req, res) => {
    try {
        const leadId = parseInt(req.params.id);

        // Vérifier que le lead existe et appartient à l'utilisateur
        let checkQuery, checkParams;
        if (req.user.role === 'admin') {
            checkQuery = 'SELECT id FROM leads WHERE id = $1';
            checkParams = [leadId];
        } else {
            checkQuery = 'SELECT id FROM leads WHERE id = $1 AND agent_id = $2';
            checkParams = [leadId, req.user.id];
        }

        const checkResult = await pool.query(checkQuery, checkParams);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Lead non trouvé' });
        }

        // Récupérer les biens
        const result = await pool.query(
            'SELECT * FROM biens_proposes WHERE lead_id = $1 ORDER BY score_match DESC NULLS LAST, date_detection DESC',
            [leadId]
        );

        res.json({
            biens: result.rows,
            total: result.rows.length
        });

    } catch (error) {
        console.error('Erreur récupération biens:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Mettre à jour le statut d'un bien
app.put('/api/biens/:id/statut', authenticateToken, async (req, res) => {
    try {
        const bienId = parseInt(req.params.id);
        const { statut } = req.body;

        if (!statut) {
            return res.status(400).json({ error: 'Statut requis' });
        }

        // Vérifier que le bien existe et appartient à un lead de l'utilisateur
        let checkQuery, checkParams;
        if (req.user.role === 'admin') {
            checkQuery = 'SELECT bp.* FROM biens_proposes bp WHERE bp.id = $1';
            checkParams = [bienId];
        } else {
            checkQuery = `
                SELECT bp.* FROM biens_proposes bp 
                JOIN leads l ON bp.lead_id = l.id 
                WHERE bp.id = $1 AND l.agent_id = $2
            `;
            checkParams = [bienId, req.user.id];
        }

        const checkResult = await pool.query(checkQuery, checkParams);
        if (checkResult.rows.length === 0) {
            return res.status(404).json({ error: 'Bien non trouvé' });
        }

        // Mettre à jour le statut
        const result = await pool.query(
            'UPDATE biens_proposes SET statut = $1 WHERE id = $2 RETURNING *',
            [statut, bienId]
        );

        // Logger l'action
        await logAction(req.user.id, 'BIEN_UPDATE_STATUT', { bien_id: bienId, statut }, req);

        res.json({
            message: 'Statut mis à jour avec succès',
            bien: result.rows[0]
        });

    } catch (error) {
        console.error('Erreur mise à jour statut bien:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// ==================== ROUTES ADMIN ====================

// Statistiques admin
app.get('/api/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const stats = {};

        // Statistiques utilisateurs
        const usersResult = await pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE is_active = true) as active FROM users');
        stats.total_users = parseInt(usersResult.rows[0].total);
        stats.active_users = parseInt(usersResult.rows[0].active);

        // Statistiques leads
        const leadsResult = await pool.query('SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE statut = \'EN_COURS\') as active FROM leads');
        stats.total_leads = parseInt(leadsResult.rows[0].total);
        stats.active_leads = parseInt(leadsResult.rows[0].active);

        // Statistiques biens
        const biensResult = await pool.query('SELECT COUNT(*) as total FROM biens_proposes');
        stats.total_biens = parseInt(biensResult.rows[0].total);

        // Biens détectés aujourd'hui
        const biensToday = await pool.query('SELECT COUNT(*) as today FROM biens_proposes WHERE date_detection::date = CURRENT_DATE');
        stats.biens_today = parseInt(biensToday.rows[0].today);

        res.json(stats);

    } catch (error) {
        console.error('Erreur récupération stats admin:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// Liste de tous les utilisateurs
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT id, email, first_name, last_name, role, is_active, created_at FROM users ORDER BY created_at DESC');
        
        res.json({
            users: result.rows,
            total: result.rows.length
        });

    } catch (error) {
        console.error('Erreur récupération utilisateurs admin:', error);
        res.status(500).json({ error: 'Erreur interne du serveur' });
    }
});

// ==================== ROUTES SYSTÈME ====================

// Health check
app.get('/api/health', async (req, res) => {
    try {
        // Test de la base de données
        await pool.query('SELECT 1');
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '1.0.0',
            database: 'connected'
        });

    } catch (error) {
        console.error('Health check failed:', error);
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Route par défaut
app.get('/', (req, res) => {
    res.json({
        message: 'Sigma Matching API',
        version: '1.0.0',
        endpoints: {
            auth: '/api/auth/*',
            leads: '/api/leads/*',
            biens: '/api/biens/*',
            admin: '/api/admin/*',
            health: '/api/health'
        }
    });
});

// ==================== GESTION D'ERREURS ====================

// Middleware de gestion d'erreurs
app.use((error, req, res, next) => {
    console.error('Erreur non gérée:', error);
    res.status(500).json({ error: 'Erreur interne du serveur' });
});

// Route 404
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route non trouvée' });
});

// ==================== DÉMARRAGE DU SERVEUR ====================

const startServer = async () => {
    try {
        // Test de la connexion à la base de données
        await pool.query('SELECT NOW()');
        console.log('✅ Connexion à la base de données établie');

        // Démarrage du serveur
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`🚀 Serveur Sigma Matching démarré sur le port ${PORT}`);
            console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 API disponible sur: http://localhost:${PORT}`);
            console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
        });

    } catch (error) {
        console.error('❌ Erreur de démarrage:', error);
        process.exit(1);
    }
};

// Gestion propre de l'arrêt
process.on('SIGINT', async () => {
    console.log('\n🛑 Arrêt du serveur...');
    await pool.end();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Arrêt du serveur...');
    await pool.end();
    process.exit(0);
});

// Démarrage
startServer();

