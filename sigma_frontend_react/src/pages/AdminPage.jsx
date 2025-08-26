import React, { useState, useEffect } from 'react';
import { Users, Activity, Database, Settings, Shield, AlertTriangle } from 'lucide-react';
import { adminService } from '../utils/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import toast from 'react-hot-toast';

const AdminPage = () => {
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [systemHealth, setSystemHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [statsResponse, usersResponse, healthResponse] = await Promise.all([
        adminService.getStats(),
        adminService.getUsers(),
        adminService.getSystemHealth()
      ]);

      setStats(statsResponse.data);
      setUsers(usersResponse.data.users);
      setSystemHealth(healthResponse.data);
    } catch (error) {
      console.error('Erreur lors du chargement des données admin:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Chargement du panneau d'administration..." />;
  }

  const tabs = [
    { id: 'overview', name: 'Vue d\'ensemble', icon: Activity },
    { id: 'users', name: 'Utilisateurs', icon: Users },
    { id: 'system', name: 'Système', icon: Database },
    { id: 'settings', name: 'Paramètres', icon: Settings }
  ];

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Shield className="w-8 h-8 mr-3 text-purple-600" />
            Administration
          </h1>
          <p className="text-gray-600 mt-1">
            Panneau de contrôle et gestion du système Sigma Matching
          </p>
        </div>
      </div>

      {/* Alerte système si nécessaire */}
      {systemHealth?.status !== 'healthy' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
            <span className="text-red-800 font-medium">
              Problème système détecté : {systemHealth?.error || 'Statut inconnu'}
            </span>
          </div>
        </div>
      )}

      {/* Onglets */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center ${
                activeTab === tab.id
                  ? 'border-purple-500 text-purple-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.name}
            </button>
          ))}
        </nav>
      </div>

      {/* Contenu des onglets */}
      {activeTab === 'overview' && <OverviewTab stats={stats} systemHealth={systemHealth} />}
      {activeTab === 'users' && <UsersTab users={users} onRefresh={fetchAdminData} />}
      {activeTab === 'system' && <SystemTab systemHealth={systemHealth} />}
      {activeTab === 'settings' && <SettingsTab />}
    </div>
  );
};

// Onglet Vue d'ensemble
const OverviewTab = ({ stats, systemHealth }) => {
  return (
    <div className="space-y-6">
      {/* Statistiques principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Utilisateurs Total"
          value={stats.total_users || 0}
          icon={Users}
          color="blue"
          subtitle={`${stats.active_users || 0} actifs`}
        />
        <StatCard
          title="Leads Total"
          value={stats.total_leads || 0}
          icon={Activity}
          color="green"
          subtitle={`${stats.active_leads || 0} en cours`}
        />
        <StatCard
          title="Biens Détectés"
          value={stats.total_biens || 0}
          icon={Database}
          color="purple"
          subtitle={`${stats.biens_today || 0} aujourd'hui`}
        />
        <StatCard
          title="Système"
          value={systemHealth?.status === 'healthy' ? 'OK' : 'Erreur'}
          icon={Shield}
          color={systemHealth?.status === 'healthy' ? 'green' : 'red'}
          subtitle={systemHealth?.timestamp ? new Date(systemHealth.timestamp).toLocaleTimeString('fr-FR') : 'N/A'}
        />
      </div>

      {/* Activité récente */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Activité système récente
        </h3>
        <div className="space-y-3">
          {[
            { time: '14:32', event: 'Nouveau lead créé par Marie Dubois', type: 'success' },
            { time: '14:15', event: '15 nouveaux biens détectés sur LeBonCoin', type: 'info' },
            { time: '13:45', event: 'Utilisateur Jean Martin connecté', type: 'info' },
            { time: '13:30', event: 'Sauvegarde automatique effectuée', type: 'success' },
            { time: '12:15', event: 'Connecteur SeLoger temporairement indisponible', type: 'warning' }
          ].map((activity, index) => (
            <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className={`w-2 h-2 rounded-full ${
                activity.type === 'success' ? 'bg-green-500' :
                activity.type === 'warning' ? 'bg-yellow-500' :
                activity.type === 'error' ? 'bg-red-500' :
                'bg-blue-500'
              }`} />
              <span className="text-sm text-gray-600">{activity.time}</span>
              <span className="text-sm text-gray-900 flex-1">{activity.event}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Onglet Utilisateurs
const UsersTab = ({ users, onRefresh }) => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Gestion des utilisateurs
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Utilisateur
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rôle
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Statut
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Inscription
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-white">
                          {user.first_name?.[0]}{user.last_name?.[0]}
                        </span>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.role === 'admin' 
                        ? 'bg-purple-100 text-purple-800' 
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {user.role === 'admin' ? 'Administrateur' : 'Agent'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      user.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(user.created_at).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 mr-3">
                      Modifier
                    </button>
                    <button className="text-red-600 hover:text-red-900">
                      {user.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Onglet Système
const SystemTab = ({ systemHealth }) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Santé du système */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Santé du système
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">API Backend</span>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                systemHealth?.status === 'healthy' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {systemHealth?.status === 'healthy' ? 'OK' : 'Erreur'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Base de données</span>
              <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                systemHealth?.database === 'connected' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {systemHealth?.database === 'connected' ? 'Connectée' : 'Déconnectée'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Connecteurs</span>
              <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                Partiel
              </span>
            </div>
          </div>
        </div>

        {/* Informations système */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Informations système
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Version</span>
              <span className="text-sm font-medium text-gray-900">
                {systemHealth?.version || '1.0.0'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Dernière mise à jour</span>
              <span className="text-sm font-medium text-gray-900">
                {systemHealth?.timestamp 
                  ? new Date(systemHealth.timestamp).toLocaleString('fr-FR')
                  : 'N/A'
                }
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Uptime</span>
              <span className="text-sm font-medium text-gray-900">
                2j 14h 32m
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Onglet Paramètres
const SettingsTab = () => {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Configuration système
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Notifications email</h4>
              <p className="text-sm text-gray-600">Envoyer des notifications par email</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <h4 className="font-medium text-gray-900">Scraping automatique</h4>
              <p className="text-sm text-gray-600">Activer la collecte automatique de biens</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" defaultChecked />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

// Composant pour les cartes de statistiques
const StatCard = ({ title, value, icon: Icon, color, subtitle }) => {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    red: 'bg-red-500'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-full ${colorClasses[color]}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );
};

export default AdminPage;

