import Button from 'react-bootstrap/Button';
import Accordion from 'react-bootstrap/Accordion';
import Form from 'react-bootstrap/Form';
import React from 'react'
import { Link } from 'react-router-dom';
import IPAddressInput from './components/IPAddressInput.jsx';

import basePage from './basePage.jsx';

import './css/styles.css';

class VideoPage extends basePage {
  constructor(props) {
    super(props, true) // Enable Socket.IO;
    this.state = {
      ...this.state,
      appRoot: '',
      ifaces: [],
      dev: [],

      // Video State
      videoDevices: [],
      vidDeviceSelected: this.props.selectedVideoDevice || '',
      videoCaps: [],
      vidCapSelected: this.props.selectedVideoCap || '',
      videoIsRecording: false,
      // Notification text to show when a photo or video file is saved
      notification: '',
      currentVideoFile: '',
      
      // Still Photo State
      stillDevices: [],
      stillDeviceSelected: this.props.selectedStillDevice || '',
      stillCaps: [],
      stillCapSelected: this.props.selectedStillCap || '',
      videoMediaDestination: this.props.videoMediaDestination || '',
      stillMediaDestination: this.props.stillMediaDestination || '',

      // Global state
      active: this.props.streamingStatus || false,
      cameraMode: this.props.cameraMode || 'streaming', // Default to streaming mode; other options are 'photo', 'video'
      streamAddresses: [],
      photoVideoAvailable: true, // Whether photo/video modes are available based on installed libraries
      showOpenCVWarning: true, // Whether to show the OpenCV missing libraries warning

      // Video options
      rotations: [{ label: "0°", value: 0 }, { label: "90°", value: 90 }, { label: "180°", value: 180 }, { label: "270°", value: 270 }],
      rotSelected: 0,
      bitrate: 1000,
      transportSelected: "RTSP",
      transportOptions: [{ label: "RTP", value: "RTP" }, { label: "RTSP", value: "RTSP" }],
      useUDPIP: "127.0.0.1",
      useUDPPort: 5600,
      FPSMax: 0,
      fpsOptions: [],
      fpsSelected: 1,
      timestamp: false,
      
      // Transport options
      multicastString: " ",
      compression: 'H264',
      compressionOptions: [{ value: 'H264', label: 'H.264' }, { value: 'H265', label: 'H.265' }],
      customRTSPSource: this.props.customRTSPSource || '',

      // Mavlink options
      enableCameraHeartbeat: false,
      mavStreamSelected: this.props.mavStreamSelected || ''
    }
  }

  componentDidMount() {
    // Fetch app root path
    fetch(`/api/approot`, { headers: { Authorization: `Bearer ${this.state.token}` } })
      .then(res => res.json())
      .then(data => {
        this.setState({
          appRoot: data.appRoot,
          photoMediaDestination: this.state.photoMediaDestination || '',
          videoMediaDestination: this.state.videoMediaDestination || ''
        });
      })
      .catch(err => console.error('Failed to fetch app root:', err));

    // Fetch both Video and Still device lists
    Promise.all([
      fetch(`/api/videodevices`, { headers: { Authorization: `Bearer ${this.state.token}` } }),
      fetch(`/api/camera/still_devices`, { headers: { Authorization: `Bearer ${this.state.token}` } })
    ])
      .then(async ([videoRes, stillRes]) => {
        const videoData = await videoRes.json();
        const stillData = await stillRes.json();

        // --- Process Network Interfaces ---
        // Prefer a non-loopback interface as the default MAVLink video source IP,
        // since 127.0.0.1 is never reachable by a remote GCS.
        const ifaceList = (videoData.networkInterfaces || []).map(ip => ip);
        const defaultMavStreamIface = ifaceList.find(ip => ip !== '127.0.0.1') || ifaceList[0] || '127.0.0.1';

        // --- Process Video Data ---
        const vidDevs = videoData.devices || [];

        // --- Process Still Data ---
        const stillDevs = stillData.devices || [];
        const selStillDev = stillData.selectedDevice || (stillDevs.length > 0 ? stillDevs[0] : null);
        const stillCaps = selStillDev ? selStillDev.caps : [];
        const selStillCap = stillData.selectedCap || (stillCaps.length > 0 ? stillCaps[0] : null);

        // --- Check if photo/video modes are available ---
        const capabilities = stillData.capabilities || { cv2: false, picamera2: false };
        const photoVideoAvailable = capabilities.cv2; // cv2 is required for photo and video modes

        // Determine Transport Mode from backend data (RTP vs RTSP)
        const isRTP = videoData.selectedUseUDP === true;

        // If photo/video isn't available, force streaming mode
        const cameraModeToUse = (!photoVideoAvailable && (videoData.cameraMode === 'photo' || videoData.cameraMode === 'video')) 
          ? 'streaming' 
          : (videoData.cameraMode || 'streaming');

        // Streaming and Video Recording have independent saved settings on the
        // backend - resolve each against the device list, then remember both
        // for the session so switching the mode radio button later restores
        // the other mode's own selection instead of resetting to the first
        // device/cap (see handleCameraModeChange).
        const streamingResolved = this.resolveModeSelection(videoData.streamingSelection, vidDevs);
        const videoRecordResolved = this.resolveModeSelection(videoData.videoRecordSelection, vidDevs);
        this._modeSelectionCache = { streaming: streamingResolved, video: videoRecordResolved };

        const activeResolved = cameraModeToUse === 'video' ? videoRecordResolved : streamingResolved;


        this.setState({
          // Network
          ifaces: ifaceList,

          // Video State
          videoDevices: vidDevs,
          vidDeviceSelected: activeResolved.device,
          videoCaps: activeResolved.caps,
          vidCapSelected: activeResolved.cap,
          videoIsRecording: false,

          // Still State
          stillDevices: stillDevs,
          stillDeviceSelected: selStillDev ? selStillDev.id : '',
          stillCaps: stillCaps,
          stillCapSelected: selStillCap ? this.getStillCapValue(selStillCap) : '',

          // Common
          active: videoData.active || false,
          cameraMode: cameraModeToUse,
          streamAddresses: videoData.streamAddresses || [],
          photoVideoAvailable: photoVideoAvailable,

          // Options
          transportSelected: isRTP ? "RTP" : "RTSP",
          useUDPIP: videoData.selectedUseUDPIP || "127.0.0.1",
          useUDPPort: videoData.selectedUseUDPPort || 5600,
          bitrate: activeResolved.bitrate,
          rotSelected: activeResolved.rotation,
          timestamp: videoData.selectedUseTimestamp || false,
          enableCameraHeartbeat: videoData.selectedUseCameraHeartbeat || false,
          mavStreamSelected: (videoData.selectedMavStreamURI && videoData.selectedMavStreamURI.value) ? videoData.selectedMavStreamURI.value : defaultMavStreamIface,

          FPSMax: activeResolved.fpsMax,
          fpsOptions: activeResolved.fpsOptions,
          fpsSelected: activeResolved.fps,

          compression: (videoData.compression && videoData.compression.value) ? videoData.compression.value : 'H264',

          videoMediaDestination: activeResolved.mediaDestination,
          stillMediaDestination: stillData.stillMediaDestination || '',
        });

        if (videoData.selectedUseUDPIP) this.isMulticastUpdateIP(videoData.selectedUseUDPIP);
        this.loadDone();

        // Open socket and listen for file saves
        this.socket.on('camera:filesaved', (data) => {
          const fname = data && (data.filename || data.file);
          if (fname) {
            // Store the filename in the state
            this.setState(prevState => {
              const isRecording = prevState.videoIsRecording;
              const cameraMode = prevState.cameraMode;
              let notification = '';

              // Change the notification after recording is stopped
              if (cameraMode === 'video') {
                notification = isRecording
                ? `Recording video to ${fname}`
                : `Recorded video to ${fname}`
              } else {
                notification = `Saved photo to ${fname}`
              }

              return {
                currentVideoFile: fname,
                notification: notification
              };
            });
        }
      });
      })
      .catch(err => {
        console.error("Error loading devices:", err);
        this.setState({ error: "Failed to load camera configuration." });
        this.loadDone();
      });
    }

// Disconnect the socket that listens for file save events
componentWillUnmount() {
  if (this.socket) {
    this.socket.off('camera:filesaved');
  }
  if (super.componentWillUnmount) super.componentWillUnmount();
}

