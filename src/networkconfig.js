import React, { Component } from 'react';
import { Helmet } from 'react-helmet';
import Select from 'react-select';

class NetworkConfig extends Component {
  constructor(props) {
    super(props);
    this.state = {
      netDevice: [],
      netDeviceSelected: null,
      netConnection: [],
      netConnectionFiltered: [],
      netConnectionFilteredSelected: null,
      netConnectionDetails: {},
      showIP: false,
      wpaTypes: [{value: 'wpa-none', text: 'None'}, {value: 'wpa-psk', text: 'WPA (PSK)'}],
      bandTypes: [{value: 'a', text: '5 GHz'}, {value: 'bg', text: '2.4 GHz'}],
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
            }
        }
    };

    //bind button events
    this.handleNetworkSubmit = this.handleNetworkSubmit.bind(this);
    this.deleteConnection = this.deleteConnection.bind(this);
    this.addConnection = this.addConnection.bind(this);
    //this.handleIPTypeChange = this.handleIPTypeChange.bind(this);
  }

    componentDidMount() {
        this.handleStart();
     }

    handleStart() {
        // Fetch the network information and send to controls
        Promise.all([
            fetch(`/api/networkconnections`).then(response => response.json()).then(state => this.setState(state)),
            fetch(`/api/networkadapters`).then(response => response.json()).then(state => {this.setState(state); this.setState({netDeviceSelected: state.netDevice[0]}); return state;})
        ]).then(retState => this.handleAdapterChange(retState[1].netDevice[0], {action: "select-option"}));
      }

    handleAdapterChange = (value, action) => {
        //on a device selection change, re-fill the connections dialog
        //and open up the applicable divs
        var netConnection = [];
        var activeCon = null;
        if (action.action === 'select-option') {
            if(value.type === "ethernet") {
                this.setState((state, props) => {
                    return {showIP: true};
                });
                //filter the connections
                this.state.netConnection.forEach(function (item) {
                    if (item.type === "802-3-ethernet") {
                        netConnection.push(item)
                    }
                    if (item.state !== "" && item.type === "802-3-ethernet") {
                        activeCon = item;
                    }
                });
            }
            else if(value.type === "wifi") {
                this.setState((state, props) => {
                    return {showIP: true};
                });
                //filter the connections
                this.state.netConnection.forEach(function (item) {
                    if (item.type === "802-11-wireless") {
                        netConnection.push(item)
                    }
                    if (item.state !== "" && item.type === "802-11-wireless") {
                        activeCon = item;
                    }
                });
            }
            else {
                //tun device
                this.setState((state, props) => {
                    return {showIP: true};
                });
                //filter the connections
                this.state.netConnection.forEach(function (item) {
                    if (item.type === "tun") {
                        netConnection.push(item)
                    }
                    if (item.state !== "" && item.type === "tun") {
                        activeCon = item;
                    }
                });

            }
        }
        this.setState((state, props) => {
            //no active connection
            if (activeCon === null && netConnection.length > 0) {
                activeCon = netConnection[0];
            }
            this.handleConnectionChange(activeCon, {action: "select-option"});

            return {netDeviceSelected: value, netConnectionFiltered: netConnection, netConnectionFilteredSelected:activeCon};
        });
    };

    handleConnectionChange = (value, action) => {
        //on a device selection change, re-fill the connections dialog
        //and open up the applicable divs

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
          .then(state => this.setState(state))
          .then(state => this.setState({netConnectionFilteredSelected: value}))
          .then(state => this.setState({ curSettings: {
                ipaddresstype: {value: this.state.netConnectionDetails.DHCP},
                ipaddress: {value: this.state.netConnectionDetails.IP},
                subnet: {value: this.state.netConnectionDetails.subnet},
                wpaType: {value: this.state.netConnectionDetails.wpaType},
                password: {value: this.state.netConnectionDetails.password},
                ssid: {value: this.state.netConnectionDetails.ssid},
                band: {value: this.state.netConnectionDetails.band},
                mode: {value: this.state.netConnectionDetails.mode}
            }}));
        }
    };

    handleNetworkSubmit = (event) =>{
        //save network button clicked - so edit or add
        if (this.state.netConnectionFilteredSelected.value ==='new')
        {
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
                      window.alert("Network Added")
                  }
                  else {
                      window.alert("Error adding network: " + data.error)
                  }
                  //and refresh connections list
                  this.handleStart();
              })
              .catch(error => {
                     window.alert("Error adding network: " + error)
              });
        }
        else {
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
                      window.alert("Network Edited")
                  }
                  else {
                      window.alert("Error editing network: " + data.error)
                  }
                  //and refresh connections list
                  this.handleStart();
              })
              .catch(error => {
                     window.alert("Error editing network: " + error)
              });
        }
        event.preventDefault();
    };

    deleteConnection = (event) =>{
        //delete network button clicked
        if (window.confirm('Confirm you wish to delete this network')) {
            //if it's a new connection, go back to old connection
            if (this.state.netConnectionFilteredSelected.value === "new") {
                //this.handleConnectionChange(this.state.netConnection[0], {action: "select-option"});
                this.handleAdapterChange(this.state.netDeviceSelected, {action: "select-option"})
            }
            else {
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
                          window.alert("Network Deleted")
                      }
                      else {
                          window.alert("Error deleting network: " + data.error)
                      }
                      //and refresh connections list
                      this.handleStart();
                  })
                  .catch(error => {
                         window.alert("Error deleting network: " + error)
                  });
            }
        }
        event.preventDefault();
    };

    addConnection = (event) =>{
        //add new network button clicked
        const enteredName = prompt('Please enter new connection name');
        if (enteredName !== '' && enteredName !== null) {
            this.setState({netConnectionFilteredSelected: {value: 'new', label: enteredName, type: this.state.netDeviceSelected.type, state: ""}});
            //if a Wifi connection, is this an AP or client?
            if (this.state.netDeviceSelected.type === "wifi") {
                if(window.confirm('Is this an access point? (OK = Yes)')) {
                    this.setState({netConnectionFilteredSelected: {value: 'new', label: enteredName, type: this.state.netDeviceSelected.type, state: ""}});
                    //this.setState({curSettings : {mode: {value: 'ap'}}});
                    this.changeHandler({target: {name: "mode", value: "ap"}});
                }
                else {
                    this.setState({netConnectionFilteredSelected: {value: 'new', label: enteredName, type: this.state.netDeviceSelected.type, state: ""}});
                    //this.setState({curSettings : {mode: {value: 'infrastructure'}}});
                    this.changeHandler({target: {name: "mode", value: "infrastructure"}});
                }
            }
        }
        event.preventDefault();
    };

    activateConnection = (event) =>{
        //add activate network button clicked
        //if it's a new connection, don't activate
        //and refresh network information when done
        if (this.state.netConnectionFilteredSelected.value !== "new") {
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
                          window.alert("Network Activated")
                      }
                      else {
                          window.alert("Error activating network: " + data.error)
                      }
                      //and refresh connections list
                      this.handleStart();
                  })
                  .catch(error => {
                         window.alert("Error activating network: " + error)
                  });
        }
        event.preventDefault();
    };


    changeHandler = event => {
        //form change handler
        const name = event.target.name;
        const value = event.target.value;

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

    resetForm = (event) => {
        //if it's a new connection, go back to old connection
        if (this.state.netConnectionFilteredSelected.value === "new") {
            this.handleConnectionChange(this.state.netConnection[0], {action: "select-option"});
        }
        //reset the form
        this.setState({ curSettings: {
            ipaddresstype: {value: this.state.netConnectionDetails.DHCP},
            ipaddress: {value: this.state.netConnectionDetails.IP},
            subnet: {value: this.state.netConnectionDetails.subnet},
            wpaType: {value: this.state.netConnectionDetails.wpaType},
            password: {value: this.state.netConnectionDetails.password},
            ssid: {value: this.state.netConnectionDetails.ssid},
            band: {value: this.state.netConnectionDetails.band},
            mode: {value: this.state.netConnectionDetails.mode}
        }});
    }

    render() {
      return (
        <div>
            <Helmet>
              <title>Network Configuration</title>
            </Helmet>
            <h1>Network Configuration</h1>
            Adapters: <Select onChange={this.handleAdapterChange} options={this.state.netDevice} value={this.state.netDeviceSelected}/>
            Connections: <Select onChange={this.handleConnectionChange} options={this.state.netConnectionFiltered} value={this.state.netConnectionFilteredSelected}/>
            <button onClick={this.deleteConnection} disabled={this.state.netConnectionFilteredSelected !== null && this.state.netConnectionFilteredSelected.type === "tun"} nameclass="deleteConnection">Delete</button>
            <button onClick={this.addConnection} disabled={this.state.netConnectionFilteredSelected !== null && this.state.netConnectionFilteredSelected.type === "tun"} nameclass="addConnection">Add new</button>
            <button onClick={this.activateConnection} nameclass="activateConnection">Activate</button>
            <form onSubmit={this.handleNetworkSubmit}>
                <div nameclass="ipconfig" style={{ display: (this.state.showIP && this.state.curSettings.mode.value !== "adhoc" && this.state.curSettings.mode.value !== "ap") ? "block" : "none" }}><h3>IP Address</h3>
                    <label><input type="radio" name="ipaddresstype" value="auto" onChange={this.changeHandler} checked={this.state.curSettings.ipaddresstype.value === "auto"}/>DHCP</label>
                    <label><input type="radio" name="ipaddresstype" value="manual" onChange={this.changeHandler} checked={this.state.curSettings.ipaddresstype.value === "manual"}/>Static IP</label>
                    <br />
                    <label><input type="text" name="ipaddress" disabled={this.state.curSettings.ipaddresstype.value === "auto"} onChange={this.changeHandler} value={this.state.curSettings.ipaddress.value}/>IP Address</label>
                    <br />
                    <label><input type="text" name="subnet" disabled={this.state.curSettings.ipaddresstype.value === "auto"} onChange={this.changeHandler} value={this.state.curSettings.subnet.value}/>Subnet Mask</label>
                </div>
                <div nameclass="wificlientconfig" style={{ display: this.state.curSettings.mode.value === "infrastructure" ? "block" : "none" }}><h3>Wifi Client</h3>
                    <label><input name="ssid" onChange={this.changeHandler} value={this.state.curSettings.ssid.value} type="text"/>SSID Name</label>
                    <br />
                    <label>
                        <select name="wpaType" value={this.state.curSettings.wpaType.value} onChange={this.changeHandler}>
                            {this.state.wpaTypes.map((option, index) => (
                                <option key={option.value} value={option.value}>{option.text}</option>
                            ))}
                        </select>
                    Security</label>
                    <br />
                    <label><input name="password" type="text" disabled={this.state.curSettings.wpaType.value === "wpa-none"} value={this.state.curSettings.wpaType.value === "wpa-none" ? '' : this.state.curSettings.password.value} onChange={this.changeHandler}/>Password</label>
                </div>
                <div nameclass="wifiapconfig" style={{ display: (this.state.curSettings.mode.value === "ap" ||  this.state.curSettings.mode.value === "adhoc")? "block" : "none" }}><h3>Wifi Access Point</h3>
                    <label><input name="ssid" onChange={this.changeHandler} value={this.state.curSettings.ssid.value} type="text"/>SSID Name</label>
                    <br />
                    <label>
                        <select name="band" onChange={this.changeHandler} value={this.state.curSettings.band.value}>
                            {this.state.bandTypes.map((option, index) => (
                                <option key={option.value} value={option.value}>{option.text}</option>
                            ))}
                        </select>
                    Band</label>
                    <br />
                    <label>
                        <select name="wpaType" value={this.state.curSettings.wpaType.value} onChange={this.changeHandler}>
                            {this.state.wpaTypes.map((option, index) => (
                                <option key={option.value} value={option.value}>{option.text}</option>
                            ))}
                        </select>
                    Security</label>
                    <br />
                    <label><input name="password" type="text" disabled={this.state.curSettings.wpaType.value === "wpa-none"} value={this.state.curSettings.wpaType.value === "wpa-none" ? '' : this.state.curSettings.password.value} onChange={this.changeHandler}/>Password</label>
                    <br />
                    <label><input name="ipaddress" onChange={this.changeHandler} value={this.state.curSettings.ipaddress.value} type="text"/>Starting IP address</label>
                </div>
                <input type="submit" disabled={this.state.netConnectionFilteredSelected !== null && this.state.netConnectionFilteredSelected.type === "tun"} value="Save Changes" />
                <input type="button" value="Discard Changes" onClick={this.resetForm}/>
            </form>
        </div>
      );
    }
}

export default NetworkConfig;
