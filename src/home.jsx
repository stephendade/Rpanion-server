import React from 'react'
import basePage from './basePage.jsx'

class Home extends basePage {
  constructor (props) {
    super(props)
    this.state = {
      ...this.state
    }
  }

  componentDidMount () {
    this.loadDone()
  }

  renderTitle () {
    return 'Home Page'
  }

  renderContent () {
    return (
      <div>
        <p>Welcome to the Rpanion-server home page</p>
        <p>Use the links on the left to configure the system</p>
        <p><a href='https://github.com/stephendade/Rpanion-server'>Rpanion-server website</a></p>
        <p><a href='https://www.docs.rpanion.com/software/rpanion-server'>Rpanion-server documentation</a></p>
      </div>
    )
  }
}

export default Home
