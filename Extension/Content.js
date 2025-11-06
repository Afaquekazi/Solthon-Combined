// ========== SOLTHRON EXTENSION ==========

// Global variables
let shadowRoot;
let button;
let outputText;
let selectedMode;
let solthronContainer;
let currentCategory = null;
let isButtonVisible = false;
let activePromptId = null;
let isPromptStarActive = false;
let activeChatId = null;
let isChatStarActive = false;
// Workflow state tracking
let activeWorkflow = null;
let activeWorkflowName = null;
let isWorkflowExecuting = false; // Track if workflow is actively running
// Right-click feature state tracking
let rightClickFeaturesEnabled = false;
let lastSelectedRightClickMode = null;
let pageCredits = null;

// ========== @MENTIONS AUTOCOMPLETE VARIABLES ==========
let autocompleteDropdown = null;
let autocompleteMatches = [];
let selectedAutocompleteIndex = 0;
let lastAtPosition = -1;

// ✨ Double-click animation function
function triggerDoubleClickAnimation() {
    const solthronButton = shadowRoot.querySelector('.solthron-button');
    
    if (!solthronButton) return;
    
    solthronButton.classList.remove('double-click-activated');
    solthronButton.offsetHeight; // Force reflow
    solthronButton.classList.add('double-click-activated');
    
    setTimeout(() => {
        solthronButton.classList.remove('double-click-activated');
    }, 600);
}

// Loading Bar Helper Functions
function showShimmerLoading(message) {
    outputText.classList.remove('placeholder', 'error');
    outputText.classList.add('shimmer-loading');
    outputText.textContent = message;
}

function hideShimmerLoading() {
    outputText.classList.remove('shimmer-loading');
}

// Feature-to-credit mapping function
function getFeatureCredits(mode) {
    const explainModes = ['explain_meaning', 'explain_story', 'explain_eli5'];
    const aiAssistantModes = ['smart_followups']
    const imageModes = ['image_prompt']; // Removed image_caption
    const freeModes = ['save_note', 'save_persona'];


    if (explainModes.includes(mode)) return 5;
    if (aiAssistantModes.includes(mode)) return 15;
    if (imageModes.includes(mode)) return 12;
    if (freeModes.includes(mode)) return 0;

    return 6;
}

// ========== PLATFORM DETECTION ==========
function detectAIPlatform() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;
    
    // Check for Gmail first
    if (hostname.includes('mail.google.com')) {
        isGmailPage = true;
        return 'gmail';
    }
    
    if (hostname.includes('chatgpt.com') || hostname.includes('chat.openai.com')) {
        return 'chatgpt';
    } else if (hostname.includes('claude.ai')) {
        return 'claude';
    } else if (hostname.includes('gemini.google.com') || hostname.includes('bard.google.com')) {
        return 'gemini';
    } else if (hostname.includes('chat.deepseek.com')) {
        return 'deepseek';
    } else if (hostname.includes('lovable.dev')) {
        return 'lovable';
    } else if (hostname.includes('grok.x.com') || (hostname.includes('x.com') && pathname.includes('grok'))) {
        return 'grok';
    } else if (hostname.includes('perplexity.ai')) {
        return 'perplexity';
    }
    return 'unknown';
}

// ========== EXTRACT LAST Q&A EXCHANGE ==========
function extractLastExchange(platform) {
    try {
        switch(platform) {
            case 'chatgpt':
                return extractChatGPTLastExchange();
            case 'claude':
                return extractClaudeLastExchange();
            case 'gemini':
                return extractGeminiLastExchange();
            case 'deepseek':
                return extractDeepSeekLastExchange();
            case 'grok':
                return extractGrokLastExchange();
            case 'perplexity':
                return extractPerplexityLastExchange();
            default:
                return null;
        }
    } catch (error) {
        console.error('Error extracting last exchange:', error);
        return null;
    }
}

function extractChatGPTLastExchange() {
    const messages = document.querySelectorAll('[data-message-author-role]');
    
    if (messages.length < 2) return null;
    
    // Get last two messages (user question + AI answer)
    const userMessage = messages[messages.length - 2];
    const aiMessage = messages[messages.length - 1];
    
    // Verify roles
    const userRole = userMessage.getAttribute('data-message-author-role');
    const aiRole = aiMessage.getAttribute('data-message-author-role');
    
    if (userRole !== 'user' || aiRole !== 'assistant') {
        return null;
    }
    
    return {
        question: userMessage.textContent.trim(),
        answer: aiMessage.textContent.trim()
    };
}

function extractClaudeLastExchange() {
    // Get all message containers
    const allMessages = document.querySelectorAll('.font-user-message, .font-claude-message');
    
    if (allMessages.length < 2) return null;
    
    // Get last two
    const userMessage = allMessages[allMessages.length - 2];
    const aiMessage = allMessages[allMessages.length - 1];
    
    // Verify they're the right type
    if (!userMessage.classList.contains('font-user-message') || 
        !aiMessage.classList.contains('font-claude-message')) {
        return null;
    }
    
    return {
        question: userMessage.textContent.trim(),
        answer: aiMessage.textContent.trim()
    };
}

function extractGeminiLastExchange() {
    // Try multiple selectors for Gemini
    const userMessages = document.querySelectorAll('[class*="user-message"], [data-message-author="user"]');
    const aiMessages = document.querySelectorAll('[class*="model-message"], [class*="response-container"]');
    
    if (userMessages.length === 0 || aiMessages.length === 0) return null;
    
    const lastUserMsg = userMessages[userMessages.length - 1];
    const lastAiMsg = aiMessages[aiMessages.length - 1];
    
    return {
        question: lastUserMsg?.textContent.trim() || '',
        answer: lastAiMsg?.textContent.trim() || ''
    };
}

function extractDeepSeekLastExchange() {
    const messages = document.querySelectorAll('.message-container, [class*="message"]');
    
    if (messages.length < 2) return null;
    
    const userMessage = messages[messages.length - 2];
    const aiMessage = messages[messages.length - 1];
    
    return {
        question: userMessage?.textContent.trim() || '',
        answer: aiMessage?.textContent.trim() || ''
    };
}

function extractGrokLastExchange() {
    // Similar to ChatGPT structure
    const messages = document.querySelectorAll('[data-testid*="message"], .message');
    
    if (messages.length < 2) return null;
    
    return {
        question: messages[messages.length - 2]?.textContent.trim() || '',
        answer: messages[messages.length - 1]?.textContent.trim() || ''
    };
}

function extractPerplexityLastExchange() {
    const userMessages = document.querySelectorAll('[class*="user"]');
    const aiMessages = document.querySelectorAll('[class*="assistant"], [class*="answer"]');
    
    if (userMessages.length === 0 || aiMessages.length === 0) return null;
    
    return {
        question: userMessages[userMessages.length - 1]?.textContent.trim() || '',
        answer: aiMessages[aiMessages.length - 1]?.textContent.trim() || ''
    };
}

// ========== GMAIL CONTEXT EXTRACTION ==========
function extractGmailContext() {
    const context = {
        isReply: false,
        recipients: [],
        subject: '',
        previousEmails: [],
        isCompose: true
    };
    
    try {
        // Check if it's a reply
        const replyIndicators = document.querySelectorAll('.gmail_quote, .gmail_attr, blockquote');
        context.isReply = replyIndicators.length > 0;
        
        // Get recipients (TO field)
        const toFields = document.querySelectorAll('input[name="to"], span[email], .vR span[email]');
        toFields.forEach(field => {
            const email = field.getAttribute('email') || field.value;
            if (email && !context.recipients.includes(email)) {
                context.recipients.push(email);
            }
        });
        
        // Get subject line
        const subjectField = document.querySelector('input[name="subjectbox"], input[name="subject"]');
        if (subjectField) {
            context.subject = subjectField.value;
        }
        
        // Detect if formal (based on domain)
        context.isFormal = context.recipients.some(email => {
            return email.includes('.gov') || 
                   email.includes('.edu') || 
                   email.includes('ceo') || 
                   email.includes('director') ||
                   email.includes('manager');
        });
        
        // Get thread context if reply
        if (context.isReply) {
            const quotedText = document.querySelector('.gmail_quote, .ii.gt');
            if (quotedText) {
                context.previousEmails = quotedText.innerText.substring(0, 500); // First 500 chars for context
            }
        }
        
    } catch (error) {

    }
    
    return context;
}

// ========== CURSOR POSITION UTILITIES ==========
function getCursorPosition(element) {
    try {
        if (element.tagName === 'TEXTAREA') {
            return getCursorPositionTextarea(element);
        } else {
            return getCursorPositionContentEditable(element);
        }
    } catch (error) {
        console.warn('Error getting cursor position:', error);
        return null;
    }
}

function getCursorPositionContentEditable(element) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    try {
        const range = selection.getRangeAt(0);

        // ✅ FIX: Check if range is actually within our target element
        if (!element.contains(range.commonAncestorContainer)) {
            console.warn('⚠️ Selection is not within target element');
            return null;
        }

        const rect = range.getBoundingClientRect();

        // ✅ FIX: Better validation of rect
        if (rect.left === 0 && rect.top === 0 && rect.width === 0 && rect.height === 0) {
            // Completely empty rect, likely invalid selection
            return null;
        }

        // If range has no width/height, it's probably collapsed at cursor
        if (rect.width === 0 && rect.height === 0) {
            return {
                x: rect.left,
                y: rect.top,
                height: 20 // fallback height
            };
        }

        // For text selection, use the end of the range
        const endRange = range.cloneRange();
        endRange.collapse(false);
        const endRect = endRange.getBoundingClientRect();

        return {
            x: endRect.left || rect.left,
            y: endRect.top || rect.top,
            height: endRect.height || rect.height || 20
        };
    } catch (error) {
        console.warn('⚠️ Error getting cursor position:', error);
        return null;
    }
}

function getCursorPositionTextarea(element) {
    const selectionStart = element.selectionStart;
    const text = element.value.substring(0, selectionStart);
    
    // Create a temporary element to measure text
    const measurer = createTextMeasurer(element);
    const position = measureTextPosition(measurer, text, element);
    
    // Clean up
    document.body.removeChild(measurer);
    
    return position;
}

function createTextMeasurer(textarea) {
    const measurer = document.createElement('div');
    const style = window.getComputedStyle(textarea);
    const platform = detectAIPlatform();
    
    // Base styling that works for all platforms
    let measurerCSS = `
        position: absolute;
        visibility: hidden;
        height: auto;
        width: ${textarea.offsetWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)}px;
        font: ${style.font};
        font-family: ${style.fontFamily};
        font-size: ${style.fontSize};
        font-weight: ${style.fontWeight};
        line-height: ${style.lineHeight};
        letter-spacing: ${style.letterSpacing};
        white-space: pre-wrap;
        word-wrap: break-word;
        padding: ${style.paddingTop} ${style.paddingRight} ${style.paddingBottom} ${style.paddingLeft};
        border: ${style.border};
        box-sizing: ${style.boxSizing};
        z-index: -1;
    `;
    
    // Platform-specific positioning
    if (platform === 'deepseek' || platform === 'grok') {
        // For DeepSeek and Grok, position the measurer element exactly over the textarea
        const rect = textarea.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        measurerCSS += `
            top: ${rect.top + scrollTop}px;
            left: ${rect.left + scrollLeft}px;
        `;
    } else {
        // For other platforms, use the original positioning (off-screen)
        measurerCSS += `
            top: -9999px;
            left: -9999px;
        `;
    }
    
    measurer.style.cssText = measurerCSS;
    document.body.appendChild(measurer);
    return measurer;
}

function measureTextPosition(measurer, text, textarea) {
    // Add text up to cursor position
    measurer.textContent = text;
    
    // Add a marker span at the end to get cursor position
    const marker = document.createElement('span');
    marker.textContent = '|';
    measurer.appendChild(marker);
    
    const textareaRect = textarea.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const measurerRect = measurer.getBoundingClientRect();
    
    // Platform-specific coordinate calculation
    const platform = detectAIPlatform();
    
    if (platform === 'deepseek' || platform === 'grok') {
        // DeepSeek and Grok need special coordinate handling
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        // Calculate relative position within measurer, then translate to textarea coordinates
        const relativeX = markerRect.left - measurerRect.left;
        const relativeY = markerRect.top - measurerRect.top;
        
        return {
            x: textareaRect.left + relativeX,
            y: textareaRect.top + relativeY,
            height: markerRect.height || 20
        };
    } else {
        // Original logic for other platforms (ChatGPT, Claude, Gemini)
        return {
            x: markerRect.left,
            y: markerRect.top,
            height: markerRect.height || 20
        };
    }
}


// ========== @MENTIONS AUTOCOMPLETE SYSTEM ==========

async function searchSavedItems(query) {
    try {
        const prompts = await loadPrompts();
        const workflows = await loadWorkflows();
        
        const allItems = [
            ...prompts.map(p => ({...p, type: 'prompt', icon: '📝', category: 'Prompt'})),
            ...workflows.map(w => ({
                ...w, 
                type: 'workflow', 
                icon: '⚙️', 
                category: 'Workflow',
                text: w.title // Use title for searching
            }))
        ];
        
        if (!query) {
            return allItems.slice(0, 8); // Show first 8 if no query
        }
        
        // Fuzzy search
        return allItems.filter(item => {
            // Search in title for all items
            if (item.title && item.title.toLowerCase().includes(query.toLowerCase())) {
                return true;
            }
            // Search in text for prompts
            if (item.text && item.text.toLowerCase().includes(query.toLowerCase())) {
                return true;
            }
            // Search in workflow steps
            if (item.steps) {
                return item.steps.some(step => 
                    step.prompt.toLowerCase().includes(query.toLowerCase())
                );
            }
            return false;
        }).slice(0, 8); // Max 8 results
        
    } catch (error) {
        console.error('Error searching saved items:', error);
        return [];
    }
}

function createAutocompleteDropdown() {
    if (autocompleteDropdown) {
        autocompleteDropdown.remove();
    }
    
    autocompleteDropdown = document.createElement('div');
    autocompleteDropdown.id = 'solthron-autocomplete';
    autocompleteDropdown.style.cssText = `
        position: absolute;
        background: #2a2a2a;
        border: 2px solid rgba(255, 215, 0, 0.4);
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        max-height: 280px;
        overflow-y: auto;
        z-index: 9999999;
        min-width: 300px;
        display: none;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    // Add scrollbar styling
    const style = document.createElement('style');
    style.textContent = `
        #solthron-autocomplete::-webkit-scrollbar {
            width: 6px;
        }
        #solthron-autocomplete::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
        }
        #solthron-autocomplete::-webkit-scrollbar-thumb {
            background: rgba(255, 215, 0, 0.3);
            border-radius: 3px;
        }
        #solthron-autocomplete::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 215, 0, 0.5);
        }
    `;
    document.head.appendChild(style);
    
    document.body.appendChild(autocompleteDropdown);
    return autocompleteDropdown;
}

function renderAutocompleteItems(matches) {
    if (!autocompleteDropdown) {
        createAutocompleteDropdown();
    }
    
    autocompleteDropdown.innerHTML = '';
    
    if (matches.length === 0) {
        const emptyState = document.createElement('div');
        emptyState.style.cssText = `
            padding: 12px;
            color: rgba(255, 255, 255, 0.5);
            text-align: center;
            font-size: 12px;
        `;
        emptyState.textContent = 'No saved items found';
        autocompleteDropdown.appendChild(emptyState);
        return;
    }
    
    matches.forEach((item, index) => {
        const option = document.createElement('div');
        option.className = 'autocomplete-option';
        option.dataset.index = index;
        
        const isSelected = index === selectedAutocompleteIndex;
        
        option.style.cssText = `
            padding: 10px 12px;
            cursor: pointer;
            transition: all 0.2s ease;
            border-left: 3px solid ${isSelected ? '#ffd700' : 'transparent'};
            background: ${isSelected ? 'rgba(255, 215, 0, 0.1)' : 'transparent'};
            display: flex;
            align-items: center;
            gap: 10px;
        `;
        
        option.innerHTML = `
            <span style="font-size: 16px; flex-shrink: 0;">${item.icon}</span>
            <div style="flex: 1; overflow: hidden;">
                <div style="
                    color: rgba(255, 255, 255, 0.9);
                    font-size: 13px;
                    font-weight: 500;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                ">${item.title}</div>
                <div style="
                    color: rgba(255, 255, 255, 0.5);
                    font-size: 11px;
                    margin-top: 2px;
                ">${item.category}</div>
            </div>
            <div style="
                color: rgba(255, 215, 0, 0.6);
                font-size: 11px;
                flex-shrink: 0;
            ">↵</div>
        `;
        
        option.addEventListener('mouseenter', () => {
            selectedAutocompleteIndex = index;
            renderAutocompleteItems(autocompleteMatches);
        });
        
        option.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('🖱️ Mousedown on option:', item.title);
          insertAutocompleteItem(item);
});

        option.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('🖱️ Click on option:', item.title);
          insertAutocompleteItem(item);
});
        
        autocompleteDropdown.appendChild(option);
    });
}

function positionAutocompleteDropdown() {
    if (!autocompleteDropdown || !currentInputField) return;
    
    const cursorPos = getCursorPosition(currentInputField);
    
    if (cursorPos) {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        // Position below cursor
        let x = cursorPos.x + scrollLeft;
        let y = cursorPos.y + scrollTop + (cursorPos.height || 20) + 5;
        
        // Viewport boundary checks
        const dropdownWidth = 300;
        const dropdownHeight = Math.min(280, autocompleteMatches.length * 60);
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Adjust horizontal position if needed
        if (x + dropdownWidth > viewportWidth + scrollLeft - 10) {
            x = viewportWidth + scrollLeft - dropdownWidth - 10;
        }
        
        // Adjust vertical position if needed (show above cursor if not enough space below)
        if (y + dropdownHeight > viewportHeight + scrollTop - 10) {
            y = cursorPos.y + scrollTop - dropdownHeight - 5;
        }
        
        autocompleteDropdown.style.left = `${x}px`;
        autocompleteDropdown.style.top = `${y}px`;
    } else {
        // Fallback positioning
        const rect = currentInputField.getBoundingClientRect();
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
        
        autocompleteDropdown.style.left = `${rect.left + scrollLeft}px`;
        autocompleteDropdown.style.top = `${rect.bottom + scrollTop + 5}px`;
    }
}

async function showAutocompleteDropdown(searchTerm) {
    autocompleteMatches = await searchSavedItems(searchTerm);
    selectedAutocompleteIndex = 0;
    
    if (!autocompleteDropdown) {
        createAutocompleteDropdown();
    }
    
    renderAutocompleteItems(autocompleteMatches);
    positionAutocompleteDropdown();
    autocompleteDropdown.style.display = 'block';
}

async function showWorkflowStepDropdown(stepNumber) {
    const step = activeWorkflow[stepNumber - 1];
    
    // Create a pseudo-item for the workflow step
    autocompleteMatches = [{
        id: `workflow-step-${stepNumber}`,
        type: 'workflow-step',
        icon: '⚙️',
        title: `Step ${stepNumber}`,
        category: `${activeWorkflowName} Workflow`,
        prompt: step.prompt,
        stepNumber: stepNumber
    }];
    
    selectedAutocompleteIndex = 0;
    
    if (!autocompleteDropdown) {
        createAutocompleteDropdown();
    }
    
    renderAutocompleteItems(autocompleteMatches);
    positionAutocompleteDropdown();
    autocompleteDropdown.style.display = 'block';
}

function hideAutocompleteDropdown() {
    if (autocompleteDropdown) {
        autocompleteDropdown.style.display = 'none';
    }
    autocompleteMatches = [];
    selectedAutocompleteIndex = 0;
    lastAtPosition = -1;
}

function insertAutocompleteItem(item) {
    if (!currentInputField) {
        console.error('❌ No currentInputField available');
        return;
    }
    
    console.log('🎯 Starting insertion for:', item.title);
    console.log('📋 Item type:', item.type);
    console.log('🔧 Input element:', currentInputField.tagName);
    
    const input = currentInputField;
    const platform = detectAIPlatform();
    
    // Get content to insert
    let contentToInsert = '';
    if (item.type === 'workflow') {
        // Reset any previous workflow and activate new one
        activeWorkflow = item.steps;
        activeWorkflowName = item.name;
        contentToInsert = item.steps[0].prompt;
        console.log(`🔄 Activated workflow: ${activeWorkflowName} (Step 1)`);
        } else if (item.type === 'workflow-step') {
        // Insert specific workflow step
        contentToInsert = item.prompt;
        console.log(`📍 Inserted step ${item.stepNumber} of ${activeWorkflowName}`);
    } else {
        contentToInsert = item.text;
    }
    
    console.log('📝 Content to insert (first 100 chars):', contentToInsert.substring(0, 100));
    
    try {
        // Get current text using your existing helper
        const currentText = getInputText(input);
        console.log('📄 Current text length:', currentText.length);
        
        // Find the @ position
        const atIndex = currentText.lastIndexOf('@');
        console.log('📍 @ symbol found at index:', atIndex);
        
        let newText;
        if (atIndex !== -1) {
            // Find where the @mention ends (space, newline, or end of text)
            let mentionEnd = atIndex + 1;
            while (mentionEnd < currentText.length && 
                   currentText[mentionEnd] !== ' ' && 
                   currentText[mentionEnd] !== '\n') {
                mentionEnd++;
            }
            
            console.log('📍 Mention ends at index:', mentionEnd);
            
            // Build new text: before @ + content + after mention
            newText = currentText.substring(0, atIndex) + 
                     contentToInsert + 
                     currentText.substring(mentionEnd);
        } else {
            console.warn('⚠️ No @ found, appending to end');
            newText = currentText + '\n\n' + contentToInsert;
        }
        
        console.log('✏️ Setting new text (length:', newText.length, ')');
        
        // Use your existing setInputText function
        setInputText(input, newText);
        
        console.log('✅ Text set successfully');
        
        // Force focus back to input
        setTimeout(() => {
            input.focus();
            console.log('🎯 Focus restored to input');
        }, 100);
        
    } catch (error) {
        console.error('❌ Error during insertion:', error);
        console.error('Error stack:', error.stack);
    }
    
    // Hide dropdown
    hideAutocompleteDropdown();
    console.log('✅ Insertion complete, dropdown hidden');
}

function getTextOffset(element, node, offset) {
    let textOffset = 0;
    const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    let currentNode;
    while (currentNode = walker.nextNode()) {
        if (currentNode === node) {
            return textOffset + offset;
        }
        textOffset += currentNode.textContent.length;
    }
    
    return textOffset;
}

// ========== QUICK SAVE FUNCTION (Ctrl+Shift+S) ==========
// ========== QUICK SAVE FUNCTION (Alt+S) ==========
function handleQuickSave(e) {
    // Check for Alt+S
    if (e.altKey && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        
        // Try to get highlighted text first
        let text = window.getSelection().toString().trim();
        
        // If no highlighted text, get text from input field
        if (!text && e.target) {
            text = getInputText(e.target);
        }
        
        if (text.trim().length > 0) {
            console.log('💾 Quick save triggered');
            
            // Save directly to prompts
            savePrompt(text).then(success => {
                if (success) {
                    // Show visual feedback
                    showQuickSaveFeedback();
                }
            });
        } else {
            console.log('⚠️ No text to save');
        }
    }
}

// ========== UNIVERSAL NOTIFICATION FUNCTION ==========
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    
    const bgColor = type === 'success' ? 'rgba(0, 255, 0, 0.9)' : 
                    type === 'error' ? 'rgba(255, 107, 107, 0.9)' :
                    'rgba(255, 215, 0, 0.9)';
    
    notification.style.cssText = `
        position: fixed;
        bottom: 80px;
        right: 20px;
        background: ${bgColor};
        color: black;
        padding: 12px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        z-index: 999999;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        animation: slideIn 0.3s ease;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateY(10px)';
        notification.style.transition = 'all 0.3s ease';
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, 2500);
}

// Keep wrapper for backward compatibility
function showQuickSaveFeedback() {
    showNotification('✓ Saved to Prompts');
}



function handleAutocompleteKeydown(e) {
    if (!autocompleteDropdown || autocompleteDropdown.style.display === 'none') {
        return false;
    }
    
    switch(e.key) {
        case 'ArrowDown':
            e.preventDefault();
            selectedAutocompleteIndex = Math.min(
                selectedAutocompleteIndex + 1,
                autocompleteMatches.length - 1
            );
            renderAutocompleteItems(autocompleteMatches);
            
            // Scroll into view
            const selectedOption = autocompleteDropdown.querySelector(`[data-index="${selectedAutocompleteIndex}"]`);
            if (selectedOption) {
                selectedOption.scrollIntoView({ block: 'nearest' });
            }
            return true;
            
        case 'ArrowUp':
            e.preventDefault();
            selectedAutocompleteIndex = Math.max(selectedAutocompleteIndex - 1, 0);
            renderAutocompleteItems(autocompleteMatches);
            
            // Scroll into view
            const selectedOptionUp = autocompleteDropdown.querySelector(`[data-index="${selectedAutocompleteIndex}"]`);
            if (selectedOptionUp) {
                selectedOptionUp.scrollIntoView({ block: 'nearest' });
            }
            return true;
            
        case 'Enter':
            if (autocompleteMatches.length > 0) {
                e.preventDefault();
                e.stopPropagation();
                insertAutocompleteItem(autocompleteMatches[selectedAutocompleteIndex]);
                return true;
            }
            break;
            
        case 'Escape':
            e.preventDefault();
            hideAutocompleteDropdown();
            return true;
            
        case 'Tab':
            if (autocompleteMatches.length > 0) {
                e.preventDefault();
                insertAutocompleteItem(autocompleteMatches[selectedAutocompleteIndex]);
                return true;
            }
            break;
    }
    
    return false;
}

async function handleAutocompleteInput(e) {
    const input = e.target;
    let text, cursorPos;
    
    if (input.tagName === 'TEXTAREA') {
        text = input.value;
        cursorPos = input.selectionStart;
    } else {
        text = input.innerText || input.textContent || '';
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            cursorPos = getTextOffset(input, range.startContainer, range.startOffset);
        } else {
            cursorPos = text.length;
        }
    }
    
    const textBefore = text.substring(0, cursorPos);
    
    // Check for workflow step number (@2, @3, etc.) if workflow is active
    if (activeWorkflow && activeWorkflowName) {
        const stepMatch = textBefore.match(/@(\d+)$/);
        if (stepMatch) {
            const stepNumber = parseInt(stepMatch[1]);
            if (stepNumber >= 1 && stepNumber <= activeWorkflow.length) {
                // Show dropdown with the specific step
                lastAtPosition = textBefore.lastIndexOf('@');
                await showWorkflowStepDropdown(stepNumber);
                return;
            }
        }
    }
    
    // Check for @ trigger with optional search term
    const atMatch = textBefore.match(/@([\w\s]*)$/);
    
    if (atMatch) {
        const searchTerm = atMatch[1];
        lastAtPosition = textBefore.lastIndexOf('@');
        await showAutocompleteDropdown(searchTerm);
    } else {
        hideAutocompleteDropdown();
    }
}

// BACKEND AUTH SYSTEM
const BackendAuth = {
    async getAuthToken() {
        try {
            const result = await chrome.storage.local.get(['authToken']);
            return result.authToken || null;
        } catch (error) {
            console.error('Error getting auth token:', error);
            return null;
        }
    },

    async setAuthToken(token) {
        try {
            await chrome.storage.local.set({
                authToken: token,
                authTimestamp: Date.now()
            });
            return true;
        } catch (error) {
            console.error('Error setting auth token:', error);
            return false;
        }
    },

    async exchangeFirebaseTokenForBackendJWT(firebaseToken) {
        try {
            console.log('🔄 Exchanging Firebase token for backend JWT...');

            const response = await fetch('https://afaque.pythonanywhere.com/google-login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ firebaseToken })
            });

            const data = await response.json();

            if (response.ok && data.success && data.token) {
                console.log('✅ Successfully exchanged for backend JWT');
                return { success: true, token: data.token, user: data.user };
            } else {
                console.error('❌ Token exchange failed:', data.error);
                return { success: false, error: data.error || 'Token exchange failed' };
            }
        } catch (error) {
            console.error('❌ Token exchange error:', error);
            return { success: false, error: error.message };
        }
    },

    async isLoggedIn() {
        try {
            const token = await this.getAuthToken();
            if (!token) return false;

            const response = await fetch('https://afaque.pythonanywhere.com/user-credits', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            return response.ok;
        } catch (error) {
            console.error('Error checking login status:', error);
            return false;
        }
    },

    async login(email, password) {
        try {
            const response = await fetch('https://afaque.pythonanywhere.com/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                await this.setAuthToken(data.token);
                return { success: true, user: data.user };
            } else {
                return { success: false, error: data.error || 'Login failed' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: 'Network error' };
        }
    },

    async logout() {
        try {
            await chrome.storage.local.remove(['authToken', 'authTimestamp']);
            pageCredits = null;
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            return false;
        }
    },

    async getUserCredits() {
        try {
            const token = await this.getAuthToken();
            if (!token) return 0;

            const response = await fetch('https://afaque.pythonanywhere.com/user-credits', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data.credits || 0;
            }
            return 0;
        } catch (error) {
            console.error('Error getting user credits:', error);
            return 0;
        }
    },

    async deductCredits(feature) {
        try {
            const token = await this.getAuthToken();
            if (!token) {
                return { success: false, message: "Not logged in" };
            }

            const response = await fetch('https://afaque.pythonanywhere.com/deduct-credits', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ feature })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error deducting credits:', error);
            return { success: false, message: error.message };
        }
    }
};

// Storage functions

async function savePrompt(promptText) {
    // ✅ Check if a prompt is starred/active (append mode)
    if (isPromptStarActive && activePromptId) {
        try {
            const data = await chrome.storage.local.get('savedPrompts');
            const savedPrompts = data.savedPrompts || [];
            const promptIndex = savedPrompts.findIndex(prompt => prompt.id === activePromptId);
            
            if (promptIndex !== -1) {
                // Append to existing prompt
                savedPrompts[promptIndex].text += '\n\n' + promptText;
                savedPrompts[promptIndex].timestamp = new Date().toISOString();
                await chrome.storage.local.set({ savedPrompts });
                return true;
            }
        } catch (error) {
            console.error('Error appending to prompt:', error);
            return false;
        }
    } else {
        // Create new prompt
        const promptId = Date.now().toString();
        const title = generateTitleFromText(promptText);
        
        const prompt = {
            id: promptId,
            title: title,
            text: promptText,
            timestamp: new Date().toISOString()
        };
        
        try {
            const data = await chrome.storage.local.get('savedPrompts');
            const savedPrompts = data.savedPrompts || [];
            savedPrompts.push(prompt);
            await chrome.storage.local.set({ savedPrompts });
            return true;
        } catch (error) {
            console.error('Error saving prompt:', error);
            return false;
        }
    }
}

// ✅ NEW: Helper function to generate title from text
function generateTitleFromText(text) {
    if (!text || !text.trim()) {
        return 'Untitled';
    }
    
    // Remove extra whitespace and newlines
    const cleanText = text.trim().replace(/\s+/g, ' ');
    
    // Try to get first line/sentence
    let title = cleanText.split('\n')[0]; // First line
    if (!title) {
        title = cleanText.split('.')[0]; // First sentence
    }
    if (!title) {
        title = cleanText; // Fallback to full text
    }
    
    // Limit to 50 characters and break at word boundary
    if (title.length > 50) {
        title = title.substring(0, 50);
        const lastSpace = title.lastIndexOf(' ');
        if (lastSpace > 20) {
            title = title.substring(0, lastSpace);
        }
        title = title.trim() + '...';
    }
    
    return title;
}

// ========== DETECT CODE IN TEXT ==========
function detectCode(text) {
    if (!text) return false;
    
    // Check for code indicators
    const codeIndicators = [
        '```',           // Code blocks
        'function',      // JavaScript
        'def ',          // Python
        'class ',        // OOP
        'import ',       // Imports
        'const ',        // JS const
        'let ',          // JS let
        '<div',          // HTML
        'SELECT ',       // SQL
        '{',             // JSON/Objects
    ];
    
    return codeIndicators.some(indicator => text.includes(indicator));
}

