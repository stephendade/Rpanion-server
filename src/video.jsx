import Select from 'react-select';
import Button from 'react-bootstrap/Button';
import Accordion from 'react-bootstrap/Accordion';
import Form from 'react-bootstrap/Form';
import React from 'react'

import basePage from './basePage.jsx';

import './css/styles.css';

class VideoPage extends basePage {
  constructor(props) {
    super(props);
    this.state = {
      ...this.state, // Inherit base state (token, loading, waiting, error)
      // --- Video/Streaming State ---
      videoDevices: [], // Renamed from 'dev' for clarity
      videoDeviceSelected: null,
      videoCaps: [],
      videoCapSelected: null,
      ifaces: [],
      mavStreamSelected: null,
      rotations: [{ label: "0°", value: 0 }, { label: "90°", value: 90 }, { label: "180°", value: 180 }, { label: "270°", value: 270 }],
      rotSelected: { label: "0°", value: 0 },
      bitrate: 1100,
      UDPChecked: false,
      useUDPIP: "127.0.0.1",
      useUDPPort: 5600,
      FPSMax: 0,
      fpsOptions: [],   // Renamed from "fps"
      fpsSelected: null,
      timestamp: false,
      enableCameraHeartbeat: false,
      compression: { value: 'H264', label: 'H.264' },
      multicastString: " ",

      // --- Still Photo State ---
      stillDevices: [],
      stillDeviceSelected: null,
      stillCaps: [],
      stillCapSelected: null,

      // --- Common Camera State ---
      active: false, // Renamed from "streamingStatus"
      cameraMode: 'streaming', // Default to streaming
      streamAddresses: [],
    };
  }

componentDidMount() {
  //this.setLoading(true); // Use basePage loading state
  Promise.all([
    // Fetch Video Devices Info
    fetch(`/api/videodevices`, { headers: { Authorization: `Bearer ${this.state.token}` } }),
    // Fetch Still Devices Info
    fetch(`/api/camera/still_devices`, { headers: { Authorization: `Bearer ${this.state.token}` } })
  ])
  .then(async ([videoRes, stillRes]) => {
    const videoData = await videoRes.json();
    const stillData = await stillRes.json();

    // Log the raw stillData received
    console.log("--- Frontend received stillData ---");
    console.log("stillData:", stillData);
    console.log("-----------------------------------");

    if (!videoRes.ok) throw new Error(`Video devices fetch failed: ${videoData.error || 'Unknown error'}`);
    if (!stillRes.ok) throw new Error(`Still devices fetch failed: ${stillData.error || 'Unknown error'}`);

 // --- Process Video Data using the new structure ---
 const videoStateUpdate = {
  videoDevices: videoData.devices || [],
  active: videoData.active || false,
  cameraMode: videoData.cameraMode || 'streaming', // Use fetched mode or default
  streamAddresses: videoData.streamAddresses || [],
  // ---> Map networkInterfaces to ifaces state <---
  ifaces: (videoData.networkInterfaces || []).map(ip => ({ label: ip, value: ip })),
  videoDeviceSelected: videoData.selectedDevice || null,
  videoCaps: videoData.resolutionCaps || [], // Use resolutionCaps field
  videoCapSelected: videoData.selectedCap || null,
  rotSelected: videoData.selectedRotation || { label: "0°", value: 0 },
  bitrate: videoData.selectedBitrate !== undefined ? videoData.selectedBitrate : 1100,
  UDPChecked: videoData.selectedUseUDP || false,
  useUDPIP: videoData.selectedUseUDPIP || "127.0.0.1",
  useUDPPort: videoData.selectedUseUDPPort !== undefined ? videoData.selectedUseUDPPort : 5600,
  FPSMax: videoData.fpsMax !== undefined ? videoData.fpsMax : 0,
  fpsOptions: videoData.fpsOptions || [],
  fpsSelected: videoData.selectedFps, // This might be number or object {label, value}
  timestamp: videoData.selectedUseTimestamp || false,
  enableCameraHeartbeat: videoData.selectedUseCameraHeartbeat || false,
  // Ensure compression is an object, default if missing/invalid
  compression: videoData.compression && typeof videoData.compression === 'object' ? videoData.compression : { value: 'H264', label: 'H.264' },
   // Ensure mavStreamSelected is an object, default if missing/invalid
  mavStreamSelected: videoData.selectedMavStreamURI && typeof videoData.selectedMavStreamURI === 'object' ? videoData.selectedMavStreamURI : { label: '127.0.0.1', value: '127.0.0.1' }
};

     // Update multicast string based on loaded IP
     if (videoStateUpdate.useUDPIP) {
      this.isMulticastUpdateIP(videoStateUpdate.useUDPIP);
 }

    // --- Process Still Camera Data (Assuming structure is ok) ---

    // const stillDevices = stillData.devices || [];
    // const selectedDevice = stillData.selectedDevice;
    // const stillCaps = selectedDevice?.caps || [];
    // const selectedCap = stillData.selectedCap;

    const stillDevices = stillData.devices || [];
    let selectedDevice = stillData.selectedDevice;
    let selectedCap = stillData.selectedCap;

    // If the backend didn't provide a selected device, BUT devices are available,
    // then set a sensible default.
    if (!selectedDevice && stillDevices.length > 0) {
      selectedDevice = stillDevices[0]; // Default to the first device in the list
    }

    const stillCaps = selectedDevice?.caps || [];

    // If the backend didn't provide a selected capability, BUT caps are available,
    // then we will set a sensible default.
    if (!selectedCap && stillCaps.length > 0) {
      selectedCap = stillCaps[0]; // Default to the first capability in the list
    }

    const stillStateUpdate = {
      stillDevices,
      stillDeviceSelected: selectedDevice,
      stillCaps,
      stillCapSelected: selectedCap,

    }


    // Log the state object before setting it
    console.log("--- Frontend stillStateUpdate ---");
    console.log("stillStateUpdate:", stillStateUpdate);
    console.log("---------------------------------");

    // --- Apply Combined State Updates ---
    this.setState({
      ...videoStateUpdate,
      ...stillStateUpdate,
      error: null // Clear previous errors on success
    });

  })
  .catch(error => {
    console.error("Error fetching camera devices:", error);
    this.setState({ error: error.message || 'Failed to load camera configuration.' });
  })
  .finally(() => {
    this.loadDone(); // Call basePage method
  });
}

