// Test with actual Google Plus Code examples
const testCodes = [
  // These should be valid according to Google's spec
  '8FW4V75V+8Q',    // Example from Google docs
  '796RWF8Q+WF',    // Another real example  
  'CFX3+7R',        // Short form example
  '7Q63G5J5+XY',    // Your original query (if XY were valid chars)
  '7Q63G5J5+22',    // Using only numbers after +
  '7Q63G5J5+2C',    // Mixed numbers and valid letters
  
  // These should fail
  '7Q63G5J5+',      // Incomplete
  '7Q63G5J5+XY',    // Invalid chars X,Y
  'ABC123',         // Not Plus Code format
];

// Google's actual character set (excludes 0,1,I,L,O,U to avoid confusion)
const googlePattern = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}$/i;

console.log('Testing Google Plus Code validation:');
console.log('Valid chars: 23456789CFGHJMPQRVWX');
console.log('');

testCodes.forEach(code => {
  const result = googlePattern.test(code);
  const status = result ? '✅ VALID' : '❌ INVALID';
  console.log(status + ' "' + code + '"');
});

// Also test what characters are actually in the valid set
console.log('');
console.log('Character analysis:');
const validChars = '23456789CFGHJMPQRVWX';
['X', 'Y', '2', 'C', 'Q', 'G', 'J', 'W', '5', '7'].forEach(char => {
  const isValid = validChars.includes(char.toUpperCase());
  console.log((isValid ? '✅' : '❌') + ' "' + char + '"');
});
