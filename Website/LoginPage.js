import React, { useState, useEffect } from 'react';
import { trackEvent } from './firebase';
import { sendPasswordResetEmail, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, db, googleProvider } from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const LoginPage = ({ navigateTo, loginData, setLoginData, handleLogin, loading, error }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [validations, setValidations] = useState({
    email: true
  });
  const [touched, setTouched] = useState({
    email: false
  });
  const [boxHovered, setBoxHovered] = useState(false);
  const [isExtensionLogin, setIsExtensionLogin] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  
  // ===== FORGOT PASSWORD STATE =====
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState('');
  const [forgotPasswordError, setForgotPasswordError] = useState('');

  // ===== EMAIL VERIFICATION STATE =====
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendVerificationEmail, setResendVerificationEmail] = useState('');
  const [resendVerificationLoading, setResendVerificationLoading] = useState(false);
  const [resendVerificationMessage, setResendVerificationMessage] = useState('');
  const [resendVerificationError, setResendVerificationError] = useState('');
  const [showVerificationError, setShowVerificationError] = useState(false);

  // ===== GOOGLE AUTHENTICATION =====
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    
    try {
      trackEvent('google_login_started', {
        timestamp: new Date().toISOString()
      });
      
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      console.log('✅ Google sign-in successful:', user.email);
      
      // Check if user document exists in Firestore
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        // New user - create document with Google info
        console.log('🆕 Creating new user document for Google user');
        
        await setDoc(userRef, {
          userId: user.uid,
          firstName: user.displayName?.split(' ')[0] || '',
          lastName: user.displayName?.split(' ').slice(1).join(' ') || '',
          username: user.displayName || user.email.split('@')[0],
          email: user.email,
          photoURL: user.photoURL,
          provider: 'google',
          createdAt: new Date().toISOString(),
          subscriptionStatus: 'free',
          credits: 250, // Same as your signup system
          emailVerified: true, // Google emails are verified
          emailVerifiedAt: new Date().toISOString()
        });
        
        trackEvent('google_user_created', {
          user_id: user.uid,
          email: user.email
        });
      } else {
        // Existing user - update verification status if needed
        const userData = userDoc.data();
        if (!userData.emailVerified) {
          await updateDoc(userRef, {
            emailVerified: true,
            emailVerifiedAt: new Date().toISOString(),
            photoURL: user.photoURL
          });
        }
      }
      
      trackEvent('google_login_success', {
        user_id: user.uid,
        email: user.email
      });
      
      // Send token to extension if needed (your existing logic)
      if (isExtensionLogin) {
        const token = await user.getIdToken();
        sendTokenToExtension(token, 'google_auth');
      }
      
      navigateTo('home');
      
    } catch (error) {
      console.error('❌ Google sign-in error:', error);
      
      trackEvent('google_login_error', {
        error_code: error.code,
        error_message: error.message
      });
      
      // Handle specific errors
      let errorMessage = 'Google sign-in failed. Please try again.';
      
      switch (error.code) {
        case 'auth/popup-blocked':
          errorMessage = 'Popup was blocked. Please allow popups and try again.';
          break;
        case 'auth/popup-closed-by-user':
          errorMessage = 'Sign-in was cancelled.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Please check your connection.';
          break;
      }
      
      alert(errorMessage);
      
    } finally {
      setGoogleLoading(false);
    }
  };

  // ===== FIREBASE AUTH INTEGRATION FOR EXTENSION =====
  
  useEffect(() => {
    console.log('🚀 LoginPage mounted - Firebase Auth integration starting');
    
    // Check if this is an extension login
    const urlParams = new URLSearchParams(window.location.search);
    const extensionParam = urlParams.get('ext') || urlParams.get('extension');
    
    if (extensionParam) {
      setIsExtensionLogin(true);
      console.log('🔌 Extension login detected, param:', extensionParam);
      
      // Show extension indicator
      const indicator = document.createElement('div');
      indicator.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0;
        background: #2196F3; color: white; text-align: center;
        padding: 8px; font-weight: bold; z-index: 10000;
      `;
      indicator.textContent = '🔧 Logging in for Solthron Chrome Extension';
      document.body.appendChild(indicator);
    }
    
    // ALTERNATIVE: Watch for Firebase-specific localStorage changes
    // Firebase sometimes stores session data in localStorage
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
      console.log('🔍 localStorage.setItem called:', {
        key: key,
        value: typeof value === 'string' ? value.substring(0, 50) + '...' : value,
        valueType: typeof value,
        isFirebaseKey: key.includes('firebase') || key.includes('Auth')
      });
      
      originalSetItem.apply(this, arguments);
      
      // Check for Firebase auth data or any potential tokens
      if ((key.includes('firebase') || key.includes('Auth') || key.includes('token')) && 
          value && value !== 'undefined' && value.length > 20) {
        
        console.log('🔥 Firebase-related data stored:', key);
        
        // Try to extract token from Firebase auth data
        try {
          if (typeof value === 'string' && value.startsWith('{')) {
            const data = JSON.parse(value);
            if (data.stsTokenManager?.accessToken) {
              console.log('✅ Found Firebase access token in storage');
              sendTokenToExtension(data.stsTokenManager.accessToken, 'firebase_access_token');
            } else if (data.accessToken) {
              console.log('✅ Found access token in Firebase data');
              sendTokenToExtension(data.accessToken, 'firebase_stored_token');
            }
          } else if (typeof value === 'string' && value.length > 100) {
            // Might be a direct token
            console.log('✅ Potential direct token stored');
            sendTokenToExtension(value, key);
          }
        } catch (e) {
          console.log('🔍 Could not parse Firebase data, treating as token');
          if (value.length > 50) {
            sendTokenToExtension(value, key);
          }
        }
      }
    };
    
    // Check existing Firebase data
    setTimeout(() => {
      console.log('🔍 Checking existing storage for Firebase data...');
      
      // Check all localStorage for Firebase-related data
      Object.keys(localStorage).forEach(key => {
        if (key.includes('firebase') || key.includes('Auth')) {
          const value = localStorage.getItem(key);
          console.log('🔥 Found Firebase key:', key, typeof value);
          
          try {
            if (value && value.startsWith('{')) {
              const data = JSON.parse(value);
              if (data.stsTokenManager?.accessToken) {
                console.log('✅ Found existing Firebase token');
                sendTokenToExtension(data.stsTokenManager.accessToken, 'existing_firebase_token');
              }
            }
          } catch (e) {
            // Not JSON, might be direct token
            if (value && value.length > 50) {
              sendTokenToExtension(value, key);
            }
          }
        }
      });
    }, 1000);
    
    // Cleanup
    return () => {
      if (localStorage.setItem !== originalSetItem) {
        localStorage.setItem = originalSetItem;
      }
    };
    
  }, []);
  
  // Send token to extension
  const sendTokenToExtension = (token, source) => {
    if (!token || token === 'undefined' || token.length < 20) {
      console.log('❌ Invalid token, not sending:', token);
      return;
    }
    
    console.log('📤 Sending token to extension from:', source);
    
    window.postMessage({
      type: 'SOLTHRON_AUTH_SUCCESS',
      token: token,
      timestamp: Date.now(),
      source: source
    }, '*');
    
    if (isExtensionLogin) {
      showExtensionSuccess(source);
    }
  };
  
  // Show extension success message
  const showExtensionSuccess = (source) => {
    const success = document.createElement('div');
    success.style.cssText = `
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      background: #4CAF50; color: white; padding: 15px 25px;
      border-radius: 8px; z-index: 10000; font-weight: bold; text-align: center;
    `;
    success.innerHTML = `🎉 Extension Login Successful!<br><small>Source: ${source}</small>`;
    
    document.body.appendChild(success);
    setTimeout(() => success.remove(), 8000);
  };
  
  // Enhanced login handler for Firebase
  const handleFirebaseLogin = async (e) => {
    e.preventDefault();
    
    console.log('🔄 Firebase login attempt starting...');
    
    try {
      // Call your existing Firebase login
      const result = await handleLogin(e);
      console.log('🔥 Firebase login result:', result);
      
      // Firebase might return user object directly
      if (result && result.user) {
        console.log('✅ Firebase user object received');
        try {
          const token = await result.user.getIdToken();
          console.log('🎟️ Got Firebase ID token');
          sendTokenToExtension(token, 'firebase_login_result');
        } catch (tokenError) {
          console.error('❌ Error getting token from Firebase user:', tokenError);
        }
      }
      
      return result;
      
    } catch (error) {
      console.error('💥 Firebase login error:', error);
      
      // Check if it's an email verification error
      if (error.message && error.message.includes('verify your email')) {
        setShowVerificationError(true);
        setResendVerificationEmail(loginData.email);
      } else {
        setShowVerificationError(false);
      }
      
      throw error;
    }
  };

  // ===== FORGOT PASSWORD FUNCTIONALITY =====
  
  const handlePasswordReset = async (e) => {
    e.preventDefault();
    
    if (!forgotPasswordEmail.trim()) {
      setForgotPasswordError('Please enter your email address');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(forgotPasswordEmail)) {
      setForgotPasswordError('Please enter a valid email address');
      return;
    }
    
    setForgotPasswordLoading(true);
    setForgotPasswordError('');
    setForgotPasswordMessage('');
    
    try {
      await sendPasswordResetEmail(auth, forgotPasswordEmail);
      setForgotPasswordMessage('Password reset email sent! Check your inbox and spam folder.');
      console.log('✅ Password reset email sent to:', forgotPasswordEmail);
      
      // Auto-close modal after 3 seconds
      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotPasswordEmail('');
        setForgotPasswordMessage('');
      }, 3000);
      
    } catch (error) {
      console.error('❌ Password reset error:', error);
      
      // Handle specific Firebase errors
      switch (error.code) {
        case 'auth/user-not-found':
          setForgotPasswordError('No account found with this email address');
          break;
        case 'auth/invalid-email':
          setForgotPasswordError('Please enter a valid email address');
          break;
        case 'auth/too-many-requests':
          setForgotPasswordError('Too many attempts. Please try again later');
          break;
        default:
          setForgotPasswordError('Failed to send reset email. Please try again');
      }
    } finally {
      setForgotPasswordLoading(false);
    }
  };
  
  const closeForgotPasswordModal = () => {
    setShowForgotPassword(false);
    setForgotPasswordEmail('');
    setForgotPasswordError('');
    setForgotPasswordMessage('');
  };

  // ===== EMAIL VERIFICATION FUNCTIONALITY =====
  
  const handleResendVerification = async (e) => {
    e.preventDefault();
    
    if (!resendVerificationEmail.trim()) {
      setResendVerificationError('Please enter your email address');
      return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resendVerificationEmail)) {
      setResendVerificationError('Please enter a valid email address');
      return;
    }
    
    setResendVerificationLoading(true);
    setResendVerificationError('');
    setResendVerificationMessage('');
    
    try {
      // Call Mailgun resend verification
      const response = await fetch('https://afaque.pythonanywhere.com/send-verification-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: resendVerificationEmail,
          firstName: '' // Empty since we don't know the name
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setResendVerificationMessage('Verification email sent! Check your inbox and spam folder.');
        console.log('✅ Mailgun verification email resent to:', resendVerificationEmail);
      } else {
        setResendVerificationError('Failed to send verification email. Please try again.');
      }
      
    } catch (error) {
      console.error('❌ Resend verification error:', error);
      setResendVerificationError('Failed to send verification email. Please try again.');
    } finally {
      setResendVerificationLoading(false);
      
      // Auto-close modal after 4 seconds
      setTimeout(() => {
        setShowResendVerification(false);
        setResendVerificationEmail('');
        setResendVerificationMessage('');
        setResendVerificationError('');
      }, 4000);
    }
  };
  
  const closeResendVerificationModal = () => {
    setShowResendVerification(false);
    setResendVerificationEmail('');
    setResendVerificationError('');
    setResendVerificationMessage('');
    setShowVerificationError(false);
  };

  // Gradient theme colors for highlights and glows
  const gradientTheme = {
    gradient: 'linear-gradient(to right, #FAFFD1, #A1FFCE)',
    lightColor: '#FAFFD1',
    darkColor: '#A1FFCE',
    lightGlow: 'rgba(250, 255, 209, 0.3)',
    darkGlow: 'rgba(161, 255, 206, 0.3)',
    brightLightGlow: 'rgba(250, 255, 209, 0.45)',
    brightDarkGlow: 'rgba(161, 255, 206, 0.45)'
  };

  const togglePasswordVisibility = (e) => {
    e.preventDefault();
    setShowPassword(!showPassword);
  };

  useEffect(() => {
    const validateInputs = () => {
      if (touched.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        setValidations(prev => ({
          ...prev, 
          email: loginData.email ? emailRegex.test(loginData.email) : false
        }));
      }
    };
    
    validateInputs();
  }, [loginData, touched]);

  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  const styles = {
    pageWrapper: {
      position: 'relative',
      width: '100%',
      minHeight: '100vh',
    },
    noiseOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.03,
      pointerEvents: 'none',
      backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
      zIndex: 1,
    },
    container: {
      backgroundColor: '#050706',
      color: '#ffffff',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(12, 20, 18, 0.9) 0%, rgba(5, 7, 6, 0.98) 90%)',
      backgroundBlendMode: 'overlay',
      fontFamily: 'inherit',
      position: 'relative',
      zIndex: 2,
    },
    loginBox: {
      backgroundColor: 'rgba(15, 25, 20, 0.4)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius: '16px',
      padding: '25px',
      width: '100%',
      maxWidth: '450px',
      boxShadow: boxHovered 
        ? `0 16px 40px rgba(0, 0, 0, 0.45), 0 0 30px rgba(0, 0, 0, 0.25), 0 0 25px ${gradientTheme.brightLightGlow}, 0 0 35px ${gradientTheme.brightDarkGlow}, inset 0 0 4px ${gradientTheme.lightGlow}`
        : `0 8px 32px rgba(0, 0, 0, 0.37), 0 0 20px rgba(0, 0, 0, 0.2), 0 0 20px ${gradientTheme.lightGlow}, 0 0 25px ${gradientTheme.darkGlow}, inset 0 0 2px ${gradientTheme.lightGlow}`,
      border: boxHovered 
        ? `1px solid rgba(161, 255, 206, 0.15)`
        : `1px solid rgba(255, 255, 255, 0.08)`,
      position: 'relative',
      overflow: 'hidden',
      transition: 'all 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
      transform: boxHovered ? 'translateY(-5px)' : 'translateY(0)',
      cursor: 'default'
    },
    glassHighlight: {
      position: 'absolute',
      top: '-50%',
      left: '-50%',
      right: '-50%',
      bottom: '-50%',
      background: 'linear-gradient(to bottom right, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 80%)',
      transform: 'rotate(45deg)',
      pointerEvents: 'none',
    },
    glowAccent1: {
      position: 'absolute',
      top: '-10%',
      left: '-5%',
      width: '40%',
      height: '40%',
      background: `radial-gradient(circle, ${gradientTheme.lightGlow} 0%, rgba(255,255,255,0) 70%)`,
      opacity: boxHovered ? 0.15 : 0.08,
      pointerEvents: 'none',
      transition: 'opacity 0.3s ease',
      zIndex: -1,
    },
    glowAccent2: {
      position: 'absolute',
      bottom: '-20%',
      right: '-10%',
      width: '60%',
      height: '60%',
      background: `radial-gradient(circle, ${gradientTheme.darkGlow} 0%, rgba(255,255,255,0) 70%)`,
      opacity: boxHovered ? 0.15 : 0.08,
      pointerEvents: 'none',
      transition: 'opacity 0.3s ease',
      zIndex: -1,
    },
    title: {
      color: '#ffffff',
      textAlign: 'center',
      marginBottom: '30px',
      fontSize: '24px',
      fontWeight: 'normal',
      fontFamily: 'inherit',
      textShadow: boxHovered ? `0 0 10px ${gradientTheme.lightGlow}, 0 0 15px ${gradientTheme.darkGlow}` : 'none',
      transition: 'text-shadow 0.3s ease',
    },
    form: {
      width: '100%',
      position: 'relative',
      zIndex: 2,
    },
    fieldGroup: {
      marginBottom: '12px',
      position: 'relative',
    },
    input: {
      backgroundColor: 'transparent',
      border: 'none',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      padding: '10px 0',
      width: '100%',
      marginBottom: '20px',
      fontSize: '15px',
      outline: 'none',
      transition: 'border-color 0.3s',
      fontFamily: 'inherit',
    },
    inputInvalid: {
      borderBottom: '1px solid rgba(255, 99, 71, 0.7)',
    },
    button: {
      background: gradientTheme.gradient,
      color: '#000000',
      border: 'none',
      borderRadius: '50px',
      padding: '14px',
      width: '100%',
      fontSize: '16px',
      fontWeight: 'bold',
      cursor: 'pointer',
      marginTop: '20px',
      marginBottom: '20px',
      transition: 'all 0.3s',
      boxShadow: `0 4px 15px ${gradientTheme.lightGlow}, 0 2px 10px ${gradientTheme.darkGlow}`,
    },
    linkText: {
      color: 'rgba(255, 255, 255, 0.6)',
      textAlign: 'center',
      fontSize: '14px',
      fontFamily: 'inherit',
    },
    signupLink: {
      background: gradientTheme.gradient,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      textDecoration: 'none',
      fontWeight: 'bold',
      cursor: 'pointer',
      transition: 'opacity 0.3s',
      textShadow: boxHovered ? `0 0 5px ${gradientTheme.lightGlow}` : 'none',
    },
    forgotPasswordLink: {
      background: gradientTheme.gradient,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      textDecoration: 'none',
      fontWeight: 'bold',
      cursor: 'pointer',
      transition: 'opacity 0.3s',
      fontSize: '14px',
      display: 'block',
      textAlign: 'center',
      marginBottom: '15px',
    },
    resendVerificationLink: {
      background: gradientTheme.gradient,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
      textDecoration: 'none',
      fontWeight: 'bold',
      cursor: 'pointer',
      transition: 'opacity 0.3s',
      fontSize: '13px',
      display: 'block',
      textAlign: 'center',
      marginBottom: '10px',
    },
    eyeIcon: {
      position: 'absolute',
      right: '5px',
      top: '12px',
      color: 'rgba(255, 255, 255, 0.5)',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      outline: 'none',
      transition: 'color 0.3s',
    },
    errorMessage: {
      color: 'rgba(255, 99, 71, 0.7)',
      fontSize: '13px',
      marginTop: '-15px',
      marginBottom: '15px',
      transition: 'opacity 0.3s',
      fontFamily: 'inherit',
    },
    errorBox: {
      color: '#ff6666',
      backgroundColor: 'rgba(255, 51, 51, 0.1)',
      padding: '8px',
      borderRadius: '8px',
      marginBottom: '12px',
      backdropFilter: 'blur(5px)',
      border: '1px solid rgba(255, 102, 102, 0.2)',
      fontFamily: 'inherit',
      fontSize: '13px',
    },
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    },
    modalContent: {
      backgroundColor: 'rgba(15, 25, 20, 0.9)',
      backdropFilter: 'blur(12px)',
      borderRadius: '16px',
      padding: '30px',
      width: '90%',
      maxWidth: '400px',
      boxShadow: `0 16px 40px rgba(0, 0, 0, 0.5), 0 0 25px ${gradientTheme.lightGlow}, 0 0 35px ${gradientTheme.darkGlow}`,
      border: `1px solid rgba(161, 255, 206, 0.15)`,
      position: 'relative',
    },
    modalTitle: {
      color: '#ffffff',
      fontSize: '20px',
      fontWeight: 'bold',
      marginBottom: '15px',
      textAlign: 'center',
      fontFamily: 'inherit',
    },
    modalText: {
      color: 'rgba(255, 255, 255, 0.8)',
      fontSize: '14px',
      marginBottom: '20px',
      textAlign: 'center',
      fontFamily: 'inherit',
    },
    modalButtonRow: {
      display: 'flex',
      gap: '15px',
      marginTop: '20px',
    },
    modalButton: {
      background: gradientTheme.gradient,
      color: '#000000',
      border: 'none',
      borderRadius: '50px',
      padding: '12px 20px',
      fontSize: '14px',
      fontWeight: 'bold',
      cursor: 'pointer',
      flex: 1,
      transition: 'all 0.3s',
    },
    modalCancelButton: {
      background: 'transparent',
      color: 'rgba(255, 255, 255, 0.7)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: '50px',
      padding: '12px 20px',
      fontSize: '14px',
      cursor: 'pointer',
      flex: 1,
      transition: 'all 0.3s',
    },
    successMessage: {
      color: '#4CAF50',
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      padding: '8px',
      borderRadius: '8px',
      marginBottom: '12px',
      backdropFilter: 'blur(5px)',
      border: '1px solid rgba(76, 175, 80, 0.2)',
      fontFamily: 'inherit',
      fontSize: '13px',
      textAlign: 'center',
    },
  };

  return (
    <div style={styles.pageWrapper}>
      <div style={styles.noiseOverlay}></div>
      <div style={styles.container}>
        <div 
          style={styles.loginBox}
          onMouseEnter={() => setBoxHovered(true)}
          onMouseLeave={() => setBoxHovered(false)}
        >
          <div style={styles.glassHighlight}></div>
          <div style={styles.glowAccent1}></div>
          <div style={styles.glowAccent2}></div>
          
          <h1 style={styles.title}>
            {isExtensionLogin ? 'Extension Login' : 'Welcome Back'}
          </h1>
          
          {error && (
            <div style={styles.errorBox}>
              {error}
              {/* Show resend verification link only when there's a verification error */}
              {showVerificationError && (
                <div style={{ marginTop: '10px' }}>
                  <span 
                    style={{
                      ...styles.resendVerificationLink,
                      fontSize: '12px',
                      textDecoration: 'underline'
                    }} 
                    onClick={() => setShowResendVerification(true)}
                  >
                    Click here to resend verification email
                  </span>
                </div>
              )}
            </div>
          )}

          {/* GOOGLE SIGN-IN BUTTON */}
          <button
            onClick={handleGoogleSignIn}
            style={{
              backgroundColor: '#ffffff',
              color: '#424242',
              border: '1px solid #dadce0',
              borderRadius: '50px',
              padding: '12px',
              width: '100%',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              marginBottom: '15px',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              fontFamily: 'inherit',
              opacity: googleLoading ? 0.7 : 1,
              transform: googleLoading ? 'scale(0.98)' : 'scale(1)'
            }}
            disabled={googleLoading}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#f8f9fa';
              e.target.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#ffffff';
              e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
            }}
          >
            {googleLoading ? (
              <>
                <div style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid #f3f3f3',
                  borderTop: '2px solid #4285f4',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Signing in...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {/* DIVIDER */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            margin: '20px 0',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '14px'
          }}>
            <div style={{
              flex: 1,
              height: '1px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)'
            }}></div>
            <span style={{ padding: '0 15px' }}>or</span>
            <div style={{
              flex: 1,
              height: '1px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)'
            }}></div>
          </div>
          
          {/* EXISTING EMAIL/PASSWORD FORM */}
          <form onSubmit={handleFirebaseLogin} style={styles.form}>
            <div style={styles.fieldGroup}>
              <input
                type="email"
                style={{
                  ...styles.input,
                  ...(touched.email && !validations.email ? styles.inputInvalid : {})
                }}
                placeholder="Email"
                value={loginData.email || ''}
                onChange={(e) => {
                  setLoginData({...loginData, email: e.target.value});
                  setShowVerificationError(false);
                }}
                onBlur={() => handleBlur('email')}
                required
              />
              {touched.email && !validations.email && (
                <div style={styles.errorMessage}>
                  Please enter a valid email address
                </div>
              )}
            </div>

            <div style={styles.fieldGroup}>
              <input
                type={showPassword ? "text" : "password"}
                style={styles.input}
                placeholder="Password"
                value={loginData.password || ''}
                onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                required
              />
              <button 
                onClick={togglePasswordVisibility}
                style={styles.eyeIcon}
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                  </svg>
                )}
              </button>
            </div>

            <button 
              type="submit" 
              style={{
                ...styles.button,
                opacity: loading ? 0.7 : 1
              }}
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Log In'}
            </button>

            {/* FORGOT PASSWORD LINK */}
            <span 
              style={styles.forgotPasswordLink} 
              onClick={() => setShowForgotPassword(true)}
            >
              Forgot Password?
            </span>

            <div style={styles.linkText}>
              Don't have an account? <span style={styles.signupLink} onClick={() => navigateTo('signup')}>Sign up</span>
            </div>
          </form>
        </div>
      </div>

      {/* Add CSS for spinner animation */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* FORGOT PASSWORD MODAL */}
      {showForgotPassword && (
        <div style={styles.modalOverlay} onClick={closeForgotPasswordModal}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Reset Password</h2>
            <p style={styles.modalText}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            
            {forgotPasswordError && (
              <div style={styles.errorBox}>
                {forgotPasswordError}
              </div>
            )}
            
            {forgotPasswordMessage && (
              <div style={styles.successMessage}>
                {forgotPasswordMessage}
              </div>
            )}
            
            <form onSubmit={handlePasswordReset}>
              <input
                type="email"
                style={styles.input}
                placeholder="Enter your email"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                required
                autoFocus
              />
              
              <div style={styles.modalButtonRow}>
                <button 
                  type="button"
                  style={styles.modalCancelButton}
                  onClick={closeForgotPasswordModal}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{
                    ...styles.modalButton,
                    opacity: forgotPasswordLoading ? 0.7 : 1
                  }}
                  disabled={forgotPasswordLoading}
                >
                  {forgotPasswordLoading ? 'Sending...' : 'Send Reset Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESEND VERIFICATION MODAL */}
      {showResendVerification && (
        <div style={styles.modalOverlay} onClick={closeResendVerificationModal}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Resend Verification Email</h2>
            <p style={styles.modalText}>
              Enter your email address and we'll send you a new verification email.
            </p>
            
            {resendVerificationError && (
              <div style={styles.errorBox}>
                {resendVerificationError}
              </div>
            )}
            
            {resendVerificationMessage && (
              <div style={styles.successMessage}>
                {resendVerificationMessage}
              </div>
            )}
            
            <form onSubmit={handleResendVerification}>
              <input
                type="email"
                style={styles.input}
                placeholder="Enter your email"
                value={resendVerificationEmail}
                onChange={(e) => setResendVerificationEmail(e.target.value)}
                required
                autoFocus
              />
              
              <div style={styles.modalButtonRow}>
                <button 
                  type="button"
                  style={styles.modalCancelButton}
                  onClick={closeResendVerificationModal}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  style={{
                    ...styles.modalButton,
                    opacity: resendVerificationLoading ? 0.7 : 1
                  }}
                  disabled={resendVerificationLoading}
                >
                  {resendVerificationLoading ? 'Sending...' : 'Send Verification Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