  handleCameraModeChange = (event) => {
    this.setState({ cameraMode: event.target.value });
  }

  handleVideoDeviceChange = (selectedOption) => {
    const newCaps = selectedOption.caps || [];
    const defaultCap = newCaps.length > 0 ? newCaps[0] : null;

    let newFpsSelected = null;
    let newFpsOptions = [];
    let newFPSMax = 0;

    if (defaultCap) {
      // --- Calculate FPS settings based ONLY on the NEW defaultCap ---
      newFpsOptions = defaultCap.fps || [];
      newFPSMax = defaultCap.fpsmax !== undefined ? defaultCap.fpsmax : 0;

      if (newFPSMax > 0) {
          // Mode: Number input will be shown
          // Calculate a sensible default respecting the NEW max
          newFpsSelected = newFPSMax;
      } else {
          // Mode: Dropdown will be shown
          // Select the first available option for the NEW cap
          newFpsSelected = newFpsOptions.length > 0 ? newFpsOptions[0] : null;
      }
  }
  // If defaultCap is null, all FPS state will be reset (empty options, 0 max, null selected)

    this.setState({
        videoDeviceSelected: selectedOption,
        videoCaps: newCaps,
        // Reset dependent selections to defaults for the new device
        videoCapSelected: defaultCap,
        fpsOptions: newFpsOptions,
        FPSMax: newFPSMax,
        fpsSelected: newFpsSelected
    }, () => {
        // If the default cap forces H.264, update compression
        if (defaultCap?.format === "video/x-h264") {
            this.setState({ compression: { value: 'H264', label: 'H.264' } });
        }
    });
  }

