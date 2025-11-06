import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import './styles.css';
import { trackEvent } from './firebase';
import FeaturesPage from './FeaturesPage.js';
import PrivacyPolicy from './PrivacyPolicy';
import TermsOfService from './TermsOfService';
import CookiePolicy from './CookiePolicy';
import LoginPage from './LoginPage';
import SignupPage from './SignupPage';
import GeneratorPage from './GeneratorPage';
import ProfileDropdown from './ProfileDropdown';
import ChatPage from './ChatPage';
import ProfilePage from './ProfilePage';
import SubscriptionPage from './SubscriptionPage';
import PromptGalleryPage from './PromptGalleryPage';
import CreditsIndicator from './CreditsIndicator';
import BillingPage from './BillingPage';
import RotatingFeatureWheel from './RotatingFeatureWheel';
import AboutPage from './AboutPage';
import ResetPasswordPage from './ResetPasswordPage';
import AuthActionPage from './AuthActionPage';
import ContactPage from './ContactPage';
import LandingPage from './LandingPage';
import RefreshCreditsPage from './RefreshCreditsPage';
import EmailEnhancementDemo from './EmailEnhancementDemo';
import QuickAuthPage from './QuickAuthPage';
import ImageGalleryPage from './ImageGalleryPage';
import FeatureDemoSection from './FeatureDemoSection';

// ========================================
// DEMO ANALYTICS TRACKING HELPERS
// ========================================
const trackDemoEvent = async (eventType, metadata = {}) => {
  try {
    await fetch('https://afaque.pythonanywhere.com/track-demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: eventType,
        sessionId: sessionStorage.getItem('demoSessionId') || generateSessionId(),
        metadata
      })
    });
  } catch (err) {
    console.error('Demo tracking failed:', err);
  }
};

