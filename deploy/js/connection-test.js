
(function() {
    const statusElement = document.createElement('div');
    statusElement.id = 'connection-status';
    statusElement.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 10px;
        padding: 10px;
        background-color: rgba(0,0,0,0.7);
        color: white;
        border-radius: 5px;
        font-family: monospace;
        z-index: 9999;
        max-width: 300px;
    `;
    document.body.appendChild(statusElement);

    function updateStatus(message, isError = false) {
        statusElement.innerHTML = message;
        statusElement.style.backgroundColor = isError ? 'rgba(255,0,0,0.7)' : 'rgba(0,128,0,0.7)';
    }

    const API_BASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.API_URL) 
        ? CONFIG.API_URL 
        : '/api';

    async function testConnection() {
        updateStatus('Testing connection...');
        
        try {
            const response = await fetch(`${API_BASE_URL}/auth/csrf-token`, {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (response.ok) {
                const data = await response.json();
                updateStatus(`Connection OK! <br>Server responded: ${JSON.stringify(data)}`);
                return true;
            } else {
                updateStatus(`Server error: ${response.status} ${response.statusText}`, true);
                return false;
            }
        } catch (error) {
            console.error('Connection test error:', error);

            let errorMsg = 'Connection error!';
            
            if (!navigator.onLine) {
                errorMsg = 'Your device is offline. Please check your internet connection.';
            } else if (error.name === 'TypeError' && error.message === 'Failed to fetch') {
                errorMsg = 'Could not connect to server. Is the server running?<br>Check: <br>1. Server running at port 5002<br>2. No firewall blocking<br>3. Check browser console';
            } else if (error.name === 'AbortError') {
                errorMsg = 'Connection timed out. Server may be slow or unreachable.';
            } else {
                errorMsg = `${error.name}: ${error.message}`;
            }
            
            updateStatus(errorMsg, true);
            return false;
        }
    }

    testConnection();

    const retryButton = document.createElement('button');
    retryButton.innerText = 'Retry Connection Test';
    retryButton.style.cssText = `
        position: fixed;
        bottom: 10px;
        right: 320px;
        padding: 10px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        z-index: 9999;
    `;
    retryButton.onclick = testConnection;
    document.body.appendChild(retryButton);

    const testPort = async (port) => {
        try {
            const response = await fetch(`http://localhost:${port}/api/auth/csrf-token`, {
                method: 'GET',
                mode: 'no-cors',
                cache: 'no-cache',
                credentials: 'omit',
                redirect: 'follow',
                referrerPolicy: 'no-referrer',
                timeout: 2000
            });
            return true; 
        } catch (e) {
            return false; 
        }
    };

    const checkCommonPorts = async () => {
        const commonPorts = [5002, 5001, 3000, 8000, 8080];
        const portsDiv = document.createElement('div');
        portsDiv.style.cssText = `
            position: fixed;
            bottom: 60px;
            right: 10px;
            padding: 10px;
            background-color: rgba(0,0,0,0.7);
            color: white;
            border-radius: 5px;
            font-family: monospace;
            z-index: 9999;
            max-width: 300px;
        `;
        portsDiv.innerHTML = 'Checking ports...';
        document.body.appendChild(portsDiv);
        
        let results = 'Port scan results:<br>';
        for (const port of commonPorts) {
            const isOpen = await testPort(port);
            results += `Port ${port}: ${isOpen ? '✅' : '❌'}<br>`;
        }
        
        portsDiv.innerHTML = results;
    };

    setTimeout(checkCommonPorts, 1000);

    window.connectionTest = {
        test: testConnection,
        checkPorts: checkCommonPorts
    };
})();