  // Helper to generate a unique string value for still caps (since they don't always have a 'value' property)
  getStillCapValue(cap) {
    if (!cap) return '';
    if (cap.value) return cap.value;
    return `${cap.width}x${cap.height}x${cap.format}`;
  }

  // Resolve a saved per-mode selection (backend's streamingSelection/
  // videoRecordSelection) against the current device list, falling back to
  // the first device/resolution/fps if nothing was saved yet or it no longer
  // matches an available device/capability.
  resolveModeSelection(selection, vidDevs) {
    const savedDeviceValue = selection?.selectedDevice ? selection.selectedDevice.value : null;
    let device = vidDevs.find(d => d.value === savedDeviceValue);
    if (!device && vidDevs.length > 0) device = vidDevs[0];

    if (!device) {
      return { device: '', caps: [], cap: '', fpsOptions: [], fpsMax: 0, fps: 30, rotation: 0, bitrate: 1100, mediaDestination: '' };
    }

    const caps = device.caps || [];
    const savedCapValue = selection?.selectedCap ? selection.selectedCap.value : null;
    let cap = caps.find(c => c.value === savedCapValue);
    if (!cap && caps.length > 0) cap = caps[0];

    const fpsOptions = cap ? (cap.fps || []) : [];
    const fpsMax = cap ? (cap.fpsmax || 0) : 0;
    const savedFps = selection?.selectedFps;
    // Only reuse the saved FPS if it's actually valid for the matched
    // capability - if the saved device/resolution wasn't found above and we
    // fell back to a different one, its FPS range/options may differ.
    const savedFpsIsValid = savedFps != null && (
      (fpsMax > 0 && savedFps >= 1 && savedFps <= fpsMax) ||
      (fpsMax === 0 && fpsOptions.some(f => String(f.value) === String(savedFps)))
    );
    const fps = savedFpsIsValid ? savedFps : (fpsMax > 0 ? fpsMax : (fpsOptions.length > 0 ? fpsOptions[0].value : 30));

    return {
      device: device.value,
      caps,
      cap: cap ? cap.value : '',
      fpsOptions,
      fpsMax,
      fps,
      rotation: (selection?.selectedRotation && selection.selectedRotation.value != null) ? selection.selectedRotation.value : 0,
      bitrate: selection?.selectedBitrate || 1100,
      mediaDestination: selection?.mediaDestination || ''
    };
  }

