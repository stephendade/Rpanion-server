import React from 'react';
import { Card, Form, Button, Alert } from 'react-bootstrap';
import basePage from './basePage.jsx';
import IPAddressInput from './components/IPAddressInput.jsx';

import './css/styles.css';

class PPPPage extends basePage {
    constructor(props, useSocketIO = true) {
        super(props, useSocketIO);
        this.state = {
            ...this.state,
            PPPStatus: "",
            config: {
                enabled: false,
                selDevice: 0,
                selBaudRate: 115200,
                serialDevices: [],
                baudRates: [],
                localIP: '',
                remoteIP: '',
            },
        };

        //Socket.io client for reading in update values
        this.socket.on('PPPStatus', function (msg) {
            this.setState({ PPPStatus: msg });
        }.bind(this));

        this.socket.on('reconnect', function () {
            //refresh state
            this.componentDidMount();
        }.bind(this));
    }

    componentDidMount() {
        this.fetchPPPConfig();
    }

    fetchPPPConfig = async () => {
        try {
            const response = await fetch('/api/pppconfig', {headers: {Authorization: `Bearer ${this.state.token}`}});
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            this.setState({ config: data});
            this.loadDone();
        } catch (error) {
            this.setState({ error: 'Failed to fetch PPP config', isLoading: false });
        }
    };

    handleConfigChange = (selectedOption, actionMeta) => {
        const name = actionMeta?.name || selectedOption?.target?.name;
        const value = actionMeta ? selectedOption : selectedOption?.target?.value;
        this.setState(prevState => ({
            config: {
                ...prevState.config,
                [name]: value
            }
        }));
    };

    handleBaudrateChange = (event) => {
        this.setState(prevState => ({
            config: {
                ...prevState.config,
                selBaudRate: event.target.value
            }
        }));
    }

    handleUartChange = (event) => {
        this.setState(prevState => ({
            config: {
                ...prevState.config,
                selDevice: event.target.value
            }
        }));
    }

    handleSubmit = async (event) => {
        event.preventDefault();
        try {
            //get the pnpid of the selected device
            let selectedDevice = this.state.config.serialDevices.find(device => device.value === this.state.config.selDevice);

            const response = await fetch('/api/pppmodify', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.state.token}`
                },
                body: JSON.stringify({
                    device: selectedDevice.value,
                    baudrate: this.state.config.selBaudRate,
                    localIP: this.state.config.localIP,
                    remoteIP: this.state.config.remoteIP,
                    enabled: !this.state.config.enabled
                })
            });
            if (!response.ok && response.json) {
                const data = await response.json();
                this.setState({ error: data.error || 'Failed to update PPP configuration' });
            } else {
                const data = await response.json();
                // if error is present in the response, set it in state
                if (data.error) {
                    this.setState({ error:  data.error });
                } else {
                    this.setState({ error: null });
                }
                this.setState({ config: data.settings});
            }
            
        } catch (error) {
            console.error('Error updating PPP configuration:', error);
            this.setState({ error: 'Failed to update PPP configuration' });
        }
    };

    renderTitle() {
        return "PPP Configuration";
    }

    renderContent() {
        return (
        <div>
            <p><i>Configure a PPP connection to the flight controller. Requires SERIALn_PROTOCOL=48</i></p>
            <p><i>Hardware flow control support is required on the Companion UART</i></p>
            <h2>Configuration</h2>
                <Form style={{ width: 600 }}>
                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                        <label className="col-sm-4 col-form-label">UART Port</label>
                        <div className="col-sm-7">
                            <Form.Select disabled={this.state.config.enabled === true} onChange={this.handleUartChange} value={this.state.config.selDevice}>
                                {this.state.config.serialDevices.map((device, index) => (
                                    <option key={index} value={device.value}>{device.label}</option>
                                ))}
                            </Form.Select>
                        </div>
                    </div>
                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                        <label className="col-sm-4 col-form-label">Baudrate</label>
                        <div className="col-sm-5">
                            <Form.Select disabled={this.state.config.enabled === true} onChange={this.handleBaudrateChange} value={this.state.config.selBaudRate}>
                                {this.state.config.baudRates.map((rate, index) => (
                                    <option key={index} value={rate.value}>{rate.label}</option>
                                ))}
                            </Form.Select>
                        </div>
                    </div>
                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                        <label className="col-sm-4 col-form-label">Local IP Address</label>
                        <div className="col-sm-7">
                            <IPAddressInput
                            name="localIP"
                            value={this.state.config.localIP || ''}
                            onChange={this.handleConfigChange}
                            disabled={this.state.config.enabled === true}
                            />
                        </div>
                    </div>
                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                        <label className="col-sm-4 col-form-label">Remote IP Address</label>
                        <div className="col-sm-7">
                            <IPAddressInput
                            name="remoteIP"
                            value={this.state.config.remoteIP || ''}
                            onChange={this.handleConfigChange}
                            disabled={this.state.config.enabled === true}
                            />
                        </div>
                    </div>
                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                        <div className="col-sm-10">
                            <Button onClick={this.handleSubmit} className="btn btn-primary">{this.state.config.enabled === true ? "Disable" : "Enable"}</Button>
                        </div>
                      </div>
                </Form>
            <h2>Status</h2>
            <p>{this.state.PPPStatus}</p>
        </div>
        );
    }
}

export default PPPPage;
