import React, { Component } from 'react';
import { Helmet } from 'react-helmet'

class AboutPage extends Component {
    constructor(props) {
        super(props);
        this.state = {
            OSVersion: "",
            Nodejsversion: "",
            rpanionversion: "",
            CPUName: "",
            RAMName: "",
        }
    }

    componentDidMount() {
        fetch(`/api/softwareinfo`).then(response => response.json()).then(state => this.setState(state));
        fetch(`/api/hardwareinfo`).then(response => response.json()).then(state => this.setState(state));
     }

    render() {
      return (
            <div>
                <Helmet>
                  <title>The About Page</title>
                </Helmet>
              <h2>About Hardware</h2>
              <p>CPU: {this.state.CPUName}</p>
              <p>RAM: {this.state.RAMName} GB</p>
              <h2>About Software</h2>
              <p>OS version: {this.state.OSVersion}</p>
              <p>Node.js version: {this.state.Nodejsversion}</p>
              <p>Rpanion-server version: {this.state.rpanionversion}</p>
            </div>
          );
    }
}


export default AboutPage;
