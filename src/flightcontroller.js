import React from 'react';
import Select from 'react-select';

import basePage from './basePage.js';

import './css/styles.css';

class FCPage extends basePage {
    constructor(props, useSocketIO=true) {
        super(props, useSocketIO);
        this.state = {
            telemetryStatus: this.props.telemetryStatus,
            serialPorts: [],
            baudRates: [],
            mavVersions: [],
            mavDialects: [],
            serialPortSelected: null,
            baudRateSelected: null,
            mavVersionSelected: null,
            mavDialectSelected: null,
            FCStatus: {},
            UDPoutputs: [],
            addrow: "",
            loading: true,
            socketioStatus: false,
            usedSocketIO: true
        }

        // Socket.io client for reading in analog update values
        this.socket.on('FCStatus', function(msg){
            this.setState({FCStatus: msg});
        }.bind(this));
        this.socket.on('reconnect', function(){
            //refresh state
            this.componentDidMount();
        }.bind(this));
    }

    componentDidMount() {
        fetch(`/api/FCDetails`).then(response => response.json()).then(state => {this.setState(state)});
        fetch(`/api/FCOutputs`).then(response => response.json()).then(state => {this.setState(state); this.loadDone()});
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

    handleMavDialectChange = (value, action) => {
        this.setState({mavDialectSelected: value});
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
                mavversion: JSON.stringify(this.state.mavVersionSelected),
                mavdialect: JSON.stringify(this.state.mavDialectSelected)
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

    addUdpOutput = (event) =>{
        //add a new udp output
        fetch('/api/addudpoutput', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                newoutputIP: this.state.addrow.split(":")[0],
                newoutputPort: this.state.addrow.split(":")[1]
            })
        }).then(response => response.json()).then(state => {this.setState(state)})
    }

    removeUdpOutput = (val) =>{
        //remove a udp output
        fetch('/api/removeudpoutput', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                removeoutputIP: val.IPPort.split(":")[0],
                removeoutputPort: val.IPPort.split(":")[1]
            })
        }).then(response => response.json()).then(state => {this.setState(state)})
    }

    changeaddrow = event => {
        const value = event.target.value;
        this.setState({addrow: value});
    }

    renderTitle() {
        return "Flight Controller";
    }

    //create a html table from a list of udpoutputs
    renderUDPTableData(udplist) {
        return udplist.map((output, index) => {
            return (
                <tr key={index}>
                    <td>{output.IPPort}</td>
                    <td><button id={index} onClick={() => this.removeUdpOutput(output)}>Delete</button></td>
                </tr>
            )
        });
    }

    renderContent() {
      return (
            <div>
              <h2>Serial Input</h2>
              Serial Device: <Select isDisabled={this.state.telemetryStatus} onChange={this.handleSerialPortChange} options={this.state.serialPorts} value={this.state.serialPortSelected}/>
              Baud Rate: <Select isDisabled={this.state.telemetryStatus} onChange={this.handleBaudRateChange} options={this.state.baudRates} value={this.state.baudRateSelected}/>
              MAVLink Version: <Select isDisabled={this.state.telemetryStatus} onChange={this.handleMavVersionChange} options={this.state.mavVersions} value={this.state.mavVersionSelected}/>
              MAVLink Dialect: <Select isDisabled={this.state.telemetryStatus} onChange={this.handleMavDialectChange} options={this.state.mavDialects} value={this.state.mavDialectSelected}/>
              <button disabled={this.state.serialPorts.length === 0} onClick={this.handleSubmit}>{this.state.telemetryStatus ? "Stop Telemetry" : "Start Telemetry"}</button>
              <h2>UDP Outputs</h2>
                <table id='UDPOut'>
                    <thead>
                        <tr><th>Destination IP:Port</th><th>Action</th></tr>
                    </thead>
                    <tbody>
                        {this.renderUDPTableData(this.state.UDPoutputs)}
                    </tbody>
                </table>
                  <label>Add new output<input type="text" onChange={this.changeaddrow} value={this.state.addrow} /><button onClick={this.addUdpOutput}>Add</button></label>
              <h2>Status</h2>
                  <p>Packets Recieved: {this.state.FCStatus.numpackets}</p>
                  <p>Connection Status: {this.state.FCStatus.conStatus}</p>
                  <p>Vehicle Type: {this.state.FCStatus.vehType}</p>
                  <p>Vehicle Firmware: {this.state.FCStatus.FW}</p>
                  <label>Console Output:
                    <textarea readOnly rows = "5" cols = "100" value={this.state.FCStatus.statusText}></textarea>
                  </label>
                  <button disabled={!this.state.telemetryStatus} onClick={this.handleFCReboot}>Reboot Flight Controller</button>
            </div>
          );
    }
}


export default FCPage;
