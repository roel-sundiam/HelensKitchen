// Test Plus Code validation
const plusCodePattern = /^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}$/i;

const testCodes = [
  '7Q63G5J5+',      // Incomplete (your example) - should FAIL
  '7Q63G5J5+XY',    // Valid global code - should PASS
  '7Q63G5J5+XYZ',   // Valid global code - should PASS
  'G5J5+XY',        // Valid local code - should PASS
  'G5J5+XYZ',       // Valid local code - should PASS
  '7Q723JWC+TEST',  // Valid (from database) - should PASS
  '7Q723JWC+',      // Invalid (from database) - should FAIL
  'ABC123',         // Invalid format - should FAIL
  '',               // Empty - should be handled separately
];

console.log('Plus Code Validation Test Results:');
console.log('Pattern:', plusCodePattern.toString());
console.log('');

testCodes.forEach(code => {
  const result = plusCodePattern.test(code);
  const status = result ? '✅ PASS' : '❌ FAIL';
  console.log(`${status} "${code}"`);
});
