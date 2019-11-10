import React, { Component } from 'react';
import { Helmet } from 'react-helmet'
import Select from 'react-select';
import io from 'socket.io-client';
import SocketIOFooter from './footerSocketIO';

class FCPage extends Component {
    constructor(props) {
        super(props);
        this.state = {
            telemetryStatus: this.props.telemetryStatus,
            serialPorts: [],
            baudRates: [],
            mavVersions: [],
            serialPortSelected: null,
            baudRateSelected: null,
            mavVersionSelected: null,
            socketioStatus: false,
            FCStatus: {},
        }

        var socket = io();

        // Socket.io client for reading in analog update values
        socket.on('FCStatus', function(msg){
            this.setState({FCStatus: msg});
        }.bind(this));
        socket.on('disconnect', function(){
            this.setState({socketioStatus: false});
        }.bind(this));
        socket.on('connect', function(){
            this.setState({socketioStatus: true});
        }.bind(this));
    }

    componentDidMount() {
        fetch(`/api/FCDetails`).then(response => response.json()).then(state => {this.setState(state)});
    }

    handleSerialPortChange = (value, action) => {
        this.setState({serialPortSelected: value});
    }

    handleBaudRateChange = (value, action) => {
        this.setState({baudRateSelected: value});
    }

    handleMavVersionChange = (value, action) => {
        this.setState({mavVersionSelected: value});
    }

    handleSubmit = (event) => {
        //user clicked start/stop telemetry
        fetch('/api/FCModify', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                device: JSON.stringify(this.state.serialPortSelected),
                baud: JSON.stringify(this.state.baudRateSelected),
                mavversion: JSON.stringify(this.state.mavVersionSelected)
             })
        }).then(response => response.json()).then(state => {this.setState(state)});
    }

    handleFCReboot = (event) => {
        //user clicked to reboot flight controller
        fetch('/api/FCReboot', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            }
        });
    }

    render() {
      return (
            <div>
                <Helmet>
                  <title>The Flight Controller Page</title>
                </Helmet>
              <h2>Flight Controller Configuration</h2>
              Serial Device: <Select isDisabled={this.state.telemetryStatus} onChange={this.handleSerialPortChange} options={this.state.serialPorts} value={this.state.serialPortSelected}/>
              Baud Rate: <Select isDisabled={this.state.telemetryStatus} onChange={this.handleBaudRateChange} options={this.state.baudRates} value={this.state.baudRateSelected}/>
              MAVLink Version: <Select isDisabled={this.state.telemetryStatus} onChange={this.handleMavVersionChange} options={this.state.mavVersions} value={this.state.mavVersionSelected}/>
              <button disabled={this.state.serialPorts.length === 0} onClick={this.handleSubmit}>{this.state.telemetryStatus ? "Stop Telemetry" : "Start Telemetry"}</button>
              <h2>Flight Controller Outputs</h2>
              <h2>Flight Controller Status</h2>
              <p>Packets Recieved: {this.state.FCStatus.numpackets}</p>
              <p>Connection Status: {this.state.FCStatus.conStatus}</p>
              <p>Vehicle Type: {this.state.FCStatus.vehType}</p>
              <p>Vehicle Firmware: {this.state.FCStatus.FW}</p>
              <textarea rows = "5" cols = "100" value={this.state.statusText} ></textarea>
              <button disabled={!this.state.telemetryStatus} onClick={this.handleFCReboot}>Reboot Flight Controller</button>
              <SocketIOFooter socketioStatus={this.state.socketioStatus}/>
            </div>
          );
    }
}


export default FCPage;