// ========== DETECT PROGRAMMING LANGUAGE ==========
function detectLanguage(text) {
    if (!text) return null;
    
    // Check for code block with language
    const codeBlockMatch = text.match(/```(\w+)/);
    if (codeBlockMatch) {
        return codeBlockMatch[1];
    }
    
    // Heuristic detection
    if (text.includes('def ') && text.includes(':')) return 'python';
    if (text.includes('function') || text.includes('const ')) return 'javascript';
    if (text.includes('public class')) return 'java';
    if (text.includes('<?php')) return 'php';
    if (text.includes('<html') || text.includes('<div')) return 'html';
    if (text.includes('SELECT') && text.includes('FROM')) return 'sql';
    
    return null;
}

async function loadPrompts() {
    try {
        const data = await chrome.storage.local.get('savedPrompts');
        let savedPrompts = data.savedPrompts || [];
        
        // ✅ NEW: Migration - Add titles to old prompts that don't have them
        let needsUpdate = false;
        savedPrompts = savedPrompts.map(prompt => {
            if (!prompt.title) {
                prompt.title = generateTitleFromText(prompt.text);
                needsUpdate = true;
            }
            return prompt;
        });
        
        // Save migrated prompts back to storage
        if (needsUpdate) {
            await chrome.storage.local.set({ savedPrompts });
            console.log('✅ Migrated', savedPrompts.length, 'prompts to new title format');
        }
        
        return savedPrompts;
    } catch (error) {
        console.error('Error loading prompts:', error);
        return [];
    }
}

async function loadWorkflows() {
    const builtInWorkflows = [
        {
            id: 'workflow-blogwriter',
            name: 'BlogWriter',
            title: 'Blog Writer Workflow',
            steps: [
                { number: 1, prompt: 'Write a blog article about AI trends' },
                { number: 2, prompt: 'Add some real life stories' },
                { number: 3, prompt: 'Add SEO keywords' },
                { number: 4, prompt: 'Make it easy to read and use simple english' },
                { number: 5, prompt: 'Add a catchy title and meta description' }
            ],
            timestamp: new Date().toISOString(),
            source: 'built_in'
        },
        {
            id: 'workflow-emailresponder',
            name: 'EmailResponder',
            title: 'Email Response Workflow',
            steps: [
                { number: 1, prompt: 'Read the email and understand the main points' },
                { number: 2, prompt: 'Draft a professional response addressing all concerns' },
                { number: 3, prompt: 'Add a friendly greeting and closing' },
                { number: 4, prompt: 'Proofread for tone and clarity' }
            ],
            timestamp: new Date().toISOString(),
            source: 'built_in'
        },
        {
            id: 'workflow-poetrywriter',
            name: 'PoetryWriter',
            title: 'Poetry Writer Workflow',
            steps: [
                { number: 1, prompt: 'Write a {length} poem about {theme} in {style} style' },
                { number: 2, prompt: 'Add vivid imagery and metaphors related to {theme}' },
                { number: 3, prompt: 'Ensure the poem follows {style} structure and rhythm' },
                { number: 4, prompt: 'Add a powerful conclusion that resonates with the {theme}' }
            ],
            variables: [
                { name: 'theme', label: 'Theme', placeholder: 'e.g., nature, love, freedom' },
                { name: 'style', label: 'Style', placeholder: 'e.g., haiku, sonnet, free verse' },
                { name: 'length', label: 'Length', placeholder: 'e.g., short, medium, long' }
            ],
            timestamp: new Date().toISOString(),
            source: 'built_in'
        }
    ];
    
    try {
        const storageData = await chrome.storage.local.get('workflows');
        const savedWorkflows = storageData.workflows || [];
        return [...builtInWorkflows, ...savedWorkflows];
    } catch (error) {
        console.error('Error loading workflows:', error);
        return builtInWorkflows;
    }
}


async function deletePrompt(promptId) {
    try {
        const data = await chrome.storage.local.get('savedPrompts');
        const savedPrompts = (data.savedPrompts || []).filter(p => p.id !== promptId);
        await chrome.storage.local.set({ savedPrompts });
        return true;
    } catch (error) {
        console.error('Error deleting prompt:', error);
        return false;
    }
}



async function deleteWorkflow(workflowId) {
    try {
        const data = await chrome.storage.local.get('workflows');
        const workflows = (data.workflows || []).filter(w => w.id !== workflowId);
        await chrome.storage.local.set({ workflows });
        return true;
    } catch (error) {
        console.error('Error deleting workflow:', error);
        return false;
    }
}

// ========== SAVE CHAT EXCHANGE ==========
async function saveChatExchange(exchangeData) {
    // ✅ Check if a chat is starred/active (append mode)
    if (isChatStarActive && activeChatId) {
        try {
            const data = await chrome.storage.local.get('savedChats');
            const savedChats = data.savedChats || [];
            const chatIndex = savedChats.findIndex(chat => chat.id === activeChatId);
            
            if (chatIndex !== -1) {
                // Append to existing chat in Q&A format
                const newExchange = `\n\n---\n\nQ: ${exchangeData.question}\nA: ${exchangeData.answer}`;
                
                // Check if the original format is Q&A style or old format
                const isOldFormat = !savedChats[chatIndex].question.startsWith('Q: ');
                
                if (isOldFormat) {
                    // Convert old format to new Q&A format
                    savedChats[chatIndex].question = `Q: ${savedChats[chatIndex].question}\nA: ${savedChats[chatIndex].answer}`;
                    savedChats[chatIndex].answer = ''; // Clear answer field (no longer needed)
                }
                
                // Append new exchange
                savedChats[chatIndex].question += newExchange;
                
                // Update metadata
                savedChats[chatIndex].date = new Date().toISOString(); // Update timestamp
                // Keep original chatLink (Option A from before)
                
                // Update detection flags
                savedChats[chatIndex].hasCode = savedChats[chatIndex].hasCode || exchangeData.hasCode;
                if (exchangeData.language && !savedChats[chatIndex].language) {
                    savedChats[chatIndex].language = exchangeData.language;
                }
                
                await chrome.storage.local.set({ savedChats });
                console.log('✅ Appended to chat:', savedChats[chatIndex].title);
                return true;
            }
        } catch (error) {
            console.error('❌ Error appending to chat:', error);
            return false;
        }
    } else {
        // Create new chat in Q&A format
        try {
            const data = await chrome.storage.local.get('savedChats');
            const savedChats = data.savedChats || [];
            
            // ✅ Format new chats in Q&A style
            const formattedData = {
                ...exchangeData,
                question: `Q: ${exchangeData.question}\nA: ${exchangeData.answer}`,
                answer: '' // Empty since we're storing both in question field
            };
            
            savedChats.push(formattedData);
            
            await chrome.storage.local.set({ savedChats });
            
            console.log('✅ Chat exchange saved:', formattedData.title);
            return true;
        } catch (error) {
            console.error('❌ Error saving chat exchange:', error);
            return false;
        }
    }
}

// ========== LOAD SAVED CHATS ==========
async function loadSavedChats() {
    try {
        const data = await chrome.storage.local.get('savedChats');
        return data.savedChats || [];
    } catch (error) {
        console.error('Error loading saved chats:', error);
        return [];
    }
}

// ========== DELETE SAVED CHAT ==========
async function deleteSavedChat(chatId) {
    try {
        const data = await chrome.storage.local.get('savedChats');
        const savedChats = (data.savedChats || []).filter(c => c.id !== chatId);
        await chrome.storage.local.set({ savedChats });
        return true;
    } catch (error) {
        console.error('Error deleting chat:', error);
        return false;
    }
}

// ========== RENAME SAVED CHAT ==========
async function renameSavedChat(chatId, newTitle) {
    try {
        const data = await chrome.storage.local.get('savedChats');
        const savedChats = data.savedChats || [];
        const chatIndex = savedChats.findIndex(chat => chat.id === chatId);
        
        if (chatIndex !== -1) {
            savedChats[chatIndex].title = newTitle;
            savedChats[chatIndex].date = new Date().toISOString();
            await chrome.storage.local.set({ savedChats });
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error renaming chat:', error);
        return false;
    }
}


async function renamePrompt(promptId, newTitle) {
    try {
        const data = await chrome.storage.local.get('savedPrompts');
        const savedPrompts = data.savedPrompts || [];
        const promptIndex = savedPrompts.findIndex(prompt => prompt.id === promptId);
        
        if (promptIndex !== -1) {
            console.log('🔍 Before rename:', {
                oldTitle: savedPrompts[promptIndex].title,
                newTitle: newTitle,
                contentPreview: savedPrompts[promptIndex].text.substring(0, 50)
            });
            
            // ✅ CRITICAL: Only update title, NEVER touch text
            savedPrompts[promptIndex].title = newTitle;
            savedPrompts[promptIndex].timestamp = new Date().toISOString();
            
            console.log('✅ After rename:', {
                title: savedPrompts[promptIndex].title,
                contentPreview: savedPrompts[promptIndex].text.substring(0, 50)
            });
            
            await chrome.storage.local.set({ savedPrompts });
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error renaming prompt:', error);
        return false;
    }
}

function extractConversation() {
    const platform = detectAIPlatform();
    let conversation = '';
    
    try {
        switch(platform) {
            case 'chatgpt':
                const chatMessages = document.querySelectorAll('[data-message-author-role]');
                if (chatMessages.length >= 2) {
                    const lastTwo = Array.from(chatMessages).slice(-2);
                    conversation = lastTwo.map(msg => {
                        const role = msg.getAttribute('data-message-author-role');
                        const text = msg.textContent.trim();
                        return `${role === 'user' ? 'User' : 'AI'}: ${text}`;
                    }).join('\n\n');
                }
                break;
                
            case 'claude':
                const claudeMessages = document.querySelectorAll('.prose, [data-testid*="message"]');
                if (claudeMessages.length >= 2) {
                    const lastTwo = Array.from(claudeMessages).slice(-2);
                    conversation = lastTwo.map((msg, idx) => {
                        const role = idx === 0 ? 'User' : 'AI';
                        return `${role}: ${msg.textContent.trim()}`;
                    }).join('\n\n');
                }
                break;
                
            case 'gemini':
                let geminiMessages = [];
                
                const messageElements = document.querySelectorAll(
                    'message-content[id*="message-content"], ' +
                    '[id*="model-response-message-content"], ' + 
                    '.model-response-text, ' +
                    '.markdown.markdown-main-panel, ' +
                    '.conversation-container .response-content'
                );
                
                if (messageElements.length > 0) {
                    geminiMessages = Array.from(messageElements).filter(el => {
                        const text = el.textContent.trim();
                        const isSubstantial = text.length > 30 && text.length < 5000;
                        const isNotSidebar = !el.closest('.side-navigation, .recent-chats, nav');
                        return isSubstantial && isNotSidebar;
                    });
                }
                
                if (geminiMessages.length < 2) {
                    const chatHistory = document.querySelector('#chat-history, .chat-history, .conversation-container');
                    if (chatHistory) {
                        const possibleMessages = chatHistory.querySelectorAll(
                            'div[class*="response"], div[class*="message"], p, .markdown'
                        );
                        geminiMessages = Array.from(possibleMessages).filter(el => {
                            const text = el.textContent.trim();
                            return text.length > 50 && text.length < 3000 && 
                                   !el.closest('button, input') &&
                                   !text.includes('Recent') &&
                                   !text.includes('New chat') &&
                                   !text.includes('Search for');
                        });
                    }
                }
                
                if (geminiMessages.length < 2) {
                    const userMessages = document.querySelectorAll('[class*="user"], .user-message, [role="user"]');
                    const aiMessages = document.querySelectorAll('[class*="model"], [class*="response"], .ai-message');
                    
                    if (userMessages.length > 0 && aiMessages.length > 0) {
                        geminiMessages = [
                            ...Array.from(userMessages).slice(-1),
                            ...Array.from(aiMessages).slice(-1)
                        ];
                    }
                }
                
                if (geminiMessages.length >= 2) {
                    const lastTwo = Array.from(geminiMessages).slice(-2);
                    conversation = lastTwo.map((msg, idx) => {
                        let text = msg.textContent.trim();
                        
                        text = text.replace(/^\s*[\d\w\-]+\s*/, '');
                        text = text.replace(/\s+/g, ' ');
                        
                        const isLikelyUser = text.length < 100 || 
                                           text.includes('?') ||
                                           idx === 0 ||
                                           msg.classList.contains('user') ||
                                           msg.closest('[class*="user"]');
                                           
                        const role = isLikelyUser ? 'User' : 'AI';
                        
                        return `${role}: ${text}`;
                    }).join('\n\n');
                }
                break;
                
            default:
                const allTextBlocks = document.querySelectorAll('p, div[class*="message"], div[class*="chat"], div[role="presentation"], [role="article"]');
                if (allTextBlocks.length > 0) {
                    const recent = Array.from(allTextBlocks)
                        .filter(block => {
                            const text = block.textContent.trim();
                            return text.length > 20 && text.length < 3000 && 
                                   !block.querySelector('input, button');
                        })
                        .slice(-4);
                    conversation = recent.map(block => block.textContent.trim()).join('\n\n');
                }
        }
    } catch (error) {
        console.error('Error extracting conversation:', error);
    }
    
    return conversation || 'Unable to extract conversation from this page.';
}

// Enhanced credit checking with container-based warnings
async function checkCreditsWithWarnings(mode) {
    try {
        const requiredCredits = getFeatureCredits(mode);
        
        if (requiredCredits === 0) {
            return { success: true, requiredCredits: 0 };
        }
        
        const isLoggedIn = await BackendAuth.isLoggedIn();
        if (!isLoggedIn) {
            return { success: false, message: "Please login to use this feature" };
        }
        
        if (pageCredits === null) {
            pageCredits = await BackendAuth.getUserCredits();
        }
        
        // ❌ INSUFFICIENT CREDITS - Block action
        if (pageCredits < requiredCredits) {
            return { 
                success: false, 
                message: `Insufficient credits. This feature requires ${requiredCredits} credits, but you have ${pageCredits}.`,
                showUpgrade: true
            };
        }
        
        // ⚠️ LOW CREDIT WARNING - Allow action but warn user
        const creditsAfterAction = pageCredits - requiredCredits;
        
        if (creditsAfterAction <= 5) {
            return {
                success: true,
                requiredCredits: requiredCredits,
                availableCredits: pageCredits,
                showWarning: true,
                warningMessage: creditsAfterAction === 0 ? 
                    `This will use your final credit! You'll have 0 credits left after this action.` :
                    `Low credits warning: You'll have ${creditsAfterAction} credits left after this action.`
            };
        }
        
        // ✅ SUFFICIENT CREDITS - Proceed normally
        return { 
            success: true, 
            requiredCredits: requiredCredits,
            availableCredits: pageCredits
        };
        
    } catch (error) {
        console.error('Credit check error:', error);
        return { success: true }; // Fallback allows usage
    }
}

// Keep the simple wrapper for backward compatibility
async function checkCredits(mode) {
    return await checkCreditsWithWarnings(mode);
}

// Show low credit warning in container
function showLowCreditWarning(warningMessage, creditsAfter) {
    // Force show container (same logic as login)
    const wasHidden = button.style.display === 'none';
    if (wasHidden) {
        button.style.display = 'block';
    }
    
    const buttonRect = button.getBoundingClientRect();
    solthronContainer.style.display = 'block';
    solthronContainer.style.pointerEvents = 'auto';
    positionContainer(buttonRect);
    
    if (wasHidden) {
        button.style.display = 'none';
    }
    
    // Show warning view in container
    closeAllSections();
    const outputContainer = shadowRoot.querySelector('.output-container');
    outputContainer.style.display = 'block';
    
    // Create warning content
    outputText.classList.remove('placeholder', 'shimmer-loading');
    outputText.classList.add('credit-warning');
    
    const isLastCredit = creditsAfter === 0;
    const warningColor = isLastCredit ? '#ff6b6b' : '#ffa500';
    const warningIcon = isLastCredit ? '🔥' : '⚠️';
    
    outputText.innerHTML = `
        <div style="
            background: rgba(255, 165, 0, 0.1);
            border: 1px solid ${warningColor};
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 12px;
            text-align: center;
        ">
            <div style="
                font-size: 18px;
                margin-bottom: 8px;
            ">${warningIcon}</div>
            <div style="
                color: ${warningColor};
                font-weight: 500;
                font-size: 14px;
                margin-bottom: 8px;
            ">${isLastCredit ? 'Final Credit Warning!' : 'Low Credits Warning'}</div>
            <div style="
                color: rgba(255, 255, 255, 0.9);
                font-size: 13px;
                line-height: 1.4;
            ">${warningMessage}</div>
        </div>
        
        <div style="
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 12px;
        ">
            <button id="proceed-action" style="
                background: rgba(0, 255, 0, 0.1);
                border: 1px solid rgba(0, 255, 0, 0.3);
                color: #00ff00;
                padding: 8px 12px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s ease;
            ">Continue with Action</button>
            
            <button id="get-credits" style="
                background: rgba(255, 215, 0, 0.1);
                border: 1px solid rgba(255, 215, 0, 0.3);
                color: #ffd700;
                padding: 8px 12px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 13px;
                transition: all 0.2s ease;
            ">Get More Credits</button>
            
            <button id="cancel-action" style="
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: rgba(255, 255, 255, 0.8);
                padding: 6px 12px;
                border-radius: 5px;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.2s ease;
            ">Cancel</button>
        </div>
    `;
    
    // Add event listeners for buttons
    shadowRoot.getElementById('proceed-action').addEventListener('click', () => {
        // Close container and proceed with original action
        solthronContainer.style.display = 'none';
        solthronContainer.style.pointerEvents = 'none';
        // Return true to indicate user wants to proceed
        window.solthronProceedWithLowCredits = true;
    });
    
    shadowRoot.getElementById('get-credits').addEventListener('click', () => {
        // Open credits purchase page
        window.open('https://solthron.com/credits', '_blank');
    });
    
    shadowRoot.getElementById('cancel-action').addEventListener('click', () => {
        // Close container and cancel action
        solthronContainer.style.display = 'none';
        solthronContainer.style.pointerEvents = 'none';
        window.solthronProceedWithLowCredits = false;
    });
}

// Display functions
function displaySmartFollowups(data) {
    hideShimmerLoading();
    outputText.classList.remove('placeholder', 'error');
    
    const platform = detectAIPlatform();
    const platformName = platform.charAt(0).toUpperCase() + platform.slice(1);
    
    let html = '<div class="smart-followups-container">';
    
    if (platform !== 'unknown') {
        html += `
            <div class="platform-indicator">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 6v6l4 2"></path>
                </svg>
                <span>Analyzing ${platformName} conversation</span>
            </div>
        `;
    }
    
    if (data.analysis) {
        html += `<div class="analysis-insight">${data.analysis}</div>`;
    }
    
    data.questions.forEach((question, index) => {
        html += `
            <div class="followup-card">
                <div class="followup-question">${question.text}</div>
                <button class="followup-copy-btn" data-question="${question.text.replace(/"/g, '&quot;')}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                    </svg>
                </button>
            </div>
        `;
    });
    
    html += '</div>';
    outputText.innerHTML = html;
    
    shadowRoot.querySelectorAll('.followup-copy-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const question = btn.dataset.question;
            try {
                await navigator.clipboard.writeText(question);
                btn.classList.add('copied');
                
                btn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                `;
                
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                        </svg>
                    `;
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}


function showError(message) {
    hideShimmerLoading();
    outputText.classList.add('error');
    outputText.textContent = message;
}

function updateOutput(text) {
    hideShimmerLoading();
    outputText.classList.remove('placeholder');
    outputText.textContent = text;
}

function isImage(element) {
    return element.tagName === 'IMG' && element.src;
}

async function processSelectedText(text) {
    if (!text.trim()) return;
    
    const buttonRect = button.getBoundingClientRect();
    solthronContainer.style.display = 'block';
    solthronContainer.style.pointerEvents = 'auto';
    positionContainer(buttonRect);
    
    // Note: save_prompt removed - use Alt+S keyboard shortcut instead

    // ✅ Show loading animation only for processing features
    showShimmerLoading('Processing...');

    if (selectedMode.startsWith('image_')) return;

    const creditCheck = await checkCredits(selectedMode);
    if (!creditCheck.success) {
        showError(creditCheck.message || "Please check your account status.");
        return;
    }

    handleTextProcessing(text);
}

async function handleTextProcessing(text) {
    // ✅ FIXED: Ensure proper view state when processing
    const galleryView = shadowRoot.getElementById('gallery-view');
    const outputContainer = shadowRoot.querySelector('.output-container');
    
    if (galleryView.style.display === 'block') {
        closeAllSections(); // This will show output container
    }

    showShimmerLoading('Processing...');

    try {
        const response = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'enhance_text',
                data: {
                    topic: text,
                    tone: 'professional',
                    length: 'balanced',
                    mode: selectedMode
                }
            }, response => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });

        if (response && response.success) {
            let formattedOutput = response.data.prompt;
            updateOutput(formattedOutput);
            solthronContainer.style.display = 'block';
        } else {
            showError('Failed to process text');
        }
    } catch (error) {
        showError('Error processing text');
    } finally {
        button.querySelector('.solthron-button').textContent = '➤';
    }
}

// ✨ CREATE SHADOW DOM AND UI
function createUI() {
    // Create shadow host
    const shadowHost = document.createElement('div');
    shadowHost.id = 'solthron-shadow-host';
    shadowHost.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 0 !important;
        height: 0 !important;
        z-index: 2147483647 !important;
        pointer-events: none !important;
    `;
    
    document.body.appendChild(shadowHost);
    
    // Create shadow root
    shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    // ✅ ADD THIS CODE HERE:
    // Allow context menu events to propagate within shadow DOM
    shadowRoot.addEventListener('contextmenu', (e) => {
        // Allow context menu inside gallery items
        if (e.target.closest('.gallery-item')) {
            // Let the event reach the item's contextmenu handler
            return true;
        }
    }, true);// Use capture phase
    
    // CSS styles (completely isolated in shadow DOM)
    const styles = `
        <style>
        /* ✅ ISOLATED CSS - Won't affect the host page */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: Arial, sans-serif !important;
            line-height: normal;
            letter-spacing: normal;
            text-transform: none;
            text-shadow: none !important;
        }

        #solthron-floating-button {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10000;
            pointer-events: auto;
        }

        .solthron-button {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            background: #ffff00;
            border: none;
            cursor: pointer;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2), 0 0 20px rgba(255, 255, 0, 0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 26px;
            font-weight: 900;
            color: #000000;
            line-height: 1;
            padding: 0;
            transform: translateY(-1px);
        }

        .solthron-button:hover {
            box-shadow: 0 2px 5px rgba(0,0,0,0.2), 0 0 25px rgba(255, 255, 0, 0.4);
        }

        .solthron-container {
            position: fixed;
            width: 320px;
            background: #1a1a1a;
            border-radius: 10px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 10000;
            pointer-events: auto;
            display: none;
        }

        .solthron-content {
            padding: 12px;
            position: relative;
        }

        .solthron-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .mode-dropdown {
            position: relative;
            flex: 1;
            margin-right: 12px;
        }

        .mode-select {
            width: 100%;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            color: rgba(255, 255, 255, 0.9);
            font-size: 13px !important;
            padding: 6px 8px;
            cursor: pointer;
            -webkit-appearance: none;
            padding-right: 24px;
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
            background-repeat: no-repeat;
            background-position: right 8px center;
            background-size: 12px;
            max-height: 100px;
            overflow-y: auto;
        }

        .mode-select::-webkit-scrollbar {
            width: 6px;
        }

        .mode-select::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
        }

        .mode-select::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
        }

        .mode-select::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        .mode-select:hover {
            background-color: rgba(255, 255, 255, 0.15);
            border-color: rgba(255, 255, 255, 0.3);
        }

        .mode-select:focus {
            outline: none;
            border-color: rgba(255, 255, 0, 0.5);
            box-shadow: 0 0 0 2px rgba(255, 255, 0, 0.2);
        }

        .mode-select option {
            background-color: #2a2a2a !important;
            color: rgba(255, 255, 255, 0.9);
            padding: 8px;
            font-size: 13px !important;
        }

        .mode-select optgroup {
            background: #2a2a2a;
            color: rgba(255, 255, 255, 0.6);
            font-size: 12px !important;
            font-weight: 500;
            padding: 8px 4px;
        }

        .mode-select optgroup option {
            background: #2a2a2a;
            color: rgba(255, 255, 255, 0.9);
            font-size: 13px !important;
            padding: 8px 12px;
            margin-left: 8px;
        }

        .header-icons {
            display: flex;
            gap: 4px;
        }

        .icon-button {
            background: none;
            border: none;
            padding: 4px;
            cursor: pointer;
            color: #fff;
            opacity: 0.7;
            transition: opacity 0.2s;
        }

        .icon-button:hover {
            opacity: 1;
        }

        .output-container {
            position: relative;
        }

        .output-text {
            background: #2a2a2a;
            color: #fff !important;
            padding: 12px;
            border-radius: 6px;
            min-height: 60px;
            max-height: 150px;
            line-height: 1.4 !important;
            font-size: 13px !important;
            overflow-y: auto;
            white-space: pre-wrap;
        }

        .output-text.placeholder {
            color: rgba(255, 255, 255, 0.4) !important;
            font-style: italic;
            display: flex;
            align-items: center;
            justify-content: center;
            text-align: center;
        }

        .output-text.error {
            color: #ff6b6b;
            border: 1px solid rgba(255, 107, 107, 0.3);
        }
        
        .output-text.credit-warning {
    background: #2a2a2a;
    color: #fff;
    border: none;
}

.output-text.credit-warning button:hover {
    transform: translateY(-1px);
}

.output-text.credit-warning #proceed-action:hover {
    background: rgba(0, 255, 0, 0.2) !important;
    border-color: rgba(0, 255, 0, 0.5) !important;
}

.output-text.credit-warning #get-credits:hover {
    background: rgba(255, 215, 0, 0.2) !important;
    border-color: rgba(255, 215, 0, 0.5) !important;
}

.output-text.credit-warning #cancel-action:hover {
    background: rgba(255, 255, 255, 0.1) !important;
    border-color: rgba(255, 255, 255, 0.3) !important;
}

        .output-text::-webkit-scrollbar {
            width: 6px;
        }

        .output-text::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
        }

        .output-text::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
        }

        .output-text::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        /* Loading Bar Effect */
        .output-text.shimmer-loading {
            background: #2a2a2a !important;
            color: rgba(255, 255, 255, 0.8) !important;
            position: relative;
            padding-bottom: 20px !important;
        }

        .output-text.shimmer-loading::after {
            content: '';
            position: absolute;
            bottom: 8px;
            left: 12px;
            right: 12px;
            height: 3px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 2px;
            overflow: hidden;
        }

        .output-text.shimmer-loading::before {
            content: '';
            position: absolute;
            bottom: 8px;
            left: 12px;
            height: 3px;
            width: 30%;
            background: linear-gradient(
                90deg,
                transparent 0%,
                #ffff00 30%,
                #fff700 70%,
                transparent 100%
            );
            border-radius: 2px;
            animation: loading-sweep 1.5s infinite linear;
            z-index: 1;
            will-change: transform;
        }

        @keyframes loading-sweep {
            0% {
                transform: translateX(-100%);
            }
            100% {
                transform: translateX(300%);
            }
        }

        /* Double-Click Animation */
        .solthron-button.double-click-activated {
            animation: 
                solthronBounce 0.6s ease-out,
                solthronGlow 0.6s ease-out;
        }

        @keyframes solthronBounce {
            0% { transform: scale(1) translateY(-1px); }
            15% { transform: scale(0.85) translateY(-1px); }
            35% { transform: scale(1.25) translateY(-1px); }
            55% { transform: scale(0.95) translateY(-1px); }
            75% { transform: scale(1.05) translateY(-1px); }
            100% { transform: scale(1) translateY(-1px); }
        }

        @keyframes solthronGlow {
            0% { 
                box-shadow: 
                    0 2px 5px rgba(0,0,0,0.2), 
                    0 0 20px rgba(255, 255, 0, 0.3),
                    0 0 0 0 rgba(255, 255, 0, 0.3);
            }
            40% {
                box-shadow: 
                    0 2px 5px rgba(0,0,0,0.2), 
                    0 0 25px rgba(255, 255, 0, 0.4),
                    0 0 0 8px rgba(255, 255, 0, 0.2);
            }
            70% { 
                box-shadow: 
                    0 2px 5px rgba(0,0,0,0.2), 
                    0 0 30px rgba(255, 255, 0, 0.5),
                    0 0 0 15px rgba(255, 255, 0, 0);
            }
            100% { 
                box-shadow: 
                    0 2px 5px rgba(0,0,0,0.2), 
                    0 0 20px rgba(255, 255, 0, 0.3),
                    0 0 0 0 rgba(255, 255, 0, 0);
            }
        }


        /* Gallery Styles */
        .gallery-view {
            background: #2a2a2a;
            border-radius: 6px;
            margin-top: 12px;
        }

        .gallery-header {
            padding: 12px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .gallery-header h3 {
            color: rgba(255, 255, 255, 0.9);
            font-size: 14px !important;
            font-weight: 500;
            margin-bottom: 8px;
        }

        .gallery-search input {
            width: 100%;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            padding: 6px 8px;
            color: white;
            font-size: 12px !important;
        }

        .gallery-search input:focus {
            outline: none;
            border-color: rgba(255, 255, 0, 0.5);
            box-shadow: 0 0 0 2px rgba(255, 255, 0, 0.2);
        }

        .gallery-list {
            max-height: 153px;
            overflow-y: auto;
            padding: 8px;
        }

        .gallery-item {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 4px;
            padding: 6px 8px;
            margin-bottom: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            height: 45px;
            overflow: hidden;
        }

        .gallery-item:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
        }

        .gallery-item-text {
            color: rgba(255, 255, 255, 0.8);
            font-size: 11px !important;
            line-height: 1.2;
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .gallery-item-actions {
            display: flex;
            gap: 4px;
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        .gallery-item:hover .gallery-item-actions {
            opacity: 1;
        }

        .gallery-copy-btn,
        .gallery-delete-btn,
        .gallery-star-btn {
            background: none;
            border: none;
            padding: 4px;
            cursor: pointer;
            color: rgba(255, 255, 255, 0.6);
            transition: all 0.2s ease;
        }

        .gallery-star-btn:hover {
            color: rgba(255, 255, 255, 0.9);
        }

        .gallery-star-btn.active {
            color: #ffff00;
        }

        .gallery-star-btn.active svg {
            filter: drop-shadow(0 0 2px rgba(255, 255, 0, 0.5));
        }
           
        .gallery-star-btn.active svg {
            filter: drop-shadow(0 0 2px rgba(255, 255, 0, 0.5));
        }

        .gallery-rename-btn {
            background: none;
            border: none;
            padding: 4px;
            cursor: pointer;
            color: rgba(255, 255, 255, 0.6);
            transition: all 0.2s ease;
        }

        .gallery-rename-btn:hover {
            color: rgba(255, 215, 0, 0.9);
        }

        .gallery-copy-btn,
        .gallery-delete-btn,

        .gallery-copy-btn:hover,
        .gallery-delete-btn:hover {
            color: rgba(255, 255, 255, 0.9);
        }

        .gallery-delete-btn:hover {
            color: #ff6b6b;
        }

        .gallery-copy-btn.copied {
            color: #00ff00;
        }

        .gallery-list::-webkit-scrollbar {
            width: 6px;
        }

        .gallery-list::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
        }

        .gallery-list::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.2);
            border-radius: 3px;
        }

        .gallery-list::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.3);
        }

        /* Category Selection */
        .category-selection {
            padding: 16px;
            margin-bottom: 8px;
        }

        .category-item {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 10px;
            margin-bottom: 12px;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .category-item:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
            transform: translateY(-1px);
        }

        .category-title {
            color: rgba(255, 255, 255, 0.9);
            font-size: 14px !important;
            font-weight: 500;
            text-align: center;
        }

        .category-description {
            color: rgba(255, 255, 255, 0.5);
            font-size: 11px;
            text-align: center;
            margin-top: 4px;
        }

        .gallery-title-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
            gap: 8px;
        }

        .back-to-categories {
            background: none;
            border: none;
            padding: 4px;
            cursor: pointer;
            color: rgba(255, 255, 255, 0.7);
            transition: color 0.2s ease;
        }

        .back-to-categories:hover {
            color: rgba(255, 255, 255, 0.9);
        }

        #gallery-content {
            transition: opacity 0.2s ease;
        }

        #gallery-content.hiding {
            opacity: 0;
        }

        #gallery-content.showing {
            opacity: 1;
        }

        #gallery-btn svg {
            transition: stroke 0.2s ease;
        }

        #gallery-btn.active svg {
            stroke: #00ff00;
        }

        /* Profile Styles */
        .profile-view {
            background: #2a2a2a;
            border-radius: 6px;
            margin-top: 12px;
            max-height: 350px;
            overflow-y: auto;
        }

        .profile-header {
            padding: 12px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .profile-header h3 {
            color: rgba(255, 255, 255, 0.9);
            font-size: 14px;
            font-weight: 500;
            margin: 0;
        }

        .close-profile {
            background: none;
            border: none;
            color: rgba(255, 255, 255, 0.7);
            cursor: pointer;
            padding: 4px;
        }

        .profile-details {
            padding: 16px;
        }

        .loading-profile {
            color: rgba(255, 255, 255, 0.6);
            text-align: center;
            padding: 20px 0;
            font-style: italic;
        }

        .profile-info {
            display: flex;
            flex-direction: column;
            gap: 12px;
        }

        .profile-field {
            display: flex;
            flex-direction: column;
            padding-bottom: 12px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .field-label {
            color: rgba(255, 255, 255, 0.6);
            font-size: 12px;
            margin-bottom: 4px;
        }

        .field-value {
            color: rgba(255, 255, 255, 0.9);
            font-size: 14px;
        }

        .profile-field.credits {
            margin-top: 8px;
        }

        .credits .field-value {
            color: #ffff00;
            font-weight: 500;
            font-size: 16px;
        }

        .field-value-with-button {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }

        .buy-credits-btn {
    background: #2a2a2a;
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: white;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
    box-shadow: 
        0 2px 4px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
    position: relative;
}

.buy-credits-btn:hover {
    background: #333333;
    border-color: rgba(255, 255, 255, 0.3);
    box-shadow: 
        0 3px 6px rgba(0, 0, 0, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.15);
    transform: translateY(-1px);
}

.buy-credits-btn:active {
    transform: translateY(0px);
    box-shadow: 
        0 1px 2px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

        .login-prompt {
            text-align: center;
            padding: 20px 0;
        }

        .login-button, .logout-button {
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            color: rgba(255, 255, 255, 0.9);
            padding: 8px 16px;
            margin-top: 10px;
            cursor: pointer;
            transition: all 0.2s ease;
            width: 100%;
        }

        .login-button:hover, .logout-button:hover {
            background: rgba(255, 255, 255, 0.15);
        }
         
        /* Google Auth Buttons */
        .google-auth-button {
            background: #ffffff;
            color: #424242;
            border: 1px solid #dadce0;
            border-radius: 8px;
            padding: 12px 16px;
            width: 100%;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            font-family: inherit;
        }

        .google-auth-button:hover {
            background: #f8f9fa;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
            transform: translateY(-1px);
        }

        .google-auth-button:active {
            transform: translateY(0);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        /* Fallback Login Button */
        .fallback-login-button {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            color: rgba(255, 255, 255, 0.9);
            padding: 10px 16px;
            width: 100%;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s ease;
            font-family: inherit;
        }

        .fallback-login-button:hover {
            background: rgba(255, 255, 255, 0.12);
            border-color: rgba(255, 255, 255, 0.3);
        }

        .logout-button {
            margin-top: 20px;
        }

        .login-form {
            padding: 10px;
        }

        .form-group {
            margin-bottom: 12px;
        }

        .form-group label {
            display: block;
            color: rgba(255, 255, 255, 0.8);
            font-size: 12px;
            margin-bottom: 4px;
        }

        .form-group input {
            width: 100%;
            padding: 8px;
            border-radius: 4px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: rgba(255, 255, 255, 0.1);
            color: white;
            font-size: 13px;
        }

        .form-group input:focus {
            outline: none;
            border-color: rgba(255, 255, 0, 0.5);
            box-shadow: 0 0 0 2px rgba(255, 255, 0, 0.2);
        }

        .form-actions {
            margin-top: 15px;
        }

        .login-button {
            background: #3c78d8;
            border: none;
            color: white;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 13px;
            transition: background 0.2s ease;
            width: 100%;
        }

        .login-button:hover {
            background: #4285f4;
        }

        .error-message {
            color: #ff6b6b;
            font-size: 12px;
            margin-top: 8px;
            min-height: 16px;
        }

        .signup-link {
            margin-top: 15px;
            text-align: center;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
            padding-top: 12px;
        }

        .signup-link p {
            color: rgba(255, 255, 255, 0.6);
            font-size: 12px;
            margin-bottom: 5px;
        }

        .signup-link a {
            color: #3c78d8;
            text-decoration: none;
            font-size: 12px;
            font-weight: 500;
        }

        .signup-link a:hover {
            text-decoration: underline;
        }

        .workflow-container::-webkit-scrollbar {
    width: 6px;
}

.workflow-container::-webkit-scrollbar-track {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
}

.workflow-container::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
}

.workflow-container::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.3);
}

/* Workflow Step Bubbles */
.workflow-step-bubble {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 10px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    transition: all 0.2s ease;
    cursor: pointer;
}

.workflow-step-bubble:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(255, 215, 0, 0.25);
}

