import React from 'react';
import Select from 'react-select';
import Button from 'react-bootstrap/Button';
import Table from 'react-bootstrap/Table';

import basePage from './basePage.js';

import './css/styles.css';

class FCPage extends basePage {
  constructor(props, useSocketIO = true) {
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
      enableTCP: null,
      FCStatus: {},
      UDPoutputs: [],
      addrow: "",
      loading: true,
      error: null,
      infoMessage: null,
      socketioStatus: false,
      usedSocketIO: true
    }

    // Socket.io client for reading in analog update values
    this.socket.on('FCStatus', function (msg) {
      this.setState({ FCStatus: msg });
    }.bind(this));
    this.socket.on('reconnect', function () {
      //refresh state
      this.componentDidMount();
    }.bind(this));
  }

  componentDidMount() {
    fetch(`/api/FCDetails`).then(response => response.json()).then(state => { this.setState(state) });
    fetch(`/api/FCOutputs`).then(response => response.json()).then(state => { this.setState(state); this.loadDone() });
  }

  handleSerialPortChange = (value, action) => {
    this.setState({ serialPortSelected: value });
  }

  handleBaudRateChange = (value, action) => {
    this.setState({ baudRateSelected: value });
  }

  handleMavVersionChange = (value, action) => {
    this.setState({ mavVersionSelected: value });
  }

  handleMavDialectChange = (value, action) => {
    this.setState({ mavDialectSelected: value });
  }

  handleUseTCPChange = (event) => {
    this.setState({ enableTCP: event.target.checked });
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
        mavdialect: JSON.stringify(this.state.mavDialectSelected),
        enableTCP: this.state.enableTCP
      })
    }).then(response => response.json()).then(state => { this.setState(state) });
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

  addUdpOutput = (event) => {
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
    }).then(response => response.json()).then(state => { this.setState(state) })
  }

  removeUdpOutput = (val) => {
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
    }).then(response => response.json()).then(state => { this.setState(state) })
  }

  changeaddrow = event => {
    const value = event.target.value;
    this.setState({ addrow: value });
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
          <td><Button size="sm" id={index} onClick={() => this.removeUdpOutput(output)}>Delete</Button></td>
        </tr>
      )
    });
  }

  renderContent() {
    return (
      <div style={{ width: 600 }}>
        <h2>Serial Input</h2>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">Serial Device</label>
          <div className="col-sm-8">
            <Select isDisabled={this.state.telemetryStatus} onChange={this.handleSerialPortChange} options={this.state.serialPorts} value={this.state.serialPortSelected} />
          </div>
        </div>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">Baud Rate</label>
          <div className="col-sm-8">
            <Select isDisabled={this.state.telemetryStatus} onChange={this.handleBaudRateChange} options={this.state.baudRates} value={this.state.baudRateSelected} />
          </div>
        </div>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">MAVLink Version</label>
          <div className="col-sm-8">
            <Select isDisabled={this.state.telemetryStatus} onChange={this.handleMavVersionChange} options={this.state.mavVersions} value={this.state.mavVersionSelected} />
          </div>
        </div>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">MAVLink Dialect</label>
          <div className="col-sm-8">
            <Select isDisabled={this.state.telemetryStatus} onChange={this.handleMavDialectChange} options={this.state.mavDialects} value={this.state.mavDialectSelected} />
          </div>
        </div>

        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label"></label>
          <div className="col-sm-8">
            <input type="checkbox" checked={this.state.enableTCP} disabled={this.state.telemetryStatus} onChange={this.handleUseTCPChange} />Enable TCP Server at port 5760
          </div>
        </div>

        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <div className="col-sm-8">
            <Button disabled={this.state.serialPorts.length === 0} onClick={this.handleSubmit}>{this.state.telemetryStatus ? "Stop Telemetry" : "Start Telemetry"}</Button>
          </div>
        </div>

        <br />
        <h2>UDP Outputs</h2>
        <Table id='UDPOut' striped bordered hover size="sm">
          <thead>
            <tr><th>Destination IP:Port</th><th>Action</th></tr>
          </thead>
          <tbody>
            <tr key={this.state.UDPoutputs.length}><td>127.0.0.1:14540</td><td><i>Required for Rpanion-server</i></td></tr>
            {this.renderUDPTableData(this.state.UDPoutputs)}
          </tbody>
        </Table>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">Add new output</label>
          <div className="col-sm-8">
            <input type="text" onChange={this.changeaddrow} value={this.state.addrow} /><Button size="sm" onClick={this.addUdpOutput}>Add</Button>
          </div>
        </div>
        <br />
        <h2>Status</h2>
        <p>Packets Recieved: {this.state.FCStatus.numpackets} ({this.state.FCStatus.byteRate} bytes/sec)</p>
        <p>Connection Status: {this.state.FCStatus.conStatus}</p>
        <p>Vehicle Type: {this.state.FCStatus.vehType}</p>
        <p>Vehicle Firmware: {this.state.FCStatus.FW}</p>
        <label>Console Output:
          <textarea readOnly rows="5" cols="50" value={this.state.FCStatus.statusText}></textarea>
        </label>
        <br />
        <Button size="sm" disabled={!this.state.telemetryStatus} onClick={this.handleFCReboot}>Reboot Flight Controller</Button>
      </div>
    );
  }
}


export default FCPage;
