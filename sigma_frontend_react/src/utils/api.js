import axios from 'axios';
import toast from 'react-hot-toast';

// Configuration de base d'axios
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 secondes
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour les requêtes
api.interceptors.request.use(
  (config) => {
    // Ajouter le token d'authentification si disponible
    const token = localStorage.getItem('sigma_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log des requêtes en développement
    if (import.meta.env.DEV) {
      console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`, config.data);
    }
    
    return config;
  },
  (error) => {
    console.error('Erreur de requête:', error);
    return Promise.reject(error);
  }
);

// Intercepteur pour les réponses
api.interceptors.response.use(
  (response) => {
    // Log des réponses en développement
    if (import.meta.env.DEV) {
      console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url}`, response.data);
    }
    
    return response;
  },
  (error) => {
    // Log des erreurs
    console.error('Erreur de réponse:', error);
    
    // Gestion des erreurs communes
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // Token expiré ou invalide
          if (data.error?.includes('Token') || data.error?.includes('token')) {
            localStorage.removeItem('sigma_token');
            delete api.defaults.headers.common['Authorization'];
            toast.error('Session expirée, veuillez vous reconnecter');
            // Rediriger vers la page de connexion
            window.location.href = '/auth';
          }
          break;
          
        case 403:
          toast.error('Accès non autorisé');
          break;
          
        case 404:
          toast.error('Ressource non trouvée');
          break;
          
        case 429:
          toast.error('Trop de requêtes, veuillez patienter');
          break;
          
        case 500:
          toast.error('Erreur serveur, veuillez réessayer plus tard');
          break;
          
        default:
          if (data.error) {
            toast.error(data.error);
          } else {
            toast.error('Une erreur est survenue');
          }
      }
    } else if (error.request) {
      // Erreur réseau
      toast.error('Erreur de connexion au serveur');
    } else {
      // Autre erreur
      toast.error('Une erreur inattendue est survenue');
    }
    
    return Promise.reject(error);
  }
);

// ==================== SERVICES API ====================

// Service d'authentification
export const authService = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  register: (userData) => api.post('/auth/register', userData),
  googleLogin: (token) => api.post('/auth/google', { token }),
  getProfile: () => api.get('/auth/me'),
  updateProfile: (profileData) => api.put('/auth/profile', profileData),
};

// Service des leads
export const leadsService = {
  getAll: () => api.get('/leads'),
  getById: (id) => api.get(`/leads/${id}`),
  create: (leadData) => api.post('/leads', leadData),
  update: (id, leadData) => api.put(`/leads/${id}`, leadData),
  delete: (id) => api.delete(`/leads/${id}`),
  getBiens: (leadId) => api.get(`/leads/${leadId}/biens`),
};

// Service des biens
export const biensService = {
  updateStatus: (bienId, status) => api.put(`/biens/${bienId}/statut`, { statut: status }),
  getById: (id) => api.get(`/biens/${id}`),
  getAll: (params = {}) => api.get('/biens', { params }),
};

// Service admin
export const adminService = {
  getStats: () => api.get('/admin/stats'),
  getUsers: () => api.get('/admin/users'),
  updateUser: (userId, userData) => api.put(`/admin/users/${userId}`, userData),
  deleteUser: (userId) => api.delete(`/admin/users/${userId}`),
  getSystemHealth: () => api.get('/health'),
};

// Service de notifications
export const notificationsService = {
  getAll: () => api.get('/notifications'),
  markAsRead: (notificationId) => api.put(`/notifications/${notificationId}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
};

// ==================== UTILITAIRES ====================

// Fonction pour gérer les erreurs de formulaire
export const handleFormError = (error, setError) => {
  if (error.response?.data?.errors) {
    // Erreurs de validation
    const errors = error.response.data.errors;
    Object.keys(errors).forEach(field => {
      setError(field, { message: errors[field][0] });
    });
  } else if (error.response?.data?.error) {
    // Erreur générale
    toast.error(error.response.data.error);
  } else {
    // Erreur inconnue
    toast.error('Une erreur est survenue');
  }
};

// Fonction pour télécharger un fichier
export const downloadFile = async (url, filename) => {
  try {
    const response = await api.get(url, { responseType: 'blob' });
    const blob = new Blob([response.data]);
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);
    toast.success('Fichier téléchargé avec succès');
  } catch (error) {
    console.error('Erreur téléchargement:', error);
    toast.error('Erreur lors du téléchargement');
  }
};

// Fonction pour uploader un fichier
export const uploadFile = async (file, endpoint, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  
  try {
    const response = await api.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress) {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          onProgress(percentCompleted);
        }
      },
    });
    
    toast.success('Fichier uploadé avec succès');
    return response.data;
  } catch (error) {
    console.error('Erreur upload:', error);
    toast.error('Erreur lors de l\'upload');
    throw error;
  }
};

// Fonction pour formater les erreurs de validation
export const formatValidationErrors = (errors) => {
  if (typeof errors === 'string') {
    return errors;
  }
  
  if (Array.isArray(errors)) {
    return errors.join(', ');
  }
  
  if (typeof errors === 'object') {
    return Object.values(errors).flat().join(', ');
  }
  
  return 'Erreur de validation';
};

// Fonction pour retry automatique
export const retryRequest = async (requestFn, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      
      // Ne pas retry sur certaines erreurs
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw error;
      }
      
      // Attendre avant le prochain essai
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError;
};

export default api;

