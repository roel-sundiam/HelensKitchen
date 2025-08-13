// Test analytics endpoints
const http = require('http');

// Test page view tracking
const pageViewData = JSON.stringify({
  sessionId: 'test-session-123',
  pagePath: '/test',
  pageTitle: 'Test Page',
  referrer: '',
  timeOnPage: 30
});

const pageViewOptions = {
  hostname: 'localhost',
  port: 4001,
  path: '/api/analytics/page-view',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(pageViewData)
  }
};

console.log('Testing page view tracking...');

const pageViewReq = http.request(pageViewOptions, (res) => {
  console.log('Page view tracking status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Page view response:', data);
    
    // Now test analytics overview endpoint
    console.log('\nTesting analytics overview...');
    
    const overviewOptions = {
      hostname: 'localhost',
      port: 4001,
      path: '/api/admin/analytics/overview',
      method: 'GET',
      headers: {
        'Cookie': 'connect.sid=test' // Mock session
      }
    };
    
    const overviewReq = http.request(overviewOptions, (res) => {
      console.log('Analytics overview status:', res.statusCode);
      
      let overviewData = '';
      res.on('data', (chunk) => {
        overviewData += chunk;
      });
      
      res.on('end', () => {
        console.log('Analytics overview response:', overviewData);
      });
    });
    
    overviewReq.on('error', (e) => {
      console.error('Analytics overview error:', e);
    });
    
    overviewReq.end();
  });
});

pageViewReq.on('error', (e) => {
  console.error('Page view tracking error:', e);
});

pageViewReq.write(pageViewData);
pageViewReq.end();