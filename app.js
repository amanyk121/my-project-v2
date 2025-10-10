   function toggleDropdown(event) {
    const dropdownMenu = event.currentTarget.querySelector('.dropdown-menu');
    if (dropdownMenu) {
        dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    }
}

// Dashboard dropdown function - appears on left click
function toggleDashboardDropdown(event) {
    event.preventDefault();
    event.stopPropagation();
    
    console.log('Dropdown button clicked', event.currentTarget);
    const dropdownMenu = event.currentTarget.nextElementSibling;
    if (dropdownMenu && dropdownMenu.classList.contains('dropdown-menu')) {
        // Toggle the dropdown menu
        const isVisible = dropdownMenu.style.display === 'block';
        dropdownMenu.style.display = isVisible ? 'none' : 'block';
        
        // Close other dropdowns if opening this one
        if (!isVisible) {
            document.querySelectorAll('.dropdown-menu').forEach(menu => {
                if (menu !== dropdownMenu && menu.style.display === 'block') {
                    menu.style.display = 'none';
                }
            });
        }
    }
}



// Global state management
let currentUser = null;
let currentRole = null;
let selectedRows = new Set(); // Track selected rows for highlighting
let assetsData = {
    laptops: [],
    monitors: [],
    printers: [],
    cameras: [],
    wifi: []
};
let employees = [];
let assignments = [];
let importMetadata = null;
let currentAssetCategory = 'laptops';

// Import history and rollback system
let importHistory = [];
const MAX_HISTORY_ENTRIES = 10;

// Change tracking for rollback
let changeHistory = [];
const MAX_CHANGE_HISTORY = 50;

// Notification System
const NOTIFICATION_TYPES = {
    SUCCESS: 'success',
    ERROR: 'error', 
    WARNING: 'warning',
    INFO: 'info'
};

const NOTIFICATION_DURATION = {
    SHORT: 3000,
    MEDIUM: 5000,
    LONG: 8000
};

