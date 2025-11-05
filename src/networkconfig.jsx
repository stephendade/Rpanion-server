import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Table from 'react-bootstrap/Table';
import React from 'react'
import IPAddressInput from './components/IPAddressInput.jsx';

import basePage from './basePage.jsx';

class NetworkConfig extends basePage {
  constructor(props) {
    super(props);
    this.state = {
      ...this.state,
      detWifi: [],
      showModal: false,
      showModalResult: "",
      showModalDelete: false,
      showModalNewNetworkName: false,
      newNetworkName: '',
      showPW: false,
      wirelessEnabled: true,
      netDevice: [],
      netDeviceSelected: null,
      netConnection: [],
      netConnectionFiltered: [],
      netConnectionFilteredSelected: null,
      netConnectionDetails: {},
      netConnectionSimilarIfaces: [],
      showIP: false,
      wpaTypes: [{ value: 'none', text: 'None' }, { value: 'wpa-psk', text: 'WPA (PSK)' }],
      bandTypes: [{ value: 'a', text: '5 GHz' }, { value: 'bg', text: '2.4 GHz' }],
      availChannels: [],
      curSettings: {
        ipaddresstype: '',
        ipaddress: '',
        subnet: '',
        wpaType: '',
        password: '',
        ssid: '',
        band: '',
        mode: '',
        attachedIface: '',
        channel: ''
      }
    };

    //bind button events
    this.handleNetworkSubmit = this.handleNetworkSubmit.bind(this);
    this.deleteConnection = this.deleteConnection.bind(this);
    this.addConnection = this.addConnection.bind(this);
    this.handleCloseModalAP = this.handleCloseModalAP.bind(this);
    this.handleCloseModalClient = this.handleCloseModalClient.bind(this);
  }

  componentDidMount() {
    this.handleStart();
  }

  handleStart() {
    // Fetch the network information and send to controls
    this.setState({ loading: true });
    Promise.all([
      fetch(`/api/networkconnections`, {headers: {Authorization: `Bearer ${this.state.token}`}}).then(response => response.json()).then(state => this.setState(state)),
      fetch(`/api/wirelessstatus`, {headers: {Authorization: `Bearer ${this.state.token}`}}).then(response => response.json()).then(state => this.setState(state)),
      fetch(`/api/networkadapters`, {headers: {Authorization: `Bearer ${this.state.token}`}}).then(response => response.json()).then(state => { 
        this.setState(state); 
        if (state.netDevice && state.netDevice.length > 0) {
          this.setState({ netDeviceSelected: state.netDevice[0].value }); 
        }
        return state; 
      })
    ]).then(retState => { 
      if (retState[2].netDevice && retState[2].netDevice.length > 0) {
        this.handleAdapterChange({ target: { value: retState[2].netDevice[0].value } }); 
      }
      this.loadDone();
    });
  }

