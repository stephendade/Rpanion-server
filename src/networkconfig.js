import React from 'react';
import Select from 'react-select';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Table from 'react-bootstrap/Table';

import basePage from './basePage.js';

class NetworkConfig extends basePage {
  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      detWifi: [],
      showModal: false,
      showModalResult: "",
      showModalDelete: false,
      showModalNewNetworkName: false,
      newNetworkName: '',
      error: null,
      showPW: false,
      infoMessage: null,
      wirelessEnabled: true,
      netDevice: [],
      netDeviceSelected: null,
      netConnection: [],
      netConnectionFiltered: [],
      netConnectionFilteredSelected: null,
      netConnectionDetails: {},
      netConnectionSimilarIfaces: [],
      showIP: false,
      wpaTypes: [{ value: 'wpa-none', text: 'None' }, { value: 'wpa-psk', text: 'WPA (PSK)' }],
      bandTypes: [{ value: 'a', text: '5 GHz' }, { value: 'bg', text: '2.4 GHz' }],
      availChannels: [],
      curSettings: {
        ipaddresstype: {
          value: ''
        },
        ipaddress: {
          value: ''
        },
        subnet: {
          value: ''
        },
        wpaType: {
          value: ''
        },
        password: {
          value: ''
        },
        ssid: {
          value: ''
        },
        band: {
          value: ''
        },
        mode: {
          value: ''
        },
        attachedIface: {
          value: ''
        },
        channel: {
          value: ''
        }
      }
    };

    //bind button events
    this.handleNetworkSubmit = this.handleNetworkSubmit.bind(this);
    this.deleteConnection = this.deleteConnection.bind(this);
    this.addConnection = this.addConnection.bind(this);
    this.handleCloseModalAP = this.handleCloseModalAP.bind(this);
    this.handleCloseModalClient = this.handleCloseModalClient.bind(this);
    //this.handleIPTypeChange = this.handleIPTypeChange.bind(this);
  }

  componentDidMount() {
    this.handleStart();
  }

  handleStart() {
    // Fetch the network information and send to controls
    this.setState({ loading: true });
    Promise.all([
      fetch(`/api/networkconnections`).then(response => response.json()).then(state => this.setState(state)),
      fetch(`/api/wirelessstatus`).then(response => response.json()).then(state => this.setState(state)),
      fetch(`/api/networkadapters`).then(response => response.json()).then(state => { this.setState(state); this.setState({ netDeviceSelected: state.netDevice[0] }); return state; })
    ]).then(retState => { this.handleAdapterChange(retState[2].netDevice[0], { action: "select-option" }); this.loadDone() });
  }

  handleAdapterChange = (value, action) => {
    //on a device selection change, re-fill the connections dialog
    //and open up the applicable divs
    var netConnection = [];
    var activeCon = null;
    if (action.action === 'select-option') {
      if (value.type === "ethernet") {
        this.setState((state, props) => {
          return { showIP: true };
        });
        //filter the connections
        this.state.netConnection.forEach(function (item) {
          if (item.type === "802-3-ethernet" && (item.attachedIface === "" || item.attachedIface === value.value)) {
            if (item.state === value.value) {
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
      else if (value.type === "wifi") {
        this.setState((state, props) => {
          return { showIP: true };
        });
        //filter the connections
        this.state.netConnection.forEach(function (item) {
          if (item.type === "802-11-wireless" && (item.attachedIface === "" || item.attachedIface === "undefined" || item.attachedIface === value.value)) {
            if (item.state === value.value) {
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
        this.setState((state, props) => {
          return { showIP: true };
        });
        //filter the connections
        this.state.netConnection.forEach(function (item) {
          if (item.type === "tun" && (item.attachedIface === "" || item.attachedIface === value.value)) {
            if (item.state === value.value) {
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
    }

    this.setState((state, props) => {
      //no active connection
      if (activeCon === null && netConnection.length > 0) {
        activeCon = netConnection[0];
      }
      // no connections in list at all. Blank settings
      else if (netConnection.length === 0)
      {
        this.handleConnectionChange(null, { action: "select-option" });
        return { netDeviceSelected: value, netConnectionFiltered: netConnection, netConnectionFilteredSelected: null };
      }

      this.handleConnectionChange(activeCon, { action: "select-option" });

      return { netDeviceSelected: value, netConnectionFiltered: netConnection, netConnectionFilteredSelected: activeCon };
    });
  };

  handleConnectionChange = (value, action) => {
    //on a device selection change, re-fill the connections dialog
    //and open up the applicable divs
    if (value === null) {
      // no selected connection. Blank fields
      this.setState({ showIP: false });
      return;
    }

    if (action.action === 'select-option') {
      fetch('/api/networkIP', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conName: value.value
        })
      }).then(response => response.json())
        .then(state => this.setState(state, () => { 
          this.setState({
            curSettings: {
              ipaddresstype: { value: this.state.netConnectionDetails.DHCP },
              ipaddress: { value: this.state.netConnectionDetails.IP },
              subnet: { value: this.state.netConnectionDetails.subnet },
              wpaType: { value: this.state.netConnectionDetails.wpaType },
              password: { value: this.state.netConnectionDetails.password },
              ssid: { value: this.state.netConnectionDetails.ssid },
              band: { value: this.state.netConnectionDetails.band },
              channel: { value: this.state.netConnectionDetails.channel },
              mode: { value: this.state.netConnectionDetails.mode },
              attachedIface: { value: this.state.netConnectionDetails.attachedIface }
            }
          }, () => {
            this.setState({ netConnectionFilteredSelected: value, netConnectionSimilarIfaces: this.getSameAdapter() })
          })
        }));
    }
  };

  getSameAdapter = () => {
    //get all adapter names of the same device class as selected adapter
    var ret = [{ value: '""', text: '(None)' }];
    var selType = this.state.netDeviceSelected.type;
    this.state.netDevice.forEach(function (item) {
      if (item.type === selType) {
        ret.push({ value: item.value, text: item.value });
      }
    });
    return ret;
  }

  handleNetworkSubmit = (event) => {
    //save network button clicked - so edit or add
    if (this.state.netConnectionFilteredSelected.value === 'new') {
      this.setState({ waiting: true }, () => {
        fetch('/api/networkadd', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conSettings: this.state.curSettings,
            conName: this.state.netConnectionFilteredSelected.label,
            conType: this.state.netDeviceSelected.type,
            conAdapter: this.state.netDeviceSelected.value
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
          },
          body: JSON.stringify({
            conName: this.state.netConnectionFilteredSelected.value,
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
    event.preventDefault();
  };

  deleteConnection = (event) => {
    //delete network button clicked
    this.setState({ showModalDelete: true });

    event.preventDefault();
  };

  addConnection = (event) => {
    //add new network button clicked
    if(this.state.netDeviceSelected.type === "wifi") {
      this.setState({ waiting: true }, () => {
        fetch(`/api/wifiscan`).then(response => response.json())
                              .then(state => this.setState(state))
                              .then(this.setState({ newNetworkName: '' }))
                              .then(this.setState({ showModalNewNetworkName: true }))
                              .then(this.setState({ waiting: false }))
      })
    }
    else {
      this.setState({ newNetworkName: '' })
      this.setState({ showModalNewNetworkName: true })
    }
  };

  activateConnection = (event) => {
    //add activate network button clicked
    //if it's a new connection, don't activate
    //and refresh network information when done
    if (this.state.netConnectionFilteredSelected.value !== "new") {
      this.setState({ waiting: true }, () => {
        fetch('/api/networkactivate', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conName: this.state.netConnectionFilteredSelected.value,
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
    event.preventDefault();
  };

  deactivateConnection = (event) => {
    //add deactivate network button clicked
    //and refresh network information when done
    //don't do anything if a new (unsaved) network
    if (this.state.netConnectionFilteredSelected.value !== "new") {
      this.setState({ waiting: true }, () => {
        fetch('/api/networkdeactivate', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conName: this.state.netConnectionFilteredSelected.value,
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
    event.preventDefault();
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
          [name]: {
            ...this.state.curSettings[name],
            value
          },
          ['channel']: {
            ...this.state.curSettings['channel'],
            value: '0'
          }
        }
      });
    }
    else {
      this.setState({
        curSettings: {
          ...this.state.curSettings,
          [name]: {
            ...this.state.curSettings[name],
            value
          }
        }
      });
    }
  }

  togglePasswordVisible = event => {
    this.setState({ showPW: event.target.checked });
  }

  resetForm = (event) => {
    //if it's a new connection, go back to old connection
    if (this.state.netConnectionFilteredSelected.value === "new") {
      this.handleConnectionChange(this.state.netConnection[0], { action: "select-option" });
    }
    //reset the form
    this.setState({
      curSettings: {
        ipaddresstype: { value: this.state.netConnectionDetails.DHCP },
        ipaddress: { value: this.state.netConnectionDetails.IP },
        subnet: { value: this.state.netConnectionDetails.subnet },
        wpaType: { value: this.state.netConnectionDetails.wpaType },
        password: { value: this.state.netConnectionDetails.password },
        ssid: { value: this.state.netConnectionDetails.ssid },
        band: { value: this.state.netConnectionDetails.band },
        channel: { value: this.state.netConnectionDetails.channel },
        mode: { value: this.state.netConnectionDetails.mode },
        attachedIface: { value: this.state.netConnectionDetails.attachedIface }
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
    var nm = this.state.netConnectionFilteredSelected.label;
    this.setState({
      netConnectionFilteredSelected: { value: 'new', label: nm, type: this.state.netDeviceSelected.type, state: "" },
      curSettings: { mode: { value: "ap" }, ipaddresstype: { value: "shared" }, band: { value: "bg" }, channel: { value: '0' }, ssid: { value: "" }, ipaddress: { value: "" }, subnet: { value: "" }, wpaType: { value: "wpa-psk" }, password: { value: "" }, attachedIface: { value: '""' } }
    });
  }

  handleCloseModalClient(selssid, selsecurity) {
    // user has selected client new Wifi connection
    this.setState({ showModal: false });
    this.setState({ netConnectionSimilarIfaces: this.getSameAdapter() });
    var nm = this.state.netConnectionFilteredSelected.label;
    this.setState({
      netConnectionFilteredSelected: { value: 'new', label: nm, type: this.state.netDeviceSelected.type, state: "" },
      curSettings: { mode: { value: "infrastructure" }, ipaddresstype: { value: "auto" }, band: { value: "" }, channel: { value: '0' }, ssid: { value: selssid }, ipaddress: { value: "" }, subnet: { value: "" }, wpaType: { value: selsecurity === '' ? 'wpa-none' : 'wpa-psk' }, password: { value: "" }, attachedIface: { value: '""' } }
    });
  }

  handleCloseModalDelete = (event) => {
    // user does not want to delete network
    this.setState({ showModalDelete: false });
  }

  handleDelete = (event) => {
    // user DOES want to delete network
    this.setState({ showModalDelete: false });
    if (this.state.netConnectionFilteredSelected.value === "new") {
      //this.handleConnectionChange(this.state.netConnection[0], {action: "select-option"});
      this.handleAdapterChange(this.state.netDeviceSelected, { action: "select-option" })
    }
    else {
      this.setState({ waiting: true }, () => {
        fetch('/api/networkdelete', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conName: this.state.netConnectionFilteredSelected.value,
          })
        }).then(response => response.json())
          .then(data => {
            if (data.error == null) {
              this.setState({ waiting: false, infoMessage: "Network Deleted" });
            }
            else {
              this.setState({ waiting: false, error: "Error deleting network: " + data.error });
            }
            //and refresh connections list
            this.handleStart();
          })
          .catch(error => {
            this.setState({ waiting: false, error: "Error deleting network: " + error });
          });
      });
    }
  }

  handleNewNetworkNameCancel = (event) => {
    // user does not want to add a new network
    this.setState({ showModalNewNetworkName: false });
  }

  handleCloseModalNewNetworkName = (event) => {
    // user DOES want to add a new network
    this.setState({ showModalNewNetworkName: false });
    if (this.state.newNetworkName !== '' && this.state.newNetworkName !== null) {
      this.setState({ netConnectionFilteredSelected: { value: 'new', label: this.state.newNetworkName, type: this.state.netDeviceSelected.type, state: "" } });
      if(this.state.netDeviceSelected.type === "wifi") {
        this.setState({ showModal: true });
      }
    }
    else {
    }
  }

  changeNetworkNameHandler = (event) => {
    const value = event.target.value;
    this.setState({ newNetworkName: value });

  }

  refreshWifi = (event) => {
    this.setState({ waiting: false }, () => {
      fetch(`/api/wifiscan`).then(response => response.json())
                            .then(state => this.setState(state))
                            .then(this.setState({ waiting: false }))
    })
  }

  refreshConList = (event) => {
    this.setState({ waiting: false }, () => {
      fetch(`/api/networkconnections`).then(response => response.json())
                                      .then(state => this.setState(state))
                                      .then(this.setState({ waiting: false }))
    })
  }

  refreshInfoList = (event) => {
    this.handleConnectionChange(this.state.netConnectionFilteredSelected, { action: "select-option" });
  }

  handleNewNetworkTypeCancel = (event) => {
    // user does not want to add a new network
    this.setState({ showModal: false });
    this.handleConnectionChange(this.state.netConnection[0], { action: "select-option" });
  }

  togglewirelessEnabled = (event) => {
    const value = event.target.checked;
    this.setState({ waiting: true }, () => {
      fetch('/api/setwirelessstatus', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
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
    var opt = [];
    for (var i = 0, len = this.state.netDeviceSelected.channels.length; i < len; i++) {
      if (this.state.netDeviceSelected.channels[i].band === this.state.curSettings.band.value || this.state.netDeviceSelected.channels[i].band === 0) {
        opt.push(this.state.netDeviceSelected.channels[i]);
      }
    }
    return opt;
  }

  renderContent() {
    return (
      <div style={{ width: 500 }}>
        <p><i>Create, view, edit and delete network connections</i></p>
        <h2>Select Connection</h2>
        <p><i>Show a specific network connection, filtered by network adapter</i></p>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">Adapter</label>
          <div className="col-sm-8">
            <Select onChange={this.handleAdapterChange} options={this.state.netDevice} value={this.state.netDeviceSelected} />
          </div>
        </div>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label">Connection</label>
          <div className="col-sm-8">
            <Select onChange={this.handleConnectionChange} options={this.state.netConnectionFiltered} value={this.state.netConnectionFilteredSelected} />
          </div>
        </div>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label"></label>
          <div className="col-sm-8">
            <input type="checkbox" checked={this.state.wirelessEnabled} onChange={this.togglewirelessEnabled} />Wifi interfaces enabled
          </div>
        </div>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label"></label>
          <div className="col-sm-8">
            <Button size="sm" variant="primary" onClick={this.deleteConnection} disabled={this.state.netConnectionFilteredSelected == null || this.state.netConnectionFilteredSelected.type === "tun"} className="deleteConnection">Delete</Button>{' '}
            <Button size="sm" variant="primary" onClick={this.addConnection} disabled={this.state.netConnectionFilteredSelected !== null && this.state.netConnectionFilteredSelected.type === "tun"} className="addConnection">Add new</Button>{' '}
            <Button size="sm" variant="secondary" onClick={this.activateConnection} disabled={this.state.netConnectionFilteredSelected == null || this.state.netConnectionFilteredSelected.state !== ""} className="activateConnection">Activate</Button>{' '}
            <Button size="sm" variant="secondary" onClick={this.deactivateConnection} disabled={this.state.netConnectionFilteredSelected !== null && this.state.netConnectionFilteredSelected.state === ""} className="deactivateConnection">Deactivate</Button>{' '}
          </div>
        </div>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label"></label>
          <div className="col-sm-7">
            <Button size="sm" disabled={this.state.netConnectionFilteredSelected !== null && this.state.netConnectionFilteredSelected.type === "tun"} onClick={this.refreshConList}>Refresh Connection List</Button>{' '}
          </div>
        </div>
        <div className="form-group row" style={{ marginBottom: '5px' }}>
          <label className="col-sm-4 col-form-label"></label>
          <div className="col-sm-7">
            <Button size="sm" disabled={this.state.netConnectionFilteredSelected == null || this.state.netConnectionFilteredSelected.type === "tun"} onClick={this.refreshInfoList}>Refresh Connection Information</Button>
          </div>
        </div>

        <br />
        <h2>Edit Connection</h2>
        <Form onSubmit={this.handleNetworkSubmit} style={{ display: (this.state.netConnectionFilteredSelected !== null) ? "block" : "none" }}>
          <div className="adapterattach" style={{ display: this.state.netConnectionFilteredSelected && this.state.netConnectionFilteredSelected.type === "tun" ? "none" : "block" }}>
            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Attach to Specific Adapter</label>
              <div className="col-sm-8">
                <select name="attachedIface" onChange={this.changeHandler} value={this.state.curSettings.attachedIface.value}>
                  {this.state.netConnectionSimilarIfaces.map((option, index) => (
                    <option key={option.value} value={option.value}>{option.text}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="ipconfig" style={{ display: (this.state.showIP && this.state.curSettings.mode.value !== "adhoc" && this.state.curSettings.mode.value !== "ap") ? "block" : "none" }}><h3>IP Address</h3>

            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">IP Address Type</label>
              <div className="col-sm-8">
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="ipaddresstype" value="auto" onChange={this.changeHandler} checked={this.state.curSettings.ipaddresstype.value === "auto"} />
                  <label className="form-check-label">DHCP</label>
                </div>
                <div className="form-check">
                  <input className="form-check-input" type="radio" name="ipaddresstype" value="manual" onChange={this.changeHandler} checked={this.state.curSettings.ipaddresstype.value === "manual"} />
                  <label className="form-check-label">Static IP</label>
                </div>
              </div>
            </div>
            <div style={{ display: (this.state.curSettings.ipaddresstype.value !== "auto") ? "block" : "none" }}>
              <div className="form-group row" style={{ marginBottom: '5px' }}>
                <label className="col-sm-4 col-form-label">IP Address</label>
                <div className="col-sm-8">
                  <input type="text" name="ipaddress" disabled={this.state.curSettings.ipaddresstype.value === "auto"} onChange={this.changeHandler} value={this.state.curSettings.ipaddress.value} />
                </div>
              </div>
              <div className="form-group row" style={{ marginBottom: '5px' }}>
                <label className="col-sm-4 col-form-label">Subnet Mask</label>
                <div className="col-sm-8">
                  <input type="text" name="subnet" disabled={this.state.curSettings.ipaddresstype.value === "auto"} onChange={this.changeHandler} value={this.state.curSettings.subnet.value} />
                </div>
              </div>
              </div>

          </div>
          <div className="wificlientconfig" style={{ display: this.state.curSettings.mode.value === "infrastructure" ? "block" : "none" }}><h3>Wifi Client</h3>
            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">SSID Name</label>
              <div className="col-sm-8">
                <input name="ssid" onChange={this.changeHandler} value={this.state.curSettings.ssid.value} type="text" />
              </div>
            </div>
            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Security</label>
              <div className="col-sm-8">
                <select name="wpaType" value={this.state.curSettings.wpaType.value} onChange={this.changeHandler}>
                  {this.state.wpaTypes.map((option, index) => (
                    <option key={option.value} value={option.value}>{option.text}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: (this.state.curSettings.wpaType.value !== "wpa-none") ? "block" : "none" }}>
              <div className="form-group row" style={{ marginBottom: '5px' }}>
                <label className="col-sm-4 col-form-label">Password</label>
                <div className="col-sm-8">
                  <input name="password" type={this.state.showPW === true ? "text" : "password"} disabled={this.state.curSettings.wpaType.value === "wpa-none"} value={this.state.curSettings.wpaType.value === "wpa-none" ? '' : this.state.curSettings.password.value} onChange={this.changeHandler} /><br />
                  <input name="showpassword" type="checkbox" checked={this.state.showPW} disabled={this.state.curSettings.wpaType.value === "wpa-none"} onChange={this.togglePasswordVisible} /><label>Show Password</label>
                </div>
              </div>
            </div>

          </div>

          <div className="wifiapconfig" style={{ display: (this.state.curSettings.mode.value === "ap" || this.state.curSettings.mode.value === "adhoc") ? "block" : "none" }}><h3>Wifi Access Point</h3>
            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">SSID Name</label>
              <div className="col-sm-8">
                <input name="ssid" onChange={this.changeHandler} value={this.state.curSettings.ssid.value} type="text" />
              </div>
            </div>

            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Band</label>
              <div className="col-sm-8">
                <select name="band" onChange={this.changeHandler} value={this.state.curSettings.band.value}>
                  {this.state.bandTypes.map((option, index) => (
                    <option key={option.value} value={option.value}>{option.text}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Channel</label>
              <div className="col-sm-8">
                <select name="channel" onChange={this.changeHandler} value={this.state.curSettings.channel.value}>
                  {this.state.netDeviceSelected !== null ? this.getValidChannels().map((option, index) => (
                    <option key={option.value} value={option.value}>{option.text}</option>
                  )) : <option></option>}
                </select>
              </div>
            </div>

            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Security</label>
              <div className="col-sm-8">
                <select name="wpaType" value={this.state.curSettings.wpaType.value} onChange={this.changeHandler}>
                  {this.state.wpaTypes.map((option, index) => (
                    <option key={option.value} value={option.value}>{option.text}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Password</label>
              <div className="col-sm-8">
                <input name="password" type={this.state.showPW === true ? "text" : "password"} disabled={this.state.curSettings.wpaType.value === "wpa-none"} value={this.state.curSettings.wpaType.value === "wpa-none" ? '' : this.state.curSettings.password.value} onChange={this.changeHandler} /><br />
                <input name="showpassword" type="checkbox" checked={this.state.showPW} disabled={this.state.curSettings.wpaType.value === "wpa-none"} onChange={this.togglePasswordVisible} /><label>Show Password</label>
              </div>
            </div>

            <div className="form-group row" style={{ marginBottom: '5px' }}>
              <label className="col-sm-4 col-form-label">Starting IP Address</label>
              <div className="col-sm-8">
                <input name="ipaddress" onChange={this.changeHandler} value={this.state.curSettings.ipaddress.value} type="text" />
              </div>
            </div>

          </div>

          <div className="form-group row" style={{ marginBottom: '5px' }}>
            <label className="col-sm-4 col-form-label"></label>
            <div className="col-sm-8">
              <Button size="sm" variant="primary" type="submit" disabled={this.state.netConnectionFilteredSelected !== null && this.state.netConnectionFilteredSelected.type === "tun"}>Save Changes</Button>{' '}
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
                      <tr><td onClick={() => this.handleCloseModalClient(item.ssid, item.security)}>{item.ssid}</td><td>{item.signal}</td><td>{item.security}</td></tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </Modal.Body>

            <Modal.Footer>
              <Button variant="primary" onClick={this.handleCloseModalAP}>Create new Wifi hotspot</Button>
              <Button variant="primary" onClick={() => this.handleCloseModalClient('', '')}>Connect to hidden WiFi</Button>
              <Button bsSize="small" onClick={this.refreshWifi}>Refresh Wifi list</Button>
              <Button variant="secondary" onClick={this.handleNewNetworkTypeCancel}>Cancel</Button>
            </Modal.Footer>
          </Modal>

          <Modal show={this.state.showModalDelete} onHide={this.handleCloseModalDelete}>
            <Modal.Header closeButton>
              <Modal.Title>Confirm Delete</Modal.Title>
            </Modal.Header>

            <Modal.Body>
              <p>Are you sure you want to Delete the '{this.state.netConnectionFilteredSelected === null ? "" : this.state.netConnectionFilteredSelected.label}' network?</p>
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
              <input name="newNetworkName" onChange={this.changeNetworkNameHandler} value={this.state.newNetworkName} type="text" />
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
