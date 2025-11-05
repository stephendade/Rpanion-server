import Button from 'react-bootstrap/Button';
import Accordion from 'react-bootstrap/Accordion';
import Form from 'react-bootstrap/Form';
import React from 'react'
import IPAddressInput from './components/IPAddressInput.jsx';

import basePage from './basePage.jsx';

import './css/styles.css';

class VideoPage extends basePage {
  constructor(props) {
    super(props);
    this.state = {
      ...this.state,
      ifaces: [],
      dev: [],
      vidDeviceSelected: this.props.vidDeviceSelected || '',
      vidres: [],
      vidResSelected: 0,
      streamingStatus: this.props.streamingStatus,
      streamAddresses: [],
      rotations: [{ label: "0°", value: 0 }, { label: "90°", value: 90 }, { label: "180°", value: 180 }, { label: "270°", value: 270 }],
      rotSelected: 0,
      bitrate: 1000,
      transportSelected: "RTSP",
      transportOptions: [{ label: "RTP", value: "RTP" }, { label: "RTSP", value: "RTSP" }],
      useUDPIP: "127.0.0.1",
      useUDPPort: 5600,
      FPSMax: 0,
      fps: [],
      fpsSelected: 1,
      timestamp: false,
      enableCameraHeartbeat: false,
      mavStreamSelected: this.props.mavStreamSelected || '',
      multicastString: " ",
      compression: 'H264',
      compressionOptions: [{ value: 'H264', label: 'H.264' }, { value: 'H265', label: 'H.265' }],
      customRTSPSource: this.props.customRTSPSource || ''
    }
  }

  componentDidMount() {
    fetch(`/api/videodevices`, {headers: {Authorization: `Bearer ${this.state.token}`}}).then(response => response.json()).then(state => { 
      this.setState(state); 
      this.isMulticastUpdateIP(state.useUDPIP); 
      this.loadDone() 
    });
  }

  handleVideoChange = (event) => {
    //new video device
    const value = event.target.value;
    const device = this.state.dev.find(d => d.value === value);
    
    if (device) {
      this.setState({ 
        vidDeviceSelected: value, 
        vidres: device.caps,
        vidResSelected: 0
      });
      
      if (this.state.streamingStatus !== true && device.caps.length > 0) {
        this.handleResChange({ target: { value: 0 } }, device.caps);
      }
    }
  }

