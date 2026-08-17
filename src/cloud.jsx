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
      uploadEnabled: false,
      uploadLogs: true,
      uploadMedia: true,
      binUploadLink: '',
      uploadStatus: 'N/A',
      syncDeletions: false,
      windowsDestination: false,
      onlyWhenDisarmed: false,
      vehicleArmedState: 'unknown',
      pubkey: []
    }

    //Socket.io client for reading in analog update values
    this.socket.on('CloudUploadStatus', function (msg) {
      this.setState({ uploadStatus: msg })
    }.bind(this))
    this.socket.on('CloudVehicleArmedState', function (msg) {
      this.setState({ vehicleArmedState: msg })
    }.bind(this))
    this.socket.on('reconnect', function () {
      //refresh state
      this.componentDidMount()
    }.bind(this))
  }

  componentDidMount () {
    fetch('/api/cloudinfo', {headers: {Authorization: `Bearer ${this.state.token}`}})
      .then(response => response.json())
      .then(state => { this.setState(state); this.loadDone() })
      .catch(err => {
        console.error('Failed to load cloud info:', err);
        this.setState({ error: err.message });
        this.loadDone();
      })
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

  toggleWindowsDestination = event => {
    this.setState({ windowsDestination: event.target.checked });
  }

  toggleOnlyWhenDisarmed = event => {
    this.setState({ onlyWhenDisarmed: event.target.checked });
  }

  toggleUploadLogs = event => {
    this.setState({ uploadLogs: event.target.checked });
  }

  toggleUploadMedia = event => {
    this.setState({ uploadMedia: event.target.checked });
  }

  handleToggleUploadSubmit = () => {
    //user clicked enable/disable cloud upload
    fetch('/api/binlogupload', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.state.token}`
        },
        body: JSON.stringify({
            binUploadLink: this.state.binUploadLink,
            uploadEnabled: !this.state.uploadEnabled,
            uploadLogs: this.state.uploadLogs,
            uploadMedia: this.state.uploadMedia,
            syncDeletions: this.state.syncDeletions,
            windowsDestination: this.state.windowsDestination,
            onlyWhenDisarmed: this.state.onlyWhenDisarmed,
        })
      })
      .then(response => response.json())
      .then(state => { this.setState(state) })
      .catch(err => {
        console.error('Failed to update cloud upload settings:', err);
        this.setState({ error: err.message });
      });
  }

  renderTitle () {
    return 'Cloud Upload'
  }

  renderContent () {
    return (
            <div>
              <p><i>Automatically upload flight logs and/or media to a remote (network) destination over an ssh connection</i></p>
                <h3>Cloud Upload</h3>
                <p>Selected items are synchronised to the remote destination below using rsync, every 20 seconds. Logs (Flight Logs -&gt; Bin Logs) are synced to the destination itself; Media (photos/videos) is synced to a <code>media</code> subfolder there.</p>
                <p>Destination format is <code>username@server:/path/to/remote/dir</code>, where <code>username</code> has an ssh publickey on the remote server.</p>
                <Form style={{ width: 700 }}>
                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                        <label className="col-sm-3 col-form-label">Rsync Destination</label>
                        <div className="col-sm-7">
                            <input type="text" className="form-control" name="binUploadLink" disabled={this.state.uploadEnabled === true ? true : false} onChange={this.changeHandler} value={this.state.binUploadLink}/>
                        </div>
                    </div>
                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                        <label className="col-sm-3 col-form-label">Sync file deletions</label>
                        <div className="col-sm-7">
                        <input name="syncDeletions" type="checkbox" disabled={this.state.uploadEnabled === true ? true : false} checked={this.state.syncDeletions} onChange={this.toggleSyncDelete}/>
                        </div>
                    </div>
                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                        <label className="col-sm-3 col-form-label">Destination is Windows</label>
                        <div className="col-sm-7">
                        <input name="windowsDestination" type="checkbox" disabled={this.state.uploadEnabled === true ? true : false} checked={this.state.windowsDestination} onChange={this.toggleWindowsDestination}/>
                        </div>
                    </div>
                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                        <label className="col-sm-3 col-form-label">Only upload while disarmed</label>
                        <div className="col-sm-7" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input name="onlyWhenDisarmed" type="checkbox" disabled={this.state.uploadEnabled === true ? true : false} checked={this.state.onlyWhenDisarmed} onChange={this.toggleOnlyWhenDisarmed}/>
                        <span>Vehicle state: {this.state.vehicleArmedState.charAt(0).toUpperCase() + this.state.vehicleArmedState.slice(1)}</span>
                        </div>
                    </div>
                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                        <label className="col-sm-3 col-form-label">Upload</label>
                        <div className="col-sm-7" style={{ display: 'flex', gap: '24px' }}>
                          <Form.Check inline type="checkbox" label="Logs" name="uploadLogs" disabled={this.state.uploadEnabled === true ? true : false} checked={this.state.uploadLogs} onChange={this.toggleUploadLogs}/>
                          <Form.Check inline type="checkbox" label="Media" name="uploadMedia" disabled={this.state.uploadEnabled === true ? true : false} checked={this.state.uploadMedia} onChange={this.toggleUploadMedia}/>
                        </div>
                    </div>

                    <div className="form-group row" style={{ marginBottom: '5px' }}>
                        <div className="col-sm-10">
                        <Button onClick={this.handleToggleUploadSubmit} className="btn btn-primary">{this.state.uploadEnabled === true ? 'Disable' : 'Enable'}</Button>
                        </div>
                    </div>
                    <p>Status: {this.state.uploadStatus}</p>
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
