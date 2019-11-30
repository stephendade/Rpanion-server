import React from 'react';
import { Helmet } from 'react-helmet'

function Home() {
  return (
    <div>
        <Helmet>
          <title>The Home Page</title>
        </Helmet>
      <h2>Home</h2>
      <p>Welcome to the Rpanion-server home page</p>
      <p>Use the links on the left to configure the system</p>
    </div>
  );
}

export default Home;
