// Check actual Plus Code characters from the working examples
const workingCodes = [
  '7Q723JWC+TEST',  // From database - works
  '7Q723JWC+',      // From database  
  'ABC123',         // From database
];

console.log('Analyzing working Plus Codes from database:');
workingCodes.forEach(code => {
  console.log('"' + code + '"');
  if (code.includes('+')) {
    const parts = code.split('+');
    console.log('  Before +: "' + parts[0] + '" (' + parts[0].length + ' chars)');
    console.log('  After +: "' + parts[1] + '" (' + parts[1].length + ' chars)');
  }
  console.log('');
});

// Test a more permissive pattern that allows A-Z and 0-9
const permissivePattern = /^[A-Z0-9]{4,8}\+[A-Z0-9]{0,4}$/i;
console.log('Testing with permissive pattern: ' + permissivePattern.toString());
workingCodes.forEach(code => {
  const result = permissivePattern.test(code);
  console.log((result ? '✅' : '❌') + ' "' + code + '"');
});
