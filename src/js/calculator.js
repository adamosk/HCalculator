// Import required modules from Electron
const { ipcRenderer, clipboard, remote } = require('electron');
const { webFrame, contextBridge } = require('electron');
const { Menu, getCurrentWindow } = require('@electron/remote');

// Error handling for async operations
const handleIpcError = (error) => {
    console.error('IPC operation failed:', error);
    return [];
};

// Calculator class to handle all calculator operations
class Calculator {
    constructor() {
        // Initialize state variables
        this.displayValue = '0';
        this.firstOperand = null;
        this.waitingForSecondOperand = false;
        this.operator = null;
        this.operationString = '';
        this.historyVisible = false;
        this.historyPinned = false;
        this.useSeparator = true;
        this.darkTheme = false;
        this.keepOnTop = false;
        
        // Memory-related variables
        this.memoryValue = 0;  // Current memory value
        this.memoryItems = []; // Array to store multiple memory values
        this.memoryDropdownVisible = false;
        
        // Get DOM elements
        this.mainDisplay = document.getElementById('main-display');
        this.currentOperationDisplay = document.getElementById('current-operation');
        this.historyDisplay = document.getElementById('history-display');
        this.historyPanel = document.getElementById('history-panel');
        this.historyList = document.getElementById('history-list');
        this.clearHistoryBtn = document.getElementById('clear-history');
        this.pinHistoryBtn = document.getElementById('pin-history');
        this.historyToggleBtn = document.querySelector('[data-action="toggle-history"]');
        this.calculatorContainer = document.querySelector('.calculator-container');
        
        // Memory elements
        this.memoryIndicator = document.getElementById('memory-indicator');
        this.memoryDropdown = document.getElementById('memory-dropdown');
        
        // Settings panel elements
        this.themeToggle = document.getElementById('theme-toggle');
        this.settingsToggle = document.getElementById('settings-toggle');
        this.settingsPanel = document.getElementById('settings-panel');
        this.settingsClose = document.getElementById('settings-close');
        this.themeSwitch = document.getElementById('theme-switch');
        this.themeLabel = document.getElementById('theme-label');
        this.separatorSwitch = document.getElementById('separator-switch');
        this.separatorLabel = document.getElementById('separator-label');
        this.ontopSwitch = document.getElementById('ontop-switch');
        this.ontopLabel = document.getElementById('ontop-label');
        
        // Get DOM elements for titlebar
        this.titlebarMinimize = document.getElementById('titlebar-minimize');
        this.titlebarMaximize = document.getElementById('titlebar-maximize');
        this.titlebarClose = document.getElementById('titlebar-close');
        
        // Load user preferences
        this.loadPreferences();
        
        // Load calculation history
        this.loadHistory();
        
        // Bind event listeners
        this.bindEvents();
        
        // Bind titlebar controls
        this.bindTitlebarControls();
        
        // Listen for window-ready event from main process
        ipcRenderer.on('window-ready', () => {
            // Remove focus from settings button and set it to the calculator display area
            if (document.activeElement === this.settingsToggle) {
                this.settingsToggle.blur();
                this.mainDisplay.focus();
            }
        });
        
        // After loading preferences and binding events, initialize memory button states
        this.updateMemoryIndicator();
        
        // Initialize version display
        this.initializeVersionDisplay();
    }
    
    // Load user preferences from storage
    async loadPreferences() {
        try {
            // Default preferences
            const defaultPrefs = {
                darkTheme: false,
                useSeparator: true,
                historyPinned: false,
                keepOnTop: false,
                memoryItems: []
            };
            
            // Try to get stored preferences
            const prefs = await ipcRenderer.invoke('get-preferences') || defaultPrefs;
            
            // Apply preferences
            this.darkTheme = prefs.darkTheme;
            this.useSeparator = prefs.useSeparator;
            this.historyPinned = prefs.historyPinned;
            this.keepOnTop = prefs.keepOnTop || false;
            this.memoryItems = prefs.memoryItems || [];
            
            if (this.memoryItems.length > 0) {
                this.memoryValue = this.memoryItems[0];
                this.updateMemoryIndicator();
            }
            
            // Apply theme
            if (this.darkTheme) {
                document.body.dataset.theme = 'dark';
                this.themeSwitch.checked = true;
                this.themeLabel.textContent = 'Dark';
            }
            
            // Apply separator setting
            this.separatorSwitch.checked = this.useSeparator;
            this.separatorLabel.textContent = this.useSeparator ? 'On' : 'Off';
            
            // Apply keep on top setting
            this.ontopSwitch.checked = this.keepOnTop;
            this.ontopLabel.textContent = this.keepOnTop ? 'On' : 'Off';
            if (this.keepOnTop) {
                this.setAlwaysOnTop(true);
            }
            
            // Apply history pinned setting
            if (this.historyPinned) {
                this.pinHistory();
            }
        } catch (error) {
            console.error('Error loading preferences:', error);
        }
    }
    