function showNotification(message, type = NOTIFICATION_TYPES.INFO, duration = NOTIFICATION_DURATION.MEDIUM) {
    const container = document.getElementById('notification-container');
    if (!container) return;
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icon = getNotificationIcon(type);
    
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${icon}</span>
            <span class="notification-message">${escapeHtml(message)}</span>
        </div>
        <button class="notification-close" onclick="hideNotification(this.parentElement)">×</button>
    `;
    
    container.appendChild(notification);
    
    // Auto-dismiss after duration
    if (duration > 0) {
        setTimeout(() => {
            hideNotification(notification);
        }, duration);
    }
    
    return notification;
}

function hideNotification(notification) {
    if (!notification || !notification.classList) return;
    
    notification.classList.add('hiding');
    
    // Remove from DOM after animation completes
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 300);
}

function getNotificationIcon(type) {
    const icons = {
        [NOTIFICATION_TYPES.SUCCESS]: '✅',
        [NOTIFICATION_TYPES.ERROR]: '❌',
        [NOTIFICATION_TYPES.WARNING]: '⚠️',
        [NOTIFICATION_TYPES.INFO]: 'ℹ️'
    };
    return icons[type] || icons[NOTIFICATION_TYPES.INFO];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Convenience functions for common notification types
function showSuccess(message, duration = NOTIFICATION_DURATION.MEDIUM) {
    return showNotification(message, NOTIFICATION_TYPES.SUCCESS, duration);
}

function showError(message, duration = NOTIFICATION_DURATION.MEDIUM) {
    return showNotification(message, NOTIFICATION_TYPES.ERROR, duration);
}

function showWarning(message, duration = NOTIFICATION_DURATION.MEDIUM) {
    return showNotification(message, NOTIFICATION_TYPES.WARNING, duration);
}

function showInfo(message, duration = NOTIFICATION_DURATION.MEDIUM) {
    return showNotification(message, NOTIFICATION_TYPES.INFO, duration);
}

// Storage keys from config
const STORAGE_KEYS = {
    assets: 'nv_assets_data',
    employees: 'nv_employees_data',
    assignments: 'nv_assignments_data',
    metadata: 'nv_system_metadata',
    importHistory: 'nv_import_history',
    changeHistory: 'nv_change_history'
};

// Role permissions configuration
const ROLE_PERMISSIONS = {
    admin: {
        can_manage_employees: true,
        can_manage_assets: true,
        can_import_export: true,
        can_change_status: true,
        can_assign_unassign: true,
        can_view_all: true
    },
    user: {
        can_manage_employees: false,
        can_manage_assets: false,
        can_import_export: false,
        can_change_status: false,
        can_assign_unassign: true,
        can_view_all: true
    }
};

// Asset statuses configuration
const ASSET_STATUSES = {
    available: ['Available', 'In Stock', 'OK'],
    all: ['Available', 'Assigned', 'In Repair', 'Dead', 'In Stock', 'OK', 'Damaged', 'Under Maintenance']
};

// CORRECTED Excel sheet configurations with fixed column structures
const EXCEL_SHEETS = {
    "LAPTOP & DESKTOP": {
        key: "laptops",
        displayName: "Laptops & Desktops",
        columns: ["Serial No.", "Location", "Assets Code", "IP Address", "Assets Tag/No.", "laptop/PC", "Make", "Model", "Serial No", "Ram ", "HDD", "SSD", "Processor", "OS", "Office", "Anti Virus", "Keyboard Mouse", "User Name", "Deptt", "Status"],
        userColumn: "User Name",
        deptColumn: "Deptt",
        statusColumn: "Status",
        keyFields: ["Assets Tag/No.", "Serial No"],
        hasHeaderInFirstRow: false
    },
    "TFT & MONITERS": {
        key: "monitors",
        displayName: "TFT & Monitors",
        columns: ["S.NO", "LOCATION", "USERS", "ASSETS TAG", "ASSETS", "MAKE", "MODEL", "SERIAL NO."],
        userColumn: "USERS",
        locationColumn: "LOCATION",
        keyFields: ["ASSETS TAG", "SERIAL NO."],
        hasHeaderInFirstRow: true
    },
    "Printers & Scanners,PhotoState": {
        key: "printers",
        displayName: "Printers & Scanners",
        columns: ["S.NO.", "location", "ASSETS CODE", "IP Address", "Assets Tag/No.", "ASSETS", "MAKE", "MODEL", "SERIAL NUMBER"],
        locationColumn: "location",
        keyFields: ["Assets Tag/No.", "SERIAL NUMBER"],
        hasHeaderInFirstRow: true
    },
    "Camera": {
        key: "cameras",
        displayName: "Cameras",
        columns: ["Company Name", "Location ", "IP", "No. Of CCTV", "Recording "],
        locationColumn: "Location ",
        keyFields: ["IP"],
        hasHeaderInFirstRow: false
    },
    "wifi": {
        key: "wifi",
        displayName: "WiFi Devices",
        columns: ["Device Name", "IP"],
        keyFields: ["IP"],
        hasHeaderInFirstRow: true
    }
};

// Demo credentials
const demoCredentials = {
    admin: { username: 'admin', password: 'admin' },
    user: { username: 'user', password: 'user' }
};

// Initialize application
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded - Initializing app...');
    initializeApp();
});

function initializeApp() {
    console.log('Initializing application...');
    
    // Hide loading screen after 2 seconds
    setTimeout(() => {
        console.log('Hiding loading screen...');
        const loadingScreen = document.getElementById('loading-screen');
        const loginPage = document.getElementById('login-page');
        
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
        
        if (loginPage) {
            loginPage.classList.remove('hidden');
        }
        
        // Setup event listeners after DOM is ready
        setupEventListeners();
        loadPersistedData();
        clearDemoData(); // Clear any existing demo data
        loadDemoDataIfEmpty();
    }, 2000);
}

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Authentication
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        console.log('Login form found, attaching event listener');
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Login form submit event triggered');
            handleLogin(e);
        });
    }
    
    // Fix role dropdown issue
    const roleSelect = document.getElementById('role');
    if (roleSelect) {
        roleSelect.style.pointerEvents = 'auto';
        roleSelect.addEventListener('change', function() {
            console.log('Role selected:', this.value);
        });
    }
    
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const page = e.target.dataset.page;
            showPage(page);
        });
        
        // Add event listener for the Manage button
        if (btn.classList.contains('action-btn--manage')) {
            btn.addEventListener('click', toggleDropdown);
        }
    });
    
    // Excel file upload
    const excelInput = document.getElementById('excel-file-input');
    if (excelInput) {
        excelInput.addEventListener('change', handleExcelImport);
    }
    
    // Asset category tabs - Use event delegation
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-btn')) {
            const category = e.target.dataset.category;
            showAssetCategory(category);
            
            // Update active tab
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            e.target.classList.add('active');
        }
        
    // Handle table row selection
    if (e.target.closest('tr') && e.target.closest('tbody')) {
        const row = e.target.closest('tr');
        const rowId = row.dataset.rowId;
        
        if (rowId) {
            // Toggle selection
            if (selectedRows.has(rowId)) {
                selectedRows.delete(rowId);
                row.classList.remove('selected');
                // Hide dropdown when deselected
                const dropdownMenu = row.querySelector('.dropdown-menu');
                if (dropdownMenu) {
                    dropdownMenu.style.display = 'none';
                }
            } else {
                // Clear other selections in same table
                const table = row.closest('table');
                table.querySelectorAll('tr.selected').forEach(r => {
                    r.classList.remove('selected');
                    selectedRows.delete(r.dataset.rowId);
                    // Hide dropdowns from other rows
                    const otherDropdown = r.querySelector('.dropdown-menu');
                    if (otherDropdown) {
                        otherDropdown.style.display = 'none';
                    }
                });
                
                selectedRows.add(rowId);
                row.classList.add('selected');
                
                // Show dropdown for selected row
                const dropdownMenu = row.querySelector('.dropdown-menu');
                if (dropdownMenu) {
                    dropdownMenu.style.display = 'block';
                }
            }
        }
    }
    });
    
    // Search functionality
    const assetSearch = document.getElementById('asset-search');
    if (assetSearch) {
        assetSearch.addEventListener('input', handleAssetSearch);
    }
    
    const assignmentSearch = document.getElementById('assignment-search');
    if (assignmentSearch) {
        assignmentSearch.addEventListener('input', handleAssignmentSearch);
    }
    
    const employeeSearch = document.getElementById('employee-search');
    if (employeeSearch) {
        employeeSearch.addEventListener('input', handleEmployeeSearch);
    }
    
    // Forms
    const addAssetForm = document.getElementById('add-asset-form');
    if (addAssetForm) {
        addAssetForm.addEventListener('submit', handleAddAsset);

        // Add category change listener
        const categorySelect = addAssetForm.querySelector('[name="category"]');
        if (categorySelect) {
            categorySelect.addEventListener('change', function() {
                populateAddAssetForm(this.value);
            });
        }
    }
    
    const addEmployeeForm = document.getElementById('add-employee-form');
    if (addEmployeeForm) {
        addEmployeeForm.addEventListener('submit', handleAddEmployee);
    }
    
    const assignAssetForm = document.getElementById('assign-asset-form');
    if (assignAssetForm) {
        assignAssetForm.addEventListener('submit', handleAssignAsset);
    }
    
    const editStatusForm = document.getElementById('edit-status-form');
    if (editStatusForm) {
        editStatusForm.addEventListener('submit', handleEditStatus);
    }
    
    // Assignment filters
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            const filter = e.target.dataset.filter;
            const section = e.target.closest('.assignment-section');
            
            if (section) {
                filterAssignmentSection(section, filter);
                // Update active filter
                section.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
            }
        }
        
        // Deselect rows when clicking outside of table rows
        if (!e.target.closest('tr') && !e.target.closest('.dropdown-menu')) {
            const selectedRowsElements = document.querySelectorAll('tr.selected');
            selectedRowsElements.forEach(row => {
                row.classList.remove('selected');
                const dropdownMenu = row.querySelector('.dropdown-menu');
                if (dropdownMenu) {
                    dropdownMenu.style.display = 'none';
                }
            });
            // Clear selectedRows Set
            selectedRows.clear();
        }
    });
    
// Modal close handlers
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.add('hidden');
    }
});


    // Set default assignment date
    const today = new Date().toISOString().split('T')[0];
    const assignmentDateInput = document.querySelector('#assign-asset-form [name="assignmentDate"]');
    if (assignmentDateInput) {
        assignmentDateInput.value = today;
    }
    
    console.log('Event listeners setup complete');
}

// Role-based UI management
function applyRoleRestrictions() {
    const mainApp = document.getElementById('main-app');
    if (!mainApp || !currentRole) return;
    
    const permissions = ROLE_PERMISSIONS[currentRole];
    
    if (currentRole === 'user') {
        mainApp.classList.add('user-mode');
        
        // Hide admin-only elements
        document.querySelectorAll('.admin-only').forEach(element => {
            element.style.display = 'none';
        });
        
        // Update action labels for user-friendly interface
        const dashboardActions = document.querySelectorAll('.dashboard-actions .btn');
        dashboardActions.forEach(btn => {
            if (btn.textContent.includes('Manage')) {
                btn.textContent = btn.textContent.replace('Manage', 'View');
            }
        });
    } else {
        mainApp.classList.remove('user-mode');
        
        // Show admin elements
        document.querySelectorAll('.admin-only').forEach(element => {
            element.style.display = '';
        });
    }
}

// --- Server persistence layer (Netlify Functions) ---
// Note: available server functions in this project: addAssets, addEmployee, assignAsset, getassets, getemployees

// Save a single asset to the database via the addAssets Netlify function.
// Expects: category (table name key) and asset object (fields). Returns the inserted row.
async function saveAsset(category, asset) {
    try {
        const res = await fetch('/.netlify/functions/addassets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Avoid sending client-generated string IDs for tables that use integer primary keys.
            // Send all fields except `id` so the DB can assign its own primary key.
            body: JSON.stringify({ category, ...(() => {
                const copy = { ...asset };
                if (copy.id && typeof copy.id === 'string' && !/^[0-9]+$/.test(copy.id)) {
                    delete copy.id;
                }
                return copy;
            })() }),
        });

        const result = await res.json();

        if (result && result.success) {
            console.log('✅ Asset saved to Neon DB:', result.inserted);
            // Ensure in-memory array exists
            if (!assetsData[category]) assetsData[category] = [];
            // Unshift the inserted record so newest appear first
            assetsData[category].unshift(result.inserted);
            updateAssetsDisplay();
            updateDashboardStats();
            return result.inserted;
        } else {
            console.error('❌ Failed to save asset:', result);
            throw new Error(result?.error || 'Failed to save asset');
        }
    } catch (err) {
        console.error('Error saving asset to server:', err);
        throw err;
    }
}

// Assign an asset using the assignAsset Netlify function. Updates DB and returns success flag.
async function assignAssetServer(asset_type, asset_id, employee_id) {
    try {
        const res = await fetch('/.netlify/functions/assignasset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ asset_type, asset_id, employee_id })
        });

        const result = await res.json();

        if (result && result.success) {
            console.log('✅ Assignment saved to Neon DB');
            return true;
        } else {
            console.error('❌ Failed to assign asset on server:', result);
            return false;
        }
    } catch (err) {
        console.error('Error assigning asset on server:', err);
        return false;
    }
}

// Load initial data from server (assets + employees). Falls back to localStorage if server is unavailable.
async function loadPersistedData() {
    try {
        const [assetsRes, empRes] = await Promise.all([
            fetch('/.netlify/functions/getassets'),
            fetch('/.netlify/functions/getemployees')
        ]);

        if (!assetsRes.ok || !empRes.ok) throw new Error('Non-OK response');

        const assets = await assetsRes.json();
        const employeesData = await empRes.json();

        // Normalize into expected shape
        assetsData = {
            laptops: assets.laptops || [],
            monitors: assets.monitors || [],
            printers: assets.printers || [],
            cameras: assets.cameras || [],
            wifi: assets.wifi || []
        };

        employees = Array.isArray(employeesData) ? employeesData : (employeesData || []);

        console.log('✅ Data loaded from Neon DB');
        updateDashboardStats();
        updateAssetsDisplay();
        updateEmployeesTable();
        updateAssignmentsDisplay();
    } catch (error) {
        console.warn('⚠️ Failed to load data from Neon DB, falling back to localStorage if available:', error);

        // Attempt fallback to localStorage for users who still have older state locally
        try {
            const assetsRaw = localStorage.getItem(STORAGE_KEYS.assets);
            const employeesRaw = localStorage.getItem(STORAGE_KEYS.employees);
            if (assetsRaw) assetsData = JSON.parse(assetsRaw);
            if (employeesRaw) employees = JSON.parse(employeesRaw);

            updateDashboardStats();
            updateAssetsDisplay();
            updateEmployeesTable();
            updateAssignmentsDisplay();

            showWarning('Running in offline/fallback mode: using local cached data. Server persistence unavailable.');
        } catch (e) {
            console.error('No persisted local data available:', e);
            // Still initialize empty structures so app doesn't crash
            assetsData = { laptops: [], monitors: [], printers: [], cameras: [], wifi: [] };
            employees = [];
        }
    }
}

// Generic local save used as a fallback by other code paths
function saveData() {
    try {
        localStorage.setItem(STORAGE_KEYS.assets, JSON.stringify(assetsData));
    } catch (e) { console.warn('Could not persist assets to localStorage', e); }
    try {
        localStorage.setItem(STORAGE_KEYS.employees, JSON.stringify(employees));
    } catch (e) { console.warn('Could not persist employees to localStorage', e); }
    try {
        localStorage.setItem(STORAGE_KEYS.assignments, JSON.stringify(assignments));
    } catch (e) { console.warn('Could not persist assignments to localStorage', e); }
    try {
        localStorage.setItem(STORAGE_KEYS.importHistory, JSON.stringify(importHistory));
    } catch (e) { }
    try {
        localStorage.setItem(STORAGE_KEYS.changeHistory, JSON.stringify(changeHistory));
    } catch (e) { }
}


// Backup and restore functions
function createBackup() {
    return {
        timestamp: new Date().toISOString(),
        assetsData: JSON.parse(JSON.stringify(assetsData)),
        employees: JSON.parse(JSON.stringify(employees)),
        assignments: JSON.parse(JSON.stringify(assignments))
    };
}

function restoreFromBackup(backup) {
    assetsData = JSON.parse(JSON.stringify(backup.assetsData));
    employees = JSON.parse(JSON.stringify(backup.employees));
    assignments = JSON.parse(JSON.stringify(backup.assignments));
    
    saveData();
    updateDashboardStats();
    updateAssetsDisplay();
    updateEmployeesTable();
    updateAssignmentsDisplay();
}

function addToChangeHistory(action, details) {
    changeHistory.unshift({
        timestamp: new Date().toISOString(),
        action: action,
        details: details,
        backup: createBackup()
    });
    
    // Keep only the most recent changes
    if (changeHistory.length > MAX_CHANGE_HISTORY) {
        changeHistory = changeHistory.slice(0, MAX_CHANGE_HISTORY);
    }
    
    saveData();
}

function addToImportHistory(fileName, importedData, mergeResults) {
    importHistory.unshift({
        timestamp: new Date().toISOString(),
        fileName: fileName,
        importedData: importedData,
        mergeResults: mergeResults,
        backup: createBackup()
    });
    
    // Keep only the most recent imports
    if (importHistory.length > MAX_HISTORY_ENTRIES) {
        importHistory = importHistory.slice(0, MAX_HISTORY_ENTRIES);
    }
    
    // Persist metadata to localStorage as a safe fallback
    try { localStorage.setItem(STORAGE_KEYS.importHistory, JSON.stringify(importHistory)); } catch (e) {}
}

function rollbackLastImport() {
    if (importHistory.length === 0) {
        showError('No imports to rollback.');
        return;
    }
    
    const lastImport = importHistory.shift();
    restoreFromBackup(lastImport.backup);
    showSuccess(`Rollback successful: Import from ${lastImport.fileName} has been reverted.`);
}

function showImportHistory() {
    if (importHistory.length === 0) {
        showInfo('No import history available.');
        return;
    }
    
    // Create a modal or display to show import history
    const historyList = importHistory.map(function(importItem) {
        return `${new Date(importItem.timestamp).toLocaleString()} - ${importItem.fileName} (${importItem.mergeResults.totalImported} items)`;
    }).join('\n');
    
    alert(`Import History:\n\n${historyList}`);
}

function undoLastChange() {
    if (changeHistory.length === 0) {
        showError('No changes to undo.');
        return;
    }
    
    const lastChange = changeHistory.shift();
    restoreFromBackup(lastChange.backup);
    showSuccess(`Undo successful: ${lastChange.action}`);
}

function clearAllData() {
    if (currentRole !== 'admin') {
        showError('Only administrators can clear all data.');
        return;
    }
    
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
        localStorage.removeItem(STORAGE_KEYS.assets);
        localStorage.removeItem(STORAGE_KEYS.employees);
        localStorage.removeItem(STORAGE_KEYS.assignments);
        localStorage.removeItem(STORAGE_KEYS.metadata);
        localStorage.removeItem(STORAGE_KEYS.importHistory);
        localStorage.removeItem(STORAGE_KEYS.changeHistory);
        
        assetsData = { laptops: [], monitors: [], printers: [], cameras: [], wifi: [] };
        employees = [];
        assignments = [];
        importMetadata = null;
        importHistory = [];
        changeHistory = [];
        selectedRows.clear();
        
        updateDashboardStats();
        updateAssetsDisplay();
        updateEmployeesTable();
        updateAssignmentsDisplay();
        
        showSuccess('All data has been cleared successfully.');
    }
}

function loadDemoDataIfEmpty() {
    // Never load demo data - always return without loading
    return;
}

function clearDemoData() {
    // Clear any existing demo data from localStorage
    const demoKeys = ['LAPTOP1', 'LAPTOP2', 'MONITOR1', 'EMP1', 'EMP2'];
    let hasDemoData = false;

    // Check if any demo data exists in current data
    Object.values(assetsData).forEach(categoryAssets => {
        categoryAssets.forEach(asset => {
            if (demoKeys.includes(asset.id)) {
                hasDemoData = true;
            }
        });
    });

    employees.forEach(emp => {
        if (demoKeys.includes(emp.id)) {
            hasDemoData = true;
        }
    });

    if (hasDemoData) {
        // Remove demo assets
        Object.keys(assetsData).forEach(category => {
            assetsData[category] = assetsData[category].filter(asset => !demoKeys.includes(asset.id));
        });

        // Remove demo employees
        employees = employees.filter(emp => !demoKeys.includes(emp.id));

        saveData();
        console.log('Demo data cleared from localStorage');
    }
}

// Dynamic form population function
function populateAddAssetForm(category) {
    const formGrid = document.querySelector('#add-asset-form .form-grid');
    if (!formGrid) return;

    // Clear existing dynamic fields
    formGrid.innerHTML = '';

    if (!category) {
        // Show category selection only
        return;
    }

    const config = Object.values(EXCEL_SHEETS).find(s => s.key === category);
    if (!config) return;

    // Create form fields for each column
    config.columns.forEach(column => {
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';

        const label = document.createElement('label');
        label.className = 'form-label';
        label.textContent = column;
        label.setAttribute('for', `asset-${column.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`);

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'form-control';
        input.name = column;
        input.id = `asset-${column.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;

        // Set required for key fields
        if (config.keyFields && config.keyFields.includes(column)) {
            input.required = true;
            label.innerHTML += ' <span style="color: red;">*</span>';
        }

        formGroup.appendChild(label);
        formGroup.appendChild(input);
        formGrid.appendChild(formGroup);
    });
}


