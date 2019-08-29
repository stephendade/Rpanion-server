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
      wpaTypes: ['none', 'ieee8021x', 'wpa-none', 'wpa-psk', 'sae', 'wpa-eap'],
      bandTypes: ['a', 'bg']
    };
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
          .then(state => this.setState({netConnectionFilteredSelected: value}));
        }

    };

    handleIPTypeChange = (event) => {
        //IP type radio buttons changed
        this.setState({netConnectionDetails: {...this.state.netConnectionDetails, DHCP: event.target.value}});

        //this.setState((state) => {
        //    console.log(event.target.value);
        //    return {netConnectionDetails: {...state.netConnectionDetails, DHCP: event.target.value}};
        //});

    };

    render() {
      return (
        <div>
            <Helmet>
              <title>Network Configuration</title>
            </Helmet>
            <h1>Network Configuration</h1>
            Adapters: <Select onChange={this.handleAdapterChange} options={this.state.netDevice} value={this.state.netDeviceSelected}/>
            Connections: <Select onChange={this.handleConnectionChange} options={this.state.netConnectionFiltered} value={this.state.netConnectionFilteredSelected}/>
                    <div nameclass="ipconfig" style={{ display: (this.state.showIP && this.state.netConnectionDetails.mode !== "adhoc" && this.state.netConnectionDetails.mode !== "ap") ? "block" : "none" }}><h3>IP Address</h3>
                        <label><input type="radio" name="ip-type" value="auto" onChange={this.handleIPTypeChange} checked={this.state.netConnectionDetails.DHCP === "auto"}/>DHCP</label>
                        <label><input type="radio" name="ip-type" value="manual" onChange={this.handleIPTypeChange} checked={this.state.netConnectionDetails.DHCP === "manual"}/>Static IP</label>
                        <br />
                        <label><input type="text" disabled={this.state.netConnectionDetails.DHCP === "auto"} defaultValue={this.state.netConnectionDetails.IP || ''}/>IP Address</label>
                        <br />
                        <label><input type="text" disabled={this.state.netConnectionDetails.DHCP === "auto"} defaultValue={this.state.netConnectionDetails.subnet || ''}/>Subnet Mask</label>
                    </div>
                    <div nameclass="wificlientconfig" style={{ display: this.state.netConnectionDetails.mode === "infrastructure" ? "block" : "none" }}><h3>Wifi Client</h3>
                        <label>
                            <select value={this.state.netConnectionDetails.wpaType}>
                                {this.state.wpaTypes.map((option, index) => (
                                    <option key={index} value={option}>{option}</option>
                                ))}
                            </select>
                        Security</label>
                        <br />
                        <label><input type="text"  defaultValue={this.state.netConnectionDetails.password || ''}/>Password</label>
                    </div>
                    <div nameclass="wifiapconfig" style={{ display: (this.state.netConnectionDetails.mode === "ap" ||  this.state.netConnectionDetails.mode === "adhoc")? "block" : "none" }}><h3>Wifi AP</h3>
                        <label><input type="text" defaultValue={this.state.netConnectionDetails.ssid || ''}/>SSID Name</label>
                        <br />
                        <label>
                            <select value={this.state.netConnectionDetails.band || ''}>
                                {this.state.bandTypes.map((option, index) => (
                                    <option key={index} value={option}>{option}</option>
                                ))}
                            </select>
                        Band</label>
                        <br />
                        <label><input value={this.state.netConnectionDetails.password || ''} type="text"/>Password</label>
                        <br />
                        <label><input value={this.state.netConnectionDetails.IP_AP || ''} type="text"/>Starting IP address</label>
                    </div>
        </div>
      );
    }
}

export default NetworkConfig;
