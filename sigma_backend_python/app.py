#!/usr/bin/env python3
"""
Sigma Matching - Backend API Flask
Agent IA autonome pour agents immobiliers
"""

from flask import Flask, request, jsonify, g
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, create_access_token, create_refresh_token, jwt_required, get_jwt_identity
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import os
import requests
import logging
from functools import wraps

# Configuration du logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialisation Flask
app = Flask(__name__)

# Configuration
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv(
    'DATABASE_URL', 
    'postgresql://sigma_user:password@localhost/sigma_matching'
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
app.config['JWT_REFRESH_TOKEN_EXPIRES'] = timedelta(days=30)

# Extensions
db = SQLAlchemy(app)
jwt = JWTManager(app)
CORS(app, origins=["http://localhost:3000", "http://localhost:5173"])

# ==================== MODÈLES ====================

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False)
    password_hash = db.Column(db.String(255))
    first_name = db.Column(db.String(100))
    last_name = db.Column(db.String(100))
    role = db.Column(db.String(20), default='agent')
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relations
    leads = db.relationship('Lead', backref='agent', lazy=True)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'role': self.role,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

class Lead(db.Model):
    __tablename__ = 'leads'
    
    id = db.Column(db.Integer, primary_key=True)
    agent_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    nom = db.Column(db.String(100), nullable=False)
    prenom = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(255))
    telephone = db.Column(db.String(20))
    type_bien = db.Column(db.String(20), nullable=False)
    budget_max_eur = db.Column(db.Integer, nullable=False)
    villes = db.Column(db.JSON, nullable=False)
    surface_min = db.Column(db.Integer)
    surface_max = db.Column(db.Integer)
    nb_pieces_min = db.Column(db.Integer)
    nb_pieces_max = db.Column(db.Integer)
    etat = db.Column(db.String(20))
    urgence = db.Column(db.String(20), default='MOYENNE')
    statut = db.Column(db.String(20), default='EN_COURS')
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relations
    biens_proposes = db.relationship('BienPropose', backref='lead', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'agent_id': self.agent_id,
            'nom': self.nom,
            'prenom': self.prenom,
            'email': self.email,
            'telephone': self.telephone,
            'type_bien': self.type_bien,
            'budget_max_eur': self.budget_max_eur,
            'villes': self.villes,
            'surface_min': self.surface_min,
            'surface_max': self.surface_max,
            'nb_pieces_min': self.nb_pieces_min,
            'nb_pieces_max': self.nb_pieces_max,
            'etat': self.etat,
            'urgence': self.urgence,
            'statut': self.statut,
            'notes': self.notes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

class BienPropose(db.Model):
    __tablename__ = 'biens_proposes'
    
    id = db.Column(db.Integer, primary_key=True)
    lead_id = db.Column(db.Integer, db.ForeignKey('leads.id'), nullable=False)
    source = db.Column(db.String(50), nullable=False)
    source_id = db.Column(db.String(100), nullable=False)
    titre = db.Column(db.Text, nullable=False)
    url = db.Column(db.Text, nullable=False)
    prix_eur = db.Column(db.Integer, nullable=False)
    ville = db.Column(db.String(100))
    code_postal = db.Column(db.String(10))
    surface_m2 = db.Column(db.Integer)
    type_bien = db.Column(db.String(20))
    nb_pieces = db.Column(db.Integer)
    etat = db.Column(db.String(20))
    description = db.Column(db.Text)
    date_publication = db.Column(db.DateTime)
    date_detection = db.Column(db.DateTime, default=datetime.utcnow)
    images = db.Column(db.JSON)
    contact_type = db.Column(db.String(20))
    score_match = db.Column(db.Integer)
    statut = db.Column(db.String(20), default='NOUVEAU')
    coordonnees_gps = db.Column(db.JSON)
    caracteristiques = db.Column(db.JSON)
    
    __table_args__ = (db.UniqueConstraint('source', 'source_id'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'lead_id': self.lead_id,
            'source': self.source,
            'source_id': self.source_id,
            'titre': self.titre,
            'url': self.url,
            'prix_eur': self.prix_eur,
            'ville': self.ville,
            'code_postal': self.code_postal,
            'surface_m2': self.surface_m2,
            'type_bien': self.type_bien,
            'nb_pieces': self.nb_pieces,
            'etat': self.etat,
            'description': self.description,
            'date_publication': self.date_publication.isoformat() if self.date_publication else None,
            'date_detection': self.date_detection.isoformat() if self.date_detection else None,
            'images': self.images,
            'contact_type': self.contact_type,
            'score_match': self.score_match,
            'statut': self.statut,
            'coordonnees_gps': self.coordonnees_gps,
            'caracteristiques': self.caracteristiques
        }

class HistoriqueAction(db.Model):
    __tablename__ = 'historique_actions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    action = db.Column(db.String(100), nullable=False)
    details = db.Column(db.JSON)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

# ==================== DÉCORATEURS ====================

def admin_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or user.role != 'admin':
            return jsonify({'error': 'Accès administrateur requis'}), 403
        return f(*args, **kwargs)
    return decorated_function

def log_action(action, details=None):
    """Décorateur pour logger les actions utilisateur"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                result = f(*args, **kwargs)
                
                # Logger l'action si authentifié
                if hasattr(g, 'current_user_id'):
                    log_entry = HistoriqueAction(
                        user_id=g.current_user_id,
                        action=action,
                        details=details or {},
                        ip_address=request.remote_addr,
                        user_agent=request.headers.get('User-Agent')
                    )
                    db.session.add(log_entry)
                    db.session.commit()
                
                return result
            except Exception as e:
                logger.error(f"Erreur dans {action}: {e}")
                raise
        return decorated_function
    return decorator

# ==================== ROUTES AUTHENTIFICATION ====================

@app.route('/api/auth/register', methods=['POST'])
@log_action('USER_REGISTER')
def register():
    try:
        data = request.get_json()
        
        # Validation
        required_fields = ['email', 'password', 'first_name', 'last_name']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Champ {field} requis'}), 400
        
        # Vérifier si l'utilisateur existe
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email déjà utilisé'}), 400
        
        # Créer l'utilisateur
        user = User(
            email=data['email'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            role=data.get('role', 'agent')
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        # Créer les tokens
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        return jsonify({
            'message': 'Utilisateur créé avec succès',
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user.to_dict()
        }), 201
        
    except Exception as e:
        logger.error(f"Erreur lors de l'inscription: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@app.route('/api/auth/login', methods=['POST'])
@log_action('USER_LOGIN')
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({'error': 'Email et mot de passe requis'}), 400
        
        user = User.query.filter_by(email=email).first()
        
        if not user or not user.check_password(password):
            return jsonify({'error': 'Identifiants invalides'}), 401
        
        if not user.is_active:
            return jsonify({'error': 'Compte désactivé'}), 401
        
        # Créer les tokens
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        # Stocker l'ID utilisateur pour le logging
        g.current_user_id = user.id
        
        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user.to_dict()
        })
        
    except Exception as e:
        logger.error(f"Erreur lors de la connexion: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@app.route('/api/auth/me', methods=['GET'])
@jwt_required()
def get_current_user():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'Utilisateur non trouvé'}), 404
        
        return jsonify({'user': user.to_dict()})
        
    except Exception as e:
        logger.error(f"Erreur lors de la récupération de l'utilisateur: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@app.route('/api/auth/google', methods=['POST'])
@log_action('GOOGLE_LOGIN')
def google_login():
    try:
        data = request.get_json()
        google_token = data.get('token')
        
        if not google_token:
            return jsonify({'error': 'Token Google requis'}), 400
        
        # Vérification du token Google
        google_response = requests.get(
            f'https://www.googleapis.com/oauth2/v1/userinfo?access_token={google_token}'
        )
        
        if google_response.status_code != 200:
            return jsonify({'error': 'Token Google invalide'}), 401
        
        google_data = google_response.json()
        email = google_data.get('email')
        
        # Recherche ou création de l'utilisateur
        user = User.query.filter_by(email=email).first()
        if not user:
            user = User(
                email=email,
                first_name=google_data.get('given_name', ''),
                last_name=google_data.get('family_name', ''),
                is_active=True
            )
            db.session.add(user)
            db.session.commit()
        
        # Créer les tokens
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        return jsonify({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'user': user.to_dict()
        })
        
    except Exception as e:
        logger.error(f"Erreur lors de la connexion Google: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

# ==================== ROUTES LEADS ====================

@app.route('/api/leads', methods=['GET'])
@jwt_required()
def get_leads():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        # Filtrage selon le rôle
        if user.role == 'admin':
            leads = Lead.query.all()
        else:
            leads = Lead.query.filter_by(agent_id=user_id).all()
        
        return jsonify({
            'leads': [lead.to_dict() for lead in leads],
            'total': len(leads)
        })
        
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des leads: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@app.route('/api/leads', methods=['POST'])
@jwt_required()
@log_action('LEAD_CREATE')
def create_lead():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validation des données
        required_fields = ['nom', 'prenom', 'type_bien', 'budget_max_eur', 'villes']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Champ {field} requis'}), 400
        
        # Validation du budget
        if data['budget_max_eur'] <= 0:
            return jsonify({'error': 'Budget doit être positif'}), 400
        
        # Validation des villes
        if not isinstance(data['villes'], list) or len(data['villes']) == 0:
            return jsonify({'error': 'Au moins une ville requise'}), 400
        
        # Création du lead
        lead = Lead(
            agent_id=user_id,
            nom=data['nom'],
            prenom=data['prenom'],
            email=data.get('email'),
            telephone=data.get('telephone'),
            type_bien=data['type_bien'],
            budget_max_eur=data['budget_max_eur'],
            villes=data['villes'],
            surface_min=data.get('surface_min'),
            surface_max=data.get('surface_max'),
            nb_pieces_min=data.get('nb_pieces_min'),
            nb_pieces_max=data.get('nb_pieces_max'),
            etat=data.get('etat'),
            urgence=data.get('urgence', 'MOYENNE'),
            notes=data.get('notes')
        )
        
        db.session.add(lead)
        db.session.commit()
        
        # Déclencher le workflow n8n (optionnel)
        try:
            trigger_n8n_workflow('lead-created', lead.to_dict())
        except Exception as e:
            logger.warning(f"Erreur déclenchement n8n: {e}")
        
        return jsonify({
            'message': 'Lead créé avec succès',
            'lead': lead.to_dict()
        }), 201
        
    except Exception as e:
        logger.error(f"Erreur lors de la création du lead: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@app.route('/api/leads/<int:lead_id>', methods=['GET'])
@jwt_required()
def get_lead(lead_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        # Récupération du lead avec vérification des permissions
        if user.role == 'admin':
            lead = Lead.query.get(lead_id)
        else:
            lead = Lead.query.filter_by(id=lead_id, agent_id=user_id).first()
        
        if not lead:
            return jsonify({'error': 'Lead non trouvé'}), 404
        
        return jsonify({'lead': lead.to_dict()})
        
    except Exception as e:
        logger.error(f"Erreur lors de la récupération du lead: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@app.route('/api/leads/<int:lead_id>', methods=['PUT'])
@jwt_required()
@log_action('LEAD_UPDATE')
def update_lead(lead_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        data = request.get_json()
        
        # Récupération du lead avec vérification des permissions
        if user.role == 'admin':
            lead = Lead.query.get(lead_id)
        else:
            lead = Lead.query.filter_by(id=lead_id, agent_id=user_id).first()
        
        if not lead:
            return jsonify({'error': 'Lead non trouvé'}), 404
        
        # Mise à jour des champs
        updatable_fields = [
            'nom', 'prenom', 'email', 'telephone', 'type_bien', 'budget_max_eur',
            'villes', 'surface_min', 'surface_max', 'nb_pieces_min', 'nb_pieces_max',
            'etat', 'urgence', 'statut', 'notes'
        ]
        
        for field in updatable_fields:
            if field in data:
                setattr(lead, field, data[field])
        
        lead.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'message': 'Lead mis à jour avec succès',
            'lead': lead.to_dict()
        })
        
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour du lead: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

# ==================== ROUTES BIENS ====================

@app.route('/api/leads/<int:lead_id>/biens', methods=['GET'])
@jwt_required()
def get_biens_for_lead(lead_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        # Vérification des permissions sur le lead
        if user.role == 'admin':
            lead = Lead.query.get(lead_id)
        else:
            lead = Lead.query.filter_by(id=lead_id, agent_id=user_id).first()
        
        if not lead:
            return jsonify({'error': 'Lead non trouvé'}), 404
        
        # Récupération des biens
        biens = BienPropose.query.filter_by(lead_id=lead_id).order_by(BienPropose.score_match.desc()).all()
        
        return jsonify({
            'biens': [bien.to_dict() for bien in biens],
            'total': len(biens)
        })
        
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des biens: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@app.route('/api/biens/<int:bien_id>/statut', methods=['PUT'])
@jwt_required()
@log_action('BIEN_UPDATE_STATUT')
def update_bien_statut(bien_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        data = request.get_json()
        
        nouveau_statut = data.get('statut')
        if not nouveau_statut:
            return jsonify({'error': 'Statut requis'}), 400
        
        # Récupération du bien avec vérification des permissions
        bien = BienPropose.query.join(Lead).filter(
            BienPropose.id == bien_id,
            Lead.agent_id == user_id if user.role != 'admin' else True
        ).first()
        
        if not bien:
            return jsonify({'error': 'Bien non trouvé'}), 404
        
        bien.statut = nouveau_statut
        db.session.commit()
        
        return jsonify({
            'message': 'Statut mis à jour avec succès',
            'bien': bien.to_dict()
        })
        
    except Exception as e:
        logger.error(f"Erreur lors de la mise à jour du statut: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

# ==================== ROUTES ADMIN ====================

@app.route('/api/admin/stats', methods=['GET'])
@admin_required
def get_admin_stats():
    try:
        stats = {
            'total_users': User.query.count(),
            'active_users': User.query.filter_by(is_active=True).count(),
            'total_leads': Lead.query.count(),
            'active_leads': Lead.query.filter_by(statut='EN_COURS').count(),
            'total_biens': BienPropose.query.count(),
            'biens_today': BienPropose.query.filter(
                BienPropose.date_detection >= datetime.utcnow().date()
            ).count()
        }
        
        return jsonify(stats)
        
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des stats: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

@app.route('/api/admin/users', methods=['GET'])
@admin_required
def get_all_users():
    try:
        users = User.query.all()
        return jsonify({
            'users': [user.to_dict() for user in users],
            'total': len(users)
        })
        
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des utilisateurs: {e}")
        return jsonify({'error': 'Erreur interne du serveur'}), 500

# ==================== ROUTES SYSTÈME ====================

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check avec test de connexion base de données"""
    try:
        # Import SQLAlchemy text pour SQLA 2.x
        from sqlalchemy import text
        
        # Test de connexion à la base de données
        with db.engine.connect() as connection:
            result = connection.execute(text("SELECT 1 as health_check"))
            db_status = "connected" if result.fetchone()[0] == 1 else "error"
        
        logger.info("Health check réussi - Base de données connectée")
        
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'version': '1.0.0',
            'database': db_status,
            'components': {
                'api': 'operational',
                'database': db_status,
                'auth': 'operational'
            }
        })
        
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e),
            'timestamp': datetime.utcnow().isoformat(),
            'database': 'disconnected'
        }), 500