// Authentication Functions
function handleLogin(e) {
    console.log('Login handler called');
    e.preventDefault();
    
    const roleSelect = document.getElementById('role');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    
    if (!roleSelect || !usernameInput || !passwordInput) {
        console.error('Form elements not found');
        alert('Form elements not found. Please refresh the page.');
        return false;
    }
    
    const role = roleSelect.value;
    const username = usernameInput.value.trim();
    const password = passwordInput.value.trim();
    
    console.log('Login attempt:', { role, username, password: '***' });
    
    // Enhanced validation
    if (!role) {
        showError('Please select a role.', NOTIFICATION_DURATION.SHORT);
        roleSelect.focus();
        return false;
    }
    
    if (!username) {
        showError('Please enter your username.', NOTIFICATION_DURATION.SHORT);
        usernameInput.focus();
        return false;
    }
    
    if (!password) {
        showError('Please enter your password.', NOTIFICATION_DURATION.SHORT);
        passwordInput.focus();
        return false;
    }
    
    // Check credentials
    if (demoCredentials[role] && 
        demoCredentials[role].username === username && 
        demoCredentials[role].password === password) {
        
        console.log('Login successful');
        
        currentUser = username;
        currentRole = role;
        
        // Update user info in header
        const currentUserSpan = document.getElementById('current-user');
        const currentRoleSpan = document.getElementById('current-role');
        
        if (currentUserSpan) currentUserSpan.textContent = username;
        if (currentRoleSpan) currentRoleSpan.textContent = role.charAt(0).toUpperCase() + role.slice(1);
        
        // Switch to main app
        const loginPage = document.getElementById('login-page');
        const mainApp = document.getElementById('main-app');
        
        if (loginPage) {
            loginPage.classList.add('hidden');
        }
        if (mainApp) {
            mainApp.classList.remove('hidden');
        }
        
        // Apply role restrictions
        applyRoleRestrictions();
        
        // Show dashboard
        showPage('dashboard');
        return true;
    } else {
        console.log('Login failed - invalid credentials');
        showError('Invalid credentials. Please check your role, username, and password.\n\nDemo credentials:\nAdmin: admin/admin\nUser: user/user', NOTIFICATION_DURATION.SHORT);
        return false;
    }
}

function logout() {
    console.log('User logging out');
    currentUser = null;
    currentRole = null;
    selectedRows.clear();
    
    const mainApp = document.getElementById('main-app');
    const loginPage = document.getElementById('login-page');
    
    if (mainApp) mainApp.classList.add('hidden');
    if (loginPage) loginPage.classList.remove('hidden');
    
    // Reset forms
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.reset();
    }
}

// Navigation Functions
function showPage(pageName) {
    console.log('Showing page:', pageName);
    
    // Clear selections when changing pages
    selectedRows.clear();
    
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.add('hidden');
    });
    
    // Show selected page
    const targetPage = document.getElementById(`${pageName}-page`);
    if (targetPage) {
        targetPage.classList.remove('hidden');
    }
    
    // Update navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`[data-page="${pageName}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // Load page content
    switch(pageName) {
        case 'dashboard':
            updateDashboardStats();
            updateImportStatus();
            break;
        case 'assets':
            updateAssetsDisplay();
            break;
        case 'assignments':
            updateAssignmentsDisplay();
            break;
        case 'employees':
            updateEmployeesTable();
            break;
    }
}

// Asset status checking functions
function isAssetAvailable(asset) {
    // Check multiple status fields and user assignment
    const status = asset.Status || asset.status || 'Available';
    const user = asset['User Name'] || asset.USERS || '';
    
    // Asset is available if:
    // 1. Status is in available statuses OR
    // 2. No user assigned OR 
    // 3. User is empty/placeholder value
    const statusAvailable = ASSET_STATUSES.available.includes(status) || 
                           status.trim() === '' || 
                           status === 'Available';
    
    const userAvailable = !user || 
                         user.trim() === '' || 
                         ['Available', 'IN STOCK', 'DEAD', 'Transfer', 'N/A', 'NA'].includes(user.trim());
    
    return statusAvailable && userAvailable;
}

function getAssetStatusClass(asset) {
    const status = asset.Status || asset.status || 'Available';
    const isAvailable = isAssetAvailable(asset);
    
    if (isAvailable) return 'available';
    if (['In Repair', 'Under Maintenance'].includes(status)) return 'repair';
    if (['Dead', 'Damaged'].includes(status)) return 'dead';
    return 'assigned';
}

function getAssetStatusDisplay(asset) {
    const status = asset.Status || asset.status;
    const user = asset['User Name'] || asset.USERS;
    
    if (isAssetAvailable(asset)) {
        return status || 'Available';
    } else if (user && user.trim()) {
        return 'Assigned';
    }
    return status || 'Available';
}

// Dashboard Functions
function updateDashboardStats() {
    const totalAssets = Object.values(assetsData).reduce((sum, arr) => sum + arr.length, 0);
    let assignedAssets = 0;
    let availableAssets = 0;
    
    // Count assigned/available assets across all categories
    Object.values(assetsData).forEach(categoryAssets => {
        categoryAssets.forEach(asset => {
            if (isAssetAvailable(asset)) {
                availableAssets++;
            } else {
                assignedAssets++;
            }
        });
    });
    
    const totalEmployees = employees.length;
    
    const totalAssetsEl = document.getElementById('total-assets');
    const assignedAssetsEl = document.getElementById('assigned-assets');
    const availableAssetsEl = document.getElementById('available-assets');
    const totalEmployeesEl = document.getElementById('total-employees');
    
    if (totalAssetsEl) totalAssetsEl.textContent = totalAssets;
    if (assignedAssetsEl) assignedAssetsEl.textContent = assignedAssets;
    if (availableAssetsEl) availableAssetsEl.textContent = availableAssets;
    if (totalEmployeesEl) totalEmployeesEl.textContent = totalEmployees;
    
    // Update breakdown details
    const breakdown = Object.keys(assetsData).map(key => {
        const config = Object.values(EXCEL_SHEETS).find(s => s.key === key);
        return `${config?.displayName || key}: ${assetsData[key].length}`;
    }).join(' | ');
    
    const breakdownElement = document.getElementById('total-breakdown');
    if (breakdownElement) {
        breakdownElement.textContent = breakdown;
    }
}

function updateImportStatus() {
    const statusElement = document.getElementById('import-status');
    if (!statusElement) return;
    
    if (importMetadata) {
        statusElement.classList.remove('hidden');
        statusElement.innerHTML = `
            <h4>📊 Last Import Status</h4>
            <p><strong>File:</strong> ${importMetadata.fileName}</p>
            <p><strong>Date:</strong> ${new Date(importMetadata.importDate).toLocaleString()}</p>
            <p><strong>Records Imported:</strong> ${Object.entries(importMetadata.recordCounts)
                .map(([key, count]) => {
                    const config = Object.values(EXCEL_SHEETS).find(s => s.key === key);
                    return `${config?.displayName || key}: ${count}`;
                })
                .join(', ')}</p>
        `;
    } else {
        statusElement.classList.add('hidden');
    }
}

// Enhanced Assignment Display Functions
function updateAssignmentsDisplay() {
    updateAvailableAssetsTable();
    updateAssignedAssetsTable();
}

