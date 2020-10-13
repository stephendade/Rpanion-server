import React from 'react'
import Modal from 'react-modal';

import basePage from './basePage.js'

class AboutPage extends basePage {
  constructor (props) {
    super(props)
    this.state = {
      OSVersion: '',
      Nodejsversion: '',
      rpanionversion: '',
      CPUName: '',
      RAMName: '',
      HATName: {},
      diskSpaceStatus: '',
      loading: true,
      error: null,
      infoMessage: null,
      showModal: false,
      showModalResult: ""
    }
  }

  componentDidMount () {
    fetch('/api/softwareinfo').then(response => response.json()).then(state => this.setState(state))
    fetch('/api/diskinfo').then(response => response.json()).then(state => this.setState(state))
    fetch('/api/hardwareinfo').then(response => response.json()).then(state => { this.setState(state); this.loadDone() })
  }

  confirmShutdown = (event) => {
    //user clicked the shutdown button
    // modal events take it from here
    this.setState({ showModal: true });
  }

  handleCloseModal = (event) => {
    // user does not want to shutdown
    this.setState({ showModal: false});
  }

  handleShutdown = (event) => {
    // user does want to shutdown
    this.setState({ showModal: false});
    fetch('/api/shutdowncc', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
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
        <p>CPU: {this.state.CPUName}</p>
        <p>RAM: {this.state.RAMName} GB</p>
        <p>Disk Space: {this.state.diskSpaceStatus}</p>
        {this.HATInfo()}
        <h2>About Software</h2>
        <p>OS version: {this.state.OSVersion}</p>
        <p>Node.js version: {this.state.Nodejsversion}</p>
        <p>Rpanion-server version: {this.state.rpanionversion}</p>
        <h2>Controls</h2>
        <button onClick={this.confirmShutdown}>Shutdown Companion Computer</button>

        <Modal isOpen={this.state.showModal} appElement={document.getElementById('root')} contentLabel="ShutdownConfirm" className="Modal">
          <h3 className="ModalTitle">Confirm</h3>
          <div className="ModalContent">Are you sure you want to shutdown the Companion Computer?</div>
          <div className="ModalActions">
            <button onClick={this.handleShutdown}>Yes</button>
            <button onClick={this.handleCloseModal}>No</button>
          </div>
        </Modal>
      </div>
    )
  }
}

export default AboutPage