.workflow-step-bubble .step-content {
    flex: 1;
    color: rgba(255, 255, 255, 0.9);
    font-size: 12px;
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
}

/* Workflow Execution Styles */
.workflow-execution-header {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 12px;
    margin-bottom: 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.workflow-header-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.workflow-controls {
    display: flex;
    gap: 8px;
    align-items: center;
}

.workflow-close-btn {
    background: rgba(255, 107, 107, 0.1);
    border: 1px solid rgba(255, 107, 107, 0.3);
    color: rgba(255, 107, 107, 0.9);
    padding: 4px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 22px;
    width: 22px;
    flex-shrink: 0;
}

.workflow-close-btn:hover {
    background: rgba(255, 107, 107, 0.2);
    border-color: rgba(255, 107, 107, 0.5);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.2);
}

.run-all-btn {
    background: linear-gradient(135deg, rgba(0, 200, 0, 0.15), rgba(0, 255, 0, 0.1));
    border: 1px solid rgba(0, 255, 0, 0.3);
    color: rgba(0, 255, 0, 0.95);
    padding: 6px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 10px;
    font-weight: 500;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    height: 22px;
    line-height: 1;
}

.run-all-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, rgba(0, 200, 0, 0.2), rgba(0, 255, 0, 0.15));
    border-color: rgba(0, 255, 0, 0.4);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 255, 0, 0.2);
}

.run-all-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.pause-btn,
.stop-btn {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.8);
    padding: 6px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 10px;
    font-weight: 500;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    height: 22px;
    line-height: 1;
}

.pause-btn:hover {
    background: rgba(255, 200, 0, 0.15);
    border-color: rgba(255, 200, 0, 0.3);
    color: rgba(255, 200, 0, 0.95);
}

.stop-btn:hover {
    background: rgba(255, 100, 100, 0.15);
    border-color: rgba(255, 100, 100, 0.3);
    color: rgba(255, 100, 100, 0.95);
}

.workflow-progress {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.progress-text {
    color: rgba(255, 255, 255, 0.8);
    font-size: 11px;
    font-weight: 500;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.progress-bar-container {
    width: 100%;
    height: 6px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 3px;
    overflow: hidden;
}

.progress-bar {
    height: 100%;
    background: linear-gradient(90deg, rgba(0, 255, 0, 0.6), rgba(0, 200, 0, 0.8));
    border-radius: 3px;
    transition: width 0.3s ease;
    box-shadow: 0 0 10px rgba(0, 255, 0, 0.4);
}

/* Step Status Indicators */
.workflow-step-bubble.step-pending {
    opacity: 0.6;
}

.workflow-step-bubble.step-running {
    background: rgba(255, 215, 0, 0.08);
    border-color: rgba(255, 215, 0, 0.4);
    box-shadow: 0 0 12px rgba(255, 215, 0, 0.2);
    animation: pulse 2s ease-in-out infinite;
}

.workflow-step-bubble.step-paused {
    background: rgba(255, 165, 0, 0.1);
    border-color: rgba(255, 165, 0, 0.5);
    box-shadow: 0 0 8px rgba(255, 165, 0, 0.3);
}

.workflow-step-bubble.step-completed {
    background: rgba(0, 255, 0, 0.05);
    border-color: rgba(0, 255, 0, 0.3);
}

.workflow-step-bubble.step-error {
    background: rgba(255, 100, 100, 0.08);
    border-color: rgba(255, 100, 100, 0.4);
}

.workflow-step-bubble.step-skipped {
    opacity: 0.4;
    background: rgba(128, 128, 128, 0.05);
    border-color: rgba(128, 128, 128, 0.2);
}

.step-status-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
}

.step-status-icon svg {
    width: 100%;
    height: 100%;
}

@keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.7; }
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.workflow-step-bubble .step-time {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.5);
    margin-left: auto;
    flex-shrink: 0;
}

        /* Smart Followups & Actions */
        .smart-followups-container,
        .smart-actions-container {
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding: 4px;
        }

        .followup-card,
        .action-card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 12px;
            position: relative;
            transition: all 0.2s ease;
            min-height: 50px;
            display: flex;
            align-items: center;
        }

        .followup-card:hover,
        .action-card:hover {
            background: rgba(255, 255, 255, 0.08);
            border-color: rgba(255, 255, 0, 0.3);
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .followup-question,
        .action-prompt {
            color: rgba(255, 255, 255, 0.9);
            font-size: 13px !important;
            line-height: 1.4;
            padding-right: 36px;
            flex: 1;
        }

        .followup-copy-btn,
        .action-copy-btn {
            position: absolute;
            top: 50%;
            right: 12px;
            transform: translateY(-50%);
            background: none;
            border: none;
            padding: 4px;
            cursor: pointer;
            color: rgba(255, 255, 255, 0.5);
            transition: all 0.2s ease;
        }

        .followup-copy-btn:hover,
        .action-copy-btn:hover {
            color: rgba(255, 255, 255, 0.8);
        }

        .followup-copy-btn.copied,
        .action-copy-btn.copied {
            color: #00ff00;
        }

        .followup-copy-btn.copied svg,
        .action-copy-btn.copied svg {
            filter: drop-shadow(0 0 3px rgba(0, 255, 0, 0.5));
        }

        .analysis-insight {
            background: rgba(255, 255, 0, 0.1);
            border: 1px solid rgba(255, 255, 0, 0.2);
            border-radius: 6px;
            padding: 10px;
            margin-bottom: 8px;
            color: rgba(255, 255, 255, 0.8);
            font-size: 12px !important;
            font-style: italic;
            line-height: 1.4;
        }

        .platform-indicator {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-bottom: 8px;
            padding: 6px 10px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
            font-size: 11px !important;
            color: rgba(255, 255, 255, 0.6);
        }

        .platform-indicator svg {
            width: 14px;
            height: 14px;
        }

        /* Smart Enhancements */

        /* Animation */
        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        
        .spinning {
            animation: spin 1s linear infinite;
        }

        @keyframes slideIn {
            from {
                opacity: 0;
                transform: translateY(20px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes bounce {
    0%, 80%, 100% {
        transform: translateY(0) scale(1);
        opacity: 1;
    }
    40% {
        transform: translateY(-6px) scale(1.2);
        opacity: 0.7;
    }
}

        @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
}

        /* Responsive */
        @media screen and (max-width: 480px) {
            .solthron-container {
                width: 90vw;
                max-width: 320px;
            }
        }
        </style>
    `;
    
    // HTML content
    const htmlContent = `
        <div id="solthron-floating-button">
            <button class="solthron-button">➤</button>
        </div>
        
        <div id="solthron-container" class="solthron-container" style="display: none;">
            <div class="solthron-content"> 
                <div class="solthron-header">
                    <div class="mode-dropdown">
                        <select class="mode-select">
                            <option value="select_mode">Select Mode</option>
                            <optgroup label="Image">
                                <option value="image_prompt">Image to Prompt</option>
                            </optgroup>
                            <optgroup label="AI Assistant">
                                <option value="smart_followups">Smart Follow-ups</option>
                            </optgroup>
                        </select>
                    </div>
                    <div class="header-icons">
                        <button id="profile-btn" class="icon-button">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                                <circle cx="12" cy="7" r="4"></circle>
                            </svg>
                        </button>
                        <button id="gallery-btn" class="icon-button">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="7" height="7"></rect>
                                <rect x="14" y="3" width="7" height="7"></rect>
                                <rect x="14" y="14" width="7" height="7"></rect>
                                <rect x="3" y="14" width="7" height="7"></rect>
                            </svg>
                        </button>
                        <button id="copy-btn" class="icon-button">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                            </svg>
                        </button>
                        <button id="close-btn" class="icon-button">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="output-container">
                    <div id="output-text" class="output-text placeholder">
                        Please highlight text or right-click an image to begin...
                    </div>
                </div>
                <div id="gallery-view" class="gallery-view" style="display: none;">
                <div id="category-selection" class="category-selection">
                       <div class="category-item" data-category="prompts">
                       <div class="category-title">Prompts</div>
                </div>
                <div class="category-item" data-category="chats">
                <div class="category-title">Saved Chats</div>
                </div>
                <div class="category-item" data-category="workflows">
                       <div class="category-title">Workflows</div>
                    </div>
                </div>
                    <!-- Workflow Subcategory Selection -->
                    <div id="workflow-subcategory-selection" class="category-selection" style="display: none;">
                        <div class="gallery-header">
                            <div class="gallery-title-row">
                                <h3 id="workflow-subcategory-title">Workflows</h3>
                                <button class="back-to-categories">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M19 12H5"/>
                                        <path d="M12 19l-7-7 7-7"/>
                                    </svg>
                                </button>
                            </div>
                        </div>
                        <div class="category-item" data-workflow-type="templates">
                            <div class="category-title">Templates</div>
                            <div class="category-description">Pre-built workflow templates</div>
                        </div>
                        <div class="category-item" data-workflow-type="custom">
                            <div class="category-title">Custom</div>
                            <div class="category-description">Your custom workflows</div>
                        </div>
                    </div>
                    <div id="gallery-content" style="display: none;">
                        <div class="gallery-header">
                            <div class="gallery-title-row">
                                <h3 id="gallery-title">Saved Items</h3>
                                <button class="back-to-categories" id="back-from-gallery">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M19 12H5"/>
                                        <path d="M12 19l-7-7 7-7"/>
                                    </svg>
                                </button>
                            </div>
                            <div class="gallery-search">
                                <input type="text" placeholder="Search..." id="gallery-search">
                            </div>
                        </div>
                        <div class="gallery-list" id="gallery-list"></div>
                    </div>
                </div>
                <div id="profile-view" class="profile-view" style="display: none;">
                    <div class="profile-header">
                        <h3>Account</h3>
                        <button class="close-profile">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                    <div id="login-container" class="login-form">
    <!-- Login View -->
    <div id="login-view" class="auth-prompt">
        <p style="color: rgba(255, 255, 255, 0.8); text-align: center; margin-bottom: 20px; font-size: 14px;">Login to access premium features and credit management</p>
        
        <button id="google-login-btn" class="google-auth-button" style="margin-bottom: 16px;">
            <svg width="18" height="18" viewBox="0 0 24 24" style="margin-right: 10px;">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Login with Google
        </button>
        
        <!-- Divider -->
        <div style="display: flex; align-items: center; margin: 16px 0; opacity: 0.6;">
            <div style="flex: 1; height: 1px; background: rgba(255, 255, 255, 0.2);"></div>
            <span style="padding: 0 12px; color: rgba(255, 255, 255, 0.5); font-size: 12px;">or</span>
            <div style="flex: 1; height: 1px; background: rgba(255, 255, 255, 0.2);"></div>
        </div>
        
        <button id="login-button" class="fallback-login-button">Login via Solthron.com</button>
        
        <div style="text-align: center; margin-top: 12px;">
            <span style="color: rgba(255, 255, 255, 0.6); font-size: 13px;">Don't have an account? </span>
            <a href="#" id="show-signup" style="color: #4285F4; text-decoration: none; font-size: 13px;">Sign up</a>
        </div>
    </div>
    
    <!-- Signup View -->
    <div id="signup-view" class="auth-prompt" style="display: none;">
        <p style="color: rgba(255, 255, 255, 0.8); text-align: center; margin-bottom: 20px; font-size: 14px;">Create your account to get started</p>
        
        <button id="google-signup-btn" class="google-auth-button" style="margin-bottom: 16px;">
            <svg width="18" height="18" viewBox="0 0 24 24" style="margin-right: 10px;">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign up with Google
        </button>
        
        <!-- Divider -->
        <div style="display: flex; align-items: center; margin: 16px 0; opacity: 0.6;">
            <div style="flex: 1; height: 1px; background: rgba(255, 255, 255, 0.2);"></div>
            <span style="padding: 0 12px; color: rgba(255, 255, 255, 0.5); font-size: 12px;">or</span>
            <div style="flex: 1; height: 1px; background: rgba(255, 255, 255, 0.2);"></div>
        </div>
        
        <button id="signup-button" class="fallback-login-button">Sign up via Solthron.com</button>
        
        <div style="text-align: center; margin-top: 12px;">
            <span style="color: rgba(255, 255, 255, 0.6); font-size: 13px;">Already have an account? </span>
            <a href="#" id="show-login" style="color: #4285F4; text-decoration: none; font-size: 13px;">Login</a>
        </div>
    </div>
    
    <div id="login-error" class="error-message"></div>
</div>
                    <div id="profile-details" class="profile-details" style="display: none;">
                        <!-- Will show user details when logged in -->
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Inject styles and HTML into shadow root
    shadowRoot.innerHTML = styles + htmlContent;
    
    // Get references to elements within shadow DOM
    button = shadowRoot.querySelector('#solthron-floating-button');
    outputText = shadowRoot.querySelector('#output-text');
    solthronContainer = shadowRoot.querySelector('#solthron-container');
    
    // Initialize UI handlers and gallery
    initializeUIHandlers();
    initializeAddWorkflowFeature();
    initializeGallery();
    initializeAddPromptFeature(); // ✅ ADD THIS LINE

    // Hide button initially
    button.style.display = 'none';
}

function initializeGallery() {
    const galleryBtn = shadowRoot.getElementById('gallery-btn');
    const galleryView = shadowRoot.getElementById('gallery-view');
    const categorySelection = shadowRoot.getElementById('category-selection');
    const galleryContent = shadowRoot.getElementById('gallery-content');
    const searchInput = shadowRoot.getElementById('gallery-search');
    const outputContainer = shadowRoot.querySelector('.output-container');
 
    galleryBtn.addEventListener('click', () => {
        const isVisible = galleryView.style.display !== 'none';
        
        if (isVisible) {
            // Close gallery and show output
            closeAllSections();
        } else {
            // Close all other sections and show gallery
            closeAllSections();
            galleryView.style.display = 'block';
            outputContainer.style.display = 'none';
            galleryBtn.querySelector('svg').style.stroke = '#00ff00';
            
            // Reset to category selection
            categorySelection.style.display = 'block';
            galleryContent.style.display = 'none';
            currentCategory = null;
        }
    });
 
    // Track workflow subcategory
    let workflowSubcategory = null;

    shadowRoot.querySelectorAll('.category-item').forEach(item => {
    item.addEventListener('click', async () => {
        const category = item.dataset.category;

        // Handle workflow category differently - show subcategory selection
        if (category === 'workflows') {
            categorySelection.style.display = 'none';
            const workflowSubcategorySelection = shadowRoot.getElementById('workflow-subcategory-selection');
            workflowSubcategorySelection.style.display = 'block';
            return;
        }

        // Handle other categories (prompts, chats)
        currentCategory = category;
        categorySelection.style.display = 'none';
        galleryContent.style.display = 'block';

        const galleryTitle = shadowRoot.getElementById('gallery-title');
        galleryTitle.textContent = currentCategory === 'prompts' ? 'Saved Prompts' :
                                 currentCategory === 'chats' ? 'Saved Chats' :
                                 'Workflows';

        const items = await (
            currentCategory === 'prompts' ? loadPrompts() :
            currentCategory === 'chats' ? loadSavedChats() :
            loadWorkflows()
        );
        renderGalleryList(items, '');

        // ✅ ADD THIS: Initialize add button for prompts
        if (currentCategory === 'prompts') {
            updateGalleryHeaderWithAddButton();
        }
    });
});

    // Handle workflow subcategory selection (Templates or Custom)
    shadowRoot.querySelectorAll('[data-workflow-type]').forEach(item => {
        item.addEventListener('click', async () => {
            workflowSubcategory = item.dataset.workflowType;
            currentCategory = 'workflows';

            const workflowSubcategorySelection = shadowRoot.getElementById('workflow-subcategory-selection');
            workflowSubcategorySelection.style.display = 'none';
            galleryContent.style.display = 'block';

            const galleryTitle = shadowRoot.getElementById('gallery-title');
            galleryTitle.textContent = workflowSubcategory === 'templates' ? 'Workflow Templates' : 'Custom Workflows';

            // Load workflows and filter based on subcategory
            const allWorkflows = await loadWorkflows();
            const filteredWorkflows = workflowSubcategory === 'templates'
                ? allWorkflows.filter(w => w.source === 'built_in')
                : allWorkflows.filter(w => w.source !== 'built_in');

            renderGalleryList(filteredWorkflows, '');

            // ✅ Only show add button for Custom workflows
            if (workflowSubcategory === 'custom') {
                updateGalleryHeaderWithAddWorkflowButton();
            }
        });
    });
 
    // Back button from gallery content
    shadowRoot.querySelector('#back-from-gallery').addEventListener('click', () => {
        // Check if we're in workflow mode - go back to workflow subcategory
        if (currentCategory === 'workflows') {
            galleryContent.style.display = 'none';
            const workflowSubcategorySelection = shadowRoot.getElementById('workflow-subcategory-selection');
            workflowSubcategorySelection.style.display = 'block';
            workflowSubcategory = null;
        } else {
            // For other categories, go back to main category selection
            categorySelection.style.display = 'block';
            galleryContent.style.display = 'none';
            currentCategory = null;
        }

        // ✅ Remove add buttons when going back
        const addPromptBtn = shadowRoot.getElementById('add-prompt-btn');
        const addWorkflowBtn = shadowRoot.getElementById('add-workflow-btn');
        if (addPromptBtn) {
            addPromptBtn.remove();
        }
        if (addWorkflowBtn) {
            addWorkflowBtn.remove();
        }

        // Hide add form if visible
        const addPromptForm = shadowRoot.getElementById('add-prompt-form');
        const addWorkflowForm = shadowRoot.getElementById('add-workflow-form');
        if (addPromptForm) {
            addPromptForm.style.display = 'none';
        }
        if (addWorkflowForm) {
            addWorkflowForm.style.display = 'none';
        }

        const galleryList = shadowRoot.getElementById('gallery-list');
        if (galleryList) {
            galleryList.style.display = 'block';
        }
    });

    // Back button from workflow subcategory to main categories
    shadowRoot.querySelectorAll('.back-to-categories').forEach(btn => {
        btn.addEventListener('click', () => {
            categorySelection.style.display = 'block';
            galleryContent.style.display = 'none';
            const workflowSubcategorySelection = shadowRoot.getElementById('workflow-subcategory-selection');
            workflowSubcategorySelection.style.display = 'none';
            currentCategory = null;
            workflowSubcategory = null;

            // ✅ Remove add buttons when going back
            const addPromptBtn = shadowRoot.getElementById('add-prompt-btn');
            const addWorkflowBtn = shadowRoot.getElementById('add-workflow-btn');
            if (addPromptBtn) {
                addPromptBtn.remove();
            }
            if (addWorkflowBtn) {
                addWorkflowBtn.remove();
            }

            // Hide add form if visible
            const addPromptForm = shadowRoot.getElementById('add-prompt-form');
            const addWorkflowForm = shadowRoot.getElementById('add-workflow-form');
            if (addPromptForm) {
                addPromptForm.style.display = 'none';
            }
            if (addWorkflowForm) {
                addWorkflowForm.style.display = 'none';
            }

            const galleryList = shadowRoot.getElementById('gallery-list');
            if (galleryList) {
                galleryList.style.display = 'block';
            }
        });
    });
 
    searchInput.addEventListener('input', async (e) => {
        if (!currentCategory) return;
        const items = await (
            currentCategory === 'prompts' ? loadPrompts() :
            currentCategory === 'notes' ? loadNotes() :
            loadPersonaTemplates()
        );
        renderGalleryList(items, e.target.value);
    });
}

// ========== ADD PROMPT FEATURE ==========
function initializeAddPromptFeature() {
    const galleryHeader = shadowRoot.querySelector('.gallery-header');
    
    // Create add prompt form (hidden by default)
    const addPromptForm = document.createElement('div');
    addPromptForm.id = 'add-prompt-form';
    addPromptForm.style.cssText = `
        display: none;
        padding: 12px;
        background: #2a2a2a;
        border-radius: 6px;
        margin-bottom: 8px;
    `;
    
    addPromptForm.innerHTML = `
        <div style="margin-bottom: 10px;">
            <label style="
                display: block;
                color: rgba(255, 255, 255, 0.7);
                font-size: 11px;
                margin-bottom: 4px;
            ">Title</label>
            <input 
                type="text" 
                id="prompt-title-input"
                placeholder="Enter prompt title..."
                style="
                    width: 100%;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 4px;
                    padding: 6px 8px;
                    color: white;
                    font-size: 12px;
                    outline: none;
                "
            />
        </div>
        
        <div style="margin-bottom: 10px;">
            <label style="
                display: block;
                color: rgba(255, 255, 255, 0.7);
                font-size: 11px;
                margin-bottom: 4px;
            ">Prompt</label>
            <textarea 
    id="prompt-text-input"
    placeholder="Enter your prompt text..."
    style="
        width: 100%;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        padding: 6px 8px;
        color: white;
        font-size: 12px;
        outline: none;
        height: 120px;
        resize: none;
        font-family: inherit;
        line-height: 1.4;
        overflow-y: auto;
    "
></textarea>
        </div>
        
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button id="cancel-add-prompt" style="
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: rgba(255, 255, 255, 0.8);
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 4px;
            ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                Cancel
            </button>
            
            <button id="save-new-prompt" style="
                background: rgba(0, 255, 0, 0.2);
                border: 1px solid rgba(0, 255, 0, 0.4);
                color: #00ff00;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                font-weight: 600;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 4px;
            ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Save
            </button>
        </div>
    `;
    
    // Insert form after gallery header
    const galleryContent = shadowRoot.getElementById('gallery-content');
    const galleryList = shadowRoot.getElementById('gallery-list');
    galleryList.parentNode.insertBefore(addPromptForm, galleryList);
    
    // Add hover effects for buttons
    const cancelBtn = addPromptForm.querySelector('#cancel-add-prompt');
    const saveBtn = addPromptForm.querySelector('#save-new-prompt');
    
    cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.background = 'rgba(255, 255, 255, 0.15)';
    });
    cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    
    saveBtn.addEventListener('mouseenter', () => {
        saveBtn.style.background = 'rgba(0, 255, 0, 0.3)';
    });
    saveBtn.addEventListener('mouseleave', () => {
        saveBtn.style.background = 'rgba(0, 255, 0, 0.2)';
    });
    
    // Add focus styles for inputs
    const titleInput = addPromptForm.querySelector('#prompt-title-input');
    const textInput = addPromptForm.querySelector('#prompt-text-input');
    
    [titleInput, textInput].forEach(input => {
        input.addEventListener('focus', () => {
            input.style.borderColor = 'rgba(255, 255, 0, 0.5)';
            input.style.boxShadow = '0 0 0 2px rgba(255, 255, 0, 0.2)';
        });
        input.addEventListener('blur', () => {
            input.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            input.style.boxShadow = 'none';
        });
    });
    
    
    // Cancel button handler
    // Cancel button handler
cancelBtn.addEventListener('click', () => {
    const galleryHeader = shadowRoot.querySelector('.gallery-header');
    
    // Restore gallery header
    galleryHeader.style.display = 'block';
    
    // Reset form
    titleInput.value = '';
    textInput.value = '';
    addPromptForm.style.display = 'none';
    galleryList.style.display = 'block';
});
    
    // Save button handler
    // Save button handler
saveBtn.addEventListener('click', async () => {
    const title = titleInput.value.trim();
    const text = textInput.value.trim();
    
    // Validation
    if (!title) {
        titleInput.style.borderColor = '#ff6b6b';
        titleInput.focus();
        setTimeout(() => {
            titleInput.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        }, 2000);
        return;
    }
    
    if (!text) {
        textInput.style.borderColor = '#ff6b6b';
        textInput.focus();
        setTimeout(() => {
            textInput.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        }, 2000);
        return;
    }
    
    // Show loading state
    saveBtn.disabled = true;
    saveBtn.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
            <path d="M21 12a9 9 0 11-6.219-8.56"></path>
        </svg>
        Saving...
    `;
    
    // Create new prompt
    const newPrompt = {
        id: Date.now().toString(),
        title: title,
        text: text,
        timestamp: new Date().toISOString()
    };
    
    try {
        // Save to storage
        const data = await chrome.storage.local.get('savedPrompts');
        const savedPrompts = data.savedPrompts || [];
        savedPrompts.push(newPrompt);
        await chrome.storage.local.set({ savedPrompts });
        
        console.log('✅ New prompt saved:', title);
        
        // Show success feedback
        saveBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Saved!
        `;
        
        // Reset form and refresh list
        setTimeout(async () => {
            // Get references
            const galleryHeader = shadowRoot.querySelector('.gallery-header');
            const galleryList = shadowRoot.getElementById('gallery-list');
            const addPromptForm = shadowRoot.getElementById('add-prompt-form');
            
            // Restore gallery header
            if (galleryHeader) {
                galleryHeader.style.display = 'block';
            }
            
            // Reset inputs
            titleInput.value = '';
            textInput.value = '';
            
            // Hide form, show list
            addPromptForm.style.display = 'none';
            galleryList.style.display = 'block';
            
            // Refresh the prompt list
            const prompts = await loadPrompts();
            renderGalleryList(prompts, shadowRoot.getElementById('gallery-search').value);
            
            // Reset button
            saveBtn.disabled = false;
            saveBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Save
            `;
            
            // Show notification
            showNotification('✅ Prompt saved: ' + title);
        }, 800);
        
    } catch (error) {
        console.error('❌ Error saving prompt:', error);
        showNotification('❌ Failed to save prompt', 'error');
        
        // Reset button
        saveBtn.disabled = false;
        saveBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            Save
        `;
    }
});
}

// ========== ADD WORKFLOW FEATURE ==========
function initializeAddWorkflowFeature() {
    const galleryHeader = shadowRoot.querySelector('.gallery-header');
    
    // Create add workflow form (hidden by default)
    const addWorkflowForm = document.createElement('div');
    addWorkflowForm.id = 'add-workflow-form';
    addWorkflowForm.style.cssText = `
        display: none;
        padding: 12px;
        background: #2a2a2a;
        border-radius: 6px;
        margin-bottom: 8px;
    `;
    
    addWorkflowForm.innerHTML = `
        <div style="margin-bottom: 10px;">
            <label style="
                display: block;
                color: rgba(255, 255, 255, 0.7);
                font-size: 11px;
                margin-bottom: 4px;
            ">Workflow Title</label>
            <input 
                type="text" 
                id="workflow-title-input"
                placeholder="e.g., Email Response Workflow"
                style="
                    width: 100%;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 4px;
                    padding: 6px 8px;
                    color: white;
                    font-size: 12px;
                    outline: none;
                "
            />
        </div>
        
        <div style="margin-bottom: 10px;">
            <label style="
                display: block;
                color: rgba(255, 255, 255, 0.7);
                font-size: 11px;
                margin-bottom: 4px;
            ">Step 1</label>
            <textarea 
                id="workflow-step1-input"
                placeholder="Enter the first step of your workflow..."
                style="
                    width: 100%;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    border-radius: 4px;
                    padding: 6px 8px;
                    color: white;
                    font-size: 12px;
                    outline: none;
                    height: 80px;
                    resize: none;
                    font-family: inherit;
                    line-height: 1.4;
                    overflow-y: auto;
                "
            ></textarea>
        </div>
        
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button id="cancel-add-workflow" style="
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: rgba(255, 255, 255, 0.8);
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 4px;
            ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                Cancel
            </button>
            
            <button id="create-workflow-btn" style="
                background: rgba(0, 255, 0, 0.2);
                border: 1px solid rgba(0, 255, 0, 0.4);
                color: #00ff00;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                font-weight: 600;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                gap: 4px;
            ">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Create
            </button>
        </div>
    `;
    
    // Insert form after gallery header
    const galleryContent = shadowRoot.getElementById('gallery-content');
    const galleryList = shadowRoot.getElementById('gallery-list');
    galleryList.parentNode.insertBefore(addWorkflowForm, galleryList);
    
    // Add hover effects for buttons
    const cancelBtn = addWorkflowForm.querySelector('#cancel-add-workflow');
    const createBtn = addWorkflowForm.querySelector('#create-workflow-btn');
    
    cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.background = 'rgba(255, 255, 255, 0.15)';
    });
    cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
    });
    
    createBtn.addEventListener('mouseenter', () => {
        createBtn.style.background = 'rgba(0, 255, 0, 0.3)';
    });
    createBtn.addEventListener('mouseleave', () => {
        createBtn.style.background = 'rgba(0, 255, 0, 0.2)';
    });
    
    // Add focus styles for inputs
    const titleInput = addWorkflowForm.querySelector('#workflow-title-input');
    const step1Input = addWorkflowForm.querySelector('#workflow-step1-input');
    
    [titleInput, step1Input].forEach(input => {
        input.addEventListener('focus', () => {
            input.style.borderColor = 'rgba(255, 255, 0, 0.5)';
            input.style.boxShadow = '0 0 0 2px rgba(255, 255, 0, 0.2)';
        });
        input.addEventListener('blur', () => {
            input.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            input.style.boxShadow = 'none';
        });
    });
    
    // Cancel button handler
    cancelBtn.addEventListener('click', () => {
        const galleryHeader = shadowRoot.querySelector('.gallery-header');
        
        // Restore gallery header
        galleryHeader.style.display = 'block';
        
        // Reset form
        titleInput.value = '';
        step1Input.value = '';
        addWorkflowForm.style.display = 'none';
        galleryList.style.display = 'block';
    });
    
    // Create button handler
    createBtn.addEventListener('click', async () => {
        const title = titleInput.value.trim();
        const step1 = step1Input.value.trim();
        
        // Validation
        if (!title) {
            titleInput.style.borderColor = '#ff6b6b';
            titleInput.focus();
            setTimeout(() => {
                titleInput.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }, 2000);
            return;
        }
        
        if (!step1) {
            step1Input.style.borderColor = '#ff6b6b';
            step1Input.focus();
            setTimeout(() => {
                step1Input.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }, 2000);
            return;
        }
        
        // Show loading state
        createBtn.disabled = true;
        createBtn.innerHTML = `
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                <path d="M21 12a9 9 0 11-6.219-8.56"></path>
            </svg>
            Creating...
        `;
        
        // Create new workflow
        const newWorkflow = {
            id: `workflow-${Date.now()}`,
            name: title.replace(/\s+/g, ''),
            title: title,
            steps: [
                { number: 1, prompt: step1 }
            ],
            timestamp: new Date().toISOString(),
            source: 'user_created'
        };
        
        try {
            // Save to storage
            const data = await chrome.storage.local.get('workflows');
            const workflows = data.workflows || [];
            workflows.push(newWorkflow);
            await chrome.storage.local.set({ workflows });
            
            console.log('✅ New workflow created:', title);
            
            // Show success feedback
            createBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Created!
            `;
            
            // Reset form and refresh list
            setTimeout(async () => {
                // Get references
                const galleryHeader = shadowRoot.querySelector('.gallery-header');
                const galleryList = shadowRoot.getElementById('gallery-list');
                const addWorkflowForm = shadowRoot.getElementById('add-workflow-form');
                
                // Restore gallery header
                if (galleryHeader) {
                    galleryHeader.style.display = 'block';
                }
                
                // Reset inputs
                titleInput.value = '';
                step1Input.value = '';
                
                // Hide form, show list
                addWorkflowForm.style.display = 'none';
                galleryList.style.display = 'block';
                
                // Refresh the workflow list
                const workflows = await loadWorkflows();
                renderGalleryList(workflows, shadowRoot.getElementById('gallery-search').value);
                
                // Reset button
                createBtn.disabled = false;
                createBtn.innerHTML = `
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Create
                `;
                
                // Show notification
                showNotification('✅ Workflow created: ' + title);
            }, 800);
            
        } catch (error) {
            console.error('❌ Error creating workflow:', error);
            showNotification('❌ Failed to create workflow', 'error');
            
            // Reset button
            createBtn.disabled = false;
            createBtn.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Create
            `;
        }
    });
}


