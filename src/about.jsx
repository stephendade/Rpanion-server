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
    }

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
        <p><Button size="sm" onClick={this.confirmShutdown}>Shutdown Companion Computer</Button></p>

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
