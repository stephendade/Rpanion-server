import React, { Component } from 'react';
import { Helmet } from 'react-helmet'
import { css } from '@emotion/core';
import ClipLoader from 'react-spinners/ClipLoader';
import io from 'socket.io-client';
import SocketIOFooter from './footerSocketIO';

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

    render() {
        let { loading, usedSocketIO, socketioStatus, waiting } = this.state;
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
                <div className='sweet-waiting' style={{display: (waiting) ? "block" : "none", "textAlign": "center", "position": "fixed", "width": "100%", "height": "100%", "top": "0", "left": "0", "right": "0", "bottom": "0", "zIndex": "9", "backgroundColor": "rgba(65,117,5,0.5)"}}>
                    <ClipLoader
                        sizeUnit={"px"}
                        css={css`position: absolute; top: 50%; -ms-transform: translateY(-50%); transform: translateY(-50%);`}
                        size={60}
                        color={'#417505'}
                        loading={waiting}
                    />
                    <h2 style={{"position": "absolute", "top": "65%", "left": "40%", "msTransform": "translateY(-50%)", "transform": "translateY(-50%)"}}>Submitting Changes</h2>
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

