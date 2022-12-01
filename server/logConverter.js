const spawn = require('child_process').spawn
const path = require('path')
const appRoot = require('app-root-path')

class logConverter {
  constructor (settings, winston) {
    this.options = {
      // the interval of sync, every 20 sec
      interval: 20
    }
    this.winston = winston

    this.pythonFolder = path.join(appRoot.toString(), 'python')
    this.pythonScript = path.join(this.pythonFolder, 'tlog2kmz.py')

    this.converterPid = null
    this.tlogfilename = null

    // load settings
    this.settings = settings
    this.options.doLogConversion = this.settings.value('logConverter.doLogConversion', true)

    // interval for conversion checks
    this.intervalObj = setInterval(() => {
      console.log('LogConverter interval')
      if (this.options.doLogConversion) {
        try {
          console.log('Doing log conversion...')
          this.converterPid = spawn('python3',[this.pythonScript])
          this.converterPid.stdout.on('data', (data) => {
            console.log(`stdout from log converter: ${data}`)
          })
          this.converterPid.stderr.on('data', (data) => {
            console.error(`stderr from log converter: ${data}`)
          })
          this.converterPid.on('close', (code) => {
            console.log(`Log converter exited with code ${code}`)
          });
        } catch (error) {
          console.error(error)
        }
      }
    }, this.options.interval * 1000)
  }

  quitting () {
    if (this.converterPid) {
      this.converterPid.kill()
    }
    clearInterval(this.intervalObj)
  }

  getSettings (callback) {
    // get current settings
    return callback(this.options.doLogConversion)
  }

  setSettingsLog (doLogConversion) {
    // save new settings
    this.options.doLogConversion = doLogConversion
    // and save to file
    try {
      this.settings.setValue('logConverter.doLogConversion', this.options.doLogConversion)
      console.log('Saved Log Converter settings')
      this.winston.info('Saved Log Converter settings')
    } catch (e) {
      console.log(e)
      this.winston.info(e)
    }
  }

  // Get the rsync status for binlog
  conStatusLogStr () {
    if (!this.options.doLogConversion) {
      return 'Disabled'
    }
    if (this.converterPid) {
      if (this.converterPid.connected) {
        if (this.converterPid.exitCode === null) {
          return 'Running'
        } else if (this.converterPid.exitCode === 0) {
          return 'Success'
        } else {
          return 'Error running kml converter'
        }
      }
    }

    return 'Waiting for run'
  }
}

module.exports = logConverter