  handleCameraModeChange = (event) => {
    const newMode = event.target.value;
    const prevMode = this.state.cameraMode;

    // Streaming and Video Recording share the same device/cap/rotation/bitrate
    // UI fields, but should not clobber each other's selection just because
    // the user flipped the mode radio button. Remember the mode being left,
    // then restore the target mode's last selection (seeded at load time from
    // the backend's saved settings, and kept up to date as the user edits
    // each mode) instead of resetting to the first device/cap.
    this._modeSelectionCache = this._modeSelectionCache || {};
    if (prevMode === 'streaming' || prevMode === 'video') {
      this._modeSelectionCache[prevMode] = {
        device: this.state.vidDeviceSelected,
        caps: this.state.videoCaps,
        cap: this.state.vidCapSelected,
        fpsOptions: this.state.fpsOptions,
        fpsMax: this.state.FPSMax,
        fps: this.state.fpsSelected,
        rotation: this.state.rotSelected,
        bitrate: this.state.bitrate,
        mediaDestination: this.state.videoMediaDestination
      };
    }

    const updates = { cameraMode: newMode };
    const cached = (newMode === 'streaming' || newMode === 'video') ? this._modeSelectionCache[newMode] : null;

    if (cached) {
      updates.vidDeviceSelected = cached.device;
      updates.videoCaps = cached.caps;
      updates.vidCapSelected = cached.cap;
      updates.fpsOptions = cached.fpsOptions;
      updates.FPSMax = cached.fpsMax;
      updates.fpsSelected = cached.fps;
      updates.rotSelected = cached.rotation;
      updates.bitrate = cached.bitrate;
      updates.videoMediaDestination = cached.mediaDestination;
    } else if (newMode === 'video' || newMode === 'streaming') {
      // No previous selection for this mode - default to the first available
      // device/resolution/fps.
      const firstVidDevice = this.state.videoDevices.length > 0 ? this.state.videoDevices[0] : null;
      const firstCap = firstVidDevice && firstVidDevice.caps.length > 0 ? firstVidDevice.caps[0] : null;

      updates.vidDeviceSelected = firstVidDevice ? firstVidDevice.value : '';
      updates.videoCaps = firstVidDevice ? firstVidDevice.caps : [];
      updates.vidCapSelected = firstCap ? firstCap.value : '';
      updates.fpsOptions = firstCap ? (firstCap.fps || []) : [];
      updates.FPSMax = firstCap ? (firstCap.fpsmax || 0) : 0;
      updates.fpsSelected = updates.FPSMax > 0 ? updates.FPSMax : (updates.fpsOptions.length > 0 ? updates.fpsOptions[0].value : 30);
    }

    this.setState(updates);
  }

  // --- Video Device Handlers ---
  handleVideoDeviceChange = (event) => {
    const value = event.target.value;
    const device = this.state.videoDevices.find(d => d.value === value);

    if (device) {
      const newCaps = device.caps || [];
      const defaultCap = newCaps.length > 0 ? newCaps[0] : null;

      // Recalculate FPS
      const newFpsOpts = defaultCap ? defaultCap.fps : [];
      const newFpsMax = defaultCap ? defaultCap.fpsmax : 0;
      const newFps = newFpsMax > 0 ? newFpsMax : (newFpsOpts.length > 0 ? newFpsOpts[0].value : 30);

      this.setState({
        vidDeviceSelected: value,
        videoCaps: newCaps,
        vidCapSelected: defaultCap ? defaultCap.value : '',
        FPSMax: newFpsMax,
        fpsOptions: newFpsOpts,
        fpsSelected: newFps
      });

      // Auto-set compression if H264 native
      if (defaultCap && defaultCap.format === "video/x-h264") {
        this.setState({ compression: 'H264' });
      }
    }
  }

  handleVideoResChange = (event) => {
    const value = event.target.value;
    const cap = this.state.videoCaps.find(c => c.value === value);

    if (cap) {
      const newFpsOpts = cap.fps || [];
      const newFpsMax = cap.fpsmax || 0;

      // Keep the currently-selected FPS if it's still valid for the new
      // resolution's range/options, instead of always resetting it - e.g.
      // switching between two resolutions that both support up to 30fps
      // shouldn't discard a deliberately-chosen lower FPS.
      const currentFps = this.state.fpsSelected;
      const currentFpsIsValid = currentFps != null && (
        (newFpsMax > 0 && currentFps >= 1 && currentFps <= newFpsMax) ||
        (newFpsMax === 0 && newFpsOpts.some(f => String(f.value) === String(currentFps)))
      );
      const newFps = currentFpsIsValid ? currentFps : (newFpsMax > 0 ? newFpsMax : (newFpsOpts.length > 0 ? newFpsOpts[0].value : 30));

      this.setState({
        vidCapSelected: value,
        FPSMax: newFpsMax,
        fpsOptions: newFpsOpts,
        fpsSelected: newFps
      });

    if (cap.format === "video/x-h264") {
        this.setState({ compression: 'H264' });
      }
    }
  }

  handleStillDeviceChange = (event) => {
    const id = event.target.value;
    const device = this.state.stillDevices.find(d => d.id === id);

    if (device) {
      const newCaps = device.caps || [];
      this.setState({
        stillDeviceSelected: id,
        stillCaps: newCaps,
        stillCapSelected: newCaps.length > 0 ? this.getStillCapValue(newCaps[0]) : ''
      });
    }
  }

  handleStillCapChange = (event) => {
    this.setState({ stillCapSelected: event.target.value });
  }

  handleRotChange = (event) => {
    //rotation box new selected value
    this.setState({ rotSelected: parseInt(event.target.value) });
  }

  handleBitrateChange = (event) => {
    //bitrate spinner new value
    this.setState({ bitrate: event.target.value });
  }

