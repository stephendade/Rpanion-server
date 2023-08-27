const winston = require('winston')
const path = require('path')
const appRoot = require('app-root-path')

// define the custom settings for each transport (file, console)
const options = {
  file: {
    level: 'info',
    filename: `${appRoot}/logs/app.log`,
    handleExceptions: true,
    json: true,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
    colorize: false
  }
}

// Return the last folder name in the path and the calling
// module's filename.
const getLabel = function (callingModule) {
  const parts = callingModule.filename.split(path.sep)
  return path.join(parts[parts.length - 2], parts.pop())
}

// instantiate a new Winston Logger with the settings defined above
function logger (callingModule) {
  return new winston.createLogger({
    format: winston.format.combine(
      winston.format.label({ label: getLabel(callingModule) }),
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
      }),
      winston.format.printf(info => `${info.timestamp} ${info.level} [${info.label}]: ${info.message}`)
    ),
    transports: [
      new winston.transports.File(options.file)
    ],
    exitOnError: false // do not exit on handled exceptions
  })
};

module.exports = logger
