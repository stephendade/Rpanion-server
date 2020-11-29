/*
 * Logs flight data (tlogs) to file
 */

const path = require('path')
var appRoot = require('app-root-path')
var fs = require('fs')
var moment = require('moment')
var microtime = require('microtime')
var winston = require('./winstonconfig')(module)
const process = require('process')

class flightLogger {
  constructor (settings) {
    this.topfolder = path.join(appRoot.toString(), 'flightlogs')
    this.tlogfolder = path.join(this.topfolder, 'tlogs')
    this.binlogfolder = path.join(this.topfolder, 'binlogs')
    this.activeFileTlog = null
    this.activeFileBinlog = null
    this.binLogSeq = -1
    this.binLogLastTime = 0
    this.activeLogging = true
    this.settings = settings

    // get settings
    this.activeLogging = this.settings.value('flightLogger.activeLogging', true)

    // Disable logging on nodejs < 12
    if (parseInt(process.versions.node) < 12) {
      this.activeLogging = false
    }

    // mkdir the log folders (both of them)
    fs.mkdirSync(this.tlogfolder, { recursive: true })
    fs.mkdirSync(this.binlogfolder, { recursive: true })
  }

  // Start a new tlog
  newtlog () {
    if (parseInt(process.versions.node) < 12) {
      console.log('Cannot do logging on nodejs version <12')
      winston.info('Cannot do logging on nodejs version <12')
      return
    }
    var filename = moment().format('YYYYMMDD-HHmmss') // new Date().toISOString();
    this.activeFileTlog = path.join(this.tlogfolder, filename + '.tlog')
    console.log('New Tlog: ' + this.activeFileTlog)
    winston.info('New Tlog: ' + this.activeFileTlog)
  }

  // Start a new binlog
  newbinlog () {
    if (parseInt(process.versions.node) < 12) {
      console.log('Cannot do logging on nodejs version <12')
      winston.info('Cannot do logging on nodejs version <12')
      return
    }
    // already logging
    if (this.activeFileBinlog) {
      console.log('Error: Binlog already active')
      return
    }

    this.binLogSeq = -1
    this.binLogLastTime = 0

    var filename = moment().format('YYYYMMDD-HHmmss') // new Date().toISOString();
    this.activeFileBinlog = path.join(this.binlogfolder, filename + '.bin')
    console.log('New Binlog: ' + this.activeFileBinlog)
    winston.info('New Binlog: ' + this.activeFileBinlog)
  }

  // stop logging (Tlog)
  stoptlog () {
    if (this.activeFileTlog) {
      console.log('Closed Tlog: ' + this.activeFileTlog)
      winston.info('Closed Tlog: ' + this.activeFileTlog)
      this.activeFileTlog = null
    }
  }

  // stop logging (Binlog)
  stopbinlog () {
    if (this.activeFileBinlog) {
      console.log('Closed Binlog: ' + this.activeFileBinlog)
      winston.info('Closed Binlog: ' + this.activeFileBinlog)
      this.activeFileBinlog = null
      this.binLogSeq = -1
      this.binLogLastTime = 0
    }
  }

  // Delete all logs - tlog or binlog
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
      winston.info('Deleted tlogs')
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
      winston.info('Deleted binlogs')
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
      var timebits = Buffer.alloc(8) // 8 bytes = 64 bits = BigInt

      // use this instead of jspack.Pack('>Q', [microSeconds]);
      timebits.writeBigInt64BE(microSeconds)

      var toWrite = Buffer.concat([timebits, msg._msgbuf])
      fs.appendFileSync(this.activeFileTlog, toWrite, 'binary')
      return true
    } catch (err) {
      console.log(err)
      return false
    }
  }

  // write data to active bin log
  // takes in a mavlink message of
  // needs to be synchonous to ensure logfile isn't opened in parallel
  writeBinlog (msg) {
    if ((this.binLogLastTime + 1000) < Date.now() && this.binLogLastTime !== 0) {
      // close log - no new packets in a while (1 sec)
      this.stopbinlog()
      return false
    }
    if (!this.activeLogging || msg.name !== 'REMOTE_LOG_DATA_BLOCK') {
      return false
    }
    if (msg.seqno === 0) {
      // start a new log
      this.newbinlog()
    }
    if (this.activeFileBinlog === null) {
      return false
    }
    try {
      if ((this.binLogSeq + 1) !== msg.seqno) {
        console.log('Binlog OOT: seq=' + msg.seqno + ', exp=' + (this.binLogSeq + 1))
      }
      this.binLogSeq = Math.max(msg.seqno, this.binLogSeq)
      this.binLogLastTime = Date.now()

      fs.open(this.activeFileBinlog, 'a', function (err, file) {
        if (err) throw err
        fs.write(file, msg.data, msg.seqno * 200, function (err, writtenbytes) {
          if (err) {
            console.log('Write error: ' + err)
          }
          fs.closeSync(file)
        })
      })
      // fs.appendFileSync(this.activeFileBinlog, msg.data, 'binary')
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
    winston.info('Saved Logging settings: ' + this.activeLogging)

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
        var relpath = path.relative(this.topfolder, filePath)
        var mTime = moment(filemTime).format('LLL')
        fileList.push({ key: relpath, name: path.basename(filePath), modified: mTime, size: Math.round(fileStat.size / 1024) })
      }
    })

    return fileList
  }

  // get list of logfiles for website
  // return format is (err, tlogs)
  getLogs (callback) {
    var newfilestlog = this.findInDir(this.tlogfolder)
    var newfilesbinlog = this.findInDir(this.binlogfolder)
    return callback(false, newfilestlog, newfilesbinlog, this.activeLogging)
  };
}

module.exports = flightLogger
