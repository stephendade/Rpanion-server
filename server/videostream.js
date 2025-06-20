const { exec, spawn } = require('child_process')
const os = require('os')
const si = require('systeminformation')
const events = require('events')
const { minimal, common } = require('node-mavlink')

class videoStream {
  constructor (settings, winston) {
    this.winston = winston
    this.settings = settings
    // For sending events outside of object
    this.eventEmitter = new events.EventEmitter()

    // Properties used in all modes
    this.active = false
    this.deviceStream = null
    this.deviceAddresses = []
    this.cameraMode = null // options: 'streaming', 'photo', or 'video'
    this.photoSeq = 0

    this.useCameraHeartbeat = false
    // Interval to send camera heartbeat events
    this.intervalObj = null

    // Video streaming
    this.videoDevices = null
    this.videoSettings = null

    // Still camera
    this.stillDevices = null
    this.stillSettings = null
    this.photoSeq = 0

    // Load saved settings.
    this.active = this.settings.value('camera.active', false)
    this.cameraMode = this.settings.value('camera.mode', 'streaming')
    this.useCameraHeartbeat = this.settings.value('camera.useHeartbeat', false);

    // Load mode-specific settings
    if (this.cameraMode === 'streaming') {
    this.videoSettings = this.settings.value('camera.videoSettings', null)
  } else if (this.cameraMode === 'photo') {
    this.stillSettings = this.settings.value('camera.stillSettings', null)
  } else if (this.cameraMode === 'video') {
    this.videoSettings = this.settings.value('camera.videoSettings', null)
  }

    // If active, initialize the camera system
    if (this.active) {
      this.active = false
      this.initialize()
    }
  }

  initialize() {
    // Reset camera first
    this.getVideoDevices((videoErr) => {
      if (videoErr) {
        console.log('Video device initialization error:', videoErr)
        this.winston.info('Video device initialization error:', videoErr)
        this.resetCamera()
        return
      }

      this.getStillDevices((stillErr) => {
        if (stillErr) {
          console.log('Still device initialization error:', stillErr)
          this.winston.info('Still device initialization error:', stillErr)
          this.resetCamera()
          return
        }

        // Now start the appropriate camera mode
        this.startCamera((err) => {
          if (err) {
            console.log('Camera start error:', err)
            this.winston.info('Camera start error:', err)
            this.resetCamera()
          } else {
            this.active = true
          }
        })
      })
    })
  }

  // Reset all camera settings
  resetCamera() {
    this.active = false
    this.videoSettings = null
    this.stillSettings = null

    try {
      this.settings.setValue('camera.active', false)
      this.settings.setValue('camera.mode', 'streaming')
      this.settings.setValue('camera.videoSettings', null)
      this.settings.setValue('camera.stillSettings', null)
      this.settings.setValue('camera.useHeartbeat', false)
    } catch (e) {
      console.log('Error resetting camera settings:', e)
      this.winston.info('Error resetting camera settings:', e)
    }

    console.log('Reset Camera Settings')
    this.winston.info('Reset Camera Settings')
  }

  // Format and store all the possible rtsp addresses
  populateAddresses (factory) {
    // set up the avail addresses
    const ifaces = this.scanInterfaces()
    this.deviceAddresses = []

    for (let j = 0; j < ifaces.length; j++) {
      this.deviceAddresses.push('rtsp://' + ifaces[j] + ':8554/' + factory)
    }
  }