  handleVideoCapChange = (selectedOption) => {
    // Update selected resolution/capability and associated FPS options
    const fpsOptions = selectedOption.fps || [];
    const fpsMax = selectedOption.fpsmax !== undefined ? selectedOption.fpsmax : 0;
    const defaultFps = fpsOptions.length > 0 ? fpsOptions[0] : null; // Pick first available FPS

    this.setState({
        videoCapSelected: selectedOption,
        FPSMax: fpsMax,
        fpsOptions: fpsOptions,
        fpsSelected: fpsMax > 0 ? Math.min(fpsMax, 10) : defaultFps // Default to 10 or first option
    });

    // Override compression if the format dictates it
    if (selectedOption.format === "video/x-h264") {
        this.setState({ compression: { value: 'H264', label: 'H.264' } });
    }
  }

  handleRotChange = (value) => {
    //resolution box new selected value
    this.setState({ rotSelected: value });
  }

  handleBitrateChange = (event) => {
    //bitrate spinner new value
    this.setState({ bitrate: event.target.value });
  }

  handleStreamingModeChange = (event) => { // Renamed from handleUseUDPChange
    this.setState({ UDPChecked: event.target.value === "rtp" });
  }

  handleUDPIPChange = (event) => {
    //IP address new value
    this.isMulticastUpdateIP(event.target.value);
    this.setState({ useUDPIP: event.target.value});
  }

  handleUDPPortChange = (event) => {
    //bitrate spinner new value
    this.setState({ useUDPPort: event.target.value});
  }

  // Helper to update multicast string state
  isMulticastUpdateIP(ip) {
    try {
        const octets = ip.split('.').map(Number);
        let udpmult = " ";
        if (octets.length === 4 && octets.every(octet => !isNaN(octet) && octet >= 0 && octet <= 255)) {
            if (octets[0] >= 224 && octets[0] <= 239) {
                udpmult = "multicast-group=" + ip + " ";
            }
        }
        this.setState({ multicastString: udpmult });
    } catch (e) {
        this.setState({ multicastString: " " }); // Reset on error parsing IP
    }
  }

  handleFPSChange = (event) => {
    //bitrate spinner new value
    this.setState({ fpsSelected: event.target.value });
  }

  handleFPSChangeSelect = (value) => {
    //resolution box new selected value
    this.setState({ fpsSelected: value });
  }

  handleTimestampChange = () => {
    //use timestamp new value
    this.setState({ timestamp: !this.state.timestamp });
  }

  handleCompressionChange = (value) => {
    this.setState({ compression: value });
}

  handleUseCameraHeartbeatChange = () => {
    // Toggle camera heartbeat events
    this.setState({ enableCameraHeartbeat: !this.state.enableCameraHeartbeat });
  }

  handleMavStreamChange = (value) => {
    //new value for selected stream IP
    this.setState({ mavStreamSelected: value });
  }

  handleStillDeviceChange = (selectedOption) => {

    console.log("Selected device in handleStillDeviceChange:", selectedOption);

    const newCaps = selectedOption.caps || [];
    this.setState({
        stillDeviceSelected: selectedOption,
        stillCaps: newCaps,
        stillCapSelected: newCaps.length > 0 ? newCaps[0] : null // Select first cap by default
    });
  }

  handleStillCapChange = (selectedOption) => {
      this.setState({ stillCapSelected: selectedOption });
  }