function updateAvailableAssetsTable() {
    const tbody = document.getElementById('available-assets-table-body');
    const countElement = document.getElementById('available-count');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    let availableCount = 0;
    
    // Only show truly available assets
    Object.entries(assetsData).forEach(([category, assets]) => {
        const config = Object.values(EXCEL_SHEETS).find(s => s.key === category);
        
        assets.filter(isAssetAvailable).forEach(asset => {
            availableCount++;
            
            const row = createAssetRow(asset, category, config, 'available');
            tbody.appendChild(row);
        });
    });
    
    if (countElement) {
        countElement.textContent = availableCount;
    }
    
    if (availableCount === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No available assets found</td></tr>';
    }
}

function updateAssignedAssetsTable() {
    const tbody = document.getElementById('assigned-assets-table-body');
    const countElement = document.getElementById('assigned-count');
    
    if (!tbody) return;
    
    tbody.innerHTML = '';
    let assignedCount = 0;
    
    // Only show assigned assets
    Object.entries(assetsData).forEach(([category, assets]) => {
        const config = Object.values(EXCEL_SHEETS).find(s => s.key === category);
        
        assets.filter(asset => !isAssetAvailable(asset)).forEach(asset => {
            assignedCount++;
            
            const row = createAssetRow(asset, category, config, 'assigned');
            tbody.appendChild(row);
        });
    });
    
    if (countElement) {
        countElement.textContent = assignedCount;
    }
    
    if (assignedCount === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No assigned assets found</td></tr>';
    }
}

function createAssetRow(asset, category, config, type) {
    const row = document.createElement('tr');
    const rowId = `${category}-${asset.id}`;
    row.dataset.rowId = rowId;
    
    // Get asset details based on category
    const assetTag = getAssetTag(asset, category);
    const assetType = getAssetType(asset, category);
    const makeModel = getMakeModel(asset, category);
    const location = getLocation(asset, category);
    const userName = asset['User Name'] || asset.USERS || '-';
    const department = asset.Deptt || asset.Department || '-';
    const status = getAssetStatusDisplay(asset);
    const statusClass = getAssetStatusClass(asset);
    
    if (type === 'available') {
        row.innerHTML = `
            <td>${config?.displayName || category}</td>
            <td>${assetTag}</td>
            <td>${assetType}</td>
            <td>${makeModel}</td>
            <td>${location}</td>
            <td><span class="status-badge status-${statusClass}">${status}</span></td>
            <td>
                <button class="action-btn action-btn--assign" onclick="quickAssignAsset('${asset.id}', '${category}')">Assign</button>
                ${ROLE_PERMISSIONS[currentRole]?.can_change_status ? 
                    `<button class="action-btn action-btn--status" onclick="editAssetStatus('${asset.id}', '${category}')">Status</button>` : ''}
            </td>
        `;
    } else {
        row.innerHTML = `
            <td>${config?.displayName || category}</td>
            <td>${assetTag}</td>
            <td>${assetType}</td>
            <td>${makeModel}</td>
            <td>${userName}</td>
            <td>${department}</td>
            <td>${location}</td>
            <td><span class="status-badge status-${statusClass}">${status}</span></td>
            <td>
                <button class="action-btn action-btn--unassign" onclick="unassignAsset('${asset.id}', '${category}')">Unassign</button>
                ${ROLE_PERMISSIONS[currentRole]?.can_change_status ? 
                    `<button class="action-btn action-btn--status" onclick="editAssetStatus('${asset.id}', '${category}')">Status</button>` : ''}
            </td>
        `;
    }
    
    return row;
}

// Helper functions for asset data extraction
function getAssetTag(asset, category) {
    if (category === 'laptops') return asset['Assets Tag/No.'] || 'N/A';
    if (category === 'monitors') return asset['ASSETS TAG'] || 'N/A';
    if (category === 'printers') return asset['Assets Tag/No.'] || 'N/A';
    if (category === 'cameras') return asset['IP'] || 'N/A';
    if (category === 'wifi') return asset['IP'] || 'N/A';
    return 'N/A';
}

function getAssetType(asset, category) {
    if (category === 'laptops') return asset['laptop/PC'] || 'N/A';
    if (category === 'monitors') return asset['ASSETS'] || 'Monitor';
    if (category === 'printers') return asset['ASSETS'] || 'Printer';
    if (category === 'cameras') return 'Camera';
    if (category === 'wifi') return 'WiFi Device';
    return 'N/A';
}

function getMakeModel(asset, category) {
    if (category === 'laptops') {
        return `${asset['Make'] || ''} ${asset['Model'] || ''}`.trim() || 'N/A';
    }
    if (category === 'monitors' || category === 'printers') {
        return `${asset['MAKE'] || ''} ${asset['MODEL'] || ''}`.trim() || 'N/A';
    }
    if (category === 'cameras') {
        return asset['Company Name'] || 'N/A';
    }
    if (category === 'wifi') {
        return asset['Device Name'] || 'N/A';
    }
    return 'N/A';
}

function getLocation(asset, category) {
    if (category === 'laptops') return asset['Location'] || 'N/A';
    if (category === 'monitors') return asset['LOCATION'] || 'N/A';
    if (category === 'printers') return asset['location'] || 'N/A';
    if (category === 'cameras') return asset['Location '] || 'N/A';
    if (category === 'wifi') return 'N/A';
    return 'N/A';
}

// Filter assignment sections
function filterAssignmentSection(section, filter) {
    const rows = section.querySelectorAll('tbody tr');
    
    rows.forEach(row => {
        if (filter.startsWith('all-')) {
            row.style.display = '';
        } else {
            const categoryCell = row.cells[0];
            if (categoryCell) {
                const shouldShow = categoryCell.textContent.toLowerCase().includes(filter.toLowerCase());
                row.style.display = shouldShow ? '' : 'none';
            }
        }
    });
}

// Asset status editing
function editAssetStatus(id, category) {
    if (currentRole !== 'admin') {
        alert('Only administrators can change asset status.');
        return;
    }
    
    const asset = assetsData[category].find(a => a.id === id);
    if (!asset) return;
    
    const config = Object.values(EXCEL_SHEETS).find(s => s.key === category);
    const assetTag = getAssetTag(asset, category);
    const makeModel = getMakeModel(asset, category);
    const currentStatus = getAssetStatusDisplay(asset);
    
    // Populate modal
    const assetInfoInput = document.getElementById('edit-status-asset-info');
    const currentStatusInput = document.getElementById('edit-status-current');
    const assetIdInput = document.getElementById('edit-status-asset-id');
    const categoryInput = document.getElementById('edit-status-asset-category');
    
    if (assetInfoInput) assetInfoInput.value = `${config?.displayName || category} - ${assetTag} (${makeModel})`;
    if (currentStatusInput) currentStatusInput.value = currentStatus;
    if (assetIdInput) assetIdInput.value = id;
    if (categoryInput) categoryInput.value = category;
    
    showModal('edit-status-modal');
}

function handleEditStatus(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    
    const assetId = formData.get('assetId');
    const category = formData.get('assetCategory');
    const newStatus = formData.get('newStatus');
    
    if (!assetId || !category || !newStatus) {
        showError('Please fill in all required fields.', NOTIFICATION_DURATION.SHORT);
        return;
    }
    
    const asset = assetsData[category].find(a => a.id === assetId);
    if (asset) {
        // Update status based on category
        if (category === 'laptops') {
            asset.Status = newStatus;
            // If setting to available status, clear user assignment
            if (ASSET_STATUSES.available.includes(newStatus)) {
                asset['User Name'] = '';
                asset.Deptt = '';
            }
        } else if (category === 'monitors') {
            // For monitors, we use USERS field to indicate assignment
            if (ASSET_STATUSES.available.includes(newStatus)) {
                asset.USERS = '';
            }
            asset.status = newStatus; // Add status field
        } else {
            asset.status = newStatus;
        }
        
        saveData();
        updateAssignmentsDisplay();
        updateAssetsDisplay();
        updateDashboardStats();
        hideModal('edit-status-modal');
        showSuccess('Asset status updated successfully!');
    }
}

// Continue with remaining functions...
// Excel Import Functions
function handleExcelImport(e) {
    if (currentRole !== 'admin') {
        showError('Only administrators can import Excel files.');
        return;
    }
    
    const file = e.target.files[0];
    if (!file) return;
    
    showImportModal();
    
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const workbook = XLSX.read(event.target.result, { type: 'binary' });
            processExcelWorkbook(workbook, file.name);
        } catch (error) {
            console.error('Error reading Excel file:', error);
            showError('Error reading Excel file. Please check the format.');
            hideModal('import-status-modal');
        }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
}

