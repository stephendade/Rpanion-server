import React from 'react';
import Select from 'react-select';
import Button from 'react-bootstrap/Button';
import Accordion from 'react-bootstrap/Accordion';
import Card from  'react-bootstrap/Card';

import basePage from './basePage.js';

import './css/styles.css';

class VideoPage extends basePage {
    constructor(props) {
        super(props);
        this.state = {
            errors: "",
            dev: [],
            vidDeviceSelected: this.props.vidDeviceSelected,
            vidres: [],
            vidResSelected: this.props.vidResSelected,
            streamingStatus: this.props.streamingStatus,
            streamAddresses: [],
            rotations: [{label:"0°", value:0}, {label:"90°", value:90}, {label:"180°", value:180}, {label:"270°", value:270}],
            rotSelected: {label:"0°", value:0},
            bitrate: 1000,
            UDPChecked: false,
            useUDPIP: "127.0.0.1",
            useUDPPort: 5600,
            FPSMax: 0,
            fps: [],
            fpsSelected: 1,
            loading: true,
            error: null,
            infoMessage: null
        }
    }

    componentDidMount() {
        fetch(`/api/videodevices`).then(response => response.json()).then(state => {this.setState(state); this.loadDone(); this.handleVideoChange(this.state.vidDeviceSelected, "")});
     }

    handleVideoChange = (value, action) => {
        //new video device
        this.setState({vidDeviceSelected: value, vidres: value.caps});
        this.handleResChange(value.caps[0], "");
    }

    handleResChange = (value, action) => {
        //resolution box new selected value
        if (value.fpsmax !== 0) {
          this.setState({vidResSelected: value, FPSMax: value.fpsmax, fpsSelected: value.fpsmax, fps: value.fps});
        }
        else {
          this.setState({vidResSelected: value, FPSMax: value.fpsmax, fpsSelected: value.fps[0], fps: value.fps});
        }
    }

    handleRotChange = (value, action) => {
        //resolution box new selected value
        this.setState({rotSelected: value});
    }

    handleBitrateChange = (event) => {
        //bitrate spinner new value
        this.setState({bitrate: event.target.value});
    }

    handleUseUDPChange = (event) => {
        //bitrate spinner new value
        this.setState({UDPChecked: event.target.checked});
    }

    handleUDPIPChange = (event) => {
        //bitrate spinner new value
        this.setState({useUDPIP: event.target.value});
    }

    handleUDPPortChange = (event) => {
        //bitrate spinner new value
        this.setState({useUDPPort: event.target.value});
    }

    handleFPSChange = (event) => {
        //bitrate spinner new value
        this.setState({fpsSelected: event.target.value});
    }

    handleFPSChangeSelect = (value, action) => {
        //resolution box new selected value
        this.setState({fpsSelected: value});
    }

