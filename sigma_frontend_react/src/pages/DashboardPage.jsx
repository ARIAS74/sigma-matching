import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { Users, Home, TrendingUp, Clock, Plus, Eye, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { adminService, leadsService } from '../utils/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';

const DashboardPage = () => {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    total_leads: 0,
    active_leads: 0,
    total_biens: 0,
    biens_today: 0
  });
  const [recentLeads, setRecentLeads] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Récupérer les statistiques
      if (isAdmin()) {
        const statsResponse = await adminService.getStats();
        setStats(statsResponse.data);
      }
      
      // Récupérer les leads récents
      const leadsResponse = await leadsService.getAll();
      setRecentLeads(leadsResponse.data.leads.slice(0, 5));
      
      // Générer des données de graphique (simulation)
      const mockChartData = [
        { day: 'Lun', leads: 12, biens: 45, matches: 8 },
        { day: 'Mar', leads: 19, biens: 52, matches: 12 },
        { day: 'Mer', leads: 8, biens: 38, matches: 6 },
        { day: 'Jeu', leads: 15, biens: 48, matches: 10 },
        { day: 'Ven', leads: 22, biens: 61, matches: 15 },
        { day: 'Sam', leads: 6, biens: 25, matches: 4 },
        { day: 'Dim', leads: 4, biens: 18, matches: 2 }
      ];
      setChartData(mockChartData);
      
    } catch (error) {
      console.error('Erreur lors du chargement du dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  // Données pour le graphique en secteurs
  const pieData = [
    { name: 'En cours', value: stats.active_leads, color: '#3B82F6' },
    { name: 'Terminés', value: stats.total_leads - stats.active_leads, color: '#10B981' },
    { name: 'En attente', value: Math.floor(stats.total_leads * 0.1), color: '#F59E0B' }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Bonjour {user?.first_name} 👋
          </h1>
          <p className="text-gray-600 mt-1">
            Voici un aperçu de votre activité Sigma Matching
          </p>
        </div>
        <div className="flex space-x-3">
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Nouveau Lead
          </button>
        </div>
      </div>

      {/* Cartes de statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Leads"
          value={stats.total_leads}
          icon={Users}
          color="blue"
          change="+12%"
          changeType="positive"
        />
        <StatsCard
          title="Leads Actifs"
          value={stats.active_leads}
          icon={Clock}
          color="green"
          change="+8%"
          changeType="positive"
        />
        <StatsCard
          title="Biens Détectés"
          value={stats.total_biens}
          icon={Home}
          color="purple"
          change="+24%"
          changeType="positive"
        />
        <StatsCard
          title="Matches Aujourd'hui"
          value={stats.biens_today}
          icon={TrendingUp}
          color="orange"
          change="+15%"
          changeType="positive"
        />
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Graphique en barres - Activité hebdomadaire */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Activité des 7 derniers jours
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="leads" fill="#3B82F6" name="Nouveaux leads" />
              <Bar dataKey="biens" fill="#10B981" name="Biens détectés" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Graphique en secteurs - Répartition des leads */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Répartition des leads
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Graphique linéaire - Tendance des matches */}
      <div className="bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Évolution des matches
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="matches" 
              stroke="#F59E0B" 
              strokeWidth={3}
              name="Matches trouvés"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Leads récents et activité */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leads récents */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Leads récents
            </h2>
            <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
              Voir tout
            </button>
          </div>
          <div className="space-y-4">
            {recentLeads.map((lead) => (
              <div key={lead.id} className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {lead.prenom} {lead.nom}
                  </p>
                  <p className="text-sm text-gray-500">
                    {lead.type_bien} • {lead.budget_max_eur?.toLocaleString()}€
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    lead.urgence === 'FORTE' ? 'bg-red-100 text-red-800' :
                    lead.urgence === 'MOYENNE' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {lead.urgence}
                  </span>
                  <button className="text-gray-400 hover:text-gray-600">
                    <Eye className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activité récente */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Activité récente
          </h2>
          <div className="space-y-4">
            {[
              {
                id: 1,
                action: 'Nouveau bien détecté',
                description: 'Appartement 3P à Paris 15ème',
                time: 'Il y a 5 min',
                icon: Home,
                color: 'text-green-600 bg-green-100'
              },
              {
                id: 2,
                action: 'Lead mis à jour',
                description: 'Marie Dubois - Budget augmenté',
                time: 'Il y a 15 min',
                icon: Users,
                color: 'text-blue-600 bg-blue-100'
              },
              {
                id: 3,
                action: 'Match trouvé',
                description: 'Score 95% pour Jean Martin',
                time: 'Il y a 32 min',
                icon: CheckCircle,
                color: 'text-purple-600 bg-purple-100'
              },
              {
                id: 4,
                action: 'Alerte système',
                description: 'Connecteur SeLoger ralenti',
                time: 'Il y a 1h',
                icon: AlertCircle,
                color: 'text-orange-600 bg-orange-100'
              }
            ].map((activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div className={`p-2 rounded-full ${activity.color}`}>
                  <activity.icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.action}
                  </p>
                  <p className="text-sm text-gray-500">
                    {activity.description}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {activity.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Composant pour les cartes de statistiques
const StatsCard = ({ title, value, icon: Icon, color, change, changeType }) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500'
  };

  const changeColorClasses = {
    positive: 'text-green-600',
    negative: 'text-red-600',
    neutral: 'text-gray-600'
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
        </div>
        <div className={`p-3 rounded-full ${colorClasses[color]}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
      {change && (
        <div className="mt-4 flex items-center">
          <span className={`text-sm font-medium ${changeColorClasses[changeType]}`}>
            {change}
          </span>
          <span className="text-sm text-gray-500 ml-2">vs mois dernier</span>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;