  // --- Action Handlers ---
  handleCaptureStill = () => {
    if (!this.state.active || this.state.cameraMode !== 'photo') {
        this.setState({ error: "Camera must be active in Photo Mode to capture." });
        return;
    }
    this.setState({ waiting: true, error: null });
    fetch('/api/capturestillphoto', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.state.token}` } // Add Auth
    })
    .then(res => {
        if (!res.ok) throw new Error('Failed to send capture command.');
        // Optionally show a temporary success message
    })
    .catch(error => this.setState({ error: error.message }))
    .finally(() => this.setState({ waiting: false }));
  }

  handleToggleVideoRecording = () => { // Renamed from handleToggleVideo
    if (!this.state.active || this.state.cameraMode !== 'video') {
      this.setState({ error: "Camera must be active in Video Mode to toggle recording." });
      return;
    }
    this.setState({ waiting: true, error: null });
    fetch('/api/togglevideorecording', { // Use new endpoint
      method: 'POST',
       headers: { 'Authorization': `Bearer ${this.state.token}` } // Add Auth
    })
     .then(res => {
        if (!res.ok) throw new Error('Failed to send toggle recording command.');
        // Optionally show a temporary success message
    })
    .catch(error => this.setState({ error: error.message }))
    .finally(() => this.setState({ waiting: false }));
  }

  handleStartCamera = () => {
    this.setState({ waiting: true, error: null });

    let body;

    try {
      body = {
        cameraMode: this.state.cameraMode,
        useCameraHeartbeat: this.state.enableCameraHeartbeat,
      };

      if (this.state.cameraMode === 'streaming' || this.state.cameraMode === 'video') {
        if (!this.state.videoDeviceSelected || !this.state.videoCapSelected) {
          throw new Error("Video Device and Resolution must be selected.");
        }
        const currentFpsState = this.state.fpsSelected;
        const valueToParse = this.state.FPSMax > 0 ? currentFpsState : currentFpsState?.value;
        if (valueToParse === null || valueToParse === undefined) {
          throw new Error("Video Framerate (FPS) must be selected or entered.");
        }
        if (isNaN(parseInt(valueToParse, 10))) {
          throw new Error("Invalid value for Video Framerate (FPS).");
        }

        body = {
          ...body,
          videoDevice: this.state.videoDeviceSelected.value,
          height: this.state.videoCapSelected.height,
          width: this.state.videoCapSelected.width,
          format: this.state.videoCapSelected.format,
          rotation: this.state.rotSelected.value,
          fps: parseInt(valueToParse, 10),
          bitrate: parseInt(this.state.bitrate, 10),
          useUDP: this.state.UDPChecked,
          useUDPIP: this.state.useUDPIP,
          useUDPPort: parseInt(this.state.useUDPPort, 10),
          useTimestamp: this.state.timestamp,
          mavStreamSelected: this.state.mavStreamSelected?.value || '127.0.0.1',
          compression: this.state.compression.value,
        };

        if (isNaN(body.height) || isNaN(body.width) || isNaN(body.rotation) || isNaN(body.fps) || isNaN(body.bitrate) || isNaN(body.useUDPPort)) {
          throw new Error("Invalid numeric value entered for video settings.");
        }

        if (body.useUDP) {
          // Regex to validate an IP address
          const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
          if (!body.useUDPIP || !ipRegex.test(body.useUDPIP)) {
            throw new Error("Destination IP is required and must be a valid IP address for RTP mode.");
          }
        }

      } else if (this.state.cameraMode === 'photo') {
        if (!this.state.stillDeviceSelected || !this.state.stillCapSelected) {
          throw new Error("Still Camera Device and Resolution must be selected.");
        }
        body = {
          ...body,
          stillDevice: this.state.stillDeviceSelected.id,
          stillWidth: this.state.stillCapSelected.width,
          stillHeight: this.state.stillCapSelected.height,
          stillFormat: this.state.stillCapSelected.format,
        };
        if (isNaN(body.stillWidth) || isNaN(body.stillHeight)) {
          throw new Error("Invalid numeric value entered for still photo settings.");
        }
      } else {
        throw new Error("Invalid camera mode selected.");
      }
    } catch (validationError) {
      console.error("Client-side validation failed:", validationError);
      this.setState({ waiting: false, error: validationError.message });
      return;
    }

    // Log the data payload before making the POST request
    console.log('Starting camera with payload:', body);

    fetch('/api/camera/start', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.state.token}`
      },
      body: JSON.stringify(body)
    })
    .then(response => response.json().then(data => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
      if (!ok) {
        const errorMessage = data.details ? `${data.error}: ${data.details[0].msg} in ${data.details[0].param}` : (data.error || 'Failed to start camera.');
        throw new Error(errorMessage);
      }
      this.setState({
        active: data.active,
        streamAddresses: data.addresses || [],
        ifaces: (data.networkInterfaces || []).map(ip => ({ label: ip, value: ip })),
        error: null
      });
      return fetch('/api/videodevices', { headers: { Authorization: `Bearer ${this.state.token}` } });
    })
    .then(res => res.json())
    .then(videoData => {
      const ifaceList = (videoData.networkInterfaces || []).map(ip => ({ label: ip, value: ip }));
      this.setState({ ifaces: ifaceList });
    })
    .catch(error => {
      console.error("Error during or after starting camera:", error);
      this.setState({ error: error.message });
    })
    .finally(() => {
      this.setState({ waiting: false });
    });
  }

  handleStopCamera = () => {
    this.setState({ waiting: true, error: null });
    fetch('/api/camera/stop', { // Use new endpoint
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.state.token}` }
    })
    .then(response => response.json().then(data => ({ ok: response.ok, data })))
    .then(({ ok, data }) => {
       if (!ok) {
         throw new Error(data.error || 'Failed to stop camera cleanly.');
       }
        this.setState({
            active: data.active, // Should be false
            streamAddresses: [],
            error: null
         });
    })
    .catch(error => {
        console.error("Error stopping camera:", error);
        this.setState({ error: error.message });
    })
    .finally(() => {
       this.setState({ waiting: false });
    });
  }

  renderTitle() {
    return "Camera Control & Video Streaming";
  }

  renderContent() {

    const {
      active, cameraMode, videoDevices, videoDeviceSelected, videoCaps, videoCapSelected,
      stillDevices, stillDeviceSelected, stillCaps, stillCapSelected,
      rotations, rotSelected, bitrate, UDPChecked, useUDPIP, useUDPPort,
      FPSMax, fpsOptions, fpsSelected, timestamp, enableCameraHeartbeat,
      compression, mavStreamSelected, ifaces, streamAddresses, multicastString,
      loading, waiting, error // Use basePage state
  } = this.state;

  const isStreamingOrVideoMode = cameraMode === 'streaming' || cameraMode === 'video';
  const isPhotoMode = cameraMode === 'photo';
  const isStreamingMode = cameraMode === 'streaming';

  // Determine button text and action
  const mainButtonText = active
    ? `Stop ${cameraMode === 'streaming' ? 'Streaming' : (cameraMode === 'photo' ? 'Photo Mode' : 'Video Mode')}`
    : `Start ${cameraMode === 'streaming' ? 'Streaming' : (cameraMode === 'photo' ? 'Photo Mode' : 'Video Mode')}`;
  const mainButtonAction = active ? this.handleStopCamera : this.handleStartCamera;
  const mainButtonDisabled = waiting || loading; // Disable while loading initial data or performing action

  return (
    <Form style={{ width: 600 }}>
      {loading && <p>Loading configuration...</p>}

      <p><i>Configure camera operation: live video streaming, still photo capture, or local video recording. Only one mode can be active.</i></p>        <h2>Configuration</h2>

      {/* Camera Mode Selection */}
      <div className="form-group row" style={{ marginBottom: '15px' }}>
            <label className="col-sm-4 col-form-label">Camera Mode</label>
            <div className="col-sm-8">
              <div className="form-check">
                <input className="form-check-input" type="radio" name="cameramode" value="streaming" disabled={active} onChange={this.handleCameraModeChange} checked={cameraMode === "streaming" } />
                <label className="form-check-label">Streaming Video</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="radio" name="cameramode" value="photo" disabled={active} onChange={this.handleCameraModeChange} checked={cameraMode === "photo" } />
                <label className="form-check-label">Still Photo Capture</label>
              </div>
              <div className="form-check">
                <input className="form-check-input" type="radio" name="cameramode" value="video" disabled={active} onChange={this.handleCameraModeChange} checked={cameraMode === "video" } />
                <label className="form-check-label">Local Video Recording</label>
              </div>
            </div>
      </div>

      {/* --- Settings common to Streaming and Video Recording --- */}
      <div style={{ display: isStreamingOrVideoMode ? "block" : "none" }}>
         <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Video Device</label>
              <div className="col-sm-8">
                  <Select isDisabled={active} onChange={this.handleVideoDeviceChange} options={videoDevices} value={videoDeviceSelected} isLoading={loading} placeholder="Select Video Device..." />
              </div>
         </div>
         <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Resolution / Format</label>
              <div className="col-sm-8">
                  <Select isDisabled={active || !videoDeviceSelected} options={videoCaps} onChange={this.handleVideoCapChange} value={videoCapSelected} placeholder="Select Resolution..." />
              </div>
         </div>

           {/* Show rotation only if format is not native H.264 (handled by hardware/driver) */}
         <div style={{ display: videoCapSelected?.format !== "video/x-h264" ? "block" : "none"}}>
              <div className="form-group row" style={{ marginBottom: '5px' }}>
                  <label className="col-sm-4 col-form-label">Rotation</label>
                  <div className="col-sm-8">
                  <Select isDisabled={active} options={rotations} onChange={this.handleRotChange} value={rotSelected} />
                  </div>
              </div>
          </div>

          {/* Timestamp Overlay */}
          <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Timestamp Overlay</label>
              <div className="col-sm-8 pt-2"> {/* Added padding for alignment */}
                  <Form.Check type="checkbox" disabled={active} onChange={this.handleTimestampChange} checked={timestamp} id="timestamp-check"/>
              </div>
          </div>

          {/* --- Streaming Specific Settings --- */}
          <div style={{ display: isStreamingMode ? "block" : "none"}}>
               {/* Streaming Mode (RTP/RTSP) */}
              <div className="form-group row" style={{ marginBottom: '15px'}}>
                      <label className="col-sm-4 col-form-label">Streaming Mode</label>
                      <div className="col-sm-8">
                      <div className="form-check">
                          <input className="form-check-input" type="radio" name="streamtype" value="rtp" disabled={active} onChange={this.handleStreamingModeChange} checked={UDPChecked} />
                          <label className="form-check-label">RTP (UDP stream to single client)</label>
                      </div>
                      <div className="form-check">
                          <input className="form-check-input" type="radio" name="streamtype" value="rtsp" disabled={active} onChange={this.handleStreamingModeChange} checked={!UDPChecked} />
                          <label className="form-check-label">RTSP (server for multiple clients)</label>
                      </div>
                      </div>
              </div>

               {/* Compression (Only relevant for streaming?) */}
               <div className="form-group row" style={{ marginBottom: '5px'}}>
                  <label className="col-sm-4 col-form-label">Compression</label>
                  <div className="col-sm-8">
                      <Select
                      isDisabled={active || videoCapSelected?.format === "video/x-h264"} // Disable if format is native H264
                      options={[
                          { value: 'H264', label: 'H.264' },
                          { value: 'H265', label: 'H.265' }
                      ]}
                      onChange={this.handleCompressionChange}
                      value={compression}
                      />
                  </div>
              </div>

              {/* Bitrate (Show for RTSP or if format needs encoding) */}
              <div style={{ display: !UDPChecked || videoCapSelected?.format !== "video/x-h264" ? "block" : "none"}}>
                  <div className="form-group row" style={{ marginBottom: '5px'}}>
                      <label className="col-sm-4 col-form-label">Maximum Bitrate</label>
                      <div className="col-sm-8">
                          <Form.Control disabled={active} type="number" name="bitrate" min="50" max="50000" step="100" onChange={this.handleBitrateChange} value={bitrate} style={{width:'100px', display:'inline-block', marginRight:'5px'}}/>kbps
                      </div>
                  </div>
              </div>

              {/* Framerate */}
              <div className="form-group row" style={{ marginBottom: '5px'}}>
              <label className="col-sm-4 col-form-label">Framerate</label>
              <div className="col-sm-8">
                  {FPSMax === 0 && fpsOptions.length > 0 && ( // Dropdown Select
                  <Select isDisabled={active || !videoCapSelected} options={fpsOptions} value={fpsSelected} onChange={this.handleFPSChangeSelect} placeholder="Select FPS..."/>
                  )}
                  {FPSMax > 0 && ( // Number Input
                  <>
                      <Form.Control disabled={active || !videoCapSelected} type="number" name="fps" min="1" max={FPSMax} step="1" onChange={this.handleFPSChange} value={typeof fpsSelected === 'object' ? fpsSelected?.value : fpsSelected} style={{width:'80px', display:'inline-block', marginRight:'5px'}} />
                      fps (max: {FPSMax})
                  </>
                  )}
                   {FPSMax === 0 && fpsOptions.length === 0 && <span>(Select Resolution)</span>}
              </div>
              </div>

               {/* RTP Specific Settings */}
              <div style={{ display: UDPChecked ? "block" : "none" }}>
                  <div className="form-group row" style={{ marginBottom: '5px' }}>
                      <label className="col-sm-4 col-form-label ">Destination IP</label>
                      <div className="col-sm-8">
                      <Form.Control type="text" name="ipaddress" disabled={active} value={useUDPIP} onChange={this.handleUDPIPChange} />
                      </div>
                  </div>
                  <div className="form-group row" style={{ marginBottom: '5px' }}>
                      <label className="col-sm-4 col-form-label">Dest. Port</label>
                      <div className="col-sm-8">
                      <Form.Control type="number" name="port" min="1024" max="65535" disabled={active} value={useUDPPort} onChange={this.handleUDPPortChange} />
                      </div>
                  </div>
              </div>
          </div> {/* End Streaming Specific */}
      </div> {/* End Streaming/Video Common */}


      {/* --- Still Photo Specific Settings --- */}
      <div style = {{display: isPhotoMode ? "block" : "none"}}>
           <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Photo Device</label>
              <div className="col-sm-8">
                   <Select isDisabled={active} onChange={this.handleStillDeviceChange} options={stillDevices} getOptionLabel={(option) => `${option.type}: ${option.card_name}`} getOptionValue={(option) => option.id} value={stillDeviceSelected} isLoading={loading} placeholder="Select Still Camera..."/>
              </div>
          </div>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Photo Resolution</label>
              <div className="col-sm-8">
                  <Select isDisabled={active || !stillDeviceSelected} options={stillCaps} getOptionLabel={(option)=>`${option.width}x${option.height} (${option.format})`} onChange={this.handleStillCapChange} value={stillCapSelected} placeholder="Select Photo Resolution..." />
              </div>
          </div>
          {/* "Take Photo" button */}
          <div style = {{display: (cameraMode === "photo") ? "block" : "none"}}>
            <div className="form-group row" style={{ marginTop: '15px' }}>
                <div className="col-sm-8 offset-sm-4">
                    <Button onClick={this.handleCaptureStill} variant="secondary" disabled={!active || waiting || loading} >Take Photo Now</Button>
                </div>
            </div>
            <br/>
          </div>
      </div>

      {/* --- Video Recording Specific Settings --- */}
      <div style = {{display: (cameraMode === "video") ? "block" : "none"}}>
          {/* "Start/Stop Recording" button */}
          <div className="form-group row" style={{ marginTop: '15px' }}>
              <div className="col-sm-8 offset-sm-4">
                  <Button onClick={this.handleToggleVideoRecording} variant="secondary" disabled={!active || waiting || loading} >Start/Stop Video Recording</Button>
              </div>
          </div>
          <br/>
      </div>


      {/* --- MAVLink Integration --- */}
      <h3>MAVLink Integration</h3>
      <p><i>Configuration for advertising the camera and associated video stream via MAVLink. See <a href='https://mavlink.io/en/services/camera.html#video_streaming' target="_blank" rel="noopener noreferrer">MAVLink documentation</a> for details.</i></p>
      <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">Enable camera heartbeats</label>
          <div className="col-sm-8 pt-2">
              <Form.Check type="checkbox" disabled={active} checked={enableCameraHeartbeat} onChange={this.handleUseCameraHeartbeatChange} id="heartbeat-check" />
          </div>
      </div>
      {/* MAVLink Video Source IP (Only for RTSP streaming mode when heartbeat is enabled) */}
      <div style={{ display: (enableCameraHeartbeat && isStreamingMode && !UDPChecked) ? "block" : "none" }}>
        <div className="form-group row" style={{ marginBottom: '5px' } }>
            <label className="col-sm-4 col-form-label">Video Source IP (for MAVLink)</label>
            <div className="col-sm-8">
              {/* Assuming 'ifaces' state holds {label, value} objects */}
              <Select isDisabled={active} onChange={this.handleMavStreamChange} options={ifaces} value={mavStreamSelected} placeholder="Select Source IP..." />
            </div>
        </div>
      </div>
      <br/>

      {/* --- Main Start/Stop Button --- */}
      <div className="form-group row" style={{ marginBottom: '5px' }}>
          <div className="col-sm-8 offset-sm-4">
              <Button onClick={mainButtonAction} variant="primary" disabled={mainButtonDisabled}>
                  {waiting ? 'Processing...' : mainButtonText}
              </Button>
          </div>
          <br/>
      </div>

      {/* --- Connection Strings (Only for Active Streaming Mode) --- */}
      <div style={{ display: (active && isStreamingMode) ? "block" : "none"}}>
        <br />
        <h3>Connection strings for video stream</h3>
        {/* RTSP Strings */}
        <Accordion defaultActiveKey="0" style={{ display: !UDPChecked ? "block" : "none" }}>
          <Accordion.Item eventKey="0">
            <Accordion.Header>
              + RTSP Streaming Addresses (for VLC, etc)
            </Accordion.Header>
            <Accordion.Body>
              {streamAddresses.map((item, index) => (
                <p key={index} style={{ fontFamily: "monospace" }}>{item}</p>
              ))}
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="1">
            <Accordion.Header>
              + GStreamer Connection Strings (RTSP)
            </Accordion.Header>
            <Accordion.Body>
              {streamAddresses.map((item, index) => (
                <p key={index} style={{ fontFamily: "monospace" }}>gst-launch-1.0 rtspsrc location={item} latency=0 is-live=True ! queue ! decodebin ! autovideosink</p>
              ))}
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="2">
            <Accordion.Header>
              + Mission Planner Connection Strings (RTSP)
            </Accordion.Header>
            <Accordion.Body>
              {streamAddresses.map((item, index) => (
                <p key={index} style={{ fontFamily: "monospace" }}>rtspsrc location={item} latency=0 is-live=True ! queue ! application/x-rtp ! {compression.value === "H264" ? "rtph264depay" : "rtph265depay"} ! {compression.value === "H264" ? "avdec_h264" : "avdec_h265"} ! videoconvert ! video/x-raw,format=BGRA ! appsink name=outsink</p>
              ))}
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
         {/* RTP Strings */}
        <Accordion defaultActiveKey="0" style={{ display: UDPChecked ? "block" : "none" }}>
          <Accordion.Item eventKey="0">
            <Accordion.Header>
              + QGroundControl / GCS (RTP/UDP)
            </Accordion.Header>
            <Accordion.Body>
              <p style={{ fontFamily: "monospace" }}>Video Source: UDP {compression.value === "H264" ? "h.264" : "h.265"} Video Stream</p>
              <p style={{ fontFamily: "monospace" }}>UDP Port: {useUDPPort}</p>
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="1">
            <Accordion.Header>
              + GStreamer (RTP/UDP)
            </Accordion.Header>
            <Accordion.Body>
              <p style={{ fontFamily: "monospace" }}>gst-launch-1.0 udpsrc {multicastString}port={useUDPPort} caps=&apos;application/x-rtp, media=(string)video, clock-rate=(int)90000, encoding-name=(string){compression.value}&apos; ! rtpjitterbuffer ! {compression.value === "H264" ? "rtph264depay" : "rtph265depay"} ! {compression.value === "H264" ? "h264parse" : "h265parse"} ! {compression.value === "H264" ? "avdec_h264" : "avdec_h265"} ! videoconvert ! autovideosink sync=false</p>
            </Accordion.Body>
          </Accordion.Item>
           <Accordion.Item eventKey="2">
            <Accordion.Header>
              + Mission Planner (RTP/UDP)
            </Accordion.Header>
            <Accordion.Body>
              <p style={{ fontFamily: "monospace" }}>udpsrc {multicastString}port={useUDPPort} buffer-size=90000 ! application/x-rtp, media=(string)video, clock-rate=(int)90000, encoding-name=(string){compression.value} ! rtpjitterbuffer ! {compression.value === "H264" ? "rtph264depay" : "rtph265depay"} ! {compression.value === "H264" ? "h264parse" : "h265parse"} ! {compression.value === "H264" ? "avdec_h264" : "avdec_h265"} ! videoconvert ! video/x-raw,format=BGRA ! appsink name=outsink sync=false</p>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </div>
    </Form>
  );
}
}

export default VideoPage;