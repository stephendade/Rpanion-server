import React, { Component } from 'react';
import { Helmet } from 'react-helmet'

class OldApp extends Component {
  constructor(props) {
    super(props);
    this.state = {
      name: '',
      greeting: '',
      portName: []
    };
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleChange(event) {
    this.setState({ name: event.target.value });
  }

  handleSubmit(event) {
    event.preventDefault();
    fetch(`/api/greeting?name=${encodeURIComponent(this.state.name)}`)
      .then(response => response.json())
      .then(state => this.setState(state));
  }
  
 componentDidMount() {
    this.handleStart();
 }

handleStart() {
    fetch(`/api/test`)
      .then(response => response.json())
      .then(state => this.setState(state));
  }
  
  render() {
    return (
      <div className="OldApp">
		<Helmet>
          <title>The Index Page</title>
        </Helmet>
        <header className="OldApp-header">
          <h1>
            Page Title
          </h1>
          <form onSubmit={this.handleSubmit}>
            <label htmlFor="name">Enter your name: </label>
            <input
              id="name"
              type="text"
              value={this.state.name}
              onChange={this.handleChange}
            />
            <button type="submit">Submit</button>
          </form>
          <p>{this.state.greeting}</p>
          <p>Ports are:</p>
          {this.state.portName.map(function(name, index){
                    return <p key={ index }>{name}</p>;
                  })}

        </header>
      </div>
    );
  }
}

export default OldApp;