    handleStreaming = (event) => {
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
                    useUDPPort: this.state.useUDPPort
                 })
            }).then(response => response.json()).then(state => {this.setState(state); this.setState({waiting: false})});
        });
    }

    renderTitle() {
        return "Video Streaming";
    }

    renderContent() {
        return (
        <div style={{width: 500}}>
            Device: <Select isDisabled={this.state.streamingStatus} onChange={this.handleVideoChange} options={this.state.dev} value={this.state.vidDeviceSelected}/>
            Resolution: <Select isDisabled={this.state.streamingStatus} options={this.state.vidres} onChange={this.handleResChange} value={this.state.vidResSelected}/>
            Rotation: <Select isDisabled={this.state.streamingStatus} options={this.state.rotations} onChange={this.handleRotChange} value={this.state.rotSelected}/>
            Average Bitrate: <input disabled={this.state.streamingStatus} type="number" name="bitrate" min="100" max="10000" step="100" onChange={this.handleBitrateChange} value={this.state.bitrate} />kbps<br />
            <div style={{ display: (this.state.FPSMax === 0) ? "block" : "none"}}>
              Frame rate: <Select isDisabled={this.state.streamingStatus} options={this.state.fps} value={this.state.fpsSelected} onChange={this.handleFPSChangeSelect}/><br />
            </div>
            <div style={{ display: (this.state.FPSMax !== 0) ? "inherit" : "none"}}>
              Frame rate: <input disabled={this.state.streamingStatus} type="number" name="fps" min="1" max={this.state.FPSMax} step="1" onChange={this.handleFPSChange} value={this.state.fpsSelected} />fps (max: {this.state.FPSMax})<br />
            </div>
            <input type="checkbox" checked={this.state.UDPChecked} disabled={this.state.streamingStatus} onChange={this.handleUseUDPChange}/>Use UDP Stream instead of RTSP Server (Used for QGroundControl)<br />
            <label><input type="text" name="ipaddress" disabled={!this.state.UDPChecked || this.state.streamingStatus} value={this.state.useUDPIP} onChange={this.handleUDPIPChange}/>Destination IP Address</label><br />
            <label><input type="text" name="port" disabled={!this.state.UDPChecked || this.state.streamingStatus} value={this.state.useUDPPort} onChange={this.handleUDPPortChange}/>Destination Port</label><br />
            <Button size="sm" onClick={this.handleStreaming}>{this.state.streamingStatus ? "Stop Streaming" : "Start Streaming"}</Button>{' '}
            <br/>
            <h4 style={{ display: (this.state.streamingStatus) ? "block" : "none"}}>Connection strings for video stream</h4>
            <Accordion defaultActiveKey="0" style={{ display: (this.state.streamingStatus && !this.state.UDPChecked) ? "block" : "none"}}>
              <Card>
                <Accordion.Toggle as={Card.Header} eventKey="0">
                  + RTSP Streaming Addresses (for VLC, etc)
                </Accordion.Toggle>
                <Accordion.Collapse eventKey="0">
                  <Card.Body>
                    {this.state.streamAddresses.map((item, index) => (
                        <p style={{fontFamily: "monospace"}}>{item}</p>
                    ))}
                  </Card.Body>
                </Accordion.Collapse>
              </Card>
              <Card>
                <Accordion.Toggle as={Card.Header} eventKey="1">
                  + GStreamer Connection Strings
                </Accordion.Toggle>
                <Accordion.Collapse eventKey="1">
                  <Card.Body>
                    {this.state.streamAddresses.map((item, index) => (
                        <p style={{fontFamily: "monospace"}}>gst-launch-1.0 rtspsrc location={item} latency=0 ! queue ! decodebin ! autovideosink</p>
                    ))}
                  </Card.Body>
                </Accordion.Collapse>
              </Card>
              <Card>
                <Accordion.Toggle as={Card.Header} eventKey="2">
                  + Mission Planner Connection Strings
                </Accordion.Toggle>
                <Accordion.Collapse eventKey="2">
                  <Card.Body>
                    {this.state.streamAddresses.map((item, index) => (
                        <p style={{fontFamily: "monospace"}}>rtspsrc location={item} latency=0 ! queue ! application/x-rtp ! rtph264depay ! avdec_h264 ! videoconvert ! video/x-raw,format=BGRA ! appsink name=outsink</p>
                    ))}
                  </Card.Body>
                </Accordion.Collapse>
              </Card>
            </Accordion>
            <Accordion defaultActiveKey="0" style={{ display: (this.state.streamingStatus && this.state.UDPChecked) ? "block" : "none"}}>
              <Card>
                <Accordion.Toggle as={Card.Header} eventKey="0">
                  + QGroundControl
                </Accordion.Toggle>
                <Accordion.Collapse eventKey="0">
                  <Card.Body>
                        <p style={{fontFamily: "monospace"}}>Video Source: UDP h.264 Video Stream</p>
                        <p style={{fontFamily: "monospace"}}>Port: {this.state.useUDPPort}</p>
                  </Card.Body>
                </Accordion.Collapse>
              </Card>
              <Card>
                <Accordion.Toggle as={Card.Header} eventKey="1">
                  + GStreamer
                </Accordion.Toggle>
                <Accordion.Collapse eventKey="1">
                  <Card.Body>
                        <p style={{fontFamily: "monospace"}}>gst-launch-1.0 udpsrc port={this.state.useUDPPort} caps='application/x-rtp, media=(string)video, clock-rate=(int)90000, encoding-name=(string)H264' ! rtpjitterbuffer ! rtph264depay ! h264parse ! avdec_h264 ! autovideosink fps-update-interval=1000 sync=false</p>
                  </Card.Body>
                </Accordion.Collapse>
              </Card>
            </Accordion>
        </div>
        );
    }
}


export default VideoPage;