const generateSessionId = () => {
  const id = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  sessionStorage.setItem('demoSessionId', id);
  return id;
};

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentDetailLevel, setCurrentDetailLevel] = useState('balanced');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [analysisData, setAnalysisData] = useState(null);
  const [signupData, setSignupData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });
  const [promptMode, setPromptMode] = useState('reframe');
  const [promptModeExpanded, setPromptModeExpanded] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [generationAttempts, setGenerationAttempts] = useState(0);

  // Gradient theme for button
  const gradientTheme = {
    gradient: 'linear-gradient(to right, #FAFFD1, #A1FFCE)',
    lightGlow: 'rgba(250, 255, 209, 0.3)',
    brightLightGlow: 'rgba(250, 255, 209, 0.45)'
  };
  
  const AuthGateModal = ({ isOpen, onLogin }) => {
    if (!isOpen) return null;
    return (
      <div className="modal-overlay">
        <div className="modal-popup">
          <h2 className="modal-title">Create an Account to Continue</h2>
          <button className="modal-btn-create" onClick={() => onLogin('signup')}>
            Create Free Account
          </button>
          <button className="modal-btn-login" onClick={() => onLogin('login')}>
            Have an Account? Log In
          </button>
        </div>
      </div>
    );
  };

  const navigateTo = (page) => {
    if (page !== 'generator') {
      setShowAuthModal(false);
    }
    trackEvent('page_navigation', {
      from_page: location.pathname.substring(1) || 'home',
      to_page: page,
      timestamp: new Date().toISOString()
    });

    navigate(page === 'home' ? '/' : `/${page}`);
  };

  const handleAuthModalAction = (action) => {
    setShowAuthModal(false);
    navigateTo(action);
  };

  // Credit management function
  const deductCredits = async (amount = 1) => {
    if (!auth.currentUser) {
      setShowAuthModal(true);
      return false;
    }
    
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        console.error('User document not found');
        return false;
      }
      
      const userData = userDoc.data();
      const currentCredits = userData.credits || 0;
      
      if (currentCredits < amount) {
        alert('You have insufficient credits for this operation. Please upgrade your plan.');
        return false;
      }
      
      // Update credits
      await updateDoc(userRef, {
        credits: currentCredits - amount,
        lastCreditUse: new Date().toISOString()
      });
      
      return true;
    } catch (error) {
      console.error('Failed to use credits:', error);
      return false;
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      trackEvent('signup_started', {
        has_username: Boolean(signupData.username)
      });

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        signupData.email,
        signupData.password
      );

      const userId = userCredential.user.uid;
      const user = userCredential.user;

      trackEvent('signup_success', { user_id: userId });

      try {
        const emailResponse = await fetch('https://afaque.pythonanywhere.com/send-verification-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: signupData.email,
            firstName: signupData.firstName
          })
        });

        const emailData = await emailResponse.json();
        
        if (emailData.success) {
          console.log('✅ Mailgun verification email sent to:', signupData.email);
          
          trackEvent('mailgun_verification_sent', { 
            user_id: userId,
            email: signupData.email,
            provider: 'mailgun'
          });
        } else {
          console.error('❌ Mailgun email failed:', emailData.message);
          trackEvent('mailgun_verification_error', {
            user_id: userId,
            error_message: emailData.message
          });
        }
      } catch (verificationError) {
        console.error('❌ Failed to send Mailgun verification:', verificationError);
        trackEvent('mailgun_verification_api_error', {
          user_id: userId,
          error_message: verificationError.message
        });
      }

      try {
        await setDoc(doc(db, 'users', userId), {
          userId: userId,                    
          firstName: signupData.firstName,
          lastName: signupData.lastName,
          username: signupData.username,
          email: signupData.email,
          createdAt: new Date().toISOString(),
          subscriptionStatus: 'free',
          credits: 250,
          emailVerified: false
        });

        trackEvent('user_data_stored', { user_id: userId });
      } catch (dbError) {
        trackEvent('user_data_storage_error', {
          error_message: dbError.message,
          user_id: userId
        });
        console.error('Error saving additional data:', dbError);
      }

      setSignupData({
        firstName: '',
        lastName: '',
        username: '',
        email: '',
        password: ''
      });

      alert(`Account created successfully! 

A verification email has been sent to ${signupData.email} from noreply@mg.solthron.com

Please check your inbox (and spam folder) and click the verification link, then return to log in.`);
      
      navigateTo('login');

    } catch (err) {
      trackEvent('signup_error', {
        error_code: err.code,
        error_message: err.message
      });

      let errorMessage = 'An error occurred during signup';
      
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already registered';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      trackEvent('login_started', {
        timestamp: new Date().toISOString()
      });
      
      const result = await signInWithEmailAndPassword(
        auth,
        loginData.email,
        loginData.password
      );

      const user = result.user;

      if (!user.emailVerified) {
        await auth.signOut();
        
        trackEvent('login_blocked_unverified', {
          user_id: user.uid,
          email: user.email
        });
        
        throw new Error('Please verify your email before logging in. Check your inbox for the verification link.');
      }

      try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (!userData.emailVerified) {
            await updateDoc(userRef, {
              emailVerified: true,
              emailVerifiedAt: new Date().toISOString()
            });
            console.log('✅ Updated verification status in Firestore');
          }
        }
      } catch (dbError) {
        console.error('Error updating verification status:', dbError);
      }

      trackEvent('login_success', {
        user_id: user.uid
      });

      setLoginData({
        email: '',
        password: ''
      });
      
      navigateTo('home');
      
      return result;
      
    } catch (err) {
      trackEvent('login_error', {
        error_message: err.message
      });
      
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const generatePrompt = async () => {
    const textarea = document.getElementById('promptInput');
    const outputText = document.getElementById('outputText');
    const arrowIcon = document.querySelector('.arrow-icon');
    const loadingSpinner = document.querySelector('.loading');

    const userInput = textarea.value.trim();
    if (!userInput) return;

    if (auth.currentUser) {
      const hasCredits = await deductCredits(1);
      
      if (!hasCredits) {
        navigateTo('subscription');
        return;
      }
    }

    if (!auth.currentUser && generationAttempts >= 1) {
      setShowAuthModal(true);
      trackEvent('auth_prompt_shown', {
          trigger: 'second_generation',
          attempts: generationAttempts
        });
        return;
      }

    if (!auth.currentUser) {
      const newAttempts = generationAttempts + 1;
      setGenerationAttempts(newAttempts);
      localStorage.setItem('generationAttempts', newAttempts.toString());
    }
    const startTime = Date.now();

    try {
      trackEvent('prompt_generation_started', {
        detail_level: currentDetailLevel,
        input_length: userInput.length,
        user_id: auth.currentUser?.uid || 'anonymous'
      });

      if (arrowIcon) arrowIcon.style.display = 'none';
      if (loadingSpinner) loadingSpinner.style.display = 'block';
      outputText.innerHTML = '';
      outputText.classList.remove('fade-in');

      const response = await fetch('https://afaque.pythonanywhere.com/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic: userInput,
          tone: 'professional',
          length: currentDetailLevel,
          mode: promptMode,
          additional_context: ''
        })
      });

      const data = await response.json();
          
      if (data.prompt) {
          trackEvent('prompt_generation_success', {
              detail_level: currentDetailLevel,
              generation_time_ms: Date.now() - startTime,
              output_length: data.prompt.length,
              user_id: auth.currentUser?.uid || 'anonymous'
            });

            outputText.classList.remove('placeholder-text');
            outputText.innerHTML = formatOutput(data.prompt);
            outputText.classList.add('fade-in');
          } else {
            throw new Error('No prompt generated');
          }
        } catch (error) {
          trackEvent('prompt_generation_error', {
            error_message: error.message,
            detail_level: currentDetailLevel,
            user_id: auth.currentUser?.uid || 'anonymous'
          });

          console.error('Error:', error);
          outputText.textContent = 'Error generating prompt. Please try again.';
          outputText.classList.add('fade-in');
        } finally {
          if (arrowIcon) arrowIcon.style.display = 'block';
          if (loadingSpinner) loadingSpinner.style.display = 'none';
        }
  };
  
  const formatTextForCopy = (container) => {
    let formattedText = '';
    
    const extractSectionText = (element) => {
      const title = element.querySelector('.section-title');
      const content = element.querySelector('.section-content, .requirements-list, .examples-list, .notes-list');
      
      if (title) {
        formattedText += title.textContent.trim() + '\n';
      }
      
      if (content) {
        if (content.classList.contains('requirements-list')) {
          const requirements = content.querySelectorAll('.requirement-item');
          requirements.forEach(req => {
            formattedText += req.textContent.trim() + '\n';
          });
        } else if (content.classList.contains('examples-list')) {
          const examples = content.querySelectorAll('.example-item');
          examples.forEach(example => {
            formattedText += example.textContent.trim() + '\n';
          });
        } else {
          formattedText += content.textContent.trim() + '\n';
        }
      }
      formattedText += '\n';
    };

    const sections = container.querySelectorAll('.section');
    sections.forEach(extractSectionText);

    return formattedText.trim();
  };

  const handleCopy = async () => {
    const outputContainer = document.querySelector('.output-container');
    if (outputContainer.querySelector('.placeholder-text')) return;
    
    try {
      const formattedText = formatTextForCopy(outputContainer);
      await navigator.clipboard.writeText(formattedText);
      
      trackEvent('prompt_copied', {
        text_length: formattedText.length,
        user_id: auth.currentUser?.uid || 'anonymous'
      });
      
      const copyButton = document.getElementById('copyButton');
      copyButton.classList.add('copied');
      setTimeout(() => copyButton.classList.remove('copied'), 500);
    } catch (err) {
      trackEvent('copy_error', {
        error_message: err.message,
        user_id: auth.currentUser?.uid || 'anonymous'
      });
      console.error('Failed to copy:', err);
    }
  };

  const handleDetailLevelChange = (level) => {
    trackEvent('detail_level_changed', {
      previous_level: currentDetailLevel,
      new_level: level,
      user_id: auth.currentUser?.uid || 'anonymous'
    });
    
    setCurrentDetailLevel(level);
    setIsExpanded(false);
  };

  const formatOutput = (text) => {
    const sections = text.split(/(?=Task:|Requirements:|Step-by-Step|Examples:|Example Format:|Output Format:|Additional Notes:)/g);
    
    return sections.map(section => {
      const trimmedSection = section.trim();
      if (!trimmedSection) return '';
      
      if (trimmedSection.startsWith('Examples:')) {
        const examples = trimmedSection
          .replace('Examples:', '')
          .split(/(?=\d+\.\s*Example Scenario:)/)
          .filter(ex => ex.trim())
          .map(ex => {
            const parts = ex.split(/(?=Input:|Output:)/g);
            return `
              <div class="example-item">
                <div class="scenario">${parts[0].trim()}</div>
                ${parts.slice(1).map(part => `
                  <div class="example-detail">
                    ${part.trim()}
                  </div>
                `).join('')}
              </div>
            `;
          })
          .join('');

        return `
          <div class="section">
            <div class="section-title">Examples</div>
            <div class="examples-list">
              ${examples}
            </div>
          </div>
        `;
      }

      const titleMatch = trimmedSection.match(/^([^:]+):(.*)/s);
      if (titleMatch) {
        const [, title, content] = titleMatch;
        return `
          <div class="section">
            <div class="section-title">${title}</div>
            <div class="section-content">${content.trim()}</div>
          </div>
        `;
      }

      return `
        <div class="section">
          <div class="section-content">${trimmedSection}</div>
        </div>
      `;
    }).join('');
  };

  useEffect(() => {
    const savedAttempts = localStorage.getItem('generationAttempts');
    if (savedAttempts) {
      setGenerationAttempts(parseInt(savedAttempts));
    }
  }, []);

  useEffect(() => {
    if (location.pathname !== '/generator') {
      setShowAuthModal(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsAuthenticated(!!user);
      if (user) {
        setGenerationAttempts(0);
        localStorage.removeItem('generationAttempts');
        
        const urlParams = new URLSearchParams(window.location.search);
        const isExtensionLogin = urlParams.get('ext') || urlParams.get('extension');
        
        if (isExtensionLogin) {
          console.log('🔥 Firebase auth state: Extension login detected');
          
          user.getIdToken().then(token => {
            console.log('✅ Sending Firebase token to extension');
            
            window.postMessage({
              type: 'SOLTHRON_AUTH_SUCCESS',
              token: token,
              userId: user.uid,
              email: user.email,
              source: 'firebase_auth_state'
            }, '*');
            
            if (window.location.pathname !== '/quick-auth') {
              const success = document.createElement('div');
              success.style.cssText = `
                position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
                background: #4CAF50; color: white; padding: 15px 25px;
                border-radius: 8px; z-index: 10000; font-weight: bold; text-align: center;
              `;
              success.innerHTML = '✅ Successfully logged in to Solthron Extension!<br><small>You can close this tab</small>';
              document.body.appendChild(success);
              
              setTimeout(() => {
                if (success.parentNode) {
                  success.parentNode.removeChild(success);
                }
              }, 8000);
            }
            
          }).catch(error => {
            console.error('Error getting Firebase token:', error);
          });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (location.pathname !== '/generator') return;
    
    const textarea = document.getElementById('promptInput');
    const submitButton = document.getElementById('submitButton');
    const outputText = document.getElementById('outputText');
    const copyButton = document.getElementById('copyButton');
    if (!textarea || !submitButton || !outputText || !copyButton) return;

    const handleInput = () => {
      textarea.style.height = 'auto';
      textarea.style.height = textarea.scrollHeight + 'px';
    };

    textarea.addEventListener('input', handleInput);
    copyButton.addEventListener('click', handleCopy);

    return () => {
      textarea.removeEventListener('input', handleInput);
      copyButton.removeEventListener('click', handleCopy);
    };
  }, [location.pathname]);

  const Footer = ({ navigateTo }) => {
    if (location.pathname === '/generator') return null;
    
    const currentYear = new Date().getFullYear();
    
    return (
      <footer className="site-footer">
        <div className="footer-container">
          <div className="footer-brand">
            <div className="footer-logo">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12 L12 5 L19 12 L12 19 L5 12Z"/>
                <path d="M3 12 L12 3 L21 12 L12 21 L3 12Z"/>
              </svg>
              <span>Solthron</span>
            </div>
            <p className="footer-tagline">AI-Powered Prompt Engineering</p>
          </div>
          
          <div className="footer-links">
            <div className="footer-links-column">
              <h4>Product</h4>
              <ul>
                <li><a href="/subscription" onClick={(e) => { 
                  e.preventDefault(); 
                  navigateTo('subscription');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}>Pricing</a></li>
              </ul>
            </div>
            
            <div className="footer-links-column">
              <h4>Company</h4>
              <ul>
                <li><a href="/about" onClick={(e) => { e.preventDefault(); navigateTo('about'); }}>About Us</a></li>
                <li><a href="/contact" onClick={(e) => { e.preventDefault(); navigateTo('contact'); }}>Contact</a></li>
              </ul>
            </div>
            
            <div className="footer-links-column">
              <h4>Legal</h4>
              <ul>
                <li><a href="/privacy" onClick={(e) => { e.preventDefault(); navigateTo('privacy'); }}>Privacy Policy</a></li>
                <li><a href="/terms" onClick={(e) => { e.preventDefault(); navigateTo('terms'); }}>Terms of Service</a></li>
                <li><a href="/cookies" onClick={(e) => { e.preventDefault(); navigateTo('cookies'); }}>Cookie Policy</a></li> 
              </ul>
            </div>
          </div>
          <div className="footer-social">
            <h4>Connect With Us</h4>
            <div className="social-icons">
              <a href="https://twitter.com/solthron" className="social-icon" aria-label="Twitter">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
                </svg>
              </a>
              <a href="https://github.com/solthron" className="social-icon" aria-label="GitHub">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                </svg>
              </a>
              <a href="https://linkedin.com/company/solthron" className="social-icon" aria-label="LinkedIn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                  <rect x="2" y="9" width="4" height="12"></rect>
                  <circle cx="4" cy="4" r="2"></circle>
                </svg>
              </a>
            </div>
          </div>
        </div>
        
        <div className="footer-bottom">
          <p className="copyright">© {currentYear} Solthron. All rights reserved.</p>
          <p className="made-with">Made with <span className="heart">♥</span> by the Solthron Team</p>
        </div>
      </footer>
    );
  };

  const homePageOverrides = {
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
    backgroundColor: '#050706',
    backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(12, 20, 18, 0.9) 0%, rgba(5, 7, 6, 0.98) 90%)',
    backgroundBlendMode: 'overlay',
  };

  const noiseOverlay = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.03,
    pointerEvents: 'none',
    backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")',
    zIndex: 1,
  };

  const HomePage = () => {
    // Track page visit when homepage loads
    useEffect(() => {
      trackDemoEvent('page_visits');
    }, []);

    return (
      <div style={homePageOverrides}>
        <div style={noiseOverlay}></div>
        <nav style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 40px',
          height: '140px',
          position: 'relative',
          zIndex: 10,
        }}>
          <div className="logo" onClick={() => navigateTo('home')}>
            <img 
              src="/solthron-logo3.png" 
              alt="Solthron" 
              style={{
                height: '175px', 
                width: 'auto',
                cursor: 'pointer'
              }} 
            />
          </div>   
          <button className="menu-toggle">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
          <div className="nav-links">
            {isAuthenticated && (
              <a className="nav-link" onClick={() => navigateTo('gallery')}>Prompt Gallery</a>
            )}
            {isAuthenticated ? (
              <>
                <CreditsIndicator navigateTo={navigateTo} />
                <ProfileDropdown navigateTo={navigateTo} />
              </>
            ) : (
              <>
                <a className="nav-link" onClick={() => navigateTo('login')}>Log In</a>
                <a className="sign-up" onClick={() => navigateTo('signup')}>Sign Up</a>
              </>
            )}
          </div>
        </nav>

        <section className="hero">
          <div className="hero-content">
            <div className="hero-subtitle">Stop Overthinking Your AI Conversations</div>
            <h1 className="hero-title" style={{ fontSize: '3rem', lineHeight: '1.2' }}>
              Better Emails, Stronger Prompts - Just 1 Click Away
</h1>
            <p className="hero-description">
              Smarter AI Conversations — Think Less, Do More.
            </p>
            <a 
              className="hero-cta" 
              onClick={() => {
                // Track in demo analytics
                trackDemoEvent('get_started_clicks');
                
                // Existing Firebase tracking
                trackEvent('get_started_clicked', {
                  source: 'homepage_hero',
                  destination: 'chrome_web_store',
                  timestamp: new Date().toISOString()
                });
                
                window.open('https://chromewebstore.google.com/detail/solthron-stop-overthinkin/ncogjoffibceogfjkichemlgehafpjfi', '_blank');
              }}
              style={{
                background: gradientTheme.gradient,
                color: '#000000',
                boxShadow: `0 6px 20px ${gradientTheme.lightGlow}`,
              }}
              onMouseEnter={(e) => {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = `0 8px 30px ${gradientTheme.brightLightGlow}`;
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = `0 6px 20px ${gradientTheme.lightGlow}`;
              }}
            >
              Get Started
            </a>
          </div>

          <EmailEnhancementDemo />
        </section>
        
        <div style={{
          width: '100%',
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 20%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.1) 80%, transparent 100%)',
          margin: '0 auto'
        }}></div>

        <FeatureDemoSection />

        <div style={{
          width: '100%',
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 20%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.1) 80%, transparent 100%)',
          margin: '0 auto'
        }}></div>
              
        <RotatingFeatureWheel />

        <div style={{
          width: '100%',
          height: '1px',
          background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 20%, rgba(255, 255, 255, 0.2) 50%, rgba(255, 255, 255, 0.1) 80%, transparent 100%)',
          margin: '0 auto'
        }}></div>

        <section className="why-solthron-section" style={{
          padding: '120px 40px 80px',
          position: 'relative'
        }}>
          <div className="why-solthron-content" style={{
            maxWidth: '800px',
            margin: '0 auto',
            textAlign: 'center',
            position: 'relative',
            zIndex: 2
          }}>
            <h2 className="why-solthron-title" style={{
              fontSize: '2.5rem',
              fontWeight: '700',
              color: '#ffffff',
              marginBottom: '32px',
              background: 'linear-gradient(135deg, #ffffff 0%, #e0e0e0 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.02em',
              lineHeight: '1.2'
            }}>
              Why Solthron Was Created
            </h2>
            
            <p className="why-solthron-text" style={{
              fontSize: '1.2rem',
              lineHeight: '1.8',
              color: 'rgba(255, 255, 255, 0.85)',
              fontWeight: '400',
              letterSpacing: '0.01em',
              maxWidth: '700px',
              margin: '0 auto',
              textAlign: 'center',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)'
            }}>
              Solthron was born from a simple belief: AI should work better for everyone. We're not another LLM—we're your intelligent companion that helps you communicate more effectively with any AI tool. Our purpose is to eliminate the guesswork in AI interactions, ensuring you get optimal results every time.
            </p>
          </div>
        </section>
      </div>
    );
  };

  return (
    <div>
      <AuthGateModal 
        isOpen={showAuthModal}
        onLogin={handleAuthModalAction}
      />
      
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/quick-auth" element={<QuickAuthPage />} />  
        <Route path="/features" element={<FeaturesPage navigateTo={navigateTo} activePage="features" />} />
        <Route path="/generator" element={
          <GeneratorPage 
            navigateTo={navigateTo}
            promptMode={promptMode}
            setPromptMode={setPromptMode}
            promptModeExpanded={promptModeExpanded}
            setPromptModeExpanded={setPromptModeExpanded}
            currentDetailLevel={currentDetailLevel}
            isExpanded={isExpanded}
            setIsExpanded={setIsExpanded}
            generatePrompt={generatePrompt}
            handleDetailLevelChange={handleDetailLevelChange}
            handleCopy={handleCopy}
            setAnalysisData={setAnalysisData}
          />
        } />
        <Route path="/chat" element={
          <ChatPage 
            analysisData={analysisData}
            navigateTo={navigateTo}
          />
        } />
        <Route path="/login" element={
          <LoginPage 
            navigateTo={navigateTo} 
            loginData={loginData} 
            setLoginData={setLoginData} 
            handleLogin={handleLogin}
            loading={loading}
            error={error}
          />
        } />
        <Route path="/signup" element={
          <SignupPage 
            navigateTo={navigateTo} 
            signupData={signupData} 
            setSignupData={setSignupData} 
            handleSignup={handleSignup}
            loading={loading}
            error={error}
          />
        } />
        <Route path="/privacy" element={<PrivacyPolicy navigateTo={navigateTo} />} />
        <Route path="/terms" element={<TermsOfService navigateTo={navigateTo} />} />
        <Route path="/cookies" element={<CookiePolicy navigateTo={navigateTo} />} />
        <Route path="/profile" element={<ProfilePage navigateTo={navigateTo} />} />
        <Route path="/subscription" element={<SubscriptionPage navigateTo={navigateTo} />} />
        <Route path="/gallery" element={<PromptGalleryPage navigateTo={navigateTo} />} />
        <Route path="/refresh-credits" element={<RefreshCreditsPage navigateTo={navigateTo} />} /> 
        <Route path="/about" element={<AboutPage navigateTo={navigateTo} />} />
        <Route path="/auth-action" element={<AuthActionPage navigateTo={navigateTo} />} />   
        <Route path="/contact" element={<ContactPage navigateTo={navigateTo} />} /> 
        <Route path="/download" element={<LandingPage navigateTo={navigateTo} />} />
        <Route path="/image-gallery" element={<ImageGalleryPage navigateTo={navigateTo} />} />      
        <Route path="/billing" element={<BillingPage navigateTo={navigateTo} />} />     
      </Routes> 
      
      <Footer navigateTo={navigateTo} />
    </div>
  );
}

export default App;