  handleAdapterChange = (event) => {
    //on a device selection change, re-fill the connections dialog
    //and open up the applicable divs
    const selectedValue = event.target.value;
    const selectedDevice = this.state.netDevice.find(dev => dev.value === selectedValue);
    
    if (!selectedDevice) return;
    
    var netConnection = [];
    var activeCon = null;

    if (selectedDevice.type === "ethernet") {
      this.setState({ showIP: true });
      //filter the connections
      this.state.netConnection.forEach(function (item) {
        if (item.type === "802-3-ethernet" && (item.attachedIface === "" || item.attachedIface === selectedDevice.value)) {
          if (item.state === selectedDevice.value) {
            item.label = item.labelPre + " (Active)";
            netConnection.push(item);
            activeCon = item;
          }
          else {
            item.label = item.labelPre;
            netConnection.push(item);
          }
        }
      });
    }
    else if (selectedDevice.type === "wifi") {
      this.setState({ showIP: true });
      //filter the connections
      this.state.netConnection.forEach(function (item) {
        if (item.type === "802-11-wireless" && (item.attachedIface === '""' || item.attachedIface === '' ||
          item.attachedIface === "undefined" || item.attachedIface === selectedDevice.value)) {
          if (item.state === selectedDevice.value) {
            item.label = item.labelPre + " (Active)";
            netConnection.push(item);
            activeCon = item;
          }
          else {
            item.label = item.labelPre;
            netConnection.push(item);
          }
        }
      });
    }
    else {
      //tun device
      this.setState({ showIP: true });
      //filter the connections
      this.state.netConnection.forEach(function (item) {
        if (item.type === "tun" && (item.attachedIface === "" || item.attachedIface === selectedDevice.value)) {
          if (item.state === selectedDevice.value) {
            item.label = item.labelPre + " (Active)";
            netConnection.push(item);
            activeCon = item;
          }
          else {
            item.label = item.labelPre;
            netConnection.push(item);
          }
        }
      });
    }

    //no active connection
    if (activeCon === null && netConnection.length > 0) {
      activeCon = netConnection[0];
    }
    // no connections in list at all. Blank settings
    else if (netConnection.length === 0) {
      this.handleConnectionChange({ target: { value: null } });
      this.setState({ 
        netDeviceSelected: selectedValue, 
        netConnectionFiltered: netConnection, 
        netConnectionFilteredSelected: null 
      });
      return;
    }

    this.handleConnectionChange({ target: { value: activeCon.value } });
    this.setState({ 
      netDeviceSelected: selectedValue, 
      netConnectionFiltered: netConnection, 
      netConnectionFilteredSelected: activeCon.value 
    });
  };

