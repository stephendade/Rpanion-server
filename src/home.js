import React from 'react';

import basePage from './basePage.js';

class Home extends basePage {
    constructor(props) {
        super(props);
        this.state = {
            loading: true
        }

    }

    componentDidMount() {
        this.loadDone()
    }

    renderTitle() {
        return "Home Page";
    }

    renderContent() {
      return (
        <div>
          <p>Welcome to the Rpanion-server home page</p>
          <p>Use the links on the left to configure the system</p>
        </div>
      );
    }

}

export default Home;
