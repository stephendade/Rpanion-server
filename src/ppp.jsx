import React from 'react';
import { Card, Form, Button, Alert } from 'react-bootstrap';
import Select from 'react-select';
import basePage from './basePage.jsx';
import IPAddressInput from './components/IPAddressInput.jsx';

import './css/styles.css';

class PPPPage extends basePage {
    constructor(props, useSocketIO = true) {
        super(props, useSocketIO);
        this.state = {
            ...this.state,
            pppStatus: "",
            config: {
                enabled: false,
                selDevice: null,
                selBaudRate: 115200,
                serialDevices: [],
                baudRates: [],
                localIP: '',
                remoteIP: '',
            },
        };
    }

    componentDidMount() {
        this.fetchPPPStatus();
    }

    fetchPPPStatus = async () => {
        try {
            const response = await fetch('/api/pppstatus');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            this.setState({ config: data});
            this.loadDone();
        } catch (error) {
            this.setState({ error: 'Failed to fetch PPP status', isLoading: false });
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

    handleBaudrateChange = (value) => {
        this.setState(prevState => ({
            config: {
                ...prevState.config,
                selBaudRate: value
            }
        }));
    }

    handleUartChange = (value) => {
        this.setState(prevState => ({
            config: {
                ...prevState.config,
                selDevice: value
            }
        }));
    }

    handleSubmit = async (event) => {
        event.preventDefault();
        try {
            const response = await fetch('/api/pppmodify', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.state.token}`
                },
                body: JSON.stringify({
                    device: JSON.stringify(this.state.config.selDevice),
                    baudrate: JSON.stringify(this.state.config.selBaudRate),
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
                            <Select isDisabled={this.state.config.enabled === true} onChange={this.handleUartChange} options={this.state.config.serialDevices} value={this.state.config.selDevice} />
                        </div>
                    </div>
                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                        <label className="col-sm-4 col-form-label">Baudrate</label>
                        <div className="col-sm-5">
                            <Select isDisabled={this.state.config.enabled === true} onChange={this.handleBaudrateChange} options={this.state.config.baudRates} value={this.state.config.selBaudRate} />
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
            <p>{this.state.pppStatus}</p>
        </div>
        );
    }
}

export default PPPPage;
