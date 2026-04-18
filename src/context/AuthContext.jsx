import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('scxray_jwt') || null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            api.setToken(token);
            localStorage.setItem('scxray_jwt', token);
            checkUser();
        } else {
            localStorage.removeItem('scxray_jwt');
            api.setToken(null);
            setUser(null);
            setLoading(false);
        }
    }, [token]);

    const checkUser = async () => {
        try {
            const data = await api.getMe();
            setUser(data.user);
        } catch (err) {
            console.error('[Auth] Failed to load user:', err);
            logout();
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        const data = await api.login({ email, password });
        setToken(data.token);
        setUser(data.user);
        return data;
    };

    const register = async (username, email, password) => {
        const data = await api.register({ username, email, password });
        setToken(data.token);
        setUser(data.user);
        return data;
    };

    const logout = () => {
        setToken(null);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
            {children}
        </AuthContext.Provider>
    );
};
