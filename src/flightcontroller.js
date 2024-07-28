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
      serialPortSelected: null,
      baudRateSelected: null,
      mavVersionSelected: null,
      enableHeartbeat: null,
      enableTCP: null,
      FCStatus: {},
      UDPoutputs: [],
      addrow: "",
      loading: true,
      error: null,
      infoMessage: null,
      socketioStatus: false,
      usedSocketIO: true,
      enableUDPB: false,
      UDPBPort: 14550,
      enableDSRequest: false,
      tlogging: false
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

  handleUseHeartbeatChange = (event) => {
    this.setState({ enableHeartbeat: event.target.checked });
  }

  handleUseTCPChange = (event) => {
    this.setState({ enableTCP: event.target.checked });
  }

  handleTloggingChange = (event) => {
    this.setState({ tlogging: event.target.checked });
  }

  handleDSRequest = (event) => {
    this.setState({ enableDSRequest: event.target.checked });
  }

  handleUseUDPBChange = (event) => {
    this.setState({ enableUDPB: event.target.checked });
  }

  changeUDPBPort = (event) => {
    this.setState({ UDPBPort: event.target.value });
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
        enableHeartbeat: this.state.enableHeartbeat,
        enableTCP: this.state.enableTCP,
        enableUDPB: this.state.enableUDPB,
        UDPBPort: this.state.UDPBPort,
        enableDSRequest: this.state.enableDSRequest,
        tlogging: this.state.tlogging
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
        <p><i>Flight Controller connection to this device</i></p>
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
          <div className="col-sm-8">
            <Button disabled={this.state.serialPorts.length === 0} onClick={this.handleSubmit}>{this.state.telemetryStatus ? "Stop Telemetry" : "Start Telemetry"}</Button>
          </div>
        </div>

        <br />
        <h2>Telemetry Destinations</h2>
        <p><i>Telemetry must be stopped before the below options can be edited.</i></p>
        <h3>UDP Client</h3>
        <p><i>Send telemetry to a specific IP:port. Use "UDP" option in Mission Planner.</i></p>
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
          <label className="col-sm-4 col-form-label">Add new destination</label>
          <div className="col-sm-8">
            <input type="text" onChange={this.changeaddrow} disabled={this.state.telemetryStatus} value={this.state.addrow} /><Button size="sm" disabled={this.state.telemetryStatus} onClick={this.addUdpOutput}>Add</Button>
          </div>
        </div>
        <br />
        <h3>UDP Server</h3>
        <p><i>Allow a single GCS to connect to this device's IP:port. Multiple GCS's cannot be connected here. Use "UDPCI" option in Mission Planner.</i></p>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">Enable UDP Server</label>
          <div className="col-sm-8">
            <input type="checkbox" checked={this.state.enableUDPB} disabled={this.state.telemetryStatus} onChange={this.handleUseUDPBChange} />
            </div>
        </div>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">UDP Server Port</label>
          <div className="col-sm-8">
            <input type="number" min="1000" max="20000" step="1" onChange={this.changeUDPBPort} value={this.state.UDPBPort} disabled={!this.state.enableUDPB || this.state.telemetryStatus} />
          </div>
        </div>
        <br />
        <h3>TCP Server</h3>
        <p><i>Allow multiple GCS's to connect to this device's IP:port. Use "TCP" option in Mission Planner.</i></p>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-5 col-form-label">Enable TCP Server at port 5760</label>
          <div className="col-sm-7">
          <input type="checkbox" checked={this.state.enableTCP} disabled={this.state.telemetryStatus} onChange={this.handleUseTCPChange} />
          </div>
        </div>
        <br />
        <h2>Other Options</h2>
        <p><i>Allow Rpanion-server to send datastream requests. Required if a GCS is not connected</i></p>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-5 col-form-label">Enable datastream requests</label>
          <div className="col-sm-7">
          <input type="checkbox" checked={this.state.enableDSRequest} disabled={this.state.telemetryStatus} onChange={this.handleDSRequest} />
          </div>
        </div>
        <br />
        <p><i>Advertise RPanion as an onboard companion computer on the MAVLink network</i></p>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-5 col-form-label">Enable MAVLink heartbeats</label>
          <div className="col-sm-7">
          <input type="checkbox" checked={this.state.enableHeartbeat} disabled={this.state.telemetryStatus} onChange={this.handleUseHeartbeatChange} />
          </div>
        </div>
        <br />
        <p><i>Record MAVLink telemetry stream to logfile</i></p>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-5 col-form-label">Enable telemetry logging (tlogs)</label>
          <div className="col-sm-7">
          <input type="checkbox" checked={this.state.tlogging} disabled={this.state.telemetryStatus} onChange={this.handleTloggingChange} />
          </div>
        </div>
        <br />
        <h2>Status</h2>
        <p>Packets Received: {this.state.FCStatus.numpackets} ({this.state.FCStatus.byteRate} bytes/sec)</p>
        <p>Connection Status: {this.state.FCStatus.conStatus}</p>
        <p>Vehicle Type: {this.state.FCStatus.vehType}</p>
        <p>Vehicle Firmware: {this.state.FCStatus.FW}{this.state.FCStatus.fcVersion === '' ? '' : (', Version: ' + this.state.FCStatus.fcVersion)}</p>
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