function updateGalleryHeaderWithAddButton() {
    // This function will be called when prompts category is selected
    const galleryTitle = shadowRoot.getElementById('gallery-title');
    const titleRow = galleryTitle.parentElement;
    
    // Check if we're in prompts view and add button doesn't exist
    if (currentCategory === 'prompts' && !shadowRoot.getElementById('add-prompt-btn')) {
        const addButton = document.createElement('button');
        addButton.id = 'add-prompt-btn';
        addButton.style.cssText = `
            background: none;
            border: none;
            padding: 4px;
            cursor: pointer;
            color: rgba(255, 215, 0, 0.8);
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: auto;
            margin-right: 16px;
        `;
        
        addButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
        `;
        
        addButton.addEventListener('mouseenter', () => {
            addButton.style.color = 'rgba(255, 215, 0, 1)';
            addButton.style.transform = 'scale(1.1)';
        });
        
        addButton.addEventListener('mouseleave', () => {
            addButton.style.color = 'rgba(255, 215, 0, 0.8)';
            addButton.style.transform = 'scale(1)';
        });
        
        addButton.addEventListener('click', () => {
            const addPromptForm = shadowRoot.getElementById('add-prompt-form');
            const galleryList = shadowRoot.getElementById('gallery-list');
            const galleryHeader = shadowRoot.querySelector('.gallery-header');
            
            if (addPromptForm) {
                // Hide the gallery header completely
                galleryHeader.style.display = 'none';
                
                // Show the form and hide list
                addPromptForm.style.display = 'block';
                galleryList.style.display = 'none';
                
                // Focus on title input
                setTimeout(() => {
                    shadowRoot.getElementById('prompt-title-input').focus();
                }, 100);
            }
        });
        
        // Create a wrapper for right-side buttons (+ icon and back button)
        const rightButtonsWrapper = document.createElement('div');
        rightButtonsWrapper.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
        `;
        
        // Get the back button
        const backButton = titleRow.querySelector('.back-to-categories');
        
        // Insert + button before back button in the wrapper
        rightButtonsWrapper.appendChild(addButton);
        rightButtonsWrapper.appendChild(backButton);
        
        // Replace the back button with the wrapper
        titleRow.appendChild(rightButtonsWrapper);
    }
}

