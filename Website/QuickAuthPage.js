import React, { useState, useEffect } from 'react';
import { auth, db, googleProvider } from './firebase';
import { signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

function QuickAuthPage() {
  const [authType, setAuthType] = useState('login');
  const [status, setStatus] = useState('Click to authenticate');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    console.log('QuickAuthPage loaded, waiting for user action');
    
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type') || 'login';
    setAuthType(type);
  }, []);

  const handleGoogleAuth = async () => {
    setLoading(true);
    setStatus('Opening Google Sign-In...');

    try {
      // Google popup auth - waits for user to select account
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      console.log('Auth successful:', user.email);
      setStatus('Verifying account...');

      // Check if user exists in Firestore
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        // New user - create account regardless of login/signup type
        setStatus('Creating your account...');
        
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

        console.log('New account created successfully');
      } else {
        setStatus('Logging you in...');
        
        // Update verification status if needed
        const userData = userDoc.data();
        if (!userData.emailVerified) {
          await updateDoc(userRef, {
            emailVerified: true,
            emailVerifiedAt: new Date().toISOString(),
            photoURL: user.photoURL
          });
        }
      }

      // Get Firebase ID token
      const firebaseToken = await user.getIdToken();
      console.log('Firebase token obtained, exchanging for custom token...');

      setStatus('Creating secure session...');

      // Exchange Firebase token for 30-day JWT
      const response = await fetch('https://afaque.pythonanywhere.com/auth/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseToken })
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Session creation failed');
      }

      const token = data.token;  // This is your 30-day JWT
      console.log('Custom token generated, sending to extension...');

      // Send token to extension
      window.parent.postMessage({
        type: 'SOLTHRON_AUTH_SUCCESS',
        token: token,
        source: 'quick_auth_iframe',
        authType: authType,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        }
      }, '*');

      window.top.postMessage({
        type: 'SOLTHRON_AUTH_SUCCESS',
        token: token,
        source: 'quick_auth_iframe',
        authType: authType,
        user: {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL
        }
      }, '*');

      if (window.opener) {
        window.opener.postMessage({
          type: 'SOLTHRON_AUTH_SUCCESS',
          token: token,
          source: 'quick_auth_iframe',
          authType: authType,
          user: {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL
          }
        }, '*');
      }

      // Show simple success message
      setStatus('Authentication successful! You can close this tab.');
      setLoading(false);

    } catch (error) {
      console.error('Auth error:', error);

      let errorMessage = 'Authentication failed';

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
      setLoading(false);
    }
  };

  const styles = {
    body: {
      margin: 0,
      padding: '20px',
      background: '#050706',
      color: 'white',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      width: '100%',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    authContainer: {
      textAlign: 'center',
      maxWidth: '300px',
      width: '100%',
    },
    title: {
      marginBottom: '20px',
      fontSize: '18px',
      fontWeight: 'normal',
    },
    googleBtn: {
      background: '#ffffff',
      color: '#424242',
      border: '1px solid #dadce0',
      borderRadius: '8px',
      padding: '12px 20px',
      width: '100%',
      fontSize: '14px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '10px',
      margin: '10px 0',
      transition: 'all 0.2s ease',
      opacity: loading ? 0.7 : 1,
    },
    status: {
      fontSize: '12px',
      color: '#888',
      marginTop: '10px',
      minHeight: '16px',
    },
    spinner: {
      width: '18px',
      height: '18px',
      border: '2px solid #f3f3f3',
      borderTop: '2px solid #4285f4',
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    },
  };

  return (
    <>
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
      
      <div style={styles.body}>
        <div style={styles.authContainer}>
          <h2 style={styles.title}>
            {authType === 'signup' ? 'Create Account' : 'Sign In'}
          </h2>

          <button
            style={{
              ...styles.googleBtn,
              ...(loading && { cursor: 'not-allowed' })
            }}
            onClick={handleGoogleAuth}
            disabled={loading}
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
                <div style={styles.spinner}></div>
                <span>Processing...</span>
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
                  {authType === 'signup' ? 'Sign up with Google' : 'Login with Google'}
                </span>
              </>
            )}
          </button>

          <div style={styles.status}>{status}</div>
        </div>
      </div>
    </>
  );
}

export default QuickAuthPage;
