import React from 'react';

import basePage from './basePage.js';

import './css/styles.css';

class LoggerPage extends basePage {
    constructor(props) {
        super(props);
        this.state = {
            loading: false,
            waiting: false,
            TlogFiles: [],
            BinlogFiles: [],
            logStatus: "",
            enablelogging: false,
            error: null,
            infoMessage: null,
            diskSpaceStatus: ""
        };
    }

    componentDidMount() {
        fetch(`/api/logfiles`).then(response => response.json()).then(state => {this.setState(state); this.loadDone()});
        fetch(`/api/diskinfo`).then(response => response.json()).then(state => {this.setState(state)});
    }

    renderTitle() {
        return "Flight Log Browser";
    }

    //create a html table from a list of logfiles
    renderLogTableData(logfilelist) {
        return logfilelist.map((log, index) => {
            return (
                <tr key={log.key}>
                    <td><a href={this.state.url + "/logdownload/" + log.key} download>{log.name}</a></td>
                    <td>{log.size} KB</td>
                    <td>{log.modified}</td>
                </tr>
            )
        });
    }

    clearLogs = (event) => {
        //this.setState((state) => ({ value: state.value + 1}));
        const id = event.target.id;
        this.setState({ waiting: true}, () => {
            fetch('/api/deletelogfiles', {
              method: 'POST',
              headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                  logtype: id,
              })
            }).then(response => response.json())
              .then(result => {
                  this.componentDidMount();
                  this.setState({waiting: false});
              })
              .catch(error => {
                  this.setState({waiting: false, error: "Error deleting logfiles: " + error});
              });
        });
        event.preventDefault();
    }

    startLog = (event) => {
        this.setState({ waiting: true }, () => {
            fetch('/api/newlogfile').then(response => response.json())
                                        .then(result => {
                                            this.componentDidMount();
                                            this.setState({waiting: false});
                                        })
                                        .catch(error => {
                                            this.setState({waiting: false, error: "Error creating logfile: " + error});
                                        });
        });
        event.preventDefault();
    }

    handleCheckboxChange = event => {
        //this.setState({enablelogging: !this.state.enablelogging});
        this.setState({ waiting: true }, () => {
            fetch('/api/logenable', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    enable: !this.state.enablelogging,
                })
            }).then(response => response.json())
                                .then(result => {
                                    this.componentDidMount();
                                    this.setState({waiting: false});
                                })
                                .catch(error => {
                                    this.setState({waiting: false, error: "Error setting logging: " + error});
                                });
        });
        event.preventDefault();
    }

    renderContent() {
        return (
        <div>
            <p>Logging Status: {this.state.logStatus}</p>
            <p>Disk Space: {this.state.diskSpaceStatus}</p>
            <h3>Telemetry Logs</h3>
            <label><input type="checkbox" checked={this.state.enablelogging} onChange={this.handleCheckboxChange} />Enable Telemetry Logging</label>
            <button onClick={this.startLog}>Start new telemetry log</button>
            <button id='tlog' onClick={this.clearLogs}>Clear inactive logs</button>
            <table id='Tlogfile'>
                <thead>
                    <tr><th>File Name</th><th>Size</th><th>Modified</th></tr>
                </thead>
                <tbody>
                    {this.renderLogTableData(this.state.TlogFiles)}
                </tbody>
            </table>
            <br />
            <h3>Bin Logs</h3>
            <p>This requires the LOG_BACKEND_TYPE parameter in ArduPilot set to "Mavlink".</p>
            <button id='binlog' onClick={this.clearLogs}>Clear inactive logs</button>
            <table id='Binlogfile'>
                <thead>
                    <tr><th>File Name</th><th>Size</th><th>Modified</th></tr>
                </thead>
                <tbody>
                    {this.renderLogTableData(this.state.BinlogFiles)}
                </tbody>
            </table>
        </div>
        );
    }
}


export default LoggerPage;