function updateGalleryHeaderWithAddWorkflowButton() {
    const galleryTitle = shadowRoot.getElementById('gallery-title');
    const titleRow = galleryTitle.parentElement;
    
    // Check if we're in workflows view and add button doesn't exist
    if (currentCategory === 'workflows' && !shadowRoot.getElementById('add-workflow-btn')) {
        const addButton = document.createElement('button');
        addButton.id = 'add-workflow-btn';
        addButton.style.cssText = `
            background: none;
            border: none;
            padding: 4px;
            cursor: pointer;
            color: rgba(255, 215, 0, 0.8);
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-left: auto;
            margin-right: 16px;
        `;
        
        addButton.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="16"></line>
                <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
        `;
        
        addButton.addEventListener('mouseenter', () => {
            addButton.style.color = 'rgba(255, 215, 0, 1)';
            addButton.style.transform = 'scale(1.1)';
        });
        
        addButton.addEventListener('mouseleave', () => {
            addButton.style.color = 'rgba(255, 215, 0, 0.8)';
            addButton.style.transform = 'scale(1)';
        });
        
        addButton.addEventListener('click', () => {
            const addWorkflowForm = shadowRoot.getElementById('add-workflow-form');
            const galleryList = shadowRoot.getElementById('gallery-list');
            const galleryHeader = shadowRoot.querySelector('.gallery-header');
            
            if (addWorkflowForm) {
                // Hide the gallery header completely
                galleryHeader.style.display = 'none';
                
                // Show the form and hide list
                addWorkflowForm.style.display = 'block';
                galleryList.style.display = 'none';
                
                // Focus on title input
                setTimeout(() => {
                    shadowRoot.getElementById('workflow-title-input').focus();
                }, 100);
            }
        });
        
        // Create a wrapper for right-side buttons (+ icon and back button)
        const rightButtonsWrapper = document.createElement('div');
        rightButtonsWrapper.style.cssText = `
            display: flex;
            align-items: center;
            gap: 12px;
        `;
        
        // Get the back button
        const backButton = titleRow.querySelector('.back-to-categories');
        
        // Insert + button before back button in the wrapper
        rightButtonsWrapper.appendChild(addButton);
        rightButtonsWrapper.appendChild(backButton);
        
        // Replace the back button with the wrapper
        titleRow.appendChild(rightButtonsWrapper);
    }
}

function renderGalleryList(items, searchTerm = '') {
    const galleryList = shadowRoot.getElementById('gallery-list');
    const filteredItems = searchTerm ? 
        items.filter(item => {
            if (currentCategory === 'chats') {
                return item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.answer.toLowerCase().includes(searchTerm.toLowerCase());
            }
            if (currentCategory === 'workflows') {
                return item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.steps.some(step => step.prompt.toLowerCase().includes(searchTerm.toLowerCase()));
            }
            // Search in both title and text for prompts
            return item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                   item.text.toLowerCase().includes(searchTerm.toLowerCase());
        }) : items;
 
    galleryList.innerHTML = filteredItems.map(item => {
        if (currentCategory === 'workflows') {
            return `
                <div class="gallery-item" data-id="${item.id}">
                    <div class="gallery-item-text">${item.title} (${item.steps.length} steps)</div>
                    <div class="gallery-item-actions">
                        <button class="gallery-copy-btn" data-id="${item.id}" data-type="workflow">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                            </svg>
                        </button>
                        ${item.source !== 'built_in' ? `
                            <button class="gallery-delete-btn" data-id="${item.id}">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 6h18"></path>
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        }
        
        if (currentCategory === 'chats') {
            return `
                <div class="gallery-item" data-id="${item.id}">
                    <div class="gallery-item-text" data-id="${item.id}">${item.title || 'Untitled Chat'}</div>
                    <div class="gallery-item-actions">
                        <button class="gallery-star-btn ${activeChatId === item.id ? 'active' : ''}" data-id="${item.id}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="${activeChatId === item.id ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                        </button>
                        <button class="gallery-rename-btn" data-id="${item.id}" title="Rename">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="gallery-copy-btn" data-id="${item.id}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                            </svg>
                        </button>
                        <button class="gallery-delete-btn" data-id="${item.id}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 6h18"></path>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }
 
        // For prompts only
        return `
            <div class="gallery-item" data-id="${item.id}">
                <div class="gallery-item-text" data-id="${item.id}">${item.title || 'Untitled'}</div>
                <div class="gallery-item-actions">
                    ${currentCategory === 'prompts' ? `
                        <button class="gallery-star-btn ${activePromptId === item.id ? 'active' : ''}" data-id="${item.id}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="${activePromptId === item.id ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                        </button>
                    ` : ''}
                    <button class="gallery-rename-btn" data-id="${item.id}" title="Rename">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="gallery-copy-btn" data-id="${item.id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                            <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                        </svg>
                    </button>
                    <button class="gallery-delete-btn" data-id="${item.id}">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18"></path>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');

    attachGalleryEventListeners(galleryList);
}

// Replace the entire attachGalleryEventListeners function with this corrected version:

function attachGalleryEventListeners(galleryList) {
    galleryList.querySelectorAll('.gallery-item').forEach(item => {
        // Left-click to view full content
        item.addEventListener('click', async (e) => {
            if (!e.target.closest('button') && !e.target.closest('input')) {
                const itemId = item.dataset.id;
                const items = await (
                    currentCategory === 'prompts' ? loadPrompts() :
                    currentCategory === 'chats' ? loadSavedChats() :
                    loadWorkflows()
                );
                const selectedItem = items.find(i => i.id === itemId);
                if (selectedItem) {
                    hideShimmerLoading();
                    outputText.classList.remove('placeholder', 'shimmer-loading', 'error');
                    outputText.innerHTML = ''; // Clear any previous content

                    if (currentCategory === 'workflows') {
                        // ✅ CRITICAL: Close gallery and show in output container
                        closeAllSections(); // This hides gallery and shows output
                        displayWorkflowSteps(selectedItem);
                    } else if (currentCategory === 'chats') {
                        // Apply scrolling styles for long content
                        outputText.style.overflowY = 'auto';
                        outputText.style.maxHeight = '400px';
                        outputText.style.padding = '12px';
                        outputText.style.whiteSpace = 'pre-wrap';
                        outputText.style.wordBreak = 'break-word';

                        // Check if it's new Q&A format or old format
                        const isQAFormat = selectedItem.question.includes('Q: ') && selectedItem.question.includes('A: ');

                        if (isQAFormat) {
                            // New format: display as-is
                            outputText.textContent = `${selectedItem.question}\n\n---\n\nPlatform: ${selectedItem.ai}\nDate: ${new Date(selectedItem.date).toLocaleString()}\n\n${selectedItem.hasCode ? '📝 Contains code' : ''}${selectedItem.chatLink ? '\n🔗 ' + selectedItem.chatLink : ''}`;
                        } else {
                            // Old format: display with labels
                            outputText.textContent = `Question: ${selectedItem.question}\n\nAnswer: ${selectedItem.answer}\n\nPlatform: ${selectedItem.ai}\nDate: ${new Date(selectedItem.date).toLocaleString()}\n\n${selectedItem.hasCode ? '📝 Contains code' : ''}${selectedItem.chatLink ? '\n🔗 ' + selectedItem.chatLink : ''}`;
                        }
                    } else {
                        // For prompts - also apply scrolling for long content
                        outputText.style.overflowY = 'auto';
                        outputText.style.maxHeight = '400px';
                        outputText.style.padding = '12px';
                        outputText.style.whiteSpace = 'pre-wrap';
                        outputText.style.wordBreak = 'break-word';

                        outputText.textContent = selectedItem.text;
                    }
                    
                    closeAllSections();
                }
            }
        });
    });

    // ✅ ENHANCED: Rename button with Save icon
    galleryList.querySelectorAll('.gallery-rename-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            const itemId = btn.dataset.id;
            const item = btn.closest('.gallery-item');
            const textElement = item.querySelector('.gallery-item-text');
            
            // Load current item
            const items = await (
                currentCategory === 'prompts' ? loadPrompts() :
                currentCategory === 'chats' ? loadSavedChats() :
                loadWorkflows()
            );
            const currentItem = items.find(i => i.id === itemId);
            if (!currentItem) return;
            
            const currentTitle = currentItem.title || 'Untitled';
            
            // Create input field
            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentTitle;
            input.style.cssText = `
                width: calc(100% - 30px);
                background: rgba(255, 255, 255, 0.15);
                border: 1px solid rgba(255, 215, 0, 0.5);
                border-radius: 3px;
                padding: 4px 6px;
                color: white;
                font-size: 11px;
                font-family: inherit;
                outline: none;
                box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.2);
            `;

            // ✅ NEW: Prevent Claude (and other platforms) from stealing keyboard input
            // BUT allow keyboard shortcuts (Alt, Ctrl, Cmd) to pass through
            input.addEventListener('keydown', (e) => {
                // Allow keyboard shortcuts to pass through
                if (!e.altKey && !e.ctrlKey && !e.metaKey) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            }, true);

            input.addEventListener('keypress', (e) => {
                if (!e.altKey && !e.ctrlKey && !e.metaKey) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            }, true);

            input.addEventListener('keyup', (e) => {
                if (!e.altKey && !e.ctrlKey && !e.metaKey) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            }, true);

            input.addEventListener('input', (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
            }, true);

            input.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
            }, true);

            input.addEventListener('click', (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
            }, true);
            
            // ✅ NEW: Create Save button
            const saveBtn = document.createElement('button');
            saveBtn.innerHTML = '✓';
            saveBtn.style.cssText = `
                background: rgba(0, 255, 0, 0.2);
                border: 1px solid rgba(0, 255, 0, 0.4);
                color: #00ff00;
                width: 24px;
                height: 24px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-left: 4px;
                transition: all 0.2s ease;
            `;
            
            saveBtn.addEventListener('mouseenter', () => {
                saveBtn.style.background = 'rgba(0, 255, 0, 0.3)';
                saveBtn.style.transform = 'scale(1.1)';
            });
            
            saveBtn.addEventListener('mouseleave', () => {
                saveBtn.style.background = 'rgba(0, 255, 0, 0.2)';
                saveBtn.style.transform = 'scale(1)';
            });
            
            // Store original for restoration
            const originalDisplayText = textElement.textContent;
            
            // ✅ NEW: Create wrapper for input + save button
            const inputWrapper = document.createElement('div');
            inputWrapper.style.cssText = `
                display: flex;
                align-items: center;
                width: 100%;
                gap: 4px;
            `;
            
            inputWrapper.appendChild(input);
            inputWrapper.appendChild(saveBtn);
            
            // Replace text with input wrapper
            textElement.style.overflow = 'visible';
            textElement.innerHTML = '';
            textElement.appendChild(inputWrapper);
            
            // Focus input
            setTimeout(() => {
                input.focus();
                input.select();
            }, 50);
            
            // Save function
            const saveRename = async () => {
                const newTitle = input.value.trim();
                
                if (newTitle && newTitle !== currentTitle) {
                    let success = false;
                    
                    if (currentCategory === 'chats') {
                        success = await renameSavedChat(itemId, newTitle);
                    } else if (currentCategory === 'prompts') {
                        success = await renamePrompt(itemId, newTitle);
                    }
                    
                    if (success) {
                        // Reload gallery
                        const updatedItems = await (
                            currentCategory === 'prompts' ? loadPrompts() : 
                            currentCategory === 'chats' ? loadSavedChats() :
                            loadWorkflows()
                        );
                        renderGalleryList(updatedItems, shadowRoot.getElementById('gallery-search').value);
                        
                        // Visual feedback
                        setTimeout(() => {
                            const updatedItem = shadowRoot.querySelector(`[data-id="${itemId}"]`);
                            if (updatedItem) {
                                const updatedTextElement = updatedItem.querySelector('.gallery-item-text');
                                if (updatedTextElement) {
                                    updatedTextElement.style.background = 'rgba(0, 255, 0, 0.2)';
                                    setTimeout(() => {
                                        updatedTextElement.style.background = '';
                                    }, 1000);
                                }
                            }
                        }, 100);
                    } else {
                        textElement.style.overflow = 'hidden';
                        textElement.textContent = originalDisplayText;
                    }
                } else {
                    textElement.style.overflow = 'hidden';
                    textElement.textContent = originalDisplayText;
                }
            };
            
            // Cancel function
            const cancelRename = () => {
                textElement.style.overflow = 'hidden';
                textElement.textContent = originalDisplayText;
            };
            
            // ✅ NEW: Save button click handler
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                saveRename();
            });
            
            // Event listeners for input - ENHANCED for Claude compatibility
            input.addEventListener('keydown', (e) => {
                // Allow keyboard shortcuts (Alt, Ctrl, Cmd) to pass through
                if (!e.altKey && !e.ctrlKey && !e.metaKey) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }

                if (e.key === 'Enter') {
                    e.preventDefault();
                    saveRename();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelRename();
                }
            }, true);

            input.addEventListener('keypress', (e) => {
                if (!e.altKey && !e.ctrlKey && !e.metaKey) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            }, true);

            input.addEventListener('keyup', (e) => {
                if (!e.altKey && !e.ctrlKey && !e.metaKey) {
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            }, true);

            input.addEventListener('input', (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
            }, true);

            input.addEventListener('blur', () => {
                setTimeout(() => {
                    if (textElement.contains(inputWrapper)) {
                        saveRename();
                    }
                }, 200);
            });

            input.addEventListener('click', (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
            }, true);

            input.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                e.stopImmediatePropagation();
            }, true);
        });
    });

    // Copy button functionality
    galleryList.querySelectorAll('.gallery-copy-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            const items = await (
                currentCategory === 'prompts' ? loadPrompts() :
                currentCategory === 'chats' ? loadSavedChats() :
                loadWorkflows()
            );
            const selectedItem = items.find(i => i.id === itemId);
            if (selectedItem) {
                let textToCopy;

                if (currentCategory === 'workflows') {
                    textToCopy = selectedItem.steps.map(step => `Step ${step.number}: ${step.prompt}`).join('\n\n');
                } else if (currentCategory === 'chats') {
                    textToCopy = `Q: ${selectedItem.question}\n\nA: ${selectedItem.answer}`;
                } else {
                    textToCopy = selectedItem.text;
                }
                    
                await navigator.clipboard.writeText(textToCopy);
                btn.classList.add('copied');
                setTimeout(() => btn.classList.remove('copied'), 1000);
            }
        });
    });

    // Star button functionality (prompts and chats only)
    if (currentCategory === 'prompts' || currentCategory === 'chats') {
        galleryList.querySelectorAll('.gallery-star-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const itemId = btn.dataset.id;
                
                if (currentCategory === 'prompts') {
                    // Prompts star logic
                    if (activePromptId === itemId) {
                        activePromptId = null;
                        isPromptStarActive = false;
                        btn.querySelector('svg').setAttribute('fill', 'none');
                        btn.classList.remove('active');
                    } else {
                        const prevStar = galleryList.querySelector('.gallery-star-btn.active');
                        if (prevStar) {
                            prevStar.querySelector('svg').setAttribute('fill', 'none');
                            prevStar.classList.remove('active');
                        }
                        
                        activePromptId = itemId;
                        isPromptStarActive = true;
                        btn.querySelector('svg').setAttribute('fill', 'currentColor');
                        btn.classList.add('active');
                    }
                } else if (currentCategory === 'chats') {
                    // Chats star logic
                    if (activeChatId === itemId) {
                        activeChatId = null;
                        isChatStarActive = false;
                        btn.querySelector('svg').setAttribute('fill', 'none');
                        btn.classList.remove('active');
                    } else {
                        const prevStar = galleryList.querySelector('.gallery-star-btn.active');
                        if (prevStar) {
                            prevStar.querySelector('svg').setAttribute('fill', 'none');
                            prevStar.classList.remove('active');
                        }
                        
                        activeChatId = itemId;
                        isChatStarActive = true;
                        btn.querySelector('svg').setAttribute('fill', 'currentColor');
                        btn.classList.add('active');
                    }
                }
            });
        });
    }

    // Delete button functionality
    galleryList.querySelectorAll('.gallery-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const itemId = btn.dataset.id;
            
            let deleteFunction;
            let reloadFunction;
            
            if (currentCategory === 'prompts') {
                deleteFunction = deletePrompt;
                reloadFunction = loadPrompts;
            } else if (currentCategory === 'chats') {
                deleteFunction = deleteSavedChat;
                reloadFunction = loadSavedChats;
            } else if (currentCategory === 'workflows') {
                deleteFunction = deleteWorkflow;
                reloadFunction = loadWorkflows;    
            }
            
            if (await deleteFunction(itemId)) {
                const items = await reloadFunction();
                renderGalleryList(items, shadowRoot.getElementById('gallery-search').value);
            }
        });
    });
}

// ============================================================================
// WORKFLOW EXECUTOR - Sequential Execution with Context Passing
// ============================================================================

class WorkflowExecutor {
    constructor(workflow, workflowContainer) {
        this.workflow = workflow;
        this.workflowContainer = workflowContainer;
        this.currentStepIndex = 0;
        this.isRunning = false;
        this.isPaused = false;
        this.context = {
            results: [],
            accumulatedOutput: ''
        };
        this.startTime = null;
        this.stepStartTime = null;
    }

    async executeAll() {
        if (this.isRunning) return;

        this.isRunning = true;
        this.isPaused = false;
        this.startTime = Date.now();

        // Reset all steps to pending state for clean start
        this.resetAllSteps();

        // Set workflow execution state
        isWorkflowExecuting = true;

        // Add input field listeners for user interaction during workflow
        this.addWorkflowInputListeners();

        try {
            // Update UI to show running state
            this.updateRunButton('running');

            for (let i = this.currentStepIndex; i < this.workflow.steps.length; i++) {
                // Check if paused or stopped
                if (!this.isRunning) {
                    this.currentStepIndex = i;
                    break;
                }

                if (this.isPaused) {
                    this.currentStepIndex = i;

                    // Mark current step as paused
                    this.updateStepStatus(i, 'paused');

                    // Wait while paused
                    while (this.isPaused && this.isRunning) {
                        await this.sleep(100);
                    }

                    // Check if stopped during pause
                    if (!this.isRunning) {
                        break;
                    }

                    // Note: No need to mark as 'running' here since executeStep will do it
                }

                // Execute step
                await this.executeStep(i);
            }

            // Workflow completed
            if (this.isRunning) {
                this.complete();
            }
        } catch (error) {
            console.error('Workflow execution error:', error);
            this.handleError(error);
        }
    }

    async executeStep(stepIndex) {
        const step = this.workflow.steps[stepIndex];
        this.stepStartTime = Date.now();

        // Update progress
        this.updateProgress(stepIndex + 1, this.workflow.steps.length, step.prompt);

        // Update step UI to running state
        this.updateStepStatus(stepIndex, 'running');

        try {
            // Build prompt with context
            const fullPrompt = this.buildPromptWithContext(step, stepIndex);

            // Send to AI platform
            const result = await this.sendPromptToAI(fullPrompt, stepIndex);

            // Store result
            const stepTime = ((Date.now() - this.stepStartTime) / 1000).toFixed(1);
            this.context.results.push({
                step: stepIndex + 1,
                prompt: step.prompt,
                result: result,
                time: stepTime
            });

            // Update accumulated output
            this.context.accumulatedOutput = result;

            // Update step UI to completed
            this.updateStepStatus(stepIndex, 'completed', stepTime);

            // IMPORTANT: Wait for Claude's UI to fully settle before next step
            // This prevents the "input field not found" error on subsequent steps
            console.log('⏸ Waiting 2s for UI to settle before next step...');
            await this.sleep(2000);

            return result;
        } catch (error) {
            this.updateStepStatus(stepIndex, 'error');
            throw error;
        }
    }

    buildPromptWithContext(step, stepIndex) {
        // Just send the prompt as-is, without adding context from previous steps
        // This keeps each step clean and independent
        return step.prompt;
    }

    async sendPromptToAI(prompt, stepIndex) {
        // Detect AI platform and send message
        const platform = this.detectAIPlatform();

        console.log(`🌐 Detected platform: ${platform}`);

        if (platform === 'claude') {
            try {
                return await this.sendToClaude(prompt, stepIndex);
            } catch (error) {
                console.error('Error sending to Claude, falling back to simulation:', error);

                // Show notification about simulation mode
                if (stepIndex === 0) {
                    showNotification('⚠️ Running in simulation mode. For real execution, visit claude.ai', 'warning');
                }

                return await this.simulateResponse(prompt, stepIndex);
            }
        }

        if (platform === 'claude-code') {
            try {
                return await this.sendToClaudeCode(prompt, stepIndex);
            } catch (error) {
                console.error('Error sending to Claude Code, falling back to simulation:', error);

                // Show notification about simulation mode
                if (stepIndex === 0) {
                    showNotification('⚠️ Running in simulation mode. For real execution, visit claude.ai/code', 'warning');
                }

                return await this.simulateResponse(prompt, stepIndex);
            }
        }

        if (platform === 'chatgpt') {
            try {
                return await this.sendToChatGPT(prompt, stepIndex);
            } catch (error) {
                console.error('Error sending to ChatGPT, falling back to simulation:', error);

                // Show notification about simulation mode
                if (stepIndex === 0) {
                    showNotification('⚠️ Running in simulation mode. For real execution, visit chatgpt.com', 'warning');
                }

                return await this.simulateResponse(prompt, stepIndex);
            }
        }

        if (platform === 'deepseek') {
            try {
                return await this.sendToDeepSeek(prompt, stepIndex);
            } catch (error) {
                console.error('Error sending to DeepSeek, falling back to simulation:', error);

                // Show notification about simulation mode
                if (stepIndex === 0) {
                    showNotification('⚠️ Running in simulation mode. For real execution, visit chat.deepseek.com', 'warning');
                }

                return await this.simulateResponse(prompt, stepIndex);
            }
        }

        if (platform === 'gemini') {
            try {
                return await this.sendToGemini(prompt, stepIndex);
            } catch (error) {
                console.error('Error sending to Gemini, falling back to simulation:', error);

                // Show notification about simulation mode
                if (stepIndex === 0) {
                    showNotification('⚠️ Running in simulation mode. For real execution, visit gemini.google.com', 'warning');
                }

                return await this.simulateResponse(prompt, stepIndex);
            }
        }

        if (platform === 'lovable') {
            try {
                return await this.sendToLovable(prompt, stepIndex);
            } catch (error) {
                console.error('Error sending to Lovable, falling back to simulation:', error);

                // Show notification about simulation mode
                if (stepIndex === 0) {
                    showNotification('⚠️ Running in simulation mode. For real execution, visit lovable.dev', 'warning');
                }

                return await this.simulateResponse(prompt, stepIndex);
            }
        }

        // Fallback: simulate for testing
        if (stepIndex === 0) {
            const platformName = platform === 'unknown' ? 'this page' : platform;
            showNotification(`ℹ️ Running in simulation mode on ${platformName}. Visit claude.ai, claude.ai/code, chatgpt.com, chat.deepseek.com, gemini.google.com, or lovable.dev for real execution.`, 'info');
        }

        return await this.simulateResponse(prompt, stepIndex);
    }

    detectAIPlatform() {
        const hostname = window.location.hostname;
        const pathname = window.location.pathname;

        if (hostname.includes('claude.ai')) {
            // Check if we're on Claude Code (claude.ai/code)
            if (pathname.includes('/code')) {
                return 'claude-code';
            }
            return 'claude';
        }
        if (hostname.includes('chatgpt.com') || hostname.includes('openai.com')) return 'chatgpt';
        if (hostname.includes('gemini.google.com')) return 'gemini';
        if (hostname.includes('chat.deepseek.com')) return 'deepseek';
        if (hostname.includes('lovable.dev')) return 'lovable';

        return 'unknown';
    }

    async sendToClaude(prompt, stepIndex) {
        // Try multiple selectors to find Claude's input field (search in main document, not shadow DOM)
        const selectors = [
            'div[contenteditable="true"][data-value]',
            'div[contenteditable="true"][enterkeyhint="enter"]',
            'div.ProseMirror[contenteditable="true"]',
            'div[contenteditable="true"][role="textbox"]',
            'div[contenteditable="true"]'
        ];

        let inputField = null;

        for (const selector of selectors) {
            inputField = document.querySelector(selector);
            if (inputField && inputField.offsetParent !== null) { // Check if visible
                console.log(`✅ Found Claude input field with selector: ${selector}`);
                break;
            }
        }

        if (!inputField) {
            console.error('❌ Could not find Claude input field. Tried selectors:', selectors);
            throw new Error('Could not find Claude input field. Please make sure you are on claude.ai');
        }

        // Clear existing content and insert the prompt
        inputField.focus();
        await this.sleep(100);

        // Clear the field completely
        inputField.textContent = '';
        inputField.innerHTML = '';

        // Insert the prompt - use only ONE method to avoid duplication
        try {
            // Use textContent to set the text
            inputField.textContent = prompt;

            // Trigger input events so Claude recognizes the text
            inputField.dispatchEvent(new Event('input', { bubbles: true }));
            inputField.dispatchEvent(new Event('change', { bubbles: true }));

            console.log(`✅ Inserted prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
        } catch (e) {
            console.warn('Error setting text:', e);
            // Fallback method
            inputField.innerText = prompt;
        }

        // Small delay to ensure the text is processed
        await this.sleep(500);

        // ✅ MANUAL INTERVENTION: User needs to press Enter
        // Show notification to user
        console.log(`⏸ Step ${stepIndex + 1}: Prompt inserted. Waiting for user to press Enter...`);

        // Show visual notification
        showNotification(`📝 Step ${stepIndex + 1}: Please press Enter to submit the prompt`, 'info');

        // Wait for user to submit and for response
        const response = await this.waitForUserSubmitAndResponse();

        return response;
    }

    async sendToChatGPT(prompt, stepIndex) {
        // Try multiple selectors to find ChatGPT's input field
        const selectors = [
            '#prompt-textarea',
            'textarea[placeholder*="Message"]',
            'textarea[data-id="root"]',
            'textarea[placeholder*="ChatGPT"]',
            'div[contenteditable="true"]'
        ];

        let inputField = null;

        for (const selector of selectors) {
            inputField = document.querySelector(selector);
            if (inputField && inputField.offsetParent !== null) { // Check if visible
                console.log(`✅ Found ChatGPT input field with selector: ${selector}`);
                break;
            }
        }

        if (!inputField) {
            console.error('❌ Could not find ChatGPT input field. Tried selectors:', selectors);
            throw new Error('Could not find ChatGPT input field. Please make sure you are on chatgpt.com');
        }

        // Clear existing content and insert the prompt
        inputField.focus();
        await this.sleep(100);

        // Clear the field completely
        if (inputField.tagName.toLowerCase() === 'textarea') {
            inputField.value = '';
            inputField.value = prompt;
        } else {
            inputField.textContent = '';
            inputField.innerHTML = '';
            inputField.textContent = prompt;
        }

        // Trigger input events so ChatGPT recognizes the text
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        inputField.dispatchEvent(new Event('change', { bubbles: true }));

        console.log(`✅ Inserted prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);

        // Small delay to ensure the text is processed
        await this.sleep(500);

        // ✅ MANUAL INTERVENTION: User needs to press Enter
        console.log(`⏸ Step ${stepIndex + 1}: Prompt inserted. Waiting for user to press Enter...`);

        // Show visual notification
        showNotification(`📝 Step ${stepIndex + 1}: Please press Enter to submit the prompt`, 'info');

        // Wait for user to submit and for response
        const response = await this.waitForChatGPTUserSubmitAndResponse();

        return response;
    }

    async sendToDeepSeek(prompt, stepIndex) {
        // Try multiple selectors to find DeepSeek's input field
        const selectors = [
            'textarea[placeholder*="Message"]',
            'textarea.chat-input',
            'div[contenteditable="true"]',
            'textarea'
        ];

        let inputField = null;

        for (const selector of selectors) {
            inputField = document.querySelector(selector);
            if (inputField && inputField.offsetParent !== null) { // Check if visible
                console.log(`✅ Found DeepSeek input field with selector: ${selector}`);
                break;
            }
        }

        if (!inputField) {
            console.error('❌ Could not find DeepSeek input field. Tried selectors:', selectors);
            throw new Error('Could not find DeepSeek input field. Please make sure you are on chat.deepseek.com');
        }

        // Clear existing content and insert the prompt
        inputField.focus();
        await this.sleep(100);

        // Clear the field completely
        if (inputField.tagName.toLowerCase() === 'textarea') {
            inputField.value = '';
            inputField.value = prompt;
        } else {
            inputField.textContent = '';
            inputField.innerHTML = '';
            inputField.textContent = prompt;
        }

        // Trigger input events so DeepSeek recognizes the text
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        inputField.dispatchEvent(new Event('change', { bubbles: true }));

        console.log(`✅ Inserted prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);

        // Small delay to ensure the text is processed
        await this.sleep(500);

        let response;

        if (stepIndex === 0) {
            // ✅ STEP 1: MANUAL SUBMISSION (user presses Enter)
            console.log(`⏸ Step 1: Prompt inserted. Waiting for user to press Enter...`);
            showNotification(`📝 Step 1: Please press Enter to submit the prompt`, 'info');

            // Wait for user to manually submit and for response
            response = await this.waitForDeepSeekUserSubmitAndResponse();
        } else {
            // ✅ STEP 2+: AUTOMATIC SUBMISSION (fully automated)
            console.log(`🚀 Step ${stepIndex + 1}: Auto-submitting prompt...`);

            // Try to find and click the send button
            const sendButtonSelectors = [
                'button[type="submit"]',
                'button[aria-label*="Send"]',
                'button[aria-label*="Submit"]',
                'button:has(svg)', // Buttons with SVG icons (usually send buttons)
                'button[data-testid*="send"]',
                'button.send-button',
                'svg[data-icon="send"]' // Try SVG icon directly
            ];

            let sendButton = null;
            for (const selector of sendButtonSelectors) {
                const buttons = document.querySelectorAll(selector);
                for (const btn of buttons) {
                    if (btn.offsetParent !== null && !btn.disabled) {
                        sendButton = btn;
                        console.log(`✅ Found send button with selector: ${selector}`);
                        break;
                    }
                }
                if (sendButton) break;
            }

            if (sendButton) {
                // Click the send button
                sendButton.click();
                console.log('✅ Clicked send button');
            } else {
                // Fallback: Trigger Enter key
                console.log('⚠️ Send button not found, triggering Enter key...');
                const enterEvent = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                });
                inputField.dispatchEvent(enterEvent);
            }

            await this.sleep(500); // Wait for submission to process

            // Wait for response to complete (automatic detection)
            // Skip the "wait for user submission" part since we already submitted
            response = await this.waitForDeepSeekResponse();
        }

        return response;
    }

    async sendToGemini(prompt, stepIndex) {
        // Try multiple selectors to find Gemini's input field
        const selectors = [
            '.ql-editor[contenteditable="true"]',
            'div[contenteditable="true"][aria-label*="message"]',
            'div[contenteditable="true"]',
            'rich-textarea .ql-editor'
        ];

        let inputField = null;

        for (const selector of selectors) {
            inputField = document.querySelector(selector);
            if (inputField && inputField.offsetParent !== null) { // Check if visible
                console.log(`✅ Found Gemini input field with selector: ${selector}`);
                break;
            }
        }

        if (!inputField) {
            console.error('❌ Could not find Gemini input field. Tried selectors:', selectors);
            throw new Error('Could not find Gemini input field. Please make sure you are on gemini.google.com');
        }

        // Clear existing content and insert the prompt
        inputField.focus();
        await this.sleep(100);

        // Clear the field completely (Gemini uses contenteditable)
        inputField.textContent = '';
        inputField.innerHTML = '';
        inputField.textContent = prompt;

        // Trigger input events so Gemini recognizes the text
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        inputField.dispatchEvent(new Event('change', { bubbles: true }));

        console.log(`✅ Inserted prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);

        // Small delay to ensure the text is processed
        await this.sleep(500);

        let response;

        if (stepIndex === 0) {
            // ✅ STEP 1: MANUAL SUBMISSION (user presses Enter)
            console.log(`⏸ Step 1: Prompt inserted. Waiting for user to press Enter...`);
            showNotification(`📝 Step 1: Please press Enter to submit the prompt`, 'info');

            // Wait for user to manually submit and for response
            response = await this.waitForGeminiUserSubmitAndResponse();
        } else {
            // ✅ STEP 2+: AUTOMATIC SUBMISSION (fully automated)
            console.log(`🚀 Step ${stepIndex + 1}: Auto-submitting prompt...`);

            // Try to find and click the send button
            const sendButtonSelectors = [
                'button[type="submit"]',
                'button[aria-label*="Send"]',
                'button[aria-label*="Submit"]',
                'button:has(svg)', // Buttons with SVG icons (usually send buttons)
                'button[data-testid*="send"]',
                'button.send-button',
                'button[aria-label*="send"]'
            ];

            let sendButton = null;
            for (const selector of sendButtonSelectors) {
                const buttons = document.querySelectorAll(selector);
                for (const btn of buttons) {
                    if (btn.offsetParent !== null && !btn.disabled) {
                        sendButton = btn;
                        console.log(`✅ Found send button with selector: ${selector}`);
                        break;
                    }
                }
                if (sendButton) break;
            }

            if (sendButton) {
                // Click the send button
                sendButton.click();
                console.log('✅ Clicked send button');
            } else {
                // Fallback: Trigger Enter key
                console.log('⚠️ Send button not found, triggering Enter key...');
                const enterEvent = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                });
                inputField.dispatchEvent(enterEvent);
            }

            await this.sleep(500); // Wait for submission to process

            // Wait for response to complete (automatic detection)
            // Skip the "wait for user submission" part since we already submitted
            response = await this.waitForGeminiResponse();
        }

        return response;
    }

    async sendToLovable(prompt, stepIndex) {
        // Lovable has two input locations:
        // 1. New chat input (initial message / landing page)
        // 2. Continue chat input (active conversation)

        let inputField = null;
        let foundLocation = '';

        // Strategy: Find ALL visible input fields (both contenteditable AND textarea)
        // Then use position-based selection or scenario detection
        const visibleFields = [];

        // Check for contenteditable divs
        const allContentEditables = document.querySelectorAll('div[contenteditable="true"]');
        for (const field of allContentEditables) {
            if (field.offsetParent !== null && field.offsetHeight > 0 && field.offsetWidth > 0) {
                const computedStyle = window.getComputedStyle(field);
                if (computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden') {
                    visibleFields.push(field);
                }
            }
        }

        // Check for textareas with common Lovable patterns
        const textareaSelectors = [
            'textarea[placeholder*="Message"]',
            'textarea[placeholder*="message"]',
            'textarea[placeholder*="Tell"]',
            'textarea[placeholder*="Ask"]',
            'textarea[placeholder*="chat"]',
            'textarea.chat-input',
            'textarea'
        ];

        for (const selector of textareaSelectors) {
            const textareas = document.querySelectorAll(selector);
            for (const field of textareas) {
                if (field.offsetParent !== null && field.offsetHeight > 0 && field.offsetWidth > 0) {
                    const computedStyle = window.getComputedStyle(field);
                    if (computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden') {
                        // Avoid duplicates
                        if (!visibleFields.includes(field)) {
                            visibleFields.push(field);
                        }
                    }
                }
            }
        }

        console.log(`🔍 Found ${visibleFields.length} visible input field(s) in Lovable`);

        // Smart selection based on step index and scenario
        if (visibleFields.length > 1) {
            // Multiple fields visible - need to choose the right one
            // Step 1 (index 0) → Prefer NEW CHAT input (could be center/left, larger, or specific position)
            // Step 2+ (index > 0) → Prefer CONTINUE CHAT input (active conversation area)

            // Get positions and dimensions of all fields
            const fieldsWithPosition = visibleFields.map(field => ({
                field,
                rect: field.getBoundingClientRect(),
                x: field.getBoundingClientRect().left,
                y: field.getBoundingClientRect().top,
                width: field.getBoundingClientRect().width,
                height: field.getBoundingClientRect().height,
                type: field.tagName.toLowerCase(),
                placeholder: field.placeholder || ''
            }));

            // Sort by Y position first (top to bottom), then X position (left to right)
            fieldsWithPosition.sort((a, b) => {
                if (Math.abs(a.y - b.y) > 50) { // Different rows
                    return a.y - b.y;
                }
                return a.x - b.x; // Same row, sort by X
            });

            console.log(`📊 Lovable field positions:`, fieldsWithPosition.map(f =>
                `${f.type} at (x=${f.x.toFixed(0)}, y=${f.y.toFixed(0)}) size=${f.width.toFixed(0)}x${f.height.toFixed(0)} placeholder="${f.placeholder}"`
            ).join(', '));

            if (stepIndex === 0) {
                // Step 1: Prefer the NEW CHAT input
                // Strategy: Use the topmost or largest field (new chat inputs are usually prominent)
                // Or look for specific placeholders that indicate "new chat"

                // Try to find field with "new" or "start" in placeholder
                let newChatField = fieldsWithPosition.find(f =>
                    f.placeholder.toLowerCase().includes('start') ||
                    f.placeholder.toLowerCase().includes('new') ||
                    f.placeholder.toLowerCase().includes('tell') ||
                    f.placeholder.toLowerCase().includes('what')
                );

                if (!newChatField) {
                    // Fallback: Use the topmost field (usually the main input)
                    newChatField = fieldsWithPosition[0];
                }

                inputField = newChatField.field;
                foundLocation = `new-chat (${newChatField.type}) at y=${newChatField.y.toFixed(0)}`;
                console.log(`✅ Step 1: Using NEW CHAT input (${newChatField.type}) at (x=${newChatField.x.toFixed(0)}, y=${newChatField.y.toFixed(0)})`);
            } else {
                // Step 2+: Prefer the CONTINUE CHAT input
                // Strategy: Use the bottommost field or field in active chat area

                // Try to find field with "message" in placeholder (continue chat)
                let continueChatField = fieldsWithPosition.find(f =>
                    f.placeholder.toLowerCase().includes('message') ||
                    f.placeholder.toLowerCase().includes('reply') ||
                    f.placeholder.toLowerCase().includes('type')
                );

                if (!continueChatField) {
                    // Fallback: Use the bottommost field (usually in active chat)
                    continueChatField = fieldsWithPosition[fieldsWithPosition.length - 1];
                }

                inputField = continueChatField.field;
                foundLocation = `continue-chat (${continueChatField.type}) at y=${continueChatField.y.toFixed(0)}`;
                console.log(`✅ Step ${stepIndex + 1}: Using CONTINUE CHAT input (${continueChatField.type}) at (x=${continueChatField.x.toFixed(0)}, y=${continueChatField.y.toFixed(0)})`);
            }
        } else if (visibleFields.length === 1) {
            // Only one field visible - use it
            inputField = visibleFields[0];
            const fieldType = inputField.tagName.toLowerCase();
            foundLocation = `single ${fieldType} field`;
            console.log(`✅ Using single Lovable input field: ${foundLocation}`);
        }

        if (!inputField) {
            console.error('❌ Could not find Lovable input field. Checked all locations.');
            throw new Error('Could not find Lovable input field. Please make sure you are on lovable.dev');
        }

        console.log(`📍 Step ${stepIndex + 1}: Using Lovable input at ${foundLocation}`);

        // Clear existing content and insert the prompt
        inputField.focus();
        await this.sleep(100);

        // Clear the field completely
        if (inputField.tagName.toLowerCase() === 'textarea') {
            inputField.value = '';
            inputField.value = prompt;
        } else {
            inputField.textContent = '';
            inputField.innerHTML = '';
            inputField.textContent = prompt;
        }

        // Trigger input events so Lovable recognizes the text
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        inputField.dispatchEvent(new Event('change', { bubbles: true }));

        console.log(`✅ Inserted prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);

        // Small delay to ensure the text is processed
        await this.sleep(500);

        let response;

        if (stepIndex === 0) {
            // ✅ STEP 1: MANUAL SUBMISSION (user presses Enter)
            console.log(`⏸ Step 1: Prompt inserted. Waiting for user to press Enter...`);
            showNotification(`📝 Step 1: Please press Enter to submit the prompt`, 'info');

            // Wait for user to manually submit and for response
            response = await this.waitForLovableUserSubmitAndResponse();
        } else {
            // ✅ STEP 2+: AUTOMATIC SUBMISSION (fully automated)
            console.log(`🚀 Step ${stepIndex + 1}: Auto-submitting prompt...`);

            // Try to find and click the send button
            const sendButtonSelectors = [
                'button[type="submit"]',
                'button[aria-label*="Send"]',
                'button[aria-label*="Submit"]',
                'button:has(svg)', // Buttons with SVG icons (usually send buttons)
                'button[data-testid*="send"]',
                'button.send-button',
                'button[title*="Send"]'
            ];

            let sendButton = null;
            for (const selector of sendButtonSelectors) {
                const buttons = document.querySelectorAll(selector);
                for (const btn of buttons) {
                    if (btn.offsetParent !== null && !btn.disabled) {
                        sendButton = btn;
                        console.log(`✅ Found send button with selector: ${selector}`);
                        break;
                    }
                }
                if (sendButton) break;
            }

            if (sendButton) {
                // Click the send button
                sendButton.click();
                console.log('✅ Clicked send button');
            } else {
                // Fallback: Trigger Enter key
                console.log('⚠️ Send button not found, triggering Enter key...');
                const enterEvent = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                });
                inputField.dispatchEvent(enterEvent);
            }

            await this.sleep(500); // Wait for submission to process

            // Wait for response to complete (automatic detection)
            // Skip the "wait for user submission" part since we already submitted
            response = await this.waitForLovableResponse();
        }

        return response;
    }

    async sendToClaudeCode(prompt, stepIndex) {
        // Claude Code has two input locations:
        // 1. Right-side chat input (active conversation) - PRIORITY
        // 2. Left-side initial input (first message)

        let inputField = null;
        let foundLocation = '';

        // Strategy: Find ALL visible input fields (both contenteditable AND textarea)
        // Then use position-based selection
        const visibleFields = [];

        // Check for contenteditable divs
        const allContentEditables = document.querySelectorAll('div[contenteditable="true"]');
        for (const field of allContentEditables) {
            if (field.offsetParent !== null && field.offsetHeight > 0 && field.offsetWidth > 0) {
                const computedStyle = window.getComputedStyle(field);
                if (computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden') {
                    visibleFields.push(field);
                }
            }
        }

        // Check for textareas
        const allTextareas = document.querySelectorAll('textarea');
        for (const field of allTextareas) {
            if (field.offsetParent !== null && field.offsetHeight > 0 && field.offsetWidth > 0) {
                const computedStyle = window.getComputedStyle(field);
                if (computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden') {
                    visibleFields.push(field);
                }
            }
        }

        console.log(`🔍 Found ${visibleFields.length} visible input field(s) (contenteditable + textarea)`);

        // Smart selection based on step index and position
        if (visibleFields.length > 1) {
            // Multiple fields visible - need to choose the right one
            // Step 1 (index 0) → Use LEFT-side input (lower X coordinate)
            // Step 2+ (index > 0) → Use RIGHT-side input (higher X coordinate)

            // Get positions of all fields
            const fieldsWithPosition = visibleFields.map(field => ({
                field,
                rect: field.getBoundingClientRect(),
                x: field.getBoundingClientRect().left,
                type: field.tagName.toLowerCase()
            }));

            // Sort by X position (left to right)
            fieldsWithPosition.sort((a, b) => a.x - b.x);

            console.log(`📊 Field positions:`, fieldsWithPosition.map(f => `${f.type} at x=${f.x.toFixed(0)}`).join(', '));

            if (stepIndex === 0) {
                // First step: use leftmost input (left panel)
                inputField = fieldsWithPosition[0].field;
                foundLocation = `left-side (${fieldsWithPosition[0].type})`;
                console.log(`✅ Step 1: Using LEFT input (${fieldsWithPosition[0].type}) at x=${fieldsWithPosition[0].x.toFixed(0)}`);
            } else {
                // Subsequent steps: use rightmost input (right panel - active chat)
                const rightmost = fieldsWithPosition[fieldsWithPosition.length - 1];
                inputField = rightmost.field;
                foundLocation = `right-side (${rightmost.type})`;
                console.log(`✅ Step ${stepIndex + 1}: Using RIGHT input (${rightmost.type}) at x=${rightmost.x.toFixed(0)}`);
            }
        } else if (visibleFields.length === 1) {
            // Only one field visible
            inputField = visibleFields[0];
            const fieldType = inputField.tagName.toLowerCase();
            foundLocation = `single ${fieldType} field`;
            console.log(`✅ Using Claude Code input field: ${foundLocation}`);
        }

        if (!inputField) {
            console.error('❌ Could not find Claude Code input field. Checked all locations.');
            throw new Error('Could not find Claude Code input field. Please make sure you are on claude.ai/code');
        }

        console.log(`📍 Step ${stepIndex + 1}: Using input at ${foundLocation}`);

        // Clear existing content and insert the prompt
        inputField.focus();
        await this.sleep(100);

        // Clear the field completely
        if (inputField.tagName.toLowerCase() === 'textarea') {
            inputField.value = '';
            inputField.value = prompt;
        } else {
            inputField.textContent = '';
            inputField.innerHTML = '';
            inputField.textContent = prompt;
        }

        // Trigger input events so Claude Code recognizes the text
        inputField.dispatchEvent(new Event('input', { bubbles: true }));
        inputField.dispatchEvent(new Event('change', { bubbles: true }));

        console.log(`✅ Inserted prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);

        // Small delay to ensure the text is processed
        await this.sleep(500);

        let response;

        if (stepIndex === 0) {
            // ✅ STEP 1: MANUAL SUBMISSION (user presses Enter)
            // This starts the session and activates the right-side chat
            console.log(`⏸ Step 1: Prompt inserted. Waiting for user to press Enter...`);
            showNotification(`📝 Step 1: Please press Enter to submit the prompt`, 'info');

            // Wait for user to manually submit and for response
            response = await this.waitForClaudeCodeManualSubmitAndResponse();
        } else {
            // ✅ STEP 2+: AUTOMATIC SUBMISSION (fully automated)
            // Right-side chat is now active and stable
            console.log(`🚀 Step ${stepIndex + 1}: Auto-submitting prompt...`);

            // Try to find and click the send button
            const sendButtonSelectors = [
                'button[type="submit"]',
                'button[aria-label*="Send"]',
                'button[aria-label*="Submit"]',
                'button:has(svg)', // Buttons with SVG icons (usually send buttons)
                'button[data-testid*="send"]'
            ];

            let sendButton = null;
            for (const selector of sendButtonSelectors) {
                const buttons = document.querySelectorAll(selector);
                for (const btn of buttons) {
                    if (btn.offsetParent !== null && !btn.disabled) {
                        sendButton = btn;
                        console.log(`✅ Found send button with selector: ${selector}`);
                        break;
                    }
                }
                if (sendButton) break;
            }

            if (sendButton) {
                // Click the send button
                sendButton.click();
                console.log('✅ Clicked send button');
            } else {
                // Fallback: Trigger Enter key
                console.log('⚠️ Send button not found, triggering Enter key...');
                const enterEvent = new KeyboardEvent('keydown', {
                    key: 'Enter',
                    code: 'Enter',
                    keyCode: 13,
                    which: 13,
                    bubbles: true,
                    cancelable: true
                });
                inputField.dispatchEvent(enterEvent);
            }

            await this.sleep(500); // Wait for submission to process

            // Wait for response to complete (automatic detection)
            response = await this.waitForClaudeCodeSubmitAndResponse();
        }

        return response;
    }

    async waitForClaudeCodeManualSubmitAndResponse() {
        console.log('⏳ Waiting for user to submit prompt in Claude Code...');

        return new Promise((resolve, reject) => {
            const maxWaitTime = 300000; // 5 minutes max
            const startTime = Date.now();
            let checkIntervalId;
            let submissionDetected = false;
            let responseCompletionDetected = false;
            let completionDetectedTime = null;
            let stabilityChecksPassed = 0;

            const checkProgress = () => {
                try {
                    const now = Date.now();
                    const elapsed = now - startTime;

                    const allInputs = document.querySelectorAll('div[contenteditable="true"], textarea');
                    let activeInput = null;

                    // Find the visible, active input
                    for (const input of allInputs) {
                        if (input.offsetParent !== null && input.offsetHeight > 0) {
                            activeInput = input;
                            break;
                        }
                    }

                    const sendButton = document.querySelector('button[type="submit"]');

                    // Stage 1: Detect user submission
                    if (!submissionDetected && activeInput) {
                        const inputContent = activeInput.value || activeInput.textContent || '';
                        if (inputContent.trim() === '') {
                            console.log('✅ User submitted (input cleared)');
                            submissionDetected = true;
                        }
                    }

                    // Stage 2: Detect response completion
                    if (submissionDetected && !responseCompletionDetected) {
                        const inputReady = activeInput && !activeInput.disabled;
                        // Note: Send button will be disabled when input is empty, which is normal
                        // So we only check if input field is ready

                        // Debug logging every 3 seconds
                        if (elapsed > 0 && elapsed % 3000 < 300) {
                            console.log(`🔍 Checking completion: input=${activeInput ? (activeInput.disabled ? 'DISABLED' : 'ready') : 'NOT FOUND'}`);
                        }

                        if (inputReady) {
                            if (completionDetectedTime === null) {
                                console.log('✅ Response appears complete, verifying...');
                                completionDetectedTime = now;
                            }

                            const timeSinceCompletion = now - completionDetectedTime;

                            if (timeSinceCompletion >= 5000) { // Wait 5 seconds for stability (increased from 2s)
                                stabilityChecksPassed++;

                                if (stabilityChecksPassed >= 4) { // Need 4 consecutive checks (increased from 2)
                                    const totalElapsed = ((now - startTime) / 1000).toFixed(1);
                                    console.log(`✅ Response FULLY complete in ${totalElapsed}s (verified)`);

                                    clearInterval(checkIntervalId);
                                    resolve('Response received (Claude Code - manual)');
                                    return;
                                }
                            }
                        } else {
                            completionDetectedTime = null;
                            stabilityChecksPassed = 0;
                        }
                    }

                    // Timeout check
                    if (elapsed > maxWaitTime) {
                        clearInterval(checkIntervalId);
                        reject(new Error('Timeout waiting for Claude Code response'));
                    }
                } catch (error) {
                    console.error('Error checking Claude Code progress:', error);
                }
            };

            // Check every 300ms
            checkIntervalId = setInterval(checkProgress, 300);
        });
    }

    async waitForClaudeCodeSubmitAndResponse() {
        console.log('⏳ Waiting for Claude Code response...');

        return new Promise((resolve, reject) => {
            const maxWaitTime = 300000; // 5 minutes max
            const startTime = Date.now();
            let checkIntervalId;
            let submissionDetected = false;
            let responseStarted = false;
            let responseCompletionDetected = false;
            let completionDetectedTime = null;
            let stabilityChecksPassed = 0;
            let initialMessageCount = 0;

            // Count initial messages for comparison
            const countMessages = () => {
                const messageSelectors = ['[role="article"]', '[data-message-id]', '.message', '[class*="message"]'];
                let count = 0;
                for (const selector of messageSelectors) {
                    const messages = document.querySelectorAll(selector);
                    if (messages.length > count) count = messages.length;
                }
                return count;
            };

            initialMessageCount = countMessages();

            const checkProgress = () => {
                try {
                    const now = Date.now();
                    const elapsed = now - startTime;

                    const allInputs = document.querySelectorAll('div[contenteditable="true"], textarea');
                    let activeInput = null;

                    // Find the visible, active input
                    for (const input of allInputs) {
                        if (input.offsetParent !== null && input.offsetHeight > 0) {
                            activeInput = input;
                            break;
                        }
                    }

                    // Check for stop button
                    const stopButton = document.querySelector('button[aria-label*="Stop"], button[aria-label*="Cancel"], button[aria-label*="stop"], button[title*="Stop"]');
                    const stopButtonVisible = stopButton && stopButton.offsetParent !== null;

                    // Check if send button is disabled (indicates request in progress)
                    const sendButton = document.querySelector('button[type="submit"]');
                    const sendButtonDisabled = sendButton && sendButton.disabled;

                    // Count messages to detect new response
                    const currentMessageCount = countMessages();
                    const newMessageAppeared = currentMessageCount > initialMessageCount;

                    // Stage 1: Detect submission
                    if (!submissionDetected && activeInput) {
                        const inputContent = activeInput.value || activeInput.textContent || '';
                        if (inputContent.trim() === '') {
                            console.log('✅ Stage 1: Submission detected (input cleared)');
                            submissionDetected = true;
                        }
                    }

                    // Stage 2: Detect response started (multiple methods)
                    if (submissionDetected && !responseStarted) {
                        if (stopButtonVisible) {
                            console.log('✅ Stage 2: Response started (stop button visible)');
                            responseStarted = true;
                        } else if (sendButtonDisabled) {
                            console.log('✅ Stage 2: Response started (send button disabled)');
                            responseStarted = true;
                        } else if (newMessageAppeared) {
                            console.log('✅ Stage 2: Response started (new message appeared)');
                            responseStarted = true;
                        } else if (elapsed > 3000) {
                            // Timeout: assume response started if we've been waiting 3+ seconds
                            console.log('✅ Stage 2: Response started (timeout fallback - assuming response began)');
                            responseStarted = true;
                        }
                    }

                    // Stage 3: Detect response completion (multiple methods)
                    if (responseStarted && !responseCompletionDetected) {
                        const inputReady = activeInput && !activeInput.disabled;
                        const sendButtonReady = sendButton && !sendButton.disabled;

                        if (!stopButtonVisible && inputReady && sendButtonReady && newMessageAppeared) {
                            console.log('✅ Stage 3: Response completion detected');
                            responseCompletionDetected = true;
                            completionDetectedTime = now;
                        }
                    }

                    // Stage 4: Stability verification
                    if (responseCompletionDetected) {
                        const timeSinceCompletion = now - completionDetectedTime;

                        if (timeSinceCompletion >= 1500) { // Wait 1.5 seconds for stability
                            const inputReady = activeInput && !activeInput.disabled;
                            const sendButtonReady = sendButton && !sendButton.disabled;

                            if (inputReady && sendButtonReady) {
                                stabilityChecksPassed++;

                                if (stabilityChecksPassed >= 2) {
                                    const totalElapsed = ((now - startTime) / 1000).toFixed(1);
                                    console.log(`✅ Stage 4: Response FULLY complete in ${totalElapsed}s (verified)`);

                                    clearInterval(checkIntervalId);
                                    resolve('Response received (Claude Code)');
                                    return;
                                }
                            } else {
                                stabilityChecksPassed = 0;
                            }
                        }
                    }

                    // Timeout check
                    if (elapsed > maxWaitTime) {
                        clearInterval(checkIntervalId);
                        reject(new Error('Timeout waiting for Claude Code response'));
                    }
                } catch (error) {
                    console.error('Error checking Claude Code progress:', error);
                }
            };

            // Check every 300ms
            checkIntervalId = setInterval(checkProgress, 300);
        });
    }

    async waitForUserSubmitAndResponse() {
        console.log('⏳ Waiting for user to submit prompt...');

        // First, wait for user to press Enter (detect submission)
        await this.waitForUserSubmission();

        console.log('✅ User submitted! Now waiting for Claude response...');

        // Then wait for the response to complete
        return await this.waitForClaudeResponse();
    }

    async waitForUserSubmission() {
        // Wait until we detect that the user has submitted the prompt
        // We can detect this by watching for:
        // 1. The Stop button to appear (means response is generating)
        // 2. Input field becomes empty/disabled

        return new Promise((resolve, reject) => {
            const maxWaitTime = 300000; // 5 minutes max wait for user to press Enter
            const startTime = Date.now();
            let checkIntervalId;
            let observer;

            const checkIfUserSubmitted = () => {
                try {
                    // Check if stop button exists (means user submitted and response is generating)
                    const stopButtonSelectors = [
                        'button[aria-label="Stop"]',
                        'button[aria-label*="Stop"]',
                        'button[aria-label="Stop generating"]'
                    ];

                    let stopButton = null;
                    for (const selector of stopButtonSelectors) {
                        try {
                            stopButton = document.querySelector(selector);
                            if (stopButton && stopButton.offsetParent !== null) {
                                console.log('✅ Detected user submission (Stop button appeared)');
                                clearInterval(checkIntervalId);
                                if (observer) observer.disconnect();
                                resolve();
                                return;
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    // Check if input field is empty (might indicate submission)
                    const inputField = document.querySelector('div[contenteditable="true"][data-value]');
                    if (inputField && inputField.textContent.trim() === '') {
                        // Input cleared, but let's wait a bit more to confirm
                        // This could mean user submitted
                        console.log('⏳ Input field cleared, confirming submission...');
                    }

                    // Timeout check
                    if (Date.now() - startTime > maxWaitTime) {
                        clearInterval(checkIntervalId);
                        if (observer) observer.disconnect();
                        reject(new Error('Timeout waiting for user to submit prompt'));
                    }
                } catch (error) {
                    console.error('Error checking user submission:', error);
                }
            };

            // Check every 300ms
            checkIntervalId = setInterval(checkIfUserSubmitted, 300);

            // Also use MutationObserver for immediate detection
            observer = new MutationObserver(() => {
                checkIfUserSubmitted();
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true
            });
        });
    }

    async waitForClaudeResponse() {
        console.log('⏳ Waiting for Claude response to complete...');

        // Give Claude a moment to start responding
        await this.sleep(1000);

        return new Promise((resolve, reject) => {
            let timeoutId;
            let checkIntervalId;
            let responseStarted = false;
            let lastMessageCount = 0;
            const maxWaitTime = 120000; // 2 minutes max
            const startTime = Date.now();

            const extractResponse = () => {
                // Try multiple methods to extract the response text
                const messageSelectors = [
                    '[data-test-render-count]',
                    '.font-claude-message',
                    'div[class*="font-claude"]',
                    '[class*="message"]',
                    '.prose'
                ];

                let responseText = '';
                let usedSelector = '';

                for (const selector of messageSelectors) {
                    const messages = document.querySelectorAll(selector);
                    if (messages.length > 0) {
                        const lastMessage = messages[messages.length - 1];
                        responseText = lastMessage.textContent || lastMessage.innerText || '';

                        if (responseText.trim().length > 0) {
                            usedSelector = selector;
                            console.log(`✅ Extracted response using selector: ${selector} (${responseText.length} chars)`);
                            break;
                        }
                    }
                }

                return { text: responseText, selector: usedSelector };
            };

            const checkIfComplete = () => {
                try {
                    // Check if stop button exists (response is still generating)
                    const stopButtonSelectors = [
                        'button[aria-label="Stop"]',
                        'button[aria-label*="Stop"]',
                        'button[aria-label="Stop generating"]'
                    ];

                    let stopButton = null;
                    for (const selector of stopButtonSelectors) {
                        try {
                            stopButton = document.querySelector(selector);
                            if (stopButton && stopButton.offsetParent !== null) {
                                break;
                            } else {
                                stopButton = null;
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    if (stopButton) {
                        if (!responseStarted) {
                            responseStarted = true;
                            console.log('✅ Response generation started (detected Stop button)');
                        }
                        return; // Still generating
                    }

                    // No stop button visible - response might be complete
                    // Try to extract the response
                    const { text, selector } = extractResponse();

                    // Validate response has meaningful content (more than 50 chars to avoid placeholders)
                    const MIN_RESPONSE_LENGTH = 50;

                    if (text.trim().length > MIN_RESPONSE_LENGTH) {
                        // Check if this is a new message (not the user's prompt)
                        const messages = document.querySelectorAll(selector);
                        if (messages.length > lastMessageCount) {
                            // New message appeared!
                            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                            console.log(`✅ Response complete in ${elapsed}s (${text.length} chars)`);

                            clearTimeout(timeoutId);
                            clearInterval(checkIntervalId);
                            observer.disconnect();
                            resolve(text);
                        } else if (responseStarted) {
                            // We saw it start and now stop button is gone
                            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                            console.log(`✅ Response complete in ${elapsed}s (after generation, ${text.length} chars)`);

                            clearTimeout(timeoutId);
                            clearInterval(checkIntervalId);
                            observer.disconnect();
                            resolve(text);
                        }
                    } else if (text.trim().length > 0) {
                        // Response too short - probably placeholder text
                        console.log(`⏳ Response detected but too short (${text.length} chars), waiting for more...`);
                    }
                } catch (error) {
                    console.error('Error checking response completion:', error);
                }
            };

            // Count initial messages
            const initialMessages = document.querySelectorAll('[data-test-render-count]');
            lastMessageCount = initialMessages.length;
            console.log(`📊 Initial message count: ${lastMessageCount}`);

            // Set timeout
            timeoutId = setTimeout(() => {
                clearInterval(checkIntervalId);
                observer.disconnect();

                // Try one last time to extract response before timing out
                const { text } = extractResponse();
                if (text.trim().length > 0) {
                    console.warn('⚠️ Timeout reached but found response, using it');
                    resolve(text);
                } else {
                    console.error('❌ Response timeout after 2 minutes');
                    reject(new Error('Response timeout - Claude took too long to respond'));
                }
            }, maxWaitTime);

            // Watch for DOM changes
            const observer = new MutationObserver(() => {
                checkIfComplete();
            });

            // Start observing
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true
            });

            // Also check periodically (every 1s) as a fallback
            checkIntervalId = setInterval(() => {
                console.log('🔄 Periodic check for response completion...');
                checkIfComplete();
            }, 1000);

            // Do an initial check after 500ms in case response already completed
            setTimeout(() => checkIfComplete(), 500);
        });
    }

    async waitForChatGPTUserSubmitAndResponse() {
        console.log('⏳ Waiting for user to submit prompt on ChatGPT...');

        // First, wait for user to press Enter (detect submission)
        await this.waitForChatGPTUserSubmission();

        console.log('✅ User submitted! Now waiting for ChatGPT response...');

        // Then wait for the response to complete
        return await this.waitForChatGPTResponse();
    }

    async waitForChatGPTUserSubmission() {
        // Wait until we detect that the user has submitted the prompt
        return new Promise((resolve, reject) => {
            const maxWaitTime = 300000; // 5 minutes max wait for user to press Enter
            const startTime = Date.now();
            let checkIntervalId;
            let observer;

            const checkIfUserSubmitted = () => {
                try {
                    // Check if stop/regenerate button exists (means user submitted and response is generating)
                    const stopButtonSelectors = [
                        'button[aria-label="Stop generating"]',
                        'button[aria-label*="Stop"]',
                        'button[data-testid="stop-button"]',
                        'button svg.icon-md' // Stop icon
                    ];

                    let stopButton = null;
                    for (const selector of stopButtonSelectors) {
                        try {
                            stopButton = document.querySelector(selector);
                            if (stopButton && stopButton.offsetParent !== null) {
                                console.log('✅ Detected user submission on ChatGPT (Stop button appeared)');
                                clearInterval(checkIntervalId);
                                if (observer) observer.disconnect();
                                resolve();
                                return;
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    // Check if textarea is empty (might indicate submission)
                    const textarea = document.querySelector('#prompt-textarea, textarea[placeholder*="Message"]');
                    if (textarea && textarea.value.trim() === '') {
                        console.log('⏳ Input field cleared, confirming submission...');
                    }

                    // Timeout check
                    if (Date.now() - startTime > maxWaitTime) {
                        clearInterval(checkIntervalId);
                        if (observer) observer.disconnect();
                        reject(new Error('Timeout waiting for user to submit prompt on ChatGPT'));
                    }
                } catch (error) {
                    console.error('Error checking user submission on ChatGPT:', error);
                }
            };

            // Check every 300ms
            checkIntervalId = setInterval(checkIfUserSubmitted, 300);

            // Also use MutationObserver for immediate detection
            observer = new MutationObserver(() => {
                checkIfUserSubmitted();
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true
            });
        });
    }

    async waitForChatGPTResponse() {
        console.log('⏳ Waiting for ChatGPT response to complete...');

        // Give ChatGPT a moment to start responding
        await this.sleep(1000);

        return new Promise((resolve, reject) => {
            let timeoutId;
            let checkIntervalId;
            let responseStarted = false;
            let lastMessageCount = 0;
            const maxWaitTime = 120000; // 2 minutes max
            const startTime = Date.now();

            const extractResponse = () => {
                // Try multiple methods to extract the ChatGPT response text
                const messageSelectors = [
                    '[data-message-author-role="assistant"]',
                    '.markdown.prose',
                    'article[class*="group"]',
                    '[class*="markdown"]',
                    '.text-base'
                ];

                let responseText = '';
                let usedSelector = '';

                for (const selector of messageSelectors) {
                    const messages = document.querySelectorAll(selector);
                    if (messages.length > 0) {
                        const lastMessage = messages[messages.length - 1];
                        responseText = lastMessage.textContent || lastMessage.innerText || '';

                        if (responseText.trim().length > 0) {
                            usedSelector = selector;
                            console.log(`✅ Extracted ChatGPT response using selector: ${selector} (${responseText.length} chars)`);
                            break;
                        }
                    }
                }

                return { text: responseText, selector: usedSelector };
            };

            const checkIfComplete = () => {
                try {
                    // Check if stop button exists (response is still generating)
                    const stopButtonSelectors = [
                        'button[aria-label="Stop generating"]',
                        'button[aria-label*="Stop"]',
                        'button[data-testid="stop-button"]'
                    ];

                    let stopButton = null;
                    for (const selector of stopButtonSelectors) {
                        try {
                            stopButton = document.querySelector(selector);
                            if (stopButton && stopButton.offsetParent !== null) {
                                break;
                            } else {
                                stopButton = null;
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    if (stopButton) {
                        if (!responseStarted) {
                            responseStarted = true;
                            console.log('✅ ChatGPT response generation started (detected Stop button)');
                        }
                        return; // Still generating
                    }

                    // No stop button visible - response might be complete
                    // Try to extract the response
                    const { text, selector } = extractResponse();

                    // Validate response has meaningful content
                    const MIN_RESPONSE_LENGTH = 50;

                    if (text.trim().length > MIN_RESPONSE_LENGTH) {
                        // Check if this is a new message (not the user's prompt)
                        const messages = document.querySelectorAll(selector);
                        if (messages.length > lastMessageCount) {
                            // New message appeared!
                            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                            console.log(`✅ ChatGPT response complete in ${elapsed}s (${text.length} chars)`);

                            clearTimeout(timeoutId);
                            clearInterval(checkIntervalId);
                            observer.disconnect();
                            resolve(text);
                        } else if (responseStarted) {
                            // We saw it start and now stop button is gone
                            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                            console.log(`✅ ChatGPT response complete in ${elapsed}s (after generation, ${text.length} chars)`);

                            clearTimeout(timeoutId);
                            clearInterval(checkIntervalId);
                            observer.disconnect();
                            resolve(text);
                        }
                    } else if (text.trim().length > 0) {
                        // Response too short - probably placeholder text
                        console.log(`⏳ Response detected but too short (${text.length} chars), waiting for more...`);
                    }
                } catch (error) {
                    console.error('Error checking ChatGPT response completion:', error);
                }
            };

            // Count initial messages
            const initialMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
            lastMessageCount = initialMessages.length;
            console.log(`📊 Initial ChatGPT message count: ${lastMessageCount}`);

            // Set timeout
            timeoutId = setTimeout(() => {
                clearInterval(checkIntervalId);
                observer.disconnect();

                // Try one last time to extract response before timing out
                const { text } = extractResponse();
                if (text.trim().length > 0) {
                    console.warn('⚠️ Timeout reached but found ChatGPT response, using it');
                    resolve(text);
                } else {
                    console.error('❌ Response timeout after 2 minutes');
                    reject(new Error('Response timeout - ChatGPT took too long to respond'));
                }
            }, maxWaitTime);

            // Watch for DOM changes
            const observer = new MutationObserver(() => {
                checkIfComplete();
            });

            // Start observing
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true
            });

            // Also check periodically (every 1s) as a fallback
            checkIntervalId = setInterval(() => {
                console.log('🔄 Periodic check for ChatGPT response completion...');
                checkIfComplete();
            }, 1000);

            // Do an initial check after 500ms in case response already completed
            setTimeout(() => checkIfComplete(), 500);
        });
    }

    async waitForDeepSeekUserSubmitAndResponse() {
        console.log('⏳ Waiting for user to submit prompt on DeepSeek...');

        // First, wait for user to press Enter (detect submission)
        await this.waitForDeepSeekUserSubmission();

        console.log('✅ User submitted! Now waiting for DeepSeek response...');

        // Then wait for the response to complete
        return await this.waitForDeepSeekResponse();
    }

    async waitForDeepSeekUserSubmission() {
        // Wait until we detect that the user has submitted the prompt
        return new Promise((resolve, reject) => {
            const maxWaitTime = 300000; // 5 minutes max wait for user to press Enter
            const startTime = Date.now();
            let checkIntervalId;
            let observer;

            const checkIfUserSubmitted = () => {
                try {
                    // Check if stop/regenerate button exists (means user submitted and response is generating)
                    const stopButtonSelectors = [
                        'button[aria-label="Stop generating"]',
                        'button[aria-label*="Stop"]',
                        'button[aria-label*="stop"]',
                        'button.stop-button',
                        'button svg.icon-md' // Stop icon
                    ];

                    let stopButton = null;
                    for (const selector of stopButtonSelectors) {
                        try {
                            stopButton = document.querySelector(selector);
                            if (stopButton && stopButton.offsetParent !== null) {
                                console.log('✅ Detected user submission on DeepSeek (Stop button appeared)');
                                clearInterval(checkIntervalId);
                                if (observer) observer.disconnect();
                                resolve();
                                return;
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    // Check if textarea is empty (might indicate submission)
                    const textarea = document.querySelector('textarea[placeholder*="Message"], textarea.chat-input, textarea');
                    if (textarea && textarea.value.trim() === '') {
                        console.log('⏳ Input field cleared, confirming submission...');
                    }

                    // Timeout check
                    if (Date.now() - startTime > maxWaitTime) {
                        clearInterval(checkIntervalId);
                        if (observer) observer.disconnect();
                        reject(new Error('Timeout waiting for user to submit prompt on DeepSeek'));
                    }
                } catch (error) {
                    console.error('Error checking user submission on DeepSeek:', error);
                }
            };

            // Check every 300ms
            checkIntervalId = setInterval(checkIfUserSubmitted, 300);

            // Also use MutationObserver for immediate detection
            observer = new MutationObserver(() => {
                checkIfUserSubmitted();
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true
            });
        });
    }

    async waitForDeepSeekResponse() {
        console.log('⏳ Waiting for DeepSeek response to complete...');

        // Give DeepSeek a moment to start responding
        await this.sleep(1000);

        return new Promise((resolve, reject) => {
            let timeoutId;
            let checkIntervalId;
            let responseStarted = false;
            let lastMessageCount = 0;
            const maxWaitTime = 120000; // 2 minutes max
            const startTime = Date.now();

            const extractResponse = () => {
                // Try multiple methods to extract the DeepSeek response text
                const messageSelectors = [
                    '[data-message-author-role="assistant"]',
                    '.message-content',
                    '.markdown.prose',
                    'article[class*="group"]',
                    '[class*="markdown"]',
                    '.response-message',
                    '.assistant-message',
                    '.text-base'
                ];

                let responseText = '';
                let usedSelector = '';

                for (const selector of messageSelectors) {
                    const messages = document.querySelectorAll(selector);
                    if (messages.length > 0) {
                        const lastMessage = messages[messages.length - 1];
                        responseText = lastMessage.textContent || lastMessage.innerText || '';

                        if (responseText.trim().length > 0) {
                            usedSelector = selector;
                            console.log(`✅ Extracted DeepSeek response using selector: ${selector} (${responseText.length} chars)`);
                            break;
                        }
                    }
                }

                return { text: responseText, selector: usedSelector };
            };

            const checkIfComplete = () => {
                try {
                    // Check if stop button exists (response is still generating)
                    const stopButtonSelectors = [
                        'button[aria-label="Stop generating"]',
                        'button[aria-label*="Stop"]',
                        'button[aria-label*="stop"]',
                        'button.stop-button'
                    ];

                    let stopButton = null;
                    for (const selector of stopButtonSelectors) {
                        try {
                            stopButton = document.querySelector(selector);
                            if (stopButton && stopButton.offsetParent !== null) {
                                break;
                            } else {
                                stopButton = null;
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    if (stopButton) {
                        if (!responseStarted) {
                            responseStarted = true;
                            console.log('✅ DeepSeek response generation started (detected Stop button)');
                        }
                        return; // Still generating
                    }

                    // No stop button visible - response might be complete
                    // Try to extract the response
                    const { text, selector } = extractResponse();

                    // Validate response has meaningful content
                    const MIN_RESPONSE_LENGTH = 50;

                    if (text.trim().length > MIN_RESPONSE_LENGTH) {
                        // Check if this is a new message (not the user's prompt)
                        const messages = document.querySelectorAll(selector);
                        if (messages.length > lastMessageCount) {
                            // New message appeared!
                            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                            console.log(`✅ DeepSeek response complete in ${elapsed}s (${text.length} chars)`);

                            clearTimeout(timeoutId);
                            clearInterval(checkIntervalId);
                            observer.disconnect();
                            resolve(text);
                        } else if (responseStarted) {
                            // We saw it start and now stop button is gone
                            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                            console.log(`✅ DeepSeek response complete in ${elapsed}s (after generation, ${text.length} chars)`);

                            clearTimeout(timeoutId);
                            clearInterval(checkIntervalId);
                            observer.disconnect();
                            resolve(text);
                        }
                    } else if (text.trim().length > 0) {
                        // Response too short - probably placeholder text
                        console.log(`⏳ Response detected but too short (${text.length} chars), waiting for more...`);
                    }
                } catch (error) {
                    console.error('Error checking DeepSeek response completion:', error);
                }
            };

            // Count initial messages
            const initialMessages = document.querySelectorAll('[data-message-author-role="assistant"], .message-content, .assistant-message');
            lastMessageCount = initialMessages.length;
            console.log(`📊 Initial DeepSeek message count: ${lastMessageCount}`);

            // Set timeout
            timeoutId = setTimeout(() => {
                clearInterval(checkIntervalId);
                observer.disconnect();

                // Try one last time to extract response before timing out
                const { text } = extractResponse();
                if (text.trim().length > 0) {
                    console.warn('⚠️ Timeout reached but found DeepSeek response, using it');
                    resolve(text);
                } else {
                    console.error('❌ Response timeout after 2 minutes');
                    reject(new Error('Response timeout - DeepSeek took too long to respond'));
                }
            }, maxWaitTime);

            // Watch for DOM changes
            const observer = new MutationObserver(() => {
                checkIfComplete();
            });

            // Start observing
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true
            });

            // Also check periodically (every 1s) as a fallback
            checkIntervalId = setInterval(() => {
                console.log('🔄 Periodic check for DeepSeek response completion...');
                checkIfComplete();
            }, 1000);

            // Do an initial check after 500ms in case response already completed
            setTimeout(() => checkIfComplete(), 500);
        });
    }

    async waitForGeminiUserSubmitAndResponse() {
        console.log('⏳ Waiting for user to submit prompt on Gemini...');

        // First, wait for user to press Enter (detect submission)
        await this.waitForGeminiUserSubmission();

        console.log('✅ User submitted! Now waiting for Gemini response...');

        // Then wait for the response to complete
        return await this.waitForGeminiResponse();
    }

    async waitForGeminiUserSubmission() {
        // Wait until we detect that the user has submitted the prompt
        return new Promise((resolve, reject) => {
            const maxWaitTime = 300000; // 5 minutes max wait for user to press Enter
            const startTime = Date.now();
            let checkIntervalId;
            let observer;

            const checkIfUserSubmitted = () => {
                try {
                    // Check if stop/regenerate button exists (means user submitted and response is generating)
                    const stopButtonSelectors = [
                        'button[aria-label="Stop generating"]',
                        'button[aria-label*="Stop"]',
                        'button[aria-label*="stop"]',
                        'button.stop-button',
                        'button svg.icon-md' // Stop icon
                    ];

                    let stopButton = null;
                    for (const selector of stopButtonSelectors) {
                        try {
                            stopButton = document.querySelector(selector);
                            if (stopButton && stopButton.offsetParent !== null) {
                                console.log('✅ Detected user submission on Gemini (Stop button appeared)');
                                clearInterval(checkIntervalId);
                                if (observer) observer.disconnect();
                                resolve();
                                return;
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    // Check if contenteditable is empty (might indicate submission)
                    const contentEditable = document.querySelector('.ql-editor[contenteditable="true"], div[contenteditable="true"]');
                    if (contentEditable && contentEditable.textContent.trim() === '') {
                        console.log('⏳ Input field cleared, confirming submission...');
                    }

                    // Timeout check
                    if (Date.now() - startTime > maxWaitTime) {
                        clearInterval(checkIntervalId);
                        if (observer) observer.disconnect();
                        reject(new Error('Timeout waiting for user to submit prompt on Gemini'));
                    }
                } catch (error) {
                    console.error('Error checking user submission on Gemini:', error);
                }
            };

            // Check every 300ms
            checkIntervalId = setInterval(checkIfUserSubmitted, 300);

            // Also use MutationObserver for immediate detection
            observer = new MutationObserver(() => {
                checkIfUserSubmitted();
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true
            });
        });
    }

    async waitForGeminiResponse() {
        console.log('⏳ Waiting for Gemini response to complete...');

        // Give Gemini a moment to start responding
        await this.sleep(1000);

        return new Promise((resolve, reject) => {
            let timeoutId;
            let checkIntervalId;
            let responseStarted = false;
            let lastMessageCount = 0;
            const maxWaitTime = 120000; // 2 minutes max
            const startTime = Date.now();

            const extractResponse = () => {
                // Try multiple methods to extract the Gemini response text
                const messageSelectors = [
                    '[data-message-author-role="assistant"]',
                    '.model-response-text',
                    '.message-content',
                    '.markdown.prose',
                    'message-content',
                    '[class*="markdown"]',
                    '.response-container',
                    '.text-base'
                ];

                let responseText = '';
                let usedSelector = '';

                for (const selector of messageSelectors) {
                    const messages = document.querySelectorAll(selector);
                    if (messages.length > 0) {
                        const lastMessage = messages[messages.length - 1];
                        responseText = lastMessage.textContent || lastMessage.innerText || '';

                        if (responseText.trim().length > 0) {
                            usedSelector = selector;
                            console.log(`✅ Extracted Gemini response using selector: ${selector} (${responseText.length} chars)`);
                            break;
                        }
                    }
                }

                return { text: responseText, selector: usedSelector };
            };

            const checkIfComplete = () => {
                try {
                    // Check if stop button exists (response is still generating)
                    const stopButtonSelectors = [
                        'button[aria-label="Stop generating"]',
                        'button[aria-label*="Stop"]',
                        'button[aria-label*="stop"]',
                        'button.stop-button'
                    ];

                    let stopButton = null;
                    for (const selector of stopButtonSelectors) {
                        try {
                            stopButton = document.querySelector(selector);
                            if (stopButton && stopButton.offsetParent !== null) {
                                break;
                            } else {
                                stopButton = null;
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    if (stopButton) {
                        if (!responseStarted) {
                            responseStarted = true;
                            console.log('✅ Gemini response generation started (detected Stop button)');
                        }
                        return; // Still generating
                    }

                    // No stop button visible - response might be complete
                    // Try to extract the response
                    const { text, selector } = extractResponse();

                    // Validate response has meaningful content
                    const MIN_RESPONSE_LENGTH = 50;

                    if (text.trim().length > MIN_RESPONSE_LENGTH) {
                        // Check if this is a new message (not the user's prompt)
                        const messages = document.querySelectorAll(selector);
                        if (messages.length > lastMessageCount) {
                            // New message appeared!
                            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                            console.log(`✅ Gemini response complete in ${elapsed}s (${text.length} chars)`);

                            clearTimeout(timeoutId);
                            clearInterval(checkIntervalId);
                            observer.disconnect();
                            resolve(text);
                        } else if (responseStarted) {
                            // We saw it start and now stop button is gone
                            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                            console.log(`✅ Gemini response complete in ${elapsed}s (after generation, ${text.length} chars)`);

                            clearTimeout(timeoutId);
                            clearInterval(checkIntervalId);
                            observer.disconnect();
                            resolve(text);
                        }
                    } else if (text.trim().length > 0) {
                        // Response too short - probably placeholder text
                        console.log(`⏳ Response detected but too short (${text.length} chars), waiting for more...`);
                    }
                } catch (error) {
                    console.error('Error checking Gemini response completion:', error);
                }
            };

            // Count initial messages
            const initialMessages = document.querySelectorAll('[data-message-author-role="assistant"], .model-response-text, .message-content');
            lastMessageCount = initialMessages.length;
            console.log(`📊 Initial Gemini message count: ${lastMessageCount}`);

            // Set timeout
            timeoutId = setTimeout(() => {
                clearInterval(checkIntervalId);
                observer.disconnect();

                // Try one last time to extract response before timing out
                const { text } = extractResponse();
                if (text.trim().length > 0) {
                    console.warn('⚠️ Timeout reached but found Gemini response, using it');
                    resolve(text);
                } else {
                    console.error('❌ Response timeout after 2 minutes');
                    reject(new Error('Response timeout - Gemini took too long to respond'));
                }
            }, maxWaitTime);

            // Watch for DOM changes
            const observer = new MutationObserver(() => {
                checkIfComplete();
            });

            // Start observing
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true
            });

            // Also check periodically (every 1s) as a fallback
            checkIntervalId = setInterval(() => {
                console.log('🔄 Periodic check for Gemini response completion...');
                checkIfComplete();
            }, 1000);

            // Do an initial check after 500ms in case response already completed
            setTimeout(() => checkIfComplete(), 500);
        });
    }

    async waitForLovableUserSubmitAndResponse() {
        console.log('⏳ Waiting for user to submit prompt on Lovable...');

        // First, wait for user to press Enter (detect submission)
        await this.waitForLovableUserSubmission();

        console.log('✅ User submitted! Now waiting for Lovable response...');

        // Then wait for the response to complete
        return await this.waitForLovableResponse();
    }

    async waitForLovableUserSubmission() {
        // Wait until we detect that the user has submitted the prompt
        return new Promise((resolve, reject) => {
            const maxWaitTime = 300000; // 5 minutes max wait for user to press Enter
            const startTime = Date.now();
            let checkIntervalId;
            let observer;

            const checkIfUserSubmitted = () => {
                try {
                    // Check if stop/regenerate button exists (means user submitted and response is generating)
                    const stopButtonSelectors = [
                        'button[aria-label="Stop generating"]',
                        'button[aria-label*="Stop"]',
                        'button[aria-label*="stop"]',
                        'button.stop-button',
                        'button svg.icon-md' // Stop icon
                    ];

                    let stopButton = null;
                    for (const selector of stopButtonSelectors) {
                        try {
                            stopButton = document.querySelector(selector);
                            if (stopButton && stopButton.offsetParent !== null) {
                                console.log('✅ Detected user submission on Lovable (Stop button appeared)');
                                clearInterval(checkIntervalId);
                                if (observer) observer.disconnect();
                                resolve();
                                return;
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    // Check if textarea/input is empty (might indicate submission)
                    const inputField = document.querySelector('textarea[placeholder*="Message"], textarea[placeholder*="message"], textarea');
                    if (inputField && inputField.value && inputField.value.trim() === '') {
                        console.log('⏳ Input field cleared, confirming submission...');
                    }

                    // Timeout check
                    if (Date.now() - startTime > maxWaitTime) {
                        clearInterval(checkIntervalId);
                        if (observer) observer.disconnect();
                        reject(new Error('Timeout waiting for user to submit prompt on Lovable'));
                    }
                } catch (error) {
                    console.error('Error checking user submission on Lovable:', error);
                }
            };

            // Check every 300ms
            checkIntervalId = setInterval(checkIfUserSubmitted, 300);

            // Also use MutationObserver for immediate detection
            observer = new MutationObserver(() => {
                checkIfUserSubmitted();
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true
            });
        });
    }

    async waitForLovableResponse() {
        console.log('⏳ Waiting for Lovable response to complete...');

        // Give Lovable a moment to start responding
        await this.sleep(1000);

        return new Promise((resolve, reject) => {
            let timeoutId;
            let checkIntervalId;
            let responseStarted = false;
            let lastMessageCount = 0;
            const maxWaitTime = 120000; // 2 minutes max
            const startTime = Date.now();

            const extractResponse = () => {
                // Try multiple methods to extract the Lovable response text
                const messageSelectors = [
                    '[data-message-author-role="assistant"]',
                    '[data-role="assistant"]',
                    '.assistant-message',
                    '.message-content',
                    '.markdown.prose',
                    'article[class*="group"]',
                    '[class*="markdown"]',
                    '.response-message',
                    '.text-base',
                    '.bot-message'
                ];

                let responseText = '';
                let usedSelector = '';

                for (const selector of messageSelectors) {
                    const messages = document.querySelectorAll(selector);
                    if (messages.length > 0) {
                        const lastMessage = messages[messages.length - 1];
                        responseText = lastMessage.textContent || lastMessage.innerText || '';

                        if (responseText.trim().length > 0) {
                            usedSelector = selector;
                            console.log(`✅ Extracted Lovable response using selector: ${selector} (${responseText.length} chars)`);
                            break;
                        }
                    }
                }

                return { text: responseText, selector: usedSelector };
            };

            const checkIfComplete = () => {
                try {
                    // Check if stop button exists (response is still generating)
                    const stopButtonSelectors = [
                        'button[aria-label="Stop generating"]',
                        'button[aria-label*="Stop"]',
                        'button[aria-label*="stop"]',
                        'button.stop-button'
                    ];

                    let stopButton = null;
                    for (const selector of stopButtonSelectors) {
                        try {
                            stopButton = document.querySelector(selector);
                            if (stopButton && stopButton.offsetParent !== null) {
                                break;
                            } else {
                                stopButton = null;
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    if (stopButton) {
                        if (!responseStarted) {
                            responseStarted = true;
                            console.log('✅ Lovable response generation started (detected Stop button)');
                        }
                        return; // Still generating
                    }

                    // No stop button visible - response might be complete
                    // Try to extract the response
                    const { text, selector } = extractResponse();

                    // Validate response has meaningful content
                    const MIN_RESPONSE_LENGTH = 50;

                    if (text.trim().length > MIN_RESPONSE_LENGTH) {
                        // Check if this is a new message (not the user's prompt)
                        const messages = document.querySelectorAll(selector);
                        if (messages.length > lastMessageCount) {
                            // New message appeared!
                            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                            console.log(`✅ Lovable response complete in ${elapsed}s (${text.length} chars)`);

                            clearTimeout(timeoutId);
                            clearInterval(checkIntervalId);
                            observer.disconnect();
                            resolve(text);
                        } else if (responseStarted) {
                            // We saw it start and now stop button is gone
                            const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                            console.log(`✅ Lovable response complete in ${elapsed}s (after generation, ${text.length} chars)`);

                            clearTimeout(timeoutId);
                            clearInterval(checkIntervalId);
                            observer.disconnect();
                            resolve(text);
                        }
                    } else if (text.trim().length > 0) {
                        // Response too short - probably placeholder text
                        console.log(`⏳ Response detected but too short (${text.length} chars), waiting for more...`);
                    }
                } catch (error) {
                    console.error('Error checking Lovable response completion:', error);
                }
            };

            // Count initial messages
            const initialMessages = document.querySelectorAll('[data-message-author-role="assistant"], [data-role="assistant"], .assistant-message, .message-content');
            lastMessageCount = initialMessages.length;
            console.log(`📊 Initial Lovable message count: ${lastMessageCount}`);

            // Set timeout
            timeoutId = setTimeout(() => {
                clearInterval(checkIntervalId);
                observer.disconnect();

                // Try one last time to extract response before timing out
                const { text } = extractResponse();
                if (text.trim().length > 0) {
                    console.warn('⚠️ Timeout reached but found Lovable response, using it');
                    resolve(text);
                } else {
                    console.error('❌ Response timeout after 2 minutes');
                    reject(new Error('Response timeout - Lovable took too long to respond'));
                }
            }, maxWaitTime);

            // Watch for DOM changes
            const observer = new MutationObserver(() => {
                checkIfComplete();
            });

            // Start observing
            observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true
            });

            // Also check periodically (every 1s) as a fallback
            checkIntervalId = setInterval(() => {
                console.log('🔄 Periodic check for Lovable response completion...');
                checkIfComplete();
            }, 1000);

            // Do an initial check after 500ms in case response already completed
            setTimeout(() => checkIfComplete(), 500);
        });
    }

    async simulateResponse(prompt, stepIndex) {
        // Simulate AI response for testing
        console.log(`🎭 Simulating response for Step ${stepIndex + 1}...`);

        await this.sleep(2000 + Math.random() * 2000); // 2-4 seconds

        // Create a more realistic simulated response
        const step = this.workflow.steps[stepIndex];
        const isFirstStep = stepIndex === 0;

        let response = `✨ SIMULATION MODE - Step ${stepIndex + 1} of ${this.workflow.steps.length}\n\n`;

        response += `📝 Prompt: "${step.prompt}"\n\n`;
        response += `[This is a simulated response. On claude.ai, this would be an actual AI-generated response based on your prompt.]\n\n`;
        response += `Sample output for: "${step.prompt.substring(0, 50)}${step.prompt.length > 50 ? '...' : ''}"\n\n`;
        response += `✅ Step ${stepIndex + 1} completed successfully in simulation mode.`;

        console.log(`✅ Simulation complete for Step ${stepIndex + 1}`);
        return response;
    }

    updateProgress(current, total, currentStepName) {
        const percentage = Math.round((current / total) * 100);
        const progressBar = this.workflowContainer.querySelector('.progress-bar');
        const progressText = this.workflowContainer.querySelector('.progress-text');

        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }

        if (progressText) {
            const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(0);
            const estTotal = (elapsed / current) * total;
            const remaining = Math.max(0, estTotal - elapsed);

            progressText.innerHTML = `
                <span>Step ${current}/${total}: ${currentStepName.substring(0, 40)}${currentStepName.length > 40 ? '...' : ''}</span>
                <span>${percentage}% • ${remaining > 60 ? Math.round(remaining / 60) + 'm' : Math.round(remaining) + 's'} remaining</span>
            `;
        }
    }

    updateStepStatus(stepIndex, status, time = null) {
        const stepBubbles = this.workflowContainer.querySelectorAll('.workflow-step-bubble');
        const stepBubble = stepBubbles[stepIndex];

        if (!stepBubble) return;

        // Remove all status classes
        stepBubble.classList.remove('step-pending', 'step-running', 'step-completed', 'step-error', 'step-paused', 'step-skipped');

        // Add new status
        stepBubble.classList.add(`step-${status}`);

        // Update badge with status icon (using new .step-badge class)
        const badge = stepBubble.querySelector('.step-badge');

        if (status === 'running') {
            badge.innerHTML = `
                <svg width="12" height="12" viewBox="0 0 24 24" style="animation: spin 1s linear infinite;">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="60" stroke-dashoffset="20"/>
                </svg>
            `;
        } else if (status === 'completed') {
            badge.innerHTML = `✓`;

            // Add time indicator
            if (time) {
                let timeSpan = stepBubble.querySelector('.step-time');
                if (!timeSpan) {
                    timeSpan = document.createElement('div');
                    timeSpan.className = 'step-time';
                    stepBubble.appendChild(timeSpan);
                }
                timeSpan.textContent = `${time}s`;
            }
        } else if (status === 'error') {
            badge.innerHTML = `✕`;
        } else if (status === 'paused') {
            badge.innerHTML = `⏸`;
        } else if (status === 'pending') {
            badge.textContent = `S${stepIndex + 1}`;
        }
    }

    resetAllSteps() {
        const stepBubbles = this.workflowContainer.querySelectorAll('.workflow-step-bubble');

        stepBubbles.forEach((bubble, index) => {
            // Remove all status classes
            bubble.classList.remove('step-pending', 'step-running', 'step-completed', 'step-error', 'step-paused', 'step-skipped');

            // Set to pending
            bubble.classList.add('step-pending');

            // Reset badge to step number (using new .step-badge class)
            const badge = bubble.querySelector('.step-badge');
            if (badge) {
                badge.textContent = `S${index + 1}`;
                badge.innerHTML = badge.textContent; // Clear any SVG content
            }

            // Remove time indicators
            const timeSpan = bubble.querySelector('.step-time');
            if (timeSpan) {
                timeSpan.remove();
            }
        });

        // Reset progress bar
        const progressBar = this.workflowContainer.querySelector('.progress-bar');
        const progressText = this.workflowContainer.querySelector('.progress-text');

        if (progressBar) {
            progressBar.style.width = '0%';
            progressBar.style.background = '';
        }

        if (progressText) {
            progressText.innerHTML = '<span>Starting workflow...</span>';
        }

        console.log('🔄 All steps reset to pending state');
    }

    updateRunButton(state) {
        const runBtn = this.workflowContainer.querySelector('.run-all-btn');
        const pauseBtn = this.workflowContainer.querySelector('.pause-btn');
        const stopBtn = this.workflowContainer.querySelector('.stop-btn');

        if (state === 'running') {
            if (runBtn) {
                runBtn.disabled = true;
                runBtn.innerHTML = `
                    <svg width="10" height="10" viewBox="0 0 24 24" style="animation: spin 1s linear infinite; flex-shrink: 0; display: block;">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" fill="none" stroke-dasharray="60" stroke-dashoffset="20"/>
                    </svg>
                    <span style="display: block; line-height: 1 !important;">Running...</span>
                `;
            }
            if (pauseBtn) {
                // Reset pause button to default "Pause" state
                pauseBtn.innerHTML = `
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink: 0; display: block;">
                        <rect x="6" y="4" width="4" height="16"/>
                        <rect x="14" y="4" width="4" height="16"/>
                    </svg>
                    <span style="display: block; line-height: 1 !important;">Pause</span>
                `;
                pauseBtn.style.display = 'inline-flex';
                pauseBtn.style.background = '';
                pauseBtn.style.borderColor = '';
            }
            if (stopBtn) stopBtn.style.display = 'inline-flex';
        } else if (state === 'idle') {
            if (runBtn) {
                runBtn.disabled = false;
                runBtn.innerHTML = `
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink: 0; display: block;">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    <span style="display: block; line-height: 1 !important;">Run</span>
                `;
            }
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (stopBtn) stopBtn.style.display = 'none';
        } else if (state === 'completed') {
            if (runBtn) {
                runBtn.disabled = false;
                runBtn.innerHTML = `
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink: 0; display: block;">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span style="display: block; line-height: 1 !important;">Run Again</span>
                `;
                runBtn.style.background = 'rgba(0, 255, 0, 0.2)';
                runBtn.style.borderColor = 'rgba(0, 255, 0, 0.4)';
            }
            if (pauseBtn) pauseBtn.style.display = 'none';
            if (stopBtn) stopBtn.style.display = 'none';
        }
    }

    pause() {
        this.isPaused = true;

        // Show notification
        showNotification('⏸ Workflow Paused', 'info');

        // Update pause button to show resume
        const pauseBtn = this.workflowContainer.querySelector('.pause-btn');
        if (pauseBtn) {
            pauseBtn.innerHTML = `
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink: 0; display: block;">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <span style="display: block; line-height: 1 !important;">Resume</span>
            `;
            pauseBtn.style.background = 'rgba(255, 215, 0, 0.2)';
            pauseBtn.style.borderColor = 'rgba(255, 215, 0, 0.4)';
        }

        // Update progress bar to show paused state
        const progressBar = this.workflowContainer.querySelector('.progress-bar');
        const progressText = this.workflowContainer.querySelector('.progress-text');

        if (progressBar) {
            progressBar.style.background = 'rgba(255, 215, 0, 0.3)';
        }

        if (progressText) {
            const currentText = progressText.innerHTML;
            if (!currentText.includes('PAUSED')) {
                progressText.innerHTML = `
                    <span style="color: #FFD700; font-weight: bold; margin-right: 8px;">⏸ PAUSED</span>
                    ${currentText}
                `;
            }
        }

        console.log('⏸ Workflow paused at step', this.currentStepIndex + 1);
    }

    resume() {
        this.isPaused = false;

        // Show notification
        showNotification('▶ Workflow Resumed', 'info');

        // Reset pause button styling
        const pauseBtn = this.workflowContainer.querySelector('.pause-btn');
        if (pauseBtn) {
            pauseBtn.innerHTML = `
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink: 0; display: block;">
                    <rect x="6" y="4" width="4" height="16"/>
                    <rect x="14" y="4" width="4" height="16"/>
                </svg>
                <span style="display: block; line-height: 1 !important;">Pause</span>
            `;
            pauseBtn.style.background = '';
            pauseBtn.style.borderColor = '';
        }

        // Reset progress bar styling
        const progressBar = this.workflowContainer.querySelector('.progress-bar');
        const progressText = this.workflowContainer.querySelector('.progress-text');

        if (progressBar) {
            progressBar.style.background = '';
        }

        if (progressText) {
            // Remove "PAUSED" indicator from progress text
            const pausedSpan = progressText.querySelector('span[style*="color: #FFD700"]');
            if (pausedSpan) {
                pausedSpan.remove();
            }
        }

        console.log('▶ Workflow resumed from step', this.currentStepIndex + 1);
    }

    stop() {
        this.isRunning = false;
        this.isPaused = false;
        this.updateRunButton('idle');

        // Reset current step
        this.currentStepIndex = 0;

        // Reset all steps to pending state
        this.resetAllSteps();

        // Clear any pause styling
        const progressBar = this.workflowContainer.querySelector('.progress-bar');
        const progressText = this.workflowContainer.querySelector('.progress-text');

        if (progressBar) {
            progressBar.style.background = '';
        }

        if (progressText) {
            // Remove "PAUSED" indicator if present
            const pausedSpan = progressText.querySelector('span[style*="color: #FFD700"]');
            if (pausedSpan) {
                pausedSpan.remove();
            }
        }

        // Restore normal behavior
        isWorkflowExecuting = false;
        this.removeWorkflowInputListeners();

        console.log('⏹ Workflow stopped and reset');
    }

    complete() {
        this.isRunning = false;
        this.isPaused = false;
        this.updateRunButton('completed');

        // Reset step index for next run
        this.currentStepIndex = 0;

        const totalTime = ((Date.now() - this.startTime) / 1000).toFixed(1);

        // Show completion message
        const progressText = this.workflowContainer.querySelector('.progress-text');
        if (progressText) {
            progressText.innerHTML = `
                <span>✓ All ${this.workflow.steps.length} steps completed!</span>
                <span>Total time: ${totalTime}s</span>
            `;
        }

        // Show notification
        showNotification(`✅ Workflow "${this.workflow.title}" completed in ${totalTime}s`);

        // Restore normal behavior
        isWorkflowExecuting = false;
        this.removeWorkflowInputListeners();
    }

    handleError(error) {
        this.isRunning = false;
        this.updateRunButton('idle');

        showNotification(`❌ Workflow error: ${error.message}`, 'error');

        // Restore normal behavior
        isWorkflowExecuting = false;
        this.removeWorkflowInputListeners();
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    addWorkflowInputListeners() {
        // Store reference for removal later
        this.workflowFocusHandler = () => {
            // Placeholder for workflow focus handling
        };

        this.workflowBlurHandler = () => {
            // Placeholder for workflow blur handling
        };

        // We need to monitor all potential input fields
        document.addEventListener('focusin', this.workflowFocusHandler, true);
        document.addEventListener('focusout', this.workflowBlurHandler, true);
    }

    removeWorkflowInputListeners() {
        if (this.workflowFocusHandler) {
            document.removeEventListener('focusin', this.workflowFocusHandler, true);
        }
        if (this.workflowBlurHandler) {
            document.removeEventListener('focusout', this.workflowBlurHandler, true);
        }
        this.workflowFocusHandler = null;
        this.workflowBlurHandler = null;
    }
}

// ============================================================================

function displayWorkflowSteps(workflow) {
    // Clear everything and start fresh
    outputText.innerHTML = '';
    outputText.className = 'output-text'; // Reset to base class only
    
    // ✅ FIX: Disable scrolling on outputText itself
    outputText.style.overflowY = 'hidden';
    outputText.style.maxHeight = 'none';
    outputText.style.padding = '12px';
    
    // Create workflow container with consistent styling
    const workflowContainer = document.createElement('div');
    workflowContainer.className = 'workflow-container';
    workflowContainer.style.cssText = `
        padding: 0;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: 220px;
        overflow-y: auto;
        overflow-x: hidden;
    `;
    
    const isBuiltIn = workflow.source === 'built_in';

    // Create Workflow Execution Header
    const executionHeader = document.createElement('div');
    executionHeader.className = 'workflow-execution-header';
    executionHeader.innerHTML = `
        <div class="workflow-header-top">
            <div class="workflow-controls">
                <button class="run-all-btn">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink: 0; display: block;">
                        <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    <span style="display: block; line-height: 1 !important;">Run</span>
                </button>
                <button class="pause-btn" style="display: none;">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink: 0; display: block;">
                        <rect x="6" y="4" width="4" height="16"/>
                        <rect x="14" y="4" width="4" height="16"/>
                    </svg>
                    <span style="display: block; line-height: 1 !important;">Pause</span>
                </button>
                <button class="stop-btn" style="display: none;">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink: 0; display: block;">
                        <rect x="6" y="6" width="12" height="12"/>
                    </svg>
                    <span style="display: block; line-height: 1 !important;">Stop</span>
                </button>
            </div>
            <button class="workflow-close-btn" title="Close workflow">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink: 0; display: block;">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
            </button>
        </div>
        <div class="workflow-progress" style="display: none;">
            <div class="progress-text">
                <span>Ready to start</span>
                <span>0%</span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: 0%;"></div>
            </div>
        </div>
    `;

    // Create step bubbles
    workflow.steps.forEach(step => {
        const stepBubble = document.createElement('div');
        stepBubble.className = 'workflow-step-bubble';
        stepBubble.dataset.stepNumber = step.number;
        stepBubble.dataset.workflowId = workflow.id;
        stepBubble.dataset.stepPrompt = step.prompt; // Store full prompt

        // Badge container (holds step number and play icon)
        const badgeContainer = document.createElement('div');
        badgeContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            flex-shrink: 0;
        `;

        // Step number badge
        const badge = document.createElement('div');
        badge.className = 'step-badge';
        badge.style.cssText = `
            background: rgba(255, 215, 0, 0.15);
            color: rgba(255, 215, 0, 0.9);
            font-size: 10px;
            font-weight: 700;
            padding: 4px 8px;
            border-radius: 4px;
            min-width: 30px;
            text-align: center;
        `;
        badge.textContent = `S${step.number}`;

        // Play from this step icon
        const playFromStepIcon = document.createElement('button');
        playFromStepIcon.className = 'play-from-step-icon';
        playFromStepIcon.dataset.stepIndex = step.number - 1; // Zero-indexed
        playFromStepIcon.title = `Start workflow from Step ${step.number}`;
        playFromStepIcon.style.cssText = `
            background: transparent;
            border: none;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            padding: 0;
            transition: all 0.2s ease;
            color: rgba(255, 255, 255, 0.6);
        `;
        playFromStepIcon.innerHTML = `
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
        `;

        playFromStepIcon.addEventListener('mouseenter', () => {
            playFromStepIcon.style.color = 'rgba(255, 255, 255, 1)';
            playFromStepIcon.style.transform = 'scale(1.2)';
        });

        playFromStepIcon.addEventListener('mouseleave', () => {
            playFromStepIcon.style.color = 'rgba(255, 255, 255, 0.6)';
            playFromStepIcon.style.transform = 'scale(1)';
        });

        badgeContainer.appendChild(badge);
        badgeContainer.appendChild(playFromStepIcon);

        // Step content (truncated by CSS)
        const content = document.createElement('div');
        content.className = 'step-content';
        content.style.cssText = `
        flex: 1;
        color: rgba(255, 255, 255, 0.9);
        font-size: 12px;
        line-height: 1.5;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    `;
content.textContent = step.prompt;

        stepBubble.appendChild(badgeContainer);
        stepBubble.appendChild(content);
        
        // Edit button for user-created workflows
        // Edit button for user-created workflows
         // Edit and Delete buttons for user-created workflows
     if (!isBuiltIn) {
    // Make step bubble position relative for absolute positioning of buttons
    stepBubble.style.position = 'relative';
    stepBubble.style.paddingRight = '70px'; // Increased space for both buttons
    
    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-step-btn';
    deleteBtn.dataset.stepNumber = step.number;
    deleteBtn.style.cssText = `
    position: absolute;
    top: 50%;
    right: 10px;
    transform: translateY(-50%);
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.3);
    transition: all 0.2s ease;
    z-index: 2;
`;
    deleteBtn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M3 6h18"></path>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg>
    `;
    
    deleteBtn.addEventListener('mouseenter', () => {
        deleteBtn.style.color = 'rgba(255, 107, 107, 0.95)';
        deleteBtn.style.transform = 'translateY(-50%) scale(1.1)';
    });
    deleteBtn.addEventListener('mouseleave', () => {
        deleteBtn.style.color = 'rgba(255, 255, 255, 0.3)';
        deleteBtn.style.transform = 'translateY(-50%) scale(1)';
    });
    
    // Stop propagation on delete button
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Edit button (existing code - just update position)
    const editBtn = document.createElement('button');
    editBtn.className = 'edit-step-btn';
    editBtn.dataset.stepNumber = step.number;
    editBtn.style.cssText = `
    position: absolute;
    top: 50%;
    right: 40px;
    transform: translateY(-50%);
    background: none;
    border: none;
    padding: 4px;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.3);
    transition: all 0.2s ease;
    z-index: 2;
`;
    editBtn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
        </svg>
    `;
    
    editBtn.addEventListener('mouseenter', () => {
        editBtn.style.color = 'rgba(255, 215, 0, 0.95)';
        editBtn.style.transform = 'translateY(-50%) scale(1.1)';
    });
    editBtn.addEventListener('mouseleave', () => {
        editBtn.style.color = 'rgba(255, 255, 255, 0.3)';
        editBtn.style.transform = 'translateY(-50%) scale(1)';
    });
    
    // Stop propagation on edit button
    editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    stepBubble.appendChild(deleteBtn);
    stepBubble.appendChild(editBtn);
}
        
        // ✅ NEW: Click handler to view full content (like prompts)
        stepBubble.addEventListener('click', (e) => {
            // Don't trigger if clicking any interactive elements or while editing
            if (e.target.closest('.edit-step-btn')) return;
            if (e.target.closest('.delete-step-btn')) return;
            if (e.target.closest('.play-from-step-icon')) return;
            if (e.target.tagName === 'TEXTAREA') return;
            if (e.target.tagName === 'BUTTON') return;

            // Don't trigger if edit mode is active (textarea is present)
            const isEditing = stepBubble.querySelector('textarea');
            if (isEditing) return;

            // Show full content in output container
            outputText.innerHTML = '';
            outputText.className = 'output-text';
            outputText.style.overflowY = 'auto';
            outputText.style.maxHeight = '150px';
            outputText.style.padding = '12px';

            const fullContentView = document.createElement('div');
            fullContentView.style.cssText = `
                color: rgba(255, 255, 255, 0.9);
                font-size: 13px;
                line-height: 1.6;
                white-space: pre-wrap;
            `;
            fullContentView.textContent = `Step ${step.number}: ${step.prompt}`;

            outputText.appendChild(fullContentView);

            // Close gallery and show output
            closeAllSections();
        });

        // Add event listener for play-from-step icon
        playFromStepIcon.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent bubble click handler

            // Check if user is logged in before running workflow
            const isLoggedIn = await BackendAuth.isLoggedIn();
            if (!isLoggedIn) {
                // Force show container if hidden
                const wasHidden = button.style.display === 'none';
                if (wasHidden) {
                    button.style.display = 'block';
                }

                const buttonRect = button.getBoundingClientRect();
                solthronContainer.style.display = 'block';
                solthronContainer.style.pointerEvents = 'auto';
                positionContainer(buttonRect);

                if (wasHidden) {
                    button.style.display = 'none';
                }

                // Show error and open login view
                showError('Please login to run workflows');
                closeAllSections();
                const profileView = shadowRoot.getElementById('profile-view');
                const profileBtn = shadowRoot.getElementById('profile-btn');
                const outputContainer = shadowRoot.querySelector('.output-container');

                profileView.style.display = 'block';
                outputContainer.style.display = 'none';
                profileBtn.querySelector('svg').style.stroke = '#00ff00';

                return;
            }

            const stepIndex = parseInt(playFromStepIcon.dataset.stepIndex);

            // Reset executor state
            executor.currentStepIndex = stepIndex;
            executor.isPaused = false;
            executor.isRunning = false;

            // Reset all steps to pending
            executor.resetAllSteps();

            // Mark previous steps as skipped (with different visual)
            for (let i = 0; i < stepIndex; i++) {
                const stepBubbles = workflowContainer.querySelectorAll('.workflow-step-bubble');
                if (stepBubbles[i]) {
                    stepBubbles[i].classList.remove('step-pending');
                    stepBubbles[i].classList.add('step-skipped');
                    const badge = stepBubbles[i].querySelector('.step-badge');
                    if (badge) {
                        badge.innerHTML = '⊘';
                    }
                }
            }

            // Show progress bar
            const progressDiv = executionHeader.querySelector('.workflow-progress');
            progressDiv.style.display = 'flex';

            // Start execution
            executor.executeAll();
        });

        workflowContainer.appendChild(stepBubble);
    });
    
    // Add Variables button for built-in workflows with variables OR Clone button for others
    if (isBuiltIn) {
        const hasVariables = workflow.variables && workflow.variables.length > 0;
        const actionBtn = document.createElement('button');
        actionBtn.id = hasVariables ? 'add-variables-btn' : 'clone-workflow-btn';
        actionBtn.dataset.workflowId = workflow.id;
        actionBtn.style.cssText = `
            width: 100%;
            background: rgba(255, 215, 0, 0.08);
            border: 1px solid rgba(255, 215, 0, 0.25);
            color: rgba(255, 215, 0, 0.95);
            padding: 10px 14px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            margin-top: 8px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
        `;

        if (hasVariables) {
            actionBtn.innerHTML = `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                Add Variables
            `;

            // Click handler for Add Variables
            actionBtn.addEventListener('click', () => {
                showVariableInputForm(workflow);
            });
        } else {
            actionBtn.innerHTML = `
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Create Editable Copy
            `;
        }

        actionBtn.addEventListener('mouseenter', () => {
            actionBtn.style.background = 'rgba(255, 215, 0, 0.12)';
            actionBtn.style.borderColor = 'rgba(255, 215, 0, 0.35)';
            actionBtn.style.transform = 'translateY(-1px)';
        });
        actionBtn.addEventListener('mouseleave', () => {
            actionBtn.style.background = 'rgba(255, 215, 0, 0.08)';
            actionBtn.style.borderColor = 'rgba(255, 215, 0, 0.25)';
            actionBtn.style.transform = 'translateY(0)';
        });

        workflowContainer.appendChild(actionBtn);
    }

    // Add New Step button for user-created workflows
    
    // Add the workflow container to outputText
