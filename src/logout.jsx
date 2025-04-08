import Button from 'react-bootstrap/Button';
import basePage from './basePage.jsx'
import React from 'react'

import './css/styles.css';

class logoutPage extends basePage {
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
      return 'Confirm Logout'
    }

    handleSubmit = async e => {
      e.preventDefault();
      try {
        const response = await fetch('/api/logout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.state.token}`
          },
          body: JSON.stringify({}),
          });
        // Check if logout was successful
        if (!response.ok) {
          const errorData = await response.json(); // Get the error response from the server
          throw new Error(errorData.message || 'Failed to logout');
        }

        // If logout is successful, process the data (e.g., delete token)
        const data = await response.json();
        console.log('Logout successful:', data);
        localStorage.removeItem('token', JSON.stringify(data));
        window.location.reload();
                
        // Clear any previous error message
        //setErrorMessage('');

      } catch (error) {
        // If an error occurred, set the error message
        //setErrorMessage(error.message);
      }
    }

    renderContent () {
      return (
        <form onSubmit={this.handleSubmit}>
        <div>
          <Button type="submit">Logout</Button>
        </div>
      </form>
      )
    }
  }
  
export default logoutPage