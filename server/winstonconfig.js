var winston = require('winston');
const path = require('path');
var appRoot = require('app-root-path');

// define the custom settings for each transport (file, console)
var options = {
  file: {
    level: 'info',
    filename: `${appRoot}/logs/app.log`,
    handleExceptions: true,
    json: true,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    colorize: false,
  },
};

// instantiate a new Winston Logger with the settings defined above
var logger = new winston.createLogger({
    format: winston.format.combine(
        winston.format.label({ label: path.basename(process.mainModule.filename) }),
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.printf(info => `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`)
    ),
    transports: [
        new winston.transports.File(options.file),
    ],
  exitOnError: false, // do not exit on handled exceptions
});

module.exports = logger;
