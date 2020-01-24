import React from 'react';
import Select from 'react-select';
import Collapsible from 'react-collapsible';

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
            loading: true
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
            <button onClick={this.handleStreaming}>{this.state.streamingStatus ? "Stop Streaming" : "Start Streaming"}</button>
            <div nameclass="streamdetails" style={{ display: (this.state.streamingStatus) ? "block" : "none"}}>
                <br/><h4>Connection strings for video stream</h4>
                <Collapsible transitionTime="200" trigger="RTSP Streaming Addresses (for VLC, etc)">
                    {this.state.streamAddresses.map((item, index) => (
                        <p style={{fontFamily: "monospace"}}>{item}</p>
                    ))}
                </Collapsible>
                <Collapsible transitionTime="200" trigger="GStreamer Connection Strings">
                    {this.state.streamAddresses.map((item, index) => (
                        <p style={{fontFamily: "monospace"}}>gst-launch-1.0 rtspsrc location={item} latency=0 ! queue ! decodebin ! autovideosink</p>
                    ))}
                </Collapsible>
                <Collapsible transitionTime="200" trigger="Mission Planner Connection Strings">
                    {this.state.streamAddresses.map((item, index) => (
                        <p style={{fontFamily: "monospace"}}>rtspsrc location={item} latency=0 ! queue ! application/x-rtp ! rtph264depay ! avdec_h264 ! videoconvert ! video/x-raw,format=BGRA ! appsink name=outsink</p>
                    ))}
                </Collapsible>
            </div>
        </div>
        );
    }
}


export default VideoPage;
