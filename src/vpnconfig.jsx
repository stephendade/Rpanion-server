import Button from 'react-bootstrap/Button'
import Select from 'react-select'
import Table from 'react-bootstrap/Table';
import Form from 'react-bootstrap/Form';
import React from 'react'
import basePage from './basePage.jsx'

class VPNPage extends basePage {
  constructor (props) {
    super(props)
    this.state = {
      ...this.state,
      statusZerotier: {installed: false, status: false, text: []},
      statusWireguard: {installed: false, status: false, text: []},
      selectedVPN: { label: 'Zerotier', value: 'zerotier' },
      vpnOptions: [{ label: 'Zerotier', value: 'zerotier' }, { label: 'Wireguard', value: 'wireguard' }],
      selVPNInstalled: false,
      selVPNActive: false,
      newZerotierKey: "",
      selectedWGFile: '',
      selectedWGFileContents: null
    }
  }

  componentDidMount () {
    // Fetch the vpn information and send to controls
    this.setState({ loading: true });
    Promise.all([
      fetch(`/api/vpnzerotier`, {headers: {Authorization: `Bearer ${this.state.token}`}}).then(response => response.json()).then(state => { this.setState(state); this.setState({ selVPNInstalled: state.statusZerotier.installed }); this.setState({ selVPNActive: state.statusZerotier.status }) }),
      fetch(`/api/vpnwireguard`, {headers: {Authorization: `Bearer ${this.state.token}`}}).then(response => response.json()).then(state => { this.setState(state); })
    ]).then(this.loadDone());
  }

  handleVPNChange = (value) => {
    this.setState({ selectedVPN: value });
    if (value.value == 'zerotier') {
      this.setState({ selVPNInstalled: this.state.statusZerotier.installed });
      this.setState({ selVPNActive: this.state.statusZerotier.status });
    }
    else if (value.value == 'wireguard') {
      this.setState({ selVPNInstalled: this.state.statusWireguard.installed });
      this.setState({ selVPNActive: this.state.statusWireguard.status });
    } 
    else {
      this.setState({ selVPNInstalled: false });
    }    
  }

  handlenewZerotierKey = (event) => {
    this.setState({ newZerotierKey: event.target.value });
  }

