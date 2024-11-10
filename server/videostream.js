const { exec, spawn } = require('child_process')
const os = require('os')
const si = require('systeminformation')
const events = require('events')
const { minimal, common } = require('node-mavlink')

class videoStream {
  constructor (settings, winston) {
    this.active = false
    this.deviceStream = null
    this.deviceAddresses = []
    this.devices = null
    this.settings = settings
    this.savedDevice = null

    this.winston = winston

    // For sending events outside of object
    this.eventEmitter = new events.EventEmitter()

    // Interval to send camera heartbeat events
    this.intervalObj = null

    // load settings. savedDevice is a json object storing all settings
    this.active = this.settings.value('videostream.active', false)
    this.savedDevice = this.settings.value('videostream.savedDevice', null)

    // if it's an active device, stop then start it up
    // need to scan for video devices first though
    if (this.active) {
      this.active = false
      this.getVideoDevices((error) => {
        if (!error) {
          this.startStopStreaming(true, this.savedDevice.device, this.savedDevice.height,
            this.savedDevice.width, this.savedDevice.format,
            this.savedDevice.rotation, this.savedDevice.bitrate, this.savedDevice.fps, this.savedDevice.useUDP,
            this.savedDevice.useUDPIP, this.savedDevice.useUDPPort, this.savedDevice.useTimestamp, this.savedDevice.useCameraHeartbeat, this.savedDevice.mavStreamSelected,
            (err) => {
              if (err) {
                // failed setup, reset settings
                console.log('Reset video4')
                this.resetVideo()
              }
            })
        } else {
          // failed setup, reset settings
          console.log('Reset video3')
          this.resetVideo()
          console.log(error)
        }
      })
    }
  }

  // Format and store all the possible rtsp addresses
  populateAddresses (factory) {
    // set up the avail addresses
    this.ifaces = this.scanInterfaces()
    this.deviceAddresses = []
    for (let j = 0; j < this.ifaces.length; j++) {
      this.deviceAddresses.push('rtsp://' + this.ifaces[j] + ':8554/' + factory)
    }
  }

  // video streaming
  getVideoDevices (callback) {
    // get all video device details
    // callback is: err, devices, active, seldevice, selRes, selRot, selbitrate, selfps, SeluseUDP, SeluseUDPIP, SeluseUDPPort, timestamp, fps, FPSMax, vidres, cameraHeartbeat, selMavURI
    exec('python3 ./python/gstcaps.py', (error, stdout, stderr) => {
      const warnstrings = ['DeprecationWarning', 'gst_element_message_full_with_details', 'camera_manager.cpp', 'Unsupported V4L2 pixel format']
      if (stderr && !warnstrings.some(wrn => stderr.includes(wrn))) {
        console.error(`exec error: ${error}`)
        this.winston.error('Error in getVideoDevices() ', { message: stderr })
        return callback(stderr)
      } else {
        console.log(stdout)
        this.winston.info(stdout)
        this.devices = JSON.parse(stdout)
        console.log(this.devices)
        this.winston.info(this.devices)
        const fpsSelected = ((this.devices.length > 0) ? (this.devices[0].caps[0].fpsmax === 0 ? this.devices[0].caps[0].fps[0] : this.devices[0].caps[0].fpsmax) : 1)
        // and return current settings
        if (!this.active) {
          return callback(null, this.devices, this.active, this.devices[0], this.devices[0].caps[0],
            { label: '0°', value: 0 }, 1100, fpsSelected, false, '127.0.0.1', 5400, false,
            (this.devices[0].caps[0].fps !== undefined) ? this.devices[0].caps[0].fps : [],
            this.devices[0].caps[0].fpsmax, this.devices[0].caps, false, { label: '127.0.0.1', value: 0 })
        } else {
          // format saved settings
          const seldevice = this.devices.filter(it => it.value === this.savedDevice.device)
          if (seldevice.length !== 1) {
            // bad settings
            console.error('Bad video settings1 Resetting')
            this.winston.error('Bad video settings. Resetting ', { message: this.savedDevice })
            this.resetVideo()
            return callback(null, this.devices, this.active, this.devices[0], this.devices[0].caps[0],
              { label: '0°', value: 0 }, 1100, fpsSelected, false, '127.0.0.1', 5400, false,
              (this.devices[0].caps[0].fps !== undefined) ? this.devices[0].caps[0].fps : [],
              this.devices[0].caps[0].fpsmax, this.devices[0].caps, false, { label: '127.0.0.1', value: 0 })
          }
          const selRes = seldevice[0].caps.filter(it => it.value === this.savedDevice.width.toString() + 'x' + this.savedDevice.height.toString() + 'x' + this.savedDevice.format.toString().split('/')[1])
          let selFPS = this.savedDevice.fps
          if (selRes.length === 1 && selRes[0].fpsmax !== undefined && selRes[0].fpsmax === 0) {
            selFPS = selRes[0].fps.filter(it => parseInt(it.value) === this.savedDevice.fps)[0]
          }
          if (seldevice.length === 1 && selRes.length === 1) {
            this.populateAddresses(seldevice[0].value.replace(/\W/g, ''))
            console.log(seldevice[0])
            return callback(null, this.devices, this.active, seldevice[0], selRes[0],
              { label: this.savedDevice.rotation.toString() + '°', value: this.savedDevice.rotation },
              this.savedDevice.bitrate, selFPS, this.savedDevice.useUDP, this.savedDevice.useUDPIP,
              this.savedDevice.useUDPPort, this.savedDevice.useTimestamp, (selRes[0].fps !== undefined) ? selRes[0].fps : [],
              selRes[0].fpsmax, seldevice[0].caps, this.savedDevice.useCameraHeartbeat, { label: this.savedDevice.mavStreamSelected.toString(), value: this.savedDevice.mavStreamSelected })
          } else {
            // bad settings
            console.error('Bad video settings. Resetting' + seldevice + ', ' + selRes)
            this.winston.error('Bad video settings. Resetting ', { message: JSON.stringify(this.savedDevice) })
            this.resetVideo()
            return callback(null, this.devices, this.active, this.devices[0], this.devices[0].caps[0],
              { label: '0°', value: 0 }, 1100, fpsSelected, false, '127.0.0.1', 5400, false,
              (this.devices[0].caps[0].fps !== undefined) ? this.devices[0].caps[0].fps : [],
              this.devices[0].caps[0].fpsmax, this.devices[0].caps, false, { label: '127.0.0.1', value: 0 })
          }
        }
      }
    })
  }

