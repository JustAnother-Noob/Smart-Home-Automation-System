class ProfileManager {
    constructor() {
        this.API_BASE = (window.CONFIG && window.CONFIG.API_URL ? window.CONFIG.API_URL : '/api').replace(/\/+$/, '');
        this.authToken = this.getAuthToken();
        this.originalData = null;
        this.isEditing = false;
        this.autocomplete = null;
        this.editingAddressId = null;
        
        this.init();
    }

    getAuthToken() {
        
        let token = localStorage.getItem('authToken');

        if (!token) {
            token = sessionStorage.getItem('authToken');
        }

        if (!token && window.auth && typeof window.auth.getToken === 'function') {
            token = window.auth.getToken();
        }
        
        console.log('🔑 Auth token retrieved:', token ? 'Found' : 'Not found');
        return token;
    }

    refreshAuthToken() {
        this.authToken = this.getAuthToken();
        console.log('🔄 Auth token refreshed:', this.authToken ? 'Found' : 'Not found');
    }

    isAuthenticated() {
        const hasToken = !!this.authToken;
        const hasUserData = !!(localStorage.getItem('userFirstName') || localStorage.getItem('userEmail'));
        
        console.log('🔐 Authentication check:', {
            hasToken,
            hasUserData,
            authenticated: hasToken && hasUserData,
            tokenPreview: this.authToken ? this.authToken.substring(0, 20) + '...' : 'None',
            userData: {
                firstName: localStorage.getItem('userFirstName'),
                lastName: localStorage.getItem('userLastName'),
                email: localStorage.getItem('userEmail')
            }
        });
        
        return hasToken && hasUserData;
    }

    populateFromLocalStorage() {
        console.log('🔄 Populating form fields from localStorage as fallback');
        
        const firstNameField = document.getElementById('firstName');
        const lastNameField = document.getElementById('lastName');
        const emailField = document.getElementById('email');
        const phoneField = document.getElementById('phone');

        const localData = {
            firstName: localStorage.getItem('userFirstName') || '',
            lastName: localStorage.getItem('userLastName') || '',
            email: localStorage.getItem('userEmail') || '',
            phone: localStorage.getItem('userPhone') || ''
        };

        console.log('🔄 LocalStorage data:', localData);

        if (firstNameField) firstNameField.value = localData.firstName;
        if (lastNameField) lastNameField.value = localData.lastName;
        if (emailField) emailField.value = localData.email;
        if (phoneField) phoneField.value = localData.phone;

        this.populateProfileOverview(localData);
    }

    async debugAPI() {
        console.log('🔧 Debug API Test');
        console.log('API_BASE:', this.API_BASE);
        console.log('Auth token exists:', !!this.authToken);
        console.log('Auth token preview:', this.authToken ? this.authToken.substring(0, 20) + '...' : 'None');
        
        if (!this.authToken) {
            console.log('❌ No auth token available for testing');
            return;
        }

        try {
            const response = await fetch(`${this.API_BASE}/users/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            console.log('🔧 Debug API Response:', {
                status: response.status,
                ok: response.ok,
                statusText: response.statusText,
                url: response.url,
                headers: Object.fromEntries(response.headers.entries())
            });

            const data = await response.json();
            console.log('🔧 Debug API Data:', data);
            
            if (data.success && data.data) {
                console.log('🔧 Profile data structure:', {
                    firstName: data.data.firstName,
                    lastName: data.data.lastName,
                    email: data.data.email,
                    phone: data.data.phone,
                    hasAllFields: !!(data.data.firstName && data.data.lastName && data.data.email)
                });
            } else {
                console.log('🔧 API response structure issue:', {
                    hasSuccess: 'success' in data,
                    successValue: data.success,
                    hasData: 'data' in data,
                    dataType: typeof data.data,
                    fullResponse: data
                });
            }
            
        } catch (error) {
            console.error('🔧 Debug API Error:', error);
        }
    }

    async init() {
        try {
            
            if (!this.isAuthenticated()) {
                console.log('❌ User not properly authenticated, redirecting to login');
                this.redirectToLogin();
                return;
            }

            console.log('✅ User authenticated, initializing profile manager');

            if (window.CONFIG && window.CONFIG.DEBUG) {
                await this.debugAPI();
            }

            this.setupEventListeners();

            await this.loadProfile();

            await this.loadSavedAddresses();

            await this.loadOrderHistory();

            this.setupSecuritySection();
            
            console.log('✅ Profile manager initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing profile manager:', error);
            this.showMessage('Failed to load account settings. Please refresh the page.', 'error');
        }
    }

    setupEventListeners() {
        const profileForm = document.getElementById('profileForm');
        const editBtn = document.getElementById('editBtn');
        const cancelBtn = document.getElementById('cancelBtn');
        const saveBtn = document.getElementById('saveBtn');

        editBtn.addEventListener('click', () => this.enableEditing());

        cancelBtn.addEventListener('click', () => this.cancelEditing());

        profileForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProfile();
        });

        const firstNameInput = document.getElementById('firstName');
        const lastNameInput = document.getElementById('lastName');
        const phoneInput = document.getElementById('phone');

        this.setupAddressEventListeners();

        firstNameInput.addEventListener('input', () => this.validateField('firstName'));
        lastNameInput.addEventListener('input', () => this.validateField('lastName'));
        phoneInput.addEventListener('input', () => {
            this.formatPhoneNumber();
            this.validateField('phone');
        });
    }

    async loadProfile() {
        try {
            this.showLoading(true);
            
            console.log('🔍 Loading user profile...');
            console.log('API_BASE:', this.API_BASE);
            console.log('Auth token exists:', !!this.authToken);
            console.log('Auth token preview:', this.authToken ? this.authToken.substring(0, 20) + '...' : 'None');

            if (!this.authToken) {
                throw new Error('No authentication token found. Please log in again.');
            }

            const response = await fetch(`${this.API_BASE}/users/profile`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include'
            });

            console.log('📡 Profile API response:', {
                status: response.status,
                ok: response.ok,
                statusText: response.statusText,
                url: response.url
            });

            if (!response.ok) {
                
                let errorMessage = `Failed to load profile (${response.status})`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    
                    errorMessage = response.statusText || errorMessage;
                }
                
                if (response.status === 401) {
                    errorMessage = 'Session expired. Please log in again.';
                }
                
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('📦 Profile API result:', result);
            
            if (result.success && result.data) {
                this.populateProfile(result.data);
                this.originalData = { ...result.data };
                console.log('✅ Profile loaded successfully');
            } else {
                console.warn('⚠️ API response invalid, trying localStorage fallback');
                this.populateFromLocalStorage();
                this.originalData = {
                    firstName: localStorage.getItem('userFirstName') || '',
                    lastName: localStorage.getItem('userLastName') || '',
                    email: localStorage.getItem('userEmail') || '',
                    phone: localStorage.getItem('userPhone') || ''
                };
                console.log('✅ Profile loaded from localStorage fallback');
            }

        } catch (error) {
            console.error('❌ Error loading profile:', error);

            if (!error.message.includes('Session expired') && !error.message.includes('No authentication token')) {
                console.log('🔄 API failed, trying localStorage fallback');
                this.populateFromLocalStorage();
                this.originalData = {
                    firstName: localStorage.getItem('userFirstName') || '',
                    lastName: localStorage.getItem('userLastName') || '',
                    email: localStorage.getItem('userEmail') || '',
                    phone: localStorage.getItem('userPhone') || ''
                };
                this.showMessage('Profile loaded from saved data. Some features may be limited.', 'info');
            } else {
                this.showMessage(error.message || 'Failed to load profile. Please try again.', 'error');
                if (error.message.includes('Session expired') || error.message.includes('No authentication token')) {
                    setTimeout(() => this.redirectToLogin(), 2000);
                }
            }
        } finally {
            this.showLoading(false);
        }
    }

    populateProfile(data) {
        console.log('📝 Populating profile with data:', data);

        if (!data) {
            console.error('❌ No data provided to populateProfile');
            return;
        }

        const fallbackData = {
            firstName: data.firstName || localStorage.getItem('userFirstName') || '',
            lastName: data.lastName || localStorage.getItem('userLastName') || '',
            email: data.email || localStorage.getItem('userEmail') || '',
            phone: data.phone || localStorage.getItem('userPhone') || ''
        };

        console.log('📝 Using data (API + fallback):', fallbackData);

        const firstNameField = document.getElementById('firstName');
        const lastNameField = document.getElementById('lastName');
        const emailField = document.getElementById('email');
        const phoneField = document.getElementById('phone');

        if (firstNameField) {
            firstNameField.value = fallbackData.firstName;
            console.log('✅ First name set:', fallbackData.firstName);
        } else {
            console.error('❌ firstName field not found');
        }

        if (lastNameField) {
            lastNameField.value = fallbackData.lastName;
            console.log('✅ Last name set:', fallbackData.lastName);
        } else {
            console.error('❌ lastName field not found');
        }

        if (emailField) {
            emailField.value = fallbackData.email;
            console.log('✅ Email set:', fallbackData.email);
        } else {
            console.error('❌ email field not found');
        }

        if (phoneField) {
            phoneField.value = fallbackData.phone;
            console.log('✅ Phone set:', fallbackData.phone);
        } else {
            console.error('❌ phone field not found');
        }

        this.populateProfileOverview(fallbackData);

        this.checkAuthProvider(fallbackData);
    }

    populateProfileOverview(data) {
        
        const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'User';
        const profileNameElement = document.getElementById('profileName');
        if (profileNameElement) {
            profileNameElement.textContent = fullName;
        }

        const initial = (data.firstName || 'U').charAt(0).toUpperCase();
        const avatarInitialElement = document.getElementById('avatarInitial');
        if (avatarInitialElement) {
            avatarInitialElement.textContent = initial;
        }

        const verifiedBadge = document.getElementById('verifiedBadge');
        if (verifiedBadge) {
            if (data.isVerified) {
                verifiedBadge.style.display = 'inline-flex';
            } else {
                verifiedBadge.style.display = 'none';
            }
        }

        const profileEmailElement = document.getElementById('profileEmail');
        if (profileEmailElement && data.email) {
            profileEmailElement.textContent = data.email;
        }
    }

    enableEditing() {
        this.isEditing = true;

        document.getElementById('firstName').disabled = false;
        document.getElementById('lastName').disabled = false;
        document.getElementById('phone').disabled = false;

        document.getElementById('editBtn').style.display = 'none';
        document.getElementById('saveActions').style.display = 'flex';

        document.getElementById('firstName').focus();

        this.showMessage('You can now edit your profile information', 'info');

        setTimeout(() => this.hideMessage(), 3000);
    }

    cancelEditing() {
        this.isEditing = false;

        if (this.originalData) {
            this.populateProfile(this.originalData);
        }

        this.clearAllErrors();

        document.getElementById('firstName').disabled = true;
        document.getElementById('lastName').disabled = true;
        document.getElementById('phone').disabled = true;

        document.getElementById('editBtn').style.display = 'inline-flex';
        document.getElementById('saveActions').style.display = 'none';

        this.hideMessage();
    }

    async saveProfile() {
        
        const isValid = this.validateAllFields();
        
        if (!isValid) {
            this.showMessage('Please fix the errors before saving', 'error');
            return;
        }

        try {
            
            const formData = {
                firstName: document.getElementById('firstName').value.trim(),
                lastName: document.getElementById('lastName').value.trim(),
                phone: document.getElementById('phone').value.trim()
            };

            const saveBtn = document.getElementById('saveBtn');
            const originalText = saveBtn.innerHTML;
            saveBtn.disabled = true;
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

            const response = await fetch(`${this.API_BASE}/users/profile`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to update profile');
            }

            const result = await response.json();

            if (result.success) {
                
                this.originalData = { ...this.originalData, ...formData };

                localStorage.setItem('userFirstName', formData.firstName);
                localStorage.setItem('userLastName', formData.lastName);
                if (formData.phone) {
                    localStorage.setItem('userPhone', formData.phone);
                }

                this.populateProfileOverview({ 
                    ...this.originalData, 
                    ...formData 
                });

                document.dispatchEvent(new CustomEvent('profileUpdated', {
                    detail: formData
                }));

                this.showMessage('✅ Profile updated successfully!', 'success');

                this.isEditing = false;
                document.getElementById('firstName').disabled = true;
                document.getElementById('lastName').disabled = true;
                document.getElementById('phone').disabled = true;
                document.getElementById('editBtn').style.display = 'inline-flex';
                document.getElementById('saveActions').style.display = 'none';

                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                throw new Error(result.message || 'Failed to update profile');
            }

        } catch (error) {
            console.error('Error saving profile:', error);
            this.showMessage(error.message || 'Failed to update profile. Please try again.', 'error');
        } finally {
            
            const saveBtn = document.getElementById('saveBtn');
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="fas fa-check"></i> Save Changes';
        }
    }

    validateField(fieldName) {
        const field = document.getElementById(fieldName);
        const errorElement = document.getElementById(`${fieldName}Error`);
        const value = field.value.trim();
        let errorMessage = '';

        switch (fieldName) {
            case 'firstName':
            case 'lastName':
                if (!value) {
                    errorMessage = `${fieldName === 'firstName' ? 'First' : 'Last'} name is required`;
                } else if (value.length < 2) {
                    errorMessage = 'Name must be at least 2 characters';
                } else if (value.length > 50) {
                    errorMessage = 'Name must not exceed 50 characters';
                } else if (!/^[a-zA-Z\s'-]+$/.test(value)) {
                    errorMessage = 'Name can only contain letters, spaces, hyphens, and apostrophes';
                } else if (/\d/.test(value)) {
                    errorMessage = 'Name cannot contain numbers';
                }
                break;

            case 'phone':
                if (value) {
                    const digitsOnly = value.replace(/\D/g, '');
                    if (digitsOnly.length !== 10) {
                        errorMessage = 'Phone number must be exactly 10 digits';
                    } else if (!digitsOnly.startsWith('0')) {
                        errorMessage = 'Australian phone numbers must start with 0';
                    }
                }
                break;
        }

        if (errorMessage) {
            field.classList.add('error');
            errorElement.textContent = errorMessage;
            return false;
        } else {
            field.classList.remove('error');
            errorElement.textContent = '';
            return true;
        }
    }

    validateAllFields() {
        const firstNameValid = this.validateField('firstName');
        const lastNameValid = this.validateField('lastName');
        const phoneValid = this.validateField('phone');

        return firstNameValid && lastNameValid && phoneValid;
    }

    clearAllErrors() {
        const errorElements = document.querySelectorAll('.field-error');
        errorElements.forEach(element => {
            element.textContent = '';
        });

        const inputFields = document.querySelectorAll('input');
        inputFields.forEach(field => {
            field.classList.remove('error');
        });
    }

    formatPhoneNumber() {
        const phoneInput = document.getElementById('phone');
        const value = phoneInput.value.replace(/\D/g, ''); 
        
        let formattedValue = '';
        if (value.length > 0) {
            if (value.length <= 4) {
                formattedValue = value;
            } else if (value.length <= 7) {
                formattedValue = `${value.slice(0, 4)} ${value.slice(4)}`;
            } else {
                formattedValue = `${value.slice(0, 4)} ${value.slice(4, 7)} ${value.slice(7, 10)}`;
            }
        }
        
        phoneInput.value = formattedValue;
    }

    showMessage(message, type = 'info') {
        const messageElement = document.getElementById('statusMessage');
        messageElement.textContent = message;
        messageElement.className = `status-message ${type}`;
        messageElement.style.display = 'flex';
    }

    hideMessage() {
        const messageElement = document.getElementById('statusMessage');
        messageElement.style.display = 'none';
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = show ? 'flex' : 'none';
    }

    redirectToLogin() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('userFirstName');
        localStorage.removeItem('userLastName');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userPhone');
        window.location.href = 'user_login.html';
    }

    setupAddressEventListeners() {
        const addNewAddressBtn = document.getElementById('addNewAddressBtn');
        const addFirstAddressBtn = document.getElementById('addFirstAddressBtn');
        const closeAddressFormBtn = document.getElementById('closeAddressFormBtn');
        const cancelAddressBtn = document.getElementById('cancelAddressBtn');
        const addressForm = document.getElementById('addressForm');

        if (addNewAddressBtn) {
            addNewAddressBtn.addEventListener('click', () => this.showAddressForm());
        }
        if (addFirstAddressBtn) {
            addFirstAddressBtn.addEventListener('click', () => this.showAddressForm());
        }

        if (closeAddressFormBtn) {
            closeAddressFormBtn.addEventListener('click', () => this.closeAddressForm());
        }
        if (cancelAddressBtn) {
            cancelAddressBtn.addEventListener('click', () => this.closeAddressForm());
        }

        if (addressForm) {
            addressForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveAddress();
            });
        }

        const addressFormContainer = document.getElementById('addressFormContainer');
        if (addressFormContainer) {
            addressFormContainer.addEventListener('click', (e) => {
                if (e.target === addressFormContainer) {
                    this.closeAddressForm();
                }
            });
        }
    }

    async loadSavedAddresses() {
        try {
            console.log('🔍 Loading saved addresses...');
            
            const response = await fetch(`${this.API_BASE}/users/addresses`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📡 Addresses API response:', {
                status: response.status,
                ok: response.ok,
                statusText: response.statusText
            });

            if (response.ok) {
                const data = await response.json();
                console.log('📦 Addresses API result:', data);
                if (data.success && data.data) {
                    
                    const addresses = Array.isArray(data.data) ? data.data : (data.data.addresses || []);
                    this.displayAddresses(addresses);
                } else {
                    this.displayAddresses([]);
                }
            } else {
                console.error('Failed to load addresses');
                this.displayAddresses([]);
            }
        } catch (error) {
            console.error('Error loading addresses:', error);
            this.displayAddresses([]);
        }
    }

    displayAddresses(addresses) {
        console.log('🏠 Displaying addresses:', addresses);
        
        const savedAddressesContainer = document.getElementById('savedAddressesContainer');
        const noSavedAddresses = document.getElementById('noSavedAddresses');
        const savedAddressesList = document.getElementById('savedAddressesList');

        if (!addresses || addresses.length === 0) {
            console.log('📭 No addresses found, showing empty state');
            savedAddressesContainer.style.display = 'none';
            noSavedAddresses.style.display = 'block';
        } else {
            console.log(`📍 Found ${addresses.length} addresses, displaying them`);
            savedAddressesContainer.style.display = 'block';
            noSavedAddresses.style.display = 'none';
            savedAddressesList.innerHTML = '';

            addresses.forEach((address, index) => {
                console.log(`📍 Creating card for address ${index + 1}:`, address);
                const addressCard = this.createAddressCard(address);
                savedAddressesList.appendChild(addressCard);
            });
        }
    }

    createAddressCard(address) {
        const card = document.createElement('div');
        card.className = 'saved-address-card';
        card.dataset.addressId = address._id;

        const addressParts = [
            address.street,
            address.apartmentSuite,
            address.suburb,
            address.state,
            address.zipCode,
            address.country
        ].filter(Boolean);
        
        const fullAddress = addressParts.join(', ');

        card.innerHTML = `
            <div class="saved-address-header-row">
                <div class="address-label-group">
                    <span class="address-type-label">Address</span>
                    ${address.isPrimary ? '<span class="primary-badge">Primary</span>' : ''}
                </div>
                <div class="address-actions">
                    <button type="button" class="address-action-btn edit" data-address-id="${address._id}" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="address-action-btn delete" data-address-id="${address._id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="address-text">${fullAddress}</div>
        `;

        const editBtn = card.querySelector('.edit');
        const deleteBtn = card.querySelector('.delete');

        editBtn.addEventListener('click', () => this.editAddress(address));
        deleteBtn.addEventListener('click', () => this.deleteAddress(address._id));

        return card;
    }

    showAddressForm(address = null) {
        const addressFormContainer = document.getElementById('addressFormContainer');
        const addressFormTitle = document.getElementById('addressFormTitle');
        const addressForm = document.getElementById('addressForm');

        addressForm.reset();
        this.editingAddressId = null;

        if (address) {
            
            addressFormTitle.textContent = 'Edit Address';
            this.editingAddressId = address._id;

            document.getElementById('addressStreet').value = address.street || '';
            document.getElementById('apartmentSuite').value = address.apartmentSuite || '';
            document.getElementById('suburb').value = address.suburb || '';
            document.getElementById('addressState').value = address.state || '';
            document.getElementById('addressZipCode').value = address.zipCode || '';
            document.getElementById('addressCountry').value = address.country || 'Australia';
            document.getElementById('isPrimary').checked = address.isPrimary || false;
        } else {
            
            addressFormTitle.textContent = 'Add New Address';
            document.getElementById('addressCountry').value = 'Australia';
        }

        addressFormContainer.style.display = 'flex';

        this.initAutocomplete();
    }

    closeAddressForm() {
        const addressFormContainer = document.getElementById('addressFormContainer');
        addressFormContainer.style.display = 'none';
        this.editingAddressId = null;
    }

    editAddress(address) {
        this.showAddressForm(address);
    }

    async saveAddress() {
        const isPrimaryChecked = document.getElementById('isPrimary').checked;
        
        const addressData = {
            street: document.getElementById('addressStreet').value.trim(),
            apartmentSuite: document.getElementById('apartmentSuite').value.trim(),
            suburb: document.getElementById('suburb').value.trim(),
            state: document.getElementById('addressState').value,
            zipCode: document.getElementById('addressZipCode').value.trim(),
            country: document.getElementById('addressCountry').value,
            isPrimary: isPrimaryChecked
        };

        console.log('Saving address with data:', addressData);

        if (!addressData.street || !addressData.suburb || !addressData.state || !addressData.zipCode) {
            this.showAddressMessage('Please fill in all required fields', 'error');
            return;
        }

        try {
            const url = this.editingAddressId 
                ? `${this.API_BASE}/users/addresses/${this.editingAddressId}`
                : `${this.API_BASE}/users/addresses`;
            
            const method = this.editingAddressId ? 'PUT' : 'POST';

            console.log(`${method} request to:`, url);

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(addressData)
            });

            const data = await response.json();

            console.log('Server response:', data);

            if (response.ok && data.success) {
                this.showAddressMessage(
                    this.editingAddressId ? 'Address updated successfully' : 'Address added successfully',
                    'success'
                );
                this.closeAddressForm();
                await this.loadSavedAddresses();
            } else {
                console.error('Failed to save address:', data);
                this.showAddressMessage(data.message || 'Failed to save address', 'error');
            }
        } catch (error) {
            console.error('Error saving address:', error);
            this.showAddressMessage('An error occurred while saving the address', 'error');
        }
    }

    async deleteAddress(addressId) {
        try {
            const response = await fetch(`${this.API_BASE}/users/addresses/${addressId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (response.ok && data.success) {
                this.showAddressMessage('Address deleted successfully', 'success');
                await this.loadSavedAddresses();
            } else {
                this.showAddressMessage(data.message || 'Failed to delete address', 'error');
            }
        } catch (error) {
            console.error('Error deleting address:', error);
            this.showAddressMessage('An error occurred while deleting the address', 'error');
        }
    }

    initAutocomplete() {
        const streetInput = document.getElementById('addressStreet');
        
        if (!streetInput || typeof google === 'undefined') {
            return;
        }

        if (this.autocomplete) {
            google.maps.event.clearInstanceListeners(streetInput);
        }

        this.autocomplete = new google.maps.places.Autocomplete(streetInput, {
            componentRestrictions: { country: 'au' },
            fields: ['address_components', 'formatted_address'],
            types: ['address']
        });

        this.autocomplete.addListener('place_changed', () => {
            const place = this.autocomplete.getPlace();
            
            if (!place.address_components) {
                return;
            }

            let street = '';
            let suburb = '';
            let state = '';
            let zipCode = '';

            place.address_components.forEach(component => {
                const types = component.types;
                
                if (types.includes('street_number')) {
                    street = component.long_name;
                }
                if (types.includes('route')) {
                    street += (street ? ' ' : '') + component.long_name;
                }
                if (types.includes('locality')) {
                    suburb = component.long_name;
                }
                if (types.includes('administrative_area_level_1')) {
                    state = component.short_name;
                }
                if (types.includes('postal_code')) {
                    zipCode = component.long_name;
                }
            });

            if (street) document.getElementById('addressStreet').value = street;
            if (suburb) document.getElementById('suburb').value = suburb;
            if (state) document.getElementById('addressState').value = state;
            if (zipCode) document.getElementById('addressZipCode').value = zipCode;
        });
    }

    showAddressMessage(message, type = 'info') {
        const messageElement = document.getElementById('addressStatusMessage');
        messageElement.textContent = message;
        messageElement.className = `status-message ${type}`;
        messageElement.style.display = 'flex';

        setTimeout(() => {
            messageElement.style.display = 'none';
        }, 5000);
    }

    async loadOrderHistory() {
        const loadingState = document.getElementById('ordersLoadingState');
        const ordersContainer = document.getElementById('ordersContainer');
        const noOrdersState = document.getElementById('noOrdersState');
        const errorState = document.getElementById('ordersErrorState');

        loadingState.style.display = 'flex';
        ordersContainer.style.display = 'none';
        noOrdersState.style.display = 'none';
        errorState.style.display = 'none';

        try {
            const response = await fetch(`${this.API_BASE}/orders?limit=100`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                
                if (data.success && data.orders && data.orders.length > 0) {
                    this.displayOrders(data.orders);
                } else {
                    
                    loadingState.style.display = 'none';
                    noOrdersState.style.display = 'block';
                }
            } else {
                throw new Error('Failed to load orders');
            }
        } catch (error) {
            console.error('Error loading orders:', error);
            loadingState.style.display = 'none';
            errorState.style.display = 'block';
        }
    }

    displayOrders(orders) {
        const loadingState = document.getElementById('ordersLoadingState');
        const ordersContainer = document.getElementById('ordersContainer');
        const ordersList = document.getElementById('ordersList');

        ordersList.innerHTML = '';

        const sortedOrders = orders.sort((a, b) => {
            return new Date(b.createdAt || b.orderDate) - new Date(a.createdAt || a.orderDate);
        });

        sortedOrders.forEach(order => {
            const orderElement = this.createOrderElement(order);
            ordersList.appendChild(orderElement);
        });

        loadingState.style.display = 'none';
        ordersContainer.style.display = 'block';
    }

    createOrderElement(order) {
        const orderDiv = document.createElement('div');
        orderDiv.className = 'order-list-item';
        orderDiv.dataset.orderId = order._id;
        
        const statusClass = this.getStatusClass(order.status);
        const formattedDate = new Date(order.createdAt || order.orderDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const itemCount = order.items ? order.items.length : 0;
        const totalAmount = order.totalAmount || order.total || 0;
        const orderNumber = order.orderNumber || order._id.slice(-8);

        orderDiv.innerHTML = `
            <div class="order-list-item-content">
                <div class="order-list-left">
                    <div class="order-list-number">
                        <i class="fas fa-receipt"></i>
                        <span>Order #${orderNumber}</span>
                    </div>
                    <div class="order-list-meta">
                        <span class="order-list-date">
                            <i class="far fa-calendar"></i> ${formattedDate}
                        </span>
                        <span class="order-list-items">
                            <i class="fas fa-box"></i> ${itemCount} item${itemCount !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>
                <div class="order-list-right">
                    <span class="order-status ${statusClass}">${this.capitalizeFirst(order.status)}</span>
                    <span class="order-list-total">$${totalAmount.toFixed(2)}</span>
                    <button class="order-list-toggle">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </div>
            </div>
            <div class="order-list-details" style="display: none;">
                <!-- Details will be populated when clicked -->
            </div>
        `;

        const itemContent = orderDiv.querySelector('.order-list-item-content');
        const toggleBtn = orderDiv.querySelector('.order-list-toggle');
        const detailsDiv = orderDiv.querySelector('.order-list-details');
        
        const handleToggle = (e) => {
            e.stopPropagation();
            const isExpanded = detailsDiv.style.display === 'block';

            document.querySelectorAll('.order-list-details').forEach(detail => {
                detail.style.display = 'none';
            });
            document.querySelectorAll('.order-list-toggle i').forEach(icon => {
                icon.className = 'fas fa-chevron-down';
            });
            document.querySelectorAll('.order-list-item').forEach(item => {
                item.classList.remove('expanded');
            });
            
            if (!isExpanded) {
                
                detailsDiv.style.display = 'block';
                toggleBtn.querySelector('i').className = 'fas fa-chevron-up';
                orderDiv.classList.add('expanded');

                if (!detailsDiv.hasAttribute('data-loaded')) {
                    this.loadOrderDetails(order, detailsDiv);
                    detailsDiv.setAttribute('data-loaded', 'true');
                }
            }
        };
        
        itemContent.addEventListener('click', handleToggle);
        toggleBtn.addEventListener('click', handleToggle);

        return orderDiv;
    }

    loadOrderDetails(order, container) {
        const itemsHtml = order.items && Array.isArray(order.items) ? 
            order.items.map(item => `
                <div class="order-detail-item">
                    <div class="item-info">
                        <span class="item-name">${item.product?.name || item.name || 'Product'}</span>
                        <span class="item-details">Qty: ${item.quantity} × $${(item.price || 0).toFixed(2)}</span>
                    </div>
                    <span class="item-total">$${(item.total || item.quantity * item.price || 0).toFixed(2)}</span>
                </div>
            `).join('') : '<p>No items available</p>';

        container.innerHTML = `
            <div class="order-detail-section">
                <h4><i class="fas fa-shopping-cart"></i> Order Items</h4>
                <div class="order-items-list">
                    ${itemsHtml}
                </div>
            </div>
            ${order.address ? `
            <div class="order-detail-section">
                <h4><i class="fas fa-map-marker-alt"></i> Shipping Address</h4>
                <p class="order-address">${order.address}</p>
            </div>
            ` : ''}
            <div class="order-detail-section">
                <h4><i class="fas fa-credit-card"></i> Payment Method</h4>
                <p>${this.capitalizeFirst(order.paymentMethod || 'Not specified')}</p>
            </div>
        `;
    }

    getStatusClass(status) {
        const statusLower = (status || 'pending').toLowerCase();
        const statusMap = {
            'pending': 'pending',
            'processing': 'processing',
            'shipped': 'shipped',
            'delivered': 'delivered',
            'completed': 'completed',
            'cancelled': 'cancelled',
            'refunded': 'refunded'
        };
        return statusMap[statusLower] || 'pending';
    }

    capitalizeFirst(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    checkAuthProvider(data) {
        const googleNotice = document.getElementById('googleAccountNotice');
        const changePasswordCard = document.getElementById('changePasswordCard');
        const changePasswordBtn = document.getElementById('changePasswordBtn');

        if (data.provider === 'google' || data.googleId) {
            
            if (googleNotice) googleNotice.style.display = 'flex';

            if (changePasswordBtn) {
                changePasswordBtn.disabled = true;
                changePasswordBtn.innerHTML = '<i class="fas fa-lock"></i> Managed by Google';
            }

            if (changePasswordCard) {
                changePasswordCard.style.opacity = '0.6';
                changePasswordCard.style.cursor = 'not-allowed';
            }
        }
    }

    setupSecuritySection() {
        const changePasswordBtn = document.getElementById('changePasswordBtn');
        const deleteAccountBtn = document.getElementById('deleteAccountBtn');
        const deleteAccountModal = document.getElementById('deleteAccountModal');
        const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');

        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => {
                if (!changePasswordBtn.disabled) {
                    this.redirectToChangePassword();
                }
            });
        }

        if (deleteAccountBtn) {
            deleteAccountBtn.addEventListener('click', () => {
                this.showDeleteAccountModal();
            });
        }

        if (cancelDeleteBtn) {
            cancelDeleteBtn.addEventListener('click', () => {
                this.closeDeleteAccountModal();
            });
        }

        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', () => {
                this.deleteAccount();
            });
        }

        if (deleteAccountModal) {
            deleteAccountModal.addEventListener('click', (e) => {
                if (e.target === deleteAccountModal) {
                    this.closeDeleteAccountModal();
                }
            });
        }
    }

    redirectToChangePassword() {

        window.location.href = 'user_change_password.html';
    }

    showDeleteAccountModal() {
        const modal = document.getElementById('deleteAccountModal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    closeDeleteAccountModal() {
        const modal = document.getElementById('deleteAccountModal');

        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }

    async deleteAccount() {
        try {
            this.showLoading(true);

            const response = await fetch(`${this.API_BASE}/users/delete-account`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            this.showLoading(false);

            if (response.ok && data.success) {
                
                localStorage.removeItem('authToken');
                localStorage.removeItem('userFirstName');
                localStorage.removeItem('userLastName');
                localStorage.removeItem('userEmail');
                localStorage.removeItem('userPhone');
                
                window.location.href = 'index.html';
            } else {
                throw new Error(data.message || 'Failed to delete account');
            }
        } catch (error) {
            console.error('Error deleting account:', error);
            this.showLoading(false);
            this.showSecurityMessage(error.message || 'Failed to delete account. Please try again.', 'error');
        }
    }

    showSecurityMessage(message, type = 'info') {
        const messageElement = document.getElementById('securityStatusMessage');
        if (messageElement) {
            messageElement.textContent = message;
            messageElement.className = `status-message ${type}`;
            messageElement.style.display = 'flex';

            setTimeout(() => {
                messageElement.style.display = 'none';
            }, 5000);
        }
    }
}

window.initAutocomplete = function() {
    console.log('Google Places API loaded');

};

document.addEventListener('DOMContentLoaded', () => {
    window.profileManager = new ProfileManager();

    window.debugProfileAPI = () => {
        if (window.profileManager) {
            return window.profileManager.debugAPI();
        } else {
            console.log('Profile manager not initialized yet');
        }
    };
    
    window.populateFromLocalStorage = () => {
        if (window.profileManager) {
            return window.profileManager.populateFromLocalStorage();
        } else {
            console.log('Profile manager not initialized yet');
        }
    };
});