  handleResChange = (event, capsOverride) => {
    //resolution box new selected value
    const caps = capsOverride || this.state.vidres;
    const index = parseInt(event.target.value);
    const value = caps[index];
    
    if (!value) return;
    
    if (value.fpsmax !== 0) {
      this.setState({ 
        vidResSelected: index, 
        FPSMax: value.fpsmax, 
        fpsSelected: Math.min(value.fpsmax, 10), 
        fps: value.fps 
      });
    } else {
      this.setState({ 
        vidResSelected: index, 
        FPSMax: value.fpsmax, 
        fpsSelected: 0,
        fps: value.fps 
      });
    }
    
    //override if a h264 format is selected
    if (value.format === "video/x-h264") {
      this.setState({ compression: 'H264' });
    }
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
    const index = parseInt(event.target.value);
    const value = this.state.fps[index];
    this.setState({ fpsSelected: typeof value === 'object' ? value.value : value });
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

  handleRTSPSourceChange = (event) => {
    this.setState({ customRTSPSource: event.target.value });
  }

  isrtspSourceSelected() {
    return this.state.vidDeviceSelected === "rtspsourceh264" || this.state.vidDeviceSelected === "rtspsourceh265";
  }

  getSelectedResolution() {
    if (typeof this.state.vidResSelected === 'number' && this.state.vidres[this.state.vidResSelected]) {
      return this.state.vidres[this.state.vidResSelected];
    }
    return this.state.vidres[0] || {};
  }

  handleStreaming = () => {
    //user clicked start/stop streaming
    const selectedRes = this.getSelectedResolution();
    
    this.setState({ waiting: true }, () => {
      fetch('/api/startstopvideo', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.state.token}`
        },
        body: JSON.stringify({
          active: !this.state.streamingStatus,
          device: this.state.vidDeviceSelected,
          height: selectedRes.height || 0,
          width: selectedRes.width || 0,
          format: selectedRes.format || '',
          rotation: this.state.rotSelected,
          fps: this.state.FPSMax !== 0 ? this.state.fpsSelected : (typeof this.state.fpsSelected === 'object' ? this.state.fpsSelected : this.state.fpsSelected),
          bitrate: this.state.bitrate,
          transport: this.state.transportSelected,
          useUDPIP: this.state.useUDPIP,
          useUDPPort: this.state.useUDPPort,
          useTimestamp: this.state.timestamp,
          useCameraHeartbeat: this.state.enableCameraHeartbeat,
          mavStreamSelected: this.state.mavStreamSelected,
          compression: this.state.compression,
          customRTSPSource: this.state.customRTSPSource
        })
      }).then(response => response.json()).then(state => { 
        this.setState(state); 
        this.setState({ waiting: false }) 
      });
    });
  }

  renderTitle() {
    return "Video Streaming";
  }

  renderContent() {
    const selectedRes = this.getSelectedResolution();
    
    return (
      <Form style={{ width: 600 }}>
        <p><i>Stream live video from any connected camera devices. Only 1 camera can be streamed at a time. Multicast IP addresses are supported in RTP mode.</i></p>
        <Accordion defaultActiveKey="0">
          <Accordion.Item eventKey="0">
            <Accordion.Header>Configuration</Accordion.Header>
            <Accordion.Body>
              <div className="form-group row" style={{ marginBottom: '5px' }}>
                <label className="col-sm-4 col-form-label">Streaming Mode</label>
                <div className="col-sm-8">
                  <Form.Select
                    disabled={this.state.streamingStatus}
                    value={this.state.transportSelected}
                    onChange={(e) => this.setState({ transportSelected: e.target.value })}
                  >
                    {this.state.transportOptions.map((option, idx) => (
                      <option key={idx} value={option.value}>{option.label}</option>
                    ))}
                  </Form.Select>
                </div>
              </div>

              <div className="form-group row" style={{ marginBottom: '5px' }}>
                <label className="col-sm-4 col-form-label">Device</label>
                <div className="col-sm-8">
                  <Form.Select 
                    disabled={this.state.streamingStatus} 
                    onChange={this.handleVideoChange} 
                    value={this.state.vidDeviceSelected}
                  >
                    <option value="">Select a device...</option>
                    {this.state.dev.map((device, idx) => (
                      <option key={idx} value={device.value}>{device.label}</option>
                    ))}
                  </Form.Select>
                </div>
              </div>

              <div style={{ display: this.isrtspSourceSelected() ? "block" : "none" }}>
                <div className="form-group row" style={{ marginBottom: '5px' }}>
                  <label className="col-sm-4 col-form-label">RTSP Source URL</label>
                  <div className="col-sm-8">
                    <Form.Control 
                      type="text" 
                      name="rtspsource" 
                      disabled={this.state.streamingStatus} 
                      value={this.state.customRTSPSource} 
                      onChange={this.handleRTSPSourceChange} 
                      placeholder="e.g. rtsp://username:password@url:port/stream" 
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: this.isrtspSourceSelected() ? "none" : "block" }}>
                <div className="form-group row" style={{ marginBottom: '5px' }}>
                  <label className="col-sm-4 col-form-label">Resolution</label>
                  <div className="col-sm-8">
                    <Form.Select 
                      disabled={this.state.streamingStatus} 
                      onChange={this.handleResChange} 
                      value={this.state.vidResSelected}
                    >
                      {this.state.vidres.map((res, idx) => (
                        <option key={idx} value={idx}>{res.label}</option>
                      ))}
                    </Form.Select>
                  </div>
                </div>
              </div>

              <div style={{ display: (selectedRes && selectedRes.format !== "video/x-h264" && !this.isrtspSourceSelected()) ? "block" : "none" }}>
                <div className="form-group row" style={{ marginBottom: '5px' }}>
                  <label className="col-sm-4 col-form-label">Rotation</label>
                  <div className="col-sm-8">
                    <Form.Select 
                      disabled={this.state.streamingStatus} 
                      onChange={this.handleRotChange} 
                      value={this.state.rotSelected}
                    >
                      {this.state.rotations.map((rot, idx) => (
                        <option key={idx} value={rot.value}>{rot.label}</option>
                      ))}
                    </Form.Select>
                  </div>
                </div>

                <div className="form-group row" style={{ marginBottom: '5px' }}>
                  <label className="col-sm-4 col-form-label">Maximum Bitrate</label>
                  <div className="col-sm-8">
                    <Form.Control 
                      disabled={this.state.streamingStatus} 
                      type="number" 
                      name="bitrate" 
                      min="50" 
                      max="50000" 
                      step="10" 
                      onChange={this.handleBitrateChange} 
                      value={this.state.bitrate} 
                    /> kbps
                  </div>
                </div>

                <div className="form-group row" style={{ marginBottom: '5px' }}>
                  <label className="col-sm-4 col-form-label">Timestamp Overlay</label>
                  <div className="col-sm-8">
                    <Form.Check 
                      type="checkbox" 
                      disabled={this.state.streamingStatus} 
                      onChange={this.handleTimestampChange} 
                      checked={this.state.timestamp} 
                    />
                  </div>
                </div>

                <div className="form-group row" style={{ marginBottom: '5px' }}>
                  <label className="col-sm-4 col-form-label">Compression</label>
                  <div className="col-sm-8">
                    <Form.Select
                      disabled={this.state.streamingStatus}
                      value={this.state.compression}
                      onChange={(e) => this.setState({ compression: e.target.value })}
                    >
                      {this.state.compressionOptions.map((option, idx) => (
                        <option key={idx} value={option.value}>{option.label}</option>
                      ))}
                    </Form.Select>
                  </div>
                </div>
              </div>

              <div style={{ display: this.isrtspSourceSelected() ? "none" : "block" }}>
                <div className="form-group row" style={{ marginBottom: '5px' }}>
                  <label className="col-sm-4 col-form-label">Framerate</label>
                  <div className="col-sm-8" style={{ display: (this.state.FPSMax === 0) ? "block" : "none" }}>
                    <Form.Select 
                      disabled={this.state.streamingStatus} 
                      value={this.state.fps.findIndex(f => (typeof f === 'object' ? f.value : f) === this.state.fpsSelected)} 
                      onChange={this.handleFPSChangeSelect}
                    >
                      {this.state.fps.map((f, idx) => (
                        <option key={idx} value={idx}>{typeof f === 'object' ? f.label : f}</option>
                      ))}
                    </Form.Select>
                  </div>
                  <div className="col-sm-8" style={{ display: (this.state.FPSMax !== 0) ? "block" : "none" }}>
                    <Form.Control 
                      disabled={this.state.streamingStatus} 
                      type="number" 
                      name="fps" 
                      min="1" 
                      max={this.state.FPSMax} 
                      step="1" 
                      onChange={this.handleFPSChange} 
                      value={this.state.fpsSelected} 
                    /> fps (max: {this.state.FPSMax})
                  </div>
                </div>
              </div>

              <div style={{ display: (this.state.transportSelected === 'RTP') ? "block" : "none" }}>
                <div className="form-group row" style={{ marginBottom: '5px' }}>
                  <label className="col-sm-4 col-form-label ">Destination IP</label>
                  <div className="col-sm-7">
                    <IPAddressInput
                      name="ipaddress"
                      value={this.state.useUDPIP || ''}
                      onChange={this.handleUDPIPChange}
                      disabled={!(this.state.transportSelected === 'RTP') || this.state.streamingStatus}
                    />
                  </div>
                </div>
                <div className="form-group row" style={{ marginBottom: '5px' }}>
                  <label className="col-sm-4 col-form-label">Destination Port</label>
                  <div className="col-sm-8">
                    <Form.Control 
                      type="text" 
                      name="port" 
                      disabled={!(this.state.transportSelected === 'RTP') || this.state.streamingStatus} 
                      value={this.state.useUDPPort} 
                      onChange={this.handleUDPPortChange} 
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
                    disabled={this.state.streamingStatus} 
                    checked={this.state.enableCameraHeartbeat} 
                    onChange={this.handleUseCameraHeartbeatChange} 
                  />
                </div>
              </div>
              <div style={{ display: (this.state.enableCameraHeartbeat && (!(this.state.transportSelected === 'RTP'))) ? "block" : "none" }}>
                <div className="form-group row" style={{ marginBottom: '5px' }}>
                  <label className="col-sm-4 col-form-label">Video source IP Address</label>
                  <div className="col-sm-8">
                    <Form.Select 
                      disabled={this.state.streamingStatus} 
                      onChange={this.handleMavStreamChange} 
                      value={this.state.mavStreamSelected}
                    >
                      <option value="">Select interface...</option>
                      {this.state.ifaces.map((iface, idx) => (
                        <option key={idx} value={iface}>{iface}</option>
                      ))}
                    </Form.Select>
                  </div>
                </div>
              </div>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>

        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <div className="col-sm-8">
            <Button onClick={this.handleStreaming} className="btn btn-primary">
              {this.state.streamingStatus ? "Stop Streaming" : "Start Streaming"}
            </Button>
          </div>
          <br/>
        </div>

        <br />
        <h3 style={{ display: (this.state.streamingStatus) ? "block" : "none" }}>Connection strings for video stream</h3>
        <Accordion defaultActiveKey="0" style={{ display: (this.state.streamingStatus && !(this.state.transportSelected === 'RTP')) ? "block" : "none" }}>
          <Accordion.Item eventKey="0">
            <Accordion.Header>
              + RTSP Streaming Addresses (for VLC, etc)
            </Accordion.Header>
            <Accordion.Body>
              {this.state.streamAddresses.map((item, index) => (
                <p key={index} style={{ fontFamily: "monospace" }}>{item}</p>
              ))}
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="1">
            <Accordion.Header>
              + GStreamer Connection Strings
            </Accordion.Header>
            <Accordion.Body>
              {this.state.streamAddresses.map((item, index) => (
                <p key={index} style={{ fontFamily: "monospace" }}>gst-launch-1.0 rtspsrc location={item} latency=0 is-live=True ! queue ! decodebin ! autovideosink</p>
              ))}
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="2">
            <Accordion.Header>
              + Mission Planner Connection Strings
            </Accordion.Header>
            <Accordion.Body>
              {this.state.streamAddresses.map((item, index) => (
                <p key={index} style={{ fontFamily: "monospace" }}>rtspsrc location={item} latency=0 is-live=True ! queue ! application/x-rtp ! {this.state.compression === "H264" ? "rtph264depay" : "rtph265depay"} ! {this.state.compression === "H264" ? "avdec_h264" : "avdec_h265"} ! videoconvert ! video/x-raw,format=BGRA ! appsink name=outsink</p>
              ))}
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
        <Accordion defaultActiveKey="0" style={{ display: (this.state.streamingStatus && (this.state.transportSelected === 'RTP')) ? "block" : "none" }}>
          <Accordion.Item eventKey="0">
            <Accordion.Header>
              + QGroundControl
            </Accordion.Header>
            <Accordion.Body>
              <p style={{ fontFamily: "monospace" }}>Video Source: UDP {this.state.compression === "H264" ? "h.264" : "h.265"} Video Stream</p>
              <p style={{ fontFamily: "monospace" }}>Port: {this.state.useUDPPort}</p>
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="1">
            <Accordion.Header>
              + GStreamer
            </Accordion.Header>
            <Accordion.Body>
              <p style={{ fontFamily: "monospace" }}>gst-launch-1.0 udpsrc {this.state.multicastString}port={this.state.useUDPPort} caps=&apos;application/x-rtp, media=(string)video, clock-rate=(int)90000, encoding-name=(string){this.state.compression === "H264" ? "H264" : "H265"}&apos; ! rtpjitterbuffer ! {this.state.compression === "H264" ? "rtph264depay" : "rtph265depay"} ! {this.state.compression === "H264" ? "h264parse" : "h265parse"} ! {this.state.compression === "H264" ? "avdec_h264" : "avdec_h265"} ! videoconvert ! autovideosink sync=false</p>
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="2">
            <Accordion.Header>
              + Mission Planner Connection Strings
            </Accordion.Header>
            <Accordion.Body>
              <p style={{ fontFamily: "monospace" }}>udpsrc {this.state.multicastString}port={this.state.useUDPPort} buffer-size=90000 ! application/x-rtp ! rtpjitterbuffer ! {this.state.compression === "H264" ? "rtph264depay" : "rtph265depay"} ! {this.state.compression === "H264" ? "h264parse" : "h265parse"} ! {this.state.compression === "H264" ? "avdec_h264" : "avdec_h265"} ! videoconvert ! video/x-raw,format=BGRA ! appsink name=outsink sync=false</p>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </Form>
    );
  }
}


export default VideoPage;