# ==================== FONCTIONS UTILITAIRES ====================

def trigger_n8n_workflow(workflow_name, data):
    """Déclencher un workflow n8n"""
    try:
        n8n_webhook_url = os.getenv('N8N_WEBHOOK_URL', 'http://localhost:5678/webhook')
        response = requests.post(f"{n8n_webhook_url}/{workflow_name}", json=data, timeout=10)
        response.raise_for_status()
        logger.info(f"Workflow {workflow_name} déclenché avec succès")
    except Exception as e:
        logger.error(f"Erreur déclenchement workflow {workflow_name}: {e}")
        raise

# ==================== INITIALISATION ====================

# Initialisation de la base de données
with app.app_context():
    try:
        db.create_all()
        
        # Créer un utilisateur admin par défaut
        admin = User.query.filter_by(email='admin@sigmamatching.com').first()
        if not admin:
            admin = User(
                email='admin@sigmamatching.com',
                first_name='Admin',
                last_name='Sigma',
                role='admin',
                is_active=True
            )
            admin.set_password('admin123')  # À changer en production !
            db.session.add(admin)
            db.session.commit()
            logger.info("Utilisateur admin créé")
            
    except Exception as e:
        logger.error(f"Erreur lors de l'initialisation: {e}")

# ==================== GESTION D'ERREURS ====================

@app.errorhandler(404)
def not_found(error):
    return jsonify({'error': 'Ressource non trouvée'}), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    return jsonify({'error': 'Erreur interne du serveur'}), 500

@jwt.expired_token_loader
def expired_token_callback(jwt_header, jwt_payload):
    return jsonify({'error': 'Token expiré'}), 401

@jwt.invalid_token_loader
def invalid_token_callback(error):
    return jsonify({'error': 'Token invalide'}), 401

@jwt.unauthorized_loader
def missing_token_callback(error):
    return jsonify({'error': 'Token d\'authentification requis'}), 401

# ==================== DÉMARRAGE ====================

if __name__ == '__main__':
    # Configuration pour le développement
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        debug=os.getenv('FLASK_ENV') == 'development'
    )

