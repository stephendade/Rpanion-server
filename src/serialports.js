import React, { Component } from 'react';
import { Helmet } from 'react-helmet';
import BootstrapTable from 'react-bootstrap-table-next';
import cellEditFactory from 'react-bootstrap-table2-editor';
import { Type } from 'react-bootstrap-table2-editor';
import PropTypes from 'prop-types';

import 'react-bootstrap-table-next/dist/react-bootstrap-table2.min.css';

class SerialPorts extends Component {
  constructor(props) {
    super(props);
    this.state = {
      portStatus: [],
      ifaces: []
    };
    
    this.baudRates = [{value: '9600', label: '9600'},
					  {value: '19200', label: '19200'},
					  {value: '38400', label: '38400'},
					  {value: '57600', label: '57600'},
					  {value: '115200', label: '115200'},
					  {value: '230400', label: '230400'},
					  {value: '460800', label: '460800'},
					  {value: '921600', label: '921600'}];
    this.remoteCon = [{value: 'TCP', label: 'TCP'}, {value: 'UDP', label: 'UDP'}];
    this.portStatus = [{value: 'Started', label: 'Started'}, {value: 'Stopped', label: 'Stopped'}];
	
	this.columns = [{
	  dataField: 'name',
	  text: 'Serial Port'
	}, {
	  dataField: 'baud',
	  text: 'Baud Rate',
	  editor: {
		type: Type.SELECT,
		options: this.baudRates
	  }
	}, {
	  dataField: 'contype',
	  text: 'IP Connection Type',
	  editor: {
		type: Type.SELECT,
		options: this.remoteCon
	  }
	}, {
	  dataField: 'conIP',
	  text: 'Connection IP',
	  editor: {
		type: Type.SELECT,
		getOptions: () => this.state.ifaces
	  }
	}, {
	  dataField: 'conPort',
	  text: 'Connection Port',
	  editorRenderer: (editorProps, value, row, column, rowIndex, columnIndex) => (
					   <PortRanger { ...editorProps } value={ value } />)
	}, {
	  dataField: 'status',
	  text: 'Connection Status',
	  editor: {
		type: Type.SELECT,
		options: this.portStatus
	  }
	}];

  
  }

	componentDidMount() {
		this.handleStart();
	 }

	handleStart() {
		fetch(`/api/portstatus`)
		  .then(response => response.json())
		  .then(state => this.setState(state));
	  }
  

	afterSave(oldValue, newValue, row, column) {
		if (oldValue === newValue) {
			return;
		}
		fetch('/api/portmodify', {
			method: 'POST',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				user: {
					name: row.name,
					field: column.dataField,
					newValue: newValue,
				}
			 })
		});
	}


  render() {
    return (
    <div>
		<Helmet>
			<title>Serial Ports</title>
        </Helmet>
		<h1>Serial Ports</h1>
		<p>Connected Ports are:</p>
		<BootstrapTable condensed keyField='name' data={ this.state.portStatus } columns={ this.columns } cellEdit={ cellEditFactory({ blurToSave: true, mode: 'click', afterSaveCell: this.afterSave }) }/>
    </div>
    );
  }
}

class PortRanger extends React.Component {
  static propTypes = {
    value: PropTypes.number,
    onUpdate: PropTypes.func.isRequired
  }
  static defaultProps = {
    value: 0
  }
  getValue() {
    return parseInt(this.range.value, 10);
  }
  render() {
    const { value, onUpdate, ...rest } = this.props;
    return [
      <input
        { ...rest }
        key="number"
        ref={ node => this.range = node }
        type="number"
        min="1000"
        max="40000"
        onClick={ () => onUpdate(this.getValue()) }
      />
    ];
  }
}
export default SerialPorts;
