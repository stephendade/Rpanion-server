import React from 'react'

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
      loading: true
    }
  }

  componentDidMount () {
    fetch('/api/softwareinfo').then(response => response.json()).then(state => this.setState(state))
    fetch('/api/hardwareinfo').then(response => response.json()).then(state => { this.setState(state); this.loadDone() })
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
        {this.HATInfo()}
        <h2>About Software</h2>
        <p>OS version: {this.state.OSVersion}</p>
        <p>Node.js version: {this.state.Nodejsversion}</p>
        <p>Rpanion-server version: {this.state.rpanionversion}</p>
      </div>
    )
  }
}

export default AboutPage