  scanInterfaces () {
    // scan for available IP (v4 only) interfaces
    const iface = []
    const ifaces = os.networkInterfaces()

    for (const ifacename in ifaces) {
      let alias = 0
      for (let j = 0; j < ifaces[ifacename].length; j++) {
        if (ifaces[ifacename][j].family === 'IPv4' && alias >= 1) {
          iface.push(ifaces[ifacename][j].address)
        } else if (ifaces[ifacename][j].family === 'IPv4') {
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


// video streaming
getVideoDevices(callback) {
  this.winston.info("Retrieving video devices");

  const networkInterfaces = this.scanInterfaces();

  exec('python3 ./python/gstcaps.py', (error, stdout, stderr) => {
    // Initialize a safe, default response object at the beginning to ensure all callbacks receive a valid object.
    const responseData = {
      devices: [],
      networkInterfaces: networkInterfaces,
      active: this.active && !!this.videoSettings,
      cameraMode: this.cameraMode,
      streamAddresses: [],
      selectedDevice: null,
      selectedCap: null,
      selectedRotation: { label: '0°', value: 0 },
      selectedBitrate: 1100,
      selectedFps: null,
      selectedUseUDP: false,
      selectedUseUDPIP: '127.0.0.1',
      selectedUseUDPPort: 5400,
      selectedUseTimestamp: false,
      fpsOptions: [],
      fpsMax: 0,
      resolutionCaps: [],
      selectedUseCameraHeartbeat: this.useCameraHeartbeat,
      selectedMavStreamURI: { label: '127.0.0.1', value: '127.0.0.1' }
    };

    const warnstrings = ['DeprecationWarning', 'gst_element_message_full_with_details', 'camera_manager.cpp', 'Unsupported V4L2 pixel format'];
    if (stderr && !warnstrings.some(wrn => stderr.includes(wrn))) {
      this.winston.info('Error in getVideoDevices() ', { message: stderr });
      return callback(stderr, responseData);
    }

    try {
      const devices = JSON.parse(stdout);

      if (!Array.isArray(devices) || devices.length === 0) {
        return callback('No video devices found', responseData);
      }
      this.videoDevices = devices;
      responseData.devices = this.videoDevices;

      let selectedDevice = null;
      let selectedCap = null;

      const shouldLoadSaved = this.active && (this.cameraMode === 'streaming' || this.cameraMode === 'video') && this.videoSettings;

      if (shouldLoadSaved) {
        selectedDevice = this.videoDevices.find(dev => dev.value === this.videoSettings.device);
        if (selectedDevice) {
          const formatString = `${this.videoSettings.width}x${this.videoSettings.height}x${this.videoSettings.format}`;
          selectedCap = selectedDevice.caps.find(cap => cap.value === formatString);
        }

        if (!selectedDevice || !selectedCap) {
          this.winston.info('Saved video device/resolution not found. Falling back to defaults.');
          responseData.active = false;
        }
      }

      if (!selectedDevice || !selectedCap) {
        selectedDevice = this.videoDevices[0];
        selectedCap = selectedDevice?.caps?.[0] ?? null;
      }

      if (!selectedDevice || !selectedCap) {
        return callback('No valid video capabilities found on any device', responseData);
      }

      responseData.selectedDevice = selectedDevice;
      responseData.selectedCap = selectedCap;
      responseData.resolutionCaps = selectedDevice.caps || [];

      const fpsOpts = selectedCap.fps || [];
      const fpsMax = selectedCap.fpsmax ?? 0;
      responseData.fpsOptions = fpsOpts;
      responseData.fpsMax = fpsMax;

      if (shouldLoadSaved && responseData.active) {
        responseData.selectedRotation = { label: this.videoSettings.rotation.toString() + '°', value: this.videoSettings.rotation };
        responseData.selectedBitrate = this.videoSettings.bitrate;
        responseData.selectedFps = this.videoSettings.fps;
        responseData.selectedUseUDP = this.videoSettings.useUDP;
        responseData.selectedUseUDPIP = this.videoSettings.useUDPIP;
        responseData.selectedUseUDPPort = this.videoSettings.useUDPPort;
        responseData.selectedUseTimestamp = this.videoSettings.useTimestamp;

        const mavUriValue = this.videoSettings.mavStreamSelected?.toString() || '127.0.0.1';
        responseData.selectedMavStreamURI = { label: mavUriValue, value: mavUriValue };

        if (this.cameraMode === 'streaming' && !this.videoSettings.useUDP) {
            this.populateAddresses(selectedDevice.value.replace(/\W/g, ''));
            responseData.streamAddresses = this.deviceAddresses;
        }
      } else {
         responseData.selectedFps = fpsMax > 0 ? fpsMax : (fpsOpts[0]?.value ?? 30);
      }

      return callback(null, responseData);

    } catch (e) {
      this.winston.info('Error processing video devices:', { message: e.message, stack: e.stack });
      return callback('Failed to process video device information', responseData);
    }
  });
}

  resetAndReturnDefaults(callback, defaultDevice, defaultCap, defaultFps) {
    this.resetCamera()
    return callback(null, this.videoDevices, false, defaultDevice, defaultCap,
      { label: '0°', value: 0 }, 1100, defaultFps, false, '127.0.0.1', 5400,
      false, defaultCap.fps || [], defaultCap.fpsmax, defaultDevice.caps, false,
      { label: '127.0.0.1', value: 0 })
  }

  getStillDevices(callback) {
    console.log("Retrieving still camera devices")
    this.winston.info("Retrieving still camera devices")

    exec('python3 ./python/get_camera_caps.py', (error, stdout, stderr) => {

      console.log("--- get_camera_caps.py STDOUT ---");
      console.log(stdout);
      console.log("--- get_camera_caps.py STDERR ---");
      console.error(stderr); // Log stderr
      console.log("--- get_camera_caps.py ERROR Object ---");
      console.error(error); // Log error object if exec fails
      console.log("------------------------------------");

      if (error) {
        console.error(`Error in get_camera_caps.py: ${stderr || error.message}`);
        this.winston.info('Error in getStillDevices()', { message: stderr || error.message });
        return callback(stderr || error.message);
      }

      try {
        const cameraDevices = JSON.parse(stdout)

        console.log("--- Parsed cameraDevices ---"); // Log after parsing
        console.log(cameraDevices);
        console.log("----------------------------");

        if (!Array.isArray(cameraDevices) || cameraDevices.length === 0) {
          console.error("Parsed data is not a non-empty array!");
          return callback('No still camera capabilities found');
        }
        else {
          console.log("cameraDevices: ", cameraDevices)
        }

        // Use the first device with valid caps as the default
        const defaultDevice = cameraDevices.find(dev => dev.caps && dev.caps.length >0);
        const defaultCap = defaultDevice?.caps[0];

        // If the camera isn't active or there are no saved settings, return the defaults
        if (!this.active || !this.stillSettings){
          console.log("Returning defaults (camera not active or no saved settings)");
          return callback(null, cameraDevices, defaultDevice, defaultCap);
        }

        // Find the saved device by its unique ID (instead of device path which is null for CSI cameras)
        console.log("Attempting to match saved settings using unique ID...");
        console.log("Saved settings:", this.stillSettings);

        const selectedDevice = cameraDevices.find(dev => dev.id === this.stillSettings.device);
        let selectedCap = null;

        // If a matching device was found, now try to find the matching resolution/format.
        if (selectedDevice) {
            console.log("Device ID matched:", selectedDevice.id);
            selectedCap = selectedDevice.caps.find(cap =>
              cap.width === this.stillSettings.width &&
              cap.height === this.stillSettings.height &&
              cap.format === this.stillSettings.format
            );
            if (selectedCap) {
                console.log("Capability matched:", selectedCap.label);
            } else {
                console.log("Capability not matched. Will use default for this device.");
            }
        } else {
            console.log("Device ID not found in current device list. Will use default device.");
        }

        // Return the full list of devices.
        // For the selection, use the matched device/cap if found, otherwise fall back to the defaults.
        // This ensures the UI always has a valid selection.
        return callback(
            null,
            cameraDevices,
            selectedDevice || defaultDevice,
            selectedCap || defaultCap
        );

      } catch (e) {
        console.error('Failed to parse JSON output:', e);
        this.winston.error('JSON Parsing Error in getStillDevices()', { message: e.message });
        return callback('Invalid JSON output from get_camera_caps.py');
      }
    });
}

startCamera(callback) {
  if (this.cameraMode === 'streaming') {
    this.startVideoStreaming(callback)
  } else if (this.cameraMode === 'photo') {
    this.startPhotoMode(callback)
  } else if (this.cameraMode === 'video') {
    this.startVideoMode(callback)
  } else {
    callback(new Error(`Unsupported camera mode: ${this.cameraMode}`))
  }
}

  startVideoStreaming(callback) {
    console.log('Starting video streaming mode')
    this.winston.info('Starting video streaming mode')

    // Check if the video device is valid
    if (!this.videoDevices || !this.videoSettings) {
      console.log('No valid video device or settings')
      this.winston.info('No valid video device or settings')
      return callback(new Error('No valid video device or settings'))
    }

    const deviceExists = this.videoDevices.some(dev => dev.value === this.videoSettings.device)
    if (!deviceExists) {
      console.log(`No video device: ${this.videoSettings.device}`)
      this.winston.info(`No video device: ${this.videoSettings.device}`)
      return callback(new Error(`No video device: ${this.videoSettings.device}`))
    }

    // Populate RTSP addresses for the selected device
    this.populateAddresses(this.videoSettings.device.replace(/\W/g, ''))

    this.startRtspServer((err, result) => {
      if (err) {
        this.winston.error('Error starting RTSP server:', err);
        return callback(err);
      }

       return callback(null, result);
    });
  }

  async startRtspServer(callback) {
    let device = this.videoSettings.device
    let format = this.videoSettings.format

    // RPI camera has different name under Ubuntu
    if (await this.isUbuntu() && device === 'rpicam') {
      device = '/dev/video0'
      format = 'video/x-raw'
    }

    const args = [
      './python/rtsp-server.py',
      '--video=' + device,
      '--height=' + this.videoSettings.height,
      '--width=' + this.videoSettings.width,
      '--format=' + format,
      '--bitrate=' + this.videoSettings.bitrate,
      '--rotation=' + this.videoSettings.rotation,
      '--fps=' + this.videoSettings.fps,
      '--udp=' + ((this.videoSettings.useUDP === false) ? '0' :
                 this.videoSettings.useUDPIP + ':' + this.videoSettings.useUDPPort.toString()),
      '--compression=' + this.videoSettings.compression
    ]

    if (this.videoSettings.useTimestamp) {
      args.push('--timestamp')
    }

    this.deviceStream = spawn('python3', args)

    try {
      if (this.deviceStream === null) {
        this.resetCamera()
        console.log('Error spawning rtsp-server.py')
        this.winston.info('Error spawning rtsp-server.py')
        const freshInterfacesOnError = this.scanInterfaces();
        return callback(new Error('Failed to start RTSP server'), { networkInterfaces: freshInterfacesOnError });
      }

      this.active = true
      this.saveSettings()

      this.setupStreamEvents('RTSP')

      if (this.useCameraHeartbeat) {
        this.startHeartbeatInterval()

        // Advertise the new video stream on MAVLink
        // This allows GCS software to automatically connect.
        this.sendVideoStreamInformation(null, minimal.MavComponent.CAMERA, null)
      }

      console.log('Started Video Streaming of ' + device)
      this.winston.info('Started Video Streaming of ' + device)
      const freshInterfaces = this.scanInterfaces(); // Get current IPs

      // Return an object containing active status, addresses, and interfaces
      return callback(null, {
          active: this.active,
          addresses: this.deviceAddresses,
          networkInterfaces: freshInterfaces
      });
    } catch (e) {
      console.log('Error starting RTSP server:', e)
      this.winston.info('Error starting RTSP server:', e)
      return callback(e)
    }
  }

  startPhotoMode(callback) {
    console.log('Starting photo mode')
    this.winston.info('Starting photo mode')

    if (!this.stillSettings) {
      console.log('No valid still camera settings')
      this.winston.info('No valid still camera settings')
      return callback(new Error('No valid still camera settings'))
    }

    // Populate addresses if needed
    if (this.stillSettings.device) {
      this.populateAddresses(this.stillSettings.device.replace(/\W/g, ''))
    }

    const args = ['./python/photomode.py', '--mode=photo']
    // Don't add a capture device path unless there actually is one.
    // Device path only used for V4L2 devices.
    if (this.stillSettings.device) {
      args.push('--device=' + this.stillSettings.device);
  }

    this.deviceStream = spawn('python3', args)

    try {
      if (this.deviceStream === null) {
        this.resetCamera()
        console.log('Error spawning photomode.py')
        this.winston.info('Error spawning photomode.py')
        return callback(new Error('Failed to start photo mode'), { networkInterfaces: freshInterfacesOnError });
      }

      this.active = true
      this.saveSettings()

      this.setupStreamEvents('Photo Mode')

      if (this.useCameraHeartbeat) {
        this.startHeartbeatInterval()
      }

      console.log('Started Photo Mode')
      this.winston.info('Started Photo Mode')

      const freshInterfaces = this.scanInterfaces(); // Get current IPs
      // Return an object containing active status, addresses, and interfaces
      return callback(null, {
          active: this.active,
          addresses: this.deviceAddresses, // May be empty in photo mode, but consistent
          networkInterfaces: freshInterfaces
      });
    } catch (e) {
      console.log('Error starting photo mode:', e)
      this.winston.info('Error starting photo mode:', e)
       // Pass error back, include interfaces in case that's useful for debugging
      const freshInterfacesOnError = this.scanInterfaces();
      return callback(e, { networkInterfaces: freshInterfacesOnError });
    }
  }

  startVideoMode(callback) {
    console.log('Starting video recording mode')
    this.winston.info('Starting video recording mode')

    if (!this.videoSettings) {
      console.log('No valid video settings')
      this.winston.info('No valid video settings')
      return callback(new Error('No valid video settings'))
    }

    // Populate addresses if needed
    if (this.videoSettings.device) {
      this.populateAddresses(this.videoSettings.device.replace(/\W/g, ''))
    }

    const args = ['./python/photomode.py', '--mode=video']
    args.push('--device=' + this.videoSettings.device); // May not be used by python script yet
    args.push('--width=' + this.videoSettings.width);
    args.push('--height=' + this.videoSettings.height);
    args.push('--format=' + this.videoSettings.format); // Python needs to handle this
    args.push('--fps=' + this.videoSettings.fps);
    args.push('--rotation=' + this.videoSettings.rotation);
    args.push('--bitrate=' + this.videoSettings.bitrate); // Pass bitrate too

    this.deviceStream = spawn('python3', args)

    try {
      if (this.deviceStream === null) {
        this.resetCamera()
        console.log('Error spawning photomode.py for video mode')
        this.winston.info('Error spawning photomode.py for video mode')
         // Pass error back,  include interfaces in case it's useful
         const freshInterfacesOnError = this.scanInterfaces();
         return callback(new Error('Failed to start video recording mode'), { networkInterfaces: freshInterfacesOnError });
      }

      this.active = true
      this.saveSettings()

      this.setupStreamEvents('Video Mode')

      if (this.useCameraHeartbeat) {
        this.startHeartbeatInterval()
      }

      console.log('Started Video Recording Mode')
      this.winston.info('Started Video Recording Mode')

      const freshInterfaces = this.scanInterfaces(); // Get current IPs
       // Return an object containing active status, addresses, and interfaces
      return callback(null, {
          active: this.active,
          addresses: this.deviceAddresses, // May be empty in video mode, but consistent
          networkInterfaces: freshInterfaces
      });
    } catch (e) {
      console.log('Error starting video recording mode:', e)
      this.winston.info('Error starting video recording mode:', e)
      const freshInterfacesOnError = this.scanInterfaces();
      return callback(e, { networkInterfaces: freshInterfacesOnError });
    }
  }

  setupStreamEvents(modeName) {
    this.deviceStream.stdout.on('data', (data) => {
      this.winston.info(`${modeName}: data: ${data}`)
      console.log(`${modeName} stdout: ${data}`)
    })

    this.deviceStream.stderr.on('data', (data) => {
      this.winston.error(`${modeName}: error: ${data}`)
      console.error(`${modeName} stderr: ${data}`)
    })

    this.deviceStream.on('close', (code, signal) => {
      console.log(`${modeName} process exited with code ${code}, signal:${signal}`)
      this.winston.info(`${modeName}: close: ${code}, , signal:${signal}`)

      if (this.deviceStream) {
        this.deviceStream.stdin.pause()
        this.deviceStream.kill()
      }

      this.resetCamera()
    })
  }

  saveSettings() {
    try {
      this.settings.setValue('camera.active', this.active)
      this.settings.setValue('camera.mode', this.cameraMode)
      this.settings.setValue('camera.useHeartbeat', this.useCameraHeartbeat)

      if (this.cameraMode === 'streaming' || this.cameraMode === 'video') {
        this.settings.setValue('camera.videoSettings', this.videoSettings)
      } else if (this.cameraMode === 'photo') {
        this.settings.setValue('camera.stillSettings', this.stillSettings)
      }
    } catch (e) {
      console.log('Error saving camera settings:', e)
      this.winston.info('Error saving camera settings:', e)
    }
  }

  stopCamera(callback) {
    if (!this.active) {
      return callback(null, false)
    }

    // Stop any heartbeat interval if running
    if (this.intervalObj) {
      clearInterval(this.intervalObj)
      this.intervalObj = null
    }

    // Kill the running process
    if (this.deviceStream) {
      this.deviceStream.stdin.pause()
      this.deviceStream.kill()
      this.deviceStream = null
    }

    this.resetCamera()
    return callback(null, false)
  }

  startHeartbeatInterval () {
    // start the 1-sec loop to send heartbeat events
    this.intervalObj = setInterval(() => {
      const mavType = minimal.MavType.CAMERA
      const autopilot = minimal.MavAutopilot.INVALID
      const component = minimal.MavComponent.CAMERA

      this.eventEmitter.emit('cameraheartbeat', mavType, autopilot, component)
    }, 1000)
  }

  captureStillPhoto (senderSysId, senderCompId, targetComponent) {
    console.log('Attempting captureStillPhoto. Internal state: active=', this.active, 'mode=', this.cameraMode, 'deviceStream exists=', !!this.deviceStream);

    // Capture a single still photo
    console.log('Capturing still photo')

    if (!this.active || !this.deviceStream) {
      console.log('Cannot capture photo - camera not active')
      console.log('Internal check failed: Cannot capture photo - camera not active or no deviceStream.');
      return
    }

    // Signal the Python process to capture a photo
    this.deviceStream.kill('SIGUSR1')

    // build a CAMERA_TRIGGER packet
    const msg = new common.CameraTrigger()

    // Date.now() returns time in milliseconds
    msg.timeUsec = BigInt(Date.now() * 1000)
    msg.seq = this.photoSeq

    this.photoSeq++

    this.eventEmitter.emit('digicamcontrol', senderSysId, senderCompId, targetComponent)
    this.eventEmitter.emit('cameratrigger', msg, senderCompId)

  }

  toggleVideoRecording() {
    // Toggle local video recording on/off

    console.log('Toggling video recording')

    if (!this.active || !this.deviceStream) {
      console.log('Cannot toggle video - camera not active')
      return
    }

    // Signal the Python process to toggle video recording
    this.deviceStream.kill('SIGUSR1')

    //TODO: add MAVLink control option
  }

  sendCameraInformation (senderSysId, senderCompId, targetComponent) {
    console.log('Sending MAVLink CameraInformation packet')
    this.winston.info('Sending MAVLink CameraInformation packet')

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

    // Set resolution based on current mode
    if (this.cameraMode === 'streaming' || this.cameraMode === 'video') {
      msg.resolutionH = this.videoSettings?.width || 0
      msg.resolutionV = this.videoSettings?.height || 0
    } else if (this.cameraMode === 'photo') {
      msg.resolutionH = this.stillSettings?.width || 0
      msg.resolutionV = this.stillSettings?.height || 0
    }

    msg.lensId = 0

    // Set capabilities flags based on mode
    if (this.cameraMode === 'photo') {
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
    console.log('Sending MAVLink VideoStreamInformation packet')
    this.winston.info('Sending MAVLink VideoStreamInformation packet')

    if (!this.videoSettings) {
      console.log('No video settings available')
      return
    }
    else {
      console.log('from sendVideoStreamInformation(), videoSettings:', this.videoSettings)
    }

    // build a VIDEO_STREAM_INFORMATION packet
    const msg = new common.VideoStreamInformation()

    // rpanion only supports a single stream, so streamId and count will always be 1
    msg.streamId = 1
    msg.count = 1

    // msg.type and msg.uri need to be different depending on whether RTP or RTSP is selected
    if (this.videoSettings.useUDP) {
      // msg.type = 0 = VIDEO_STREAM_TYPE_RTSP
      // msg.type = 1 = VIDEO_STREAM_TYPE_RTPUDP
      msg.type = 1
      // For RTP, just send the destination UDP port instead of a full URI
      msg.uri = this.videoSettings.useUDPPort.toString()
    } else {
      msg.type = 0
      msg.uri = this.deviceAddresses.find(addr => addr.includes(`://${this.videoSettings.mavStreamSelected}:`)
        );
    }

    // 1 = VIDEO_STREAM_STATUS_FLAGS_RUNNING
    // 2 = VIDEO_STREAM_STATUS_FLAGS_THERMAL
    msg.flags = 1
    msg.framerate = this.videoSettings.fps
    msg.resolutionH = this.videoSettings.width
    msg.resolutionV = this.videoSettings.height
    msg.bitrate = this.videoSettings.bitrate
    msg.rotation = this.videoSettings.rotation
    // Rpanion doesn't collect field of view values, so just set to zero
    msg.hfov = 0
    msg.name = this.videoSettings.device

    this.eventEmitter.emit('videostreaminfo', msg, senderSysId, senderCompId, targetComponent)
  }

  sendCameraSettings (senderSysId, senderCompId, targetComponent) {
    console.log('Sending MAVLink CameraSettings packet')
    this.winston.info('Sending MAVLink CameraSettings packet')

    // build a CAMERA_SETTINGS packet
    const msg = new common.CameraSettings()

    msg.timeBootMs = 0

    // Camera modes: 0 = IMAGE, 1 = VIDEO, 2 = IMAGE_SURVEY
    if (this.cameraMode === 'photo') {
      msg.modeId = 0
    } else {
      msg.modeId = 1
    }

    msg.zoomLevel = null
    msg.focusLevel = null

    this.eventEmitter.emit('camerasettings', msg, senderSysId, senderCompId, targetComponent)
  }

  onMavPacket (packet, data) {
    // Ignore if camera is not active
    if (!this.active) {
      return
    }

    if (data.targetComponent === minimal.MavComponent.CAMERA &&
      packet.header.msgid === common.CommandLong.MSG_ID) {

      // TODO
      if (data._param1 === common.CameraInformation.MSG_ID) {
        this.sendCameraInformation(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)
      } else if (data._param1 === common.VideoStreamInformation.MSG_ID && this.cameraMode === "streaming") {
        this.sendVideoStreamInformation(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)
      } else if (data._param1 === common.CameraSettings.MSG_ID) {
        this.sendCameraSettings(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)
      // 203 = MAV_CMD_DO_DIGICAM_CONTROL
      } else if (data.command === 203) {
        console.log('Received DoDigicamControl command')
        this.captureStillPhoto(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)
      }
    }
  }
}
module.exports = videoStream