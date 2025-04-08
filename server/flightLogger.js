/*
 * Logs flight data (tlogs) to file
 */

const path = require('path')
const fs = require('fs')
const moment = require('moment')
const logpaths = require('./paths.js')

class flightLogger {
  constructor () {
    this.topfolder = logpaths.flightsLogsDir
    // this.tlogfolder = path.join(this.topfolder, 'tlogs')
    // this.binlogfolder = path.join(this.topfolder, 'binlogs')
    this.kmzlogfolder = logpaths.kmzDir
    this.mediafolder = logpaths.mediaDir
    // this.activeLogging = true
    // this.settings = settings

    // get settings
    // this.activeLogging = this.settings.value('flightLogger.activeLogging', true)

    // mkdir the log folders (both of them)
    fs.mkdirSync(this.topfolder, { recursive: true })
    // fs.mkdirSync(this.binlogfolder, { recursive: true })
    fs.mkdirSync(this.kmzlogfolder, { recursive: true })
    // and the media folder
    fs.mkdirSync(this.mediafolder, { recursive: true })
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
    } else if (logtype === 'media') {
      const files = fs.readdirSync(this.mediafolder)
      files.forEach((file) => {
        const filePath = path.join(this.mediafolder, file)
        fs.unlinkSync(filePath)
      })
      console.log('Deleted all media files')
    }
  }

  // find all files in dir
  findInDir (dir, extfilter) {
    const files = fs.readdirSync(dir)
    const fileList = []
    const extensions = Array.isArray(extfilter) ? extfilter : [extfilter]

    files.forEach((file) => {
      const filePath = path.join(dir, file)
      const fileStat = fs.lstatSync(filePath)
      const filemTime = new Date(fileStat.mtimeMs)

      if (!fileStat.isDirectory() && extensions.some(ext => filePath.toLowerCase().endsWith(ext.toLowerCase()))) {
      //if (!fileStat.isDirectory() && filePath.endsWith(extfilter)) {
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
    const newfilesmedia = this.findInDir(this.mediafolder, ['.jpg', '.png', '.gif', '.avi', '.mp4', '.h264', '.h265'])

    return callback(false, newfilestlog, newfilesbinlog, newfileskmzlog, newfilesmedia)
  };
}

module.exports = flightLogger