  isMulticastUpdateIP(ip) {
    // Split the IP address into its four octets
    const octets = ip.split('.').map(Number);
    let udpmult = " ";

    // Check if the IP address has 4 octets and all are within the valid range
    if (octets.length !== 4 || octets.some(octet => isNaN(octet) || octet < 0 || octet > 255)) {
      udpmult = "multicast-group=" + ip + " ";
    }

    // Check if the first octet is within the multicast range (224-239)
    if (octets[0] >= 224 && octets[0] <= 239) {
      udpmult = "multicast-group=" + ip + " ";
    }

    this.setState({multicastString: udpmult});
  }

  handleUDPIPChange = (event) => {
    //IP address new value
    this.isMulticastUpdateIP(event.target.value);
    this.setState({ useUDPIP: event.target.value });
  }

  handleUDPPortChange = (event) => {
    //port spinner new value
    this.setState({ useUDPPort: event.target.value });
  }

  handleFPSChange = (event) => {
    //bitrate spinner new value
    this.setState({ fpsSelected: event.target.value });
  }

  handleFPSChangeSelect = (event) => {
    //fps dropdown new selected value
    this.setState({ fpsSelected: event.target.value });
  }

  handleTimestampChange = () => {
    //use timestamp new value
    this.setState({ timestamp: !this.state.timestamp });
  }

  handleUseCameraHeartbeatChange = () => {
    // Toggle camera heartbeat events
    this.setState({ enableCameraHeartbeat: !this.state.enableCameraHeartbeat });
  }

  handleMavStreamChange = (event) => {
    //new value for selected stream IP
    this.setState({ mavStreamSelected: event.target.value });
  }

  handleMediaDestinationChange = (event, mode) => {
    // Update media destination paths for photos and videos
    if (mode === 'video') {
      this.setState({ videoMediaDestination: event.target.value });
    } else {
      this.setState({ stillMediaDestination: event.target.value });
    }
  }

