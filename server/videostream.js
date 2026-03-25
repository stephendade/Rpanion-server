const { exec, execSync, spawn } = require('child_process')
const os = require('os')
const path = require('path')
const si = require('systeminformation')
const events = require('events')
const { minimal, common } = require('node-mavlink')
const logpaths = require('./paths.js')
const fs = require('fs')

class videoStream {
  constructor (settings) {
    this.settings = settings

    // Properties used in all modes
    this.active = false
    this.deviceStream = null
    this.deviceAddresses = []
    this.cameraMode = null; // 'streaming', 'photo', or 'video'
    this.photoSeq = 0;

    // Interval to send camera heartbeat events
    this.intervalObj = null;
    this.eventEmitter = new events.EventEmitter()

    // Mode-specific hardware lists/settings
    this.devices = null;      // Video devices
    this.stillDevices = null; // Still devices
    this.videoSettings = null;
    this.stillSettings = null;

    // Load saved settings from the 'camera' namespace
    this.active = this.settings.value('camera.active', false);
    this.cameraMode = this.settings.value('camera.mode', 'streaming');
    this.useCameraHeartbeat = this.settings.value('camera.useHeartbeat', false);

    // Load specific settings based on mode
    this.videoSettings = this.settings.value('camera.videoSettings', null);
    this.stillSettings = this.settings.value('camera.stillSettings', null);

    // if it's an active device, stop then start it up
    // need to scan for video devices first though
    if (this.active) {
      this.active = false
      this.initialize()
    }
  }

