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
// ServerAlive* detects a dead connection (e.g. dropped VPN/wifi) within ~45s
// instead of leaving rsync hung indefinitely on a socket that'll never reply.
const SSH_SHELL = `ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=${KNOWN_HOSTS_PATH} -o ServerAliveInterval=15 -o ServerAliveCountMax=3 -i ${SSH_KEY_PATH}`
// Backstop for hangs ServerAlive can't see (e.g. remote stuck on disk I/O).
const RSYNC_TIMEOUT_MINUTES = 10

class cloudUpload {
  constructor (settings, fcManager) {
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
    this.fcManager = fcManager
    this.options.uploadEnabled = this.settings.value('cloud.uploadEnabled', false)
    this.options.uploadLogs = this.settings.value('cloud.uploadLogs', true)
    this.options.uploadMedia = this.settings.value('cloud.uploadMedia', true)
    this.options.binUploadLink = this.settings.value('cloud.binUploadLink', '')
    this.options.syncDeletions = this.settings.value('cloud.syncDeletions', false)
    this.options.windowsDestination = this.settings.value('cloud.windowsDestination', false)
    this.options.onlyWhenDisarmed = this.settings.value('cloud.onlyWhenDisarmed', false)

    this.ensureSshKey()

    // interval for upload checks
    this.intervalObj = setInterval(() => {
      if (!this.options.uploadEnabled) {
        return
      }
      if (this.options.onlyWhenDisarmed && this.getVehicleArmedState() !== 'disarmed') {
        return
      }
      console.log('Upload interval')
      this.syncNow()
    }, this.options.interval * 1000)
  }

  // Starts a sync for each selected category, ignoring uploadEnabled and
  // onlyWhenDisarmed - used by both the interval above and the "Upload Now"
  // button, which needs to work regardless of those settings.
  syncNow () {
    if (!this.options.binUploadLink) {
      return
    }
    // Skip a category that's still mid-sync - large media can take longer than one interval.
    if (this.options.uploadLogs && !this.isRunning(this.rsyncPidLogs)) {
      this.rsyncPidLogs = this.runRsync(this.logsFolder, this.options.binUploadLink, ['*.bin'],
        (error) => { this.lastErrorLogs = error })
    }
    if (this.options.uploadMedia && !this.isRunning(this.rsyncPidMedia)) {
      // Own subfolder on the remote end so media doesn't mix in with logs
      this.rsyncPidMedia = this.runRsync(this.mediaFolder, this.options.binUploadLink + '/media', [],
        (error) => { this.lastErrorMedia = error })
    }
  }

  // True if pid is a still-running child process (rsync.execute() return value).
  isRunning (pid) {
    return !!pid && pid.exitCode === null
  }

  // 'armed', 'disarmed', or 'unknown' if there's no live telemetry to trust
  // (no link, or none within the last 5s - see mavManager.conStatusInt()).
  // Unknown is treated as unsafe by callers, not assumed disarmed.
  getVehicleArmedState () {
    if (!this.fcManager || !this.fcManager.m || this.fcManager.m.conStatusInt() !== 1) {
      return 'unknown'
    }
    return this.fcManager.m.statusArmed ? 'armed' : 'disarmed'
  }

