const TradeHistory = () => {
  return (
    <div style={{ width: '25%', backgroundColor: '#f0f0f0', padding: '20px', borderLeft: '1px solid #ccc' }}>
      <h2 style={{ fontSize: '1.2em', fontWeight: 'bold', marginBottom: '20px' }}>Recent Trades</h2>
      <ul>
        <li style={{ marginBottom: '10px', padding: '10px', borderRadius: '5px', backgroundColor: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
          <span style={{ fontWeight: 'bold' }}>Market A:</span> BOUGHT YES @ $0.60
        </li>
        <li style={{ marginBottom: '10px', padding: '10px', borderRadius: '5px', backgroundColor: 'white', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
          <span style={{ fontWeight: 'bold' }}>Market C:</span> SOLD NO @ $0.80
        </li>
      </ul>
    </div>
  );
};

export default TradeHistory;