    // Save user preferences
    async savePreferences() {
        try {
            const prefs = {
                darkTheme: this.darkTheme,
                useSeparator: this.useSeparator,
                historyPinned: this.historyPinned,
                keepOnTop: this.keepOnTop,
                memoryItems: this.memoryItems
            };
            
            await ipcRenderer.invoke('save-preferences', prefs);
        } catch (error) {
            console.error('Error saving preferences:', error);
        }
    }
    
    // Attach event listeners to calculator buttons
    bindEvents() {
        // Direct event listener for history toggle button for more reliability
        if (this.historyToggleBtn) {
            this.historyToggleBtn.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent event bubbling
                this.toggleHistoryPanel();
            });
        }
        
        document.addEventListener('click', (event) => {
            const element = event.target;
            
            // Handle number buttons
            const numberButton = element.closest('.number');
            if (numberButton && numberButton.dataset.number) {
                this.inputDigit(numberButton.dataset.number);
            }
            
            // Handle operator buttons
            const operatorButton = element.closest('.operator');
            if (operatorButton && operatorButton.dataset.operator) {
                this.handleOperator(operatorButton.dataset.operator);
            }
            
            // Handle memory buttons
            const memoryButton = element.closest('.memory');
            if (memoryButton && memoryButton.dataset.memory) {
                this.handleMemoryOperation(memoryButton.dataset.memory);
            }
            
            // Handle function buttons
            const functionButton = element.closest('.function, .equals');
            if (functionButton && functionButton.dataset.action) {
                const action = functionButton.dataset.action;
                
                switch (action) {
                    case 'clear':
                        this.resetCalculator();
                        break;
                    case 'calculate':
                        this.performCalculation();
                        break;
                    case 'backspace':
                        this.handleBackspace();
                        break;
                    case 'percentage':
                        this.handlePercentage();
                        break;
                    case 'toggle-history':
                        this.toggleHistoryPanel();
                        break;
                }
            }
            
            // Close memory dropdown when clicking elsewhere
            if (!element.closest('.memory-dropdown') && 
                !element.closest('[data-memory="m-dropdown"]')) {
                this.closeMemoryDropdown();
            }
        });
        
        // Memory dropdown actions
        this.memoryDropdown.addEventListener('click', (event) => {
            // First check if we clicked on an action button
            const action = event.target.closest('.memory-dropdown-action');
            if (action) {
                const memoryIndex = parseInt(action.dataset.index);
                const actionType = action.dataset.action;
                
                if (!isNaN(memoryIndex) && actionType) {
                    this.handleMemoryItemAction(memoryIndex, actionType);
                }
                
                // Prevent the event from closing the dropdown
                event.stopPropagation();
                return; // Exit early - action button was clicked
            }
            
            // If not an action button, check if we clicked on a memory item or any of its children
            const item = event.target.closest('.memory-dropdown-item');
            if (item) {
                const memoryIndex = parseInt(item.dataset.index);
                if (!isNaN(memoryIndex)) {
                    this.recallMemoryItem(memoryIndex);
                    this.closeMemoryDropdown();
                }
            }
        });
        
        // Clear history button
        this.clearHistoryBtn.addEventListener('click', () => {
            this.clearHistory();
        });
        
        // Pin history button
        this.pinHistoryBtn.addEventListener('click', () => {
            this.togglePinHistory();
        });
        
        // History item click to restore calculation
        this.historyList.addEventListener('click', (event) => {
            const historyItem = event.target.closest('.history-item');
            const action = event.target.closest('.history-item-action');
            
            // If clicked on an action button
            if (action) {
                const actionType = action.dataset.action;
                const historyIndex = parseInt(action.dataset.index, 10);
                this.handleHistoryItemAction(historyIndex, actionType);
                event.stopPropagation(); // Prevent triggering the history item click
                return;
            }
            
            // If clicked on the history item itself (to restore calculation)
            if (historyItem) {
                const expression = historyItem.dataset.expression;
                const result = historyItem.dataset.result;
                
                if (expression && result) {
                    this.displayValue = result;
                    this.operationString = expression;
                    this.updateDisplay();
                    
                    // Auto-close history panel when an item is clicked if not pinned
                    if (!this.historyPinned) {
                        this.toggleHistoryPanel();
                    }
                }
            }
        });
        
        // Settings toggle
        this.settingsToggle.addEventListener('click', () => {
            this.toggleSettings();
        });
        
        // Settings close
        this.settingsClose.addEventListener('click', () => {
            this.toggleSettings();
        });
        
        // Theme switch
        this.themeSwitch.addEventListener('change', () => {
            this.toggleTheme();
        });
        
        // Thousands separator switch
        this.separatorSwitch.addEventListener('change', () => {
            this.useSeparator = this.separatorSwitch.checked;
            this.separatorLabel.textContent = this.useSeparator ? 'On' : 'Off';
            this.updateDisplay();
            this.savePreferences();
            
            // Also update any history items to reflect the new thousands separator setting
            this.loadHistory();
        });
        
        // Keep on top switch
        this.ontopSwitch.addEventListener('change', () => {
            this.keepOnTop = this.ontopSwitch.checked;
            this.ontopLabel.textContent = this.keepOnTop ? 'On' : 'Off';
            this.setAlwaysOnTop(this.keepOnTop);
            this.savePreferences();
        });
        
        // Add zoom functionality
        document.addEventListener('wheel', (event) => {
            // Only activate zoom when Ctrl key is pressed
            if (event.ctrlKey) {
                event.preventDefault();
                
                const currentZoom = webFrame.getZoomFactor();
                if (event.deltaY < 0) {
                    // Zoom in - limit to 2.0x
                    webFrame.setZoomFactor(Math.min(currentZoom + 0.1, 2.0));
                } else {
                    // Zoom out - limit to 0.5x
                    webFrame.setZoomFactor(Math.max(currentZoom - 0.1, 0.5));
                }
            }
        });
        
        // Add keyboard shortcuts
        document.addEventListener('keydown', (event) => {
            const key = event.key;
            
            // Basic keyboard operations
            if (/^[0-9.]$/.test(key)) {
                // Number and decimal
                event.preventDefault();
                this.inputDigit(key);
            }
            
            // Operators
            if (['+', '-', '*', '/'].includes(key)) {
                event.preventDefault();
                this.handleOperator(key);
            }
            
            // Enter and = for equals
            if (key === 'Enter' || key === '=') {
                event.preventDefault();
                this.performCalculation();
            }
            
            // Backspace for delete
            if (key === 'Backspace') {
                event.preventDefault();
                this.handleBackspace();
            }
            
            // Escape to reset
            if (key === 'Escape') {
                event.preventDefault();
                this.resetCalculator();
                
                // Also close settings panel if open
                if (this.settingsPanel.classList.contains('show')) {
                    this.toggleSettings();
                }
                
                // Also close history panel if open and not pinned
                if (this.historyVisible && !this.historyPinned) {
                    this.toggleHistoryPanel();
                }
            }
            
            // 'h' to toggle history
            if (key.toLowerCase() === 'h') {
                event.preventDefault();
                // Ensure we don't toggle the history if settings are open
                if (!this.settingsPanel.classList.contains('show')) {
                    this.toggleHistoryPanel();
                    // Flash the history button to provide visual feedback
                    if (this.historyToggleBtn) {
                        this.historyToggleBtn.classList.add('active');
                        setTimeout(() => {
                            this.historyToggleBtn.classList.remove('active');
                        }, 200);
                    }
                }
            }
            
            // Alt+Enter to show context menu
            if (event.altKey && key === 'Enter') {
                event.preventDefault();
                this.showContextMenu();
            }
            
            // Ctrl+C to copy display value
            if (event.ctrlKey && key.toLowerCase() === 'c') {
                event.preventDefault();
                this.copyToClipboard();
            }
            
            // Ctrl+V to paste into display
            if (event.ctrlKey && key.toLowerCase() === 'v') {
                event.preventDefault();
                this.pasteFromClipboard();
            }
            
            // Memory keyboard shortcuts (Alt key combinations)
            if (event.altKey) {
                switch (key.toLowerCase()) {
                    case 'c': // Alt+C for Memory Clear
                        event.preventDefault();
                        this.handleMemoryOperation('mc');
                        break;
                    case 'r': // Alt+R for Memory Recall
                        event.preventDefault();
                        this.handleMemoryOperation('mr');
                        break;
                    case 'p': // Alt+P for Memory Add (plus)
                        event.preventDefault();
                        this.handleMemoryOperation('m-plus');
                        break;
                    case 'm': // Alt+M for Memory Subtract (minus)
                        event.preventDefault();
                        this.handleMemoryOperation('m-minus');
                        break;
                    case 's': // Alt+S for Memory Store
                        event.preventDefault();
                        this.handleMemoryOperation('ms');
                        // Don't proceed to settings toggle when using Alt+S
                        return;
                        break;
                    case 'd': // Alt+D for Memory Dropdown
                        event.preventDefault();
                        this.handleMemoryOperation('m-dropdown');
                        break;
                }
            }
            
            // 's' to toggle settings (only when not using Alt+S)
            if (key.toLowerCase() === 's' && !event.altKey) {
                event.preventDefault();
                this.toggleSettings();
            }
        });
        
        // Add context menu to main display
        this.mainDisplay.addEventListener('contextmenu', (event) => {
            event.preventDefault();
            this.showContextMenu();
        });
        
        // Add event listeners for about section links
        const githubLink = document.getElementById('github-link');
        const reportIssueLink = document.getElementById('report-issue-link');
        
        if (githubLink) {
            githubLink.addEventListener('click', (event) => {
                event.preventDefault();
                this.openExternalLink('https://github.com/adamosk/HCalculator');
            });
        }
        
        if (reportIssueLink) {
            reportIssueLink.addEventListener('click', (event) => {
                event.preventDefault();
                this.openExternalLink('https://github.com/adamosk/HCalculator/issues/new');
            });
        }
    }
    
    // Initialize titlebar controls
    bindTitlebarControls() {
        // Get current window
        const currentWindow = getCurrentWindow();
        
        // Minimize
        this.titlebarMinimize.addEventListener('click', () => {
            currentWindow.minimize();
        });
        
        // Maximize
        this.titlebarMaximize.addEventListener('click', () => {
            if (currentWindow.isMaximized()) {
                currentWindow.unmaximize();
                this.titlebarMaximize.innerHTML = '<span class="material-icons">crop_square</span>';
            } else {
                currentWindow.maximize();
                this.titlebarMaximize.innerHTML = '<span class="material-icons">filter_none</span>';
            }
        });
        
        // Close
        this.titlebarClose.addEventListener('click', () => {
            currentWindow.close();
        });
        
        // Update maximize button when window state changes
        currentWindow.on('maximize', () => {
            this.titlebarMaximize.innerHTML = '<span class="material-icons">filter_none</span>';
        });
        
        currentWindow.on('unmaximize', () => {
            this.titlebarMaximize.innerHTML = '<span class="material-icons">crop_square</span>';
        });
    }
    
    // Toggle theme between light and dark
    toggleTheme() {
        this.darkTheme = !this.darkTheme;
        
        if (this.darkTheme) {
            document.body.dataset.theme = 'dark';
            this.themeSwitch.checked = true;
            this.themeLabel.textContent = 'Dark';
        } else {
            document.body.dataset.theme = '';
            this.themeSwitch.checked = false;
            this.themeLabel.textContent = 'Light';
        }
        
        this.savePreferences();
    }
    
    // Toggle settings panel
    toggleSettings() {
        this.settingsPanel.classList.toggle('show');
    }
    
    // Pin/unpin history panel
    togglePinHistory() {
        this.historyPinned = !this.historyPinned;
        this.pinHistory();
        this.savePreferences();
    }
    
    // Apply history pinned state
    pinHistory() {
        if (this.historyPinned) {
            this.historyPanel.classList.add('pinned');
            this.calculatorContainer.classList.add('with-pinned-history');
            this.historyPanel.classList.add('show');
            this.pinHistoryBtn.innerHTML = '<span class="material-icons">push_pin</span>';
            this.pinHistoryBtn.classList.add('active');
            this.pinHistoryBtn.setAttribute('title', 'Unpin History (Currently Pinned)');
            this.historyVisible = true;
        } else {
            this.historyPanel.classList.remove('pinned');
            this.calculatorContainer.classList.remove('with-pinned-history');
            // Auto-hide history panel when unpinned
            this.historyPanel.classList.remove('show');
            this.historyVisible = false;
            this.pinHistoryBtn.innerHTML = '<span class="material-icons-outlined">push_pin</span>'; 
            this.pinHistoryBtn.classList.remove('active');
            this.pinHistoryBtn.setAttribute('title', 'Pin History');
        }
    }
    
    // Handle digit input including decimal
    inputDigit(digit) {
        if (this.waitingForSecondOperand) {
            this.displayValue = digit;
            this.waitingForSecondOperand = false;
        } else {
            this.displayValue = this.displayValue === '0' ? digit : this.displayValue + digit;
            
            // Prevent multiple decimal points
            if (digit === '.' && this.displayValue.split('.').length > 2) {
                this.displayValue = this.displayValue.slice(0, -1);
            }
        }
        
        this.updateDisplay();
    }
    
    // Format display value with thousands separator if enabled
    formatDisplayValue(value) {
        if (!this.useSeparator || value === 'Error') return value;
        
        // Split number by decimal point
        const parts = value.split('.');
        
        // Format the integer part with thousands separators
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        
        // Join back with decimal point if exists
        return parts.join('.');
    }
    
    // Handle operator input
    handleOperator(nextOperator) {
        const inputValue = parseFloat(this.displayValue);
        
        // If operator already exists and waiting for second operand
        if (this.operator && this.waitingForSecondOperand) {
            this.operator = nextOperator;
            return;
        }
        
        // If this is the first operand
        if (this.firstOperand === null) {
            this.firstOperand = inputValue;
        } else if (this.operator) {
            const result = this.calculate(this.firstOperand, inputValue, this.operator);
            this.displayValue = String(result);
            this.firstOperand = result;
        }
        
        // Update operation display string
        if (this.operationString === '' || this.operationString.endsWith('=')) {
            this.operationString = `${this.displayValue} ${this.getOperatorSymbol(nextOperator)}`;
        } else {
            this.operationString = `${this.operationString} ${this.displayValue} ${this.getOperatorSymbol(nextOperator)}`;
        }
        
        this.waitingForSecondOperand = true;
        this.operator = nextOperator;
        this.updateDisplay();
    }
    
    // Convert operator to symbol for display
    getOperatorSymbol(operator) {
        const symbols = {
            '+': '+',
            '-': '−',
            '*': '×',
            '/': '÷'
        };
        return symbols[operator] || operator;
    }
    
    // Perform calculation
    calculate(firstOperand, secondOperand, operator) {
        if (operator === '+') {
            return firstOperand + secondOperand;
        } else if (operator === '-') {
            return firstOperand - secondOperand;
        } else if (operator === '*') {
            return firstOperand * secondOperand;
        } else if (operator === '/') {
            return secondOperand !== 0 ? firstOperand / secondOperand : 'Error';
        }
        
        return secondOperand;
    }
    
    // Handle equals button
    performCalculation() {
        if (!this.operator || this.waitingForSecondOperand) {
            return;
        }
        
        const inputValue = parseFloat(this.displayValue);
        const result = this.calculate(this.firstOperand, inputValue, this.operator);
        
        if (result === 'Error') {
            this.displayValue = 'Error';
        } else {
            this.displayValue = String(result);
            
            // Format complete equation for display and history
            const completeEquation = `${this.operationString} ${inputValue} =`;
            this.operationString = completeEquation;
            
            // Save to history
            this.saveCalculation({
                expression: completeEquation,
                result: this.displayValue
            });
        }
        
        // Reset the calculator state for next calculation
        this.firstOperand = null;
        this.waitingForSecondOperand = false;
        this.operator = null;
        
        this.updateDisplay();
    }
    
    // Handle backspace button
    handleBackspace() {
        if (this.waitingForSecondOperand) return;
        
        this.displayValue = this.displayValue.slice(0, -1);
        
        if (this.displayValue === '' || this.displayValue === '-') {
            this.displayValue = '0';
        }
        
        this.updateDisplay();
    }
    
    // Handle percentage button
    handlePercentage() {
        if (this.displayValue === '0' || this.displayValue === 'Error') return;
        
        const currentValue = parseFloat(this.displayValue);
        this.displayValue = String(currentValue / 100);
        this.updateDisplay();
    }
    
    // Reset calculator to initial state
    resetCalculator() {
        this.displayValue = '0';
        this.firstOperand = null;
        this.waitingForSecondOperand = false;
        this.operator = null;
        this.operationString = '';
        this.updateDisplay();
    }
    
    // Update display with current values
    updateDisplay() {
        this.mainDisplay.textContent = this.formatDisplayValue(this.displayValue);
        
        // Only show operation in the secondary display if there's something to show
        if (this.operationString.endsWith('=')) {
            this.historyDisplay.textContent = this.operationString;
            this.currentOperationDisplay.textContent = '';
        } else {
            this.historyDisplay.textContent = '';
            this.currentOperationDisplay.textContent = this.operationString;
        }
    }
    
    // Toggle history panel visibility
    toggleHistoryPanel() {
        // Check if history panel exists
        if (!this.historyPanel) {
            console.error('History panel element not found');
            return;
        }
        
        // Only toggle if not pinned
        if (!this.historyPinned) {
            this.historyVisible = !this.historyVisible;
            
            if (this.historyVisible) {
                this.historyPanel.classList.add('show');
                this.historyPanel.style.visibility = 'visible';
                this.historyPanel.style.display = 'block';
            } else {
                this.historyPanel.classList.remove('show');
                // Use a timeout to hide the panel after the animation completes
                setTimeout(() => {
                    if (!this.historyVisible && !this.historyPinned) {
                        this.historyPanel.style.visibility = 'hidden';
                    }
                }, 300); // Same duration as the CSS transition
            }
        }
    }
    
    // Save calculation to history
    async saveCalculation(calculation) {
        try {
            const history = await ipcRenderer.invoke('save-calculation', calculation);
            this.renderHistoryItems(history);
        } catch (error) {
            handleIpcError(error);
        }
    }
    
    // Load history from storage
    async loadHistory() {
        try {
            const history = await ipcRenderer.invoke('get-calculation-history');
            this.renderHistoryItems(history);
        } catch (error) {
            handleIpcError(error);
        }
    }
    
    // Clear history
    async clearHistory() {
        try {
            const history = await ipcRenderer.invoke('clear-history');
            this.renderHistoryItems(history);
        } catch (error) {
            handleIpcError(error);
        }
    }
    
    // Render history items in UI
    renderHistoryItems(history) {
        this.historyList.innerHTML = '';
        
        if (history.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.classList.add('history-empty');
            emptyMessage.textContent = 'No calculation history';
            this.historyList.appendChild(emptyMessage);
            return;
        }
        
        history.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            historyItem.dataset.expression = item.expression;
            historyItem.dataset.result = item.result;
            historyItem.dataset.index = index;
            
            const expressionElement = document.createElement('div');
            expressionElement.classList.add('history-expression');
            expressionElement.textContent = item.expression;
            
            const resultElement = document.createElement('div');
            resultElement.classList.add('history-result');
            resultElement.textContent = this.useSeparator ? this.formatDisplayValue(item.result) : item.result;
            
            const actionsElement = document.createElement('div');
            actionsElement.classList.add('history-item-actions');
            
            const deleteAction = document.createElement('button');
            deleteAction.classList.add('history-item-action', 'history-delete-action');
            deleteAction.title = 'Delete this item';
            deleteAction.dataset.action = 'delete';
            deleteAction.dataset.index = index;
            deleteAction.innerHTML = '&times;'; // × symbol
            
            actionsElement.appendChild(deleteAction);
            historyItem.appendChild(expressionElement);
            historyItem.appendChild(resultElement);
            historyItem.appendChild(actionsElement);
            
            this.historyList.appendChild(historyItem);
        });
    }
    
    // Set window always on top
    async setAlwaysOnTop(value) {
        try {
            await ipcRenderer.invoke('set-always-on-top', value);
        } catch (error) {
            console.error('Error setting always on top:', error);
        }
    }
    
    // Copy current display value to clipboard
    copyToClipboard() {
        // Remove commas before copying
        const valueToCopy = this.displayValue.replace(/,/g, '');
        clipboard.writeText(valueToCopy);
        
        // Visual feedback for copy
        const originalColor = this.mainDisplay.style.color;
        this.mainDisplay.style.color = 'var(--equals-bg)';
        setTimeout(() => {
            this.mainDisplay.style.color = originalColor;
        }, 200);
    }
    
    // Paste from clipboard to display
    pasteFromClipboard() {
        const text = clipboard.readText();
        
        // Check if the clipboard content is a valid number
        if (/^-?\d*\.?\d*$/.test(text)) {
            this.displayValue = text;
            this.updateDisplay();
        }
    }
    
    // Show context menu on right-click
    showContextMenu() {
        const menu = Menu.buildFromTemplate([
            {
                label: 'Copy',
                accelerator: 'CmdOrCtrl+C',
                click: () => {
                    this.copyToClipboard();
                }
            },
            {
                label: 'Paste',
                accelerator: 'CmdOrCtrl+V',
                click: () => {
                    this.pasteFromClipboard();
                }
            }
        ]);
        
        menu.popup();
    }
    
    // Handle memory operations
    handleMemoryOperation(operation) {
        // Get current display value as a number
        const currentValue = parseFloat(this.displayValue);
        
        switch (operation) {
            case 'mc': // Memory Clear
                if (this.memoryItems.length > 0) {
                    this.clearMemory();
                    // Provide visual feedback
                    this.animateMemoryOperation();
                }
                break;
                
            case 'mr': // Memory Recall
                if (this.memoryItems.length > 0) {
                    this.recallMemory();
                    // Provide visual feedback
                    this.animateMemoryOperation();
                }
                break;
                
            case 'm-plus': // Memory Add
                if (this.displayValue !== 'Error') {
                    this.addToMemory(currentValue);
                    // Provide visual feedback
                    this.animateMemoryOperation();
                }
                break;
                
            case 'm-minus': // Memory Subtract
                if (this.displayValue !== 'Error') {
                    this.subtractFromMemory(currentValue);
                    // Provide visual feedback
                    this.animateMemoryOperation();
                }
                break;
                
            case 'ms': // Memory Store
                if (this.displayValue !== 'Error') {
                    this.storeInMemory(currentValue);
                }
                break;
                
            case 'm-dropdown': // Memory Dropdown
                this.toggleMemoryDropdown();
                break;
        }
    }
    
    // Clear all memory
    clearMemory() {
        this.memoryValue = 0;
        this.memoryItems = [];
        this.updateMemoryIndicator();
        this.renderMemoryItems();
        this.savePreferences();
    }
    
    // Recall the main memory value
    recallMemory() {
        if (this.memoryItems.length > 0) {
            this.displayValue = String(this.memoryItems[0]);
            this.updateDisplay();
        }
    }
    
    // Recall a specific memory item
    recallMemoryItem(index) {
        if (index >= 0 && index < this.memoryItems.length) {
            this.displayValue = String(this.memoryItems[index]);
            this.updateDisplay();
        }
    }
    
    // Add display value to memory
    addToMemory(value) {
        if (this.memoryItems.length === 0) {
            // If no memory items, create a new one
            this.memoryItems.push(value);
        } else {
            // Add to the most recent memory item (index 0)
            this.memoryItems[0] += value;
        }
        this.memoryValue = this.memoryItems[0];
        this.updateMemoryIndicator();
        this.renderMemoryItems();
        this.savePreferences();
    }
    
    // Subtract display value from memory
    subtractFromMemory(value) {
        if (this.memoryItems.length === 0) {
            // If no memory items, create a new one with negative value
            this.memoryItems.push(-value);
        } else {
            // Subtract from the most recent memory item
            this.memoryItems[0] -= value;
        }
        this.memoryValue = this.memoryItems[0];
        this.updateMemoryIndicator();
        this.renderMemoryItems();
        this.savePreferences();
    }
    
    // Store display value in memory
    storeInMemory(value) {
        // Always store new value at the beginning of the array (index 0)
        this.memoryItems.unshift(value);
        
        // Update current memory value
        this.memoryValue = value;
        
        // Provide visual feedback of the operation
        this.animateMemoryOperation();
        
        // Update UI
        this.updateMemoryIndicator();
        this.renderMemoryItems();
        this.savePreferences();
    }
    
    // Provide visual feedback for memory operations
    animateMemoryOperation() {
        // Flash the memory indicator for visual feedback
        if (this.memoryIndicator) {
            const originalColor = this.memoryIndicator.style.color;
            this.memoryIndicator.style.color = '#ffffff';
            setTimeout(() => {
                this.memoryIndicator.style.color = originalColor;
            }, 150);
        }
    }
    
    // Update the memory indicator visibility and button states
    updateMemoryIndicator() {
        // Get memory-related buttons
        const mcButton = document.querySelector('[data-memory="mc"]');
        const mrButton = document.querySelector('[data-memory="mr"]');
        
        if (this.memoryItems.length > 0) {
            // Show memory indicator and enable buttons
            this.memoryIndicator.classList.add('show');
            
            // Enable MC and MR buttons
            if (mcButton) {
                mcButton.classList.remove('disabled');
                mcButton.disabled = false;
            }
            if (mrButton) {
                mrButton.classList.remove('disabled'); 
                mrButton.disabled = false;
            }
        } else {
            // Hide memory indicator and disable buttons
            this.memoryIndicator.classList.remove('show');
            
            // Disable MC and MR buttons
            if (mcButton) {
                mcButton.classList.add('disabled');
                mcButton.disabled = true;
            }
            if (mrButton) {
                mrButton.classList.add('disabled');
                mrButton.disabled = true;
            }
        }
    }
    
    // Toggle memory dropdown
    toggleMemoryDropdown() {
        // Always render the items first to ensure dropdown contents are up to date
        this.renderMemoryItems();
        
        // Get dropdown element
        const dropdown = document.getElementById('memory-dropdown');
        
        if (!dropdown) return;
        
        // Check if memory items exist
        if (this.memoryItems.length === 0) {
            // If no memory items, don't show dropdown
            dropdown.classList.remove('show');
            return;
        }
        
        // Toggle dropdown visibility
        dropdown.classList.toggle('show');
        
        // If dropdown is now visible, position it
        if (dropdown.classList.contains('show')) {
            this.positionMemoryDropdown();
        }
    }
    
    // Position memory dropdown
    positionMemoryDropdown() {
        const dropdown = document.getElementById('memory-dropdown');
        const memoryRow = document.querySelector('.memory-row');
        const titlebar = document.querySelector('.custom-titlebar');
        
        if (!dropdown || !memoryRow) return;
        
        // Set maximum height based on available space
        const viewportHeight = window.innerHeight;
        const memoryRowRect = memoryRow.getBoundingClientRect();
        const titlebarHeight = titlebar ? titlebar.offsetHeight : 40; // Default to 40px if not found
        
        // Position dropdown relative to memory row
        dropdown.style.position = 'fixed';
        dropdown.style.top = `${memoryRowRect.bottom}px`;
        dropdown.style.left = `${memoryRowRect.left}px`;
        dropdown.style.width = `${memoryRowRect.width}px`;
        dropdown.style.right = 'auto'; // Reset right position
        
        // Calculate available space below memory row
        const availableSpace = viewportHeight - memoryRowRect.bottom;
        
        // Calculate maximum height
        const maxHeight = availableSpace - 20; // 20px buffer
        dropdown.style.maxHeight = `${Math.min(300, maxHeight)}px`;
    }
    
    // Close the memory dropdown
    closeMemoryDropdown() {
        this.memoryDropdownVisible = false;
        this.memoryDropdown.classList.remove('show');
    }
    
    // Render memory items in the dropdown
    renderMemoryItems() {
        this.memoryDropdown.innerHTML = '';
        
        if (this.memoryItems.length === 0) {
            const emptyMessage = document.createElement('div');
            emptyMessage.classList.add('memory-dropdown-empty');
            emptyMessage.textContent = 'No items in memory';
            this.memoryDropdown.appendChild(emptyMessage);
            return;
        }
        
        this.memoryItems.forEach((value, index) => {
            const item = document.createElement('div');
            item.classList.add('memory-dropdown-item');
            item.dataset.index = index;
            
            const valueElement = document.createElement('div');
            valueElement.classList.add('memory-dropdown-value');
            valueElement.textContent = this.useSeparator ? 
                this.formatDisplayValue(String(value)) : String(value);
            
            const actionsElement = document.createElement('div');
            actionsElement.classList.add('memory-dropdown-actions');
            
            // Add actions - MC (delete), M+ (add), M- (subtract)
            const deleteAction = document.createElement('button');
            deleteAction.classList.add('memory-dropdown-action');
            deleteAction.innerHTML = '<span class="material-icons-outlined" style="font-size: 16px;">delete_outline</span>';
            deleteAction.title = 'Remove from memory';
            deleteAction.dataset.action = 'delete';
            deleteAction.dataset.index = index;
            
            const addAction = document.createElement('button');
            addAction.classList.add('memory-dropdown-action');
            addAction.innerHTML = '<span class="material-icons-outlined" style="font-size: 16px;">add</span>';
            addAction.title = 'Add display value to this memory';
            addAction.dataset.action = 'add';
            addAction.dataset.index = index;
            
            const subtractAction = document.createElement('button');
            subtractAction.classList.add('memory-dropdown-action');
            subtractAction.innerHTML = '<span class="material-icons-outlined" style="font-size: 16px;">remove</span>';
            subtractAction.title = 'Subtract display value from this memory';
            subtractAction.dataset.action = 'subtract';
            subtractAction.dataset.index = index;
            
            actionsElement.appendChild(deleteAction);
            actionsElement.appendChild(addAction);
            actionsElement.appendChild(subtractAction);
            
            item.appendChild(valueElement);
            item.appendChild(actionsElement);
            
            this.memoryDropdown.appendChild(item);
        });
    }
    
    // Handle actions on memory items (delete, add, subtract)
    handleMemoryItemAction(index, action) {
        if (index < 0 || index >= this.memoryItems.length) return;
        
        const currentValue = parseFloat(this.displayValue);
        
        switch (action) {
            case 'delete':
                this.memoryItems.splice(index, 1);
                if (this.memoryItems.length > 0) {
                    this.memoryValue = this.memoryItems[0];
                } else {
                    this.memoryValue = 0;
                }
                break;
                
            case 'add':
                if (this.displayValue !== 'Error') {
                    this.memoryItems[index] += currentValue;
                    if (index === 0) {
                        this.memoryValue = this.memoryItems[0];
                    }
                }
                break;
                
            case 'subtract':
                if (this.displayValue !== 'Error') {
                    this.memoryItems[index] -= currentValue;
                    if (index === 0) {
                        this.memoryValue = this.memoryItems[0];
                    }
                }
                break;
        }
        
        this.updateMemoryIndicator();
        this.renderMemoryItems();
        this.savePreferences();
    }
    
    // Handle history item actions (delete)
    async handleHistoryItemAction(index, action) {
        if (isNaN(index) || index < 0) return;
        
        if (action === 'delete') {
            try {
                const history = await ipcRenderer.invoke('delete-history-item', index);
                this.renderHistoryItems(history);
            } catch (error) {
                handleIpcError(error);
            }
        }
    }
    
    // Add this method for version display
    async initializeVersionDisplay() {
        try {
            const versionElement = document.getElementById('app-version');
            if (versionElement) {
                // Get version from package.json via IPC
                const appVersion = await ipcRenderer.invoke('get-app-version');
                versionElement.textContent = `Version: ${appVersion}`;
                
                // Add click handler to copy version to clipboard
                versionElement.title = 'Click to copy version';
                versionElement.addEventListener('click', () => {
                    navigator.clipboard.writeText(appVersion)
                        .then(() => {
                            const originalText = versionElement.textContent;
                            versionElement.textContent = 'Copied!';
                            setTimeout(() => {
                                versionElement.textContent = originalText;
                            }, 1500);
                        });
                });
            }
        } catch (error) {
            console.error('Failed to initialize version display:', error);
        }
    }
    
    // Add method to safely open external links
    async openExternalLink(url) {
        try {
            await ipcRenderer.invoke('open-external-link', url);
        } catch (error) {
            console.error('Failed to open external link:', error);
        }
    }
}

// Initialize calculator when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new Calculator();
}); 