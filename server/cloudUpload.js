const Rsync = require('rsync')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

const logpaths = require('./paths.js')

// The rpanion service account is a system user with no usable home directory
// (HOME=/nonexistent), so the upload SSH keypair is kept under logpaths.sshDir
// instead of the conventional ~/.ssh/.
const SSH_KEY_PATH = path.join(logpaths.sshDir, 'id_rsa')

class cloudUpload {
  constructor (settings) {
    this.options = {
      // the interval of sync, every 20 sec
      interval: 20
    }

    this.topfolder = logpaths.flightsLogsDir

    this.rsyncPid = null

    // load settings
    this.settings = settings
    this.options.doBinUpload = this.settings.value('cloud.doBinUpload', false)
    this.options.binUploadLink = this.settings.value('cloud.binUploadLink', '')
    this.options.syncDeletions = this.settings.value('cloud.syncDeletions', false)

    this.ensureSshKey()

    // interval for upload checks
    this.intervalObj = setInterval(() => {
      console.log('Upload interval')
      if (this.options.doBinUpload) {
        console.log('Doing binfile')
        const rsync = new Rsync()
          .shell(`ssh -o StrictHostKeyChecking=no -i ${SSH_KEY_PATH}`)
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
          }
        })
      }
    }, this.options.interval * 1000)
  }

  quitting () {
    if (this.rsyncPid) {
      this.rsyncPid.kill()
    }
    clearInterval(this.intervalObj)
  }

  // Create the upload SSH keypair under logpaths.sshDir if it doesn't
  // already exist. Errors are caught and logged rather than thrown, so a
  // failure here can't take down the caller (e.g. the /api/cloudinfo route).
  ensureSshKey () {
    try {
      fs.mkdirSync(logpaths.sshDir, { recursive: true })
      fs.chmodSync(logpaths.sshDir, 0o700)
      if (!fs.existsSync(SSH_KEY_PATH)) {
        execSync(`ssh-keygen -q -N "" -f ${SSH_KEY_PATH}`)
        console.log('Created new SSH keypair for cloud upload:', SSH_KEY_PATH)
      }
    } catch (e) {
      console.error('Failed to create SSH key for cloud upload:', e.message)
    }
  }

  getSettings (callback) {
    // get current settings and pubkey(s)
    const pubkey = []
    this.ensureSshKey()
    try {
      const files = fs.readdirSync(logpaths.sshDir)
      files.forEach(file => {
        if (path.extname(file) === '.pub') {
          pubkey.push(fs.readFileSync(path.join(logpaths.sshDir, file), { encoding: 'utf8', flag: 'r' }))
        }
      })
    } catch (e) {
      console.error('Failed to read SSH public keys:', e.message)
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
    } catch (e) {
      console.log(e)
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
