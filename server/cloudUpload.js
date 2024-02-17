const Rsync = require('rsync')
const path = require('path')
const appRoot = require('app-root-path')
const fs = require('fs')
const os = require('os')
const winston = require('./winstonconfig')(module)
const { execSync } = require('child_process')

class cloudUpload {
  constructor (settings) {
    this.options = {
      // the interval of sync, every 20 sec
      interval: 20
    }

    this.topfolder = path.join(appRoot.toString(), 'flightlogs')

    this.rsyncPid = null

    // load settings
    this.settings = settings
    this.options.doBinUpload = this.settings.value('cloud.doBinUpload', false)
    this.options.binUploadLink = this.settings.value('cloud.binUploadLink', '')
    this.options.syncDeletions = this.settings.value('cloud.syncDeletions', false)

    // create ssh key if none already
    if (fs.existsSync(os.homedir() + '/.ssh/')) {
      const files = fs.readdirSync(os.homedir() + '/.ssh/')
      if (files.length === 0) {
        execSync('< /dev/zero ssh-keygen -q -N ""')
      }
    }

    // interval for upload checks
    this.intervalObj = setInterval(() => {
      console.log('Upload interval')
      if (this.options.doBinUpload) {
        console.log('Doing binfile')
        const rsync = new Rsync()
          .shell('ssh -o StrictHostKeyChecking=no')
          .flags('avzP')
          .source(this.topfolder + '/')
          .destination(this.options.binUploadLink)
          .include('*.bin')

        if (this.options.syncDeletions) {
          rsync.set('delete')
        }

        // Kill old rsync and create new one
        if (this.rsyncPid) {
          this.rsyncPid.kill()
        }

        this.rsyncPid = rsync.execute(function (error, code, cmd) {
          // we're done
          // this.rsyncPid = null
          if (error) {
            console.log(error)
            console.log(code)
            console.log(cmd)
            winston.info(error)
            winston.info(code)
            winston.info(cmd)
          }
        })
      }
    }, this.options.interval * 1000)
  }

  quitting () {
    winston.info('---Shutdown Cloud---')
    if (this.rsyncPid) {
      this.rsyncPid.kill()
    }
    clearInterval(this.intervalObj)
  }

  getSettings (callback) {
    // get current settings and pubkey(s)
    const pubkey = []
    if (fs.existsSync(os.homedir() + '/.ssh/')) {
      const files = fs.readdirSync(os.homedir() + '/.ssh/')
      files.forEach(file => {
        if (path.extname(file) === '.pub') {
          pubkey.push(fs.readFileSync(os.homedir() + '/.ssh/' + file, { encoding: 'utf8', flag: 'r' }))
        }
      })
    }
    return callback(this.options.doBinUpload,
      this.options.binUploadLink, this.options.syncDeletions, pubkey)
  }

  setSettingsBin (doBinUpload, binUploadLink, syncDeletions) {
    // save new settings
    this.options.doBinUpload = doBinUpload
    this.options.binUploadLink = binUploadLink
    this.options.syncDeletions = syncDeletions

    // and save to file
    try {
      this.settings.setValue('cloud.doBinUpload', this.options.doBinUpload)
      this.settings.setValue('cloud.binUploadLink', this.options.binUploadLink)
      this.settings.setValue('cloud.syncDeletions', this.options.syncDeletions)
      console.log('Saved Cloud Bin settings')
      winston.info('Saved Cloud Bin settings')
    } catch (e) {
      console.log(e)
      winston.info(e)
    }
  }

  // Get the rsync status for binlog
  conStatusBinStr () {
    if (!this.options.doBinUpload) {
      return 'Disabled'
    }
    if (this.rsyncPid) {
      if (this.rsyncPid.exitCode === null) {
        return 'Running'
      } else if (this.rsyncPid.exitCode === 0) {
        return 'Success'
      } else {
        return 'Error running Rsync'
      }
    }
    return 'Waiting for first run'
  }
}

module.exports = cloudUpload