  removeZerotierNetwork = (val) => {
    //remove a zerotier network
    fetch('/api/vpnzerotierdel', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.state.token}`
      },
      body: JSON.stringify({
        network: val
      })
    }).then(response => response.json()).then(state => { this.setState(state) }).catch(error => {
      this.setState({ waiting: false, error: "Error removing network: " + error }) });
  }

  addZerotierNetwork = () => {
    //add a zerotier network
    fetch('/api/vpnzerotieradd', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.state.token}`
      },
      body: JSON.stringify({
        network: this.state.newZerotierKey
      })
    }).then(response => response.json()).then(state => { this.setState(state) }).catch(error => {
      this.setState({ waiting: false, error: "Error removing network: " + error }) });
  }

  activateWireguardNetwork = (val) => {
    // activate wireguard network
    fetch('/api/vpnwireguardactivate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.state.token}`
      },
      body: JSON.stringify({
        network: val
      })
    }).then(response => response.json()).then(state => { this.setState(state) }).catch(error => {
      this.setState({ waiting: false, error: "Error activating network: " + error }) });
  }

  deactivateWireguardNetwork = (val) => {
    // activate wireguard network
    fetch('/api/vpnwireguarddeactivate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.state.token}`
      },
      body: JSON.stringify({
        network: val
      })
    }).then(response => response.json()).then(state => { this.setState(state) }).catch(error => {
      this.setState({ waiting: false, error: "Error deactivating network: " + error }) });
  }

  deleteWireguardNetwork = (val) => {
    //delete a wireguard profile
    fetch('/api/vpnwireguardelete', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.state.token}`
      },
      body: JSON.stringify({
        network: val
      })
    }).then(response => response.json()).then(state => { this.setState(state) }).catch(error => {
      this.setState({ waiting: false, error: "Error deleting network: " + error }) });
  }

  fileChangeHandler = (event) => {
    this.setState({ selectedWGFile: event.target.files[0] });
	};

  renderTitle () {
    return 'VPN'
  }

  renderContent () {
    return (
        <div style={{ width: 800 }}>
        <h2>Services</h2>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">VPN Service</label>
          <div className="col-sm-8">
            <Select onChange={this.handleVPNChange} options={this.state.vpnOptions} value={this.state.selectedVPN} />
          </div>
        </div>
        <h2>Config</h2>
        <p>Installed: {this.state.selVPNInstalled == true ? 'Yes' : 'No'}</p>
        <p>Active: {this.state.selVPNActive == true ? 'Yes' : 'No'}</p>
        {/* <p>{JSON.stringify(this.state.selectedVPN.value == 'wireguard' ? this.state.statusWireguard : this.state.statusZerotier, null, 2)}</p> */}
        <div style={{ display: (this.state.selectedVPN.value == 'zerotier' && this.state.statusZerotier != {}) ? "block" : "none"}}>
          <Table striped bordered>
            <thead>
              <tr>
                <th>Network ID</th>
                <th>Network Name</th>
                <th>IP</th>
                <th>Status</th>
                <th>Type</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {this.state.statusZerotier.text.map((item) => (
                <tr key={item.nwid}><td>{item.nwid}</td><td>{item.name}</td><td>{item.assignedAddresses}</td><td>{item.status}</td><td>{item.type}</td><td><Button size="sm" id={item.nwid} onClick={() => this.removeZerotierNetwork(item.nwid)}>Delete</Button></td></tr>
              ))}
            </tbody>
            </Table>
            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label ">Add new network by key: </label>
              <div className="col-sm-4">
                <Form.Control type="text" name="ipaddress" disabled={!this.state.selVPNActive} value={this.state.newZerotierKey} onChange={this.handlenewZerotierKey} />
                <Button id="addzt" disabled={!this.state.selVPNActive || this.state.newZerotierKey === ''} onClick={() => this.addZerotierNetwork()}>Add</Button>
              </div>
            </div>
          </div>
          <div style={{ display: (this.state.selectedVPN.value == 'wireguard' && this.state.statusWireguard != {}) ? "block" : "none"}}>
            <Table striped bordered>
              <thead>
                <tr>
                  <th>Network Conf File</th>
                  <th>Local IP</th>
                  <th>Server IP</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
              {this.state.statusWireguard.text.map((item) => (
                <tr key={item.profile}>
                  <td>{item.profile}</td>
                  <td>{item.peer}</td>
                  <td>{item.server}</td>
                  <td>{item.status}</td>
                  <td>
                    <div style={{ display: (item.status === 'disabled') ? "block" : "none"}}>
                      <Button size="sm" id={item.file} onClick={() => this.activateWireguardNetwork(item.profile)}>Activate</Button>
                    </div>
                    <div style={{ display: (item.status !== 'disabled') ? "block" : "none"}}>
                      <Button size="sm" id={item.file} onClick={() => this.deactivateWireguardNetwork(item.profile)}>Deactivate</Button>
                    </div>
                    <Button size="sm" id={item.file} disabled={item.status !== 'disabled'} onClick={() => this.deleteWireguardNetwork(item.profile)}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
            </Table>
            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label ">Add new Wireguard profile</label>
              <div className="col-sm-6">
                <Form id='uploadForm' 
                  action='/api/vpnwireguardprofileadd' 
                  method='post' 
                  encType="multipart/form-data">
                    <Form.Control type="file" name="wgprofile" disabled={!this.state.selVPNActive} onChange={this.fileChangeHandler} accept=".conf, .config"/>
                    <Button type='submit' value='Upload' disabled={this.state.selectedWGFile === ''}>Upload</Button>
                </Form>
              </div>
            </div>
          </div>
          </div>
    )
  }
}

export default VPNPage