  handleCaptureStill = () => {
    if (!this.state.active || this.state.cameraMode !== 'photo') {
      this.setState({ error: "Camera must be active in Photo Mode." });
      return;
    }
    this.setState({ waiting: true, error: null });
    fetch('/api/capturestillphoto', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.state.token}` }
    })
      .then(res => { if (!res.ok) throw new Error("Capture failed"); })
      .catch(err => this.setState({ error: err.message }))
      .finally(() => this.setState({ waiting: false }));
  }

  handleToggleVideoRecording = () => {
    if (!this.state.active || this.state.cameraMode !== 'video') {
      this.setState({ error: "Camera must be active in Video Mode." });
      return;
    }
    this.setState({ waiting: true, error: null });

    fetch('/api/togglevideorecording', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.state.token}` }
    })
      .then(res => { if (!res.ok) throw new Error("Toggle recording failed"); })
      .then(() => {
        // Toggle the recording state
        this.setState(prevState => {
          const starting = !prevState.videoIsRecording;
          let newNotification = prevState.notification;
          if (starting) {
            // Display an interim notification until the filename is available
            newNotification = 'Starting video recording...';
          } else if (prevState.currentVideoFile){
            // Change the notification to display the filename after recording was stopped
              newNotification = `Recorded video to ${prevState.currentVideoFile}`;            
          } else {
              newNotification = 'Video recording stopped';
          }
        return {
          videoIsRecording: starting,
          currentVideoFile: starting ? '' : prevState.currentVideoFile,
          notification: newNotification
        };
        });
      })
      .catch(err => this.setState({ error: err.message }))
      .finally(() => this.setState({ waiting: false }));
  }

  handleStartCamera = () => {
    const {
      cameraMode, vidDeviceSelected, vidCapSelected, videoCaps, videoDevices,
      stillDeviceSelected, stillCapSelected, stillCaps, stillDevices
    } = this.state;

    this.setState({ waiting: true, error: null });

    let body = {
      cameraMode: cameraMode,
      useCameraHeartbeat: this.state.enableCameraHeartbeat
    };

    try {
      if (cameraMode === 'streaming') {
        // Streaming mode: use videoDevices
        // 1. Find the device
        const device = videoDevices.find(d => d.value === vidDeviceSelected);

        // SAFETY CHECK: If device isn't found
        if (!device) {
          throw new Error("Video device not found. Please select a device from the list.");
        }

        // 2. Find the resolution (capability)
        const capsObj = device.caps.find(c => c.value === vidCapSelected);

        // SAFETY CHECK: If resolution isn't found
        if (!capsObj) {
          throw new Error("Selected resolution is not valid for this device. Please select a Resolution.");
        }

        body = {
          ...body,
          videoDevice: vidDeviceSelected,
          height: capsObj.height,
          width: capsObj.width,
          format: capsObj.format,
          rotation: this.state.rotSelected,
          fps: parseInt(this.state.fpsSelected), // Make sure FPS is an integer
          bitrate: parseInt(this.state.bitrate), // Make sure bitrate is an integer
          useUDP: this.state.transportSelected === 'RTP',
          useUDPIP: this.state.useUDPIP,
          useUDPPort: this.state.useUDPPort,
          useTimestamp: this.state.timestamp,
          mavStreamSelected: this.state.mavStreamSelected,
          compression: this.state.compression
        };

      } else if (cameraMode === 'video') {
        // Video recording mode now uses videoDevices instead of stillDevices
        const device = videoDevices.find(d => d.value === vidDeviceSelected);
        if (!device) throw new Error("Video device not found. Please select a device from the list.");

        const capObj = device.caps.find(c => c.value === vidCapSelected);
        if (!capObj) throw new Error("Selected resolution is not valid for this device.");

        body = {
          ...body,
          videoDevice: vidDeviceSelected,
          height: capObj.height,
          width: capObj.width,
          format: capObj.format,
          rotation: this.state.rotSelected,
          fps: parseInt(this.state.fpsSelected),
          bitrate: parseInt(this.state.bitrate),
          mediaDestination: this.state.videoMediaDestination
        };

      } else if (cameraMode === 'photo') {

        const device = stillDevices.find(d => d.id === stillDeviceSelected);
        if (!device) throw new Error("Photo device not found.");

        const capObj = stillCaps.find(c => this.getStillCapValue(c) === stillCapSelected);
        if (!capObj) throw new Error("Photo resolution not valid.");

        body = {
          ...body,
          stillDevice: stillDeviceSelected,
          stillWidth: capObj.width,
          stillHeight: capObj.height,
          stillFormat: capObj.format,
          mediaDestination: this.state.stillMediaDestination
        };
      }

      console.log("Starting camera with:", body);

      fetch('/api/camera/start', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.state.token}`
        },
        body: JSON.stringify(body)
      })
        .then(res => res.json().then(data => ({ ok: res.ok, data })))
        .then(({ ok, data }) => {
          if (!ok) throw new Error(data.error || "Failed to start camera");
          this.setState({
            active: data.active,
            streamAddresses: data.addresses || [],
            videoIsRecording: false
          });

          // Re-fetch devices to update status if necessary
          return fetch('/api/videodevices', { headers: { Authorization: `Bearer ${this.state.token}` } });
        })
        .then(res => res.json())
        .then(data => {
          // Update network interfaces if they changed
          if (data.networkInterfaces) this.setState({ ifaces: data.networkInterfaces });
        })
        .catch(err => {
          console.error("Start error:", err);
          this.setState({ error: err.message });
        })
        .finally(() => this.setState({ waiting: false }));

    } catch (err) {
      this.setState({ error: err.message, waiting: false });
    }
  }

  handleStopCamera = () => {
    this.setState({ waiting: true, error: null });

    // Before stopping the camera, check if it's chandleStopCameraurrently recording
    const wasRecording = this.state.videoIsRecording;
    const lastFile = this.state.currentVideoFile;


    fetch('/api/camera/stop', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.state.token}` }
    })
      .then(res => res.json())
      .then(data => {
        this.setState({
          active: data.active,
          streamAddresses: [],
          videoIsRecording: false,
          // If the camera was recording, update the notification
          notification: (wasRecording && lastFile)
            ? `Recorded video to ${lastFile}`
            : this.state.notification
        });
      })
      .catch(err => this.setState({ error: err.message }))
      .finally(() => this.setState({ waiting: false }));
  }

  isrtspSourceSelected() {
    return this.state.vidDeviceSelected && (this.state.vidDeviceSelected === "rtspsourceh264" || this.state.vidDeviceSelected === "rtspsourceh265");
  }

  doGstreamerRTPString() {
    //generate gstreamer RTP string for UDP streaming
    let gststring = "gst-launch-1.0 udpsrc " + this.state.multicastString + "port=" + this.state.useUDPPort + " buffer-size=90000 ! application/x-rtp ! rtpjitterbuffer ! ";
    if (!this.isrtspSourceSelected()) {
      if (this.state.compression === "H264") {
        gststring += "rtph264depay ! h264parse ! avdec_h264 ! videoconvert ! autovideosink sync=false";
      }
      else {
        gststring += "rtph265depay ! h265parse ! avdec_h265 ! videoconvert ! autovideosink sync=false";
      }
    }
    else {
      if (this.state.vidDeviceSelected === "rtspsourceh264") {
        gststring += "rtph264depay ! h264parse ! avdec_h264 ! videoconvert ! autovideosink sync=false";
      }
      else {
        gststring += "rtph265depay ! h265parse ! avdec_h265 ! videoconvert ! autovideosink sync=false";
      }
    }
    return gststring;
  }

  doMissionPlannerRTPString() {
    //generate mission planner RTP string for UDP streaming
    let mpstring = "udpsrc " + this.state.multicastString + "port=" + this.state.useUDPPort + " buffer-size=90000 ! application/x-rtp ! rtpjitterbuffer ! ";
    if (!this.isrtspSourceSelected()) {
      if (this.state.compression === "H264") {
        mpstring += "rtph264depay ! h264parse ! avdec_h264 ! videoconvert ! video/x-raw,format=BGRA ! appsink name=outsink sync=false";
      }
      else {
        mpstring += "rtph265depay ! h265parse ! avdec_h265 ! videoconvert ! video/x-raw,format=BGRA ! appsink name=outsink sync=false";
      }
    }
    else {
      if (this.state.vidDeviceSelected === "rtspsourceh264") {
        mpstring += "rtph264depay ! h264parse ! avdec_h264 ! videoconvert ! video/x-raw,format=BGRA ! appsink name=outsink sync=false";
      }
      else {
        mpstring += "rtph265depay ! h265parse ! avdec_h265 ! videoconvert ! video/x-raw,format=BGRA ! appsink name=outsink sync=false";
      }
    }
    return mpstring;
  }

  doQGCformatselection() {
    //generate QGC format selection string
    let qgcstring = "Video Source: UDP ";
    if (!this.isrtspSourceSelected()) {
      if (this.state.compression === "H264") {
        qgcstring += "h.264 Video Stream";
      }
      else {
        qgcstring += "h.265 Video Stream";
      }
    } else {
      if (this.state.vidDeviceSelected === "rtspsourceh264") {
        qgcstring += "h.264 Video Stream";
      }
      else {
        qgcstring += "h.265 Video Stream";
      }
    }
    return qgcstring;
  }

  renderTitle() {
    return "Photo and Video";
  }