function showImportModal() {
    const modal = document.getElementById('import-status-modal');
    const progressDiv = document.getElementById('import-progress');
    const resultsDiv = document.getElementById('import-results');
    
    if (progressDiv) {
        progressDiv.innerHTML = `
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
            <p>Initializing import...</p>
        `;
    }
    if (resultsDiv) {
        resultsDiv.innerHTML = '';
    }
    
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function updateImportProgress(percentage, message) {
    const progressFill = document.querySelector('.progress-fill');
    const progressText = document.querySelector('#import-progress p');
    
    if (progressFill) {
        progressFill.style.width = percentage + '%';
    }
    if (progressText) {
        progressText.textContent = message;
    }
}

function processExcelWorkbook(workbook, fileName) {
    const results = [];
    let processedSheets = 0;
    const totalSheets = workbook.SheetNames.length;
    const recordCounts = {};
    
    updateImportProgress(10, 'Processing sheets...');
    
    workbook.SheetNames.forEach((sheetName, index) => {
        setTimeout(() => {
            const result = processExcelSheet(workbook.Sheets[sheetName], sheetName);
            results.push(result);
            recordCounts[result.category] = result.recordCount;
            
            processedSheets++;
            const progress = 10 + (processedSheets / totalSheets) * 80;
            updateImportProgress(progress, `Processed ${processedSheets}/${totalSheets} sheets`);
            
            if (processedSheets === totalSheets) {
                finishImport(results, fileName, recordCounts);
            }
        }, index * 500);
    });
}

function processExcelSheet(worksheet, sheetName) {
    const config = EXCEL_SHEETS[sheetName];
    if (!config) {
        return {
            sheetName: sheetName,
            category: 'unknown',
            status: 'warning',
            message: `Sheet '${sheetName}' not recognized - skipped`,
            recordCount: 0
        };
    }
    
    try {
        let data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (data.length === 0) {
            return {
                sheetName: sheetName,
                category: config.key,
                status: 'warning',
                message: `Sheet '${sheetName}' is empty`,
                recordCount: 0
            };
        }
        
        if (config.hasHeaderInFirstRow && data.length > 1) {
            data = data.slice(1);
        }
        
        const processedAssets = data.map((row, index) => {
            if (!row || row.every(cell => !cell)) return null;
            
            const asset = { id: `${config.key.toUpperCase()}${Date.now()}${index}` };
            
            config.columns.forEach((column, colIndex) => {
                asset[column] = row[colIndex] || '';
            });
            
            return asset;
        }).filter(asset => asset !== null);
        
        // Merge instead of replace
        const existingAssets = assetsData[config.key] || [];
        const mergeResult = mergeAssets(existingAssets, processedAssets, config);

        assetsData[config.key] = mergeResult.mergedAssets;
        
        return {
            sheetName: sheetName,
            category: config.key,
            status: 'success',
            message: `Successfully merged ${processedAssets.length} ${config.displayName.toLowerCase()} (${mergeResult.results.newAssets} new, ${mergeResult.results.updatedAssets} updated, ${mergeResult.results.conflicts} conflicts)`,
            recordCount: processedAssets.length,
            mergeResults: mergeResult.results
        };
        
    } catch (error) {
        console.error('Error processing sheet:', sheetName, error);
        return {
            sheetName: sheetName,
            category: config.key,
            status: 'error',
            message: `Error processing '${sheetName}': ${error.message}`,
            recordCount: 0
        };
    }
}

function mergeAssets(existingAssets, newAssets, config) {
    const mergeResults = {
        totalImported: newAssets.length,
        newAssets: 0,
        updatedAssets: 0,
        conflicts: 0,
        skippedAssets: 0
    };
    
    const mergedAssets = [...existingAssets];
    
    newAssets.forEach(newAsset => {
        // Find existing asset by key fields
        let existingAsset = null;
        let existingIndex = -1;
        
        if (config.keyFields && config.keyFields.length > 0) {
            // Try to find by key fields
            existingIndex = mergedAssets.findIndex(existing => {
                return config.keyFields.some(keyField => {
                    const existingValue = existing[keyField];
                    const newValue = newAsset[keyField];
                    return existingValue && newValue && 
                           existingValue.toString().trim().toLowerCase() === 
                           newValue.toString().trim().toLowerCase();
                });
            });
            
            if (existingIndex !== -1) {
                existingAsset = mergedAssets[existingIndex];
            }
        }
        
        if (existingAsset) {
            // Asset exists - merge the data
            let hasConflict = false;
            
            // Check for conflicts in key fields
            config.keyFields.forEach(keyField => {
                const existingValue = existingAsset[keyField];
                const newValue = newAsset[keyField];
                
                if (existingValue && newValue && 
                    existingValue.toString().trim().toLowerCase() !== 
                    newValue.toString().trim().toLowerCase()) {
                    hasConflict = true;
                }
            });
            
            if (hasConflict) {
                mergeResults.conflicts++;
                // For now, skip conflicting assets (could be enhanced with conflict resolution)
                mergeResults.skippedAssets++;
                return;
            }
            
            // Merge non-key fields (prefer new data)
            Object.keys(newAsset).forEach(key => {
                if (!config.keyFields.includes(key) && newAsset[key]) {
                    existingAsset[key] = newAsset[key];
                }
            });
            
            mergeResults.updatedAssets++;
        } else {
            // New asset - add to merged array
            mergedAssets.push(newAsset);
            mergeResults.newAssets++;
        }
    });
    
    return {
        mergedAssets: mergedAssets,
        results: mergeResults
    };
}

function finishImport(results, fileName, recordCounts) {
    updateImportProgress(100, 'Import completed!');
    
    // Calculate total merge results
    const totalMergeResults = {
        totalImported: 0,
        newAssets: 0,
        updatedAssets: 0,
        conflicts: 0,
        skippedAssets: 0
    };
    
    results.forEach(result => {
        if (result.mergeResults) {
            totalMergeResults.totalImported += result.mergeResults.totalImported || 0;
            totalMergeResults.newAssets += result.mergeResults.newAssets || 0;
            totalMergeResults.updatedAssets += result.mergeResults.updatedAssets || 0;
            totalMergeResults.conflicts += result.mergeResults.conflicts || 0;
            totalMergeResults.skippedAssets += result.mergeResults.skippedAssets || 0;
        }
    });
    
    importMetadata = {
        fileName: fileName,
        importDate: new Date().toISOString(),
        recordCounts: recordCounts,
        mergeResults: totalMergeResults
    };
    
    // Add to import history with merge results
    addToImportHistory(fileName, recordCounts, totalMergeResults);
    
    saveData();
    
    updateDashboardStats();
    updateAssetsDisplay();
    updateEmployeesTable();
    updateAssignmentsDisplay();
    
    const resultsDiv = document.getElementById('import-results');
    if (resultsDiv) {
        resultsDiv.innerHTML = `
            <h4>Import Results</h4>
            ${results.map(result => `
                <div class="import-sheet-result ${result.status}">
                    <strong>${result.sheetName}:</strong> ${result.message}
                </div>
            `).join('')}
            <div class="import-summary">
                <h5>Summary</h5>
                <p>Total Processed: ${totalMergeResults.totalImported}</p>
                <p>New Assets: ${totalMergeResults.newAssets}</p>
                <p>Updated Assets: ${totalMergeResults.updatedAssets}</p>
                <p>Conflicts: ${totalMergeResults.conflicts}</p>
                <p>Skipped: ${totalMergeResults.skippedAssets}</p>
            </div>
        `;
    }
    
    showSuccess(`Import completed! ${totalMergeResults.totalImported} records processed (${totalMergeResults.newAssets} new, ${totalMergeResults.updatedAssets} updated).`);
}

// Asset Management Functions
function updateAssetsDisplay() {
    showAssetCategory(currentAssetCategory);
}

function showAssetCategory(category) {
    currentAssetCategory = category;
    const contentDiv = document.getElementById('assets-content');
    const assets = assetsData[category] || [];

    if (!contentDiv) return;

    if (assets.length === 0) {
        const config = Object.values(EXCEL_SHEETS).find(s => s.key === category);
        contentDiv.innerHTML = `
            <div class="table-container">
                <div class="table-empty">
                    <p>No ${config?.displayName || category} found.</p>
                    <p>Import an Excel file or add assets manually.</p>
                </div>
            </div>
        `;
        return;
    }

    const config = Object.values(EXCEL_SHEETS).find(s => s.key === category);
    const columns = config ? config.columns : Object.keys(assets[0]).filter(key => key !== 'id');

    const tableHTML = `
        <div class="table-container">
            <table class="data-table">
                <thead>
                    <tr>
                        ${columns.map(column => `<th>${column}</th>`).join('')}
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${assets.map(asset => {
                        const displayStatus = getAssetStatusDisplay(asset);
                        const statusClass = getAssetStatusClass(asset);

                        // Generate dropdown menu actions with icons
                        const dropdownItems = [];

                        // Edit button (admin only)
                        if (ROLE_PERMISSIONS[currentRole]?.can_manage_assets) {
                            dropdownItems.push(`<button class="dropdown-item" onclick="editAsset('${asset.id}', '${category}')">✏️ Edit</button>`);
                        }

                        // Delete button (admin only)
                        if (ROLE_PERMISSIONS[currentRole]?.can_manage_assets) {
                            dropdownItems.push(`<button class="dropdown-item" onclick="deleteAsset('${asset.id}', '${category}')">🗑️ Delete</button>`);
                        }

                        // Assign/Unassign button
                        if (isAssetAvailable(asset)) {
                            dropdownItems.push(`<button class="dropdown-item" onclick="assignAsset('${asset.id}', '${category}')">➕ Assign</button>`);
                        } else {
                            dropdownItems.push(`<button class="dropdown-item" onclick="unassignAsset('${asset.id}', '${category}')">➖ Unassign</button>`);
                        }

                        // Status button (admin only)
                        if (ROLE_PERMISSIONS[currentRole]?.can_change_status) {
                            dropdownItems.push(`<button class="dropdown-item" onclick="changeAssetStatus('${asset.id}', '${category}')">🔄 Status</button>`);
                        }

                        // Only show dropdown if there are actions available
                        const actionsHtml = dropdownItems.length > 0 ? `
                            <div class="dropdown">
                                <button class="action-btn action-btn--manage" title="Manage Asset">⚙️</button>
                                <div class="dropdown-menu">
                                    ${dropdownItems.join('')}
                                </div>
                            </div>
                        ` : '';

                        return `
                            <tr data-row-id="${category}-${asset.id}">
                                ${columns.map(column => {
                                    if (column === 'Status' || column === 'status') {
                                        return `<td><span class="status-badge status-${statusClass}">${displayStatus}</span></td>`;
                                    } else {
                                        return `<td title="${column}: ${asset[column]}">${asset[column] || ''}</td>`;
                                    }
                                }).join('')}
                                <td>${actionsHtml}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    contentDiv.innerHTML = tableHTML;
}

function handleAssetSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const tableRows = document.querySelectorAll('#assets-content tbody tr');
    
    tableRows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

function handleAssignmentSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const tableRows = document.querySelectorAll('#assignments-page tbody tr');
    
    tableRows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

async function handleAddAsset(e) {
    e.preventDefault();
    if (currentRole !== 'admin') {
        showError('Only administrators can add assets.');
        return;
    }

    const formData = new FormData(e.target);
    const category = formData.get('category');

    if (!category) {
        showError('Please select an asset category.', NOTIFICATION_DURATION.SHORT);
        return;
    }

    const config = Object.values(EXCEL_SHEETS).find(s => s.key === category);
    if (!config) {
        showError('Invalid asset category.', NOTIFICATION_DURATION.SHORT);
        return;
    }

    // Validate required fields
    let hasErrors = false;
    if (config.keyFields) {
        config.keyFields.forEach(field => {
            const value = formData.get(field);
            if (!value || !value.trim()) {
                showError(`Please fill in the required field: ${field}`, NOTIFICATION_DURATION.SHORT);
                hasErrors = true;
                return;
            }
        });
    }

    if (hasErrors) return;

    // Create new asset
    const newAsset = {
        id: `${category.toUpperCase()}${Date.now()}`,
    };

    // Add all form fields to the asset
    config.columns.forEach(column => {
        const value = formData.get(column);
        if (value !== null) {
            newAsset[column] = value;
        }
    });

    // Set default status if not provided
    if (!newAsset.Status && !newAsset.status) {
        newAsset.Status = 'Available';
    }

    // Add to assets data and persist to server
    try {
        const inserted = await saveAsset(category, newAsset);
        // UI already updated inside saveAsset
        hideModal('add-asset-modal');
        e.target.reset();
        showSuccess('Asset added successfully!');
    } catch (err) {
        // Fallback: keep locally and persist to localStorage
        console.warn('Falling back to local-only save for asset:', err);
        if (!assetsData[category]) assetsData[category] = [];
        assetsData[category].push(newAsset);
        try { localStorage.setItem(STORAGE_KEYS.assets, JSON.stringify(assetsData)); } catch(e){}
        updateAssetsDisplay();
        updateDashboardStats();
        updateAssignmentsDisplay();
        hideModal('add-asset-modal');
        e.target.reset();
        showWarning('Asset saved locally. Server persistence failed.');
    }
}

function editAsset(id, category) {
    if (currentRole !== 'admin') {
        showError('Only administrators can edit assets.');
        return;
    }
    
    const asset = assetsData[category].find(a => a.id === id);
    if (!asset) return;
    
    const config = Object.values(EXCEL_SHEETS).find(s => s.key === category);
    if (!config) return;
    
    // Clear previous fields
    const fieldsContainer = document.getElementById('edit-asset-fields-container');
    if (fieldsContainer) {
        fieldsContainer.innerHTML = '';
    }
    
    // Generate form fields for all columns
    config.columns.forEach(column => {
        if (column !== 'id') { // Skip id field as it's handled separately
            const formGroup = document.createElement('div');
            formGroup.className = 'form-group';
            
            const label = document.createElement('label');
            label.className = 'form-label';
            label.textContent = column;
            label.htmlFor = `edit-${column.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
            
            let input;
            
            // Handle special field types
            if (column === 'Status' || column === 'status') {
                input = document.createElement('select');
                input.className = 'form-control';
                input.name = column;
                input.id = `edit-${column.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
                
                // Add status options
                ASSET_STATUSES.all.forEach(status => {
                    const option = document.createElement('option');
                    option.value = status;
                    option.textContent = status;
                    input.appendChild(option);
                });
            } else {
                input = document.createElement('input');
                input.type = 'text';
                input.className = 'form-control';
                input.name = column;
                input.id = `edit-${column.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
                
                // Set required for key fields
                if (config.keyFields && config.keyFields.includes(column)) {
                    input.required = true;
                }
            }
            
            // Set current value
            input.value = asset[column] || '';
            
            formGroup.appendChild(label);
            formGroup.appendChild(input);
            
            if (fieldsContainer) {
                fieldsContainer.appendChild(formGroup);
            }
        }
    });
    
    // Set hidden fields
    const assetIdInput = document.getElementById('edit-asset-id');
    const categoryInput = document.getElementById('edit-asset-category');
    
    if (assetIdInput) assetIdInput.value = id;
    if (categoryInput) categoryInput.value = category;
    
    showModal('edit-asset-modal');
}

document.addEventListener('DOMContentLoaded', () => {
    const editAssetForm = document.getElementById('edit-asset-form');
    if (editAssetForm) {
        editAssetForm.addEventListener('submit', function(e) {
            e.preventDefault();

            if (currentRole !== 'admin') {
                showError('Only administrators can edit assets.');
                return;
            }

            const formData = new FormData(editAssetForm);
            const id = formData.get('assetId');
            const category = formData.get('category');

            const asset = assetsData[category].find(a => a.id === id);
            if (!asset) {
                showError('Asset not found.');
                return;
            }

            const config = Object.values(EXCEL_SHEETS).find(s => s.key === category);
            if (!config) {
                showError('Invalid asset category.');
                return;
            }

            // Update all fields dynamically
            config.columns.forEach(column => {
                if (column !== 'id') {
                    const value = formData.get(column);
                    if (value !== null) {
                        asset[column] = value;
                    }
                }
            });

            saveData();
            updateAssetsDisplay();
            updateAssignmentsDisplay();
            hideModal('edit-asset-modal');
            showSuccess('Asset updated successfully!');
        });
    }

    // Edit Employee Form Submission
    const editEmployeeForm = document.getElementById('edit-employee-form');
    if (editEmployeeForm) {
        editEmployeeForm.addEventListener('submit', function(e) {
            e.preventDefault();

            if (currentRole !== 'admin') {
                showError('Only administrators can edit employees.');
                return;
            }

            const formData = new FormData(editEmployeeForm);
            const id = formData.get('employeeId');
            const name = formData.get('name');
            const department = formData.get('department');

            const employee = employees.find(e => e.id === id);
            if (!employee) {
                showError('Employee not found.');
                return;
            }

            if (name && name.trim()) {
                employee.name = name.trim();
            }
            if (department && department.trim()) {
                employee.department = department.trim();
            }

            employee.lastUpdated = new Date().toISOString();
            saveData();
            updateEmployeesTable();
            hideModal('edit-employee-modal');
            showSuccess('Employee updated successfully!');
        });
    }
});

// Global variables for delete confirmation
let pendingDeleteId = null;
let pendingDeleteCategory = null;

function deleteAsset(id, category) {
    if (currentRole !== 'admin') {
        showError('Only administrators can delete assets.');
        return;
    }
    
    pendingDeleteId = id;
    pendingDeleteCategory = category;
    showDeleteConfirmation();
}

function showDeleteConfirmation() {
    const modal = document.getElementById('delete-confirmation-modal');
    if (modal) {
        modal.classList.remove('hidden');
        
        // Set up the confirm button event listener
        const confirmBtn = document.getElementById('confirm-delete-btn');
        if (confirmBtn) {
            confirmBtn.onclick = handleConfirmDelete;
        }
    }
}

function hideDeleteConfirmation() {
    const modal = document.getElementById('delete-confirmation-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    // Clear pending delete data
    pendingDeleteId = null;
    pendingDeleteCategory = null;
}

function handleConfirmDelete() {
    if (pendingDeleteId && pendingDeleteCategory) {
        assetsData[pendingDeleteCategory] = assetsData[pendingDeleteCategory].filter(a => a.id !== pendingDeleteId);
        saveData();
        updateAssetsDisplay();
        updateDashboardStats();
        updateAssignmentsDisplay();
        showSuccess('Asset deleted successfully!');
    }
    hideDeleteConfirmation();
}
// Missing function 1: assignAsset
function assignAsset(id, category) {
    // Open the modal first (showModal will populate the selects) then set the selection
    showModal('assign-asset-modal');

    // Wait briefly so populateAssignAssetModal (called inside showModal) finishes
    setTimeout(() => {
        const assetSelect = document.querySelector('#assign-asset-form [name="assetId"]');
        if (assetSelect) {
            const desiredValue = `${category}:${id}`;
            const hasOption = Array.from(assetSelect.options).some(option => option.value === desiredValue);
            if (hasOption) {
                assetSelect.value = desiredValue;
            } else {
                console.warn('Asset not found in available assets:', id, category);
            }
        }
    }, 60);
}

// Missing function 2: changeAssetStatus  
function changeAssetStatus(id, category) {
    editAssetStatus(id, category);
}

function quickAssignAsset(id, category) {
    // Open the modal first (it will populate the select), then set the selection
    showModal('assign-asset-modal');

    setTimeout(() => {
        const assetSelect = document.querySelector('#assign-asset-form [name="assetId"]');
        if (assetSelect) {
            const desiredValue = `${category}:${id}`;
            const hasOption = Array.from(assetSelect.options).some(option => option.value === desiredValue);
            if (hasOption) {
                assetSelect.value = desiredValue;
            } else {
                console.warn('Asset not found in available assets:', id, category);
            }
        }
    }, 60);
}

let pendingUnassignId = null;
let pendingUnassignCategory = null;

function unassignAsset(id, category) {
    pendingUnassignId = id;
    pendingUnassignCategory = category;
    showUnassignConfirmation();
}

function showUnassignConfirmation() {
    const modal = document.getElementById('unassign-confirmation-modal');
    if (modal) {
        modal.classList.remove('hidden');
        const confirmBtn = document.getElementById('confirm-unassign-btn');
        if (confirmBtn) {
            confirmBtn.onclick = handleConfirmUnassign;
        }
    }
}

function hideUnassignConfirmation() {
    const modal = document.getElementById('unassign-confirmation-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    pendingUnassignId = null;
    pendingUnassignCategory = null;
}

function handleConfirmUnassign() {
    if (pendingUnassignId && pendingUnassignCategory) {
        const asset = assetsData[pendingUnassignCategory].find(a => a.id === pendingUnassignId);
        if (asset) {
            if (asset['User Name']) asset['User Name'] = '';
            if (asset['USERS']) asset['USERS'] = '';
            if (asset['Status']) asset['Status'] = 'Available';
            if (asset['Deptt']) asset['Deptt'] = '';
            
            saveData();
            updateAssetsDisplay();
            updateAssignmentsDisplay();
            updateDashboardStats();
            showSuccess('Asset unassigned successfully!');
        }
    }
    hideUnassignConfirmation();
}

// Assignment Management Functions
function populateAssignAssetModal() {
    const assetSelect = document.querySelector('#assign-asset-form [name="assetId"]');
    const employeeSelect = document.querySelector('#assign-asset-form [name="employeeId"]');
    
    if (!assetSelect || !employeeSelect) return;
    
    // Populate ONLY available assets
    assetSelect.innerHTML = '<option value="">Choose an available asset</option>';
    Object.entries(assetsData).forEach(([category, assets]) => {
        const config = Object.values(EXCEL_SHEETS).find(s => s.key === category);
        
        assets.filter(isAssetAvailable).forEach(asset => {
            const assetTag = getAssetTag(asset, category);
            const makeModel = getMakeModel(asset, category);
            
            const option = document.createElement('option');
            option.value = `${category}:${asset.id}`;
            option.textContent = `${config?.displayName || category} - ${assetTag} (${makeModel})`;
            assetSelect.appendChild(option);
        });
    });
    
    // Populate employees
    employeeSelect.innerHTML = '<option value="">Choose an employee</option>';
    employees.forEach(employee => {
        const option = document.createElement('option');
        option.value = employee.id;
        option.textContent = `${employee.name} (${employee.department})`;
        employeeSelect.appendChild(option);
    });
}

async function handleAssignAsset(e) {
    e.preventDefault();
    const formData = new FormData(e.target);
    const assetId = formData.get('assetId');
    const employeeId = formData.get('employeeId');
    const assignmentDate = formData.get('assignmentDate');
    const notes = formData.get('notes');
    
    if (!assetId || !employeeId) {
        showError('Please select both an asset and an employee.', NOTIFICATION_DURATION.SHORT);
        return;
    }
    
    const [category, id] = assetId.split(':');
    const asset = assetsData[category].find(a => a.id === id);
    const employee = employees.find(e => e.id === employeeId);
    
    if (asset && employee) {
        const config = Object.values(EXCEL_SHEETS).find(s => s.key === category);
        
        // Update asset with assignment
        if (config?.userColumn && asset[config.userColumn] !== undefined) {
            asset[config.userColumn] = employee.name;
        }
        if (asset['User Name'] !== undefined) asset['User Name'] = employee.name;
        if (asset['USERS'] !== undefined) asset['USERS'] = employee.name;
        if (asset['Deptt'] !== undefined) asset['Deptt'] = employee.department;
        if (asset['Department'] !== undefined) asset['Department'] = employee.department;
        if (asset['Status'] !== undefined) asset['Status'] = 'Assigned';
        
        // Create assignment record
        const assignment = {
            id: `ASG${Date.now()}`,
            assetId: id,
            assetCategory: category,
            employeeId: employeeId,
            assignmentDate: assignmentDate,
            notes: notes,
            createdAt: new Date().toISOString()
        };
        assignments.push(assignment);
        
        // Persist assignment to server if possible
        const assignedOk = await assignAssetServer(category, id, employeeId);

        if (!assignedOk) {
            // Fallback: update locally and save to localStorage
            console.warn('Assignment not persisted to server, saving locally');
            try {
                localStorage.setItem(STORAGE_KEYS.assets, JSON.stringify(assetsData));
            } catch (e) {}
            try {
                localStorage.setItem(STORAGE_KEYS.assignments, JSON.stringify(assignments));
            } catch (e) {}
            showWarning('Assignment saved locally. Server persistence failed.');
        } else {
            showSuccess('Asset assigned successfully!');
        }

        updateAssignmentsDisplay();
        updateAssetsDisplay();
        updateDashboardStats();
        hideModal('assign-asset-modal');
        e.target.reset();
    }
}

// Employee Management Functions
function updateEmployeesTable() {
    const tbody = document.getElementById('employees-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    employees.forEach(employee => {
        let assignedCount = 0;
        Object.values(assetsData).forEach(categoryAssets => {
            categoryAssets.forEach(asset => {
                if ((asset['User Name'] && asset['User Name'].toLowerCase() === employee.name.toLowerCase()) ||
                    (asset['USERS'] && asset['USERS'].toLowerCase() === employee.name.toLowerCase())) {
                    assignedCount++;
                }
            });
        });
        
        const row = document.createElement('tr');
        const rowId = `emp-${employee.id}`;
        row.dataset.rowId = rowId;
        
        row.innerHTML = `
            <td>${employee.name}</td>
            <td>${employee.department}</td>
            <td><span class="status-badge source-${employee.source}">${employee.source}</span></td>
            <td>${assignedCount}</td>
            <td>${new Date(employee.lastUpdated).toLocaleDateString()}</td>
            ${ROLE_PERMISSIONS[currentRole]?.can_manage_employees ? `
            <td>
                <button class="action-btn action-btn--edit" onclick="editEmployee('${employee.id}')">Edit</button>
                <button class="action-btn action-btn--delete" onclick="deleteEmployee('${employee.id}')">Delete</button>
            </td>
            ` : ''}
        `;
        tbody.appendChild(row);
    });
    
    // Update employee stats
    const autoExtracted = employees.filter(emp => emp.source === 'excel').length;
    const manual = employees.filter(emp => emp.source === 'manual').length;
    
    const autoExtractedEl = document.getElementById('auto-extracted-count');
    const manualEl = document.getElementById('manual-employees-count');
    
    if (autoExtractedEl) autoExtractedEl.textContent = autoExtracted;
    if (manualEl) manualEl.textContent = manual;
}

function handleEmployeeSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    const tableRows = document.querySelectorAll('#employees-table-body tr');
    
    tableRows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
}

async function handleAddEmployee(e) {
    e.preventDefault();
    if (currentRole !== 'admin') {
        showError('Only administrators can add employees.');
        return;
    }

    const formData = new FormData(e.target);

    const name = formData.get('name')?.trim();
    const department = formData.get('department')?.trim();
    const source = formData.get('source');

    if (!name || !department || !source) {
        showError('Please fill in all required fields.', NOTIFICATION_DURATION.SHORT);
        return;
    }

    const newEmployee = {
        name,
        department,
        source
    };

    try {
        // ✅ Send employee to Neon via Netlify Function
        const res = await fetch('/.netlify/functions/addemployee', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newEmployee)
        });

        const result = await res.json();

        if (result.success) {
            console.log("✅ Employee added to Neon DB:", result.inserted);

            // Update your local array for UI refresh
            employees.unshift(result.inserted);
            // Persist local state if needed (keeps UI in sync with storage)
            try { saveData(); } catch (err) { /* saveData may expect asset args; ignore errors */ }

            updateEmployeesTable();
            updateDashboardStats();
            hideModal('add-employee-modal');
            e.target.reset();
            showSuccess('Employee added successfully!');
        } else {
            showError('Failed to add employee.', NOTIFICATION_DURATION.MEDIUM);
            console.error(result);
        }
    } catch (error) {
        console.error("Error adding employee:", error);
        showError('Error adding employee to database.', NOTIFICATION_DURATION.MEDIUM);
    }
}

let pendingEditEmployeeId = null;

function editEmployee(id) {
    if (currentRole !== 'admin') {
        showError('Only administrators can edit employees.');
        return;
    }
    
    const employee = employees.find(e => e.id === id);
    if (!employee) return;
    
    // Populate edit modal
    const nameInput = document.getElementById('edit-employee-name');
    const departmentInput = document.getElementById('edit-employee-department');
    const employeeIdInput = document.getElementById('edit-employee-id');
    
    if (nameInput) nameInput.value = employee.name;
    if (departmentInput) departmentInput.value = employee.department;
    if (employeeIdInput) employeeIdInput.value = employee.id;
    
    pendingEditEmployeeId = id;
    showModal('edit-employee-modal');
}

let pendingDeleteEmployeeId = null;

function deleteEmployee(id) {
    if (currentRole !== 'admin') {
        showError('Only administrators can delete employees.');
        return;
    }
    
    pendingDeleteEmployeeId = id;
    showDeleteEmployeeConfirmation();
}

function showDeleteEmployeeConfirmation() {
    const modal = document.getElementById('delete-employee-confirmation-modal');
    if (modal) {
        modal.classList.remove('hidden');
        const confirmBtn = document.getElementById('confirm-delete-employee-btn');
        if (confirmBtn) {
            confirmBtn.onclick = handleConfirmDeleteEmployee;
        }
    }
}

function hideDeleteEmployeeConfirmation() {
    const modal = document.getElementById('delete-employee-confirmation-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    pendingDeleteEmployeeId = null;
}

function handleConfirmDeleteEmployee() {
    if (pendingDeleteEmployeeId) {
        employees = employees.filter(e => e.id !== pendingDeleteEmployeeId);
        saveData();
        updateEmployeesTable();
        updateDashboardStats();
        showSuccess('Employee deleted successfully!');
    }
    hideDeleteEmployeeConfirmation();
}

function syncEmployeesFromAssets() {
    if (currentRole !== 'admin') {
        showError('Only administrators can sync employees.');
        return;
    }
    
    let newCount = 0;
    
    Object.entries(assetsData).forEach(([category, categoryAssets]) => {
        const config = Object.values(EXCEL_SHEETS).find(s => s.key === category);
        if (!config || !config.userColumn) return;
        
        categoryAssets.forEach(asset => {
            const userName = asset[config.userColumn];
            const department = asset[config.deptColumn] || 'Unknown';
            
            if (userName && userName.trim() && 
                !['IN STOCK', 'DEAD', 'Transfer', 'Available', '', 'N/A', 'NA'].includes(userName.trim())) {
                
                const employeeName = userName.trim();
                
                const existingEmployee = employees.find(emp => 
                    emp.name.toLowerCase() === employeeName.toLowerCase()
                );
                
                if (!existingEmployee) {
                    const newEmployee = {
                        id: `EMP${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
                        name: employeeName,
                        department: department,
                        source: 'excel',
                        lastUpdated: new Date().toISOString()
                    };
                    
                    employees.push(newEmployee);
                    newCount++;
                }
            }
        });
    });
    
    if (newCount > 0) {
        saveData();
        updateEmployeesTable();
        updateDashboardStats();
        showSuccess(`${newCount} new employees extracted from assets!`);
    } else {
        showInfo('No new employees found in asset data.');
    }
}