// Add "Add Step" button INSIDE the workflow container for user-created workflows
    if (!isBuiltIn) {
    const addStepBtn = document.createElement('button');
    addStepBtn.id = 'add-step-btn';
    addStepBtn.dataset.workflowId = workflow.id;
    addStepBtn.style.cssText = `
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: rgba(255, 255, 255, 0.8);
        padding: 6px 10px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 10px !important;
        font-weight: 500;
        margin-top: 6px;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        align-self: flex-start;
        width: auto;
        flex-shrink: 0;
        line-height: 1 !important;
        height: 22px;
    `;
    addStepBtn.innerHTML = `
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink: 0; display: block;">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        <span style="display: block; line-height: 1 !important;">Add Step</span>
    `;
    
    addStepBtn.addEventListener('mouseenter', () => {
        addStepBtn.style.background = 'rgba(255, 255, 255, 0.1)';
        addStepBtn.style.borderColor = 'rgba(255, 255, 255, 0.3)';
    });
    addStepBtn.addEventListener('mouseleave', () => {
        addStepBtn.style.background = 'rgba(255, 255, 255, 0.05)';
        addStepBtn.style.borderColor = 'rgba(255, 255, 255, 0.2)';
    });
    
    workflowContainer.appendChild(addStepBtn);
}

