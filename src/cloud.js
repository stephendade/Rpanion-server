import React from 'react'
import Button from 'react-bootstrap/Button'
import Form from 'react-bootstrap/Form'

import basePage from './basePage.js'

import './css/styles.css'

class CloudConfig extends basePage {
  constructor (props, useSocketIO = true) {
    super(props, useSocketIO)
    this.state = {
      loading: true,
      waiting: false,
      error: null,
      infoMessage: null,
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
    fetch('/api/cloudinfo').then(response => response.json()).then(state => { this.setState(state); this.loadDone() })
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

  handleDoBinUploadSubmit = event => {
    //user clicked enable/disable bin file upload
    fetch('/api/binlogupload', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
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
                <h3>Bin Logs Upload</h3>
                <p>All bin logs (in Flight Logs -> Bin Logs) will be synchonised to the following rsync destination.</p>
                <p>Format is username@server:/path/to/remote/dir</p>
                <Form style={{ width: 600 }}>
                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                        <label className="col-sm-3 col-form-label">AP:Cloud Rsync</label>
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
                  <div style={{ fontFamily: "monospace", width: 600 }}>
                  <hr/>
                    {this.state.pubkey.map(item => {
                      return (
                          <div>
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
