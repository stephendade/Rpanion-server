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

    // mkdir the log and media folders
    fs.mkdirSync(this.topfolder, { recursive: true })
    // fs.mkdirSync(this.binlogfolder, { recursive: true })
    fs.mkdirSync(this.kmzlogfolder, { recursive: true })
    // and the media folder
    fs.mkdirSync(this.mediafolder, { recursive: true })
  }

  // Delete all logs - tlog or binlog or kmz files
  clearlogs (logtype, curBinLog) {
    function deleteRecursively (targetPath) {
      const targetStat = fs.lstatSync(targetPath)
      if (targetStat.isDirectory()) {
        const entries = fs.readdirSync(targetPath)
        entries.forEach((entry) => {
          deleteRecursively(path.join(targetPath, entry))
        })
        fs.rmdirSync(targetPath)
      } else {
        fs.unlinkSync(targetPath)
      }
    }

    function deleteMatchingFiles (dir, matcher) {
      const entries = fs.readdirSync(dir)
      entries.forEach((entry) => {
        const entryPath = path.join(dir, entry)
        const entryStat = fs.lstatSync(entryPath)
        if (entryStat.isDirectory()) {
          deleteMatchingFiles(entryPath, matcher)
        } else if (matcher(entryPath)) {
          fs.unlinkSync(entryPath)
        }
      })
    }

    function removeEmptySubDirs (dir) {
      const entries = fs.readdirSync(dir)
      entries.forEach((entry) => {
        const entryPath = path.join(dir, entry)
        const stat = fs.lstatSync(entryPath)
        if (stat.isDirectory()) {
          removeEmptySubDirs(entryPath)
          try {
            fs.rmdirSync(entryPath)
          } catch (e) {
            // Directory not empty, skip
          }
        }
      })
    }

    if (logtype === 'tlog') {
      deleteMatchingFiles(this.topfolder, (filePath) => filePath.endsWith('.tlog'))
      removeEmptySubDirs(this.topfolder)
      console.log('Deleted tlogs')
    } else if (logtype === 'binlog') {
      // Don't delete the actively logging file
      deleteMatchingFiles(this.topfolder, (filePath) => filePath.endsWith('.bin') && filePath !== curBinLog)
      removeEmptySubDirs(this.topfolder)
      console.log('Deleted binlogs')
    } else if (logtype === 'kmzlog') {
      fs.readdirSync(this.kmzlogfolder).forEach((entry) => {
        deleteRecursively(path.join(this.kmzlogfolder, entry))
      })
      console.log('Deleted kmzlogs')
    } else if (logtype === 'media') {
      fs.readdirSync(this.mediafolder).forEach((entry) => {
        deleteRecursively(path.join(this.mediafolder, entry))
      })
      console.log('Deleted all media files and subfolders')
    }
  }

  // find all files in dir (recursively)
  findInDir (dir, extfilter) {
    const fileList = []
    const extensions = Array.isArray(extfilter) ? extfilter : [extfilter]
    const topFolder = this.topfolder

    function scanDirectory(currentDir) {
      const files = fs.readdirSync(currentDir)

      files.forEach((file) => {
        const filePath = path.join(currentDir, file)
        const fileStat = fs.lstatSync(filePath)
        const filemTime = new Date(fileStat.mtimeMs)

        if (fileStat.isDirectory()) {
          // Recursively scan subdirectories
          scanDirectory(filePath)
        } else if (extensions.some(ext => filePath.toLowerCase().endsWith(ext.toLowerCase()))) {
          const relpath = path.relative(topFolder, filePath)
          const mTime = moment(filemTime).format('LLL')
          fileList.push({ key: relpath, name: path.basename(filePath), modified: mTime, size: Math.round(fileStat.size / 1024) })
        }
      })
    }

    scanDirectory(dir)
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
