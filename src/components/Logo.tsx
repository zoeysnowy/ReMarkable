import React from 'react';
import logoSvg from '../assets/icons/LOGO.svg';

const Logo: React.FC = () => {
  return (
    <div className="logo-container">
      <img
        src={logoSvg}
        alt="ReMarkable Logo"
        className="logo-image"
        width="60"
        height="60"
      />
    </div>
  );
};

export default Logo;
