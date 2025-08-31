/**
 * Debug version of App.tsx to test if React mounting works
 */
import React from 'react';

function App() {
  console.log('Flow Desk App component is rendering!');
  
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#f0f0f0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui'
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        textAlign: 'center'
      }}>
        <h1 style={{ color: '#333', margin: '0 0 20px 0' }}>
          🏢 Flow Desk Debug
        </h1>
        <p style={{ color: '#666', margin: '0 0 20px 0' }}>
          React is working! Main process connected successfully.
        </p>
        <div style={{ fontSize: '14px', color: '#999' }}>
          <p>✅ React mounting successful</p>
          <p>✅ Component rendering functional</p>
          <p>✅ Styling applied correctly</p>
        </div>
        
        <button 
          onClick={() => {
            console.log('Button clicked - testing interaction');
            alert('Flow Desk React app is working!');
          }}
          style={{
            marginTop: '20px',
            backgroundColor: '#4285f4',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Test Interaction
        </button>
      </div>
    </div>
  );
}

export default App;