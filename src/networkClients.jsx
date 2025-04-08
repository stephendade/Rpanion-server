import Table from 'react-bootstrap/Table'
import React from 'react'

import basePage from './basePage.jsx'

import './css/styles.css'

class NetworkClientsPage extends basePage {
  constructor (props) {
    super(props)
    this.state = {
      ...this.state,
      apname: '',
      apclients: null
    }
  }

  componentDidMount () {
    fetch('/api/networkclients', {headers: {Authorization: `Bearer ${this.state.token}`}}).then(response => response.json()).then(state => { this.setState(state); this.loadDone() })
  }

  renderTitle () {
    return 'Access Point Clients'
  }

  // create a html table from a list of udpoutputs
  renderClientTableData (clientlist) {
    if (clientlist === null) {
      return <tr></tr>
    }
    return clientlist.map((output, index) => {
      return (
        <tr key={index}>
          <td>{output.hostname}</td>
          <td>{output.ip}</td>
        </tr>
      )
    })
  }

  renderContent () {
    return (
      <div>
        <div style={{ display: (this.state.apname !== '') ? 'block' : 'none' }}>
          <p>The following table show all DHCP clients connected to the access point: {this.state.apname}</p>
          <Table id='apclients' striped bordered hover size="sm">
            <thead>
              <tr><th>Name</th><th>IP</th></tr>
              {this.renderClientTableData(this.state.apclients)}
            </thead>
            <tbody>
            </tbody>
          </Table>
        </div>
        <div style={{ display: (this.state.apname === '') ? 'block' : 'none' }}>
          <p>No Access Point running from this Companion Computer</p>
        </div>
      </div>
    )
  }
}

export default NetworkClientsPage
