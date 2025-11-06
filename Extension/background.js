chrome.action.onClicked.addListener(async (tab) => {
 try {
   await chrome.tabs.sendMessage(tab.id, { action: "toggleExtension" });
 } catch (error) {
   console.error('Error sending message:', error);
 }
});

// Helper function to get auth token
async function getAuthToken() {
  try {
    const result = await chrome.storage.local.get(['authToken']);
    return result.authToken || null;
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
}

// Helper function to create headers with optional auth
async function createHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  
  const authToken = await getAuthToken();
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  
  return headers;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
 // Main text enhancement handler - USED
 if (request.type === 'enhance_text') {
   const mode = request.data.mode || 'enhance';
   let endpoint = 'generate';
   let requestBody = { ...request.data, mode: mode };
   
   if (mode === 'persona_generator') {
     endpoint = 'generate-persona';
     requestBody = {
       text: request.data.topic,
       mode: mode
     };
   }
   
   const controller = new AbortController();
   const timeoutId = setTimeout(() => {
     console.log(`Request timeout for mode: ${mode}`);
     controller.abort();
   }, mode === 'persona_generator' ? 30000 : 15000);
   
   createHeaders().then(headers => {
     fetch(`https://afaque.pythonanywhere.com/${endpoint}`, {
       method: 'POST',
       headers: headers,
       body: JSON.stringify(requestBody),
       signal: controller.signal
     })
     .then(response => {
       clearTimeout(timeoutId);
       if (!response.ok) {
         throw new Error(`HTTP ${response.status}: ${response.statusText}`);
       }
       return response.json();
     })
     .then(data => {
       console.log(`Success for mode ${mode}:`, data.status || 'completed');
       sendResponse({success: true, data});
     })
     .catch(error => {
       clearTimeout(timeoutId);
       console.error('API error for mode:', mode, error);
       
       let errorMessage = error.message;
       if (error.name === 'AbortError') {
         errorMessage = `Request timeout - ${mode === 'persona_generator' ? 'AI analysis' : 'processing'} took too long`;
       } else if (error.message.includes('Failed to fetch')) {
         errorMessage = 'Network error - please check your connection';
       }
       
       sendResponse({success: false, error: errorMessage});
     });
   });
   return true;
 }

 // Smart Followups Handler - USED in content.js contextmenu
 if (request.type === 'smart_followups') {
   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), 20000);
   
   createHeaders().then(headers => {
     fetch('https://afaque.pythonanywhere.com/smart-followups', {
       method: 'POST',
       headers: headers,
       body: JSON.stringify({
         conversation: request.data.conversation,
         platform: request.data.platform
       }),
       signal: controller.signal
     })
     .then(response => {
       clearTimeout(timeoutId);
       if (!response.ok) {
         throw new Error(`HTTP ${response.status}: ${response.statusText}`);
       }
       return response.json();
     })
     .then(data => sendResponse({success: true, data}))
     .catch(error => {
       clearTimeout(timeoutId);
       console.error('Smart followups API error:', error);
       sendResponse({success: false, error: error.message});
     });
   });
   return true;
 }


 // Gmail Smart Reply - Analyze Email Questions Handler
 if (request.type === 'analyze_email_questions') {
   console.log('🔍 Analyzing email for questions:', {
     emailBody: request.data.emailBody?.substring(0, 50) + '...'
   });

   (async () => {
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), 20000);

     try {
       const headers = await createHeaders();

       const response = await fetch('https://afaque.pythonanywhere.com/analyze-email-questions', {
         method: 'POST',
         headers: headers,
         body: JSON.stringify({
           emailBody: request.data.emailBody,
           context: request.data.context
         }),
         signal: controller.signal
       });

       clearTimeout(timeoutId);
       const data = await response.json();

       if (!response.ok) {
         console.error('❌ Backend error:', response.status, data);
         sendResponse({
           success: false,
           error: data.error || `HTTP ${response.status}: ${response.statusText}`
         });
         return;
       }

       console.log('✅ Email analysis success:', data);
       sendResponse({success: true, data});

     } catch (error) {
       clearTimeout(timeoutId);
       console.error('❌ Email analysis API error:', error);

       let errorMessage = error.message || 'Unknown error';
       if (error.name === 'AbortError') {
         errorMessage = 'Email analysis timeout - please try again';
       } else if (errorMessage.includes('Failed to fetch')) {
         errorMessage = 'Network error - please check your connection';
       }

       sendResponse({success: false, error: errorMessage});
     }
   })();

   return true;
 }

 // Gmail Smart Reply - Generate Reply Handler
 if (request.type === 'gmail_smart_reply_generate') {
   console.log('✨ Generating smart reply:', {
     questionsCount: request.data.questions?.length,
     answersCount: Object.keys(request.data.answers || {}).length
   });

   (async () => {
     const controller = new AbortController();
     const timeoutId = setTimeout(() => controller.abort(), 25000);

     try {
       const headers = await createHeaders();

       const response = await fetch('https://afaque.pythonanywhere.com/gmail-smart-reply', {
         method: 'POST',
         headers: headers,
         body: JSON.stringify({
           emailBody: request.data.emailBody,
           context: request.data.context,
           questions: request.data.questions,
           answers: request.data.answers
         }),
         signal: controller.signal
       });

       clearTimeout(timeoutId);
       const data = await response.json();

       if (!response.ok) {
         console.error('❌ Backend error:', response.status, data);
         sendResponse({
           success: false,
           error: data.error || `HTTP ${response.status}: ${response.statusText}`
         });
         return;
       }

       console.log('✅ Smart reply generation success:', data);
       sendResponse({success: true, data});

     } catch (error) {
       clearTimeout(timeoutId);
       console.error('❌ Smart reply generation API error:', error);

       let errorMessage = error.message || 'Unknown error';
       if (error.name === 'AbortError') {
         errorMessage = 'Reply generation timeout - please try with shorter content';
       } else if (errorMessage.includes('Failed to fetch')) {
         errorMessage = 'Network error - please check your connection';
       }

       sendResponse({success: false, error: errorMessage});
     }
   })();

   return true;
 }

 // Image Processing Handler - USED for image features
 if (request.type === 'process_image') {
   const imageUrl = request.data.imageUrl;
   const mode = request.data.mode;

   const endpoint = mode === 'image_caption' ? 'generate-caption' :
                   mode === 'image_keyword' ? 'generate-keywords' :
                   'generate-image';

   const controller = new AbortController();
   const timeoutId = setTimeout(() => controller.abort(), 25000);

   fetch(imageUrl)
     .then(response => {
       if (!response.ok) {
         throw new Error(`Failed to fetch image: ${response.status}`);
       }
       return response.blob();
     })
     .then(blob => {
       const reader = new FileReader();
       reader.onloadend = () => {
         createHeaders().then(headers => {
           fetch(`https://afaque.pythonanywhere.com/${endpoint}`, {
             method: 'POST',
             headers: headers,
             body: JSON.stringify({
               image: reader.result,
               mode: mode
             }),
             signal: controller.signal
           })
           .then(response => {
             clearTimeout(timeoutId);
             if (!response.ok) {
               throw new Error(`HTTP ${response.status}: ${response.statusText}`);
             }
             return response.json();
           })
           .then(data => sendResponse({success: true, data}))
           .catch(error => {
             clearTimeout(timeoutId);
             console.error('Image processing API error:', error);
             sendResponse({success: false, error: error.message});
           });
         });
       };
       reader.onerror = () => {
         clearTimeout(timeoutId);
         console.error('FileReader error');
         sendResponse({success: false, error: 'Failed to read image file'});
       };
       reader.readAsDataURL(blob);
     })
     .catch(error => {
       clearTimeout(timeoutId);
       console.error('Image fetch error:', error);
       sendResponse({success: false, error: error.message});
     });
   return true;
 }

 // Return false for unhandled message types
 return false;
});