// Add the workflow container to outputText
// First, add the execution header
outputText.appendChild(executionHeader);
// Then add the workflow container
outputText.appendChild(workflowContainer);

// Initialize Workflow Executor
const executor = new WorkflowExecutor(workflow, outputText);

// Attach execution control event listeners
const runAllBtn = executionHeader.querySelector('.run-all-btn');
const pauseBtn = executionHeader.querySelector('.pause-btn');
const stopBtn = executionHeader.querySelector('.stop-btn');
const closeBtn = executionHeader.querySelector('.workflow-close-btn');
const progressDiv = executionHeader.querySelector('.workflow-progress');

runAllBtn.addEventListener('click', async () => {
    // Check if user is logged in before running workflow
    const isLoggedIn = await BackendAuth.isLoggedIn();
    if (!isLoggedIn) {
        // Force show container if hidden
        const wasHidden = button.style.display === 'none';
        if (wasHidden) {
            button.style.display = 'block';
        }

        const buttonRect = button.getBoundingClientRect();
        solthronContainer.style.display = 'block';
        solthronContainer.style.pointerEvents = 'auto';
        positionContainer(buttonRect);

        if (wasHidden) {
            button.style.display = 'none';
        }

        // Show error and open login view
        showError('Please login to run workflows');
        closeAllSections();
        const profileView = shadowRoot.getElementById('profile-view');
        const profileBtn = shadowRoot.getElementById('profile-btn');
        const outputContainer = shadowRoot.querySelector('.output-container');

        profileView.style.display = 'block';
        outputContainer.style.display = 'none';
        profileBtn.querySelector('svg').style.stroke = '#00ff00';

        return;
    }

    // Show progress bar
    progressDiv.style.display = 'flex';

    // Start execution
    await executor.executeAll();
});

pauseBtn.addEventListener('click', () => {
    if (executor.isPaused) {
        executor.resume();
    } else {
        executor.pause();
    }
});

stopBtn.addEventListener('click', () => {
    executor.stop();
    progressDiv.style.display = 'none';
});

closeBtn.addEventListener('click', () => {
    // Close workflow and return to gallery
    const galleryView = shadowRoot.getElementById('gallery-view');
    const outputContainer = shadowRoot.querySelector('.output-container');
    const galleryBtn = shadowRoot.getElementById('gallery-btn');

    // Clear output and show gallery
    outputText.innerHTML = '';
    outputText.className = 'output-text';
    outputText.style.overflowY = 'auto';
    outputText.style.maxHeight = '150px';

    // Show gallery view
    galleryView.style.display = 'block';
    outputContainer.style.display = 'none';
    galleryBtn.querySelector('svg').style.stroke = '#00ff00';
});

// Attach event listeners
if (!isBuiltIn) {
    attachStepEditListeners(workflow);
    attachStepDeleteListeners(workflow);
    attachAddStepButtonListener(workflow);
} else {
    attachCloneButtonListener(workflow);
}
}

// ========== VARIABLE INPUT FORM ==========
function showVariableInputForm(workflow) {
    const outputText = shadowRoot.getElementById('output-text');

    // Clear output and create variable form container
    outputText.innerHTML = '';
    outputText.className = 'output-text';

    // ✅ Same pattern as workflow steps: disable scroll on outer container
    outputText.style.overflowY = 'hidden';
    outputText.style.maxHeight = 'none';
    outputText.style.padding = '12px';

    // ✅ Create inner scrollable container (accounting for header ~60px in 400px total)
    const scrollableContainer = document.createElement('div');
    scrollableContainer.style.cssText = `
        max-height: 280px;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0;
    `;

    const formContainer = document.createElement('div');
    formContainer.id = 'variable-form-container';
    formContainer.style.cssText = `
        padding: 20px;
        max-width: 500px;
        margin: 0 auto;
        box-sizing: border-box;
    `;

    // Form title
    const title = document.createElement('h3');
    title.textContent = 'Add Variables';
    title.style.cssText = `
        color: rgba(255, 255, 255, 0.95);
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 20px;
        text-align: center;
    `;
    formContainer.appendChild(title);

    // Subtitle
    const subtitle = document.createElement('p');
    subtitle.textContent = `Fill in the variables for: ${workflow.title}`;
    subtitle.style.cssText = `
        color: rgba(255, 255, 255, 0.6);
        font-size: 13px;
        margin-bottom: 24px;
        text-align: center;
    `;
    formContainer.appendChild(subtitle);

    // Create input fields for each variable
    const variableValues = {};

    workflow.variables.forEach(variable => {
        const fieldGroup = document.createElement('div');
        fieldGroup.style.cssText = `
            margin-bottom: 20px;
        `;

        const label = document.createElement('label');
        label.textContent = variable.label + ':';
        label.style.cssText = `
            display: block;
            color: rgba(255, 255, 255, 0.8);
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 8px;
        `;
        fieldGroup.appendChild(label);

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = variable.placeholder;
        input.dataset.variableName = variable.name;
        input.style.cssText = `
            width: 100%;
            padding: 10px 12px;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 6px;
            color: rgba(255, 255, 255, 0.95);
            font-size: 13px;
            font-family: inherit;
            outline: none;
            transition: all 0.2s ease;
            box-sizing: border-box;
        `;

        input.addEventListener('focus', () => {
            input.style.borderColor = 'rgba(255, 215, 0, 0.5)';
            input.style.background = 'rgba(255, 255, 255, 0.08)';
        });

        input.addEventListener('blur', () => {
            input.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            input.style.background = 'rgba(255, 255, 255, 0.05)';
        });

        fieldGroup.appendChild(input);
        formContainer.appendChild(fieldGroup);
    });

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 12px;
        margin-top: 30px;
        justify-content: center;
    `;

    // Cancel button
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
        padding: 10px 24px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        color: rgba(255, 255, 255, 0.8);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    `;

    cancelBtn.addEventListener('mouseenter', () => {
        cancelBtn.style.background = 'rgba(255, 255, 255, 0.08)';
    });
    cancelBtn.addEventListener('mouseleave', () => {
        cancelBtn.style.background = 'rgba(255, 255, 255, 0.05)';
    });

    cancelBtn.addEventListener('click', () => {
        // Go back to workflow view
        displayWorkflowSteps(workflow);
    });

    buttonContainer.appendChild(cancelBtn);

    // Save button
    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.style.cssText = `
        padding: 10px 24px;
        background: rgba(255, 215, 0, 0.1);
        border: 1px solid rgba(255, 215, 0, 0.3);
        border-radius: 6px;
        color: rgba(255, 215, 0, 0.95);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    `;

    saveBtn.addEventListener('mouseenter', () => {
        saveBtn.style.background = 'rgba(255, 215, 0, 0.15)';
    });
    saveBtn.addEventListener('mouseleave', () => {
        saveBtn.style.background = 'rgba(255, 215, 0, 0.1)';
    });

    saveBtn.addEventListener('click', () => {
        // Collect variable values
        const inputs = formContainer.querySelectorAll('input[data-variable-name]');
        let allFilled = true;

        inputs.forEach(input => {
            const value = input.value.trim();
            if (!value) {
                allFilled = false;
                input.style.borderColor = 'rgba(255, 0, 0, 0.5)';
            } else {
                variableValues[input.dataset.variableName] = value;
                input.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }
        });

        if (!allFilled) {
            showNotification('Please fill in all variables', 'error');
            return;
        }

        // Show inline confirmation
        showInlineConfirmation(formContainer, workflow, variableValues);
    });

    buttonContainer.appendChild(saveBtn);
    formContainer.appendChild(buttonContainer);

    // ✅ Nest containers: formContainer → scrollableContainer → outputText
    scrollableContainer.appendChild(formContainer);
    outputText.appendChild(scrollableContainer);
}

