# 🚀 Sigma Matching - Agent IA Autonome pour l'Immobilier

## 📋 Description

Sigma Matching est un agent IA autonome conçu pour les agents immobiliers. Il automatise la recherche et le matching de biens immobiliers selon les critères spécifiques des leads.

## 🎯 Fonctionnalités

- ✅ **Gestion des leads** avec critères de recherche détaillés
- ✅ **Scraping automatique** des sites immobiliers (LeBonCoin, SeLoger, Bien'ici)
- ✅ **Matching IA** avec scoring intelligent (0-100%)
- ✅ **Interface React moderne** avec tableaux de bord interactifs
- ✅ **Authentification sécurisée** (JWT + OAuth Google)
- ✅ **API REST complète** avec documentation
- ✅ **Workflows n8n** pour l'automatisation
- ✅ **Déduplication avancée** des biens
- ✅ **Notifications multi-canal** (email + in-app)

## 🏗️ Architecture

### Backend (2 versions disponibles)
- **Python Flask** (recommandé) - `sigma_backend_python/`
- **Node.js Express** (alternative) - `sigma_backend_nodejs/`

### Frontend
- **React 18** avec Vite - `sigma_frontend_react/`
- **Tailwind CSS** pour le design
- **Recharts** pour les graphiques

### Base de données
- **PostgreSQL** avec Row Level Security (RLS)
- **Schéma complet** - `database_schema.sql`

## 🚀 Installation Rapide

### 1. Base de données
```bash
sudo -u postgres createdb sigma_matching
sudo -u postgres psql -d sigma_matching -f database_schema.sql
```

### 2. Backend Python (Recommandé)
```bash
cd sigma_backend_python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Configurer les variables
python app.py
```

### 3. Frontend React
```bash
cd sigma_frontend_react
npm install
npm run build  # Pour la production
# ou npm run dev pour le développement
```

## 🔧 Configuration

### Variables d'environnement Backend
```env
DATABASE_URL=postgresql://sigma_user:password@localhost/sigma_matching
JWT_SECRET_KEY=your-secret-key
FLASK_ENV=production
```

### Variables d'environnement Frontend
```env
VITE_API_BASE_URL=https://api.votre-domaine.com
```

## 📚 Documentation

- **API Documentation** : `/api/docs` (Swagger)
- **Guide développeur** : Voir documentation complète
- **Guide utilisateur** : Interface intuitive

## 🆘 Support

Pour toute question ou problème :
- Email : support@sigma-matching.com
- Documentation : Consultez les fichiers README dans chaque dossier

## 📄 Licence

MIT License - Voir LICENSE pour plus de détails.

---

*Développé avec ❤️ par l'équipe Sigma Matching*

