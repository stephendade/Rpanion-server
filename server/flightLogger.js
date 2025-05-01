/*
 * Logs flight data (tlogs) to file
 */

const path = require('path')
const appRoot = require('app-root-path')
const fs = require('fs')
const moment = require('moment')

class flightLogger {
  constructor () {
    this.topfolder = path.join(appRoot.toString(), 'flightlogs')
    // this.tlogfolder = path.join(this.topfolder, 'tlogs')
    // this.binlogfolder = path.join(this.topfolder, 'binlogs')
    this.kmzlogfolder = path.join(this.topfolder, 'kmzlogs')
    // this.activeLogging = true
    // this.settings = settings

    // get settings
    // this.activeLogging = this.settings.value('flightLogger.activeLogging', true)

    // mkdir the log folders (both of them)
    fs.mkdirSync(this.topfolder, { recursive: true })
    // fs.mkdirSync(this.binlogfolder, { recursive: true })
    fs.mkdirSync(this.kmzlogfolder, { recursive: true })
  }

  // Delete all logs - tlog or binlog or kmz files
  clearlogs (logtype, curBinLog) {
    if (logtype === 'tlog') {
      const files = fs.readdirSync(this.topfolder)
      files.forEach((file) => {
        const filePath = path.join(this.topfolder, file)
        if (filePath.endsWith('.tlog')) {
          fs.unlinkSync(filePath)
        }
      })
      console.log('Deleted tlogs')
    } else if (logtype === 'binlog') {
      const files = fs.readdirSync(this.topfolder)
      files.forEach((file) => {
        const filePath = path.join(this.topfolder, file)
        // don't remove the actively logging file
        if (curBinLog !== filePath && filePath.endsWith('.bin')) {
          fs.unlinkSync(filePath)
        }
      })
      console.log('Deleted binlogs')
    } else if (logtype === 'kmzlog') {
      const files = fs.readdirSync(this.kmzlogfolder)
      files.forEach((file) => {
        const filePath = path.join(this.kmzlogfolder, file)
        fs.unlinkSync(filePath)
      })
      console.log('Deleted kmzlogs')
    }
  }

  // find all files in dir
  findInDir (dir, extfilter) {
    const files = fs.readdirSync(dir)
    const fileList = []

    files.forEach((file) => {
      const filePath = path.join(dir, file)
      const fileStat = fs.lstatSync(filePath)
      const filemTime = new Date(fileStat.mtimeMs)

      if (!fileStat.isDirectory() && filePath.endsWith(extfilter)) {
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
    const newfilestlog = this.findInDir(this.topfolder, '.tlog')
    const newfilesbinlog = this.findInDir(this.topfolder, '.bin')
    const newfileskmzlog = this.findInDir(this.kmzlogfolder, '.kmz')

    return callback(false, newfilestlog, newfilesbinlog, newfileskmzlog)
  };
}

module.exports = flightLogger
