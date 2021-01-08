const { exec, spawn } = require('child_process')
const os = require('os')
var winston = require('./winstonconfig')(module)

class videoStream {
  constructor (settings) {
    this.active = false
    this.deviceStream = null
    this.deviceAddresses = []
    this.devices = null
    this.settings = settings
    this.savedDevice = null

    // load settings. savedDevice is a json object storing all settings
    this.active = this.settings.value('videostream.active', false)
    this.savedDevice = this.settings.value('videostream.savedDevice', null)

    // if it's an active device, stop then start it up
    // need to scan for video devices first though
    if (this.active) {
      this.active = false
      this.getVideoDevices((err, devices, active, seldevice, selRes, selRot, selbitrate, selUDP, selUDPIP, selUDPPort) => {
        if (!err) {
          this.startStopStreaming(true, this.savedDevice.device, this.savedDevice.height,
            this.savedDevice.width, this.savedDevice.format,
            this.savedDevice.rotation, this.savedDevice.bitrate, this.savedDevice.useUDP,
            this.savedDevice.useUDPIP, this.savedDevice.useUDPPort,
            (err, status, addresses) => {
              if (err) {
                // failed setup, reset settings
                this.resetVideo()
              } else {
              }
            })
        } else {
          // failed setup, reset settings
          this.resetVideo()
        }
      })
    }
  }

  // Format and store all the possible rtsp addresses
  populateAddresses () {
    // set up the avail addresses
    this.ifaces = this.scanInterfaces()
    this.deviceAddresses = []
    for (var j = 0; j < this.ifaces.length; j++) {
      this.deviceAddresses.push('rtsp://' + this.ifaces[j] + ':8554/video')
    }
  }

  // video streaming
  getVideoDevices (callback) {
    // get all video device details
    exec('python3 ./python/gstcaps.py', (error, stdout, stderr) => {
      if (stderr) {
        console.error(`exec error: ${error}`)
        winston.error('Error in getVideoDevices() ', { message: stderr })
        return callback(stderr)
      } else {
        this.devices = JSON.parse(stdout)
        // and return current settings
        if (!this.active) {
          return callback(null, this.devices, this.active, null, null, null, null, false, '127.0.0.1', 5400)
        } else {
          // format saved settings
          var seldevice = this.devices.filter(it => it.value === this.savedDevice.device)
          if (seldevice.length !== 1) {
            // bad settings
            console.error('Bad video settings. Resetting')
            winston.error('Bad video settings. Resetting ', { message: this.savedDevice })
            this.resetVideo()
            return callback(null, this.devices, this.active, null, null, null, null, false, '127.0.0.1', 5400)
          }
          var selRes = seldevice[0].caps.filter(it => it.value === this.savedDevice.width.toString() + 'x' + this.savedDevice.height.toString())
          if (seldevice.length === 1 && selRes.length === 1) {
            return callback(null, this.devices, this.active, seldevice[0], selRes[0], { label: this.savedDevice.rotation.toString() + '°', value: this.savedDevice.rotation }, this.savedDevice.bitrate, this.savedDevice.useUDP, this.savedDevice.useUDPIP, this.savedDevice.useUDPPort)
          } else {
            // bad settings
            console.error('Bad video settings. Resetting')
            winston.error('Bad video settings. Resetting ', { message: this.savedDevice })
            this.resetVideo()
            return callback(null, this.devices, this.active, null, null, null, null, false, '127.0.0.1', 5400)
          }
        }
      }
    })
  }

  // reset and save the video settings
  resetVideo () {
    this.active = false
    this.savedDevice = null
    this.settings.setValue('videostream.active', this.active)
    this.settings.setValue('videostream.savedDevice', this.savedDevice)
    console.log('Reset Video Settings')
    winston.info('Reset Video Settings')
  }

  scanInterfaces () {
    // scan for available IP (v4 only) interfaces
    var iface = []
    var ifaces = os.networkInterfaces()

    for (const ifacename in ifaces) {
      var alias = 0
      for (var j = 0; j < ifaces[ifacename].length; j++) {
        if (ifaces[ifacename][j].family === 'IPv4' && alias >= 1) {
          // this single interface has multiple ipv4 addresses
          // console.log("Found IP " + ifacename + ':' + alias, ifaces[ifacename][j].address);
          iface.push(ifaces[ifacename][j].address)
        } else if (ifaces[ifacename][j].family === 'IPv4') {
          // this interface has only one ipv4 adress
          // console.log("Found IP " + ifacename, ifaces[ifacename][j].address);
          iface.push(ifaces[ifacename][j].address)
        }
        ++alias
      }
    }
    return iface
  }

  startStopStreaming (active, device, height, width, format, rotation, bitrate, useUDP, useUDPIP, useUDPPort, callback) {
    // if current state same, don't do anything
    if (this.active === active) {
      console.log('Video current same')
      winston.info('Video current same')
      return callback(null, this.active, this.deviceAddresses)
    }
    // user wants to start or stop streaming
    if (active) {
      // check it's a valid video device
      var found = false
      for (var j = 0; j < this.devices.length; j++) {
        if (device === this.devices[j].value) {
          found = true
        }
      }
      if (!found) {
        console.log('No video device: ' + device)
        winston.info('No video device: ' + device)
        return callback('No video device: ' + device)
      }

      this.active = true
      this.savedDevice = {
        device: device,
        height: height,
        width: width,
        format: format,
        bitrate: bitrate,
        rotation: rotation,
        useUDP: useUDP,
        useUDPIP: useUDPIP,
        useUDPPort: useUDPPort
      }

      console.log(format)

      this.populateAddresses()

      this.deviceStream = spawn('python3', ['./python/rtsp-server.py',
        '--video=' + device,
        '--height=' + height,
        '--width=' + width,
        '--format=' + format,
        '--bitrate=' + bitrate,
        '--rotation=' + rotation,
        '--udp=' + ((useUDP === false) ? '0' : useUDPIP + ':' + useUDPPort.toString())
      ])

      if (this.deviceStream === null) {
        this.settings.setValue('videostream.active', false)
        console.log('Error spawning rtsp-server.py')
        winston.info('Error spawning rtsp-server.py')
        return callback(null, this.active, this.deviceAddresses)
      }
      this.settings.setValue('videostream.active', this.active)
      this.settings.setValue('videostream.savedDevice', this.savedDevice)

      this.deviceStream.stdout.on('data', (data) => {
        winston.info('startStopStreaming() data ' + data)
        console.log(`GST stdout: ${data}`)
      })

      this.deviceStream.stderr.on('data', (data) => {
        winston.error('startStopStreaming() err ', { message: data })
        console.error(`GST stderr: ${data}`)
      })

      this.deviceStream.on('close', (code) => {
        console.log(`GST process exited with code ${code}`)
        winston.info('startStopStreaming() close ' + code)
        this.deviceStream.stdin.pause()
        this.deviceStream.kill()
        this.resetVideo()
      })

      console.log('Started Video Streaming of ' + device)
      winston.info('Started Video Streaming of ' + device)

      return callback(null, this.active, this.deviceAddresses)
    } else {
      this.deviceStream.stdin.pause()
      this.deviceStream.kill()
      this.resetVideo()
    }
    return callback(null, this.active, this.deviceAddresses)
  }
}

module.exports = videoStream
