import React from 'react';

export default function AppLoading({ message = '読み込み中...' }) {
  return (
    <div className="app-loading">
      <div className="app-loading-logo">HP</div>
      <p className="app-loading-text">{message}</p>
    </div>
  );
}