  // Syncs source/ to destination over ssh. onDone(error) fires once rsync
  // finishes, '' on success. One output handler covers both stdout/stderr -
  // the installed rsync package silently never calls a separate stderr
  // callback (bug in rsync.js:474).
  runRsync (source, destination, includes, onDone) {
    console.log('Syncing', source, 'to', destination)
    const rsync = new Rsync()
      .shell(SSH_SHELL)
      .source(source + '/')
      .destination(destination)

    if (this.options.windowsDestination) {
      // rtvP not -a(rchive): -a also preserves Unix perms/owner (-p -o -g),
      // which Windows destinations reject. No -z either - known to corrupt
      // the protocol stream on some Windows rsync builds.
      rsync.flags('rtvP')
      // Explicitly set broad perms instead of preserving source perms.
      rsync.set('chmod', 'ugo=rwX')
    } else {
      rsync.flags('avzP')
    }

    includes.forEach(pattern => rsync.include(pattern))

    if (this.options.syncDeletions) {
      rsync.set('delete')
    }

    let outputBuffer = ''
    const captureOutput = (data) => {
      outputBuffer += data.toString()
      console.log('rsync:', data.toString().trim())
    }
    let timeoutHandle
    // 3rd arg is never called (same library bug) but must be a function.
    // This callback runs outside any request's call stack, so an uncaught
    // throw here would hit the process-wide handler and take the whole
    // server down - catch defensively rather than let that happen.
    const pid = rsync.execute((error, code, cmd) => {
      try {
        clearTimeout(timeoutHandle)
        if (error) {
          console.log(error)
          console.log(code)
          console.log(cmd)
        }
        onDone(code === 0 ? '' : (outputBuffer.trim() || `rsync exited with code ${code}`))
      } catch (e) {
        console.error('Error handling rsync completion:', e)
      }
    }, captureOutput, captureOutput)

    timeoutHandle = setTimeout(() => {
      console.log(`rsync timed out after ${RSYNC_TIMEOUT_MINUTES} minutes, killing:`, source)
      pid.kill()
    }, RSYNC_TIMEOUT_MINUTES * 60 * 1000)

    return pid
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
      this.options.binUploadLink, this.options.syncDeletions, this.options.windowsDestination,
      this.options.onlyWhenDisarmed, this.getVehicleArmedState(), pubkey)
  }

  setSettingsBin (uploadEnabled, uploadLogs, uploadMedia, binUploadLink, syncDeletions, windowsDestination, onlyWhenDisarmed) {
    // save new settings
    this.options.uploadEnabled = uploadEnabled
    this.options.uploadLogs = uploadLogs
    this.options.uploadMedia = uploadMedia
    this.options.binUploadLink = binUploadLink
    this.options.syncDeletions = syncDeletions
    this.options.windowsDestination = windowsDestination
    this.options.onlyWhenDisarmed = onlyWhenDisarmed

    // and save to file
    try {
      this.settings.setValue('cloud.uploadEnabled', this.options.uploadEnabled)
      this.settings.setValue('cloud.uploadLogs', this.options.uploadLogs)
      this.settings.setValue('cloud.uploadMedia', this.options.uploadMedia)
      this.settings.setValue('cloud.binUploadLink', this.options.binUploadLink)
      this.settings.setValue('cloud.syncDeletions', this.options.syncDeletions)
      this.settings.setValue('cloud.windowsDestination', this.options.windowsDestination)
      this.settings.setValue('cloud.onlyWhenDisarmed', this.options.onlyWhenDisarmed)
      console.log('Saved Cloud Upload settings')
    } catch (e) {
      console.log(e)
    }
  }

  // Single combined status covering whichever of Logs/Media are selected -
  // "worst wins": an error beats running, running beats success/waiting.
  // A running/finished sync is reported regardless of uploadEnabled, since
  // "Upload Now" can trigger one even while automatic uploads are off.
  conStatusStr () {
    const active = []
    if (this.options.uploadLogs) active.push({ pid: this.rsyncPidLogs, error: this.lastErrorLogs })
    if (this.options.uploadMedia) active.push({ pid: this.rsyncPidMedia, error: this.lastErrorMedia })

    if (active.some(a => this.isRunning(a.pid))) {
      return 'Running'
    }
    const failed = active.filter(a => a.error)
    if (failed.length > 0) {
      return 'Error: ' + failed.map(a => a.error).join(' / ')
    }
    if (active.length > 0 && active.every(a => a.pid && a.pid.exitCode === 0)) {
      return 'Success'
    }
    if (!this.options.uploadEnabled) {
      return 'Disabled'
    }
    if (this.options.onlyWhenDisarmed) {
      const armedState = this.getVehicleArmedState()
      if (armedState === 'armed') {
        return 'Paused - vehicle armed'
      }
      if (armedState === 'unknown') {
        return 'Paused - vehicle state unknown'
      }
    }
    if (active.length === 0) {
      return 'Nothing selected to upload'
    }
    return 'Waiting for first run'
  }
}

module.exports = cloudUpload
