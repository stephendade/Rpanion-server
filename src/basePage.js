import React, { Component } from 'react';
import { Helmet } from 'react-helmet'
import io from 'socket.io-client';
import SocketIOFooter from './footerSocketIO';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Spinner from  'react-bootstrap/Spinner';

class basePage extends Component {
    constructor(props, useSocketIO=false) {
        super(props);
        this.state = {
            loading: true,
            waiting: false,
            socketioStatus: false,
            usedSocketIO: useSocketIO
        }

        if(this.state.usedSocketIO) {
            this.socket = io();

            // Socket.io client
            this.socket.on('disconnect', function(){
                console.log('Disconnected');
                this.setState({socketioStatus: false});
            }.bind(this));
            this.socket.on('connect', function(){
                console.log('Connected');
                this.setState({socketioStatus: true});
            }.bind(this));
        }
    }

    loadDone() {
        this.setState({loading: false});
    }

    componentWillUnmount() {
        if(this.state.usedSocketIO) {
            this.socket.disconnect();
        }
    }


    handleCloseError = event => {
      // user has closed the error window
      this.setState({ error: null});
    }

    handleCloseInformation = event => {
      // user has closed the information window
      this.setState({ infoMessage: null});
    }

    render() {
        let { loading, usedSocketIO, socketioStatus, waiting, error, infoMessage } = this.state;
        return (
          <div>
            <Helmet>
                <title>{this.renderTitle()}</title>
            </Helmet>
            <h1>{this.renderTitle()}</h1>
                <div style={{display: (loading) ? "block" : "none"}}>
                  <Spinner animation="border" role="status" >
                  </Spinner>
                  <p><span className="sr-only" size={35}>Loading...</span></p>
                </div>

                <div className='sweet-waiting' style={{display: (waiting) ? "block" : "none", "textAlign": "center", "position": "fixed", "width": "100%", "height": "100%", "top": "0", "left": "0", "right": "0", "bottom": "0", "zIndex": "9", "backgroundColor": "rgba(65,117,5,0.5)"}}>
                  <Spinner style={{"position": "absolute", "top": "45%", "left": "50%"}} animation="border" role="status">
                  </Spinner>
                  <h2 style={{"position": "absolute", "top": "65%", "left": "40%", "msTransform": "translateY(-50%)", "transform": "translateY(-50%)"}}>Submitting Changes</h2>
                </div>

                <div className='pagedetails' style={{ display: (loading) ? "none" : "block"}}>
                    {this.renderContent()}
                </div>
                <Modal show={error !== null} onHide={this.handleCloseError}>
                  <Modal.Header closeButton>
                    <Modal.Title>Error</Modal.Title>
                  </Modal.Header>

                  <Modal.Body>
                    <p>{error}</p>
                  </Modal.Body>

                  <Modal.Footer>
                    <Button variant="primary" onClick={this.handleCloseError}>OK</Button>
                  </Modal.Footer>
                </Modal>

                <Modal show={infoMessage !== null} onHide={this.handleCloseInformation}>
                  <Modal.Header closeButton>
                    <Modal.Title>Information</Modal.Title>
                  </Modal.Header>

                  <Modal.Body>
                    <p>{infoMessage}</p>
                  </Modal.Body>

                  <Modal.Footer>
                    <Button variant="primary" onClick={this.handleCloseInformation}>OK</Button>
                  </Modal.Footer>
                </Modal>
                <div>
                  {usedSocketIO ? (
                    <SocketIOFooter socketioStatus={socketioStatus}/>
                  ) : ( <p></p>
                  )}
                </div>
          </div>
        );
    }

}

export default basePage;

