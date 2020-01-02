import React, { Component } from 'react';
import { Helmet } from 'react-helmet'
//import { css } from '@emotion/core';
import ClipLoader from 'react-spinners/ClipLoader';
import io from 'socket.io-client';
import SocketIOFooter from './footerSocketIO';

class basePage extends Component {
    constructor(props, useSocketIO=false) {
        super(props);
        this.state = {
            loading: true,
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

    render() {
        let { loading, usedSocketIO, socketioStatus } = this.state;
        return (
          <div>
            <Helmet>
                <title>{this.renderTitle()}</title>
            </Helmet>
            <h1>{this.renderTitle()}</h1>
                <div className='sweet-loading' style={{"textAlign": "center"}}>
                    <ClipLoader
                        sizeUnit={"px"}
                        size={35}
                        color={'#36D7B7'}
                        loading={loading}
                    />
                </div>
                <div className='pagedetails' style={{ display: (loading) ? "none" : "block"}}>
                    {this.renderContent()}
                </div>
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