// Modal Functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        if (modalId === 'assign-asset-modal') {
            populateAssignAssetModal();
        }
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
    }
}

function showAddAssetModal() {
    if (currentRole !== 'admin') {
        showError('Only administrators can add assets.');
        return;
    }

    // Reset form
    const form = document.getElementById('add-asset-form');
    if (form) {
        form.reset();
        // Trigger category change to populate form
        const categorySelect = form.querySelector('[name="category"]');
        if (categorySelect) {
            categorySelect.dispatchEvent(new Event('change'));
        }
    }

    showModal('add-asset-modal');
}

function showAddEmployeeModal() {
    if (currentRole !== 'admin') {
        showError('Only administrators can add employees.');
        return;
    }
    showModal('add-employee-modal');
}

function showAssignAssetModal() {
    showModal('assign-asset-modal');
}

// Export Functions

// Export to Excel (renamed from exportAllData)
function exportToExcel() {
    if (currentRole !== 'admin') {
        showError('Only administrators can export data.');
        return;
    }
    
    const wb = XLSX.utils.book_new();
    
    Object.entries(assetsData).forEach(([category, assets]) => {
        if (assets.length > 0) {
            const config = Object.values(EXCEL_SHEETS).find(s => s.key === category);
            const ws = XLSX.utils.json_to_sheet(assets.map(asset => {
                const exportAsset = { ...asset };
                delete exportAsset.id;
                return exportAsset;
            }));
            const sheetName = config?.displayName || category;
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
    });
    
    if (employees.length > 0) {
        const empWs = XLSX.utils.json_to_sheet(employees.map(emp => ({
            Name: emp.name,
            Department: emp.department,
            Source: emp.source,
            'Last Updated': new Date(emp.lastUpdated).toLocaleString()
        })));
        XLSX.utils.book_append_sheet(wb, empWs, 'Employees');
    }
    
    const fileName = `NV_Group_Assets_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
}

// Utility function to convert array to CSV
function arrayToCSV(data) {
    if (!data || data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => 
            headers.map(fieldName => {
                const value = row[fieldName];
                // Escape quotes and wrap in quotes if needed
                if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    return `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            }).join(',')
        )
    ].join('\n');
    
    return csvContent;
}

