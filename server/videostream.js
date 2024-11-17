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
    this.photoSeq = 0

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
            this.savedDevice.useUDPIP, this.savedDevice.useUDPPort, this.savedDevice.useTimestamp, this.savedDevice.usePhotoMode,
            this.savedDevice.useMavControl, this.savedDevice.useCameraHeartbeat, this.savedDevice.mavStreamSelected, this.savedDevice.mediaPath,
            (err) => {
              if (err) {
                // failed setup, reset settings
                console.log('Reset video4')
                this.resetVideo()
              }
            })
          this.winston.info('Media path is: ', this.savedDevice.mediaPath)
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
    // callback is: err, devices, active, seldevice, selRes, selRot, selbitrate, selfps, SeluseUDP, SelusePhotoMode, SeluseUDPIP,
    // SeluseUDPPort, timestamp, fps, FPSMax, vidres, cameraHeartbeat, mavControl, selMavURI, selMediaPath
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
            { label: '0°', value: 0 }, 1100, fpsSelected, false, false, '127.0.0.1', 5400, false,
            (this.devices[0].caps[0].fps !== undefined) ? this.devices[0].caps[0].fps : [],
            this.devices[0].caps[0].fpsmax, this.devices[0].caps, false, false, { label: '127.0.0.1', value: 0 }, '/home/pi/Rpanion-server/media/')
        } else {
          // format saved settings
          const seldevice = this.devices.filter(it => it.value === this.savedDevice.device)
          if (seldevice.length !== 1) {
            // bad settings
            console.error('Bad video settings1 Resetting')
            this.winston.error('Bad video settings. Resetting ', { message: this.savedDevice })
            this.resetVideo()
            return callback(null, this.devices, this.active, this.devices[0], this.devices[0].caps[0],
              { label: '0°', value: 0 }, 1100, fpsSelected, false, false, '127.0.0.1', 5400, false,
              (this.devices[0].caps[0].fps !== undefined) ? this.devices[0].caps[0].fps : [],
              this.devices[0].caps[0].fpsmax, this.devices[0].caps, false, false, { label: '127.0.0.1', value: 0 }, '/home/pi/Rpanion-server/media/')
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
              this.savedDevice.bitrate, selFPS, this.savedDevice.useUDP, this.savedDevice.usePhotoMode, this.savedDevice.useUDPIP,
              this.savedDevice.useUDPPort, this.savedDevice.useTimestamp, (selRes[0].fps !== undefined) ? selRes[0].fps : [],
              selRes[0].fpsmax, seldevice[0].caps, this.savedDevice.useCameraHeartbeat, this.savedDevice.useMavControl,
              { label: this.savedDevice.mavStreamSelected.toString(), value: this.savedDevice.mavStreamSelected },
              this.savedDevice.mediaPath
            )
          } else {
            // bad settings
            console.error('Bad video settings. Resetting' + seldevice + ', ' + selRes)
            this.winston.error('Bad video settings. Resetting ', { message: JSON.stringify(this.savedDevice) })
            this.resetVideo()
            return callback(null, this.devices, this.active, this.devices[0], this.devices[0].caps[0],
              { label: '0°', value: 0 }, 1100, fpsSelected, false, false, '127.0.0.1', 5400, false,
              (this.devices[0].caps[0].fps !== undefined) ? this.devices[0].caps[0].fps : [],
              this.devices[0].caps[0].fpsmax, this.devices[0].caps, false, false, { label: '127.0.0.1', value: 0 },
              '/home/pi/Rpanion-server/media/')
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

  async startStopStreaming (active, device, height, width, format, rotation, bitrate, fps, useUDP, usePhotoMode, useUDPIP, useUDPPort, useTimestamp, useCameraHeartbeat, useMavControl, mavStreamSelected, mediaPath, callback) {
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
        usePhotoMode,
        useUDPIP,
        useUDPPort,
        useTimestamp,
        useCameraHeartbeat,
        useMavControl,
        mavStreamSelected,
        mediaPath
      }

      // If photo mode was selected, start the libcamera server
      if (this.savedDevice.usePhotoMode) {
        // note that video device URL's are the alphanumeric characters only. So /dev/video0 -> devvideo0
        this.populateAddresses(device.replace(/\W/g, ''))

        const args = ['./python/photomode.py']

        this.deviceStream = spawn('python3', args)

        try {
          if (this.deviceStream === null) {
            this.settings.setValue('videostream.active', false)
            console.log('Error spawning photomode.py')
            this.winston.info('Error spawning photomode.py')
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

        console.log('Started Video Streaming of ' + device)
        this.winston.info('Started Video Streaming of ' + device)
      } else {
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
        console.log('Started Video Streaming of ' + device)
        this.winston.info('Started Video Streaming of ' + device)
      }

      // If enabled, start the camera heartbeat in either photo or video mode
      if (this.savedDevice.useCameraHeartbeat) {
        this.startInterval()
      }

      return callback(null, this.active, this.deviceAddresses)
    } else {
      // stop streaming
      // if mavlink advertising is on, clear the interval

      if (this.savedDevice.useCameraHeartbeat) {
        clearInterval(this.intervalObj)
      }

      if (this.savedDevice.usePhotoMode) {
        console.log('Stopped photo mode')
        this.deviceStream.stdin.pause()
        this.deviceStream.kill()
        this.resetVideo()
      } else {
        this.deviceStream.stdin.pause()
        this.deviceStream.kill()
        this.resetVideo()
      }
    }
    return callback(null, this.active, this.deviceAddresses)
  }

  captureStillPhoto () {
    // Capture a single still photo
    console.log('Received capturestillphoto event')
    this.deviceStream.kill('SIGUSR1')

    const senderSysId = this.targetSystem
    const senderCompId = minimal.MavComponent.CAMERA

    // build a CAMERA_TRIGGER packet
    const msg = new common.CameraTrigger()

    // Date.now() returns time in milliseconds
    msg.timeUsec = BigInt(Date.now() * 1000)
    msg.seq = this.photoSeq

    this.photoSeq++

    this.eventEmitter.emit('cameratrigger', msg, senderSysId, senderCompId)
  }

  sendCameraInformation (senderSysId, senderCompId, targetComponent) {
    console.log('Responding to MAVLink request for CameraInformation')
    this.winston.info('Responding to MAVLink request for CameraInformation')

    // const senderSysId = packet.header.sysid
    // const senderCompId = minimal.MavComponent.CAMERA
    // const targetComponent = packet.header.compid

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
    if (this.savedDevice.usePhotoMode) {
      // 2 = CAMERA_CAP_FLAGS_CAPTURE_IMAGE
      msg.flags = 2
    } else {
      // 256 = CAMERA_CAP_FLAGS_HAS_VIDEO_STREAM
      msg.flags = 256
    }

    msg.camDefinitionVersion = 0
    msg.camDefinitionUri = ''
    msg.gimbalDeviceId = 0
    this.eventEmitter.emit('camerainfo', msg, senderSysId, senderCompId, targetComponent)
  }

  sendVideoStreamInformation (senderSysId, senderCompId, targetComponent) {
    console.log('Responding to MAVLink request for VideoStreamInformation')
    this.winston.info('Responding to MAVLink request for VideoStreamInformation')

    // const senderSysId = packet.header.sysid
    // const senderCompId = minimal.MavComponent.CAMERA
    // const targetComponent = packet.header.compid

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

  sendCameraSettings (senderSysId, senderCompId, targetComponent) {
    console.log('Responding to MAVLink request for CameraSettings')
    this.winston.info('Responding to MAVLink request for CameraSettings')
    // const senderSysId = packet.header.sysid
    // const senderCompId = minimal.MavComponent.CAMERA
    // const targetComponent = packet.header.compid

    // build a CAMERA_SETTINGS packet
    const msg = new common.CameraSettings()

    msg.timeBootMs = 0
    // Camera modes: 0 = IMAGE, 1 = VIDEO, 2 = IMAGE_SURVEY
    if (this.savedDevice.usePhotoMode) {
      msg.modeId = 0
    } else {
      msg.modeId = 1
    }
    msg.zoomLevel = null
    msg.focusLevel = null

    this.eventEmitter.emit('camerasettings', msg, senderSysId, senderCompId, targetComponent)
  }

  onMavPacket (packet, data) {
    // FC is active
    if (!this.active) {
      return
    }

    if (data.targetComponent === minimal.MavComponent.CAMERA && packet.header.msgid === common.CommandLong.MSG_ID) {
      if (data._param1 === common.CameraInformation.MSG_ID) {
        this.sendCameraInformation(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)
      } else if (data._param1 === common.VideoStreamInformation.MSG_ID && !this.savedDevice.usePhotoMode) {
        this.sendVideoStreamInformation(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)
      } else if (data._param1 === common.CameraSettings.MSG_ID) {
        this.sendCameraSettings(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)
      // 203 = MAV_CMD_DO_DIGICAM_CONTROL
      } else if (data.command === 203) {
        console.log('Received DoDigicamControl command')
        this.captureStillPhoto(packet)
      }
    }
  }
}
module.exports = videoStream
