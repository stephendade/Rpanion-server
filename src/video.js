import Select from 'react-select';
import Button from 'react-bootstrap/Button';
import Accordion from 'react-bootstrap/Accordion';
import Form from 'react-bootstrap/Form';

import basePage from './basePage.js';

import './css/styles.css';

class VideoPage extends basePage {
  constructor(props) {
    super(props);
    this.state = {
      ifaces: [],
      dev: [],
      vidDeviceSelected: this.props.vidDeviceSelected,
      vidres: [],
      vidResSelected: this.props.vidResSelected,
      streamingStatus: this.props.streamingStatus,
      streamAddresses: [],
      rotations: [{ label: "0°", value: 0 }, { label: "90°", value: 90 }, { label: "180°", value: 180 }, { label: "270°", value: 270 }],
      rotSelected: { label: "0°", value: 0 },
      bitrate: 1000,
      UDPChecked: false,
      useUDPIP: "127.0.0.1",
      useUDPPort: 5600,
      FPSMax: 0,
      fps: [],
      fpsSelected: 1,
      loading: true,
      error: null,
      infoMessage: null,
      timestamp: false,
      enableCameraHeartbeat: false,
      mavStreamSelected: this.props.mavStreamSelected,
      multicastString: " "
    }
  }

  componentDidMount() {
    fetch(`/api/videodevices`).then(response => response.json()).then(state => { this.setState(state); this.isMulticastUpdateIP(state.useUDPIP); this.loadDone() });
  }

  handleVideoChange = (value) => {
    //new video device
    this.setState({ vidDeviceSelected: value, vidres: value.caps });
    this.handleResChange(this.state.streamingStatus !== true ? value.caps[0] : this.state.vidResSelected, "");
  }

  handleResChange = (value) => {
    //resolution box new selected value
    if (value.fpsmax !== 0) {
      this.setState({ vidResSelected: value, FPSMax: value.fpsmax, fpsSelected: Math.min(value.fpsmax, 10), fps: value.fps });
    }
    else {
      this.setState({ vidResSelected: value, FPSMax: value.fpsmax, fpsSelected: value.fps[0], fps: value.fps });
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

  handleUseUDPChange = (event) => {
    //bitrate spinner new value
    this.setState({ UDPChecked: event.target.value==="rtp" });
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
    this.setState({ useUDPIP: event.target.value,});
  }

  handleUDPPortChange = (event) => {
    //bitrate spinner new value
    this.setState({ useUDPPort: event.target.value });
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

  handleUseCameraHeartbeatChange = () => {
    // Toggle camera heartbeat events
    this.setState({ enableCameraHeartbeat: !this.state.enableCameraHeartbeat });
  }

  handleMavStreamChange = (value) => {
    //new value for selected stream IP
    this.setState({ mavStreamSelected: value });
  }

  handleStreaming = () => {
    //user clicked start/stop streaming
    this.setState({ waiting: true }, () => {
      fetch('/api/startstopvideo', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          active: !this.state.streamingStatus,
          device: this.state.vidDeviceSelected.value,
          height: this.state.vidResSelected.height,
          width: this.state.vidResSelected.width,
          format: this.state.vidResSelected.format,
          rotation: this.state.rotSelected.value,
          fps: this.state.FPSMax !== 0 ? this.state.fpsSelected : Number(this.state.fpsSelected.value),
          //fps: this.state.fpsSelected,
          bitrate: this.state.bitrate,
          useUDP: this.state.UDPChecked,
          useUDPIP: this.state.useUDPIP,
          useUDPPort: this.state.useUDPPort,
          useTimestamp: this.state.timestamp,
          useCameraHeartbeat: this.state.enableCameraHeartbeat,
          mavStreamSelected: this.state.mavStreamSelected.value,
        })
      }).then(response => response.json()).then(state => { this.setState(state); this.setState({ waiting: false }) });
    });
  }

  renderTitle() {
    return "Video Streaming";
  }

