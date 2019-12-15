import React, { Component } from 'react';
import { Helmet } from 'react-helmet'
//import { css } from '@emotion/core';
import ClipLoader from 'react-spinners/ClipLoader';

class basePage extends Component {
    constructor(props) {
        super(props);
        this.state = {
            loading: true
        }
    }

    loadDone() {
        this.setState({loading: false});
    }

    render() {
        let { loading } = this.state;
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
          </div>
        );
    }

}

export default basePage;

