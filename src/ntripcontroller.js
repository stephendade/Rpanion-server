import React from 'react';
import Select from 'react-select';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';

import basePage from './basePage.js';

import './css/styles.css';

class NTRIPPage extends basePage {
  constructor(props, useSocketIO = true) {
    super(props, useSocketIO);
    this.state = {
      loading: true,
      error: null,
      infoMessage: null,
      host: "",
      port: 0,
      mountpoint: "",
      username: "",
      password: "",
      active: false,
      showPW: false,
      NTRIPStatus: this.props.NTRIPStatus
    }

    //Socket.io client for reading in analog update values
    this.socket.on('NTRIPStatus', function (msg) {
      this.setState({ NTRIPStatus: msg });
    }.bind(this));
    this.socket.on('reconnect', function () {
      //refresh state
      this.componentDidMount();
    }.bind(this));
  }

  componentDidMount() {
    fetch(`/api/ntripconfig`).then(response => response.json()).then(state => { this.setState(state); this.loadDone() });
  }

  changeHandler = event => {
    //form change handler
    const name = event.target.name;
    const value = event.target.value;

    this.setState({
      [name]: value
    });
  }

  togglePasswordVisible = event => {
    this.setState({ showPW: event.target.checked });
  }

  handleNTRIPSubmit = event => {
    //user clicked start/stop NTRIP
    fetch('/api/ntripmodify', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        host: JSON.stringify(this.state.host),
        port: JSON.stringify(Number(this.state.port)),
        mountpoint: JSON.stringify(this.state.mountpoint),
        username: JSON.stringify(this.state.username),
        password: JSON.stringify(this.state.password),
        active: !this.state.active
      })
    }).then(response => response.json()).then(state => { this.setState(state) });
  }

  renderTitle() {
    return "NTRIP Configuration";
  }

  renderContent() {
    return (
      <div>
        <h2>Configuration</h2>
        <Form style={{ width: 500 }}>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-2 col-form-label">Host</label>
            <div className="col-sm-10">
              <input type="text" className="form-control" name="host" disabled={this.state.active === true} onChange={this.changeHandler} value={this.state.host} />
            </div>
          </div>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-2 col-form-label">Port</label>
            <div className="col-sm-10">
              <input type="number" min="100" max="60000" step="1" className="form-control" name="port" disabled={this.state.active === true} onChange={this.changeHandler} value={this.state.port} />
            </div>
          </div>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-2 col-form-label">Mountpoint</label>
            <div className="col-sm-10">
              <input type="text" className="form-control" name="mountpoint" disabled={this.state.active === true} onChange={this.changeHandler} value={this.state.mountpoint} />
            </div>
          </div>

          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-2 col-form-label">Username</label>
            <div className="col-sm-10">
              <input type="text" className="form-control" name="username" disabled={this.state.active === true} onChange={this.changeHandler} value={this.state.username} />
            </div>
          </div>
          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-2 col-form-label">Password</label>
            <div className="col-sm-10">
              <input type={this.state.showPW === true ? "text" : "password"} className="form-control" name="password" disabled={this.state.active === true} onChange={this.changeHandler} value={this.state.password} />
              <input name="showpassword" type="checkbox" checked={this.state.showPW} onChange={this.togglePasswordVisible} /><label>Show Password</label>
            </div>
          </div>

          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <div className="col-sm-10">
              <Button onClick={this.handleNTRIPSubmit} className="btn btn-primary">{this.state.active === true ? "Disable" : "Enable"}</Button>
            </div>
          </div>
        </Form>
        <h2>Status</h2>
        <p>{this.state.NTRIPStatus}</p>
      </div>
    );
  }
}


export default NTRIPPage;
