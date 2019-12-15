import React from 'react';
import Select from 'react-select';
import io from 'socket.io-client';
import SocketIOFooter from './footerSocketIO';
import BootstrapTable from 'react-bootstrap-table-next';

import 'react-bootstrap-table-next/dist/react-bootstrap-table2.min.css';
import basePage from './basePage.js';

class FCPage extends basePage {
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
            UDPoutputs: [],
            addrow: "",
            loading: true
        }

        this.columns = [{
          dataField: 'IPPort',
          text: 'Destination IP:Port'
          },
          {
          dataField: 'action',
          text: 'Action',
          isDummyField: true,
          formatter: this.udpbuttonFormatter
          }];

        this.socket = io();

        // Socket.io client for reading in analog update values
        this.socket.on('FCStatus', function(msg){
            this.setState({FCStatus: msg});
        }.bind(this));
        this.socket.on('disconnect', function(){
            this.setState({socketioStatus: false});
        }.bind(this));
        this.socket.on('connect', function(){
            this.setState({socketioStatus: true});
        }.bind(this));
    }

    componentDidMount() {
        fetch(`/api/FCDetails`).then(response => response.json()).then(state => {this.setState(state)});
        fetch(`/api/FCOutputs`).then(response => response.json()).then(state => {this.setState(state); this.loadDone()});
    }

    componentWillUnmount() {
        this.socket.disconnect();
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

    udpbuttonFormatter = (cell, row, rowIndex, formatExtraData) => {
        return <button id={row.id} onClick={() => this.removeUdpOutput(row)}>Delete</button>;
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

    renderContent() {
      return (
            <div>
              <h2>Serial Input</h2>
              Serial Device: <Select isDisabled={this.state.telemetryStatus} onChange={this.handleSerialPortChange} options={this.state.serialPorts} value={this.state.serialPortSelected}/>
              Baud Rate: <Select isDisabled={this.state.telemetryStatus} onChange={this.handleBaudRateChange} options={this.state.baudRates} value={this.state.baudRateSelected}/>
              MAVLink Version: <Select isDisabled={this.state.telemetryStatus} onChange={this.handleMavVersionChange} options={this.state.mavVersions} value={this.state.mavVersionSelected}/>
              <button disabled={this.state.serialPorts.length === 0} onClick={this.handleSubmit}>{this.state.telemetryStatus ? "Stop Telemetry" : "Start Telemetry"}</button>
              <h2>UDP Outputs</h2>
                  <BootstrapTable condensed keyField='IPPort' data={ this.state.UDPoutputs } columns={ this.columns }/>
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
              <SocketIOFooter socketioStatus={this.state.socketioStatus}/>
            </div>
          );
    }
}


export default FCPage;
