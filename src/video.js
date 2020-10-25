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
            loading: true,
            error: null,
            infoMessage: null
        }
    }

    componentDidMount() {
        fetch(`/api/videodevices`).then(response => response.json()).then(state => {this.setState(state); this.loadDone()});
     }

    handleVideoChange = (value, action) => {
        //new video device
        this.setState({vidDeviceSelected: value, vidres: value.caps});
        this.handleResChange(value.caps[0], "");
    }

    handleResChange = (value, action) => {
        //resolution box new selected value
        this.setState({vidResSelected: value});
    }

    handleRotChange = (value, action) => {
        //resolution box new selected value
        this.setState({rotSelected: value});
    }

    handleBitrateChange = (event) => {
        //bitrate spinner new value
        this.setState({bitrate: event.target.value});
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
                    bitrate: this.state.bitrate
                 })
            }).then(response => response.json()).then(state => {this.setState(state); this.setState({waiting: false})});
        });
    }

    renderTitle() {
        return "Video Streaming";
    }

    renderContent() {
        return (
        <div>
            Device: <Select isDisabled={this.state.streamingStatus} onChange={this.handleVideoChange} options={this.state.dev} value={this.state.vidDeviceSelected}/>
            Resolution: <Select isDisabled={this.state.streamingStatus} options={this.state.vidres} onChange={this.handleResChange} value={this.state.vidResSelected}/>
            Rotation: <Select isDisabled={this.state.streamingStatus} options={this.state.rotations} onChange={this.handleRotChange} value={this.state.rotSelected}/>
            Average Bitrate: <input type="number" name="bitrate" min="100" max="10000" step="100" onChange={this.handleBitrateChange} value={this.state.bitrate} />kbps<br />
            <Button size="sm" onClick={this.handleStreaming}>{this.state.streamingStatus ? "Stop Streaming" : "Start Streaming"}</Button>{' '}
            <br/>
            <h4 style={{ display: (this.state.streamingStatus) ? "block" : "none"}}>Connection strings for video stream</h4>
            <Accordion defaultActiveKey="0" style={{ display: (this.state.streamingStatus) ? "block" : "none"}}>
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
        </div>
        );
    }
}


export default VideoPage;