  async initialize() {
    try {
      // Discover Video Hardware and wait for data
      await new Promise((resolve, reject) => {
        this.getVideoDevices((err, data) => {  // Get the data
          if (err) {
            reject(err);
          } else {
            // this.devices is now populated inside getVideoDevices callback
            resolve();
          }
        });
      });

      // 2. Discover Still Photo Hardware (We will add this function in Step 2)
      // For now, we wrap it in a try/catch so it doesn't crash if the helper isn't there yet
      try {
        await new Promise((resolve, reject) => {
          this.getStillDevices((err) => err ? reject(err) : resolve());
        });
      } catch (e) {
        console.log("Still hardware discovery skipped or failed.");
      }

      // 3. Start the camera in the last saved mode
      this.startCamera((err) => {
        if (err) {
          console.error('Camera start error during init:', err);
          this.resetCamera();
        } else {
          this.active = true;
        }
      });
    } catch (error) {
      console.log('Resetting camera - initialization failed:', error);
      this.resetCamera();
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

  startCameraPromise() {
    return new Promise((resolve, reject) => {
      this.startCamera((err, result) => {
        if (err) {
          reject(err)
        } else {
          resolve(result)
        }
      })
    })
  }


  // Format and store all the possible rtsp addresses
  populateAddresses (factory) {
    // set up the avail addresses
    this.ifaces = this.scanInterfaces()
    this.deviceAddresses = []

    // Remove leading slash if it exists to prevent double slashes
    let mountPoint = factory.toString();
    if (mountPoint.startsWith('/')) {
      mountPoint = mountPoint.substring(1);
    }

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
    const networkInterfaces = this.scanInterfaces();

    // Don't re-scan hardware if a stream is already running
    if (this.deviceStream !== null) {
      console.log("Camera active; returning cached hardware details.");

      const responseData = {
        devices: this.devices || [],
        networkInterfaces: networkInterfaces,
        active: this.active,
        cameraMode: this.cameraMode,
        streamAddresses: this.deviceAddresses,
        selectedDevice: null,
        selectedCap: null,
        resolutionCaps: [],
        fpsOptions: [],
        fpsMax: 0
      };

      // 1. Find the device and capability currently being used
      if (this.videoSettings && this.devices) {
        responseData.selectedDevice = this.devices.find(d => d.value === this.videoSettings.device);
        if (responseData.selectedDevice) {
          // Safeguard the format string against missing slashes for V4L2 raw modes
          const formatStr = this.videoSettings.format || "";
          const formatShort = formatStr.includes('/') ? formatStr.split('/')[1] : formatStr;
          const capVal = `${this.videoSettings.width}x${this.videoSettings.height}x${formatShort}`;

          responseData.selectedCap = responseData.selectedDevice.caps.find(cap => cap.value === capVal);
          responseData.resolutionCaps = responseData.selectedDevice.caps;
          responseData.fpsMax = responseData.selectedCap?.fpsmax || 0;
          responseData.fpsOptions = responseData.selectedCap?.fps || [];
        }

        // 2. Map raw numbers back to the UI's Object format
        responseData.selectedRotation = {
          label: (this.videoSettings.rotation || 0) + '°',
          value: (this.videoSettings.rotation || 0)
        };
        responseData.selectedMavStreamURI = {
          label: this.videoSettings.mavStreamSelected?.toString() || '127.0.0.1',
          value: this.videoSettings.mavStreamSelected || '127.0.0.1'
        };

        // 3. Map simple values
        responseData.selectedisRecording = this.videoSettings.isRecording || false;
        responseData.selectedBitrate = this.videoSettings.bitrate || 1100;
        responseData.selectedFps = this.videoSettings.fps || 30;
        responseData.selectedUseUDP = this.videoSettings.useUDP || false;
        responseData.selectedUseUDPIP = this.videoSettings.useUDPIP || '127.0.0.1';
        responseData.selectedUseUDPPort = this.videoSettings.useUDPPort || 5600;
        responseData.selectedUseTimestamp = this.videoSettings.useTimestamp || false;
        responseData.selectedUseCameraHeartbeat = this.useCameraHeartbeat || false;
      }

      return callback(null, responseData);
    }

    // If not streaming, proceed with hardware discovery
    const pythonPath = logpaths.getPythonPath();
    exec(`${pythonPath} ./python/gstcaps.py`, (error, stdout, stderr) => {
      const responseData = {
        devices: [],
        networkInterfaces: networkInterfaces,
        active: false,
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
        selectedIsRecording: false,
        selectedUseTimestamp: false,
        fpsOptions: [],
        fpsMax: 0,
        resolutionCaps: [],
        selectedUseCameraHeartbeat: this.useCameraHeartbeat,
        selectedMavStreamURI: { label: '127.0.0.1', value: '127.0.0.1' }
      };

      const warnstrings = ['DeprecationWarning', 'gst_element_message_full_with_details', 'camera_manager.cpp', 'Unsupported V4L2 pixel format'];
      if (stderr && !warnstrings.some(wrn => stderr.includes(wrn))) {
        return callback(stderr, responseData);
      }

      try {
        const devices = JSON.parse(stdout);
        // Add RTSP mocks
        devices.push({ label: 'RTSP Source (H.264)', value: 'rtspsourceh264', caps: [{ label: 'Custom RTSP Source', value: '1x1xx-h264', width: 1, height: 1, format: 'video/x-h264', fps: [{ label: 'N/A', value: 1 }], fpsmax: 0 }] });
        devices.push({ label: 'RTSP Source (H.265)', value: 'rtspsourceh265', caps: [{ label: 'Custom RTSP Source', value: '1x1xx-h265', width: 1, height: 1, format: 'video/x-h265', fps: [{ label: 'N/A', value: 1 }], fpsmax: 0 }] });

        this.devices = devices;
        responseData.devices = devices;

        // Populate defaults or saved settings as before...
        let selectedDevice = devices[0];
        let selectedCap = selectedDevice?.caps[0];

        responseData.selectedDevice = selectedDevice;
        responseData.selectedCap = selectedCap;
        responseData.resolutionCaps = selectedDevice?.caps || [];
        responseData.fpsOptions = selectedCap?.fps || [];
        responseData.fpsMax = selectedCap?.fpsmax || 0;
        responseData.selectedFps = responseData.fpsMax > 0 ? responseData.fpsMax : (responseData.fpsOptions[0]?.value ?? 30);

        return callback(null, responseData);
      } catch (e) {
        return callback('Failed to process video devices', responseData);
      }
    });
  }

  getStillDevices(callback) {
    const defaultResponse = {
      devices: [],
      capabilities: { cv2: false, picamera2: false },
      selectedDevice: undefined,
      selectedCap: undefined
    };

    const pythonPath = logpaths.getPythonPath();
    exec(`${pythonPath} ./python/get_camera_caps.py`, (error, stdout, stderr) => {
      if (error) return callback(stderr || error.message, defaultResponse);

      try {
        const output = JSON.parse(stdout);
        const cameraDevices = output.devices || [];
        const capabilities = output.capabilities || { cv2: false, picamera2: false };
        
        this.stillDevices = cameraDevices;

        const defaultDevice = cameraDevices.find(dev => dev.caps && dev.caps.length > 0);
        const defaultCap = defaultDevice?.caps[0];

        return callback(null, {
          devices: cameraDevices,
          capabilities: capabilities,
          selectedDevice: defaultDevice,
          selectedCap: defaultCap
        });
      } catch (e) {
        return callback('Invalid JSON from get_camera_caps.py', defaultResponse);
      }
    });
  }


  saveSettings() {
    try {
      this.settings.setValue('camera.active', this.active);
      this.settings.setValue('camera.mode', this.cameraMode);
      this.settings.setValue('camera.useHeartbeat', this.useCameraHeartbeat);

      if (this.cameraMode === 'streaming' || this.cameraMode === 'video') {
        this.settings.setValue('camera.videoSettings', this.videoSettings);
      } else if (this.cameraMode === 'photo') {
        this.settings.setValue('camera.stillSettings', this.stillSettings);
      }
    } catch (e) {
      console.error('Error saving camera settings:', e);
    }
  }

  resetCamera() {
    this.active = false;
    this.videoSettings = null;
    this.stillSettings = null;
    try {
      this.settings.setValue('camera.active', false);
      this.settings.setValue('camera.mode', 'streaming');
      this.settings.setValue('camera.videoSettings', null);
      this.settings.setValue('camera.stillSettings', null);
      this.settings.setValue('camera.useHeartbeat', false);
    } catch (e) {
      console.log('Error saving reset settings:', e);
    }
    console.log('Camera System Reset');
  }

  scanInterfaces() {
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

  startCamera(callback) {
    console.log(`Attempting to start camera in mode: ${this.cameraMode}`);
    try {
      if (this.cameraMode === 'streaming') {
        // startVideoStreaming is async, so we must catch rejections
        this.startVideoStreaming(callback).catch(err => {
          console.error("Async Start Error:", err);
          callback(err);
        });
      } else if (this.cameraMode === 'photo') {
        this.startPhotoMode(callback);
      } else if (this.cameraMode === 'video') {
        this.startVideoMode(callback);
      } else {
        callback(new Error(`Unsupported camera mode: ${this.cameraMode}`));
      }
    } catch (syncErr) {
      console.error("Sync Start Error:", syncErr);
      callback(syncErr);
    }
  }

  async startVideoStreaming(callback) {
    if (!this.videoSettings) return callback(new Error('No video settings provided'));

    let device = this.videoSettings.device;
    let format = this.videoSettings.format;

    // Ubuntu RPI camera mapping
    if (await this.isUbuntu() && device === 'rpicam') {
      device = '/dev/video0';
      format = 'video/x-raw';
    }

    this.populateAddresses(this.videoSettings.device);

    const args = [
      '-u', // force the stdout and stderr streams to be unbuffered
      './python/video-server.py',
      '--video=' + device,
      '--height=' + this.videoSettings.height,
      '--width=' + this.videoSettings.width,
      '--format=' + format,
      '--bitrate=' + this.videoSettings.bitrate,
      '--rotation=' + this.videoSettings.rotation,
      '--fps=' + this.videoSettings.fps,
      '--udp=' + (this.videoSettings.useUDP ? `${this.videoSettings.useUDPIP}:${this.videoSettings.useUDPPort}` : '0'),
      '--compression=' + this.videoSettings.compression
    ];

    if (this.videoSettings.useTimestamp) args.push('--timestamp');

    const pythonPath = logpaths.getPythonPath()
    this.deviceStream = spawn(pythonPath, args)
    this.setupStreamEvents('Streaming', callback);

    // Start MAVLink heartbeats if enabled
    if (this.useCameraHeartbeat) {
      this.startHeartbeatInterval();
      this.sendVideoStreamInformation(null, minimal.MavComponent.CAMERA, null);
    }
  }

  startPhotoMode(callback) {
    if (!this.stillSettings) return callback(new Error('No still settings provided'));

    const args = [
      '-u', // force the stdout and stderr streams to be unbuffered
      './python/photovideo.py',
      '--mode=photo'
    ];
    if (this.stillSettings.device) args.push('--device=' + this.stillSettings.device);
    if (this.stillSettings.width) args.push('--width=' + this.stillSettings.width);
    if (this.stillSettings.height) args.push('--height=' + this.stillSettings.height);
    if (this.stillSettings.mediaDestination) {
      const dest = this.stillSettings.mediaDestination;
      try {
        fs.mkdirSync(dest, { recursive: true });
        console.log('Ensured media directory exists:', dest);
      } catch (e) {
        console.error('Failed to create media directory:', dest, e);
      }
      args.push('--destination=' + dest);
    }

    const pythonPath = logpaths.getPythonPath()
    this.deviceStream = spawn(pythonPath, args)
    this.setupStreamEvents('Photo Mode', callback);

    // Start MAVLink heartbeats if enabled
    if (this.useCameraHeartbeat) {
      this.startHeartbeatInterval();
      this.sendCameraInformation(null, minimal.MavComponent.CAMERA, null);
    }
  }

  startVideoMode(callback) {
    if (!this.videoSettings) return callback(new Error('No video settings provided'));

    // Convert bitrate from kbps to bps Picamera2
    const bitrateBps = this.videoSettings.bitrate * 1000;

    const args = [
      '-u', // force the stdout and stderr streams to be unbuffered
      './python/photovideo.py',
      '--mode=video',
      '--device=' + this.videoSettings.device,
      '--width=' + this.videoSettings.width,
      '--height=' + this.videoSettings.height,
      '--fps=' + this.videoSettings.fps,
      '--bitrate=' + bitrateBps,
      '--rotation=' + this.videoSettings.rotation,
      '--format=' + this.videoSettings.format
    ];

    if (this.videoSettings.mediaDestination) {
      const dest = this.videoSettings.mediaDestination;
      try {
        fs.mkdirSync(dest, { recursive: true });
        console.log('Ensured media directory exists:', dest);
      } catch (e) {
        console.error('Failed to create media directory:', dest, e);
      }
      args.push('--destination=' + dest);
    }

    const pythonPath = logpaths.getPythonPath()
    this.deviceStream = spawn(pythonPath, args)
    this.setupStreamEvents('Video Mode', callback);

    // Start MAVLink heartbeats if enabled
    if (this.useCameraHeartbeat) {
      this.startHeartbeatInterval();
      this.sendCameraInformation(null, minimal.MavComponent.CAMERA, null);
    }
  }

  setupStreamEvents(modeName, callback) {
    let callbackCalled = false;
    let stdoutBuffer = ''; // Buffer for accumulating data chunks

    // Importing cv2 and Picamera2 on a Pi can take a minute or more
    // Safety Timeout: If nothing happens in 90 seconds, unblock the UI
    const timeout = setTimeout(() => {

      if (!callbackCalled) {
        callbackCalled = true;
        console.log(`${modeName}: No response from script after 60s, assuming start.`);
        this.active = true;
        this.saveSettings();
        callback(null, { active: true, addresses: this.deviceAddresses });
      }
    }, 90000);

    this.deviceStream.on('error', (err) => {
      clearTimeout(timeout);
      console.error(`Failed to spawn ${modeName}:`, err);
      if (!callbackCalled) {
        callbackCalled = true;
        callback(err);
      }
    });

    // Listen continuously until we hear "Camera is ready"
    // or in streaming mode
    this.deviceStream.stdout.on('data', (data) => {

      const chunk = data.toString();
      stdoutBuffer += chunk;

      // Detect the video recording start/stop messages from photovideo.py and update the recording flag
      const lower = chunk.toLowerCase();
      // start patterns printed by photovideo.py:
      // "Picamera2 recording started to <path>"
      // "V4L2 recording started to <path>"
      // also generic "recording started"
      if (lower.includes('recording started') || lower.includes('recording started to')) {
        this.setRecordingFlag(true);
        this.saveSettings();
        console.log('Detected recorder START; isRecording=true');
      }
      // stop patterns printed by photovideo.py:
      // "Picamera2 recording stopped."
      // "V4L2 recording stopped."
      // also generic "recording stopped"
      if (lower.includes('recording stopped')) {
        this.setRecordingFlag(false);
        this.saveSettings();
        console.log('Detected recorder STOP; isRecording=false');
      }

      // find file paths printed by photovideo.py
      const re = /to\s+(\S+\.(?:jpg|jpeg|png|h264|mp4|avi))/ig;
      let m;
      while ((m = re.exec(chunk)) !== null) {
        const filepath = m[1];
        this.lastSavedFile = filepath;             // store for API read-after-post fallback
        this.eventEmitter.emit('filesaved', filepath); // internal event
        console.log('Detected saved file:', filepath);
      }

      // Print chunk for debugging immediately
      const chunkTrimmed = chunk.trim();
      if (chunkTrimmed) console.log(`${modeName} chunk: ${chunkTrimmed}`);

      if (!callbackCalled) {
        // For Photo/Video mode (photovideo.py): Wait for "Camera is ready"
        // For Streaming (video-server.py): Wait for any data (assumed ready)

        let isReady = false;

        if (modeName === 'Streaming') {
          isReady = true; // Assuming first output from Gstreamer script means it's running
        } else {
          // photovideo.py prints "Camera is ready in..."
          if (stdoutBuffer.includes("Camera is ready")) {
            isReady = true;
          }
        }

        if (isReady) {
          clearTimeout(timeout);
          console.log(`${modeName} process is fully initialized.`);
          this.active = true;
          this.saveSettings();
          callbackCalled = true;
          callback(null, { active: true, addresses: this.deviceAddresses });
        }
      }
    });

    this.deviceStream.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.error(`${modeName} error: ${msg}`);
    });

    this.deviceStream.on('close', (code) => {
      clearTimeout(timeout);
      console.log(`${modeName} exited with code ${code}`);
      this.active = false;
      // Clear the video recording flag
      if (this.videoSettings) {
        this.setRecordingFlag(false);
        this.saveSettings();
      }
      if (!callbackCalled) {
        callbackCalled = true;
        callback(new Error(`${modeName} exited immediately (Code: ${code})`));
      }
    });
  }

  stopCamera(callback) {
    if (this.intervalObj) {
      clearInterval(this.intervalObj);
      this.intervalObj = null;
    }

    if (this.deviceStream) {
      this.deviceStream.kill('SIGTERM'); // Clean kill
      this.deviceStream = null;
    }

    this.active = false;
    this.settings.setValue('camera.active', false);
    // Clear the video recording flag
    if (this.videoSettings) {
      this.setRecordingFlag(false);
      this.saveSettings();
    }

    if (callback) callback(null, false);
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
      if (this.cameraMode === 'streaming') {
        return 'Camera is streaming video'
      } else if (this.cameraMode === 'photo') {
        return 'Camera is active in photo mode'
      } else if (this.cameraMode === 'video' && this.videoSettings.isRecording) {
        return 'Camera is currently recording a video'
      } else if (this.cameraMode === 'video' && !this.videoSettings.isRecording) {
        return 'Camera is active in video mode'
      }
    } else {
      return 'Camera is inactive'
    }
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

  captureStillPhoto(senderSysId, senderCompId, targetComponent, positionData = null) {
    console.log('Attempting captureStillPhoto. Internal state: active=', this.active, 'mode=', this.cameraMode, 'deviceStream exists=', !!this.deviceStream);

    // Capture a single still photo
    console.log('Capturing still photo')

    if (!this.active || !this.deviceStream) {
      console.log('Cannot capture photo - camera not active')
      console.log('Internal check failed: Cannot capture photo - camera not active or no deviceStream.');
      return
    }

    // Write GPS data to a temporary file for Python to read
    if (positionData) {
      try {
        const gpsPayload = JSON.stringify(positionData);
        fs.writeFileSync('/tmp/rpanion_gps.json', gpsPayload);
        console.log('Wrote GPS data for geotagging:', gpsPayload);
      } catch (e) {
        console.error('Failed to write GPS temp file:', e);
      }
    } else {
      // Clean up old file to prevent stale tags
      if (fs.existsSync('/tmp/rpanion_gps.json')) {
        fs.unlinkSync('/tmp/rpanion_gps.json');
      }
    }

    // Signal the Python process to capture a photo
    this.deviceStream.kill('SIGUSR1')

    // Build MAVLink CAMERA_TRIGGER packet for geotagging/logging
    const msg = new common.CameraTrigger()
    // Date.now() returns time in milliseconds
    msg.timeUsec = BigInt(Date.now() * 1000)
    // Increment the photo counter
    msg.seq = this.photoSeq++

    this.eventEmitter.emit('digicamcontrol', senderSysId, senderCompId, targetComponent)
    this.eventEmitter.emit('cameratrigger', msg, senderCompId)
  }

  toggleVideoRecording() {
    if (!this.active || !this.deviceStream) {
      console.log('Cannot toggle video - camera not active');
      return;
    }

    console.log('Toggling local video recording via SIGUSR1');
    // Signal the Python process to start or stop the file write
    this.deviceStream.kill('SIGUSR1');
  }

  // Helper to set the isRecording flag by replacing the object
  // instead of mutating the property
  setRecordingFlag(val) {
    if (!this.videoSettings) return;
    this.videoSettings = { ...this.videoSettings, isRecording: val };
    this.saveSettings();
  }

  // Helper to convert JS strings to the Array<string> format node-mavlink expects for char[]
  toMavChars(str, length) {
    const buf = new Uint8Array(length);
    if (!str) return buf;

    const encoded = new TextEncoder().encode(str);
    buf.set(encoded.slice(0, length));
    return buf;
  }

  sendCameraInformation(senderSysId, senderCompId, targetComponent) {
    console.log('Sending MAVLink CameraInformation packet')

    const msg = new common.CameraInformation();

    // Get the camera model name, and handle cases where settings might be null
    let devicePath = "Unknown";
    if (this.cameraMode === 'photo' && this.stillSettings && this.stillSettings.device) {
      devicePath = this.stillSettings.device;
    } else if (this.videoSettings && this.videoSettings.device) {
      devicePath = this.videoSettings.device;
    }

    let extractedModel = "Unknown";
    if (devicePath !== "Unknown") {
      if (devicePath.includes('rtspsource')) {
        extractedModel = "RTSP Source";
      } else if (devicePath.includes('/')) {
        // e.g. /base/soc/i2c0mux/i2c@1/imx219@10 -> imx219
        const parts = devicePath.split('/');
        const leaf = parts[parts.length - 1];
        extractedModel = leaf.split('@')[0];
      } else {
        extractedModel = devicePath;
      }
    }

    msg.vendorName = this.toMavChars("Rpanion", 32);
    msg.modelName = this.toMavChars(extractedModel, 32);
    msg.firmwareVersion = 0;
    msg.focalLength = 0;
    msg.sensorSizeH = 0;
    msg.sensorSizeV = 0;
    msg.lensId = 0;
    msg.camDefinitionVersion = 0;
    msg.camDefinitionUri = ""; // send zero-length string if not known
    msg.gimbalDeviceId = 0;

    // Mode-specific Configuration
    if (this.cameraMode === 'photo') {
      msg.resolutionH = this.stillSettings?.width || 0;
      msg.resolutionV = this.stillSettings?.height || 0;
      msg.flags = 2; // CAMERA_CAP_FLAGS_CAPTURE_IMAGE
    }
    else if (this.cameraMode === 'video') {
      msg.resolutionH = this.videoSettings?.width || 0;
      msg.resolutionV = this.videoSettings?.height || 0;
      msg.flags = 4; // CAMERA_CAP_FLAGS_CAPTURE_VIDEO
    }
    else {
      // Default: streaming
      msg.resolutionH = this.videoSettings?.width || 0;
      msg.resolutionV = this.videoSettings?.height || 0;
      msg.flags = 256; // CAMERA_CAP_FLAGS_HAS_VIDEO_STREAM
    }

    this.eventEmitter.emit('camerainfo', msg, senderSysId, senderCompId, targetComponent);
  }

  sendCameraSettings(senderSysId, senderCompId, targetComponent) {
    console.log('Sending MAVLink CameraSettings packet')

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

  sendVideoStreamInformation(senderSysId, senderCompId, targetComponent) {
    console.log('Responding to MAVLink request for VideoStreamInformation')

    // build a VIDEO_STREAM_INFORMATION packet
    const msg = new common.VideoStreamInformation()

    // rpanion only supports a single stream, so streamId and count will always be 1
    msg.streamId = 1
    msg.count = 1

    // msg.type and msg.uri need to be different depending on whether RTP or RTSP is selected
    if (this.videoSettings && this.videoSettings.useUDP) {
      // msg.type = 0 = VIDEO_STREAM_TYPE_RTSP
      // msg.type = 1 = VIDEO_STREAM_TYPE_RTPUDP
      msg.type = 1
      // For RTP, just send the destination UDP port instead of a full URI
      msg.uri = this.videoSettings.useUDPPort.toString();
    } else {
      msg.type = 0
      msg.encoding = this.videoSettings.compression === 'H264' ? 1 : (this.videoSettings.compression === 'H265' ? 2 : 0);

      // Find the address in the list that matches the selected MAVLink interface IP
      // This uses the array populated in populateAddresses() to ensure 1:1 consistency with Web UI
      const matchedAddress = this.deviceAddresses.find(addr =>
        addr.includes(this.videoSettings.mavStreamSelected)
      );

      msg.uri = matchedAddress || "";

    }

    // 1 = VIDEO_STREAM_STATUS_FLAGS_RUNNING
    msg.flags = 1;
    msg.framerate = this.videoSettings.fps;
    msg.resolutionH = this.videoSettings.width;
    msg.resolutionV = this.videoSettings.height;
    msg.bitrate = this.videoSettings.bitrate;
    msg.rotation = this.videoSettings.rotation;
    // Rpanion doesn't collect field of view values, so set to zero
    msg.hfov = 0;
    // Set the stream name (usually the device path)
    msg.name = this.videoSettings.device;

    this.eventEmitter.emit('videostreaminfo', msg, senderSysId, senderCompId, targetComponent)
  }

  onMavPacket(packet, data) {
    if (packet.header.msgid === common.CommandLong.MSG_ID &&
      data.targetComponent === minimal.MavComponent.CAMERA) {
      if (data._param1 === common.CameraInformation.MSG_ID) {
        console.log('Responding to MAVLink request for CameraInformation')
        this.sendCameraInformation(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid);
      }
      else if (data._param1 === common.VideoStreamInformation.MSG_ID && this.cameraMode === "streaming") {
        console.log('Responding to MAVLink request for VideoStreamInformation')
        this.sendVideoStreamInformation(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid);
      }
      else if (data._param1 === common.CameraSettings.MSG_ID) {
        console.log('Responding to MAVLink request for CameraSettings')
        this.sendCameraSettings(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)
      }
      // 203 = MAV_CMD_DO_DIGICAM_CONTROL
      else if (data.command === 203) {
        console.log('Received DoDigicamControl command')
        this.captureStillPhoto(packet.header.sysid, minimal.MavComponent.CAMERA, packet.header.compid)
      }
    }
  }
}

module.exports = videoStream
