import React, { useState, useEffect } from 'react';
import { Search, Filter, ExternalLink, MapPin, Home, Star } from 'lucide-react';
import { biensService } from '../utils/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const BiensPage = () => {
  const [biens, setBiens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSource, setFilterSource] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    fetchBiens();
  }, []);

  const fetchBiens = async () => {
    try {
      setLoading(true);
      const response = await biensService.getAll();
      setBiens(response.data.biens || []);
    } catch (error) {
      console.error('Erreur lors du chargement des biens:', error);
      toast.error('Erreur lors du chargement des biens');
    } finally {
      setLoading(false);
    }
  };

  const updateBienStatus = async (bienId, newStatus) => {
    try {
      await biensService.updateStatus(bienId, newStatus);
      setBiens(biens.map(bien => 
        bien.id === bienId ? { ...bien, statut: newStatus } : bien
      ));
      toast.success('Statut mis à jour avec succès');
    } catch (error) {
      console.error('Erreur lors de la mise à jour du statut:', error);
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  // Filtrer les biens
  const filteredBiens = biens.filter(bien => {
    const matchesSearch = 
      bien.titre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bien.ville?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bien.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSource = filterSource === 'all' || bien.source === filterSource;
    const matchesStatus = filterStatus === 'all' || bien.statut === filterStatus;
    
    return matchesSearch && matchesSource && matchesStatus;
  });

  if (loading) {
    return <LoadingSpinner text="Chargement des biens..." />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Biens Immobiliers</h1>
          <p className="text-gray-600 mt-1">
            Découvrez les biens détectés automatiquement pour vos leads
          </p>
        </div>
      </div>

      {/* Filtres et recherche */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Barre de recherche */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher par titre, ville ou description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Filtre par source */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">Toutes les sources</option>
              <option value="LEBONCOIN">LeBonCoin</option>
              <option value="SELOGER">SeLoger</option>
              <option value="BIENICI">Bien'ici</option>
            </select>
          </div>

          {/* Filtre par statut */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
            >
              <option value="all">Tous les statuts</option>
              <option value="NOUVEAU">Nouveau</option>
              <option value="VU">Vu</option>
              <option value="INTERESSE">Intéressé</option>
              <option value="REJETE">Rejeté</option>
            </select>
          </div>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <Home className="w-8 h-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{biens.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-green-600 rounded-full"></div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Nouveaux</p>
              <p className="text-2xl font-bold text-gray-900">
                {biens.filter(b => b.statut === 'NOUVEAU').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <Star className="w-8 h-8 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Score moyen</p>
              <p className="text-2xl font-bold text-gray-900">
                {biens.length > 0 
                  ? Math.round(biens.reduce((acc, b) => acc + (b.score_match || 0), 0) / biens.length)
                  : 0
                }%
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <div className="w-3 h-3 bg-purple-600 rounded-full"></div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Aujourd'hui</p>
              <p className="text-2xl font-bold text-gray-900">
                {biens.filter(b => {
                  const bienDate = new Date(b.date_detection);
                  const today = new Date();
                  return bienDate.toDateString() === today.toDateString();
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Liste des biens */}
      <div className="space-y-4">
        {filteredBiens.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Home className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun bien trouvé</h3>
            <p className="text-gray-600">
              {searchTerm || filterSource !== 'all' || filterStatus !== 'all'
                ? 'Aucun bien ne correspond à vos critères de recherche.'
                : 'Les biens détectés automatiquement apparaîtront ici.'
              }
            </p>
          </div>
        ) : (
          filteredBiens.map((bien) => (
            <BienCard 
              key={bien.id} 
              bien={bien} 
              onStatusUpdate={updateBienStatus}
            />
          ))
        )}
      </div>
    </div>
  );
};

// Composant pour afficher un bien
const BienCard = ({ bien, onStatusUpdate }) => {
  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getSourceColor = (source) => {
    switch (source) {
      case 'LEBONCOIN': return 'bg-orange-100 text-orange-800';
      case 'SELOGER': return 'bg-blue-100 text-blue-800';
      case 'BIENICI': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* En-tête */}
            <div className="flex items-center space-x-3 mb-3">
              <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">
                {bien.titre}
              </h3>
              {bien.score_match && (
                <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getScoreColor(bien.score_match)}`}>
                  {bien.score_match}% match
                </span>
              )}
            </div>

            {/* Informations principales */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {bien.prix_eur?.toLocaleString()}€
                </p>
                <p className="text-sm text-gray-500">Prix</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {bien.surface_m2 ? `${bien.surface_m2} m²` : 'N/A'}
                </p>
                <p className="text-sm text-gray-500">Surface</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {bien.nb_pieces ? `${bien.nb_pieces} pièces` : 'N/A'}
                </p>
                <p className="text-sm text-gray-500">Pièces</p>
              </div>
            </div>

            {/* Localisation */}
            <div className="flex items-center text-gray-600 mb-3">
              <MapPin className="w-4 h-4 mr-2" />
              <span>{bien.ville} {bien.code_postal && `(${bien.code_postal})`}</span>
            </div>

            {/* Description */}
            {bien.description && (
              <p className="text-gray-600 text-sm line-clamp-3 mb-4">
                {bien.description}
              </p>
            )}

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getSourceColor(bien.source)}`}>
                {bien.source}
              </span>
              {bien.type_bien && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                  {bien.type_bien}
                </span>
              )}
              {bien.etat && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                  {bien.etat}
                </span>
              )}
              {bien.contact_type && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                  {bien.contact_type}
                </span>
              )}
            </div>
          </div>

          {/* Image (si disponible) */}
          {bien.images && bien.images.length > 0 && (
            <div className="ml-6 flex-shrink-0">
              <img
                src={bien.images[0]}
                alt={bien.titre}
                className="w-32 h-24 object-cover rounded-lg"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="flex items-center space-x-4">
            <select
              value={bien.statut}
              onChange={(e) => onStatusUpdate(bien.id, e.target.value)}
              className="text-sm border border-gray-300 rounded-md px-3 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="NOUVEAU">Nouveau</option>
              <option value="VU">Vu</option>
              <option value="INTERESSE">Intéressé</option>
              <option value="REJETE">Rejeté</option>
            </select>
            
            <span className="text-sm text-gray-500">
              Détecté le {new Date(bien.date_detection).toLocaleDateString('fr-FR')}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href={bien.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Voir l'annonce
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BiensPage;