// Export to CSV
function exportToCSV() {
    if (currentRole !== 'admin') {
        showError('Only administrators can export data.');
        return;
    }

    // Create a single CSV with all data
    let csvContent = 'Category,Data\n';
    
    // Add assets data
    Object.entries(assetsData).forEach(([category, assets]) => {
        if (assets.length > 0) {
            csvContent += `\n${category.toUpperCase()} ASSETS\n`;
            csvContent += arrayToCSV(assets.map(asset => {
                const exportAsset = { ...asset };
                delete exportAsset.id;
                return exportAsset;
            })) + '\n';
        }
    });
    
    // Add employees data
    if (employees.length > 0) {
        csvContent += '\nEMPLOYEES\n';
        csvContent += arrayToCSV(employees.map(emp => ({
            Name: emp.name,
            Department: emp.department,
            Source: emp.source,
            'Last Updated': new Date(emp.lastUpdated).toLocaleString()
        }))) + '\n';
    }
    
    // Download the CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const fileName = `NV_Group_Assets_Export_${new Date().toISOString().split('T')[0]}.csv`;
    
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Export to PDF
function exportToPDF() {
    if (currentRole !== 'admin') {
        showError('Only administrators can export data.');
        return;
    }

    // Check if jsPDF is available
    if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined') {
        alert('PDF export functionality is not available. Please ensure jsPDF library is loaded.');
        return;
    }

    // Create PDF in landscape orientation with smaller font sizes
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'mm', 'a4'); // 'l' for landscape, 'mm' for millimeters, 'a4' for page size

    let y = 15; // Vertical position tracker (smaller top margin for landscape)

    // Add title with smaller font
    doc.setFontSize(14);
    doc.text('NV Group Assets Report', 148.5, y, null, null, 'center'); // Center for A4 landscape (297mm/2)
    y += 8;

    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 148.5, y, null, null, 'center');
    y += 12;

    // Export assets by category
    Object.entries(assetsData).forEach(([category, assets]) => {
        if (assets.length > 0) {
            // Check if we need a new page
            if (y > 180) { // Approximately 180mm for A4 landscape before bottom margin
                doc.addPage();
                y = 15;
            }
            
            // Add category title
            doc.setFontSize(12);
            doc.text(`${category.toUpperCase()} ASSETS`, 10, y);
            y += 7;

            // Prepare table data with full content (no truncation)
            const headers = Object.keys(assets[0]).filter(k => k !== 'id');
            const rows = assets.map(asset => headers.map(h => {
                const value = asset[h];
                // Convert all values to strings and handle null/undefined
                return (value !== null && value !== undefined) ? String(value) : '';
            }));

            // Add table with adjusted settings for landscape
            doc.autoTable({
                startY: y,
                head: [headers],
                body: rows,
                theme: 'grid',
                styles: { 
                    fontSize: 6, // Smaller font size
                    cellPadding: 1.5, // Reduced padding
                    overflow: 'linebreak' // Handle text wrapping
                },
                headStyles: {
                    fontSize: 7, // Slightly larger font for headers
                    cellPadding: 2
                },
                columnStyles: {
                    // Adjust column widths for better fit in landscape
                    0: { cellWidth: 25 },
                    1: { cellWidth: 20 }
                },
                margin: { left: 10, right: 10 },
                pageBreak: 'auto', // Allow table to break across pages
                didDrawPage: (data) => {
                    y = data.cursor.y + 10;
                }
            });
            
            y = doc.lastAutoTable.finalY + 10;
        }
    });

    // Add new page for employees if needed
    if (employees.length > 0) {
        if (y > 150) { // Check if we need a new page
            doc.addPage();
            y = 15;
        } else {
            y += 5; // Small gap before next section
        }

        // Export employees summary
        doc.setFontSize(12);
        doc.text('EMPLOYEES', 10, y);
        y += 7;

        const headers = ['Name', 'Department', 'Source', 'Last Updated'];
        const rows = employees.map(emp => [
            emp.name,
            emp.department,
            emp.source,
            new Date(emp.lastUpdated).toLocaleDateString()
        ]);

        doc.autoTable({
            startY: y,
            head: [headers],
            body: rows,
            theme: 'grid',
            styles: { 
                fontSize: 6, // Smaller font size
                cellPadding: 1.5
            },
            headStyles: {
                fontSize: 7,
                cellPadding: 2
            },
            margin: { left: 10, right: 10 },
            pageBreak: 'auto'
        });
    }

    const fileName = `NV_Group_Assets_Export_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
}

// Global functions for button clicks
window.showPage = showPage;
window.showModal = showModal;
window.hideModal = hideModal;
window.showAddAssetModal = showAddAssetModal;
window.showAddEmployeeModal = showAddEmployeeModal;
window.showAssignAssetModal = showAssignAssetModal;
window.editAsset = editAsset;
window.deleteAsset = deleteAsset;
window.editEmployee = editEmployee;
window.deleteEmployee = deleteEmployee;
window.quickAssignAsset = quickAssignAsset;
window.unassignAsset = unassignAsset;
window.editAssetStatus = editAssetStatus;
window.exportAllData = exportAllData;
window.clearAllData = clearAllData;
window.syncEmployeesFromAssets = syncEmployeesFromAssets;
window.assignAsset = assignAsset;
window.changeAssetStatus = changeAssetStatus;
window.toggleDashboardDropdown = toggleDashboardDropdown;
window.showDeleteConfirmation = showDeleteConfirmation;
window.hideDeleteConfirmation = hideDeleteConfirmation;
window.handleConfirmDelete = handleConfirmDelete;
window.showDeleteEmployeeConfirmation = showDeleteEmployeeConfirmation;
window.hideDeleteEmployeeConfirmation = hideDeleteEmployeeConfirmation;
window.handleConfirmDeleteEmployee = handleConfirmDeleteEmployee;
window.undoLastChange = undoLastChange;
window.rollbackLastImport = rollbackLastImport;
window.showImportHistory = showImportHistory;

// New functions for enhanced history modal and rollback/undo

function openHistoryModal() {
    populateImportHistory();
    populateChangeHistory();
    showModal('history-modal');
}

function populateImportHistory() {
    const importList = document.getElementById('import-history-list');
    if (!importList) return;

    importList.innerHTML = '';

    if (importHistory.length === 0) {
        importList.innerHTML = '<li>No import history available.</li>';
        return;
    }

    importHistory.forEach((entry, index) => {
        const li = document.createElement('li');
        li.className = 'history-entry';

        const dateStr = new Date(entry.timestamp).toLocaleString();
        const fileName = entry.fileName || 'Unknown file';
        const total = entry.mergeResults?.totalImported || 0;
        const newAssets = entry.mergeResults?.newAssets || 0;
        const updatedAssets = entry.mergeResults?.updatedAssets || 0;
        const conflicts = entry.mergeResults?.conflicts || 0;

        li.innerHTML = `
            <div>
                <strong>${fileName}</strong> - ${dateStr}<br>
                Total: ${total}, New: ${newAssets}, Updated: ${updatedAssets}, Conflicts: ${conflicts}
            </div>
            <div class="history-actions">
                <button onclick="rollbackImport(${index})">Rollback</button>
                <button onclick="restoreImport(${index})">Restore</button>
            </div>
        `;

        importList.appendChild(li);
    });
}

function populateChangeHistory() {
    const changeList = document.getElementById('change-history-list');
    if (!changeList) return;

    changeList.innerHTML = '';

    if (changeHistory.length === 0) {
        changeList.innerHTML = '<li>No change history available.</li>';
        return;
    }

    changeHistory.forEach((entry, index) => {
        const li = document.createElement('li');
        li.className = 'history-entry';

        const dateStr = new Date(entry.timestamp).toLocaleString();
        const action = entry.action || 'Unknown action';
        const details = entry.details || '';

        li.innerHTML = `
            <div>
                <strong>${action}</strong> - ${dateStr}<br>
                ${details}
            </div>
            <div class="history-actions">
                <button onclick="undoChange(${index})">Undo</button>
                <button onclick="restoreChange(${index})">Restore</button>
            </div>
        `;

        changeList.appendChild(li);
    });
}

function rollbackImport(index) {
    if (index < 0 || index >= importHistory.length) {
        showError('Invalid import history entry.');
        return;
    }
    const entry = importHistory.splice(index, 1)[0];
    restoreFromBackup(entry.backup);
    saveData();
    updateDashboardStats();
    updateAssetsDisplay();
    updateEmployeesTable();
    updateAssignmentsDisplay();
    populateImportHistory();
    showSuccess(`Rollback successful: Import from ${entry.fileName} has been reverted.`);
}

function restoreImport(index) {
    if (index < 0 || index >= importHistory.length) {
        showError('Invalid import history entry.');
        return;
    }
    const entry = importHistory[index];
    restoreFromBackup(entry.backup);
    saveData();
    updateDashboardStats();
    updateAssetsDisplay();
    updateEmployeesTable();
    updateAssignmentsDisplay();
    showSuccess(`Restore successful: Import from ${entry.fileName} has been restored.`);
}

function undoChange(index) {
    if (index < 0 || index >= changeHistory.length) {
        showError('Invalid change history entry.');
        return;
    }
    const entry = changeHistory.splice(index, 1)[0];
    restoreFromBackup(entry.backup);
    saveData();
    updateDashboardStats();
    updateAssetsDisplay();
    updateEmployeesTable();
    updateAssignmentsDisplay();
    populateChangeHistory();
    showSuccess(`Undo successful: ${entry.action}`);
}

function restoreChange(index) {
    if (index < 0 || index >= changeHistory.length) {
        showError('Invalid change history entry.');
        return;
    }
    const entry = changeHistory[index];
    restoreFromBackup(entry.backup);
    saveData();
    updateDashboardStats();
    updateAssetsDisplay();
    updateEmployeesTable();
    updateAssignmentsDisplay();
    showSuccess(`Restore successful: ${entry.action}`);
}

// Expose new function to window for UI access
window.openHistoryModal = openHistoryModal;
window.rollbackImport = rollbackImport;
window.restoreImport = restoreImport;
window.undoChange = undoChange;
window.restoreChange = restoreChange;