  renderContent() {
    return (
      <Form style={{ width: 600 }}>
        <p><i>Stream live video from any connected camera devices. Only 1 camera can be streamed at a time. Multicast IP addresses are supported in RTP mode.</i></p>
        <h2>Configuration</h2>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Streaming Mode</label>
              <div className="col-sm-8">
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="streamtype" value="rtp" disabled={this.state.streamingStatus} onChange={this.handleUseUDPChange} checked={this.state.UDPChecked} />
                  <label className="form-check-label">RTP (stream to single client)</label>
                </div>
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="streamtype" value="rtsp" disabled={this.state.streamingStatus} onChange={this.handleUseUDPChange} checked={!this.state.UDPChecked} />
                  <label className="form-check-label">RTSP (multiple clients can connect to stream)</label>
                </div>
              </div>
            </div>

        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">Device</label>
          <div className="col-sm-8">
            <Select isDisabled={this.state.streamingStatus} onChange={this.handleVideoChange} options={this.state.dev} value={this.state.vidDeviceSelected} />
          </div>
        </div>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">Resolution</label>
          <div className="col-sm-8">
            <Select isDisabled={this.state.streamingStatus} options={this.state.vidres} onChange={this.handleResChange} value={this.state.vidResSelected} />
          </div>
        </div>
        <div style={{ display: (typeof this.state.vidResSelected !== 'undefined' && this.state.vidResSelected.format !== "video/x-h264") ? "block" : "none" }}>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-4 col-form-label">Rotation</label>
            <div className="col-sm-8">
              <Select isDisabled={this.state.streamingStatus} options={this.state.rotations} onChange={this.handleRotChange} value={this.state.rotSelected} />
            </div>
          </div>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-4 col-form-label">Maximum Bitrate</label>
            <div className="col-sm-8">
              <input disabled={this.state.streamingStatus} type="number" name="bitrate" min="50" max="50000" step="10" onChange={this.handleBitrateChange} value={this.state.bitrate} />kbps
            </div>
          </div>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">Timestamp Overlay</label>
          <div className="col-sm-8">
            <input type="checkbox" disabled={this.state.streamingStatus} onChange={this.handleTimestampChange} checked={this.state.timestamp} />
          </div>
          </div>
        </div>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">Framerate</label>
          <div className="col-sm-8" style={{ display: (this.state.FPSMax === 0) ? "block" : "none" }}>
            <Select isDisabled={this.state.streamingStatus} options={this.state.fps} value={this.state.fpsSelected} onChange={this.handleFPSChangeSelect} />
          </div>
          <div className="col-sm-8" style={{ display: (this.state.FPSMax !== 0) ? "block" : "none" }}>
            <input disabled={this.state.streamingStatus} type="number" name="fps" min="1" max={this.state.FPSMax} step="1" onChange={this.handleFPSChange} value={this.state.fpsSelected} />fps (max: {this.state.FPSMax})
          </div>
        </div>
        <div style={{ display: (this.state.UDPChecked) ? "block" : "none" }}>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-4 col-form-label ">Destination IP</label>
            <div className="col-sm-8">
              <input type="text" name="ipaddress" disabled={!this.state.UDPChecked || this.state.streamingStatus} value={this.state.useUDPIP} onChange={this.handleUDPIPChange} />
            </div>
          </div>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-4 col-form-label">Destination Port</label>
            <div className="col-sm-8">
              <input type="text" name="port" disabled={!this.state.UDPChecked || this.state.streamingStatus} value={this.state.useUDPPort} onChange={this.handleUDPPortChange} />
            </div>
          </div>
        </div>
        <br/>
        <h3>MAVLink Video Streaming Service</h3>
        <p><i>Configuration for advertising the camera and associated video stream via MAVLink. See <a href='https://mavlink.io/en/services/camera.html#video_streaming'>here</a> for details.</i></p>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">Enable camera heartbeats</label>
          <div className="col-sm-7">
          <input type="checkbox" disabled={this.state.streamingStatus} checked={this.state.enableCameraHeartbeat} onChange={this.handleUseCameraHeartbeatChange} />
          </div>
        </div>
        <div style={{ display: (this.state.enableCameraHeartbeat && (!this.state.UDPChecked)) ? "block" : "none" }}>
          <div className="form-group row" style={{ marginBottom: '5px' } }>
              <label className="col-sm-4 col-form-label">Video source IP Address</label>
              <div className="col-sm-8">
                <Select isDisabled={this.state.streamingStatus} onChange={this.handleMavStreamChange} options={this.state.ifaces.map((item) => ({ value: item, label: item}))} value={this.state.mavStreamSelected} />
              </div>
          </div>
        </div>
        <br/>

        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <div className="col-sm-8">
            <Button onClick={this.handleStreaming} className="btn btn-primary">{this.state.streamingStatus ? "Stop Streaming" : "Start Streaming"}</Button>
          </div>
          <br/>
        </div>

        <br />
        <h3 style={{ display: (this.state.streamingStatus) ? "block" : "none" }}>Connection strings for video stream</h3>
        <Accordion defaultActiveKey="0" style={{ display: (this.state.streamingStatus && !this.state.UDPChecked) ? "block" : "none" }}>
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
                <p key={index} style={{ fontFamily: "monospace" }}>rtspsrc location={item} latency=0 is-live=True ! queue ! application/x-rtp ! rtph264depay ! avdec_h264 ! videoconvert ! video/x-raw,format=BGRA ! appsink name=outsink</p>
              ))}
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
        <Accordion defaultActiveKey="0" style={{ display: (this.state.streamingStatus && this.state.UDPChecked) ? "block" : "none" }}>
          <Accordion.Item eventKey="0">
            <Accordion.Header>
              + QGroundControl
            </Accordion.Header>
            <Accordion.Body>
              <p style={{ fontFamily: "monospace" }}>Video Source: UDP h.264 Video Stream</p>
              <p style={{ fontFamily: "monospace" }}>Port: {this.state.useUDPPort}</p>
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="1">
            <Accordion.Header>
              + GStreamer
            </Accordion.Header>
            <Accordion.Body>
              <p style={{ fontFamily: "monospace" }}>gst-launch-1.0 udpsrc {this.state.multicastString}port={this.state.useUDPPort} caps=&apos;application/x-rtp, media=(string)video, clock-rate=(int)90000, encoding-name=(string)H264&apos; ! rtpjitterbuffer ! rtph264depay ! h264parse ! avdec_h264 ! videoconvert ! autovideosink sync=false</p>
            </Accordion.Body>
          </Accordion.Item>
          <Accordion.Item eventKey="2">
            <Accordion.Header>
              + Mission Planner Connection Strings
            </Accordion.Header>
            <Accordion.Body>
              <p style={{ fontFamily: "monospace" }}>udpsrc {this.state.multicastString}port={this.state.useUDPPort} buffer-size=90000 ! application/x-rtp ! rtpjitterbuffer ! rtph264depay ! h264parse ! avdec_h264 ! videoconvert ! video/x-raw,format=BGRA ! appsink name=outsink sync=false</p>
            </Accordion.Body>
          </Accordion.Item>
        </Accordion>
      </Form>
    );
  }
}


export default VideoPage;
