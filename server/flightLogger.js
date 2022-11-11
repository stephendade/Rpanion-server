/*
 * Logs flight data (tlogs) to file
 */

const path = require('path')
const appRoot = require('app-root-path')
const fs = require('fs')
const moment = require('moment')
const microtime = require('microtime')
const process = require('process')

class flightLogger {
  constructor (settings, winston) {
    this.topfolder = path.join(appRoot.toString(), 'flightlogs')
    this.tlogfolder = path.join(this.topfolder, 'tlogs')
    this.binlogfolder = path.join(this.topfolder, 'binlogs')
    this.kmzlogfolder = path.join(this.topfolder, 'kmzlogs')
    this.activeFileTlog = null
    this.activeLogging = true
    this.settings = settings

    this.winston = winston

    // get settings
    this.activeLogging = this.settings.value('flightLogger.activeLogging', true)

    // Disable logging on nodejs < 12
    if (parseInt(process.versions.node) < 12) {
      this.activeLogging = false
    }

    // mkdir the log folders (both of them)
    fs.mkdirSync(this.tlogfolder, { recursive: true })
    fs.mkdirSync(this.binlogfolder, { recursive: true })
    fs.mkdirSync(this.kmzlogfolder, { recursive: true })
  }


  // Start a new tlog
  newtlog () {
    if (parseInt(process.versions.node) < 12) {
      console.log('Cannot do logging on nodejs version <12')
      this.winston.info('Cannot do logging on nodejs version <12')
      return
    }
    const filename = moment().format('YYYYMMDD-HHmmss') // new Date().toISOString();
    this.activeFileTlog = path.join(this.tlogfolder, filename + '.tlog')
    console.log('New Tlog: ' + this.activeFileTlog)
    this.winston.info('New Tlog: ' + this.activeFileTlog)
  }

  // stop logging (Tlog)
  stoptlog () {
    if (this.activeFileTlog) {
      // delete if size 0?
      console.log('Closed Tlog: ' + this.activeFileTlog)
      this.winston.info('Closed Tlog: ' + this.activeFileTlog)
      this.activeFileTlog = null
    }
  }

  // Delete all logs - tlog or binlog or kmz files
  clearlogs (logtype, curBinLog) {
    if (logtype === 'tlog') {
      const files = fs.readdirSync(this.tlogfolder)
      files.forEach((file) => {
        const filePath = path.join(this.tlogfolder, file)
        // don't remove the actively logging file
        if (!(this.activeFileTlog === filePath && this.activeLogging)) {
          fs.unlinkSync(filePath)
        }
      })
      console.log('Deleted tlogs')
      this.winston.info('Deleted tlogs')
    } else if (logtype === 'binlog') {
      const files = fs.readdirSync(this.binlogfolder)
      files.forEach((file) => {
        const filePath = path.join(this.binlogfolder, file)
        // don't remove the actively logging file
        if (curBinLog !== filePath) {
          fs.unlinkSync(filePath)
        }
      })
      console.log('Deleted binlogs')
      this.winston.info('Deleted binlogs')
    } else if (logtype === 'kmzlog') {
      const files = fs.readdirSync(this.kmzlogfolder)
      files.forEach((file) => {
        const filePath = path.join(this.kmzlogfolder, file)
        fs.unlinkSync(filePath)
      })
      console.log('Deleted kmzlogs')
      this.winston.info('Deleted kmzlogs')
    }
  }

  // write data to active log(s)
  // takes in a mavlink message
  // needs to be synchonous to ensure logfile isn't opened in parallel
  writetlog (msg) {
    if (!this.activeLogging) {
      return false
    }
    if (!this.activeFileTlog) {
      this.newtlog()
    }
    try {
      // note this section does not work on nodejs < 12

      // Note we're using BigInt here, as a standard 32-bit Int
      // is too small to hold a microsecond timestamp
      const microSeconds = BigInt(microtime.now())
      const timebits = Buffer.alloc(8) // 8 bytes = 64 bits = BigInt

      // use this instead of jspack.Pack('>Q', [microSeconds]);
      timebits.writeBigInt64BE(microSeconds)

      const toWrite = Buffer.concat([timebits, msg._msgbuf])
      fs.appendFileSync(this.activeFileTlog, toWrite, 'binary')
      return true
    } catch (err) {
      console.log(err)
      return false
    }
  }

  // enable or disable logging by sending true or false
  setLogging (logstat) {
    if (parseInt(process.versions.node) < 12) {
      this.activeLogging = false
    } else {
      this.activeLogging = logstat
    }

    // and save
    this.settings.setValue('flightLogger.activeLogging', this.activeLogging)

    console.log('Saved Logging settings: ' + this.activeLogging)
    this.winston.info('Saved Logging settings: ' + this.activeLogging)

    return this.activeLogging
  }

  // get system status
  getStatus () {
    if (parseInt(process.versions.node) < 12) {
      return 'Cannot do logging on nodejs version <12'
    }
    if (this.activeFileBinlog && this.activeFileTlog && this.activeLogging) {
      return 'Logging to ' + path.basename(this.activeFileTlog) + ' and ' + path.basename(this.activeFileBinlog)
    } else if (!this.activeFileBinLog && this.activeFileTlog && this.activeLogging) {
      return 'Logging to ' + path.basename(this.activeFileTlog)
    } else if (!this.activeFileTlog && this.activeLogging) {
      return 'Logging Enabled, no packets from ArduPilot'
    } else {
      return 'Not Logging'
    }
  }

  // find all files in dir
  findInDir (dir, fileList = []) {
    const files = fs.readdirSync(dir)

    files.forEach((file) => {
      const filePath = path.join(dir, file)
      const fileStat = fs.lstatSync(filePath)
      const filemTime = new Date(fileStat.mtimeMs)

      if (fileStat.isDirectory()) {
        this.findInDir(filePath, fileList)
      } else {
        const relpath = path.relative(this.topfolder, filePath)
        const mTime = moment(filemTime).format('LLL')
        fileList.push({ key: relpath, name: path.basename(filePath), modified: mTime, size: Math.round(fileStat.size / 1024) })
      }
    })

    return fileList
  }

  // get list of logfiles for website
  // return format is (err, tlogs)
  getLogs (callback) {
    const newfilestlog = this.findInDir(this.tlogfolder)
    const newfilesbinlog = this.findInDir(this.binlogfolder)
    const newfileskmzlog = this.findInDir(this.kmzlogfolder)

    return callback(false, newfilestlog, newfilesbinlog, newfileskmzlog, this.activeLogging)
  };
}

module.exports = flightLogger
