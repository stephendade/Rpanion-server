import React, { Component } from 'react';
import { Helmet } from 'react-helmet';
import BootstrapTable from 'react-bootstrap-table-next';


/*
 * Display all the MCP3008 analog ports
 */

class analog extends Component {
    constructor(props) {
        super(props);
        this.state = {
            portStatus: [],
        }

        this.columns = [{
            dataField: 'port',
            text: 'Analog Port'
        }, {
            dataField: 'mv',
            text: 'Value (mV)',
        }, {
            dataField: 'number',
            text: 'Value (10-bit)',
        }];
    }

    componentDidMount() {
        this.handleStart();
     }

    handleStart() {
        fetch(`/api/analogports`)
          .then(response => response.json())
          .then(state => this.setState(state));
      }

    render() {
        return (
            <div>
                <Helmet>
                  <title>The Analog Page</title>
                </Helmet>
              <h1>Analog Port Monitoring</h1>
              <BootstrapTable condensed keyField='port' data={ this.state.portStatus } columns={ this.columns }/>
            </div>
        );
    }
}

export default analog;