  handleConnectionChange = (event) => {
    //on a connection selection change, load the connection details
    const selectedValue = event.target.value;
    
    if (selectedValue === null) {
      // no selected connection. Blank fields
      this.setState({ showIP: false });
      return;
    }

    const selectedConnection = this.state.netConnectionFiltered.find(con => con.value === selectedValue);
    
    if (!selectedConnection) return;

    fetch('/api/networkIP', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.state.token}`
      },
      body: JSON.stringify({
        conName: selectedValue
      })
    }).then(response => response.json())
      .then(state => this.setState(state, () => { 
        this.setState({
          curSettings: {
            ipaddresstype: this.state.netConnectionDetails.DHCP || '',
            ipaddress: this.state.netConnectionDetails.IP || '',
            subnet: this.state.netConnectionDetails.subnet || '',
            wpaType: this.state.netConnectionDetails.wpaType || '',
            password: this.state.netConnectionDetails.password || '',
            ssid: this.state.netConnectionDetails.ssid || '',
            band: this.state.netConnectionDetails.band || '',
            channel: this.state.netConnectionDetails.channel || '',
            mode: this.state.netConnectionDetails.mode || '',
            attachedIface: this.state.netConnectionDetails.attachedIface || ''
          }
        }, () => {
          this.setState({ 
            netConnectionFilteredSelected: selectedValue, 
            netConnectionSimilarIfaces: this.getSameAdapter() 
          })
        })
      }));
  };

  getSameAdapter = () => {
    //get all adapter names of the same device class as selected adapter
    var ret = [{ value: '""', text: '(None)' }];
    const selectedDevice = this.state.netDevice.find(dev => dev.value === this.state.netDeviceSelected);
    if (!selectedDevice) return ret;
    
    var selType = selectedDevice.type;
    this.state.netDevice.forEach(function (item) {
      if (item.type === selType) {
        ret.push({ value: item.value, text: item.value });
      }
    });
    return ret;
  }

  handleNetworkSubmit = (event) => {
    event.preventDefault();
    
    //save network button clicked - so edit or add
    const selectedConnection = this.state.netConnectionFiltered.find(
      con => con.value === this.state.netConnectionFilteredSelected
    );
    
    if (selectedConnection && selectedConnection.value === 'new') {
      this.setState({ waiting: true }, () => {
        const selectedDevice = this.state.netDevice.find(dev => dev.value === this.state.netDeviceSelected);
        
        fetch('/api/networkadd', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.state.token}`
          },
          body: JSON.stringify({
            conSettings: this.state.curSettings,
            conName: selectedConnection.label,
            conType: selectedDevice ? selectedDevice.type : '',
            conAdapter: this.state.netDeviceSelected
          }, (key, value) => {
            if (value !== '') return value
          })
        }).then(response => response.json())
          .then(data => {
            if (data.error == null) {
              this.setState({ waiting: false, infoMessage: "Network Added" });
            }
            else {
              this.setState({ waiting: false, error: "Error adding network: " + data.error });
            }
            //and refresh connections list
            this.handleStart();
          })
          .catch(error => {
            this.setState({ waiting: false, error: "Error adding network: " + error });
          });
      });
    }
    else {
      this.setState({ waiting: true }, () => {
        fetch('/api/networkedit', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.state.token}`
          },
          body: JSON.stringify({
            conName: this.state.netConnectionFilteredSelected,
            conSettings: this.state.curSettings,
          }, (key, value) => {
            if (value !== '') return value
          })
        }).then(response => response.json())
          .then(data => {
            if (data.error == null) {
              this.setState({ waiting: false, infoMessage: "Network Edited" });
            }
            else {
              this.setState({ waiting: false, error: "Error editing network: " + data.error });
            }
            //and refresh connections list
            this.handleStart();
          })
          .catch(error => {
            this.setState({ waiting: false, error: "Error editing network: " + error });
          });
      });
    }
  };

  deleteConnection = (event) => {
    //delete network button clicked
    this.setState({ showModalDelete: true });
    event.preventDefault();
  };

  addConnection = () => {
    //add new network button clicked
    const selectedDevice = this.state.netDevice.find(dev => dev.value === this.state.netDeviceSelected);
    
    if(selectedDevice && selectedDevice.type === "wifi") {
      this.setState({ waiting: true }, () => {
        fetch(`/api/wifiscan`, {headers: {Authorization: `Bearer ${this.state.token}`}}).then(response => response.json())
          .then(state => this.setState(state))
          .then(() => this.setState({ newNetworkName: '' }))
          .then(() => this.setState({ showModalNewNetworkName: true }))
          .then(() => this.setState({ waiting: false }))
      })
    }
    else {
      this.setState({ newNetworkName: '', showModalNewNetworkName: true })
    }
  };

  activateConnection = (event) => {
    event.preventDefault();
    
    //add activate network button clicked
    //if it's a new connection, don't activate
    //and refresh network information when done
    if (this.state.netConnectionFilteredSelected !== "new") {
      this.setState({ waiting: true }, () => {
        fetch('/api/networkactivate', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.state.token}`
          },
          body: JSON.stringify({
            conName: this.state.netConnectionFilteredSelected,
          })
        }).then(response => response.json())
          .then(data => {
            if (data.error == null) {
              this.setState({ waiting: false, infoMessage: "Network Activated" });
            }
            else {
              this.setState({ waiting: false, error: "Error activating network: " + data.error });
            }
            //and refresh connections list
            this.handleStart();
          })
          .catch(error => {
            this.setState({ waiting: false, error: "Error activating network: " + error });
          });
      });
    }
  };

  deactivateConnection = (event) => {
    event.preventDefault();
    
    //add deactivate network button clicked
    //and refresh network information when done
    //don't do anything if a new (unsaved) network
    if (this.state.netConnectionFilteredSelected !== "new") {
      this.setState({ waiting: true }, () => {
        fetch('/api/networkdeactivate', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.state.token}`
          },
          body: JSON.stringify({
            conName: this.state.netConnectionFilteredSelected,
          })
        }).then(response => response.json())
          .then(data => {
            if (data.error == null) {
              this.setState({ waiting: false, infoMessage: "Network Deactivated" });
            }
            else {
              this.setState({ waiting: false, error: "Error deactivating network: " + data.error });
            }
            //and refresh connections list
            this.handleStart();
          })
          .catch(error => {
            this.setState({ waiting: false, error: "Error deactivating network: " + error });
          });
      });
    }
  };

  changeHandler = event => {
    //form change handler
    const name = event.target.name;
    const value = event.target.value;

    if (name === 'band') {
      // if it's a band change, reset the channel value
      this.setState({
        curSettings: {
          ...this.state.curSettings,
          [name]: value,
          channel: '0'
        }
      });
    }
    else {
      this.setState({
        curSettings: {
          ...this.state.curSettings,
          [name]: value
        }
      });
    }
  }

  togglePasswordVisible = event => {
    this.setState({ showPW: event.target.checked });
  }

  resetForm = () => {
    //if it's a new connection, go back to old connection
    const selectedConnection = this.state.netConnectionFiltered.find(
      con => con.value === this.state.netConnectionFilteredSelected
    );
    
    if (selectedConnection && selectedConnection.value === "new") {
      if (this.state.netConnection.length > 0) {
        this.handleConnectionChange({ target: { value: this.state.netConnection[0].value } });
      }
    }
    
    //reset the form
    this.setState({
      curSettings: {
        ipaddresstype: this.state.netConnectionDetails.DHCP || '',
        ipaddress: this.state.netConnectionDetails.IP || '',
        subnet: this.state.netConnectionDetails.subnet || '',
        wpaType: this.state.netConnectionDetails.wpaType || '',
        password: this.state.netConnectionDetails.password || '',
        ssid: this.state.netConnectionDetails.ssid || '',
        band: this.state.netConnectionDetails.band || '',
        channel: this.state.netConnectionDetails.channel || '',
        mode: this.state.netConnectionDetails.mode || '',
        attachedIface: this.state.netConnectionDetails.attachedIface || ''
      }
    });
  }

  renderTitle() {
    return "Network Configuration";
  }

  handleCloseModalAP() {
    // user has selected AP new Wifi connection
    this.setState({ showModal: false });
    this.setState({ netConnectionSimilarIfaces: this.getSameAdapter() });
    
    const selectedConnection = this.state.netConnectionFiltered.find(
      con => con.value === this.state.netConnectionFilteredSelected
    );
    const nm = selectedConnection ? selectedConnection.label : '';
    
    const selectedDevice = this.state.netDevice.find(dev => dev.value === this.state.netDeviceSelected);
    
    this.setState({
      netConnectionFilteredSelected: 'new',
      netConnectionFiltered: [
        ...this.state.netConnectionFiltered,
        { value: 'new', label: nm, labelPre: nm, type: selectedDevice ? selectedDevice.type : '', state: "" }
      ],
      curSettings: { 
        mode: "ap", 
        ipaddresstype: "shared", 
        band: "bg", 
        channel: '0', 
        ssid: "", 
        ipaddress: "", 
        subnet: "", 
        wpaType: "wpa-psk", 
        password: "", 
        attachedIface: '""' 
      }
    });
  }

  handleCloseModalClient(selssid, selsecurity) {
    // user has selected client new Wifi connection
    this.setState({ showModal: false });
    this.setState({ netConnectionSimilarIfaces: this.getSameAdapter() });
    
    const selectedConnection = this.state.netConnectionFiltered.find(
      con => con.value === this.state.netConnectionFilteredSelected
    );
    const nm = selectedConnection ? selectedConnection.label : '';
    
    const selectedDevice = this.state.netDevice.find(dev => dev.value === this.state.netDeviceSelected);
    
    this.setState({
      netConnectionFilteredSelected: 'new',
      netConnectionFiltered: [
        ...this.state.netConnectionFiltered,
        { value: 'new', label: nm, labelPre: nm, type: selectedDevice ? selectedDevice.type : '', state: "" }
      ],
      curSettings: { 
        mode: "infrastructure", 
        ipaddresstype: "auto", 
        band: "", 
        channel: '0', 
        ssid: selssid, 
        ipaddress: "", 
        subnet: "", 
        wpaType: selsecurity === '' ? 'none' : 'wpa-psk', 
        password: "", 
        attachedIface: '""' 
      }
    });
  }

  handleCloseModalDelete = () => {
    // user does not want to delete network
    this.setState({ showModalDelete: false });
  }

  handleDelete = () => {
    // user DOES want to delete network
    this.setState({ showModalDelete: false });
    
    if (this.state.netConnectionFilteredSelected === "new") {
      this.handleAdapterChange({ target: { value: this.state.netDeviceSelected } })
    }
    else {
      this.setState({ waiting: true }, () => {
        fetch('/api/networkdelete', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.state.token}`
          },
          body: JSON.stringify({
            conName: this.state.netConnectionFilteredSelected,
          })
        }).then(response => response.json())
          .then(data => {
            if (data.error == null) {
              this.setState({ waiting: false, infoMessage: "Network Deleted" });
            }
            else {
              this.setState({ waiting: false, error: "Error deleting network: " + data.error });
            }
            // and refresh connections list after 500millisec
            setTimeout(() => {
              this.refreshConList();
            }, 500);
          })
          .catch(error => {
            this.setState({ waiting: false, error: "Error deleting network: " + error });
          });
      });
    }
  }

  handleNewNetworkNameCancel = () => {
    // user does not want to add a new network
    this.setState({ showModalNewNetworkName: false });
  }

  handleCloseModalNewNetworkName = () => {
    // user DOES want to add a new network
    this.setState({ showModalNewNetworkName: false });
    
    if (this.state.newNetworkName !== '' && this.state.newNetworkName !== null) {
      const selectedDevice = this.state.netDevice.find(dev => dev.value === this.state.netDeviceSelected);
      
      // Add the new connection to the filtered list
      const newCon = { 
        value: 'new', 
        label: this.state.newNetworkName, 
        labelPre: this.state.newNetworkName,
        type: selectedDevice ? selectedDevice.type : '', 
        state: "" 
      };
      
      this.setState({ 
        netConnectionFiltered: [...this.state.netConnectionFiltered, newCon],
        netConnectionFilteredSelected: 'new'
      });
      
      if(selectedDevice && selectedDevice.type === "wifi") {
        this.setState({ showModal: true });
      }
    }
  }

  changeNetworkNameHandler = (event) => {
    const value = event.target.value;
    this.setState({ newNetworkName: value });
  }

  refreshWifi = () => {
    this.setState({ waiting: true }, () => {
      fetch(`/api/wifiscan`, {headers: {Authorization: `Bearer ${this.state.token}`}}).then(response => response.json())
        .then(state => this.setState(state))
        .then(() => this.setState({ waiting: false }))
    })
  }

  refreshConList = () => {
    this.setState({ waiting: true }, () => {
      fetch(`/api/networkconnections`, {headers: {Authorization: `Bearer ${this.state.token}`}}).then(response => response.json())
        .then(state => this.setState(state, () => { 
          this.handleAdapterChange({ target: { value: this.state.netDeviceSelected } }) 
        }))
        .then(() => this.setState({ waiting: false }))
    })
  }

  refreshInfoList = () => {
    this.handleConnectionChange({ target: { value: this.state.netConnectionFilteredSelected } });
  }

  handleNewNetworkTypeCancel = () => {
    // user does not want to add a new network
    this.setState({ showModal: false });
    if (this.state.netConnection.length > 0) {
      this.handleConnectionChange({ target: { value: this.state.netConnection[0].value } });
    }
  }

  togglewirelessEnabled = (event) => {
    const value = event.target.checked;
    this.setState({ waiting: true }, () => {
      fetch('/api/setwirelessstatus', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.state.token}`
        },
        body: JSON.stringify({
          status: value,
        })
      }).then(response => response.json())
        .then(status => {
          this.setState({ waiting: false });
          this.setState(status);
          //and refresh connections list
          this.handleStart();
        })
        .catch(error => {
          this.setState({ waiting: false, error: "Error toggling wireless: " + error });
        });
    });
  }

  getValidChannels() {
    // filter valid wifi channels
    const selectedDevice = this.state.netDevice.find(dev => dev.value === this.state.netDeviceSelected);
    if (!selectedDevice || !selectedDevice.channels) return [];
    
    var opt = [];
    for (var i = 0, len = selectedDevice.channels.length; i < len; i++) {
      if (selectedDevice.channels[i].band === this.state.curSettings.band || selectedDevice.channels[i].band === 0) {
        opt.push(selectedDevice.channels[i]);
      }
    }
    return opt;
  }

  getSelectedDevice() {
    return this.state.netDevice.find(dev => dev.value === this.state.netDeviceSelected);
  }

  getSelectedConnection() {
    return this.state.netConnectionFiltered.find(con => con.value === this.state.netConnectionFilteredSelected);
  }

  renderContent() {
    const selectedDevice = this.getSelectedDevice();
    const selectedConnection = this.getSelectedConnection();
    
    return (
      <div style={{ width: 500 }}>
        <p><i>Create, view, edit and delete network connections</i></p>
        <h2>Select Connection</h2>
        <p><i>Show a specific network connection, filtered by network adapter</i></p>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">Adapter</label>
          <div className="col-sm-8">
            <Form.Select onChange={this.handleAdapterChange} value={this.state.netDeviceSelected || ''}>
              {this.state.netDevice.map((option) => (
                <option key={option.value} value={option.value}>{option.text}</option>
              ))}
            </Form.Select>
          </div>
        </div>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">Connection</label>
          <div className="col-sm-8">
            <Form.Select onChange={this.handleConnectionChange} value={this.state.netConnectionFilteredSelected || ''}>
              <option value="">Select a connection...</option>
              {this.state.netConnectionFiltered.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Form.Select>
          </div>
        </div>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label"></label>
          <div className="col-sm-8">
            <Form.Check 
              type="checkbox" 
              label="Wifi interfaces enabled"
              checked={this.state.wirelessEnabled} 
              onChange={this.togglewirelessEnabled} 
            />
          </div>
        </div>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label"></label>
          <div className="col-sm-8">
            <Button size="sm" variant="primary" onClick={this.deleteConnection} disabled={!selectedConnection || selectedConnection.type === "tun"} className="deleteConnection">Delete</Button>{' '}
            <Button size="sm" variant="primary" onClick={this.addConnection} disabled={selectedConnection && selectedConnection.type === "tun"} className="addConnection">Add new</Button>{' '}
            <Button size="sm" variant="secondary" onClick={this.activateConnection} disabled={!selectedConnection || selectedConnection.state !== ""} className="activateConnection">Activate</Button>{' '}
            <Button size="sm" variant="secondary" onClick={this.deactivateConnection} disabled={!selectedConnection || selectedConnection.state === ""} className="deactivateConnection">Deactivate</Button>{' '}
          </div>
        </div>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label"></label>
          <div className="col-sm-7">
            <Button size="sm" disabled={selectedConnection && selectedConnection.type === "tun"} onClick={this.refreshConList}>Refresh Connection List</Button>{' '}
          </div>
        </div>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label"></label>
          <div className="col-sm-7">
            <Button size="sm" disabled={!selectedConnection || selectedConnection.type === "tun"} onClick={this.refreshInfoList}>Refresh Connection Information</Button>
          </div>
        </div>

        <br />
        <h2>Edit Connection</h2>
        <Form onSubmit={this.handleNetworkSubmit} style={{ display: selectedConnection ? "block" : "none" }}>
          <div className="adapterattach" style={{ display: selectedConnection && selectedConnection.type === "tun" ? "none" : "block" }}>
            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Attach to Specific Adapter</label>
              <div className="col-sm-8">
                <Form.Select name="attachedIface" onChange={this.changeHandler} value={this.state.curSettings.attachedIface}>
                  {this.state.netConnectionSimilarIfaces.map((option) => (
                    <option key={option.value} value={option.value}>{option.text}</option>
                  ))}
                </Form.Select>
              </div>
            </div>
          </div>

          <div className="ipconfig" style={{ display: (this.state.showIP && this.state.curSettings.mode !== "adhoc" && this.state.curSettings.mode !== "ap") ? "block" : "none" }}><h3>IP Address</h3>

            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">IP Address Type</label>
              <div className="col-sm-8">
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="ipaddresstype" value="auto" onChange={this.changeHandler} checked={this.state.curSettings.ipaddresstype === "auto"} />
                  <label className="form-check-label">DHCP</label>
                </div>
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="ipaddresstype" value="manual" onChange={this.changeHandler} checked={this.state.curSettings.ipaddresstype === "manual"} />
                  <label className="form-check-label">Static IP</label>
                </div>
              </div>
            </div>
            <div style={{ display: (this.state.curSettings.ipaddresstype !== "auto") ? "block" : "none" }}>
              <div className="form-group row" style={{ marginBottom: '5px' }}>
                <label className="col-sm-4 col-form-label">IP Address</label>
                <div className="col-sm-8">
                  <IPAddressInput
                    name="ipaddress"
                    value={this.state.curSettings.ipaddress || ''}
                    onChange={this.changeHandler}
                    disabled={this.state.curSettings.ipaddresstype === "auto"}
                  />
                </div>
              </div>
              <div className="form-group row" style={{ marginBottom: '5px' }}>
                <label className="col-sm-4 col-form-label">Subnet Mask</label>
                <div className="col-sm-8">
                  <IPAddressInput
                    name="subnet"
                    value={this.state.curSettings.subnet || ''}
                    onChange={this.changeHandler}
                    disabled={this.state.curSettings.ipaddresstype === "auto"}
                  />
                </div>
              </div>
            </div>

          </div>
          
          <div className="wificlientconfig" style={{ display: this.state.curSettings.mode === "infrastructure" ? "block" : "none" }}><h3>Wifi Client</h3>
            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">SSID Name</label>
              <div className="col-sm-8">
                <Form.Control name="ssid" onChange={this.changeHandler} value={this.state.curSettings.ssid} type="text" />
              </div>
            </div>
            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Security</label>
              <div className="col-sm-8">
                <Form.Select name="wpaType" value={this.state.curSettings.wpaType} onChange={this.changeHandler}>
                  {this.state.wpaTypes.map((option) => (
                    <option key={option.value} value={option.value}>{option.text}</option>
                  ))}
                </Form.Select>
              </div>
            </div>
            <div style={{ display: (this.state.curSettings.wpaType !== "none") ? "block" : "none" }}>
              <div className="form-group row" style={{ marginBottom: '5px' }}>
                <label className="col-sm-4 col-form-label">Password</label>
                <div className="col-sm-8">
                  <Form.Control 
                    name="password" 
                    type={this.state.showPW === true ? "text" : "password"} 
                    disabled={this.state.curSettings.wpaType === "none"} 
                    value={this.state.curSettings.wpaType === "none" ? '' : this.state.curSettings.password} 
                    onChange={this.changeHandler} 
                  /><br />
                  <Form.Check 
                    type="checkbox" 
                    name="showpassword" 
                    label="Show Password"
                    checked={this.state.showPW} 
                    disabled={this.state.curSettings.wpaType === "none"} 
                    onChange={this.togglePasswordVisible} 
                  />
                </div>
              </div>
            </div>

          </div>

          <div className="wifiapconfig" style={{ display: (this.state.curSettings.mode === "ap" || this.state.curSettings.mode === "adhoc") ? "block" : "none" }}><h3>Wifi Access Point</h3>
            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">SSID Name</label>
              <div className="col-sm-8">
                <Form.Control name="ssid" onChange={this.changeHandler} value={this.state.curSettings.ssid} type="text" />
              </div>
            </div>

            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Band</label>
              <div className="col-sm-8">
                <Form.Select name="band" onChange={this.changeHandler} value={this.state.curSettings.band}>
                  {this.state.bandTypes.map((option) => (
                    <option key={option.value} value={option.value}>{option.text}</option>
                  ))}
                </Form.Select>
              </div>
            </div>
            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Channel</label>
              <div className="col-sm-8">
                <Form.Select name="channel" onChange={this.changeHandler} value={this.state.curSettings.channel}>
                  {this.getValidChannels().map((option) => (
                    <option key={option.value} value={option.value}>{option.text}</option>
                  ))}
                </Form.Select>
              </div>
            </div>

            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Security</label>
              <div className="col-sm-8">
                <Form.Select name="wpaType" value={this.state.curSettings.wpaType} onChange={this.changeHandler}>
                  {this.state.wpaTypes.map((option) => (
                    <option key={option.value} value={option.value}>{option.text}</option>
                  ))}
                </Form.Select>
              </div>
            </div>

            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Password</label>
              <div className="col-sm-8">
                <Form.Control 
                  name="password" 
                  type={this.state.showPW === true ? "text" : "password"} 
                  disabled={this.state.curSettings.wpaType === "none"} 
                  value={this.state.curSettings.wpaType === "none" ? '' : this.state.curSettings.password} 
                  onChange={this.changeHandler} 
                /><br />
                <Form.Check 
                  type="checkbox" 
                  name="showpassword" 
                  label="Show Password"
                  checked={this.state.showPW} 
                  disabled={this.state.curSettings.wpaType === "none"} 
                  onChange={this.togglePasswordVisible} 
                />
              </div>
            </div>

            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Starting IP Address</label>
              <div className="col-sm-8">
                <IPAddressInput
                  name="ipaddress"
                  value={this.state.curSettings.ipaddress || ''}
                  onChange={this.changeHandler}
                />
              </div>
            </div>

          </div>

          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-4 col-form-label"></label>
            <div className="col-sm-8">
              <Button size="sm" variant="primary" type="submit" disabled={selectedConnection && selectedConnection.type === "tun"}>Save Changes</Button>{' '}
              <Button size="sm" variant="secondary" onClick={this.resetForm}>Discard Changes</Button>{' '}
            </div>
          </div>

          <Modal show={this.state.showModal} onHide={this.handleNewNetworkTypeCancel}>
            <Modal.Header closeButton>
              <Modal.Title>WiFi Network Selection</Modal.Title>
            </Modal.Header>

            <Modal.Body>
              <p>Please select an existing Wifi network from the below list, or create a hotspot.</p>
              <div style={{ maxHeight: '400px', overflow: 'scroll' }}>
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th>SSID</th>
                      <th>Signal Strength</th>
                      <th>Security</th>
                    </tr>
                  </thead>
                  <tbody>
                    {this.state.detWifi.map((item, index) => (
                      <tr key={index}><td onClick={() => this.handleCloseModalClient(item.ssid, item.security)} style={{ cursor: 'pointer' }}>{item.ssid}</td><td>{item.signal}</td><td>{item.security}</td></tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Modal.Body>

            <Modal.Footer>
              <Button variant="primary" onClick={this.handleCloseModalAP}>Create new Wifi hotspot</Button>
              <Button variant="primary" onClick={() => this.handleCloseModalClient('', '')}>Connect to hidden WiFi</Button>
              <Button variant="secondary" onClick={this.refreshWifi}>Refresh Wifi list</Button>
              <Button variant="secondary" onClick={this.handleNewNetworkTypeCancel}>Cancel</Button>
            </Modal.Footer>
          </Modal>

          <Modal show={this.state.showModalDelete} onHide={this.handleCloseModalDelete}>
            <Modal.Header closeButton>
              <Modal.Title>Confirm Delete</Modal.Title>
            </Modal.Header>

            <Modal.Body>
              <p>Are you sure you want to Delete the &apos;{selectedConnection ? selectedConnection.label : ""}&apos; network?</p>
            </Modal.Body>

            <Modal.Footer>
              <Button variant="secondary" onClick={this.handleDelete}>Yes</Button>
              <Button variant="primary" onClick={this.handleCloseModalDelete}>No</Button>
            </Modal.Footer>
          </Modal>

          <Modal show={this.state.showModalNewNetworkName} onHide={this.handleNewNetworkNameCancel}>
            <Modal.Header closeButton>
              <Modal.Title>New Network</Modal.Title>
            </Modal.Header>

            <Modal.Body>
              <p>Enter the name of the new network:</p>
              <Form.Control name="newNetworkName" onChange={this.changeNetworkNameHandler} value={this.state.newNetworkName} type="text" />
            </Modal.Body>

            <Modal.Footer>
              <Button variant="secondary" onClick={this.handleCloseModalNewNetworkName}>OK</Button>
              <Button variant="primary" onClick={this.handleNewNetworkNameCancel}>Cancel</Button>
            </Modal.Footer>
          </Modal>
        </Form>
      </div>
    );
  }
}

export default NetworkConfig;