// ========== INLINE SAVE CONFIRMATION ==========
function showInlineConfirmation(formContainer, workflow, variableValues) {
    // Hide all form content (h3, p, div - everything except confirmation section)
    Array.from(formContainer.children).forEach(child => {
        if (child.id !== 'save-confirmation-section') {
            child.style.display = 'none';
        }
    });

    // Create confirmation section
    const confirmSection = document.createElement('div');
    confirmSection.id = 'save-confirmation-section';
    confirmSection.style.cssText = `
        text-align: center;
        padding: 20px;
    `;

    // Title
    const title = document.createElement('h3');
    title.textContent = 'Save to Custom Templates?';
    title.style.cssText = `
        color: rgba(255, 255, 255, 0.95);
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 12px;
    `;
    confirmSection.appendChild(title);

    // Description
    const description = document.createElement('p');
    description.textContent = 'Would you like to save this workflow with your variable values to your custom templates?';
    description.style.cssText = `
        color: rgba(255, 255, 255, 0.7);
        font-size: 13px;
        margin-bottom: 24px;
        line-height: 1.5;
    `;
    confirmSection.appendChild(description);

    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
        display: flex;
        gap: 12px;
        justify-content: center;
    `;

    // No button
    const noBtn = document.createElement('button');
    noBtn.textContent = 'No';
    noBtn.style.cssText = `
        padding: 10px 24px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 6px;
        color: rgba(255, 255, 255, 0.8);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    `;

    noBtn.addEventListener('mouseenter', () => {
        noBtn.style.background = 'rgba(255, 255, 255, 0.08)';
    });
    noBtn.addEventListener('mouseleave', () => {
        noBtn.style.background = 'rgba(255, 255, 255, 0.05)';
    });

    noBtn.addEventListener('click', () => {
        // Create workflow with replaced variables (but don't save)
        const workflowWithValues = replaceVariablesInWorkflow(workflow, variableValues);

        // Show workflow execution view
        displayWorkflowSteps(workflowWithValues);
    });

    buttonContainer.appendChild(noBtn);

    // Yes button
    const yesBtn = document.createElement('button');
    yesBtn.textContent = 'Yes';
    yesBtn.style.cssText = `
        padding: 10px 24px;
        background: rgba(255, 215, 0, 0.1);
        border: 1px solid rgba(255, 215, 0, 0.3);
        border-radius: 6px;
        color: rgba(255, 215, 0, 0.95);
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    `;

    yesBtn.addEventListener('mouseenter', () => {
        yesBtn.style.background = 'rgba(255, 215, 0, 0.15)';
    });
    yesBtn.addEventListener('mouseleave', () => {
        yesBtn.style.background = 'rgba(255, 215, 0, 0.1)';
    });

    yesBtn.addEventListener('click', async () => {
        // Create workflow with replaced variables
        const workflowWithValues = replaceVariablesInWorkflow(workflow, variableValues);

        // Save to custom templates
        await saveWorkflowToCustom(workflowWithValues);

        // Show success notification
        showNotification('Workflow saved to Custom templates!', 'success');

        // Show workflow execution view
        displayWorkflowSteps(workflowWithValues);
    });

    buttonContainer.appendChild(yesBtn);
    confirmSection.appendChild(buttonContainer);
    formContainer.appendChild(confirmSection);
}

// ========== REPLACE VARIABLES IN WORKFLOW ==========
function replaceVariablesInWorkflow(workflow, variableValues) {
    // Create a deep copy of the workflow
    const workflowCopy = JSON.parse(JSON.stringify(workflow));

    // Replace variables in each step's prompt
    workflowCopy.steps = workflowCopy.steps.map(step => {
        let prompt = step.prompt;

        // Replace each variable with its value
        Object.keys(variableValues).forEach(varName => {
            const regex = new RegExp(`\\{${varName}\\}`, 'g');
            prompt = prompt.replace(regex, variableValues[varName]);
        });

        return {
            ...step,
            prompt: prompt
        };
    });

    // Remove variables array and update metadata
    delete workflowCopy.variables;
    workflowCopy.source = 'custom'; // Mark as custom
    workflowCopy.id = `workflow-custom-${Date.now()}`; // Generate new ID
    workflowCopy.timestamp = new Date().toISOString();

    // Update title to indicate it's a custom version
    const originalTitle = workflow.title.replace(' Workflow', '');
    workflowCopy.title = `${originalTitle} (Custom)`;
    workflowCopy.name = workflowCopy.title;

    return workflowCopy;
}

// ========== SAVE WORKFLOW TO CUSTOM ==========
async function saveWorkflowToCustom(workflow) {
    try {
        const data = await chrome.storage.local.get('workflows');
        const workflows = data.workflows || [];

        // Add the new workflow
        workflows.push(workflow);

        // Save to storage
        await chrome.storage.local.set({ workflows });

        return true;
    } catch (error) {
        console.error('Error saving workflow to custom:', error);
        showNotification('Failed to save workflow', 'error');
        return false;
    }
}

function attachStepEditListeners(workflow) {
    shadowRoot.querySelectorAll('.edit-step-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            const stepNumber = parseInt(btn.dataset.stepNumber);
            const bubble = btn.closest('.workflow-step-bubble');
            const contentDiv = bubble.querySelector('.step-content');
            const currentPrompt = bubble.dataset.stepPrompt; // Get full prompt from data attribute
            
            // Create input field with full content
            const input = document.createElement('textarea');
            input.value = currentPrompt;
            input.style.cssText = `
                width: 100%;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 215, 0, 0.5);
                border-radius: 4px;
                padding: 6px 8px;
                color: white;
                font-size: 12px;
                font-family: inherit;
                outline: none;
                resize: vertical;
                min-height: 60px;
                max-height: 150px;
                line-height: 1.4;
                overflow-y: auto;
            `;
            
            // Prevent event propagation (but allow keyboard shortcuts)
            input.addEventListener('keydown', (e) => {
                if (!e.altKey && !e.ctrlKey && !e.metaKey) {
                    e.stopPropagation();
                }
            }, true);
            input.addEventListener('keypress', (e) => {
                if (!e.altKey && !e.ctrlKey && !e.metaKey) {
                    e.stopPropagation();
                }
            }, true);
            input.addEventListener('keyup', (e) => {
                if (!e.altKey && !e.ctrlKey && !e.metaKey) {
                    e.stopPropagation();
                }
            }, true);
            input.addEventListener('input', (e) => e.stopPropagation(), true);
            
            // Create save button
            const saveBtn = document.createElement('button');
            saveBtn.innerHTML = '✓ Save';
            saveBtn.style.cssText = `
                background: rgba(0, 255, 0, 0.2);
                border: 1px solid rgba(0, 255, 0, 0.4);
                color: #00ff00;
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                font-weight: 600;
                margin-top: 6px;
                transition: all 0.2s ease;
            `;
            
            saveBtn.addEventListener('mouseenter', () => {
                saveBtn.style.background = 'rgba(0, 255, 0, 0.3)';
                saveBtn.style.transform = 'scale(1.05)';
            });
            
            saveBtn.addEventListener('mouseleave', () => {
                saveBtn.style.background = 'rgba(0, 255, 0, 0.2)';
                saveBtn.style.transform = 'scale(1)';
            });
            
            // Create cancel button
            const cancelBtn = document.createElement('button');
            cancelBtn.innerHTML = '✕ Cancel';
            cancelBtn.style.cssText = `
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: rgba(255, 255, 255, 0.7);
                padding: 4px 12px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
                margin-top: 6px;
                margin-left: 6px;
                transition: all 0.2s ease;
            `;
            
            cancelBtn.addEventListener('mouseenter', () => {
                cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
            });
            
            cancelBtn.addEventListener('mouseleave', () => {
                cancelBtn.style.background = 'rgba(255, 255, 255, 0.05)';
            });
            
            const buttonWrapper = document.createElement('div');
            buttonWrapper.appendChild(saveBtn);
            buttonWrapper.appendChild(cancelBtn);
            
            // Store original for restoration
            const originalText = contentDiv.textContent;
            
            // Replace content
            contentDiv.style.overflow = 'visible';
            contentDiv.style.webkitLineClamp = 'unset';
            contentDiv.style.display = 'block';
            contentDiv.innerHTML = '';
            contentDiv.appendChild(input);
            contentDiv.appendChild(buttonWrapper);
            
            // Hide edit button
            btn.style.display = 'none';
            
            input.focus();
            
            // Save function
            const saveEdit = async () => {
                const newPrompt = input.value.trim();
                
                if (newPrompt && newPrompt !== currentPrompt) {
                    // Update workflow in storage
                    const data = await chrome.storage.local.get('workflows');
                    const workflows = data.workflows || [];
                    const workflowIndex = workflows.findIndex(w => w.id === workflow.id);
                    
                    if (workflowIndex !== -1) {
                        const stepIndex = workflows[workflowIndex].steps.findIndex(s => s.number === stepNumber);
                        if (stepIndex !== -1) {
                            workflows[workflowIndex].steps[stepIndex].prompt = newPrompt;
                            workflows[workflowIndex].timestamp = new Date().toISOString();
                            
                            await chrome.storage.local.set({ workflows });
                            
                            // Update display and data attribute
                            // Update display and data attribute
                            bubble.dataset.stepPrompt = newPrompt;

                            // Clear content first
                            contentDiv.innerHTML = '';
                            contentDiv.textContent = '';

                            // Reset all inline styles
                            contentDiv.style.cssText = '';

                           // Apply truncation styles
                           contentDiv.className = 'step-content';
                           contentDiv.style.cssText = `
                           flex: 1;
                           color: rgba(255, 255, 255, 0.9);
                           font-size: 12px;
                           line-height: 1.5;
                           overflow: hidden;
                           text-overflow: ellipsis;
                           display: -webkit-box;
                           -webkit-line-clamp: 2;
                           -webkit-box-orient: vertical;
                        `;

                            // Set the new text
                            contentDiv.textContent = newPrompt;

                            // Show edit button again
                            btn.style.display = 'block';
                            
                            // Show success feedback
                            bubble.style.background = 'rgba(0, 255, 0, 0.1)';
                            bubble.style.borderColor = 'rgba(0, 255, 0, 0.3)';
                            setTimeout(() => {
                                bubble.style.background = 'rgba(255, 255, 255, 0.03)';
                                bubble.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                            }, 1000);
                            
                            console.log('✅ Step updated successfully');
                        }
                    }
                } else {
                    contentDiv.style.overflow = 'hidden';
                    contentDiv.style.display = '-webkit-box';
                    contentDiv.textContent = originalText;
                    btn.style.display = 'block';
                }
            };
            
            const cancelEdit = () => {
    contentDiv.style.cssText = `
        flex: 1;
        color: rgba(255, 255, 255, 0.9);
        font-size: 12px;
        line-height: 1.5;
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    `;
    contentDiv.textContent = originalText;
    btn.style.display = 'block';
};
            
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                saveEdit();
            });
            
            cancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                cancelEdit();
            });
            
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    cancelEdit();
                }
            });
        });
    });
}

function attachStepDeleteListeners(workflow) {
    shadowRoot.querySelectorAll('.delete-step-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            
            const stepNumber = parseInt(btn.dataset.stepNumber);
            
            // Confirm deletion
            const bubble = btn.closest('.workflow-step-bubble');
            const stepContent = bubble.dataset.stepPrompt;
            
            // Visual confirmation (optional - you can add a confirm dialog instead)
            bubble.style.background = 'rgba(255, 107, 107, 0.2)';
            bubble.style.borderColor = 'rgba(255, 107, 107, 0.4)';
            
            // Short delay for visual feedback
            await new Promise(resolve => setTimeout(resolve, 200));
            
            try {
                // Load workflow from storage
                const data = await chrome.storage.local.get('workflows');
                const workflows = data.workflows || [];
                const workflowIndex = workflows.findIndex(w => w.id === workflow.id);
                
                if (workflowIndex !== -1) {
                    // Remove the step
                    const stepIndex = workflows[workflowIndex].steps.findIndex(s => s.number === stepNumber);
                    
                    if (stepIndex !== -1) {
                        workflows[workflowIndex].steps.splice(stepIndex, 1);
                        
                        // Re-number remaining steps
                        workflows[workflowIndex].steps.forEach((step, idx) => {
                            step.number = idx + 1;
                        });
                        
                        workflows[workflowIndex].timestamp = new Date().toISOString();
                        
                        // Save to storage
                        await chrome.storage.local.set({ workflows });
                        
                        console.log('✅ Step deleted successfully');
                        
                        // Reload workflow display
                        displayWorkflowSteps(workflows[workflowIndex]);
                        
                        // Show success notification
                        showNotification('Step deleted', 'success');
                    }
                }
            } catch (error) {
                console.error('❌ Error deleting step:', error);
                showNotification('Failed to delete step', 'error');
                
                // Reset visual state on error
                bubble.style.background = 'rgba(255, 255, 255, 0.03)';
                bubble.style.borderColor = 'rgba(255, 255, 255, 0.12)';
            }
        });
    });
}

function attachCloneButtonListener(workflow) {
    const cloneBtn = shadowRoot.getElementById('clone-workflow-btn');
    if (!cloneBtn) return;
    
    cloneBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        // Show loading state
        const originalHTML = cloneBtn.innerHTML;
        cloneBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                <path d="M21 12a9 9 0 11-6.219-8.56"></path>
            </svg>
            Creating copy...
        `;
        cloneBtn.disabled = true;
        
        // Create cloned workflow
        const clonedWorkflow = {
            id: `workflow-${Date.now()}`,
            name: workflow.name + 'Copy',
            title: workflow.title + ' (My Copy)',
            steps: workflow.steps.map(step => ({ ...step })), // Deep copy steps
            timestamp: new Date().toISOString(),
            source: 'user_created'
        };
        
        try {
            // Save to storage
            const data = await chrome.storage.local.get('workflows');
            const workflows = data.workflows || [];
            workflows.push(clonedWorkflow);
            await chrome.storage.local.set({ workflows });
            
            console.log('✅ Workflow cloned:', clonedWorkflow.title);
            
            // Show success message
            cloneBtn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                Created! Opening...
            `;
            cloneBtn.style.background = 'rgba(0, 255, 0, 0.2)';
            cloneBtn.style.borderColor = 'rgba(0, 255, 0, 0.4)';
            cloneBtn.style.color = '#00ff00';
            
            // Wait a moment, then display the cloned workflow
            setTimeout(() => {
                displayWorkflowSteps(clonedWorkflow);
                
                // Refresh gallery if it's open
                if (shadowRoot.getElementById('gallery-view').style.display === 'block') {
                    loadWorkflows().then(workflows => {
                        const galleryList = shadowRoot.getElementById('gallery-list');
                        if (galleryList && currentCategory === 'workflows') {
                            renderGalleryList(workflows, shadowRoot.getElementById('gallery-search').value);
                        }
                    });
                }
            }, 1000);
            
        } catch (error) {
            console.error('❌ Error cloning workflow:', error);
            cloneBtn.innerHTML = originalHTML;
            cloneBtn.disabled = false;
            showNotification('Failed to create copy', 'error');
        }
    });
}

function attachAddStepButtonListener(workflow) {
    const addStepBtn = shadowRoot.getElementById('add-step-btn');
    if (!addStepBtn) return;
    
    addStepBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        // Show loading state
        const originalHTML = addStepBtn.innerHTML;
        addStepBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                <path d="M21 12a9 9 0 11-6.219-8.56"></path>
            </svg>
            Adding step...
        `;
        addStepBtn.disabled = true;
        
        try {
            // Load workflow from storage
            const data = await chrome.storage.local.get('workflows');
            const workflows = data.workflows || [];
            const workflowIndex = workflows.findIndex(w => w.id === workflow.id);
            
            if (workflowIndex !== -1) {
                // Create new step
                const newStepNumber = workflows[workflowIndex].steps.length + 1;
                const newStep = {
                    number: newStepNumber,
                    prompt: `Step ${newStepNumber} prompt`
                };
                
                // Add to workflow
                workflows[workflowIndex].steps.push(newStep);
                workflows[workflowIndex].timestamp = new Date().toISOString();
                
                // Save to storage
                await chrome.storage.local.set({ workflows });
                
                console.log('✅ New step added successfully');
                
                // Show success message
                addStepBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Step added!
                `;
                addStepBtn.style.background = 'rgba(0, 255, 0, 0.2)';
                addStepBtn.style.borderColor = 'rgba(0, 255, 0, 0.4)';
                
                // Reload workflow display after a moment
                setTimeout(() => {
                    displayWorkflowSteps(workflows[workflowIndex]);
                }, 800);
                
            } else {
                throw new Error('Workflow not found');
            }
            
        } catch (error) {
            console.error('❌ Error adding step:', error);
            addStepBtn.innerHTML = originalHTML;
            addStepBtn.disabled = false;
            showNotification('Failed to add step', 'error');
        }
    });
}

function positionContainer(buttonRect) {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    
    solthronContainer.style.width = '320px';
    solthronContainer.style.maxHeight = '400px';
    
    let leftPosition = buttonRect.right - 320;
    let topPosition = buttonRect.top - 10;
    
    if (leftPosition < 10) {
        leftPosition = 10;
    } else if (leftPosition + 320 > windowWidth - 10) {
        leftPosition = windowWidth - 330;
    }
    
    const containerHeight = 400;
    if (topPosition + containerHeight > windowHeight - 10) {
        topPosition = windowHeight - containerHeight - 10;
    }
    
    if (topPosition < 10) {
        topPosition = 10;
    }
    
    solthronContainer.style.position = 'fixed';
    solthronContainer.style.left = `${leftPosition}px`;
    solthronContainer.style.top = `${topPosition}px`;
    solthronContainer.style.zIndex = '10001';
    
    solthronContainer.style.transform = 'none';
    solthronContainer.style.opacity = '0';
    
    solthronContainer.style.transition = 'opacity 0.2s ease';
    
    requestAnimationFrame(() => {
        solthronContainer.style.opacity = '1';
    });
}

function initializeUIHandlers() {
    let isDragging = false;
    let currentX;
    let currentY;
    let lastResult = localStorage.getItem('solthron-last-result');

    const copyBtn = shadowRoot.querySelector('#copy-btn');
    const closeBtn = shadowRoot.querySelector('#close-btn');
    const modeSelect = shadowRoot.querySelector('.mode-select');

    selectedMode = localStorage.getItem('solthron-mode') || 'select_mode';
    modeSelect.value = selectedMode;
    solthronContainer.style.display = 'none';
    solthronContainer.style.pointerEvents = 'none';

    if (lastResult) {
        outputText.classList.remove('placeholder');
        outputText.textContent = lastResult;
    }

    button.addEventListener('mousedown', (e) => {
        isDragging = true;
        currentX = e.clientX - button.offsetLeft;
        currentY = e.clientY - button.offsetTop;
    });

    document.addEventListener('mousemove', (e) => {
        if (isDragging) {
            e.preventDefault();
            button.style.left = `${e.clientX - currentX}px`;
            button.style.top = `${e.clientY - currentY}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    button.addEventListener('click', async (e) => {
    e.stopPropagation();
    
    if (!isDragging) {
        triggerDoubleClickAnimation();
        
        const selectedText = window.getSelection().toString().trim();

        if (!selectedText || selectedMode === 'image' || selectedMode === 'smart_followups' || selectedMode === 'smart_actions') {
            if (lastResult && selectedMode !== 'smart_followups' && selectedMode !== 'smart_actions' && selectedMode !== 'smart_enhancements') {
                outputText.classList.remove('placeholder');
                outputText.textContent = lastResult;
            } else {
                outputText.classList.add('placeholder');

                const placeholderMessages = {
                    image_prompt: 'Right-click an image to generate a prompt...',
                    smart_followups: 'Right-click on an AI chat page to generate follow-up questions...',
                    default: 'Highlight text to begin...'
                };    
                outputText.textContent = placeholderMessages[selectedMode] || placeholderMessages.default;
            }
            const buttonRect = button.getBoundingClientRect();
            solthronContainer.style.display = 'block';
            solthronContainer.style.pointerEvents = 'auto';
            positionContainer(buttonRect);
            return;
        }
        
        await processSelectedText(selectedText);
    }
});

    modeSelect.addEventListener('change', (e) => {
    selectedMode = e.target.value;
    localStorage.setItem('solthron-mode', selectedMode);
    
    // Track if a right-click feature was selected
    const isRightClickMode = selectedMode === 'image_prompt' || selectedMode === 'smart_followups';
    
    if (isRightClickMode) {
        rightClickFeaturesEnabled = true;
        lastSelectedRightClickMode = selectedMode;
    } else {
        // Non-right-click modes disable right-click features
        rightClickFeaturesEnabled = false;
        lastSelectedRightClickMode = null;
    }
    
    outputText.classList.add('placeholder');

    const placeholderMessages = {
        image_prompt: 'Right-click an image to generate a prompt...',
        smart_followups: 'Right-click on an AI chat page to generate follow-up questions...',
        default: 'Highlight text to begin...'
    };
    
        outputText.textContent = placeholderMessages[selectedMode] || placeholderMessages.default;
        lastResult = null;
        localStorage.removeItem('solthron-last-result');
    });

    copyBtn.addEventListener('click', async () => {
        if (outputText.classList.contains('placeholder')) return;
        
        try {
            if (selectedMode === 'smart_followups' && outputText.querySelector('.smart-followups-container')) {
                const questions = Array.from(outputText.querySelectorAll('.followup-question'))
                    .map(q => q.textContent)
                    .join('\n\n');
                await navigator.clipboard.writeText(questions);
            } else if (selectedMode === 'smart_actions' && outputText.querySelector('.smart-actions-container')) {
                const prompts = Array.from(outputText.querySelectorAll('.action-prompt'))
                    .map((prompt, index) => `${index + 1}. ${prompt.textContent}`)
                    .join('\n\n');
                await navigator.clipboard.writeText(prompts);
            } else {
                await navigator.clipboard.writeText(outputText.textContent);
            }
            
            const checkIcon = copyBtn.querySelector('svg');
            checkIcon.style.stroke = '#00ff00';
            copyBtn.classList.add('copied');
            
            setTimeout(() => {
                solthronContainer.style.display = 'none';
                solthronContainer.style.pointerEvents = 'none';
                checkIcon.style.stroke = 'currentColor';
                copyBtn.classList.remove('copied');
            }, 1000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    });

    closeBtn.addEventListener('click', () => {
        solthronContainer.style.display = 'none';
        solthronContainer.style.pointerEvents = 'none';
        // Reset view state when closing
        closeAllSections();
    });

    // ✅ FIXED: Handle clicks inside shadow DOM properly
    solthronContainer.addEventListener('click', (e) => {
        // Stop clicks inside container from bubbling to document
        e.stopPropagation();
    });

    // Document click handler for closing container (outside clicks)
    document.addEventListener('click', (e) => {
        // In Shadow DOM, we need to check if click is outside the shadow host
        const shadowHost = shadowRoot.host;

        // Check if a workflow is currently being displayed
        const workflowOpen = shadowRoot.querySelector('.workflow-execution-header') !== null;

        // Don't close if workflow is open - user must use close button
        if (!shadowHost.contains(e.target) &&
            solthronContainer.style.display === 'block' &&
            !workflowOpen) {
            solthronContainer.style.display = 'none';
            solthronContainer.style.pointerEvents = 'none';
        }
    });

}

// ✅ FIXED: Add exclusive view management
function closeAllSections() {
    const profileView = shadowRoot.getElementById('profile-view');
    const galleryView = shadowRoot.getElementById('gallery-view');
    const outputContainer = shadowRoot.querySelector('.output-container');
    const profileBtn = shadowRoot.getElementById('profile-btn');
    const galleryBtn = shadowRoot.getElementById('gallery-btn');
    
    // Close all views
    profileView.style.display = 'none';
    galleryView.style.display = 'none';
    outputContainer.style.display = 'block';
    
    // Reset all icon colors
    profileBtn.querySelector('svg').style.stroke = 'currentColor';
    galleryBtn.querySelector('svg').style.stroke = 'currentColor';
}

function initializeProfileHandlers() {
    const profileBtn = shadowRoot.getElementById('profile-btn');
    const profileView = shadowRoot.getElementById('profile-view');
    const closeProfile = shadowRoot.querySelector('.close-profile');
    const loginContainer = shadowRoot.getElementById('login-container');
    const profileDetails = shadowRoot.getElementById('profile-details');
    const loginButton = shadowRoot.getElementById('login-button');
    const loginError = shadowRoot.getElementById('login-error');
    
    checkAuthState();
    
    async function checkAuthState() {
        const isLoggedIn = await BackendAuth.isLoggedIn();
        updateProfileView(isLoggedIn);
    }
    
    profileBtn.addEventListener('click', () => {
        const isVisible = profileView.style.display !== 'none';
        
        if (isVisible) {
            // Close profile and show output
            closeAllSections();
        } else {
            // Close all other sections and show profile
            closeAllSections();
            profileView.style.display = 'block';
            shadowRoot.querySelector('.output-container').style.display = 'none';
            profileBtn.querySelector('svg').style.stroke = '#00ff00';
            
            checkAuthState();
        }
    });
    
    closeProfile.addEventListener('click', () => {
        closeAllSections();
    });
    
    loginButton.addEventListener('click', async (e) => {
        e.preventDefault();
        
        try {
            const extensionId = chrome.runtime.id;
            const loginUrl = `https://solthron.com/login?extension=true&extensionId=${extensionId}`;
            window.open(loginUrl, '_blank');
            
        } catch (error) {
            console.error('Login redirect error:', error);
            showLoginError('Failed to open login page');
        }
    });

    // Add signup button handler
    const signupButton = shadowRoot.getElementById('signup-button');
    if (signupButton) {
        signupButton.addEventListener('click', async (e) => {
            e.preventDefault();
            
            try {
                const extensionId = chrome.runtime.id;
                const signupUrl = `https://solthron.com/signup?extension=true&extensionId=${extensionId}`;
                window.open(signupUrl, '_blank');
                
            } catch (error) {
                console.error('Signup redirect error:', error);
                showLoginError('Failed to open signup page');
            }
        });
    }

    // Add view switching handlers
    const showSignupLink = shadowRoot.getElementById('show-signup');
    const showLoginLink = shadowRoot.getElementById('show-login');
    const loginView = shadowRoot.getElementById('login-view');
    const signupView = shadowRoot.getElementById('signup-view');

    if (showSignupLink) {
        showSignupLink.addEventListener('click', (e) => {
            e.preventDefault();
            loginView.style.display = 'none';
            signupView.style.display = 'block';
            clearLoginError();
        });
    }

    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            signupView.style.display = 'none';
            loginView.style.display = 'block';
            clearLoginError();
        });
    }

    // Helper function to create auth iframe
function createAuthIframe(type = 'signup') {
    return new Promise((resolve, reject) => {
        // Create iframe
        const iframe = document.createElement('iframe');
        iframe.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 400px;
            height: 350px;
            border: none;
            background: white;
            border-radius: 12px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            z-index: 999999;
            border: 1px solid rgba(255,255,255,0.1);
        `;
        
        // Create backdrop
        const backdrop = document.createElement('div');
        backdrop.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            z-index: 999998;
            backdrop-filter: blur(4px);
        `;
        
        const authUrl = `https://solthron.com/quick-auth?type=${type}&extension=true`;
        iframe.src = authUrl;
        
        document.body.appendChild(backdrop);
        document.body.appendChild(iframe);
        
        // Listen for auth success
        // Listen for auth success
const messageHandler = async (event) => {


    if ((event.origin === 'https://solthron.com' || event.origin === 'https://www.solthron.com') &&
        event.data.type === 'SOLTHRON_AUTH_SUCCESS') {

        console.log('🔐 Auth success received in iframe');

        // Clean up
        try {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
            }
            if (document.body.contains(backdrop)) {
                document.body.removeChild(backdrop);
            }
        } catch (e) {
            console.error('Cleanup error:', e);
        }

        window.removeEventListener('message', messageHandler);

        // Check if this is a Firebase token and exchange it
        let finalToken = event.data.token;
        const tokenParts = event.data.token.split('.');
        const isLikelyFirebaseToken = tokenParts.length === 3 && event.data.token.length > 500;

        if (isLikelyFirebaseToken) {
            console.log('🔥 Detected Firebase token in iframe, exchanging...');
            const exchangeResult = await BackendAuth.exchangeFirebaseTokenForBackendJWT(event.data.token);

            if (exchangeResult.success) {
                finalToken = exchangeResult.token;
                console.log('✅ Exchanged for backend JWT');
            } else {
                console.warn('⚠️ Token exchange failed, using original token');
            }
        }

        resolve(finalToken);
    }
};
        
        // Close on backdrop click
        backdrop.addEventListener('click', () => {
            document.body.removeChild(iframe);
            document.body.removeChild(backdrop);
            window.removeEventListener('message', messageHandler);
            reject(new Error('User cancelled'));
        });
        
        window.addEventListener('message', messageHandler);
        
        // Auto-close after 60 seconds
        setTimeout(() => {
            if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
                document.body.removeChild(backdrop);
                window.removeEventListener('message', messageHandler);
                reject(new Error('Auth timeout'));
            }
        }, 120000);
    });
}

// Google Signup Button Handler
shadowRoot.getElementById('google-signup-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    
    try {
        // Show loading
        const originalHTML = e.target.innerHTML;
        e.target.innerHTML = `
            <div style="width: 18px; height: 18px; border: 2px solid #f3f3f3; border-top: 2px solid #4285f4; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 10px;"></div>
            Signing up...
        `;
        e.target.disabled = true;
        
        // Create auth iframe
        const token = await createAuthIframe('signup');
        
        // Store token
        await BackendAuth.setAuthToken(token);
        pageCredits = null;
        
        // Update UI
        updateProfileView(true);
        

        
    } catch (error) {
        console.error('Google signup error:', error);
        if (error.message !== 'User cancelled') {
            showLoginError('Signup failed: ' + error.message);
        }
        
        // Reset button
        e.target.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" style="margin-right: 10px;">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign up with Google
        `;
        e.target.disabled = false;
    }
});

// Google Login Button Handler
shadowRoot.getElementById('google-login-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    
    try {
        // Show loading
        const originalHTML = e.target.innerHTML;
        e.target.innerHTML = `
            <div style="width: 18px; height: 18px; border: 2px solid #f3f3f3; border-top: 2px solid #4285f4; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 10px;"></div>
            Logging in...
        `;
        e.target.disabled = true;
        
        // Create auth iframe
        const token = await createAuthIframe('login');
        
        // Store token
        await BackendAuth.setAuthToken(token);
        pageCredits = null;
        
        // Update UI
        updateProfileView(true);
        

        
    } catch (error) {
        console.error('Google login error:', error);
        if (error.message !== 'User cancelled') {
            showLoginError('Login failed: ' + error.message);
        }
        
        // Reset button
        e.target.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" style="margin-right: 10px;">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Login with Google
        `;
        e.target.disabled = false;
    }
});
    
    async function updateProfileView(isLoggedIn = null) {
        if (isLoggedIn === null) {
            isLoggedIn = await BackendAuth.isLoggedIn();
        }
        
        if (isLoggedIn) {
            loginContainer.style.display = 'none';
            profileDetails.style.display = 'block';
            
            try {
                const credits = await BackendAuth.getUserCredits();
                
                profileDetails.innerHTML = `
                    <div class="profile-info">
                        <div class="profile-field">
                            <div class="field-label">Status</div>
                            <div class="field-value">Logged In</div>
                        </div>
                        <div class="profile-field">
                            <div class="field-label">Account</div>
                            <div class="field-value">Active</div>
                        </div>
                        <div class="profile-field credits">
                            <div class="field-label">Available Credits</div>
                            <div class="field-value-with-button">
                                <div class="field-value">${credits}</div>
                                <button class="buy-credits-btn" id="buy-credits-btn">Buy Credits</button>
                            </div>
                        </div>
                    </div>
                    <button class="logout-button" id="logout-btn">Logout</button>
                `;
                
                shadowRoot.getElementById('buy-credits-btn').addEventListener('click', () => {
                    window.open('https://www.solthron.com/subscription', '_blank');
                });

                shadowRoot.getElementById('logout-btn').addEventListener('click', async () => {
                    try {
                        await BackendAuth.logout();
                        updateProfileView(false);
                    } catch (error) {
                        console.error('Logout error:', error);
                    }
                });
                
            } catch (error) {
                console.error('Error loading profile:', error);
                profileDetails.innerHTML = `
    <div class="profile-info">
        <div class="profile-field">
            <div class="field-label">Status</div>
            <div class="field-value">Logged In</div>
        </div>
        <div class="profile-field">
            <div class="field-label">Account</div>
            <div class="field-value">Error loading profile data</div>
        </div>
        <div class="profile-field credits">
            <div class="field-label">Available Credits</div>
            <div class="field-value-with-button">
                <div class="field-value">--</div>
                <button class="buy-credits-btn" id="buy-credits-btn-error">Buy Credits</button>
            </div>
        </div>
    </div>
    <button class="logout-button" id="logout-btn">Logout</button>
`;
                shadowRoot.getElementById('buy-credits-btn-error').addEventListener('click', () => {
                window.open('https://www.solthron.com/subscription', '_blank');
                });
                shadowRoot.getElementById('logout-btn').addEventListener('click', async () => {
                    try {
                        await BackendAuth.logout();
                        updateProfileView(false);
                    } catch (error) {
                        console.error('Logout error:', error);
                    }
                });
            }
        } else {
    loginContainer.style.display = 'block';
    profileDetails.style.display = 'none';
    clearLoginError();
    
    // Reset to login view
    const loginView = shadowRoot.getElementById('login-view');
    const signupView = shadowRoot.getElementById('signup-view');
    if (loginView && signupView) {
        loginView.style.display = 'block';
        signupView.style.display = 'none';
    }
    
    // Reset Google button states
    setTimeout(() => {
        const googleSignupBtn = shadowRoot.getElementById('google-signup-btn');
        const googleLoginBtn = shadowRoot.getElementById('google-login-btn');
        
        if (googleSignupBtn) {
            googleSignupBtn.disabled = false;
            googleSignupBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" style="margin-right: 10px;">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign up with Google
            `;
        }
        
        if (googleLoginBtn) {
            googleLoginBtn.disabled = false;
            googleLoginBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" style="margin-right: 10px;">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Login with Google
            `;
        }
    }, 100);
}
    }
    
    function showLoginError(message) {
        const loginError = shadowRoot.getElementById('login-error');
        if (loginError) {
            loginError.textContent = message;
            loginError.style.display = 'block';
        }
    }
    
    function clearLoginError() {
        const loginError = shadowRoot.getElementById('login-error');
        if (loginError) {
            loginError.textContent = '';
            loginError.style.display = 'none';
        }
    }
}

// Context menu handlers (right-click functionality)
document.addEventListener('contextmenu', async (e) => {
    // Check if right-click features are enabled
    if (!rightClickFeaturesEnabled || !isButtonVisible) {
        return; // Let normal right-click behavior happen
    }
    
    const target = e.target;
    
    if (isImage(target) && selectedMode === 'image_prompt') {
        e.preventDefault();
        
        showShimmerLoading('Processing image...');
        solthronContainer.style.display = 'block';
        solthronContainer.style.pointerEvents = 'auto';
        const buttonRect = button.getBoundingClientRect();
        positionContainer(buttonRect);
        await processImage(target);
        return;
    }
    
    if (selectedMode === 'smart_followups') {
        const platform = detectAIPlatform();
        
        if (platform === 'unknown') {
            return; // Let normal right-click behavior happen
        }
        
        e.preventDefault();
        
        const conversation = extractConversation();

        if (!conversation || conversation === 'Unable to extract conversation from this page.') {
            showError('Unable to extract conversation. Please ensure there is a conversation visible on the page.');
            solthronContainer.style.display = 'block';
            solthronContainer.style.pointerEvents = 'auto';
            const buttonRect = button.getBoundingClientRect();
            positionContainer(buttonRect);
            return;
        }
        
        showShimmerLoading('Generating followups...');
        solthronContainer.style.display = 'block';
        solthronContainer.style.pointerEvents = 'auto';
        const buttonRect = button.getBoundingClientRect();
        positionContainer(buttonRect);
        
        const creditCheck = await checkCredits('smart_followups');
        if (!creditCheck.success) {
            showError(creditCheck.message || "Please check your account status.");
            return;
        }
        
        try {
            const response = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage({
                    type: 'smart_followups',
                    data: {
                        conversation: conversation,
                        platform: platform
                    }
                }, response => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(response);
                    }
                });
            });
            
            if (response && response.success && response.data) {
                if (response.data.questions && Array.isArray(response.data.questions)) {
                    displaySmartFollowups(response.data);
                } else if (response.data.success && response.data.questions) {
                    displaySmartFollowups(response.data);
                } else {
                    showError('Invalid response format from smart followups service');
                }
            } else {
                const errorMsg = response?.error || response?.data?.error || 'Unknown error occurred';
                showError('Failed to generate follow-up questions: ' + errorMsg);
            }
        } catch (error) {
            console.error('Smart followups error:', error);
            showError('Error analyzing conversation: ' + error.message);
        }
    }
});

async function processImage(img) {
    if (!img.src) return;

    const creditCheck = await checkCredits(selectedMode);
    if (!creditCheck.success) {
        showError(creditCheck.message || "Please check your account status.");
        return;
    }

    try {
        const response = await fetch(img.src);
        const blob = await response.blob();
        const reader = new FileReader();
        const base64Image = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
        });

        const apiResponse = await new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({
                type: 'process_image',
                data: {
                    imageUrl: base64Image,
                    mode: selectedMode
                }
            }, response => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(response);
                }
            });
        });

        if (apiResponse && apiResponse.success) {
            updateOutput(apiResponse.data.prompt);
        } else {
            throw new Error('Failed to process image');
        }
    } catch (error) {
        showError('Error processing image');
    }
}

// Chrome runtime message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "toggleExtension") {
        isButtonVisible = !isButtonVisible;
        
        button.style.display = isButtonVisible ? 'block' : 'none';
        
        if (!isButtonVisible) {
            // Disable right-click features when extension is hidden
            rightClickFeaturesEnabled = false;
            lastSelectedRightClickMode = null;
            
            
            if (solthronContainer.style.display === 'block') {
                solthronContainer.style.display = 'none';
                solthronContainer.style.pointerEvents = 'none';
            }
        } else {
            // Re-enable right-click features if a right-click mode was previously selected
            const isRightClickMode = selectedMode === 'image_prompt' || selectedMode === 'smart_followups';
            if (isRightClickMode) {
                rightClickFeaturesEnabled = true;
                lastSelectedRightClickMode = selectedMode;

            }
        }
        
        sendResponse({success: true});
        return true;
    }
    
    if (request.action === "setAuthToken" && request.token) {
        BackendAuth.setAuthToken(request.token).then(() => {
            pageCredits = null;
            sendResponse({success: true});
        }).catch((error) => {
            console.error('Error setting auth token:', error);
            sendResponse({success: false});
        });
        return true;
    }
    
    return false;
});

// Auth token receiver for website login
window.addEventListener('message', async (event) => {
    if (event.origin !== 'https://solthron.com' &&
        event.origin !== 'https://www.solthron.com') {
        return;
    }

    if (event.data.type === 'SOLTHRON_AUTH_SUCCESS' && event.data.token) {
        console.log('🔐 Auth token received from website');

        try {
            let tokenToStore = event.data.token;

            // Check if this is a Firebase token (they're usually longer and have specific format)
            // Firebase tokens are JWTs with 3 parts separated by dots
            const tokenParts = event.data.token.split('.');
            const isLikelyFirebaseToken = tokenParts.length === 3 && event.data.token.length > 500;

            if (isLikelyFirebaseToken) {
                console.log('🔥 Detected Firebase token, exchanging for backend JWT...');

                const exchangeResult = await BackendAuth.exchangeFirebaseTokenForBackendJWT(event.data.token);

                if (exchangeResult.success) {
                    tokenToStore = exchangeResult.token;
                    console.log('✅ Using backend JWT token');
                } else {
                    console.error('❌ Token exchange failed, trying to use Firebase token anyway');
                    // Fall back to storing the Firebase token (may not work, but worth trying)
                }
            } else {
                console.log('✅ Token appears to be backend JWT already');
            }

            const success = await BackendAuth.setAuthToken(tokenToStore);
            if (success) {
                console.log('✅ Auth token stored successfully');
                pageCredits = null;

                const profileView = shadowRoot.getElementById('profile-view');
                if (profileView && profileView.style.display !== 'none') {
                    // Refresh profile view to show logged-in state
                    const profileBtn = shadowRoot.getElementById('profile-btn');
                    if (profileBtn) {
                        profileBtn.click();
                        setTimeout(() => profileBtn.click(), 100);
                    }
                }

            } else {
                console.error('❌ Failed to store auth token');
            }
        } catch (error) {
            console.error('💥 Auth token storage error:', error);
        }
    }
});

// Export for external access
window.solthronAuth = BackendAuth;

// Debug functions
window.solthronDebug = {
    checkAuth: async function() {
        const hasToken = await BackendAuth.getAuthToken();
        const isLoggedIn = await BackendAuth.isLoggedIn();
        const credits = await BackendAuth.getUserCredits();
        




        
        return { hasToken: !!hasToken, isLoggedIn, credits };
    },
    
    clearAuth: async function() {
        await BackendAuth.logout();

    }
};

// ========== GLOBAL QUICK SAVE LISTENER ==========
// Works anywhere on the page when text is highlighted
document.addEventListener('keydown', (e) => {
    if (e.altKey && e.key === 's') {
        const selectedText = window.getSelection().toString().trim();
        
        if (selectedText && selectedText.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('💾 Global quick save triggered');
            
            savePrompt(selectedText).then(success => {
                if (success) {
                    showQuickSaveFeedback();
                }
            });
        }
    }
}, true); // Use capture phase

// ========== SAVE LAST RESPONSE LISTENER (Alt+R) ==========
// Works anywhere on the page - saves last Q&A exchange
document.addEventListener('keydown', async (e) => {
    if (e.altKey && e.key === 'r') {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('💬 Save last response triggered (Alt+R)');
        
        const platform = detectAIPlatform();
        
        if (platform === 'unknown' || platform === 'gmail') {
            showNotification('⚠️ Not supported on this page', 'warning');
            return;
        }
        
        // Extract last Q&A exchange
        const lastExchange = extractLastExchange(platform);
        
        if (!lastExchange || !lastExchange.question || !lastExchange.answer) {
            showNotification('⚠️ No conversation found to save', 'warning');
            return;
        }
        
        // Build save object
        const saveData = {
            id: Date.now().toString(),
            type: 'qa_pair',
            
            // Content
            question: lastExchange.question,
            answer: lastExchange.answer,
            
            // Metadata
            title: generateTitleFromText(lastExchange.question),
            ai: platform,
            date: new Date().toISOString(),
            chatLink: window.location.href,
            
            // Detection
            hasCode: detectCode(lastExchange.answer),
            language: detectLanguage(lastExchange.answer)
        };
        
        // Save
        const success = await saveChatExchange(saveData);
        
        if (success) {
            showNotification(`✅ Saved: ${saveData.title}`);
        } else {
            showNotification('❌ Failed to save', 'error');
        }
    }
}, true);

// ✅ INITIALIZE THE EXTENSION

createUI();
initializeProfileHandlers();

// Check for platform changes and re-initialize file analysis
// Initialize Auto Smart Actions and File Analysis
setTimeout(() => {
    const platform = detectAIPlatform();
    if (platform !== 'unknown' && platform !== 'gmail') {

        initializeFileAnalysis();
    }
}, 2000);

// Debug helper for testing in console
window.solthronDebugGallery = {
    testRename: function() {
        const items = shadowRoot.querySelectorAll('.gallery-item');
        console.log('📊 Gallery items found:', items.length);
        
        if (items.length > 0) {
            console.log('✅ First item ID:', items[0].dataset.id);
            console.log('✅ Current category:', currentCategory);
            
            // Test if contextmenu listener is attached
            const textElement = items[0].querySelector('.gallery-item-text');
            console.log('✅ Text element found:', !!textElement);
        } else {
            console.log('❌ No gallery items found. Is the gallery open?');
        }
    },
    
    getCurrentCategory: function() {
        return currentCategory;
    },
    
    getShadowRoot: function() {
        return shadowRoot;
    }
};

console.log('🔧 Debug helper loaded. Try: window.solthronDebugGallery.testRename()');
