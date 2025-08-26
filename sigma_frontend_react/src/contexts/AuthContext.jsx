import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../utils/api';
import toast from 'react-hot-toast';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('sigma_token'));

  // Configurer axios avec le token
  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  // Récupérer les informations de l'utilisateur
  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data.user);
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'utilisateur:', error);
      // Token invalide, déconnecter l'utilisateur
      logout();
    } finally {
      setLoading(false);
    }
  };

  // Connexion avec email/mot de passe
  const login = async (email, password) => {
    try {
      setLoading(true);
      const response = await api.post('/auth/login', { email, password });
      const { token: newToken, user: userData } = response.data;
      
      // Sauvegarder le token
      localStorage.setItem('sigma_token', newToken);
      setToken(newToken);
      setUser(userData);
      
      // Configurer axios
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      toast.success(`Bienvenue ${userData.first_name} !`);
      return { success: true };
      
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Erreur de connexion';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Inscription
  const register = async (userData) => {
    try {
      setLoading(true);
      const response = await api.post('/auth/register', userData);
      const { token: newToken, user: newUser } = response.data;
      
      // Sauvegarder le token
      localStorage.setItem('sigma_token', newToken);
      setToken(newToken);
      setUser(newUser);
      
      // Configurer axios
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      toast.success(`Compte créé avec succès ! Bienvenue ${newUser.first_name} !`);
      return { success: true };
      
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Erreur lors de la création du compte';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Connexion Google OAuth
  const loginWithGoogle = async (googleToken) => {
    try {
      setLoading(true);
      const response = await api.post('/auth/google', { token: googleToken });
      const { token: newToken, user: userData } = response.data;
      
      // Sauvegarder le token
      localStorage.setItem('sigma_token', newToken);
      setToken(newToken);
      setUser(userData);
      
      // Configurer axios
      api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
      
      toast.success(`Connexion Google réussie ! Bienvenue ${userData.first_name} !`);
      return { success: true };
      
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Erreur de connexion Google';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  // Déconnexion
  const logout = () => {
    localStorage.removeItem('sigma_token');
    setToken(null);
    setUser(null);
    delete api.defaults.headers.common['Authorization'];
    toast.success('Déconnexion réussie');
  };

  // Mettre à jour le profil utilisateur
  const updateProfile = async (profileData) => {
    try {
      const response = await api.put('/auth/profile', profileData);
      setUser(response.data.user);
      toast.success('Profil mis à jour avec succès');
      return { success: true };
    } catch (error) {
      const errorMessage = error.response?.data?.error || 'Erreur lors de la mise à jour du profil';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  // Vérifier si l'utilisateur est admin
  const isAdmin = () => {
    return user?.role === 'admin';
  };

  // Vérifier si l'utilisateur est authentifié
  const isAuthenticated = !!user && !!token;

  const value = {
    user,
    token,
    loading,
    isAuthenticated,
    isAdmin,
    login,
    register,
    loginWithGoogle,
    logout,
    updateProfile,
    fetchUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

