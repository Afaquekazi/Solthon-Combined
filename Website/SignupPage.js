import React, { useState, useEffect } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, db, googleProvider, trackEvent } from './firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const SignupPage = ({ navigateTo, signupData, setSignupData, handleSignup, loading, error }) => {
  const [showPassword, setShowPassword] = useState(false);
  const [validations, setValidations] = useState({
    email: true,
    password: true,
    mobile: true
  });
  const [touched, setTouched] = useState({
    email: false,
    password: false,
    mobile: false
  });
  const [boxHovered, setBoxHovered] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

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

  // ===== GOOGLE AUTHENTICATION =====
  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    
    try {
      trackEvent('google_signup_started', {
        timestamp: new Date().toISOString()
      });
      
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      console.log('✅ Google sign-up successful:', user.email);
      
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
      
      trackEvent('google_signup_success', {
        user_id: user.uid,
        email: user.email
      });
      
      navigateTo('home');
      
    } catch (error) {
      console.error('❌ Google sign-up error:', error);
      
      trackEvent('google_signup_error', {
        error_code: error.code,
        error_message: error.message
      });
      
      // Handle specific errors
      let errorMessage = 'Google sign-up failed. Please try again.';
      
      switch (error.code) {
        case 'auth/popup-blocked':
          errorMessage = 'Popup was blocked. Please allow popups and try again.';
          break;
        case 'auth/popup-closed-by-user':
          errorMessage = 'Sign-up was cancelled.';
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

  const togglePasswordVisibility = (e) => {
    e.preventDefault();
    setShowPassword(!showPassword);
  };

  // Check for success parameter in URL (from successful verification)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('verified') === 'true') {
      setShowSuccessMessage(true);
      // Clear the URL parameter
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Validate inputs when they change
  useEffect(() => {
    const validateInputs = () => {
      // Only validate fields that have been touched
      if (touched.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        setValidations(prev => ({
          ...prev, 
          email: signupData.email ? emailRegex.test(signupData.email) : false
        }));
      }
      
      if (touched.password) {
        setValidations(prev => ({
          ...prev, 
          password: signupData.password ? signupData.password.length >= 8 : false
        }));
      }
      
      if (touched.mobile) {
        const mobileRegex = /^\d{10}$/;
        setValidations(prev => ({
          ...prev, 
          mobile: signupData.mobileNumber ? mobileRegex.test(signupData.mobileNumber) : false
        }));
      }
    };
    
    validateInputs();
  }, [signupData, touched]);

  // Country codes for dropdown
  const countryCodes = [
    { code: '+91', country: 'IN' },
    { code: '+1', country: 'US/CA' },
    { code: '+44', country: 'UK' },
    { code: '+61', country: 'AU' },
    { code: '+33', country: 'FR' },
    { code: '+49', country: 'DE' },
    { code: '+81', country: 'JP' },
    { code: '+86', country: 'CN' },
    { code: '+7', country: 'RU' },
    { code: '+971', country: 'UAE' },
    { code: '+55', country: 'BR' },
    { code: '+52', country: 'MX' },
    { code: '+27', country: 'ZA' },
    { code: '+82', country: 'KR' },
    { code: '+39', country: 'IT' },
  ];

  // Dark theme styles with frosted glass effect - matching ProfilePage
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
    signupBox: {
      backgroundColor: 'rgba(15, 25, 20, 0.4)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderRadius: '16px',
      padding: '20px',
      width: '100%',
      maxWidth: '450px',
      maxHeight: '90vh',
      overflowY: 'auto',
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
      opacity: boxHovered ? 0.2 : 0.1,
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
      marginBottom: '15px',
      fontSize: '22px',
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
      marginBottom: '8px',
      position: 'relative',
    },
    nameFieldsRow: {
      display: 'flex',
      gap: '15px',
      marginBottom: '5px',
    },
    fieldHalf: {
      flex: 1,
    },
    label: {
      color: 'rgba(255, 255, 255, 0.7)',
      marginBottom: '4px',
      display: 'block',
      fontSize: '13px',
      fontFamily: 'inherit',
    },
    input: {
      backgroundColor: 'transparent',
      border: 'none',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      padding: '6px 0',
      width: '100%',
      marginBottom: '10px',
      fontSize: '15px',
      outline: 'none',
      transition: 'border-color 0.3s',
      fontFamily: 'inherit',
    },
    inputInvalid: {
      borderBottom: '1px solid rgba(255, 99, 71, 0.7)',
    },
    mobileRow: {
      display: 'flex',
      width: '100%',
      marginBottom: '10px',
    },
    countryCodeSelect: {
      backgroundColor: 'transparent',
      border: 'none',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      padding: '8px 0',
      width: '90px',
      fontSize: '15px',
      marginRight: '15px',
      outline: 'none',
      appearance: 'none',
      WebkitAppearance: 'none',
      MozAppearance: 'none',
      cursor: 'pointer',
      position: 'relative',
      fontFamily: 'inherit',
    },
    mobileInput: {
      backgroundColor: 'transparent',
      border: 'none',
      borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
      color: '#ffffff',
      padding: '8px 0',
      width: 'calc(100% - 105px)',
      fontSize: '15px',
      outline: 'none',
      fontFamily: 'inherit',
    },
    mobileInputInvalid: {
      borderBottom: '1px solid rgba(255, 99, 71, 0.7)',
    },
    button: {
      background: gradientTheme.gradient,
      color: '#000000',
      border: 'none',
      borderRadius: '50px',
      padding: '10px',
      width: '100%',
      fontSize: '15px',
      fontWeight: 'bold',
      cursor: 'pointer',
      marginTop: '12px',
      marginBottom: '8px',
      transition: 'all 0.3s',
      boxShadow: `0 4px 15px ${gradientTheme.lightGlow}, 0 2px 10px ${gradientTheme.darkGlow}`,
    },
    linkText: {
      color: 'rgba(255, 255, 255, 0.6)',
      textAlign: 'center',
      fontSize: '14px',
      fontFamily: 'inherit',
      marginTop: '8px',
      marginBottom: '8px',
    },
    loginLink: {
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
    passwordHint: {
      color: 'rgba(255, 255, 255, 0.4)',
      fontSize: '12px',
      marginTop: '-8px',
      marginBottom: '10px',
      transition: 'color 0.3s',
      fontFamily: 'inherit',
    },
    passwordHintError: {
      color: 'rgba(255, 99, 71, 0.7)',
    },
    eyeIcon: {
      position: 'absolute',
      right: '5px',
      top: '10px',
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
      marginTop: '-10px',
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
    successBox: {
      color: '#4CAF50',
      backgroundColor: 'rgba(76, 175, 80, 0.1)',
      padding: '12px',
      borderRadius: '8px',
      marginBottom: '15px',
      backdropFilter: 'blur(5px)',
      border: '1px solid rgba(76, 175, 80, 0.2)',
      fontFamily: 'inherit',
      fontSize: '13px',
      textAlign: 'center',
    },
    selectWrapper: {
      position: 'relative',
    },
    selectArrow: {
      position: 'absolute',
      right: '5px',
      top: '50%',
      transform: 'translateY(-50%)',
      pointerEvents: 'none',
    }
  };

  // Handle blur events to mark fields as touched
  const handleBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
  };

  return (
    <div style={styles.pageWrapper}>
      <div style={styles.noiseOverlay}></div>
      <div style={styles.container}>
        <div 
          style={styles.signupBox}
          onMouseEnter={() => setBoxHovered(true)}
          onMouseLeave={() => setBoxHovered(false)}
        >
          <div style={styles.glassHighlight}></div>
          <div style={styles.glowAccent1}></div>
          <div style={styles.glowAccent2}></div>
          
          <h1 style={styles.title}>Create Account</h1>
          
          {/* Success message for email verification */}
          {showSuccessMessage && (
            <div style={styles.successBox}>
              🎉 Email verified successfully! You can now log in with your account.
            </div>
          )}
          
          {error && <div style={styles.errorBox}>{error}</div>}

          {/* GOOGLE SIGN-UP BUTTON */}
          <button
            onClick={handleGoogleSignUp}
            style={{
              backgroundColor: '#ffffff',
              color: '#424242',
              border: '1px solid #dadce0',
              borderRadius: '50px',
              padding: '10px',
              width: '100%',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              marginBottom: '12px',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
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
                  width: '16px',
                  height: '16px',
                  border: '2px solid #f3f3f3',
                  borderTop: '2px solid #4285f4',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
                Signing up...
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign up with Google
              </>
            )}
          </button>

          {/* DIVIDER */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            margin: '12px 0',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '13px'
          }}>
            <div style={{
              flex: 1,
              height: '1px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)'
            }}></div>
            <span style={{ padding: '0 12px' }}>or</span>
            <div style={{
              flex: 1,
              height: '1px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)'
            }}></div>
          </div>
          
          {/* EXISTING EMAIL/PASSWORD FORM */}
          <form onSubmit={handleSignup} style={styles.form}>
            <div style={styles.nameFieldsRow}>
              <div style={styles.fieldHalf}>
                <input
                  type="text"
                  style={styles.input}
                  placeholder="First Name"
                  value={signupData.firstName || ''}
                  onChange={(e) => setSignupData({...signupData, firstName: e.target.value})}
                  required
                />
              </div>
              
              <div style={styles.fieldHalf}>
                <input
                  type="text"
                  style={styles.input}
                  placeholder="Last Name"
                  value={signupData.lastName || ''}
                  onChange={(e) => setSignupData({...signupData, lastName: e.target.value})}
                  required
                />
              </div>
            </div>

            <div style={styles.fieldGroup}>
              <input
                type="text"
                style={styles.input}
                placeholder="Username"
                value={signupData.username || ''}
                onChange={(e) => setSignupData({...signupData, username: e.target.value})}
                required
              />
            </div>

            <div style={styles.fieldGroup}>
              <input
                type="email"
                style={{
                  ...styles.input,
                  ...(touched.email && !validations.email ? styles.inputInvalid : {})
                }}
                placeholder="Email"
                value={signupData.email || ''}
                onChange={(e) => setSignupData({...signupData, email: e.target.value})}
                onBlur={() => handleBlur('email')}
                required
              />
              {touched.email && !validations.email && (
                <div style={styles.errorMessage}>
                  Please enter a valid email address
                </div>
              )}
            </div>

            {/* Mobile number with country code dropdown */}
            <div style={styles.fieldGroup}>
              <div style={styles.mobileRow}>
                <div style={styles.selectWrapper}>
                  <select
                    value={signupData.countryCode || '+91'}
                    onChange={(e) => setSignupData({...signupData, countryCode: e.target.value})}
                    style={styles.countryCodeSelect}
                  >
                    {countryCodes.map((country, index) => (
                      <option 
                        key={index} 
                        value={country.code}
                        style={{ 
                          backgroundColor: '#1a2520', 
                          color: '#ffffff',
                          padding: '8px'
                        }}
                      >
                        {country.code} {country.country}
                      </option>
                    ))}
                  </select>
                  <div style={styles.selectArrow}>
                    <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M1 1L5 5L9 1" stroke="rgba(255, 255, 255, 0.5)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>
                <input
                  type="tel"
                  style={{
                    ...styles.mobileInput,
                    ...(touched.mobile && !validations.mobile ? styles.mobileInputInvalid : {})
                  }}
                  placeholder="Mobile Number"
                  value={signupData.mobileNumber || ''}
                  onChange={(e) => setSignupData({...signupData, mobileNumber: e.target.value})}
                  onBlur={() => handleBlur('mobile')}
                />
              </div>
              {touched.mobile && !validations.mobile && (
                <div style={styles.errorMessage}>
                  Please enter a valid 10-digit mobile number
                </div>
              )}
            </div>

            <div style={styles.fieldGroup}>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  style={{
                    ...styles.input,
                    ...(touched.password && !validations.password ? styles.inputInvalid : {})
                  }}
                  placeholder="Password"
                  value={signupData.password || ''}
                  onChange={(e) => setSignupData({...signupData, password: e.target.value})}
                  onBlur={() => handleBlur('password')}
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
              <p style={{
                ...styles.passwordHint,
                ...(touched.password && !validations.password ? styles.passwordHintError : {})
              }}>
                Minimum length is 8 characters.
              </p>
            </div>

            <button 
              type="submit" 
              style={{
                ...styles.button,
                opacity: loading ? 0.7 : 1
              }}
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>

            <div style={styles.linkText}>
              Already have an account? <span style={styles.loginLink} onClick={() => navigateTo('login')}>Login</span>
            </div>
          </form>
        </div>

        {/* Add CSS for spinner animation */}
        <style jsx>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default SignupPage;