renderContent() {
    const { active, cameraMode, loading, waiting } = this.state;
    const isStreaming = cameraMode === 'streaming';
    const isVideo = cameraMode === 'video';
    const isPhoto = cameraMode === 'photo';

    // Determine which settings to show based on mode
    const showVideoSettings = isStreaming || isVideo;
    const showPhotoSettings = isPhoto;
    const showStreamingOptions = isStreaming;

    return (
      <Form style={{ width: 600 }}>
        <p><i>Configure camera operation: live video streaming, still photo capture, or local video recording. Only one mode can be active at a time. Multicast IP addresses are supported in RTP mode.</i></p>
        <p>Locally saved photos and videos can be viewed or deleted from the <Link to="/flightlogs">Flight Logs and Media</Link> page.</p>
        {!isStreaming && (
          <p>Media destination folder (an optional relative sub-folder inside: <i>{this.state.appRoot}/media/</i>)</p>
        )}

        {/* Camera Mode Selection */}
        <div className="form-group row" style={{ marginBottom: '15px' }}>
          <label className="col-sm-4 col-form-label">Camera Mode</label>
          <div className="col-sm-8">
            <Form.Check
              inline
              type="radio"
              label="Streaming"
              name="cameramode"
              value="streaming"
              disabled={active}
              onChange={this.handleCameraModeChange}
              checked={isStreaming}
            />
            <Form.Check
              inline
              type="radio"
              label="Photo"
              name="cameramode"
              value="photo"
              disabled={active || !this.state.photoVideoAvailable}
              onChange={this.handleCameraModeChange}
              checked={isPhoto}
            />
            <Form.Check
              inline
              type="radio"
              label="Video Recording"
              name="cameramode"
              value="video"
              disabled={active || !this.state.photoVideoAvailable}
              onChange={this.handleCameraModeChange}
              checked={isVideo}
            />
          </div>
        </div>

        {!this.state.photoVideoAvailable && this.state.showOpenCVWarning && (
          <div className="alert alert-warning" role="alert" style={{ marginBottom: '15px' }}>
            <strong>Photo and Video modes unavailable:</strong> OpenCV is not installed on this system. Only Streaming mode is available.
            <Button variant="link" onClick={() => this.setState({ showOpenCVWarning: false })} style={{ marginLeft: '8px', padding: 0 }}>Dismiss</Button>
          </div>
        )}

        <Accordion defaultActiveKey="0">
          <Accordion.Item eventKey="0">

            <Accordion.Header>Configuration</Accordion.Header>

            <Accordion.Body>
              {/* --- Streaming / Video Mode Settings --- */}
              <div style={{ display: showVideoSettings ? 'block' : 'none' }}>

                {/* Streaming Transport (Only for Streaming Mode) */}
                {showStreamingOptions && (
                  <div className="form-group row" style={{ marginBottom: '5px' }}>
                    <label className="col-sm-4 col-form-label">Streaming Mode</label>
                    <div className="col-sm-8">
                      <Form.Select disabled={active} value={this.state.transportSelected} onChange={(e) => this.setState({ transportSelected: e.target.value })}>
                        {this.state.transportOptions.map((opt, idx) => <option key={idx} value={opt.value}>{opt.label}</option>)}
                      </Form.Select>
                    </div>
                  </div>
                )}

                {/* Video Device Select - Different sources based on mode */}
                <div className="form-group row" style={{ marginBottom: '5px' }}>
                  <label className="col-sm-4 col-form-label">Video Device</label>
                  <div className="col-sm-8">
                    {/* Both streaming and video recording modes now use
                        videoDevices/handleVideoDeviceChange,
                        so they share the same resolution list. */}
                    <Form.Select disabled={active} onChange={this.handleVideoDeviceChange} value={this.state.vidDeviceSelected}>
                      {this.state.videoDevices.map((d, idx) => <option key={idx} value={d.value}>{d.label}</option>)}
                    </Form.Select>
                  </div>
                </div>

                {/* RTSP Source Input (If specific device selected) */}
                {this.isrtspSourceSelected() && (
                  <div className="form-group row" style={{ marginBottom: '5px' }}>
                    <label className="col-sm-4 col-form-label">RTSP Source URL</label>
                    <div className="col-sm-8">
                      <Form.Control type="text" disabled={active} value={this.state.customRTSPSource} onChange={(e) => this.setState({ customRTSPSource: e.target.value })} />
                    </div>
                  </div>
                )}

                {/* Video Resolution */}
                {!this.isrtspSourceSelected() && (
                  <div className="form-group row" style={{ marginBottom: '5px' }}>
                    <label className="col-sm-4 col-form-label">Resolution</label>
                    <div className="col-sm-8">
                      {/* Video and streaming modes now use the same videoCaps format (handleVideoResChange, c.value),
                          since videoCaps is sourced from videoDevices in both modes. */}
                      <Form.Select disabled={active} onChange={this.handleVideoResChange} value={this.state.vidCapSelected}>
                        {this.state.videoCaps.map((c, idx) => <option key={idx} value={c.value}>{c.width}x{c.height} ({c.format})</option>)}
                      </Form.Select>
                    </div>
                  </div>
                )}

                {/* Rotation, Bitrate, Timestamp, Compression (Standard Video Settings) */}
                {!this.isrtspSourceSelected() && (
                  <>
                    {/* Rotation (Hide if H264 native sometimes, but keeping logic simpler here) */}
                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                      <label className="col-sm-4 col-form-label">Rotation</label>
                      <div className="col-sm-8">
                        <Form.Select disabled={active} onChange={this.handleRotChange} value={this.state.rotSelected}>
                          {this.state.rotations.map((r, i) => <option key={i} value={r.value}>{r.label}</option>)}
                        </Form.Select>
                      </div>
                    </div>

                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                      <label className="col-sm-4 col-form-label">Max Bitrate</label>
                      <div className="col-sm-8">
                        <Form.Control disabled={active} type="number" min="50" max="50000" step="100" onChange={this.handleBitrateChange} value={this.state.bitrate} style={{ width: '100px', display: 'inline-block' }} /> kbps
                      </div>
                    </div>

                    {/* Hide the timestamp control in video recording mode since it's not supported*/}
                    {!isVideo && (
                      <div className="form-group row" style={{ marginBottom: '5px' }}>
                        <label className="col-sm-4 col-form-label">Timestamp</label>
                        <div className="col-sm-8">
                          <Form.Check
                            type="checkbox"
                            disabled={active}
                            onChange={this.handleTimestampChange}
                            checked={this.state.timestamp} /></div>
                      </div>
                    )}

                    {/* Also hide the compression control since we don't have the ability to change ccompression options*/}
                    {!isVideo && (
                      <div className="form-group row" style={{ marginBottom: '5px' }}>
                        <label className="col-sm-4 col-form-label">Compression</label>
                        <div className="col-sm-8">
                          <Form.Select disabled={active} value={this.state.compression} onChange={(e) => this.setState({ compression: e.target.value })}>
                            {this.state.compressionOptions.map((o, i) => <option key={i} value={o.value}>{o.label}</option>)}
                          </Form.Select>
                        </div>
                      </div>
                    )}

                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                      <label className="col-sm-4 col-form-label">Framerate</label>
                      <div className="col-sm-8">
                        {this.state.FPSMax === 0 ? (
                          <Form.Select disabled={active} value={this.state.fpsSelected} onChange={this.handleFPSChange}>
                            {this.state.fpsOptions.map((f, i) => <option key={i} value={f.value}>{f.label}</option>)}

                          </Form.Select>
                        ) : (
                          <>
                            <Form.Control disabled={active} type="number" min="1" max={this.state.FPSMax} onChange={this.handleFPSChange} value={this.state.fpsSelected} style={{ width: '80px', display: 'inline-block' }} />
                            <span> fps (max: {this.state.FPSMax})</span>
                          </>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* RTP Settings (Only if Streaming + RTP) */}
                {isStreaming && this.state.transportSelected === 'RTP' && (
                  <>
                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                      <label className="col-sm-4 col-form-label">Destination IP</label>
                      <div className="col-sm-7">
                        <IPAddressInput name="ipaddress" value={this.state.useUDPIP} onChange={this.handleUDPIPChange} disabled={active} />
                      </div>
                    </div>
                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                      <label className="col-sm-4 col-form-label">Destination Port</label>
                      <div className="col-sm-8">
                        <Form.Control type="number" disabled={active} value={this.state.useUDPPort} onChange={this.handleUDPPortChange} />
                      </div>
                    </div>
                  </>
                )}

                {/* Media Destinations */}
                {isVideo && (
                  <div className="form-group row" style={{ marginBottom: '5px' }}>
                    <label className="col-sm-4 col-form-label">Media Destination</label>
                    <div className="col-sm-8">
                      <Form.Control 
                        disabled={active} 
                        type="text" 
                        onChange={(e) => this.handleMediaDestinationChange(e, 'video')}
                        value={this.state.videoMediaDestination}
                        placeholder="e.g., flight_01"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* --- Photo Mode Settings --- */}
              <div style={{ display: showPhotoSettings ? 'block' : 'none' }}>
                <div className="form-group row" style={{ marginBottom: '5px' }}>
                  <label className="col-sm-4 col-form-label">Photo Device</label>
                  <div className="col-sm-8">
                    <Form.Select disabled={active}
                      onChange={this.handleStillDeviceChange}
                      value={this.state.stillDeviceSelected}>
                      {this.state.stillDevices.map((d, i) => <option key={i} value={d.id}>{d.type}: {d.card_name}</option>)}
                    </Form.Select>
                  </div>
                </div>
                <div className="form-group row" style={{ marginBottom: '5px' }}>
                  <label className="col-sm-4 col-form-label">Resolution</label>
                  <div className="col-sm-8">
                    <Form.Select disabled={active} onChange={this.handleStillCapChange} value={this.state.stillCapSelected}>
                      {this.state.stillCaps.map((c, i) => <option key={i} value={this.getStillCapValue(c)}>{c.width}x{c.height} ({c.format})</option>)}
                    </Form.Select>
                  </div>
                </div>
                <div className="form-group row" style={{ marginBottom: '5px' }}>
                  <label className="col-sm-4 col-form-label">Media Destination</label>
                  <div className="col-sm-8">
                    <Form.Control 
                      disabled={active} 
                      type="text" 
                      onChange={(e) => this.handleMediaDestinationChange(e, 'photo')}
                      value={this.state.stillMediaDestination}
                      placeholder="e.g., flight_01"
                    />
                  </div>
                </div>
              </div>

            </Accordion.Body>
          </Accordion.Item>

          <Accordion.Item eventKey="1">
            <Accordion.Header>MAVLink Video Streaming Service</Accordion.Header>
            <Accordion.Body>
              <p><i>Configuration for advertising the camera and associated video stream via MAVLink. See <a href='https://mavlink.io/en/services/camera.html#video_streaming'>here</a> for details.</i></p>
              <div className="form-group row" style={{ marginBottom: '5px' }}>
                <label className="col-sm-4 col-form-label">Enable camera heartbeats</label>
                <div className="col-sm-7">
                  <Form.Check
                    type="checkbox"
                      disabled={active}
                      checked={this.state.enableCameraHeartbeat}
                      onChange={this.handleUseCameraHeartbeatChange}
                  />
                </div>
              </div>
              {/* Show Source IP only if Heartbeat Enabled AND Streaming Mode AND RTSP (Server) mode */}
              {(this.state.enableCameraHeartbeat && isStreaming && this.state.transportSelected === 'RTSP') && (
                <div className="form-group row" style={{ marginBottom: '5px' }}>
                  <label className="col-sm-4 col-form-label">Video source IP Address</label>
                  <div className="col-sm-8">
                    <Form.Select
                      disabled={active}
                      onChange={this.handleMavStreamChange}
                      value={this.state.mavStreamSelected}
                    >
                      {this.state.ifaces.map((ip, i) => (
                        <option key={i} value={ip}>{ip}</option>
                      ))}
                    </Form.Select>
                  </div>
                </div>
              )}
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>

        {/* --- Control Buttons --- */}
        <div style={{ marginTop: '15px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '600px', textAlign: 'center' }}>

            {/* Take Photo Button */}
            {active && isPhoto && (
              <Button onClick={this.handleCaptureStill} variant="secondary" disabled={waiting} style={{ marginRight: '10px', marginBottom: '10px' }}>
                Take Photo
              </Button>
            )}

            {/* Toggle Recording Button */}
            {active && isVideo && (
              <Button onClick={this.handleToggleVideoRecording} variant="secondary" disabled={waiting} style={{ marginRight: '10px', marginBottom: '10px' }}>
                {this.state.videoIsRecording ? 'Stop Recording' : 'Start Recording'}
              </Button>
            )}

            {/* Main Start/Stop Button */}
            <Button onClick={active ? this.handleStopCamera : this.handleStartCamera} disabled={waiting} className="btn btn-primary" style={{ marginBottom: '10px' }}>
              {waiting ? 'Processing...' : (active
                ? `Stop ${isStreaming ? 'Streaming' : (isPhoto ? 'Photo Mode' : 'Video Mode')}`
                : `Start ${isStreaming ? 'Streaming' : (isPhoto ? 'Photo Mode' : 'Video Mode')}`
              )}
            </Button>
                {/* Photo/video taken notification text box */}
                {this.state.notification && (
                  <div 
                      className={`alert ${this.state.videoIsRecording ? 'alert-warning' : 'alert-info'}`} 
                      role="alert" 
                      style={{marginBottom: '0px'}}
                  >
                    {this.state.notification}
                    <Button variant="link" onClick={() => this.setState({ notification: '' })} style={{ marginLeft: '8px', padding: 0 }}>Dismiss</Button>
                  </div>
                )}
          </div>
          <br/>
        </div>

        {/* --- Connection Strings (Streaming Only) --- */}
        {active && isStreaming && (
          <>
            <br />
            <h3>Connection strings for video stream</h3>

            {/* RTSP Strings */}
            {this.state.transportSelected === 'RTSP' && (
              <Accordion defaultActiveKey="0">
                <Accordion.Item eventKey="0">
                  <Accordion.Header>+ RTSP Streaming Addresses</Accordion.Header>
                  <Accordion.Body>
                    {this.state.streamAddresses.map((item, index) => <p key={index} style={{ fontFamily: "monospace" }}>{item}</p>)}
                  </Accordion.Body>
                </Accordion.Item>
                <Accordion.Item eventKey="1">
                  <Accordion.Header>+ GStreamer</Accordion.Header>
                  <Accordion.Body>
                    {this.state.streamAddresses.map((item, index) => <p key={index} style={{ fontFamily: "monospace" }}>gst-launch-1.0 rtspsrc location={item} latency=0 is-live=True ! queue ! decodebin ! autovideosink</p>)}
                  </Accordion.Body>
                </Accordion.Item>
                <Accordion.Item eventKey="2">
                  <Accordion.Header>+ Mission Planner</Accordion.Header>
                  <Accordion.Body>
                    {this.state.streamAddresses.map((item, index) => <p key={index} style={{ fontFamily: "monospace" }}>rtspsrc location={item} latency=0 is-live=True ! queue ! application/x-rtp ! {this.state.compression === "H264" ? "rtph264depay" : "rtph265depay"} ! {this.state.compression === "H264" ? "avdec_h264" : "avdec_h265"} ! videoconvert ! video/x-raw,format=BGRA ! appsink name=outsink</p>)}
                  </Accordion.Body>
                </Accordion.Item>
              </Accordion>
            )}

            {/* RTP Strings */}
            {this.state.transportSelected === 'RTP' && (
              <Accordion defaultActiveKey="0">
                <Accordion.Item eventKey="0">
                  <Accordion.Header>+ QGroundControl</Accordion.Header>
                  <Accordion.Body>
                    <p style={{ fontFamily: "monospace" }}>{this.doQGCformatselection()}</p>
                    <p style={{ fontFamily: "monospace" }}>Port: {this.state.useUDPPort}</p>
                  </Accordion.Body>
                </Accordion.Item>
                <Accordion.Item eventKey="1">
                  <Accordion.Header>+ GStreamer</Accordion.Header>
                  <Accordion.Body>
                    <p style={{ fontFamily: "monospace" }}>{this.doGstreamerRTPString()}</p>
                  </Accordion.Body>
                </Accordion.Item>
                <Accordion.Item eventKey="2">
                  <Accordion.Header>+ Mission Planner</Accordion.Header>
                  <Accordion.Body>
                    <p style={{ fontFamily: "monospace" }}>{this.doMissionPlannerRTPString()}</p>
                  </Accordion.Body>
                </Accordion.Item>
              </Accordion>
            )}
          </>
        )}
      </Form>
    );
  }
}


export default VideoPage;