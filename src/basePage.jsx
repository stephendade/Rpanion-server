import { Component} from 'react';
import { Helmet } from 'react-helmet'
import io from 'socket.io-client';
import SocketIOFooter from './footerSocketIO';
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Spinner from 'react-bootstrap/Spinner';
import React from 'react'
import Login from './login.jsx'

class basePage extends Component {
  constructor(props, useSocketIO = false) {
    super(props);
    this.state = {
      loading: true,
      waiting: false,
      socketioStatus: false,
      usedSocketIO: useSocketIO,
      token: null,
      error: null,
      infoMessage: null,
    }

    // check authentication
    const tokenString = localStorage.getItem('token')
    const userToken = JSON.parse(tokenString)
    this.state.token = userToken?.token

    //verify token, set to null if not valid
    if (this.state.token) {
      fetch('/api/auth', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.state.token}`, // Include token in the Authorization header
        },
      })
      .then((response) => {
        if (!response.ok) {
          // Handle HTTP errors
          return response.json().then((errorData) => {
            if (errorData) {
              console.error(errorData)
              this.setState({ token: null })
            }
          });
        }
        return response.json();
      })
      .then(() => {
      })
      .catch((error) => {
        // Handle errors
        if (error) {
          console.error(error)
          this.setState({ token: null })
        }
      });
    }


    if (this.state.usedSocketIO) {
      this.socket = io({
        extraHeaders: {
          authorization: `Bearer ${this.state.token}`
        }
      })

      // Socket.io client
      this.socket.on('disconnect', function () {
        console.log('Disconnected');
        this.setState({ socketioStatus: false });
      }.bind(this));
      this.socket.on('connect', function () {
        console.log('Connected');
        this.setState({ socketioStatus: true });
      }.bind(this));
    }
  }

  loadDone() {
    this.setState({ loading: false });
  }

  componentWillUnmount() {
    if (this.state.usedSocketIO) {
      this.socket.disconnect();
    }
  }


  handleCloseError = () => {
    // user has closed the error window
    this.setState({ error: null });
  }

  handleCloseInformation = () => {
    // user has closed the information window
    this.setState({ infoMessage: null });
  }

  render() {
    if(!this.state.token) {
      return (
        <div>
          <Helmet>
            <title>{this.renderTitle()}</title>
          </Helmet>
          <h1>{this.renderTitle()}</h1>
          <div className='pagedetails' style={{ display: (this.state.loading) ? "none" : "block" }}>
            <Login />
          </div>
        </div>
      )
    } else {
      return (
        <div>
          <Helmet>
            <title>{this.renderTitle()}</title>
          </Helmet>
          <h1>{this.renderTitle()}</h1>
          <div style={{ display: (this.state.loading) ? "block" : "none" }}>
            <Spinner animation="border" role="status" >
            </Spinner>
            <p><span className="sr-only" size={35}>Loading...</span></p>
          </div>

          <div className='sweet-waiting' style={{ display: (this.state.waiting) ? "block" : "none", "textAlign": "center", "position": "fixed", "width": "100%", "height": "100%", "top": "0", "left": "0", "right": "0", "bottom": "0", "zIndex": "9", "backgroundColor": "rgba(65,117,5,0.5)" }}>
            <Spinner style={{ "position": "absolute", "top": "45%", "left": "50%" }} animation="border" role="status">
            </Spinner>
            <h2 style={{ "position": "absolute", "top": "65%", "left": "40%", "msTransform": "translateY(-50%)", "transform": "translateY(-50%)" }}>Submitting Changes</h2>
          </div>

          <div className='pagedetails' style={{ display: (this.state.loading) ? "none" : "block" }}>
            {this.renderContent()}
          </div>
          <Modal show={this.state.error !== null} onHide={this.handleCloseError}>
            <Modal.Header closeButton>
              <Modal.Title>Error</Modal.Title>
            </Modal.Header>

            <Modal.Body>
              <p>{this.state.error}</p>
            </Modal.Body>

            <Modal.Footer>
              <Button variant="primary" onClick={this.handleCloseError}>OK</Button>
            </Modal.Footer>
          </Modal>

          <Modal show={this.state.infoMessage !== null} onHide={this.handleCloseInformation}>
            <Modal.Header closeButton>
              <Modal.Title>Information</Modal.Title>
            </Modal.Header>

            <Modal.Body>
              <p>{this.state.infoMessage}</p>
            </Modal.Body>

            <Modal.Footer>
              <Button variant="primary" onClick={this.handleCloseInformation}>OK</Button>
            </Modal.Footer>
          </Modal>
          <div>
            {this.state.usedSocketIO ? (
              <SocketIOFooter socketioStatus={this.state.socketioStatus} />
            ) : (<p></p>
            )}
          </div>
        </div>
      );
    }
  }

}

export default basePage;

