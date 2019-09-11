import React, { Component } from 'react';
import { Helmet } from 'react-helmet';
import BootstrapTable from 'react-bootstrap-table-next';
import io from 'socket.io-client';

/*
 * Display all the MCP3008 analog ports
 */

class analog extends Component {
    constructor(props) {
        super(props);
        this.state = {
            portStatus: [],
            errormessage: ""
        }

        var socket = io();

        this.columns = [{
            dataField: 'port',
            sort: true,
            text: 'Analog Port'
        }, {
            dataField: 'mv',
            text: 'Value (mV)',
        }, {
            dataField: 'number',
            text: 'Value (10-bit)',
        }];

        // Socket.io client for reading in analog update values
        socket.on('analogstatus', function(msg){
            this.setState(msg);
        }.bind(this));
    }

    componentDidMount() {
    }

    componentWillUnmount() {
    }

    render() {
        return (
            <div>
                <Helmet>
                  <title>The Analog Page</title>
                </Helmet>
              <h1>Analog Port Monitoring</h1>
              <BootstrapTable condensed keyField='port' data={ this.state.portStatus } columns={ this.columns }/>
              <p>{this.state.errormessage}</p>
            </div>
        );
    }
}

export default analog;
