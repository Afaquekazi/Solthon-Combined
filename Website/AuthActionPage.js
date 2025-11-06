import React, { useState, useEffect } from 'react';
import { trackEvent } from './firebase';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// Extension-specific Firebase config
const extensionFirebaseConfig = {
    apiKey: "AIzaSyCAuGcEMWBsSVeXnd8skT_3i9tM6XVKPnU",
    authDomain: "solthron.firebaseapp.com",
    projectId: "solthron", 
    storageBucket: "solthron.firebasestorage.app",
    messagingSenderId: "1039667200648",
    appId: "1:1039667200648:web:200da50ffeae7f9601d53d",
    measurementId: "G-MY7N8XNE87"
};

// Initialize Firebase for extension with unique app name
const extensionApp = initializeApp(extensionFirebaseConfig, 'extension-auth');
const auth = getAuth(extensionApp);
const db = getFirestore(extensionApp);
const googleProvider = new GoogleAuthProvider();

const ExtensionAuthPage = () => {
  const [authType, setAuthType] = useState('login');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Click to authenticate');

  useEffect(() => {
    // Get URL parameters to determine auth type
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type') || 'login';
    setAuthType(type);
  }, []);

  // Send token to extension
  const sendTokenToExtension = (token, user, authType, source) => {
    console.log('📤 Sending auth success message');

    const authData = {
      type: 'SOLTHRON_AUTH_SUCCESS',
      token: token,
      source: source,
      authType: authType,
      user: {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL
      }
    };

    // Try multiple ways to send the message
    window.parent.postMessage(authData, '*');
    window.top.postMessage(authData, '*');
    
    // Also send directly to the opener
    if (window.opener) {
      window.opener.postMessage(authData, '*');
    }
  };

  // Google Authentication Handler
  const handleGoogleAuth = async () => {
    setLoading(true);
    setStatus('Authenticating with Google...');

    try {
      // Google popup auth
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      console.log('Auth successful:', user.email);

      // Check if user exists in Firestore
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists() && authType === 'signup') {
        // Create new user document
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
          credits: 250,
          emailVerified: true,
          emailVerifiedAt: new Date().toISOString()
        });

        setStatus('Account created successfully!');
      } else {
        // Update verification status if needed
        if (!userDoc.exists() || !userDoc.data()?.emailVerified) {
          await updateDoc(userRef, {
            emailVerified: true,
            emailVerifiedAt: new Date().toISOString(),
            photoURL: user.photoURL
          });
        }

        setStatus('Login successful!');
      }

      // Get Firebase ID token
      const token = await user.getIdToken();

      setStatus('Success! Closing...');

      // Send token to extension
      sendTokenToExtension(token, user, authType, 'google_auth');

    } catch (error) {
      console.error('Auth error:', error);

      let errorMessage = 'Authentication failed';

      // Handle specific errors
      switch (error.code) {
        case 'auth/popup-blocked':
          errorMessage = 'Popup blocked. Please allow popups.';
          break;
        case 'auth/popup-closed-by-user':
          errorMessage = 'Authentication cancelled';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Check connection.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many attempts. Try again later.';
          break;
        default:
          errorMessage = error.message || 'Authentication failed';
      }

      setStatus(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Global CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      
      <div style={{
        margin: 0,
        padding: '20px',
        background: '#050706',
        color: 'white',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh'
      }}>
        <div style={{
          textAlign: 'center',
          maxWidth: '300px',
          width: '100%'
        }}>
          <h2 style={{
            marginBottom: '20px',
            fontSize: '18px',
            fontWeight: 'normal'
          }}>
            {authType === 'signup' ? 'Create Account' : 'Extension Authentication'}
          </h2>

          <button
            onClick={handleGoogleAuth}
            disabled={loading}
            style={{
              background: '#ffffff',
              color: '#424242',
              border: '1px solid #dadce0',
              borderRadius: '8px',
              padding: '12px 20px',
              width: '100%',
              fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              margin: '10px 0',
              transition: 'all 0.2s ease',
              opacity: loading ? 0.7 : 1
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.background = '#f8f9fa';
                e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.target.style.background = '#ffffff';
                e.target.style.boxShadow = 'none';
              }
            }}
          >
            {loading ? (
              <>
                <div style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid #f3f3f3',
                  borderTop: '2px solid #4285f4',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Processing...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>
                  {authType === 'signup' ? 'Sign up with Google' : 'Continue with Google'}
                </span>
              </>
            )}
          </button>

          <div style={{
            fontSize: '12px',
            color: '#888',
            marginTop: '10px',
            minHeight: '16px'
          }}>
            {status}
          </div>
        </div>
      </div>
    </>
  );
};

export default ExtensionAuthPage;
