import React, { useState, useEffect } from 'react';
import { Form, InputGroup } from 'react-bootstrap';

const IPAddressInput = ({ value, onChange, disabled, name, isInvalid, feedback }) => {
  // Parse initial IP string into array of octets
  const parseIP = (ipString) => {
    const octets = ipString ? ipString.split('.') : ['', '', '', ''];
    // Ensure we always have 4 octets
    return octets.length === 4 ? octets : [...octets, ...Array(4 - octets.length).fill('')];
  };

  const [octets, setOctets] = useState(parseIP(value));
  
  // Update local state when prop value changes
  useEffect(() => {
    setOctets(parseIP(value));
  }, [value]);

  // Handle change in one of the octet inputs
  const handleOctetChange = (index, val) => {
    // Only allow empty string or numbers 0-255
    if (val === '' || (/^\d+$/.test(val) && parseInt(val) <= 255)) {
      const newOctets = [...octets];
      newOctets[index] = val;
      setOctets(newOctets);
      
      // Call parent onChange with full IP if all octets are valid
      if (newOctets.every(octet => octet !== '' && parseInt(octet) <= 255)) {
        onChange({ target: { name, value: newOctets.join('.') } });
      }
    }
  };
  
  // Handle keyboard navigation between inputs
  const handleKeyDown = (index, event) => {
    if (event.key === '.' || event.key === ' ') {
      event.preventDefault();
      if (index < 3) {
        document.getElementById(`ip-${name}-${index + 1}`).focus();
      }
    } else if (event.key === 'Backspace' && octets[index] === '' && index > 0) {
      document.getElementById(`ip-${name}-${index - 1}`).focus();
    }
  };

  // Handle pasting a complete IP address
  const handlePaste = (event, index) => {
    const pastedText = event.clipboardData.getData('text');
    
    // Check if the pasted text looks like an IP address
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(pastedText)) {
      event.preventDefault();
      const newOctets = pastedText.split('.');
      setOctets(newOctets);
      onChange({ target: { name, value: pastedText } });
    }
  };
  
  return (
    <InputGroup hasValidation className="ip-address-input">
      {octets.map((octet, index) => (
        <React.Fragment key={index}>
          <Form.Control
            id={`ip-${name}-${index}`}
            type="text"
            value={octet}
            onChange={(e) => handleOctetChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={(e) => handlePaste(e, index)}
            style={{ width: '4rem', textAlign: 'center' }}
            maxLength={3}
            disabled={disabled}
            isInvalid={isInvalid}
          />
          {index < 3 ? (
            <InputGroup.Text className="px-1">.</InputGroup.Text>
          ) : (
            <Form.Control.Feedback type="invalid">
              {feedback}
            </Form.Control.Feedback>
          )}
        </React.Fragment>
      ))}
    </InputGroup>
  );
};

export default IPAddressInput;