  // reset and save the video settings
  resetVideo () {
    this.active = false
    this.savedDevice = null
    try {
      this.settings.setValue('videostream.active', this.active)
      this.settings.setValue('videostream.savedDevice', this.savedDevice)
    } catch (e) {
      console.log(e)
      this.winston.info(e)
    }
    console.log('Reset Video Settings')
    this.winston.info('Reset Video Settings')
  }

  scanInterfaces () {
    // scan for available IP (v4 only) interfaces
    const iface = []
    const ifaces = os.networkInterfaces()

    for (const ifacename in ifaces) {
      let alias = 0
      for (let j = 0; j < ifaces[ifacename].length; j++) {
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

  async startStopStreaming (active, device, height, width, format, rotation, bitrate, fps, useUDP, useUDPIP, useUDPPort, useTimestamp, useCameraHeartbeat, mavStreamSelected, callback) {
    // if current state same, don't do anything
    if (this.active === active) {
      console.log('Video current same')
      this.winston.info('Video current same')
      return callback(null, this.active, this.deviceAddresses)
    }
    // user wants to start or stop streaming
    if (active) {
      // check it's a valid video device
      let found = false
      if (this.devices !== null) {
        for (let j = 0; j < this.devices.length; j++) {
          if (device === this.devices[j].value) {
            found = true
          }
        }
        if (!found) {
          console.log('No video device: ' + device)
          this.winston.info('No video device: ' + device)
          return callback(new Error('No video device: ' + device))
        }
      } else {
        console.log('No video devices in list')
        this.winston.info('No video devices in list')
      }

      this.active = true
      this.savedDevice = {
        device,
        height,
        width,
        format,
        bitrate,
        fps,
        rotation,
        useUDP,
        useUDPIP,
        useUDPPort,
        useTimestamp,
        useCameraHeartbeat,
        mavStreamSelected
      }

      // note that video device URL's are the alphanumeric characters only. So /dev/video0 -> devvideo0
      this.populateAddresses(device.replace(/\W/g, ''))

      // rpi camera has different name under Ubuntu
      if (await this.isUbuntu() && device === 'rpicam') {
        device = '/dev/video0'
        format = 'video/x-raw'
      }

      const args = ['./python/rtsp-server.py',
        '--video=' + device,
        '--height=' + height,
        '--width=' + width,
        '--format=' + format,
        '--bitrate=' + bitrate,
        '--rotation=' + rotation,
        '--fps=' + fps,
        '--udp=' + ((useUDP === false) ? '0' : useUDPIP + ':' + useUDPPort.toString())
      ]

      if (useTimestamp) {
        args.push('--timestamp')
      }

      this.deviceStream = spawn('python3', args)

      try {
        if (this.deviceStream === null) {
          this.settings.setValue('videostream.active', false)
          console.log('Error spawning rtsp-server.py')
          this.winston.info('Error spawning rtsp-server.py')
          return callback(null, this.active, this.deviceAddresses)
        }
        this.settings.setValue('videostream.active', this.active)
        this.settings.setValue('videostream.savedDevice', this.savedDevice)
      } catch (e) {
        console.log(e)
        this.winston.info(e)
      }

      this.deviceStream.stdout.on('data', (data) => {
        this.winston.info('startStopStreaming() data ' + data)
        console.log(`GST stdout: ${data}`)
      })

      this.deviceStream.stderr.on('data', (data) => {
        this.winston.error('startStopStreaming() err ', { message: data })
        console.error(`GST stderr: ${data}`)
      })

      this.deviceStream.on('close', (code) => {
        console.log(`GST process exited with code ${code}`)
        this.winston.info('startStopStreaming() close ' + code)
        this.deviceStream.stdin.pause()
        this.deviceStream.kill()
        this.resetVideo()
      })

      if (this.savedDevice.useCameraHeartbeat) {
        this.startInterval()
      }

      console.log('Started Video Streaming of ' + device)
      this.winston.info('Started Video Streaming of ' + device)

      return callback(null, this.active, this.deviceAddresses)
    } else {
      // stop streaming
      // if mavlink advertising is on, clear the interval

      if (this.savedDevice.useCameraHeartbeat) {
        clearInterval(this.intervalObj)
      }
      this.deviceStream.stdin.pause()
      this.deviceStream.kill()
      this.resetVideo()
    }
    return callback(null, this.active, this.deviceAddresses)
  }

  async isUbuntu () {
    // Check if we are running Ubuntu
    let ret
    const data = await si.osInfo()
    if (data.distro.toString().includes('Ubuntu')) {
      console.log('Video Running Ubuntu')
      this.winston.info('Video Running Ubuntu')
      ret = true
    } else {
      ret = false
    }
    return ret
  }

  startInterval () {
    // start the 1-sec loop to send heartbeat events
    this.intervalObj = setInterval(() => {
      const mavType = minimal.MavType.CAMERA
      const autopilot = minimal.MavAutopilot.INVALID
      const component = minimal.MavComponent.CAMERA

      this.eventEmitter.emit('cameraheartbeat', mavType, autopilot, component)
    }, 1000)
  }

  onMavPacket (packet, data) {
    // FC is active
    if (!this.active) {
      return
    }

    if (data.targetComponent === minimal.MavComponent.CAMERA &&
      packet.header.msgid === common.CommandLong.MSG_ID &&
      data._param1 === common.CameraInformation.MSG_ID) {
      console.log('Responding to MAVLink request for CameraInformation')
      this.winston.info('Responding to MAVLink request for CameraInformation')

      const senderSysId = packet.header.sysid
      const senderCompId = minimal.MavComponent.CAMERA
      const targetComponent = packet.header.compid

      // build a CAMERA_INFORMATION packet
      const msg = new common.CameraInformation()

      // TODO: implement missing attributes here
      msg.timeBootMs = 0
      msg.vendorName = 0
      msg.modelName = 0
      msg.firmwareVersion = 0
      msg.focalLength = null
      msg.sensorSizeH = null
      msg.sensorSizeV = null
      msg.resolutionH = this.savedDevice.width
      msg.resolutionV = this.savedDevice.height
      msg.lensId = 0
      // 256 = CAMERA_CAP_FLAGS_HAS_VIDEO_STREAM (hard-coded for now until Rpanion gains more camera capabilities)
      msg.flags = 256
      msg.camDefinitionVersion = 0
      msg.camDefinitionUri = ''
      msg.gimbalDeviceId = 0
      this.eventEmitter.emit('camerainfo', msg, senderSysId, senderCompId, targetComponent)

    } else if (data.targetComponent === minimal.MavComponent.CAMERA &&
      packet.header.msgid === common.CommandLong.MSG_ID &&
      data._param1 === common.VideoStreamInformation.MSG_ID) {

      console.log('Responding to MAVLink request for VideoStreamInformation')
      this.winston.info('Responding to MAVLink request for VideoStreamInformation')

      const senderSysId = packet.header.sysid
      const senderCompId = minimal.MavComponent.CAMERA
      const targetComponent = packet.header.compid

      // build a VIDEO_STREAM_INFORMATION packet
      const msg = new common.VideoStreamInformation()

      // rpanion only supports a single stream, so streamId and count will always be 1
      msg.streamId = 1
      msg.count = 1

      // msg.type and msg.uri need to be different depending on whether RTP or RTSP is selected
      if (this.savedDevice.useUDP) {
        // msg.type = 0 = VIDEO_STREAM_TYPE_RTSP
        // msg.type = 1 = VIDEO_STREAM_TYPE_RTPUDP
        msg.type = 1
        // For RTP, just send the destination UDP port instead of a full URI
        msg.uri = this.savedDevice.useUDPPort.toString()
      } else {
        msg.type = 0
        msg.uri = `rtsp://${this.savedDevice.mavStreamSelected}:8554/${this.savedDevice.device}`
      }

      // 1 = VIDEO_STREAM_STATUS_FLAGS_RUNNING
      // 2 = VIDEO_STREAM_STATUS_FLAGS_THERMAL
      msg.flags = 1
      msg.framerate = this.savedDevice.fps
      msg.resolutionH = this.savedDevice.width
      msg.resolutionV = this.savedDevice.height
      msg.bitrate = this.savedDevice.bitrate
      msg.rotation = this.savedDevice.rotation
      // Rpanion doesn't collect field of view values, so just set to zero
      msg.hfov = 0
      msg.name = this.savedDevice.device

      this.eventEmitter.emit('videostreaminfo', msg, senderSysId, senderCompId, targetComponent)
    }
  }
}

module.exports = videoStream
