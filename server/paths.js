const appRoot = require('app-root-path');
const path = require('path');

// Check if we're in development mode
const isDev = process.env.NODE_ENV === 'development';

// Set base directory depending on dev mode
const baseDir = isDev ? 
    appRoot.toString() : 
    '/etc/rpanion-server';

// Export the paths
module.exports = {
    usersFile: path.join(baseDir, 'config', 'user.json'),
    settingsFile: path.join(baseDir, 'config', 'settings.json'),
    flightsLogsDir: path.join(baseDir, 'flightlogs'),
    kmzDir: path.join(baseDir, 'flightlogs', 'kmzlogs'),
};