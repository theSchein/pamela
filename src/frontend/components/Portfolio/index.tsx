import React from 'react';

const Portfolio = () => {
  return (
    <div style={{ width: '25%', backgroundColor: '#f0f0f0', padding: '20px', borderRight: '1px solid #ccc' }}>
      <h2 style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '20px' }}>Portfolio</h2>
      <ul>
        <li style={{ marginBottom: '10px', padding: '10px', borderRadius: '5px', backgroundColor: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
          <span style={{ fontWeight: 'bold' }}>Market A:</span> YES @ $0.65
        </li>
        <li style={{ marginBottom: '10px', padding: '10px', borderRadius: '5px', backgroundColor: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
          <span style={{ fontWeight: 'bold' }}>Market B:</span> NO @ $0.20
        </li>
      </ul>
    </div>
  );
};

export default Portfolio;
