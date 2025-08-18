#!/usr/bin/env tsx

import { config as dotenvConfig } from 'dotenv';
import { fetch } from 'undici';

// Load environment variables
dotenvConfig();

async function testN8nConnection() {
  const apiUrl = process.env.N8N_API_URL;
  const apiKey = process.env.N8N_API_KEY;

  if (!apiUrl || !apiKey) {
    console.error('❌ Missing N8N_API_URL or N8N_API_KEY');
    process.exit(1);
  }

  console.log('🔐 Testing n8n API Connection...');
  console.log(`📍 URL: ${apiUrl}`);
  console.log(`🔑 API Key: ${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 10)}`);

  try {
    // Test 1: Check TLS/HTTPS
    const url = new URL(apiUrl);
    if (url.protocol !== 'https:') {
      console.warn('⚠️  Warning: Not using HTTPS!');
    } else {
      console.log('✅ Using secure HTTPS connection');
    }

    // Test 2: API Connection
    const response = await fetch(`${apiUrl}/api/v1/workflows`, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': apiKey,
        'Accept': 'application/json'
      }
    });

    console.log(`📡 Response Status: ${response.status}`);

    if (response.ok) {
      const data = await response.json() as any;
      console.log('✅ Successfully connected to n8n API');
      console.log(`📊 Found ${data.data?.length || 0} workflows`);
      
      // Test 3: Validate API key format
      if (apiKey.length >= 32 && apiKey.length <= 256) {
        console.log('✅ API key format valid');
      } else {
        console.warn('⚠️  API key length unusual');
      }

      // Test 4: Check response headers for security
      const headers = response.headers;
      console.log('\n🔒 Security Headers Check:');
      
      const securityHeaders = [
        'strict-transport-security',
        'x-content-type-options',
        'x-frame-options',
        'content-security-policy'
      ];

      securityHeaders.forEach(header => {
        const value = headers.get(header);
        if (value) {
          console.log(`  ✅ ${header}: ${value.substring(0, 50)}...`);
        } else {
          console.log(`  ⚠️  ${header}: Not set`);
        }
      });

      return true;
    } else {
      console.error(`❌ API returned status ${response.status}`);
      const errorText = await response.text();
      console.error(`Error: ${errorText}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Connection failed:', error);
    return false;
  }
}

// Run the test
testN8nConnection().then(success => {
  console.log('\n' + '='.repeat(50));
  if (success) {
    console.log('🎉 n8n API Security Validation: PASSED');
  } else {
    console.log('❌ n8n API Security Validation: FAILED');
  }
  process.exit(success ? 0 : 1);
});