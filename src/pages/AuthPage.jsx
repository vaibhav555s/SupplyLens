import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ShimmerButton from '../components/UI/ShimmerButton';

const AuthPage = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login, register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLogin) {
                await login(email, password);
            } else {
                await register(username, email, password);
            }
            navigate('/dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                style={{
                    width: '100%',
                    maxWidth: '420px',
                    background: 'rgba(17, 17, 24, 0.7)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    borderRadius: '24px',
                    padding: '40px',
                    position: 'relative',
                    overflow: 'hidden'
                }}
            >
                {/* Background glow */}
                <div style={{
                    position: 'absolute', top: -50, left: -50, width: 200, height: 200,
                    background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
                    borderRadius: '50%', pointerEvents: 'none'
                }} />

                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{ fontFamily: 'Sora, sans-serif', fontSize: '28px', color: '#f8fafc', marginBottom: '8px' }}>
                        {isLogin ? 'Welcome Back' : 'Create Account'}
                    </h1>
                    <p style={{ fontFamily: 'Inter, sans-serif', color: '#94a3b8', fontSize: '14px' }}>
                        {isLogin ? 'Sign in to trace supply chains' : 'Join to build your intel dashboard'}
                    </p>
                </div>

                <AnimatePresence mode="wait">
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{
                                background: 'rgba(239,68,68,0.1)',
                                border: '1px solid rgba(239,68,68,0.2)',
                                borderRadius: '12px',
                                padding: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#ef4444',
                                fontSize: '13px',
                                fontFamily: 'Inter, sans-serif',
                                marginBottom: '24px'
                            }}
                        >
                            <AlertCircle size={16} />
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {!isLogin && (
                        <div>
                            <input
                                type="text"
                                placeholder="Username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                style={{
                                    width: '100%',
                                    padding: '14px 16px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    color: '#f8fafc',
                                    fontFamily: 'Inter, sans-serif',
                                    fontSize: '15px',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                    )}
                    <div>
                        <input
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                color: '#f8fafc',
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '15px',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '14px 16px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: '12px',
                                color: '#f8fafc',
                                fontFamily: 'Inter, sans-serif',
                                fontSize: '15px',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <ShimmerButton type="submit" style={{ width: '100%', marginTop: '8px', padding: '16px' }} disabled={loading}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                            {loading ? (
                                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                                    ◈
                                </motion.div>
                            ) : (
                                <>
                                    {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                                    {isLogin ? 'Sign In' : 'Create Account'}
                                </>
                            )}
                        </div>
                    </ShimmerButton>
                </form>

                <div style={{ textAlign: 'center', marginTop: '24px' }}>
                    <button
                        onClick={() => { setIsLogin(!isLogin); setError(''); }}
                        style={{
                            background: 'none', border: 'none', color: '#94a3b8',
                            fontFamily: 'Inter, sans-serif', fontSize: '14px',
                            cursor: 'pointer', textDecoration: 'underline'
                        }}
                    >
                        {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export default AuthPage;
