const Rsync = require('rsync')
const path = require('path')
const fs = require('fs')
const { execSync } = require('child_process')

const logpaths = require('./paths.js')

// The rpanion service account is a system user with no usable home directory
// (HOME=/nonexistent), so the upload SSH keypair - and known_hosts, which ssh
// writes to even with StrictHostKeyChecking=no - are kept under
// logpaths.sshDir instead of the conventional ~/.ssh/.
const SSH_KEY_PATH = path.join(logpaths.sshDir, 'id_rsa')
const KNOWN_HOSTS_PATH = path.join(logpaths.sshDir, 'known_hosts')
const SSH_SHELL = `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=${KNOWN_HOSTS_PATH} -i ${SSH_KEY_PATH}`

class cloudUpload {
  constructor (settings) {
    this.options = {
      // the interval of sync, every 20 sec
      interval: 20
    }

    this.logsFolder = logpaths.flightsLogsDir
    this.mediaFolder = logpaths.mediaDir

    this.rsyncPidLogs = null
    this.rsyncPidMedia = null
    this.lastErrorLogs = ''
    this.lastErrorMedia = ''

    // load settings
    this.settings = settings
    this.options.uploadEnabled = this.settings.value('cloud.uploadEnabled', false)
    this.options.uploadLogs = this.settings.value('cloud.uploadLogs', true)
    this.options.uploadMedia = this.settings.value('cloud.uploadMedia', true)
    this.options.binUploadLink = this.settings.value('cloud.binUploadLink', '')
    this.options.syncDeletions = this.settings.value('cloud.syncDeletions', false)

    this.ensureSshKey()

    // interval for upload checks
    this.intervalObj = setInterval(() => {
      if (!this.options.uploadEnabled) {
        return
      }
      console.log('Upload interval')
      if (this.options.uploadLogs) {
        if (this.rsyncPidLogs) {
          this.rsyncPidLogs.kill()
        }
        this.rsyncPidLogs = this.runRsync(this.logsFolder, this.options.binUploadLink, ['*.bin'],
          (error) => { this.lastErrorLogs = error })
      }
      if (this.options.uploadMedia) {
        // Own subfolder on the remote end so media doesn't mix in with logs
        if (this.rsyncPidMedia) {
          this.rsyncPidMedia.kill()
        }
        this.rsyncPidMedia = this.runRsync(this.mediaFolder, this.options.binUploadLink + '/media', [],
          (error) => { this.lastErrorMedia = error })
      }
    }, this.options.interval * 1000)
  }

  // Syncs source/ to destination over ssh. onDone(error) fires once rsync
  // finishes, '' on success. One output handler covers both stdout/stderr -
  // the installed rsync package silently never calls a separate stderr
  // callback (bug in rsync.js:474).
  runRsync (source, destination, includes, onDone) {
    console.log('Syncing', source, 'to', destination)
    const rsync = new Rsync()
      .shell(SSH_SHELL)
      .flags('avzP')
      .source(source + '/')
      .destination(destination)

    includes.forEach(pattern => rsync.include(pattern))

    if (this.options.syncDeletions) {
      rsync.set('delete')
    }

    let outputBuffer = ''
    const captureOutput = (data) => {
      outputBuffer += data.toString()
      console.log('rsync:', data.toString().trim())
    }
    // 3rd arg is never called (same library bug) but must be a function.
    return rsync.execute((error, code, cmd) => {
      if (error) {
        console.log(error)
        console.log(code)
        console.log(cmd)
      }
      onDone(code === 0 ? '' : (outputBuffer.trim() || `rsync exited with code ${code}`))
    }, captureOutput, captureOutput)
  }

  quitting () {
    if (this.rsyncPidLogs) {
      this.rsyncPidLogs.kill()
    }
    if (this.rsyncPidMedia) {
      this.rsyncPidMedia.kill()
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
    return callback(this.options.uploadEnabled, this.options.uploadLogs, this.options.uploadMedia,
      this.options.binUploadLink, this.options.syncDeletions, pubkey)
  }

  setSettingsBin (uploadEnabled, uploadLogs, uploadMedia, binUploadLink, syncDeletions) {
    // save new settings
    this.options.uploadEnabled = uploadEnabled
    this.options.uploadLogs = uploadLogs
    this.options.uploadMedia = uploadMedia
    this.options.binUploadLink = binUploadLink
    this.options.syncDeletions = syncDeletions

    // and save to file
    try {
      this.settings.setValue('cloud.uploadEnabled', this.options.uploadEnabled)
      this.settings.setValue('cloud.uploadLogs', this.options.uploadLogs)
      this.settings.setValue('cloud.uploadMedia', this.options.uploadMedia)
      this.settings.setValue('cloud.binUploadLink', this.options.binUploadLink)
      this.settings.setValue('cloud.syncDeletions', this.options.syncDeletions)
      console.log('Saved Cloud Upload settings')
    } catch (e) {
      console.log(e)
    }
  }

  // Single combined status covering whichever of Logs/Media are selected -
  // "worst wins": an error beats running, running beats success/waiting.
  conStatusStr () {
    if (!this.options.uploadEnabled) {
      return 'Disabled'
    }
    const active = []
    if (this.options.uploadLogs) active.push({ pid: this.rsyncPidLogs, error: this.lastErrorLogs })
    if (this.options.uploadMedia) active.push({ pid: this.rsyncPidMedia, error: this.lastErrorMedia })

    if (active.length === 0) {
      return 'Nothing selected to upload'
    }
    if (active.some(a => a.pid && a.pid.exitCode === null)) {
      return 'Running'
    }
    const failed = active.filter(a => a.error)
    if (failed.length > 0) {
      return 'Error: ' + failed.map(a => a.error).join(' / ')
    }
    if (active.every(a => a.pid && a.pid.exitCode === 0)) {
      return 'Success'
    }
    return 'Waiting for first run'
  }
}

module.exports = cloudUpload
