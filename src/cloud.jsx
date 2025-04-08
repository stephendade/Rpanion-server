import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'
import React from 'react'

import basePage from './basePage.jsx'

import './css/styles.css'

class CloudConfig extends basePage {
  constructor (props, useSocketIO = true) {
    super(props, useSocketIO)
    this.state = {
      ...this.state,
      doBinUpload: false,
      binUploadLink: '',
      binLogStatus: 'N/A',
      syncDeletions: false,
      pubkey: []
    }

    //Socket.io client for reading in analog update values
    this.socket.on('CloudBinStatus', function (msg) {
      this.setState({ binLogStatus: msg })
    }.bind(this))
    this.socket.on('reconnect', function () {
      //refresh state
      this.componentDidMount()
    }.bind(this))
  }

  componentDidMount () {
    fetch('/api/cloudinfo', {headers: {Authorization: `Bearer ${this.state.token}`}}).then(response => response.json()).then(state => { this.setState(state); this.loadDone() })
  }

  changeHandler = event => {
    // form change handler
    const name = event.target.name
    const value = event.target.value

    this.setState({
      [name]: value
    })
  }

  toggleSyncDelete = event => {
    this.setState({ syncDeletions: event.target.checked });
  }

  handleDoBinUploadSubmit = () => {
    //user clicked enable/disable bin file upload
    fetch('/api/binlogupload', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.state.token}`
        },
        body: JSON.stringify({
            binUploadLink: this.state.binUploadLink,
            doBinUpload: !this.state.doBinUpload,
            syncDeletions: this.state.syncDeletions,
        })
      }).then(response => response.json()).then(state => { this.setState(state) });
  }

  renderTitle () {
    return 'Cloud Upload'
  }

  renderContent () {
    return (
            <div>
              <p><i>Automatically upload binlogs from the &quot;Flight Logs&quot; page to a remote (network) destination over an ssh connection</i></p>
                <h3>Bin Logs Upload</h3>
                <p>All bin logs (in Flight Logs -&gt; Bin Logs) will be synchonised to the following remote destination using rsync.</p>
                <p>The synchonisation runs every 20 seconds.</p>
                <p>Destination format is <code>username@server:/path/to/remote/dir</code>, where <code>username</code> has an ssh publickey on the remote server.</p>
                <Form style={{ width: 700 }}>
                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                        <label className="col-sm-3 col-form-label">Rsync Destination</label>
                        <div className="col-sm-7">
                            <input type="text" className="form-control" name="binUploadLink" disabled={this.state.doBinUpload === true ? true : false} onChange={this.changeHandler} value={this.state.binUploadLink}/>
                        </div>
                    </div>
                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                        <label className="col-sm-3 col-form-label">Sync file deletions</label>
                        <div className="col-sm-7">
                        <input name="syncDeletions" type="checkbox" disabled={this.state.doBinUpload === true ? true : false} checked={this.state.syncDeletions} onChange={this.toggleSyncDelete}/>
                        </div>
                    </div>
                    
                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                        <div className="col-sm-10">
                        <Button onClick={this.handleDoBinUploadSubmit} className="btn btn-primary">{this.state.doBinUpload === true ? 'Disable' : 'Enable'}</Button>
                        </div>
                    </div>
                    <p>Status: {this.state.binLogStatus}</p>
                </Form>
                <h3>Publickeys</h3>
                <p><i>All publickeys on this device</i></p>
                <p>One of the below keys must be added to <code>~/.ssh/authorized_keys</code> on the remote server</p>
                  <div style={{ fontFamily: "monospace", width: 700, wordWrap: 'break-word' }}>
                  <hr/>
                    {this.state.pubkey.map(item => {
                      return (
                          <div key={item}>
                            <p>{ item }</p>
                            <hr/>
                          </div>
                          );
                    })}
                  </div>
            </div>
    )
  }
}

export default CloudConfig
