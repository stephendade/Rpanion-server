const appRoot = require('app-root-path');
const path = require('path');
const fs = require('fs');

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development';

// Set base directory depending on dev mode
const baseDir = isDev ? 
    appRoot.toString() : 
    '/etc/rpanion-server';

// Get Python executable path from venv if it exists, otherwise use system python3
function getPythonPath() {
    const venvPython = path.join(baseDir, 'python', '.venv', 'bin', 'python3');
    
    // Check if venv Python exists
    if (fs.existsSync(venvPython)) {
        return venvPython;
    }
    
    // Fall back to system python3
    return 'python3';
}

// Export the paths
module.exports = {
    usersFile: path.join(baseDir, 'config', 'user.json'),
    settingsFile: path.join(baseDir, 'config', 'settings.json'),
    flightsLogsDir: path.join(baseDir, 'flightlogs'),
    kmzDir: path.join(baseDir, 'flightlogs', 'kmzlogs'),
    getPythonPath: getPythonPath,
};