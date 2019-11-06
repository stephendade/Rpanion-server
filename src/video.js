import React, { Component } from 'react';
import { Helmet } from 'react-helmet'
import Select from 'react-select';

class VideoPage extends Component {
    constructor(props) {
        super(props);
        this.state = {
            errors: "",
            dev: [],
            vidDeviceSelected: this.props.vidDeviceSelected,
            vidres: [],
            vidResSelected: this.props.vidResSelected,
            selectFramerates: [],
            framerateSelected: this.props.framerateSelected,
            streamingStatus: this.props.streamingStatus,
            streamAddresses: []
        }

        //this.handleRateChange = this.handleRateChange.bind(this);
    }

    componentDidMount() {
        fetch(`/api/videodevices`).then(response => response.json()).then(state => {this.setState(state)});
     }

    handleVideoChange = (value, action) => {
        //new video device
        this.setState({vidDeviceSelected: value, vidres: value.caps});
        this.handleResChange(value.caps[0], "");
    }

    handleResChange = (value, action) => {
        //resolution box new selected value
        this.setState({vidResSelected: value,
                       selectFramerates: value.selectFramerates});
        this.handleRateChange(value.selectFramerates[0], "");
    }

    handleRateChange = (value, action) => {
        //new framerate selected
        //this.setState({framerateSelected: event.target.value});
        this.setState({framerateSelected: value});
    }

    handleStreaming = (event) => {
        //user clicked start/stop streaming
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
                framerate: this.state.framerateSelected.value,
             })
        }).then(response => response.json()).then(state => {this.setState(state)});
    }

    render() {
      return (
            <div>
                <Helmet>
                  <title>Video Streaming</title>
                </Helmet>
                <h1>Video Streaming Configuration</h1>
                Device: <Select isDisabled={this.state.streamingStatus} onChange={this.handleVideoChange} options={this.state.dev} value={this.state.vidDeviceSelected}/>
                Resolution: <Select isDisabled={this.state.streamingStatus} options={this.state.vidres} onChange={this.handleResChange} value={this.state.vidResSelected}/>
                Framerate: <Select isDisabled={this.state.streamingStatus} options={this.state.selectFramerates} onChange={this.handleRateChange} value={this.state.framerateSelected}/>
                <button onClick={this.handleStreaming}>{this.state.streamingStatus ? "Stop Streaming" : "Start Streaming"}</button>
                <div nameclass="streamdetails" style={{ display: (this.state.streamAddresses.length > 0) ? "block" : "none"}}>
                    <p>Streaming Addresses (for VLC, etc):</p>
                    {this.state.streamAddresses.map((item, index) => (
                        <ul>{item}</ul>
                    ))}
                    <p>Or use one the following gstreamer commands to connect:</p>
                    {this.state.streamAddresses.map((item, index) => (
                        <ul>gst-launch-1.0 rtspsrc location={item} latency=0 ! queue ! decodebin ! autovideosink</ul>
                    ))}
                </div>
            </div>
          );
    }
}


export default VideoPage;
