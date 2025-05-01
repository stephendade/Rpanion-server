import React from 'react'
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';

import basePage from './basePage.jsx'

class AboutPage extends basePage {
  constructor (props, useSocketIO = true) {
    super(props, useSocketIO)
    this.state = {
      ...this.state,
      OSVersion: '',
      Nodejsversion: '',
      rpanionversion: '',
      CPUName: '',
      RAMName: '',
      SYSName: '',
      HATName: {},
      diskSpaceStatus: '',
      showModal: false,
      showModalResult: "",
      UpgradeStatus: '',
      UpgradeIntStat: ''
    }

    this.upgradeTextContainer = React.createRef();

    //Socket.io client for reading in analog update values
    this.socket.on('upgradeText', function (msg) {
      const prevText = this.state.UpgradeStatus
      this.setState({ UpgradeStatus: (prevText + msg) })
    }.bind(this));
    this.socket.on('upgradeStatus', function (msg) {
      this.setState({ UpgradeIntStat: msg })
    }.bind(this));
    this.socket.on('reconnect', function () {
      //refresh state
      this.componentDidMount();
    }.bind(this));
  }

  componentDidMount () {
    fetch('/api/softwareinfo', {headers: {Authorization: `Bearer ${this.state.token}`}}).then(response => response.json()).then(state => this.setState(state))
    fetch('/api/diskinfo', {headers: {Authorization: `Bearer ${this.state.token}`}}).then(response => response.json()).then(state => this.setState(state))
    fetch('/api/hardwareinfo', {headers: {Authorization: `Bearer ${this.state.token}`}}).then(response => response.json()).then(state => { this.setState(state); this.loadDone() })
  }

  confirmShutdown = () => {
    //user clicked the shutdown button
    // modal events take it from here
    this.setState({ showModal: true });
  }

  handleCloseModal = () => {
    // user does not want to shutdown
    this.setState({ showModal: false});
  }

  handleShutdown = () => {
    // user does want to shutdown
    this.setState({ showModal: false});
    fetch('/api/shutdowncc', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.state.token}`
      }
    });
  }

  handleUpdateMaster = () => {
    // update to latest github master
    fetch('/api/updatemaster', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.state.token}`
      }
    });
  }

  renderTitle () {
    return 'About'
  }

  HATInfo() {
      if (this.state.HATName.product !== "") {
        return <p>Attached HAT: {this.state.HATName.product}, Vendor: {this.state.HATName.vendor}, Version: {this.state.HATName.version}</p>;
      }
      return <p></p>;
    }

  renderContent () {
    return (
      <div>
        <h2>About Hardware</h2>
        <p>System: {this.state.SYSName}</p>
        <p>CPU: {this.state.CPUName}</p>
        <p>RAM: {this.state.RAMName} GB</p>
        <p>Disk Space: {this.state.diskSpaceStatus}</p>
        {this.HATInfo()}
        <h2>About Software</h2>
        <p>OS hostname: {this.state.hostname}</p>
        <p>OS version: {this.state.OSVersion}</p>
        <p>Node.js version: {this.state.Nodejsversion}</p>
        <p>Rpanion-server version: {this.state.rpanionversion}</p>
        <h2>Controls</h2>
        <p><Button size="sm" onClick={this.handleUpdateMaster}>Upgrade to lastest Github master</Button></p>
        <p><Button size="sm" onClick={this.confirmShutdown}>Shutdown Companion Computer</Button></p>

        <div style={{ display: (this.state.UpgradeIntStat === 'InProgress' || this.state.UpgradeIntStat === 'Complete') ? "block" : "none" }}>
          <h2>Upgrade Status</h2>
          <div style={{ display: (this.state.UpgradeIntStat === 'InProgress') ? "block" : "none" }}>
            <p>Upgrade is in progress ... please wait</p>
          </div>
          <div style={{ display: (this.state.UpgradeIntStat === 'Complete') ? "block" : "none" }}>
            <p>Upgrade complete</p>
          </div>
          <textarea ref={this.upgradeTextContainer} readOnly rows="20" cols="60" value={this.state.UpgradeStatus}></textarea>
        </div>
        

        <Modal show={this.state.showModal} onHide={this.handleCloseModal}>
          <Modal.Header closeButton>
            <Modal.Title>Confirm</Modal.Title>
          </Modal.Header>

          <Modal.Body>
            <p>Are you sure you want to shutdown the Companion Computer?</p>
          </Modal.Body>

          <Modal.Footer>
            <Button variant="secondary" onClick={this.handleShutdown}>Yes</Button>
            <Button variant="primary" onClick={this.handleCloseModal}>No</Button>
          </Modal.Footer>
        </Modal>

      </div>
    )
  }
}

export default AboutPage
