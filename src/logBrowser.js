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
            logStatus: "",
            enablelogging: false
        };
    }

    componentDidMount() {
        fetch(`/api/logfiles`).then(response => response.json()).then(state => {this.setState(state); this.loadDone()});
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
        this.setState({ waiting: true }, () => {
            fetch('/api/deletelogfiles').then(response => response.json())
                                        .then(result => {
                                            this.componentDidMount();
                                            this.setState({waiting: false});
                                        })
                                        .catch(error => {
                                            window.alert("Error deleting logfiles: " + error);
                                            this.setState({waiting: false});
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
                                            window.alert("Error creating logfile: " + error);
                                            this.setState({waiting: false});
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
                                    window.alert("Error setting logging: " + error);
                                    this.setState({waiting: false});
                                });
        });
        event.preventDefault();
    }

    renderContent() {
        return (
        <div>
            <h3>Telemetry Logs</h3>
            <p>Logging Status: {this.state.logStatus}</p>
            <button onClick={this.clearLogs}>Clear inactive logs</button>
            <button onClick={this.startLog}>Start new logfile</button>
            <label><input type="checkbox" checked={this.state.enablelogging} onChange={this.handleCheckboxChange} />Enable Logging</label>
            <table id='Tlogfile'>
                <thead>
                    <tr><th>Log File</th><th>Size</th><th>Modified</th></tr>
                </thead>
                <tbody>
                    {this.renderLogTableData(this.state.TlogFiles)}
                </tbody>
            </table>
        </div>
        );
    }
}


export default LoggerPage;
