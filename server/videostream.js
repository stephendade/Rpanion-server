const { exec, execSync, spawn } = require('child_process')
const os = require('os')
const si = require('systeminformation')
const events = require('events')
const { minimal, common } = require('node-mavlink')

class videoStream {
  constructor (settings) {
    this.active = false
    this.deviceStream = null
    this.deviceAddresses = []
    this.devices = null
    this.settings = settings
    this.savedDevice = null

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
      this.initializeVideo()
    }
  }

  async initializeVideo() {
    // Initialize video streaming on startup using promises to avoid race conditions
    try {
      await this.getVideoDevicesPromise()
      await this.startStopStreamingPromise(
        true,
        this.savedDevice.device,
        this.savedDevice.height,
        this.savedDevice.width,
        this.savedDevice.format,
        this.savedDevice.rotation,
        this.savedDevice.bitrate,
        this.savedDevice.fps,
        this.savedDevice.transport,
        this.savedDevice.useUDPIP,
        this.savedDevice.useUDPPort,
        this.savedDevice.useTimestamp,
        this.savedDevice.useCameraHeartbeat,
        this.savedDevice.mavStreamSelected,
        this.savedDevice.compression,
        this.savedDevice.customRTSPSource
      )
    } catch (error) {
      // failed setup, reset settings
      console.log('Reset video - initialization failed:', error)
      this.resetVideo()
    }
  }

  getVideoDevicesPromise() {
    // Promise wrapper for getVideoDevices
    return new Promise((resolve, reject) => {
      this.getVideoDevices((error) => {
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      })
    })
  }

  startStopStreamingPromise(active, device, height, width, format, rotation, bitrate, fps, transport, useUDPIP, useUDPPort, useTimestamp, useCameraHeartbeat, mavStreamSelected, compression, customRTSPSource) {
    // Promise wrapper for startStopStreaming
    return new Promise((resolve, reject) => {
      this.startStopStreaming(active, device, height, width, format, rotation, bitrate, fps, transport, useUDPIP, useUDPPort, useTimestamp, useCameraHeartbeat, mavStreamSelected, compression, customRTSPSource, (err, active, addresses) => {
        if (err) {
          reject(err)
        } else {
          resolve({ active, addresses })
        }
      })
    })
  }

  // Format and store all the possible rtsp addresses
  populateAddresses (factory) {
    // set up the avail addresses
    this.ifaces = this.scanInterfaces()
    this.deviceAddresses = []
    for (let j = 0; j < this.ifaces.length; j++) {
      if (factory.includes('rtsp://')) {
        // remove any rtsp username or passwords, format rtsp://admin:admin@192.168.1.217:554/11
        let rtspfactory = factory
        rtspfactory = factory.replace('rtsp://', '')
        if (rtspfactory.includes('@')) {
          rtspfactory = rtspfactory.split('@')[1]
        }
        this.deviceAddresses.push('rtsp://' + this.ifaces[j] + ':8554/' + rtspfactory.replace(/\W/g, ''))
      } else {
        // note that video device URL's are the alphanumeric characters only. So /dev/video0 -> devvideo0
        this.deviceAddresses.push('rtsp://' + this.ifaces[j] + ':8554/' + factory.replace(/\W/g, ''))
      }
    }
  }

  getCompressionSelect(val) {
    // return the compression select object for a given value
    const options = [
      { value: 'H264', label: 'H.264' },
      { value: 'H265', label: 'H.265' },
    ]
    const sel = options.filter(it => it.value === val)
    if (sel.length === 1) {
      return sel[0]
    } else {
      return options[0]
    }
  }

  getTransportSelect(val) {
    // return the transport select object for a given value
    const options = [
      { value: 'RTP', label: 'RTP' },
      { value: 'RTSP', label: 'RTSP' },
    ]
    const sel = options.filter(it => it.value === val)
    if (sel.length === 1) {
      return sel[0]
    } else {
      return options[1]
    }
  }

  getTransportOptions(){
    // get transport options
    return [
      { value: 'RTP', label: 'RTP' },
      { value: 'RTSP', label: 'RTSP' },
    ];
  }

  // video streaming
  getVideoDevices (callback) {
    // get all video device details
    //dont update if streaming is running, as some camera won't be detected if in use
    if (this.deviceStream !== null) {
      return callback(null, this.devices, this.active, this.savedDevice.device, this.savedDevice.width.toString() + 'x' + this.savedDevice.height.toString() + 'x' + this.savedDevice.format.toString().split('/')[1],
        this.savedDevice.rotation,
        this.savedDevice.bitrate,
        this.savedDevice.fps,
        this.savedDevice.useUDPIP,
        this.savedDevice.useUDPPort,
        this.savedDevice.useTimestamp,
        (this.devices.filter(it => it.value === this.savedDevice.device)[0].caps.filter(it => it.value === this.savedDevice.width.toString() + 'x' + this.savedDevice.height.toString() + 'x' + this.savedDevice.format.toString().split('/')[1])[0].fps !== undefined) ? this.devices.filter(it => it.value === this.savedDevice.device)[0].caps.filter(it => it.value === this.savedDevice.width.toString() + 'x' + this.savedDevice.height.toString() + 'x' + this.savedDevice.format.toString().split('/')[1])[0].fps : [],
        this.devices.filter(it => it.value === this.savedDevice.device)[0].caps.filter(it => it.value === this.savedDevice.width.toString() + 'x' + this.savedDevice.height.toString() + 'x' + this.savedDevice.format.toString().split('/')[1])[0].fpsmax,
        this.devices.filter(it => it.value === this.savedDevice.device)[0].caps,
        this.savedDevice.useCameraHeartbeat,
        { label: this.savedDevice.mavStreamSelected.toString(), value: this.savedDevice.mavStreamSelected },
        this.savedDevice.compression,
        this.savedDevice.transport,
        this.getTransportOptions(),
        this.savedDevice.customRTSPSource)
    }
    // callback is: err, devices, active, seldevice, selRes, selRot, selbitrate, selfps, SeluseUDPIP, SeluseUDPPort, timestamp, fps, FPSMax, vidres, cameraHeartbeat, selMavURI, compression, transport, transportOptions, customRTSPSource
    exec('python3 ./python/gstcaps.py', (error, stdout, stderr) => {
      const warnstrings = ['DeprecationWarning', 'gst_element_message_full_with_details', 'camera_manager.cpp', 'Unsupported V4L2 pixel format']
      if (stderr && !warnstrings.some(wrn => stderr.includes(wrn))) {
        console.error(`exec error: ${error}`)
        return callback(stderr)
      } else {
        console.log(stdout)
        this.devices = JSON.parse(stdout)
        // add rtsp source
        this.devices.push({ label: 'RTSP Source (H.264)', value: 'rtspsourceh264', caps: [
          {
            label: 'Custom RTSP Source', value: '1x1xx-h264', width: 1, height: 1, format: 'video/x-h264',
            fps: [{ label: 'N/A', value: 1 }], fpsmax: 0
          }
        ]
        })
        this.devices.push({ label: 'RTSP Source (H.265)', value: 'rtspsourceh265', caps: [
          {
            label: 'Custom RTSP Source', value: '1x1xx-h265', width: 1, height: 1, format: 'video/x-h265',
            fps: [{ label: 'N/A', value: 1 }], fpsmax: 0
          }
        ]
        })
        //console.log(this.devices)
        const fpsSelected = ((this.devices.length > 0) ? (this.devices[0].caps[0].fpsmax === 0 ? this.devices[0].caps[0].fps[0] : this.devices[0].caps[0].fpsmax) : 1)
        // and return current settings
        if (!this.active) {
          return callback(null, this.devices, this.active, this.devices[0].value, this.devices[0].caps[0].value,
            0, 1100, fpsSelected, '127.0.0.1', 5400, false,
            (this.devices[0].caps[0].fps !== undefined) ? this.devices[0].caps[0].fps : [],
            this.devices[0].caps[0].fpsmax, this.devices[0].caps, false, '127.0.0.1',
            'H264', 'RTSP', this.getTransportOptions(), "")
        } else {
          // format saved settings
          const seldevice = this.devices.filter(it => it.value === this.savedDevice.device)
          if (seldevice.length !== 1) {
            // bad settings
            console.error('Bad video settings1 Resetting')
            // if video is active but bad settings, reset
            if (this.active) {
              //stop streaming
              this.startStopStreaming(false, '', 0, 0, '', 0, 0, 0, '', '', 0, false, false, '', '', '', () => {
                console.log('Stopped streaming due to bad settings')
              })
            }
            this.resetVideo()
            return callback(null, this.devices, this.active, this.devices[0].value, this.devices[0].caps[0].value,
              0, 1100, fpsSelected, '127.0.0.1', 5400, false,
              (this.devices[0].caps[0].fps !== undefined) ? this.devices[0].caps[0].fps : [],
              this.devices[0].caps[0].fpsmax, this.devices[0].caps, false, '127.0.0.1',
              'H264', 'RTSP', this.getTransportOptions(), "")
          }
          const selRes = seldevice[0].caps.filter(it => it.value === this.savedDevice.width.toString() + 'x' + this.savedDevice.height.toString() + 'x' + this.savedDevice.format.toString().split('/')[1])
          let selFPS = this.savedDevice.fps
          if (selRes.length === 1 && selRes[0].fpsmax !== undefined && selRes[0].fpsmax === 0) {
            selFPS = selRes[0].fps.filter(it => parseInt(it.value) === this.savedDevice.fps)[0]
          }
          if (seldevice.length === 1 && selRes.length === 1) {
            if (seldevice[0].value === 'rtspsourceh264' || seldevice[0].value === 'rtspsourceh265') {
              // for rtsp source, override format to match
              console.log('Populate RTSP Source addresses: ' + this.savedDevice.customRTSPSource)
              this.populateAddresses(this.savedDevice.customRTSPSource)
            } else {
              this.populateAddresses(seldevice[0].value.toString())
            }
            //console.log(seldevice[0])
            return callback(null, this.devices, this.active, seldevice[0].value, selRes[0].value,
              this.savedDevice.rotation,
              this.savedDevice.bitrate, selFPS, this.savedDevice.useUDPIP,
              this.savedDevice.useUDPPort, this.savedDevice.useTimestamp, (selRes[0].fps !== undefined) ? selRes[0].fps : [],
              selRes[0].fpsmax, seldevice[0].caps, this.savedDevice.useCameraHeartbeat,
              { label: this.savedDevice.mavStreamSelected.toString(), value: this.savedDevice.mavStreamSelected },
              this.savedDevice.compression, this.savedDevice.transport, this.getTransportOptions(), this.savedDevice.customRTSPSource)
          } else {
            // bad settings
            console.error('Bad video settings. Resetting ' + JSON.stringify(seldevice) + ', ' + selRes.toString())
            this.resetVideo()
            return callback(null, this.devices, this.active, this.devices[0].value, this.devices[0].caps[0].value,
              0, 1100, fpsSelected, '127.0.0.1', 5400, false,
              (this.devices[0].caps[0].fps !== undefined) ? this.devices[0].caps[0].fps : [],
              this.devices[0].caps[0].fpsmax, this.devices[0].caps, false, '127.0.0.1',
              'H264', 'RTSP', this.getTransportOptions(), "")
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
    }
    console.log('Reset Video Settings')
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

  async startStopStreaming (active, device, height, width, format, rotation, bitrate, fps, transport, useUDPIP, useUDPPort, useTimestamp, useCameraHeartbeat, mavStreamSelected, compression, customRTSPSource, callback) {
    // if current state same, don't do anything
    if (this.active === active) {
      console.log('Video current same')
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
          return callback(new Error('No video device: ' + device))
        }
      } else {
        console.log('No video devices in list')
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
        transport,
        useUDPIP,
        useUDPPort,
        useTimestamp,
        useCameraHeartbeat,
        mavStreamSelected,
        compression,
        customRTSPSource
      }

      //format rtsp source differently
      if (device === 'rtspsourceh264' || device === 'rtspsourceh265') {
        device = customRTSPSource
      }

      // note that video device URL's are the alphanumeric characters only. So /dev/video0 -> devvideo0
      this.populateAddresses(device.toString())

      // rpi camera has different name under Ubuntu
      if (await this.isUbuntu() && device === 'rpicam') {
        device = '/dev/video0'
        format = 'video/x-raw'
      }

      const args = ['./python/video-server.py',
        '--video=' + device,
        '--height=' + height,
        '--width=' + width,
        '--format=' + format,
        '--bitrate=' + bitrate,
        '--rotation=' + rotation,
        '--fps=' + fps,
        '--transport=' + transport,
        '--udp=' + useUDPIP + ':' + useUDPPort.toString(),
        '--compression=' + compression
      ]

      if (useTimestamp) {
        args.push('--timestamp')
      }

      console.log('Starting video with args: ' + args.toString())

      this.deviceStream = spawn('python3', args)

      try {
        if (this.deviceStream === null) {
          this.settings.setValue('videostream.active', false)
          console.log('Error spawning video-server.py')
          return callback(null, this.active, this.deviceAddresses)
        }
        this.settings.setValue('videostream.active', this.active)
        this.settings.setValue('videostream.savedDevice', this.savedDevice)
      } catch (e) {
        console.log(e)
      }

      this.deviceStream.stdout.on('data', (data) => {
        console.log(`GST stdout: ${data}`)
      })

      this.deviceStream.stderr.on('data', (data) => {
        if (!data.toString().includes('FIXME')) {
          console.error(`GST stderr: ${data}`)
        }
      })

      this.deviceStream.on('close', (code) => {
        console.log(`GST process exited with code ${code}`)
        this.deviceStream.stdin.pause()
        this.deviceStream.kill()
        this.resetVideo()
      })

      if (this.savedDevice.useCameraHeartbeat) {
        this.startInterval()
      }

      console.log('Started Video Streaming of ' + device)

      return callback(null, this.active, this.deviceAddresses)
    } else {
      // stop streaming
      // if mavlink advertising is on, clear the interval

      // Remove all listeners before killing
      this.deviceStream.stdout.removeAllListeners()
      this.deviceStream.stderr.removeAllListeners()
      this.deviceStream.removeAllListeners()

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
      ret = true
    } else {
      ret = false
    }
    return ret
  }

  getStreamingStatus () {
    // return the current streaming status
    if (this.active) {
      return 'Active - Streaming video'
    } else {
      return 'Not streaming'
    }
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

      const senderSysId = packet.header.sysid
      const senderCompId = minimal.MavComponent.CAMERA
      const targetComponent = packet.header.compid

      // build a VIDEO_STREAM_INFORMATION packet
      const msg = new common.VideoStreamInformation()

      // rpanion only supports a single stream, so streamId and count will always be 1
      msg.streamId = 1
      msg.count = 1

      // msg.type and msg.uri need to be different depending on whether RTP or RTSP is selected
      if (this.savedDevice.transport == 'RTP') {
        // msg.type = 0 = VIDEO_STREAM_TYPE_RTSP
        // msg.type = 1 = VIDEO_STREAM_TYPE_RTPUDP
        msg.type = 1
        // For RTP, just send the destination UDP port instead of a full URI
        msg.uri = this.savedDevice.useUDPPort.toString()
      } else {
        msg.type = 0
        msg.encoding = this.savedDevice.compression.value === 'H264' ? 1 : (this.savedDevice.compression.value === 'H265' ? 2 : 0)
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
